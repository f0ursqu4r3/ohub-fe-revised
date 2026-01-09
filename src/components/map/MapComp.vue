<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Make L available globally for plugins that expect it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).L = L

// Now import the heat plugin after L is globally available
import 'leaflet.heat'

import type { LeafletEvent } from 'leaflet'
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import {
  useLeafletMap,
  useLeafletTileLayer,
  useLeafletDisplayLayer,
  useLeafletEvent,
} from 'vue-use-leaflet'
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'
import type { MarkerData, PolygonData, BoundsLiteral } from './types'

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
  }>(),
  {
    zoomLevel: 4,
    polygons: () => [],
    focusBounds: null,
    searchMarker: null,
    searchPolygon: null,
  },
)

const emit = defineEmits<{
  (e: 'setZoom', level: number): void
}>()

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CANADA_BOUNDS: L.LatLngBoundsExpression = [
  [10, -170],
  [90, -40],
]
const POLYGON_VISIBLE_ZOOM = 5
const BRAND_CLUSTER_COLOR = '#18b8a6'
const BRAND_CLUSTER_FILL = 'rgba(110, 233, 215, 0.25)'
const BRAND_OUTAGE_COLOR = '#ff9c1a'
const BRAND_OUTAGE_FILL = 'rgba(255, 212, 138, 0.3)'
const SEARCH_COLOR = '#6366f1'
const SEARCH_FILL = 'rgba(99, 102, 241, 0.15)'

// Tile providers
const TILE_LAYERS = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const

type TileStyle = keyof typeof TILE_LAYERS

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

// Tile style - synced with global dark mode
const tileStyle = computed<TileStyle>(() => (globalDarkMode.value ? 'dark' : 'light'))

// Layers - using L.GeoJSON for proper type compatibility
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

// Debouncing
const debounceTimer = ref<number | null>(null)

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

  // Clear any pending switch since we're doing it now
  pendingTileStyle.value = null

  // Remove existing managed tile layer safely
  if (activeTileLayer.value) {
    const layerToRemove = activeTileLayer.value
    activeTileLayer.value = null
    try {
      // Clear all event listeners before removing
      layerToRemove.off()
      layerToRemove.remove()
    } catch {
      // Ignore removal errors
    }
  }

  // Remove initial tile layer on first switch
  if (!initialTileLayerAdded.value && tileLayer.value) {
    try {
      const initialLayer = tileLayer.value as L.TileLayer
      initialLayer.off()
      initialLayer.remove()
    } catch {
      // Ignore removal errors
    }
    initialTileLayerAdded.value = true
  }

  // Add new tile layer
  const config = TILE_LAYERS[style]
  const newLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    subdomains: 'abcd',
    maxZoom: 20,
  })
  newLayer.addTo(activeMap as L.Map)
  activeTileLayer.value = newLayer

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
// Minimap
// ─────────────────────────────────────────────────────────────
const initMinimap = () => {
  if (!minimapEl.value || minimapInstance.value) return

  const config = TILE_LAYERS[tileStyle.value]
  minimapInstance.value = L.map(minimapEl.value, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
    center: [56.0, -96.0],
    zoom: 1,
    minZoom: 1,
    maxZoom: 4,
  })

  L.tileLayer(config.url, {
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(minimapInstance.value as L.Map)

  // Add viewport rectangle
  const rect = L.rectangle(
    [
      [40, -140],
      [70, -50],
    ],
    {
      color: '#18b8a6',
      weight: 2,
      fill: true,
      fillColor: '#18b8a6',
      fillOpacity: 0.25,
      interactive: false,
    },
  )
  rect.addTo(minimapInstance.value as L.Map)
  minimapRect.value = rect

  // Initial update after a small delay to ensure main map is ready
  setTimeout(() => updateMinimapRect(), 200)
}

const updateMinimapRect = () => {
  const activeMap = map.value
  if (!activeMap || !minimapRect.value || !minimapInstance.value) return

  try {
    const bounds = (activeMap as L.Map).getBounds()
    if (bounds.isValid()) {
      minimapRect.value.setBounds(bounds)
      // Keep minimap centered on the viewport
      minimapInstance.value.setView(bounds.getCenter(), minimapInstance.value.getZoom(), {
        animate: false,
      })
    }
  } catch {
    // Bounds not ready yet, ignore
  }
}

const updateMinimapTiles = (style: TileStyle) => {
  if (!minimapInstance.value) return

  // Remove all tile layers safely
  minimapInstance.value.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) {
      try {
        layer.remove()
      } catch {
        // Ignore
      }
    }
  })

  const config = TILE_LAYERS[style]
  L.tileLayer(config.url, {
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(minimapInstance.value as L.Map)
}

// ─────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────
const zoomIn = () => map.value?.zoomIn()
const zoomOut = () => map.value?.zoomOut()

const resetView = () => {
  map.value?.setView([56.0, -96.0], 4)
}

const locateMe = () => {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      map.value?.setView([pos.coords.latitude, pos.coords.longitude], 10)
    },
    () => {
      // Silently fail
    },
  )
}

