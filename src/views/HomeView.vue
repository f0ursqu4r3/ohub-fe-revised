<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOutageStore } from '@/stores/outages'
import { storeToRefs } from 'pinia'
import { clusterOutages, type GroupedOutage } from '@/lib/utils'
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

const eventsAtZoomLevel = computed<GroupedOutage[]>(() => {
  const zoom = zoomLevel.value
  const outages = selectedBlockOutages.value
  if (!outages.length) return []
  return clusterOutages(outages, zoom)
})

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

const setZoomLevel = (level: number) => {
  zoomLevel.value = level
}
</script>

<template>
  <div class="flex relative w-full h-full">
    <MapComp
      :markers="mapMarkers"
      :zoom-level="zoomLevel"
      class="z-0"
      @setZoom="(level) => setZoomLevel(level)"
    />
    <VerticalTimeScrubber class="fixed left-0 h-full z-10" />
  </div>
</template>
