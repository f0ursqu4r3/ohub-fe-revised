<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L, { type LeafletEvent } from 'leaflet'
import type { GeoJSON as LeafletGeoJSON } from 'leaflet'
import { createVNode, getCurrentInstance, onBeforeUnmount, ref, render, watch } from 'vue'
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
const BRAND_CLUSTER_COLOR = '#18b8a6'
const BRAND_CLUSTER_FILL = '#6ee9d7'
const BRAND_OUTAGE_COLOR = '#ff9c1a'
const BRAND_OUTAGE_FILL = '#ffd48a'

const el = ref<HTMLElement | null>(null)
const isZooming = ref(false)
const renderPending = ref(false)
const hostInstance = getCurrentInstance()
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

const zoomToBounds = (bounds: [[number, number], [number, number]]) => {
  const activeMap = map.value
  if (!activeMap) return
  activeMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 })
}

const queueMarkerRender = () => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  debounceTimer.value = window.setTimeout(() => {
    debounceTimer.value = null
    setMarkers()
  }, 100)
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
  color: isCluster ? BRAND_CLUSTER_COLOR : BRAND_OUTAGE_COLOR,
  weight: 2,
  opacity: 0.9,
  fillColor: isCluster ? BRAND_CLUSTER_FILL : BRAND_OUTAGE_FILL,
  fillOpacity: 0.14,
})

const attachPopupComponent = (marker: L.Marker, data: PopupData) => {
  const container = document.createElement('div')
  const vnode = createVNode(MapPopupComp, { data, onZoomTo: zoomToBounds })
  if (hostInstance) {
    vnode.appContext = hostInstance.appContext
  }
  render(vnode, container)
  marker.bindPopup(container, {
    className: 'outage-popup',
  })
  const teardown = () => {
    render(null, container)
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
  color: #041017;
  background: radial-gradient(circle at 30% 30%, #e8fffb, #18b8a6);
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow:
    0 8px 16px rgba(5, 15, 29, 0.22),
    0 0 0 2px rgba(24, 184, 166, 0.35) inset;
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
  background: radial-gradient(circle at 30% 30%, #ffdfad, #ff9c1a);
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 6px 12px rgba(5, 15, 29, 0.2),
    0 0 0 2px rgba(255, 255, 255, 0.65) inset;
  cursor: pointer;
}

:global(.outage-popup) {
  margin: 0;
}

:global(.outage-popup .leaflet-popup-content-wrapper) {
  padding: 0;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(228, 239, 255, 0.98));
  border: 1px solid rgba(24, 184, 166, 0.28);
  box-shadow:
    0 16px 30px rgba(5, 15, 29, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.6) inset;
}

:global(.outage-popup .leaflet-popup-content) {
  margin: 0;
  padding: 0;
}

:global(.outage-popup .leaflet-popup-tip) {
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(24, 184, 166, 0.28);
}
</style>
