<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Make L available globally for plugins that expect it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).L = L

// Note: leaflet.heat is lazy-loaded in useMapLayers when heatmap is first enabled

import type { LeafletEvent } from 'leaflet'
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick, type Ref } from 'vue'
import type { MultiPolygon, Polygon } from 'geojson'
import {
  useLeafletMap,
  useLeafletTileLayer,
  useLeafletDisplayLayer,
  useLeafletEvent,
} from 'vue-use-leaflet'
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'
import type { MarkerData, PolygonData, ReportMarkerData, BoundsLiteral, PopupDataBuilder } from './types'
import MapControls from './MapControls.vue'
import {
  useMapLayers,
  useMapControls,
  useMinimap,
  POLYGON_VISIBLE_ZOOM,
  TILE_LAYERS,
  type TileStyle,
} from '@/composables/map'
import { logDevError } from '@/config/map'

// Extend L namespace for heatmap
declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      minOpacity?: number
      maxZoom?: number
      max?: number
      radius?: number
      blur?: number
      gradient?: Record<number, string>
    },
  ): L.Layer
}

// Global dark mode
const darkModeStore = useDarkModeStore()
const { isDark: globalDarkMode } = storeToRefs(darkModeStore)

// ─────────────────────────────────────────────────────────────
// Props & Emits
// ─────────────────────────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    markers: MarkerData[]
    polygons?: PolygonData[]
    reportMarkers?: ReportMarkerData[]
    zoomLevel?: number
    focusBounds?: BoundsLiteral | null
    searchMarker?: { lat: number; lng: number } | null
    searchPolygon?: Polygon | MultiPolygon | null
    /** Optional lazy popup builder - if provided, popups compute on open instead of up-front */
    popupBuilder?: PopupDataBuilder
  }>(),
  {
    zoomLevel: 4,
    polygons: () => [],
    reportMarkers: () => [],
    focusBounds: null,
    searchMarker: null,
    searchPolygon: null,
    popupBuilder: undefined,
  },
)

const emit = defineEmits<{
  (e: 'setZoom', level: number): void
  (e: 'update:showPlaybackControls', value: boolean): void
}>()

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CANADA_BOUNDS: L.LatLngBoundsExpression = [
  [10, -170],
  [90, -40],
]

// ─────────────────────────────────────────────────────────────
// Refs & State
// ─────────────────────────────────────────────────────────────
const el = ref<HTMLElement | null>(null)
const wrapperEl = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const isFullscreen = ref(false)
const isZooming = ref(false)
const renderPending = ref(false)
const heatmapPending = ref(false)
const polygonsVisible = ref(false)
const pendingFocusBounds = ref<BoundsLiteral | null>(null)

// Layer visibility toggles
const showMarkers = ref(true)
const showPolygons = ref(true)
const showHeatmap = ref(false)
const showReportMarkers = ref(true)
const showPlaybackControls = ref(false)

// Tile style - synced with global dark mode
const tileStyle = computed<TileStyle>(() => (globalDarkMode.value ? 'dark' : 'light'))

// Layers
const markerLayer = ref<L.LayerGroup | null>(null)
const geoJsonLayer = ref<L.GeoJSON | null>(null)
const heatmapLayer = ref<L.Layer | null>(null)
const searchMarkerLayer = ref<L.Marker | null>(null)
const searchPolygonLayer = ref<L.GeoJSON | null>(null)
const reportMarkerLayer = ref<L.LayerGroup | null>(null)
const activeTileLayer = ref<L.TileLayer | null>(null)

// Minimap
const minimapEl = ref<HTMLElement | null>(null)
const minimapInstance = ref<L.Map | null>(null)
const minimapRect = ref<L.Rectangle | null>(null)

// Computed
const isDarkMode = globalDarkMode

// ─────────────────────────────────────────────────────────────
// Map Setup
// ─────────────────────────────────────────────────────────────
const map = useLeafletMap(el, {
  preferCanvas: true,
  zoomControl: false,
  zoomAnimation: true,
  markerZoomAnimation: false,
  maxBoundsViscosity: 1.0,
  bounceAtZoomLimits: true,
  inertia: true,
  inertiaDeceleration: 3000,
  minZoom: 3,
  maxZoom: 18,
  maxBounds: CANADA_BOUNDS,
  center: [56.0, -96.0],
  zoom: props.zoomLevel,
})

// Initial tile layer (will be managed manually for switching)
const tileLayer = useLeafletTileLayer(TILE_LAYERS.light.url, {
  attribution: TILE_LAYERS.light.attribution,
  subdomains: 'abcd',
  maxZoom: 20,
})

