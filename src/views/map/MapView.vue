<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useOutageStore } from '@/stores/outages'
import { useUserOutageStore } from '@/stores/userOutages'
import {
  clusterOutages,
  clusterUserReports,
  wktToGeoJSON,
  slugToProvider,
  type GeoPolygon,
  type GroupedOutage,
  type BoundsLiteral,
} from '@/lib/utils'
import { usePopupData } from '@/composables/map/usePopupData'
import MapTopBar from '@/components/MapTopBar.vue'
import OutageDetailPanel from '@/components/OutageDetailPanel.vue'
import MapComp from '@/components/map/MapComp.vue'
import ReportOutageModal from '@/components/ReportOutageModal.vue'
import type { PopupData, PopupItem, MarkerData, ReportMarkerData } from '@/components/map/types'
import type { MultiPolygon, Polygon } from 'geojson'

type MapMarker = {
  lat: number
  lng: number
  popupData?: PopupData
  outageGroup?: GroupedOutage
  blockTs?: number | null
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

const route = useRoute()
const outageStore = useOutageStore()
const { selectedBlockOutages, selectedOutageTs, loading, error, providers } =
  storeToRefs(outageStore)
const userOutageStore = useUserOutageStore()
const { reports: userReports } = storeToRefs(userOutageStore)

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
    outageGroup: group,
    blockTs: selectedOutageTs.value,
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

const reportMapMarkers = computed<ReportMarkerData[]>(() => {
  if (!userReports.value.length) return []
  return clusterUserReports(userReports.value, zoomLevel.value).map((group) => ({
    lat: group.center[0],
    lng: group.center[1],
    count: group.reports.length,
    reports: group.reports,
  }))
})

const setZoomLevel = (level: number) => {
  zoomLevel.value = level
}
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

// Provider filtering
const syncProviderFromRoute = () => {
  if (route.name === 'provider-map') {
    const slug = route.params.slug as string
    const match = slugToProvider(slug, providers.value)
    outageStore.selectedProvider = match
  } else if (route.query.provider) {
    outageStore.selectedProvider = route.query.provider as string
  } else {
    outageStore.selectedProvider = null
  }
}

onMounted(async () => {
  await outageStore.loadProviders()
  syncProviderFromRoute()
  userOutageStore.fetchReports()
})

watch(() => route.fullPath, syncProviderFromRoute)

const { buildPopupData } = usePopupData()

// Report outage modal
const reportModalOpen = ref(false)

// Detail panel
const detailPanelData = ref<PopupData | null>(null)

const onMarkerClick = (marker: MarkerData) => {
  if (marker.outageGroup) {
    const data = buildPopupData(marker.outageGroup, marker.blockTs ?? null)
    detailPanelData.value = data ?? null
  } else if (marker.popupData) {
    detailPanelData.value = marker.popupData
  }
}

const onSelectItem = (item: PopupItem) => {
  if (item.bounds) focusBounds.value = item.bounds
  detailPanelData.value = {
    title: item.provider,
    timeLabel: detailPanelData.value?.timeLabel ?? '',
    items: [item],
    extraCount: 0,
  }
}

const closeDetail = () => {
  detailPanelData.value = null
}

// Highlight outage on map when hovering detail panel items
const highlightedOutageId = ref<string | number | null>(null)
</script>

<template>
  <div class="flex relative w-full h-full">
    <!-- Top Bar -->
    <MapTopBar
      :loading="loading"
      :load-error="!!error"
      :no-outages="!loading && !error && !selectedBlockOutages.length"
      @locationSelected="onLocationSelected"
      @clearSearch="clearSearch"
      @reportOutage="reportModalOpen = true"
    />

    <ReportOutageModal v-model:open="reportModalOpen" @submitted="userOutageStore.fetchReports()" />

    <MapComp
      :markers="mapMarkers"
      :polygons="mapPolygons"
      :report-markers="reportMapMarkers"
      :zoom-level="zoomLevel"
      :focus-bounds="focusBounds"
      :search-marker="searchMarker"
      :search-polygon="searchPolygon"
      :popup-builder="buildPopupData"
      :highlighted-outage-id="highlightedOutageId"
      class="z-0"
      @setZoom="setZoomLevel"
      @markerClick="onMarkerClick"
    />

    <!-- Detail Panel -->
    <OutageDetailPanel
      :data="detailPanelData"
      @close="closeDetail"
      @selectItem="onSelectItem"
      @zoomToAll="focusBounds = $event"
      @highlight="highlightedOutageId = $event"
      @unhighlight="highlightedOutageId = null"
    />
  </div>
</template>
