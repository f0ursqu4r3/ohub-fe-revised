<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'
import { clusterOutages, wktToGeoJSON, type GeoPolygon, type GroupedOutage } from '@/lib/utils'
import MapComp from '@/components/map/MapComp.vue'
import VerticalTimeScrubber from '@/components/VerticalTimeScrubber.vue'

type MapMarker = {
  lat: number
  lng: number
  popupText?: string
  count: number
}

type MapPolygon = {
  geometry: GeoPolygon
  isCluster: boolean
}

const outageStore = useOutageStore()
const { selectedBlockOutages, loading, error } = storeToRefs(outageStore)

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
    count: group.outages.length,
    popupText:
      group.outages.length === 1
        ? (group.providers[0] ?? 'Outage')
        : `${group.outages.length} events · ${group.providers.slice(0, 3).join(', ')}`,
  })),
)

const mapPolygons = computed<MapPolygon[]>(() =>
  eventsAtZoomLevel.value.flatMap((group) => {
    if (!group.polygon) return []
    const geometry = wktToGeoJSON(group.polygon)
    if (!geometry) return []
    return [
      {
        geometry,
        isCluster: group.outages.length > 1,
      },
    ]
  }),
)

const setZoomLevel = (level: number) => (zoomLevel.value = level)
const retryFetch = () => outageStore.refetch()
</script>

<template>
  <div class="flex relative w-full h-full">
    <MapComp
      :markers="mapMarkers"
      :polygons="mapPolygons"
      :zoom-level="zoomLevel"
      class="z-0"
      @setZoom="(level) => setZoomLevel(level)"
    />
    <VerticalTimeScrubber class="fixed left-0 h-full z-10" />

    <div
      v-if="loading"
      class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-black/10 bg-white/90 px-4 py-2 text-sm font-medium text-slate-800 shadow-lg shadow-black/20"
    >
      Loading outages…
    </div>
    <div
      v-else-if="error"
      class="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-500/40 bg-amber-50/95 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg shadow-amber-500/30"
    >
      <span>Unable to load outages.</span>
      <UButton size="xs" color="amber" variant="solid" @click="retryFetch">Retry</UButton>
    </div>
    <div
      v-else-if="!selectedBlockOutages.length"
      class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-black/10 bg-white/90 px-4 py-2 text-sm font-medium text-slate-800 shadow-lg shadow-black/20"
    >
      No outages in the selected window.
    </div>
  </div>
</template>