// Store reference to initial tile layer
const initialTileLayerAdded = ref(false)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
useLeafletDisplayLayer(map as any, tileLayer as any)

// Track pending tile switch
const pendingTileStyle = ref<TileStyle | null>(null)
const currentTileStyle = ref<TileStyle>('light')

// ─────────────────────────────────────────────────────────────
// Composables Setup
// ─────────────────────────────────────────────────────────────
const { zoomIn, zoomOut, resetView, locateMe, toggleFullscreen, zoomToBounds, focusMap } =
  useMapControls({
    map,
    wrapperEl,
    isFullscreen,
    pendingFocusBounds,
  })

const {
  queueMarkerRender,
  renderMarkers,
  renderPolygons,
  renderHeatmap,
  renderSearchMarker,
  renderSearchPolygon,
  queueReportMarkerRender,
  renderReportMarkers,
  cleanup: cleanupLayers,
} = useMapLayers(
  {
    map: map as Ref<L.Map | null>,
    showMarkers,
    showPolygons,
    showHeatmap,
    showReportMarkers,
    isZooming,
    onZoomToBounds: zoomToBounds,
    popupBuilder: props.popupBuilder,
  },
  {
    markerLayer,
    geoJsonLayer,
    heatmapLayer,
    searchMarkerLayer,
    searchPolygonLayer,
    reportMarkerLayer,
    polygonsVisible,
    renderPending,
    heatmapPending,
  },
)

const {
  initMinimap,
  updateMinimapRect,
  updateMinimapTiles,
  cleanup: cleanupMinimap,
} = useMinimap(
  {
    map: map as Ref<L.Map | null>,
    minimapEl,
    initialStyle: tileStyle.value,
  },
  {
    minimapInstance,
    minimapRect,
  },
)

// ─────────────────────────────────────────────────────────────
// Tile Layer Switching
// ─────────────────────────────────────────────────────────────
const switchTileLayer = (style: TileStyle) => {
  const activeMap = map.value
  if (!activeMap) return

  // Don't switch tiles during zoom to avoid errors - queue it instead
  if (isZooming.value) {
    pendingTileStyle.value = style
    return
  }

  // Skip if already using this style
  if (currentTileStyle.value === style && (activeTileLayer.value || tileLayer.value)) {
    return
  }

  // Clear any pending switch since we're doing it now
  pendingTileStyle.value = null
  currentTileStyle.value = style

  const config = TILE_LAYERS[style]

  // If we have an active managed tile layer, just update its URL
  if (activeTileLayer.value) {
    activeTileLayer.value.setUrl(config.url)
    updateMinimapTiles(style)
    return
  }

  // First time switching - need to replace the initial vue-use-leaflet tile layer
  if (tileLayer.value) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initialLayer = tileLayer.value as any
      if (initialLayer._map) {
        initialLayer.remove()
      }
    } catch (e) {
      logDevError('Failed to remove initial tile layer', e)
    }
  }

  // Create our managed tile layer
  const newLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    subdomains: 'abcd',
    maxZoom: 20,
  })
  newLayer.addTo(activeMap as L.Map)
  activeTileLayer.value = newLayer
  initialTileLayerAdded.value = true

  // Update minimap if exists
  updateMinimapTiles(style)
}

const toggleDarkMode = () => {
  darkModeStore.toggle()
}

// Watch for global dark mode changes to update map tiles
watch(globalDarkMode, (isDark) => {
  switchTileLayer(isDark ? 'dark' : 'light')
})

