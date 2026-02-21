<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useOutageStore } from '@/stores/outages'
import {
  wktToGeoJSON,
  slugToProvider,
  type GeoPolygon,
  type GroupedOutage,
} from '@/lib/utils'
import { useClusterBuckets } from '@/composables/map/useClusterBuckets'
import MapComp from '@/components/map/MapComp.vue'

type MapMarker = {
  lat: number
  lng: number
  outageGroup?: GroupedOutage
  blockTs?: number | null
  count: number
}

type MapPolygon = {
  geometry: GeoPolygon
  isCluster: boolean
}

const route = useRoute()
const outageStore = useOutageStore()
const { selectedBlockOutages, selectedOutageTs, blocks, loading, providers } =
  storeToRefs(outageStore)

const zoomLevel = ref(4)

onMounted(async () => {
  await outageStore.loadProviders()
  const slug = route.params.slug as string
  const match = slugToProvider(slug, providers.value)
  outageStore.selectedProvider = match
})

// Auto-select latest block
watch(
  blocks,
  (b) => {
    const last = b[b.length - 1]
    if (last) outageStore.selectedOutageTs = last.ts
  },
  { immediate: true },
)

// Pre-computed cluster buckets for all zoom levels
const { currentGroups } = useClusterBuckets({
  outages: selectedBlockOutages,
  zoomLevel,
})

const mapMarkers = computed<MapMarker[]>(() =>
  currentGroups.value.map((group) => ({
    lat: group.center[0],
    lng: group.center[1],
    count: group.outages.length,
    outageGroup: group,
    blockTs: selectedOutageTs.value,
  })),
)

const mapPolygons = computed<MapPolygon[]>(() =>
  currentGroups.value.flatMap((group) => {
    if (!group.polygon) return []
    const geometry = wktToGeoJSON(group.polygon)
    if (!geometry) return []
    return [{ geometry, isCluster: group.outages.length > 1 }]
  }),
)

const setZoomLevel = (level: number) => {
  zoomLevel.value = level
}

</script>

<template>
  <div class="relative w-full h-full">
    <MapComp
      :markers="mapMarkers"
      :polygons="mapPolygons"
      :zoom-level="zoomLevel"
      class="z-0"
      @setZoom="setZoomLevel"
    />

    <div
      v-if="loading"
      class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-primary-200/50 bg-(--ui-bg-elevated)/95 px-4 py-2.5 text-sm font-medium text-default shadow-lg shadow-primary-900/10 backdrop-blur-sm"
    >
      <span class="relative flex h-2.5 w-2.5">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
        ></span>
        <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500"></span>
      </span>
      Loading outages…
    </div>
  </div>
</template>
