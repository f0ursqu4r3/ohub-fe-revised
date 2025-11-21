<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { ref, watchEffect } from 'vue'
import {
  useLeafletMap,
  useLeafletTileLayer,
  useLeafletDisplayLayer,
  useLeafletEvent,
} from 'vue-use-leaflet'

const props = withDefaults(
  defineProps<{
    markers: Array<{ lat: number; lng: number; popupText?: string }>
    zoomLevel?: number
  }>(),
  {
    zoomLevel: 4,
  },
)

const el = ref<HTMLElement | null>(null)
const map = useLeafletMap(el, {
  zoomControl: false,
  maxBoundsViscosity: 1.0,
  bounceAtZoomLimits: true,
  inertia: true,
  inertiaDeceleration: 3000,
  minZoom: 4,
  maxZoom: 19,
})
const tileLayer = useLeafletTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  maxZoom: 19, // OpenStreetMap's max zoom level
  tileSize: 256, // Standard tile size for OSM
  zoomOffset: 0,
})

useLeafletDisplayLayer(map, tileLayer)

useLeafletEvent(map, 'zoom', (event) => {
  // You can handle zoom events here if needed
  console.log('Zoom event:', event)
})

async function setMarkers() {
  if (!map.value) return

  // Clear existing markers
  map.value.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.value?.removeLayer(layer)
    }
  })

  // Add new markers from props
  props.markers.forEach((markerData) => {
    const marker = L.marker([markerData.lat, markerData.lng])
    if (markerData.popupText) {
      marker.bindPopup(markerData.popupText)
    }
    marker.addTo(map.value!)
  })
}

watchEffect(() => {
  if (!map.value) return
  // Set initial view to Canada (approximate center)
  map.value.setView([61.0, -104.0], props.zoomLevel)
})

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
</style>
