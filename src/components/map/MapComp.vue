<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L, { type LeafletEvent } from 'leaflet'
import type { GeoJSON as LeafletGeoJSON } from 'leaflet'
import { createApp, ref, watch, onBeforeUnmount } from 'vue'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import {
  useLeafletMap,
  useLeafletTileLayer,
  useLeafletDisplayLayer,
  useLeafletEvent,
} from 'vue-use-leaflet'
import MapPopupComp from './MapPopupComp.vue'
import type { PopupData } from './types'

type MarkerData = {
  lat: number
  lng: number
  popupData?: PopupData
  count?: number
}

const CANADA_BOUNDS: L.LatLngBoundsExpression = [
  [10, -170], // a bit south/west of Canada to give slight padding
  [90, -40], // extends slightly east and to the pole
]

type PolygonData = {
  geometry: Polygon | MultiPolygon
  isCluster: boolean
}

const props = withDefaults(
  defineProps<{
    markers: MarkerData[]
    polygons?: PolygonData[]
    zoomLevel?: number
  }>(),
  {
    zoomLevel: 4,
    polygons: () => [],
  },
)

const emit = defineEmits<{
  (e: 'setZoom', level: number): void
}>()

const POLYGON_VISIBLE_ZOOM = 5

const el = ref<HTMLElement | null>(null)
const isZooming = ref(false)
const renderPending = ref(false)
const map = useLeafletMap(el, {
  preferCanvas: true,
  zoomControl: false,
  zoomAnimation: false,
  markerZoomAnimation: false,
  maxBoundsViscosity: 1.0,
  bounceAtZoomLimits: true,
  inertia: true,
  inertiaDeceleration: 3000,
  minZoom: 4,
  maxZoom: 19,
  maxBounds: CANADA_BOUNDS,
  center: [61.0, -104.0],
  zoom: props.zoomLevel,
})

const tileLayer = useLeafletTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  maxZoom: 19, // OpenStreetMap's max zoom level
  tileSize: 256, // Standard tile size for OSM
  zoomOffset: 0,
})

useLeafletDisplayLayer(map, tileLayer)

const markerLayer = ref<L.LayerGroup | null>(null)
const geoJsonLayer = ref<LeafletGeoJSON | null>(null)
const debounceTimer = ref<number | null>(null)
const polygonsVisible = ref(false)

const queueMarkerRender = () => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  debounceTimer.value = window.setTimeout(() => {
    debounceTimer.value = null
    setMarkers()
  }, 200)
}

useLeafletEvent(map, 'zoomstart', () => {
  isZooming.value = true
})

useLeafletEvent(map, 'zoomend', (event: LeafletEvent) => {
  const target = event.target
  if (target instanceof L.Map) {
    emit('setZoom', target.getZoom())
  }
  isZooming.value = false
  if (renderPending.value) {
    renderPending.value = false
    setMarkers()
    return
  }

  if (target instanceof L.Map) {
    const shouldRenderPolygons = target.getZoom() >= POLYGON_VISIBLE_ZOOM
    if (shouldRenderPolygons !== polygonsVisible.value) {
      queueMarkerRender()
    }
  }
})

useLeafletEvent(map, 'unload', () => {
  // Ensure we don't try to render against a torn-down map
  renderPending.value = false
  isZooming.value = false
})

const createIcon = () => {
  return L.divIcon({
    html: `<div class="custom-marker-icon"></div>`,
    className: 'custom-marker',
    iconSize: [24, 24],
  })
}

const createClusterIcon = (count: number): L.DivIcon => {
  const sizeClass =
    count >= 100 ? 'cluster-large' : count >= 10 ? 'cluster-medium' : 'cluster-small'
  const size = sizeClass === 'cluster-large' ? 48 : sizeClass === 'cluster-medium' ? 40 : 32

  return L.divIcon({
    html: `<div class="cluster-count">${count}</div>`,
    className: `cluster-marker ${sizeClass}`,
    iconSize: [size, size],
  })
}

