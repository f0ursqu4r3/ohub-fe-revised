<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOutageStore } from '@/stores/outages'
import { storeToRefs } from 'pinia'
import { clusterOutages, type GroupedOutage } from '@/lib/utils'
import type { Outage } from '@/types/outage'
import MapComp from '@/components/map/MapComp.vue'
import VerticalTimeScrubber from '@/components/VerticalTimeScrubber.vue'

type MapMarker = {
  lat: number
  lng: number
  popupText?: string
}

const outageStore = useOutageStore()
const { selectedBlockOutages } = storeToRefs(outageStore)

const zoomLevel = ref(4)
const mapMarkers = computed<MapMarker[]>(() =>
  eventsAtZoomLevel.value.map((group) => ({
    lat: group.center[0],
    lng: group.center[1],
    popupText:
      group.outages.length === 1
        ? (group.providers[0] ?? 'Outage')
        : `${group.outages.length} events · ${group.providers.slice(0, 3).join(', ')}`,
  })),
)

const singletonGroup = (outage: Outage): GroupedOutage => ({
  outages: [outage],
  center: [outage.latitude, outage.longitude],
  radius: 0,
  providers: [outage.provider],
  polygon: outage.polygon,
  ts: outage.ts,
})

const zoomThresholdForKm = (zoom: number): number | null => {
  // Leaflet zoom 4 is country; ~18 is street level.
  if (zoom >= 19) return null
  const kmRange: [number, number] = [200, 0.01]
  const zoomRange: [number, number] = [4, 18]
  const factor = (zoom - zoomRange[0]) / (zoomRange[1] - zoomRange[0])
  const km = kmRange[0] + factor * (kmRange[1] - kmRange[0])
  return km
}

const eventsAtZoomLevel = computed<GroupedOutage[]>(() => {
  const zoom = zoomLevel.value
  const outages = selectedBlockOutages.value
  if (!outages.length) return []

  const thresholdKm = zoomThresholdForKm(zoom)
  if (thresholdKm === null) {
    return outages.map(singletonGroup)
  }

  return clusterOutages(outages, thresholdKm)
})
</script>

<template>
  <div class="flex relative w-full h-full">
    <MapComp
      v-bind="{ markers: mapMarkers, zoomLevel }"
      class="z-0"
      @setZoom="
        (level) => {
          zoomLevel = level
        }
      "
    />
    <VerticalTimeScrubber class="fixed left-0 h-full z-10" />
  </div>
</template>
