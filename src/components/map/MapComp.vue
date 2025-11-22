<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L, { type LeafletEvent } from 'leaflet'
import { ref, watchEffect } from 'vue'
import {
  useLeafletMap,
  useLeafletTileLayer,
  useLeafletDisplayLayer,
  useLeafletEvent,
} from 'vue-use-leaflet'

type MarkerData = {
  lat: number
  lng: number
  popupText?: string
  count?: number
}

const props = withDefaults(
  defineProps<{
    markers: MarkerData[]
    zoomLevel?: number
  }>(),
  {
    zoomLevel: 4,
  },
)

const emit = defineEmits<{
  (e: 'setZoom', level: number): void
}>()

const el = ref<HTMLElement | null>(null)
const map = useLeafletMap(el, {
  zoomControl: false,
  maxBoundsViscosity: 1.0,
  bounceAtZoomLimits: true,
  inertia: true,
  inertiaDeceleration: 3000,
  minZoom: 4,
  maxZoom: 19,
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

useLeafletEvent(map, 'zoomend', (event: LeafletEvent) => {
  const target = event.target
  if (target instanceof L.Map) {
    emit('setZoom', target.getZoom())
  }
})

const createClusterIcon = (count: number): L.DivIcon => {
  const sizeClass = count >= 100 ? 'cluster-large' : count >= 10 ? 'cluster-medium' : 'cluster-small'
  const size = sizeClass === 'cluster-large' ? 48 : sizeClass === 'cluster-medium' ? 40 : 32

  return L.divIcon({
    html: `<div class="cluster-count">${count}</div>`,
    className: `cluster-marker ${sizeClass}`,
    iconSize: [size, size],
  })
}

async function setMarkers() {
  if (!map.value) return

  if (!markerLayer.value) {
    markerLayer.value = L.layerGroup().addTo(map.value)
  }

  markerLayer.value.clearLayers()

  // Add new markers from props
  props.markers.forEach((markerData) => {
    const count = markerData.count ?? 1
    const isCluster = count > 1
    const marker = isCluster
      ? L.marker([markerData.lat, markerData.lng], { icon: createClusterIcon(count) })
      : L.marker([markerData.lat, markerData.lng])
    if (markerData.popupText) {
      marker.bindPopup(markerData.popupText)
    }
    marker.addTo(markerLayer.value!)
  })
}

watchEffect(() => {
  setMarkers()
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
</style>
