<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'
import {
  clusterOutages,
  wktToGeoJSON,
  type GeoPolygon,
  type GroupedOutage,
  type BoundsLiteral,
} from '@/lib/utils'
import { usePopupData } from '@/composables/map/usePopupData'
import FloatingSearchBar from '@/components/FloatingSearchBar.vue'
import VerticalTimeScrubber from '@/components/VerticalTimeScrubber.vue'
import MapComp from '@/components/map/MapComp.vue'
import type { PopupData } from '@/components/map/types'
import { PLAYBACK_BASE_INTERVAL_MS } from '@/config/map'
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

const outageStore = useOutageStore()
const { selectedBlockOutages, selectedOutageTs, blocks, loading, error } = storeToRefs(outageStore)

const zoomLevel = ref(4)
const focusBounds = ref<BoundsLiteral | null>(null)
const searchMarker = ref<{ lat: number; lng: number } | null>(null)
const searchPolygon = ref<Polygon | MultiPolygon | null>(null)

// Time playback state
const isPlaying = ref(false)
const playbackSpeed = ref(1) // 1 = normal, 2 = fast, 0.5 = slow
const showPlaybackControls = ref(false)
const playbackIntervalId = ref<number | null>(null)

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
    // Store group for lazy popup computation instead of pre-computing popupData
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

// Time playback functions
const currentBlockIndex = computed(() => {
  if (selectedOutageTs.value === null) return -1
  return blocks.value.findIndex((b) => b.ts === selectedOutageTs.value)
})

const canPlayForward = computed(() => currentBlockIndex.value < blocks.value.length - 1)
const canPlayBackward = computed(() => currentBlockIndex.value > 0)

const stepForward = () => {
  const idx = currentBlockIndex.value
  const nextBlock = blocks.value[idx + 1]
  if (idx < blocks.value.length - 1 && nextBlock) {
    outageStore.selectedOutageTs = nextBlock.ts
  } else {
    stopPlayback()
  }
}

const stepBackward = () => {
  const idx = currentBlockIndex.value
  const prevBlock = blocks.value[idx - 1]
  if (idx > 0 && prevBlock) {
    outageStore.selectedOutageTs = prevBlock.ts
  } else {
    stopPlayback()
  }
}

const startPlayback = (direction: 'forward' | 'backward' = 'forward') => {
  if (playbackIntervalId.value) {
    stopPlayback()
  }

  isPlaying.value = true
  const intervalMs = PLAYBACK_BASE_INTERVAL_MS / playbackSpeed.value

  playbackIntervalId.value = window.setInterval(() => {
    if (direction === 'forward') {
      if (canPlayForward.value) {
        stepForward()
      } else {
        stopPlayback()
      }
    } else {
      if (canPlayBackward.value) {
        stepBackward()
      } else {
        stopPlayback()
      }
    }
  }, intervalMs)
}

const stopPlayback = () => {
  if (playbackIntervalId.value) {
    clearInterval(playbackIntervalId.value)
    playbackIntervalId.value = null
  }
  isPlaying.value = false
}

const togglePlayback = () => {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    startPlayback('forward')
  }
}

const cycleSpeed = () => {
  const speeds = [0.5, 1, 2] as const
  const currentIdx = speeds.indexOf(playbackSpeed.value as 0.5 | 1 | 2)
  playbackSpeed.value = speeds[(currentIdx + 1) % speeds.length] ?? 1

  // Restart playback with new speed if playing
  if (isPlaying.value) {
    startPlayback('forward')
  }
}

onBeforeUnmount(() => {
  stopPlayback()
})

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

const { buildPopupData } = usePopupData()
</script>