// ─────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
useLeafletEvent(map as any, 'zoomstart', () => {
  isZooming.value = true
  // Close any open popup to prevent _map null errors during zoom animation
  map.value?.closePopup()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
useLeafletEvent(map as any, 'zoomend', (event: LeafletEvent) => {
  const target = event.target
  if (target instanceof L.Map) {
    emit('setZoom', target.getZoom())
  }

  // Small delay to ensure all zoom animations are complete
  requestAnimationFrame(() => {
    isZooming.value = false
    updateMinimapRect()

    // Process pending tile style switch after zoom completes
    if (pendingTileStyle.value) {
      const style = pendingTileStyle.value
      pendingTileStyle.value = null
      nextTick(() => switchTileLayer(style))
    }

    // Process pending heatmap render after zoom completes
    if (heatmapPending.value) {
      nextTick(() => renderHeatmap(props.markers))
    }

    if (renderPending.value) {
      renderPending.value = false
      renderMarkers(props.markers)
      renderPolygons(props.polygons)
      renderReportMarkers(props.reportMarkers)
      return
    }

    const currentZoom = (target as L.Map).getZoom()
    const shouldShowPolygons = currentZoom >= POLYGON_VISIBLE_ZOOM
    if (shouldShowPolygons !== polygonsVisible.value) {
      queueMarkerRender(props.markers)
      renderPolygons(props.polygons)
    }
  })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
useLeafletEvent(map as any, 'moveend', () => {
  updateMinimapRect()
})

// Clear loading when tiles are ready or after timeout
watch(
  tileLayer,
  (layer) => {
    if (layer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(layer as any).once('load', () => {
        isLoading.value = false
      })
    }
  },
  { immediate: true },
)

// Also watch activeTileLayer for when we switch tiles
watch(activeTileLayer, (layer) => {
  if (layer) {
    layer.once('load', () => {
      isLoading.value = false
    })
  }
})

// Fallback: clear loading after a short delay if tiles haven't loaded
setTimeout(() => {
  if (isLoading.value) {
    isLoading.value = false
  }
}, 2000)

// ─────────────────────────────────────────────────────────────
// Watchers
// ─────────────────────────────────────────────────────────────
// Use shallow comparison for markers/polygons arrays
// The arrays are replaced (not mutated) when data changes, so deep watching is unnecessary
watch(
  () => props.markers,
  () => {
    queueMarkerRender(props.markers)
    if (showHeatmap.value && !isZooming.value) {
      renderHeatmap(props.markers)
    }
  },
)

watch(
  () => props.polygons,
  () => renderPolygons(props.polygons),
)

watch(
  () => props.focusBounds,
  (bounds) => {
    if (bounds) focusMap(bounds)
  },
)

watch(
  () => props.searchMarker,
  () => renderSearchMarker(props.searchMarker),
)

watch(
  () => props.searchPolygon,
  () => renderSearchPolygon(props.searchPolygon),
)

watch(
  () => props.reportMarkers,
  () => queueReportMarkerRender(props.reportMarkers),
)

// Handle pending focus after map init
watch(map, (mapInstance) => {
  if (mapInstance && pendingFocusBounds.value) {
    zoomToBounds(pendingFocusBounds.value)
    pendingFocusBounds.value = null
  }
})

// Re-render when visibility toggles change
watch(showMarkers, () => renderMarkers(props.markers))
watch(showPolygons, () => renderPolygons(props.polygons))
watch(showHeatmap, () => renderHeatmap(props.markers))
watch(showReportMarkers, () => renderReportMarkers(props.reportMarkers))
watch(showPlaybackControls, (val) => emit('update:showPlaybackControls', val))

// ─────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────
onMounted(() => {
  setTimeout(() => {
    if (globalDarkMode.value) {
      switchTileLayer('dark')
    }

    renderMarkers(props.markers)
    renderPolygons(props.polygons)
    renderHeatmap(props.markers)
    renderSearchMarker(props.searchMarker)
    renderSearchPolygon(props.searchPolygon)
    initMinimap()
  }, 100)
})

onBeforeUnmount(() => {
  cleanupLayers()
  cleanupMinimap()
})

// Expose methods for parent
defineExpose({
  zoomIn,
  zoomOut,
  resetView,
  locateMe,
  focusMap,
  toggleDarkMode,
})
</script>

<template>
  <div
    ref="wrapperEl"
    class="relative w-full h-full min-h-[400px] overflow-hidden bg-linear-to-br from-[#e8eef7] to-[#d8e4f3] shadow-[0_4px_24px_rgba(5,15,29,0.08),0_1px_3px_rgba(5,15,29,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]"
  >
    <!-- Loading Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300 ease-in-out"
      leave-active-class="transition-opacity duration-300 ease-in-out"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isLoading"
        class="absolute inset-0 z-1000 flex flex-col items-center justify-center gap-3 bg-linear-to-br from-[rgba(232,238,247,0.95)] to-[rgba(216,228,243,0.95)] backdrop-blur-lg"
      >
        <div
          class="w-9 h-9 border-[3px] border-primary-200 border-t-primary-500 rounded-full animate-spin"
        ></div>
        <span class="text-sm font-medium text-muted">Loading map...</span>
      </div>
    </Transition>

    <!-- Map Container -->
    <div ref="el" class="w-full h-full z-1"></div>

    <!-- Controls -->
    <MapControls
      :is-dark-mode="isDarkMode"
      :is-fullscreen="isFullscreen"
      :show-markers="showMarkers"
      :show-polygons="showPolygons"
      :show-heatmap="showHeatmap"
      :show-report-markers="showReportMarkers"
      :show-playback-controls="showPlaybackControls"
      @zoomIn="zoomIn"
      @zoomOut="zoomOut"
      @resetView="resetView"
      @locateMe="locateMe"
      @toggleFullscreen="toggleFullscreen"
      @toggleDarkMode="toggleDarkMode"
      @toggleMarkers="showMarkers = !showMarkers"
      @togglePolygons="showPolygons = !showPolygons"
      @toggleHeatmap="showHeatmap = !showHeatmap"
      @toggleReportMarkers="showReportMarkers = !showReportMarkers"
      @togglePlaybackControls="showPlaybackControls = !showPlaybackControls"
    />

    <!-- Minimap -->
    <div
      ref="minimapEl"
      class="map-minimap map-control-panel absolute bottom-[50px] right-4 z-999 w-[150px] h-[100px] bg-white/92 dark:bg-slate-800/92 backdrop-blur-xl rounded-[14px] border border-primary-300/30 dark:border-primary-600/30 overflow-hidden"
    ></div>

    <!-- Slot for content that should be visible in fullscreen -->
    <slot name="fullscreen-content" :is-fullscreen="isFullscreen"></slot>

    <!-- Attribution badge -->
    <div
      class="map-badge absolute bottom-4 left-4 z-1000 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-900 dark:text-primary-300 bg-primary-100/25 dark:bg-primary-500/20 backdrop-blur-lg border border-primary-500/30 dark:border-primary-400/40 rounded-full transition-[left] duration-200"
    >
      <span class="badge-dot w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse-dot"></span>
      Live Data
    </div>
  </div>
</template>

<style>
/* Animations */
@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

@keyframes marker-pulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2);
    opacity: 0;
  }
}

@keyframes cluster-ring-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.3;
  }
}