const toggleFullscreen = async () => {
  if (!wrapperEl.value) return
  if (!document.fullscreenElement) {
    await wrapperEl.value.requestFullscreen()
    isFullscreen.value = true
  } else {
    await document.exitFullscreen()
    isFullscreen.value = false
  }
  setTimeout(() => map.value?.invalidateSize(), 100)
}

const toggleLayerControls = () => {
  showLayerControls.value = !showLayerControls.value
}

const zoomToBounds = (bounds: BoundsLiteral) => {
  map.value?.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
}

const focusMap = (bounds: BoundsLiteral) => {
  if (!bounds) return
  if (!map.value) {
    pendingFocusBounds.value = bounds
    return
  }
  zoomToBounds(bounds)
}

// ─────────────────────────────────────────────────────────────
// Marker Icons
// ─────────────────────────────────────────────────────────────
const createMarkerIcon = (): L.DivIcon => {
  return L.divIcon({
    html: `
      <div class="marker-pulse"></div>
      <div class="marker-dot"></div>
    `,
    className: 'map-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  })
}

const createClusterIcon = (count: number): L.DivIcon => {
  const size = count >= 100 ? 52 : count >= 20 ? 44 : count >= 5 ? 36 : 28
  const sizeClass = count >= 100 ? 'xl' : count >= 20 ? 'lg' : count >= 5 ? 'md' : 'sm'

  return L.divIcon({
    html: `
      <div class="cluster-ring"></div>
      <div class="cluster-core">
        <span class="cluster-count">${count}</span>
      </div>
    `,
    className: `map-cluster map-cluster--${sizeClass}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

const createSearchIcon = (): L.DivIcon => {
  return L.divIcon({
    html: `
      <div class="search-marker-ring"></div>
      <div class="search-marker-dot"></div>
    `,
    className: 'map-search-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// ─────────────────────────────────────────────────────────────
// Popup Builder
// ─────────────────────────────────────────────────────────────
const buildTooltipContent = (data: MarkerData): string => {
  if (!data.popupData) return 'Outage'

  const { title, timeLabel } = data.popupData
  return `
    <div class="map-tooltip">
      <strong>${title}</strong>
      <span>${timeLabel}</span>
    </div>
  `
}

const buildPopupContent = (data: MarkerData): string => {
  if (!data.popupData) {
    return `<div class="map-popup"><p class="map-popup__empty">No details available</p></div>`
  }

  const { title, timeLabel, items, extraCount } = data.popupData
  const itemsHtml = items
    .map(
      (item) => `
      <div class="map-popup__item">
        <span class="map-popup__provider">${item.provider}</span>
        ${item.sizeLabel ? `<span class="map-popup__size">${item.sizeLabel}</span>` : ''}
      </div>
    `,
    )
    .join('')

  const extraHtml = extraCount > 0 ? `<p class="map-popup__extra">+${extraCount} more</p>` : ''

  return `
    <div class="map-popup">
      <h3 class="map-popup__title">${title}</h3>
      <time class="map-popup__time">${timeLabel}</time>
      <div class="map-popup__items">${itemsHtml}</div>
      ${extraHtml}
    </div>
  `
}

// ─────────────────────────────────────────────────────────────
// Render Markers
// ─────────────────────────────────────────────────────────────
const queueMarkerRender = () => {
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  debounceTimer.value = window.setTimeout(() => {
    debounceTimer.value = null
    renderMarkers()
  }, 80)
}

const renderMarkers = () => {
  const activeMap = map.value
  if (!activeMap || !activeMap.getContainer()) return

  if (isZooming.value) {
    renderPending.value = true
    return
  }

  // Initialize marker layer
  if (!markerLayer.value) {
    const layer = L.layerGroup()
    layer.addTo(activeMap as L.Map)
    markerLayer.value = layer
  }
  markerLayer.value.clearLayers()

  // Skip if markers are hidden
  if (!showMarkers.value) return

  // Add markers with tooltips
  for (const marker of props.markers) {
    const count = marker.count ?? 1
    const icon = count > 1 ? createClusterIcon(count) : createMarkerIcon()

    const m = L.marker([marker.lat, marker.lng], { icon })
      .bindTooltip(buildTooltipContent(marker), {
        className: 'map-tooltip-container',
        direction: 'top',
        offset: [0, -10],
        opacity: 1,
      })
      .bindPopup(buildPopupContent(marker), {
        className: 'map-popup-container',
        maxWidth: 280,
        minWidth: 200,
      })
    markerLayer.value!.addLayer(m)
  }
}

// ─────────────────────────────────────────────────────────────
// Render Polygons
// ─────────────────────────────────────────────────────────────
const renderPolygons = () => {
  const activeMap = map.value
  if (!activeMap) return

  // Remove existing layer
  if (geoJsonLayer.value) {
    ;(activeMap as L.Map).removeLayer(geoJsonLayer.value as unknown as L.Layer)
    geoJsonLayer.value = null
  }

  const currentZoom = (activeMap as L.Map).getZoom()
  polygonsVisible.value = currentZoom >= POLYGON_VISIBLE_ZOOM

  // Skip if polygons are hidden or zoom level is too low
  if (!showPolygons.value || !polygonsVisible.value || !props.polygons.length) return

  const features: Feature[] = props.polygons.map((p) => ({
    type: 'Feature',
    geometry: p.geometry,
    properties: { isCluster: p.isCluster },
  }))

  const featureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features,
  }

  const layer = L.geoJSON(featureCollection, {
    style: (feature) => {
      const isCluster = feature?.properties?.isCluster
      return {
        color: isCluster ? BRAND_CLUSTER_COLOR : BRAND_OUTAGE_COLOR,
        fillColor: isCluster ? BRAND_CLUSTER_FILL : BRAND_OUTAGE_FILL,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.4,
      }
    },
  })
  layer.addTo(activeMap as L.Map)
  geoJsonLayer.value = layer
}

// ─────────────────────────────────────────────────────────────
// Render Heatmap
// ─────────────────────────────────────────────────────────────
const renderHeatmap = () => {
  const activeMap = map.value
  if (!activeMap) return

  // Don't re-render during zoom animations to avoid errors - queue it
  if (isZooming.value) {
    heatmapPending.value = true
    return
  }

  heatmapPending.value = false

  // Remove existing heatmap layer safely
  if (heatmapLayer.value) {
    const layerToRemove = heatmapLayer.value
    heatmapLayer.value = null
    try {
      // Clear all event listeners before removing
      layerToRemove.off()
      layerToRemove.remove()
    } catch {
      // Layer may already be removed, ignore
    }
  }

  // Skip if heatmap is hidden or no markers
  if (!showHeatmap.value || !props.markers.length) return

  // Build heatmap data: [lat, lng, intensity]
  const heatData: Array<[number, number, number]> = props.markers.map((marker) => {
    const intensity = Math.min(1, (marker.count ?? 1) / 10) // Normalize intensity
    return [marker.lat, marker.lng, intensity]
  })

  // Create heatmap with brand colors
  const heat = L.heatLayer(heatData, {
    radius: 25,
    blur: 15,
    maxZoom: 12,
    max: 1.0,
    gradient: {
      0.0: 'rgba(24, 184, 166, 0)',
      0.2: 'rgba(24, 184, 166, 0.3)',
      0.4: 'rgba(110, 233, 215, 0.5)',
      0.6: 'rgba(255, 202, 122, 0.7)',
      0.8: 'rgba(255, 156, 26, 0.85)',
      1.0: 'rgba(219, 123, 13, 1)',
    },
  })
  heat.addTo(activeMap as L.Map)
  heatmapLayer.value = heat
}

// ─────────────────────────────────────────────────────────────
// Search Marker & Polygon
// ─────────────────────────────────────────────────────────────
const renderSearchMarker = () => {
  const activeMap = map.value
  if (!activeMap) return

  // Clear existing
  if (searchMarkerLayer.value) {
    ;(activeMap as L.Map).removeLayer(searchMarkerLayer.value as unknown as L.Layer)
    searchMarkerLayer.value = null
  }

  if (!props.searchMarker) return

  const marker = L.marker([props.searchMarker.lat, props.searchMarker.lng], {
    icon: createSearchIcon(),
    zIndexOffset: 1000,
  })
  marker.addTo(activeMap as L.Map)
  searchMarkerLayer.value = marker
}

const renderSearchPolygon = () => {
  const activeMap = map.value
  if (!activeMap) return

  if (searchPolygonLayer.value) {
    ;(activeMap as L.Map).removeLayer(searchPolygonLayer.value as unknown as L.Layer)
    searchPolygonLayer.value = null
  }

  if (!props.searchPolygon) return

  const feature: Feature<Polygon | MultiPolygon> = {
    type: 'Feature',
    geometry: props.searchPolygon,
    properties: {},
  }

  const layer = L.geoJSON(feature, {
    style: {
      color: SEARCH_COLOR,
      fillColor: SEARCH_FILL,
      weight: 3,
      opacity: 1,
      fillOpacity: 0.25,
      dashArray: '6, 4',
    },
  })
  layer.addTo(activeMap as L.Map)
  searchPolygonLayer.value = layer
}

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
  isZooming.value = false
  updateMinimapRect()

  // Process pending tile style switch after zoom completes
  if (pendingTileStyle.value) {
    const style = pendingTileStyle.value
    pendingTileStyle.value = null
    // Use nextTick to ensure zoom animation is fully done
    nextTick(() => switchTileLayer(style))
  }

  // Process pending heatmap render after zoom completes
  if (heatmapPending.value) {
    nextTick(() => renderHeatmap())
  }

  if (renderPending.value) {
    renderPending.value = false
    renderMarkers()
    renderPolygons()
    return
  }

  const currentZoom = (target as L.Map).getZoom()
  const shouldShowPolygons = currentZoom >= POLYGON_VISIBLE_ZOOM
  if (shouldShowPolygons !== polygonsVisible.value) {
    queueMarkerRender()
    renderPolygons()
  }
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
// This handles cases where tile events don't fire correctly
setTimeout(() => {
  if (isLoading.value) {
    isLoading.value = false
  }
}, 2000)

// ─────────────────────────────────────────────────────────────
// Watchers
// ─────────────────────────────────────────────────────────────
watch(
  () => props.markers,
  () => {
    queueMarkerRender()
    // Queue heatmap render after zoom animations complete
    if (!isZooming.value) {
      renderHeatmap()
    }
  },
  { deep: true },
)

watch(
  () => props.polygons,
  () => renderPolygons(),
  { deep: true },
)

watch(
  () => props.focusBounds,
  (bounds) => {
    if (bounds) focusMap(bounds)
  },
)

watch(
  () => props.searchMarker,
  () => renderSearchMarker(),
)

watch(
  () => props.searchPolygon,
  () => renderSearchPolygon(),
)

// Handle pending focus after map init
watch(map, (mapInstance) => {
  if (mapInstance && pendingFocusBounds.value) {
    zoomToBounds(pendingFocusBounds.value)
    pendingFocusBounds.value = null
  }
})

// Re-render when visibility toggles change
watch(showMarkers, () => renderMarkers())
watch(showPolygons, () => renderPolygons())
watch(showHeatmap, () => renderHeatmap())

// ─────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────
onMounted(() => {
  // Initial render after a tick
  setTimeout(() => {
    // Switch to dark tiles if dark mode is active on mount
    if (globalDarkMode.value) {
      switchTileLayer('dark')
    }

    renderMarkers()
    renderPolygons()
    renderSearchMarker()
    renderSearchPolygon()
    initMinimap()
  }, 100)
})

onBeforeUnmount(() => {
  if (debounceTimer.value) clearTimeout(debounceTimer.value)

  // Clean up heatmap layer to prevent zombie event listeners
  if (heatmapLayer.value) {
    try {
      heatmapLayer.value.remove()
    } catch {
      // Ignore
    }
    heatmapLayer.value = null
  }

  if (minimapInstance.value) {
    minimapInstance.value.remove()
    minimapInstance.value = null
  }
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
    <div class="map-controls">
      <button class="map-control-btn" title="Zoom in" aria-label="Zoom in" @click="zoomIn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button class="map-control-btn" title="Zoom out" aria-label="Zoom out" @click="zoomOut">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14" />
        </svg>
      </button>
      <div class="map-controls__divider"></div>
      <button class="map-control-btn" title="Reset view" aria-label="Reset view" @click="resetView">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
      <button
        class="map-control-btn"
        title="My location"
        aria-label="My location"
        @click="locateMe"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      </button>
      <button
        class="map-control-btn"
        :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        @click="toggleFullscreen"
      >
        <svg
          v-if="!isFullscreen"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"
          />
        </svg>
      </button>
      <div class="map-controls__divider"></div>
      <!-- Dark Mode Toggle -->
      <button
        class="map-control-btn"
        :class="{ 'map-control-btn--active': isDarkMode }"
        :title="isDarkMode ? 'Light mode' : 'Dark mode'"
        :aria-label="isDarkMode ? 'Light mode' : 'Dark mode'"
        @click="toggleDarkMode"
      >
        <svg
          v-if="!isDarkMode"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          />
        </svg>
      </button>
      <!-- Layer Controls Toggle -->
      <button
        class="map-control-btn"
        :class="{ 'map-control-btn--active': showLayerControls }"
        title="Layer controls"
        aria-label="Layer controls"
        @click="toggleLayerControls"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>
    </div>

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
      </div>
    </Transition>

    <!-- Minimap -->
    <div ref="minimapEl" class="map-minimap"></div>

    <!-- Attribution badge -->
    <div class="map-badge">
      <span class="map-badge__dot"></span>
      Live Data
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border-radius: var(--ui-radius, 16px);
  overflow: hidden;
  background: linear-gradient(145deg, #e8eef7 0%, #d8e4f3 100%);
  box-shadow:
    0 4px 24px rgba(5, 15, 29, 0.08),
    0 1px 3px rgba(5, 15, 29, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.map-container {
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Loading State */
.map-loading {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: linear-gradient(145deg, rgba(232, 238, 247, 0.95), rgba(216, 228, 243, 0.95));
  backdrop-filter: blur(8px);
}

.map-loading__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(24, 184, 166, 0.2);
  border-top-color: #18b8a6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.map-loading__text {
  font-size: 13px;
  font-weight: 500;
  color: #4b5567;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Controls */
.map-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  box-shadow:
    0 4px 16px rgba(5, 15, 29, 0.1),
    0 1px 2px rgba(5, 15, 29, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.map-controls__divider {
  height: 1px;
  margin: 4px 6px;
  background: linear-gradient(90deg, transparent, rgba(5, 15, 29, 0.1), transparent);
}

.map-control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #2f3d58;
  cursor: pointer;
  transition: all 0.15s ease;
}

.map-control-btn:hover {
  background: rgba(24, 184, 166, 0.1);
  color: #18b8a6;
}

.map-control-btn:active {
  transform: scale(0.95);
}

.map-control-btn svg {
  width: 18px;
  height: 18px;
}

/* Badge */
.map-badge {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #0d4f4a;
  background: rgba(110, 233, 215, 0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(24, 184, 166, 0.3);
  border-radius: 20px;
}

.map-badge__dot {
  width: 6px;
  height: 6px;
  background: #18b8a6;
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}

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

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* Active control button */
.map-control-btn--active {
  background: rgba(24, 184, 166, 0.15);
  color: #18b8a6;
}

/* Layer Controls Panel */
.map-layer-controls {
  position: absolute;
  top: 16px;
  right: 70px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  box-shadow:
    0 4px 16px rgba(5, 15, 29, 0.1),
    0 1px 2px rgba(5, 15, 29, 0.05);
  min-width: 140px;
}

.map-layer-controls__title {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #4b5567;
}

.map-layer-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.map-layer-toggle__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.map-layer-toggle__slider {
  position: relative;
  width: 36px;
  height: 20px;
  background: #d1d5db;
  border-radius: 10px;
  transition: background 0.2s ease;
}

.map-layer-toggle__slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease;
}

.map-layer-toggle__input:checked + .map-layer-toggle__slider {
  background: #18b8a6;
}

.map-layer-toggle__input:checked + .map-layer-toggle__slider::after {
  transform: translateX(16px);
}

.map-layer-toggle__label {
  font-size: 13px;
  font-weight: 500;
  color: #1e2b44;
}

/* Minimap */
.map-minimap {
  position: absolute;
  bottom: 50px;
  right: 16px;
  z-index: 999;
  width: 150px;
  height: 100px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 2px solid rgba(24, 184, 166, 0.3);
  box-shadow:
    0 4px 12px rgba(5, 15, 29, 0.12),
    0 1px 2px rgba(5, 15, 29, 0.06);
  overflow: hidden;
}

.map-minimap :deep(.leaflet-container) {
  background: transparent;
}

.map-minimap :deep(.leaflet-tile-pane) {
  opacity: 0.7;
}

/* Dark mode styles */
.map-wrapper--dark .map-controls {
  background: rgba(30, 41, 59, 0.92);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.25),
    0 1px 2px rgba(0, 0, 0, 0.1);
}

.map-wrapper--dark .map-control-btn {
  color: #94a3b8;
}

.map-wrapper--dark .map-control-btn:hover {
  background: rgba(24, 184, 166, 0.2);
  color: #6ee9d7;
}

.map-wrapper--dark .map-control-btn--active {
  background: rgba(24, 184, 166, 0.25);
  color: #6ee9d7;
}

.map-wrapper--dark .map-controls__divider {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

.map-wrapper--dark .map-layer-controls {
  background: rgba(30, 41, 59, 0.95);
}

.map-wrapper--dark .map-layer-controls__title {
  color: #94a3b8;
}

.map-wrapper--dark .map-layer-toggle__label {
  color: #e2e8f0;
}

.map-wrapper--dark .map-badge {
  background: rgba(24, 184, 166, 0.2);
  border-color: rgba(24, 184, 166, 0.4);
  color: #6ee9d7;
}

.map-wrapper--dark .map-minimap {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>

<style>
/* Global marker styles (not scoped) */
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

.map-popup-container .leaflet-popup-content {
  margin: 0;
  min-width: 180px;
}

.map-popup-container .leaflet-popup-tip {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 2px 4px rgba(5, 15, 29, 0.1);
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

.map-popup-container .leaflet-popup-close-button:hover {
  color: #ff9c1a;
  background: rgba(255, 156, 26, 0.1);
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

/* Leaflet overrides */
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
</style>
