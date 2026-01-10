<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import './map-comp.css'
import './map-markers.css'
import L from 'leaflet'

// Make L available globally for plugins that expect it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).L = L

// Now import the heat plugin after L is globally available
import 'leaflet.heat'

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
import type { MarkerData, PolygonData, BoundsLiteral, PopupDataBuilder } from './types'
import MapControls from './MapControls.vue'
import {
  useMapLayers,
  useMapControls,
  useMinimap,
  POLYGON_VISIBLE_ZOOM,
  TILE_LAYERS,
  type TileStyle,
} from '@/composables/map'

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
const showLayerControls = ref(false)
const showPlaybackControls = ref(false)

// Tile style - synced with global dark mode
const tileStyle = computed<TileStyle>(() => (globalDarkMode.value ? 'dark' : 'light'))

// Layers
const markerLayer = ref<L.LayerGroup | null>(null)
const geoJsonLayer = ref<L.GeoJSON | null>(null)
const heatmapLayer = ref<L.Layer | null>(null)
const searchMarkerLayer = ref<L.Marker | null>(null)
const searchPolygonLayer = ref<L.GeoJSON | null>(null)
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
  cleanup: cleanupLayers,
} = useMapLayers(
  {
    map: map as Ref<L.Map | null>,
    showMarkers,
    showPolygons,
    showHeatmap,
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
    } catch {
      // Ignore removal errors
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

const toggleLayerControls = () => {
  showLayerControls.value = !showLayerControls.value
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
  <div ref="wrapperEl" class="map-wrapper" :class="{ 'map-wrapper--dark': isDarkMode }">
    <!-- Loading Overlay -->
    <Transition name="fade">
      <div v-if="isLoading" class="map-loading">
        <div class="map-loading__spinner"></div>
        <span class="map-loading__text">Loading map...</span>
      </div>
    </Transition>

    <!-- Map Container -->
    <div ref="el" class="map-container"></div>

    <!-- Controls -->
    <MapControls
      :is-dark-mode="isDarkMode"
      :is-fullscreen="isFullscreen"
      :show-layer-controls="showLayerControls"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset-view="resetView"
      @locate-me="locateMe"
      @toggle-fullscreen="toggleFullscreen"
      @toggle-dark-mode="toggleDarkMode"
      @toggle-layer-controls="toggleLayerControls"
    />

    <!-- Layer Controls Panel -->
    <Transition name="slide-fade">
      <div v-if="showLayerControls" class="map-layer-controls">
        <h4 class="map-layer-controls__title">Layers</h4>
        <label class="map-layer-toggle">
          <input v-model="showMarkers" type="checkbox" class="map-layer-toggle__input" />
          <span class="map-layer-toggle__slider"></span>
          <span class="map-layer-toggle__label">Markers</span>
        </label>
        <label class="map-layer-toggle">
          <input v-model="showPolygons" type="checkbox" class="map-layer-toggle__input" />
          <span class="map-layer-toggle__slider"></span>
          <span class="map-layer-toggle__label">Boundaries</span>
        </label>
        <label class="map-layer-toggle">
          <input v-model="showHeatmap" type="checkbox" class="map-layer-toggle__input" />
          <span class="map-layer-toggle__slider"></span>
          <span class="map-layer-toggle__label">Heatmap</span>
        </label>
        <label class="map-layer-toggle">
          <input v-model="showPlaybackControls" type="checkbox" class="map-layer-toggle__input" />
          <span class="map-layer-toggle__slider"></span>
          <span class="map-layer-toggle__label">Playback</span>
        </label>
      </div>
    </Transition>

    <!-- Minimap -->
    <div ref="minimapEl" class="map-minimap"></div>

    <!-- Slot for content that should be visible in fullscreen -->
    <slot name="fullscreen-content" :is-fullscreen="isFullscreen"></slot>

    <!-- Attribution badge -->
    <div class="map-badge">
      <span class="map-badge__dot"></span>
      Live Data
    </div>
  </div>
</template>