@keyframes search-ring-pulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

.animate-pulse-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}

/* Timeline open state - adjusts badge position when sidebar is open */
body.timeline-open .map-badge {
  left: calc(32px + 7rem);
}

/* Global marker styles (applied to dynamically created Leaflet elements) */
.map-marker {
  background: transparent !important;
  border: none !important;
}

.map-marker .marker-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  transform: translate(-50%, -50%);
  background: linear-gradient(145deg, #ff9c1a, #ff7c00);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow:
    0 2px 8px rgba(255, 156, 26, 0.5),
    0 1px 2px rgba(0, 0, 0, 0.1);
}

.map-marker .marker-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  background: rgba(255, 156, 26, 0.3);
  border-radius: 50%;
  animation: marker-pulse 2s ease-out infinite;
}

/* CircleMarker styles (lightweight SVG markers for large datasets) */
.map-circle-marker {
  cursor: pointer;
  transition: stroke-width 0.15s ease;
}

.map-circle-marker:hover {
  stroke-width: 3;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

/* CircleMarker cluster count labels */
.circle-marker-label-container {
  background: transparent !important;
  border: none !important;
  pointer-events: none;
}

.circle-marker-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* Cluster styles */
.map-cluster {
  background: transparent !important;
  border: none !important;
}

.map-cluster .cluster-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(24, 184, 166, 0.4);
  border-radius: 50%;
  animation: cluster-ring-pulse 3s ease-in-out infinite;
}

