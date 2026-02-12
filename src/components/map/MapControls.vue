<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isDarkMode: boolean
  isFullscreen: boolean
  showMarkers: boolean
  showPolygons: boolean
  showHeatmap: boolean
  showReportMarkers: boolean
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  resetView: []
  locateMe: []
  toggleFullscreen: []
  toggleDarkMode: []
  toggleMarkers: []
  togglePolygons: []
  toggleHeatmap: []
  toggleReportMarkers: []
}>()

const layerItems = computed(() => [
  {
    label: 'Markers',
    icon: 'i-heroicons-map-pin',
    onClick: () => emit('toggleMarkers'),
    active: props.showMarkers,
  },
  {
    label: 'Boundaries',
    icon: 'i-heroicons-squares-2x2',
    onClick: () => emit('togglePolygons'),
    active: props.showPolygons,
  },
  {
    label: 'User Reports',
    icon: 'i-heroicons-user-group',
    onClick: () => emit('toggleReportMarkers'),
    active: props.showReportMarkers,
  },
  {
    label: 'Heatmap',
    icon: 'i-heroicons-fire',
    onClick: () => emit('toggleHeatmap'),
    active: props.showHeatmap,
  },
])
</script>

<template>
  <div
    class="map-control-panel absolute top-1/2 -translate-y-1/2 right-4 z-1000 flex flex-col gap-1 p-1.5 rounded-[14px] bg-white/92 dark:bg-slate-800/92 backdrop-blur-xl"
  >
    <UButton
      icon="i-heroicons-plus"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      aria-label="Zoom in"
      @click="() => emit('zoomIn')"
    />
    <UButton
      icon="i-heroicons-minus"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      aria-label="Zoom out"
      @click="() => emit('zoomOut')"
    />
    <USeparator />
    <UButton
      icon="i-heroicons-arrow-path"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      aria-label="Reset view"
      @click="() => emit('resetView')"
    />
    <UButton
      icon="i-heroicons-map-pin"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      aria-label="My location"
      @click="() => emit('locateMe')"
    />
    <UButton
      :icon="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="() => emit('toggleFullscreen')"
    />
    <USeparator />
    <UButton
      :icon="isDarkMode ? 'i-heroicons-sun' : 'i-heroicons-moon'"
      size="sm"
      :color="isDarkMode ? 'primary' : 'neutral'"
      :variant="isDarkMode ? 'soft' : 'ghost'"
      square
      :aria-label="isDarkMode ? 'Light mode' : 'Dark mode'"
      @click="() => emit('toggleDarkMode')"
    />
    <UPopover :content="{ side: 'left', align: 'center' }" arrow>
      <UButton
        icon="i-heroicons-square-3-stack-3d"
        size="sm"
        color="neutral"
        variant="ghost"
        square
        aria-label="Layer controls"
      />
      <template #content>
        <div class="p-2 space-y-1 min-w-[180px]">
          <button
            v-for="item in layerItems"
            :key="item.label"
            @click="item.onClick"
            class="w-full flex items-center justify-between gap-4 px-3 py-2 rounded-md hover:bg-accented transition-colors text-left"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="item.icon" class="w-4 h-4" />
              <span class="text-sm">{{ item.label }}</span>
            </div>
            <UIcon v-if="item.active" name="i-heroicons-check" class="w-4 h-4 text-primary-500" />
          </button>
        </div>
      </template>
    </UPopover>
  </div>
</template>