<template>
  <div class="flex relative w-full h-full">
    <!-- Developer Portal link in top-left -->
    <div class="fixed top-4 right-4 z-40 flex items-center gap-2">
      <UButton
        to="/analytics"
        icon="i-heroicons-chart-bar"
        color="neutral"
        variant="ghost"
        label="Analytics"
        class="shadow-md"
      />
      <UButton
        to="/developers"
        icon="i-heroicons-code-bracket"
        color="neutral"
        variant="ghost"
        label="API"
        class="shadow-md"
      />
    </div>

    <MapComp
      :markers="mapMarkers"
      :polygons="mapPolygons"
      :zoom-level="zoomLevel"
      :focus-bounds="focusBounds"
      :search-marker="searchMarker"
      :search-polygon="searchPolygon"
      :popup-builder="buildPopupData"
      class="z-0"
      @setZoom="setZoomLevel"
      @update:showPlaybackControls="showPlaybackControls = $event"
    >
      <template #fullscreen-content="{ isFullscreen }">
        <VerticalTimeScrubber v-if="isFullscreen" class="fixed inset-x-0 left-0 z-20" />
      </template>
    </MapComp>

    <VerticalTimeScrubber class="fixed inset-x-0 left-0 z-20" />

    <FloatingSearchBar
      class="fixed left-1/2 top-4 z-30 w-full max-w-2xl -translate-x-1/2 px-4"
      @locationSelected="onLocationSelected"
      @clearSearch="clearSearch"
    />

    <div
      v-if="loading"
      class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-primary-200/50 bg-(--ui-bg-elevated)/95 px-4 py-2.5 text-sm font-medium text-default shadow-lg shadow-primary-900/10 backdrop-blur-sm transition-colors duration-300"
    >
      <span class="relative flex h-2.5 w-2.5">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
        ></span>
        <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500"></span>
      </span>
      Loading outages…
    </div>
    <div
      v-else-if="error"
      class="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400/50 bg-amber-50/95 dark:bg-amber-950/95 px-4 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-200 shadow-lg shadow-amber-500/20 backdrop-blur-sm transition-colors duration-300"
    >
      <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 text-amber-500" />
      <span>Unable to load outages.</span>
      <button
        class="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-600 hover:shadow-md active:scale-95"
        @click="retryFetch"
      >
        Retry
      </button>
    </div>
    <div
      v-else-if="!selectedBlockOutages.length"
      class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full border border-default bg-(--ui-bg-elevated)/95 px-4 py-2.5 text-sm font-medium text-muted shadow-lg shadow-slate-900/10 backdrop-blur-sm transition-colors duration-300"
    >
      <UIcon name="i-heroicons-map" class="h-4 w-4 text-dimmed" />
      No outages in the selected window.
    </div>

    <!-- Time Playback Controls -->
    <Transition name="fade">
      <div
        v-if="showPlaybackControls && blocks.length > 1"
        class="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full border border-accented bg-(--ui-bg-elevated)/95 px-3 py-2 shadow-lg shadow-primary-900/15 backdrop-blur-sm transition-colors duration-300"
      >
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-all hover:bg-primary-500/10 hover:text-primary-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
          :disabled="!canPlayBackward"
          title="Step backward"
          @click="stepBackward"
        >
          <UIcon name="i-heroicons-backward" class="h-4 w-4" />
        </button>

        <button
          class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white shadow-md transition-all hover:bg-primary-600 hover:scale-105 active:scale-95"
          :title="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlayback"
        >
          <UIcon v-if="!isPlaying" name="i-heroicons-play" class="ml-0.5 h-5 w-5" />
          <UIcon v-else name="i-heroicons-pause" class="h-5 w-5" />
        </button>

        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-all hover:bg-primary-500/10 hover:text-primary-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
          :disabled="!canPlayForward"
          title="Step forward"
          @click="stepForward"
        >
          <UIcon name="i-heroicons-forward" class="h-4 w-4" />
        </button>

        <div class="mx-1 h-5 w-px bg-border"></div>

        <button
          class="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted transition-all hover:bg-primary-500/10 hover:text-primary-500"
          title="Change playback speed"
          @click="cycleSpeed"
        >
          <span>{{ playbackSpeed }}x</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
