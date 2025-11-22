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

const props = withDefaults(
  defineProps<{
    markers: Array<{ lat: number; lng: number; popupText?: string }>
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

useLeafletEvent(map, 'zoomend', (event: LeafletEvent) => {
  const target = event.target
  if (target instanceof L.Map) {
    emit('setZoom', target.getZoom())
  }
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