.map-cluster .cluster-core {
  position: absolute;
  inset: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #18b8a6, #0f9c8d);
  border-radius: 50%;
  box-shadow:
    0 3px 12px rgba(24, 184, 166, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.map-cluster .cluster-count {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.map-cluster--sm .cluster-count {
  font-size: 10px;
}
.map-cluster--md .cluster-count {
  font-size: 12px;
}
.map-cluster--lg .cluster-count {
  font-size: 13px;
}
.map-cluster--xl .cluster-count {
  font-size: 14px;
}

/* Search marker */
.map-search-marker {
  background: transparent !important;
  border: none !important;
}

.map-search-marker .search-marker-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  transform: translate(-50%, -50%);
  background: linear-gradient(145deg, #6366f1, #4f46e5);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.5);
}

.map-search-marker .search-marker-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(99, 102, 241, 0.5);
  border-radius: 50%;
  animation: search-ring-pulse 2s ease-out infinite;
}

/* Popup styles */
.map-popup-container .leaflet-popup-content-wrapper {
  padding: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  box-shadow:
    0 8px 32px rgba(5, 15, 29, 0.15),
    0 2px 8px rgba(5, 15, 29, 0.08);
  overflow: hidden;
}

.dark .map-popup-container .leaflet-popup-content-wrapper {
  background: rgba(15, 23, 42, 0.94);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.map-popup-container .leaflet-popup-content {
  margin: 0;
  min-width: 180px;
}

.map-popup-container .leaflet-popup-tip {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 2px 4px rgba(5, 15, 29, 0.1);
}

.dark .map-popup-container .leaflet-popup-tip {
  background: rgba(15, 23, 42, 0.94);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.map-popup-container .leaflet-popup-close-button {
  top: 8px !important;
  right: 8px !important;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 16px;
  font-weight: 500;
  color: #4b5567;
  background: rgba(5, 15, 29, 0.05);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.dark .map-popup-container .leaflet-popup-close-button {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.18);
}

.map-popup-container .leaflet-popup-close-button:hover {
  color: #ff9c1a;
  background: rgba(255, 156, 26, 0.1);
}

.dark .map-popup-container .leaflet-popup-close-button:hover {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.18);
}

.map-popup {
  padding: 16px;
}

.map-popup__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #0b1628;
}

.map-popup__time {
  display: block;
  margin-bottom: 12px;
  font-size: 12px;
  color: #4b5567;
}

.map-popup__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-popup__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(5, 15, 29, 0.03);
  border-radius: 8px;
}

.map-popup__item-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.map-popup__zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(24, 184, 166, 0.1);
  color: #18b8a6;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.map-popup__zoom-btn:hover {
  background: rgba(24, 184, 166, 0.2);
  color: #14a897;
  transform: scale(1.05);
}

.map-popup__zoom-btn:active {
  transform: scale(0.95);
}

.map-popup__provider {
  font-size: 13px;
  font-weight: 500;
  color: #1e2b44;
}

.map-popup__size {
  font-size: 11px;
  font-weight: 500;
  color: #18b8a6;
  background: rgba(24, 184, 166, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.map-popup__extra {
  margin: 8px 0 0;
  font-size: 12px;
  color: #4b5567;
  text-align: center;
}

.map-popup__empty {
  margin: 0;
  font-size: 13px;
  color: #4b5567;
  text-align: center;
}

.dark .map-popup__empty {
  color: #94a3b8;
}

/* Tooltip styles */
.map-tooltip-container {
  background: rgba(11, 22, 40, 0.95) !important;
  backdrop-filter: blur(8px);
  border: none !important;
  border-radius: 8px !important;
  padding: 0 !important;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 1px 3px rgba(0, 0, 0, 0.1) !important;
}

.map-tooltip-container::before {
  border-top-color: rgba(11, 22, 40, 0.95) !important;
}

.map-tooltip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
}

.map-tooltip strong {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.map-tooltip span {
  font-size: 11px;
  color: #94a3b8;
}

/* Leaflet control overrides */
.leaflet-container {
  font-family: 'Space Grotesk', 'Manrope', system-ui, sans-serif;
}

.leaflet-control-attribution {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(4px);
  padding: 2px 8px !important;
  border-radius: 8px 0 0 0 !important;
}

.leaflet-control-attribution a {
  color: #4b5567 !important;
}

/* Minimap overrides */
.map-minimap.leaflet-container {
  background: transparent;
}

.map-minimap .leaflet-tile-pane {
  opacity: 0.7;
}

/* ─── User Report Markers (violet) ─── */
.map-report-marker {
  background: transparent !important;
  border: none !important;
}

.map-report-marker .report-marker-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  transform: translate(-50%, -50%);
  background: linear-gradient(145deg, #8b5cf6, #7c3aed);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow:
    0 2px 8px rgba(139, 92, 246, 0.5),
    0 1px 2px rgba(0, 0, 0, 0.1);
}

.map-report-marker .report-marker-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  background: rgba(139, 92, 246, 0.3);
  border-radius: 50%;
  animation: marker-pulse 2s ease-out infinite;
}

.map-report-cluster {
  background: transparent !important;
  border: none !important;
}

.map-report-cluster .report-cluster-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(139, 92, 246, 0.4);
  border-radius: 50%;
  animation: cluster-ring-pulse 3s ease-in-out infinite;
}

.map-report-cluster .report-cluster-core {
  position: absolute;
  inset: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #8b5cf6, #7c3aed);
  border-radius: 50%;
  box-shadow:
    0 3px 12px rgba(139, 92, 246, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.map-report-cluster .cluster-count {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