async function setMarkers() {
  const activeMap = map.value
  if (!activeMap) return

  if (isZooming.value || (activeMap as unknown as { _animatingZoom?: boolean })._animatingZoom) {
    renderPending.value = true
    return
  }

  if (!markerLayer.value) {
    markerLayer.value = L.layerGroup().addTo(activeMap)
  }

  markerLayer.value.clearLayers()
  if (!geoJsonLayer.value) {
    geoJsonLayer.value = L.geoJSON([], {
      style: (feature) => {
        const isClusterPoly = Boolean(feature?.properties?.isCluster)
        return polygonStyle(isClusterPoly)
      },
      interactive: false,
    }) as LeafletGeoJSON
    geoJsonLayer.value.addTo(activeMap)
  }
  geoJsonLayer.value.clearLayers()

  // Add new markers from props
  props.markers.forEach((markerData) => {
    const count = markerData.count ?? 1
    const isCluster = count > 1
    const marker = isCluster
      ? L.marker([markerData.lat, markerData.lng], { icon: createClusterIcon(count) })
      : L.marker([markerData.lat, markerData.lng], { icon: createIcon() })
    if (markerData.popupData) {
      attachPopupComponent(marker, markerData.popupData)
    }
    markerLayer.value!.addLayer(marker)
  })

  const currentZoom = activeMap.getZoom()
  if (currentZoom >= POLYGON_VISIBLE_ZOOM) {
    polygonsVisible.value = true
    props.polygons?.forEach((polygonData) => {
      const { geometry, isCluster } = polygonData
      if (!geometry) return
      const feature: Feature = {
        type: 'Feature',
        properties: { isCluster },
        geometry,
      }
      geoJsonLayer.value!.addData(feature)
    })
  } else {
    polygonsVisible.value = false
  }
}

const polygonStyle = (isCluster: boolean): L.PathOptions => ({
  color: isCluster ? '#2563eb' : '#ea580c',
  weight: 2,
  opacity: 0.9,
  fillColor: isCluster ? '#60a5fa' : '#fb923c',
  fillOpacity: 0.12,
})

const attachPopupComponent = (marker: L.Marker, data: PopupData) => {
  const container = document.createElement('div')
  const app = createApp(MapPopupComp, { data })
  app.mount(container)
  marker.bindPopup(container, {
    className: 'outage-popup',
  })
  const teardown = () => {
    app.unmount()
  }
  marker.on('remove', teardown)
}

watch(
  [() => props.markers, () => props.polygons],
  () => {
    queueMarkerRender()
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  renderPending.value = false
  markerLayer.value?.clearLayers()
  geoJsonLayer.value?.clearLayers()
  markerLayer.value?.remove()
  geoJsonLayer.value?.remove()
  tileLayer.value?.remove?.()
  map.value?.off()
  map.value?.remove()
})
</script>

<template>
  <div ref="el" class="map-shell"></div>
</template>

<style scoped>
.map-shell {
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
}

:global(.leaflet-container) {
  width: 100%;
  height: 100%;
}

:global(.cluster-marker) {
  display: grid;
  place-items: center;
  border-radius: 9999px;
  font-weight: 700;
  color: #0f172a;
  background: radial-gradient(circle at 30% 30%, #a2d2ff, #3b82f6);
  border: 2px solid #e2e8f0;
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.18),
    0 0 0 2px rgba(255, 255, 255, 0.6) inset;
  cursor: pointer;
}

:global(.cluster-marker .cluster-count) {
  font-size: 0.85rem;
  line-height: 1;
}

:global(.cluster-marker.cluster-small) {
  width: 32px;
  height: 32px;
}

:global(.cluster-marker.cluster-medium) {
  width: 40px;
  height: 40px;
}

:global(.cluster-marker.cluster-large) {
  width: 48px;
  height: 48px;
}

:global(.custom-marker) {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  background: radial-gradient(circle at 30% 30%, #ffb347, #ff7e5f);
  border: 2px solid #ffffff;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.15),
    0 0 0 2px rgba(255, 255, 255, 0.6) inset;
  cursor: pointer;
}
</style>
