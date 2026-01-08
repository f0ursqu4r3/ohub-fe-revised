<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'
import {
  clusterOutages,
  formatDate,
  wktToGeoJSON,
  type GeoPolygon,
  type GroupedOutage,
} from '@/lib/utils'
import FloatingSearchBar from '@/components/FloatingSearchBar.vue'
import VerticalTimeScrubber from '@/components/VerticalTimeScrubber.vue'
import MapComp from '@/components/map/MapComp.vue'
import type { PopupData, BoundsLiteral } from '@/components/map/types'
import type { MultiPolygon, Polygon } from 'geojson'

type MapMarker = {
  lat: number
  lng: number
  popupData?: PopupData
  count: number
}

type MapPolygon = {
  geometry: GeoPolygon
  isCluster: boolean
}

type SearchLocation = {
  label: string
  bounds: BoundsLiteral
  lat: number
  lon: number
  geometry: Polygon | MultiPolygon | null
}

const outageStore = useOutageStore()
const { selectedBlockOutages, selectedOutageTs, loading, error } = storeToRefs(outageStore)

const zoomLevel = ref(4)
const focusBounds = ref<BoundsLiteral | null>(null)
const searchMarker = ref<{ lat: number; lng: number } | null>(null)
const searchPolygon = ref<Polygon | MultiPolygon | null>(null)

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
    popupData: buildPopupData(group, selectedOutageTs.value),
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

const setZoomLevel = (level: number) => {
  zoomLevel.value = level
}
const retryFetch = () => outageStore.refetch()
const onLocationSelected = (location: SearchLocation) => {
  focusBounds.value = [
    [location.bounds[0][0], location.bounds[0][1]],
    [location.bounds[1][0], location.bounds[1][1]],
  ]
  searchMarker.value = { lat: location.lat, lng: location.lon }
  searchPolygon.value = location.geometry
}
const clearSearch = () => {
  focusBounds.value = null
  searchMarker.value = null
  searchPolygon.value = null
}

const buildPopupData = (group: GroupedOutage, blockTs: number | null): PopupData | undefined => {
  const outages = group.outages
  if (!outages.length) return undefined
  const title =
    outages.length === 1 ? (outages[0]?.provider ?? 'Outage') : `${outages.length} events`
  const timeLabel = blockTs !== null ? formatDate(blockTs) : formatDate(group.ts)
  const geometry = group.polygon ? wktToGeoJSON(group.polygon) : null
  const groupAreaInfo = geometry ? computeBoundsAndArea(geometry) : { bounds: null, areaKm2: 0 }
  const groupBounds = groupAreaInfo.bounds
  const MAX_ROWS = 6
  const scoredOutages = outages.map((outage) => {
    const outageGeometry = outage.polygon ? wktToGeoJSON(outage.polygon) : null
    const outageAreaInfo = outageGeometry
      ? computeBoundsAndArea(outageGeometry)
      : { bounds: null, areaKm2: 0 }
    const areaKm2 = outageAreaInfo.areaKm2
    const durationSeconds = Math.max(0, (outage.endTs ?? blockTs ?? outage.ts) - outage.startTs)
    const score = areaKm2 * 2 + durationSeconds // weight area a bit higher than duration
    return {
      outage,
      areaKm2,
      bounds: outageAreaInfo.bounds,
      durationSeconds,
      score,
    }
  })

  const sortedOutages = scoredOutages
    .slice()
    .sort(
      (a, b) =>
        (b.score || 0) - (a.score || 0) || a.outage.provider.localeCompare(b.outage.provider),
    )

  const nicknameForIndex = (idx: number) => {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const letter = alpha[idx % alpha.length]
    const suffix = idx >= alpha.length ? Math.floor(idx / alpha.length) + 1 : ''
    return `Outage ${letter}${suffix}`
  }

  const items = sortedOutages.slice(0, MAX_ROWS).map((entry, idx) => {
    const { outage, areaKm2, durationSeconds } = entry
    const nickname = nicknameForIndex(idx)
    const areaLabel = areaKm2 > 0.1 ? `${Math.round(areaKm2)} km²` : null
    const durationMinutes = Math.round(durationSeconds / 60)
    const durationLabel = durationMinutes > 0 ? `${durationMinutes} min` : null
    const sizeLabel = areaLabel ?? durationLabel ?? undefined
    const bounds =
      entry.bounds ?? groupBounds ?? fallbackPointBounds(outage.latitude, outage.longitude)
    return {
      provider: outage.provider,
      nickname,
      bounds,
      sizeLabel,
    }
  })
  const extraCount = Math.max(0, outages.length - MAX_ROWS)
  return {
    title,
    timeLabel,
    items,
    extraCount,
    geoJsonText: geometry ? JSON.stringify(geometry) : null,
    coordsText: group.polygon ?? null,
  }
}

const computeBoundsAndArea = (
  geometry: GeoPolygon,
): { bounds: BoundsLiteral | null; areaKm2: number } => {
  // Fast approximation using a bounding box and lat-adjusted longitude span.
  const kmPerDegree = 111.32
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.coordinates.flatMap((poly) => poly)

  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLon = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY

  for (const ring of rings) {
    for (const coordinate of ring) {
      const lon = Number(coordinate?.[0])
      const lat = Number(coordinate?.[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLon = Math.min(minLon, lon)
      maxLon = Math.max(maxLon, lon)
    }
  }

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon)
  ) {
    return { bounds: null, areaKm2: 0 }
  }

  const latSpan = Math.max(0, maxLat - minLat)
  const lonSpan = Math.max(0, maxLon - minLon)
  if (latSpan === 0 || lonSpan === 0) {
    return {
      bounds: [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      areaKm2: 0,
    }
  }

  const meanLat = (minLat + maxLat) / 2
  const widthKm = Math.abs(lonSpan * Math.cos((meanLat * Math.PI) / 180) * kmPerDegree)
  const heightKm = Math.abs(latSpan * kmPerDegree)
  const areaKm2 = Math.max(0, widthKm * heightKm)

  return {
    bounds: [
      [minLat, minLon],
      [maxLat, maxLon],
    ],
    areaKm2,
  }
}

const fallbackPointBounds = (lat: number, lon: number): BoundsLiteral => {
  const delta = 0.01
  return [
    [lat - delta, lon - delta],
    [lat + delta, lon + delta],
  ]
}
</script>

<template>
  <div class="flex relative w-full h-full">
    <MapComp
      :markers="mapMarkers"
      :polygons="mapPolygons"
      :zoom-level="zoomLevel"
      :focus-bounds="focusBounds"
      :search-marker="searchMarker"
      :search-polygon="searchPolygon"
      class="z-0"
      @setZoom="setZoomLevel"
    />
    <VerticalTimeScrubber class="fixed inset-x-0 left-0 z-20" />
    <FloatingSearchBar
      class="fixed left-1/2 top-4 z-30 w-full max-w-2xl -translate-x-1/2 px-4"
      @locationSelected="onLocationSelected"
      @clearSearch="clearSearch"
    />

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
      <button
        class="rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
        @click="retryFetch"
      >
        Retry
      </button>
    </div>
    <div
      v-else-if="!selectedBlockOutages.length"
      class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-black/10 bg-white/90 px-4 py-2 text-sm font-medium text-slate-800 shadow-lg shadow-black/20"
    >
      No outages in the selected window.
    </div>
  </div>
</template>
