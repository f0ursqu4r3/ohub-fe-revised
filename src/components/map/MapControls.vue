<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isDarkMode: boolean
  isFullscreen: boolean
  showMarkers: boolean
  showPolygons: boolean
  showHeatmap: boolean
  showPlaybackControls: boolean
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
  togglePlaybackControls: []
}>()

const layerMenuItems = computed(() => [
  [
    {
      label: 'Markers',
      icon: 'i-heroicons-map-pin',
      onSelect: () => emit('toggleMarkers'),
      active: props.showMarkers,
    },
    {
      label: 'Boundaries',
      icon: 'i-heroicons-squares-2x2',
      onSelect: () => emit('togglePolygons'),
      active: props.showPolygons,
    },
    {
      label: 'Heatmap',
      icon: 'i-heroicons-fire',
      onSelect: () => emit('toggleHeatmap'),
      active: props.showHeatmap,
    },
    {
      label: 'Playback',
      icon: 'i-heroicons-play-circle',
      onSelect: () => emit('togglePlaybackControls'),
      active: props.showPlaybackControls,
    },
  ],
])
</script>

<template>
  <div
    class="map-control-panel absolute top-1/2 -translate-y-1/2 right-4 z-1000 flex flex-col gap-1 p-1.5 rounded-[14px] bg-white/92 dark:bg-slate-800/92 backdrop-blur-xl"
  >
    <UButton
      icon="i-heroicons-plus"
      size="sm"
      color="gray"
      variant="ghost"
      square
      aria-label="Zoom in"
      @click="() => emit('zoomIn')"
    />
    <UButton
      icon="i-heroicons-minus"
      size="sm"
      color="gray"
      variant="ghost"
      square
      aria-label="Zoom out"
      @click="() => emit('zoomOut')"
    />
    <USeparator />
    <UButton
      icon="i-heroicons-arrow-path"
      size="sm"
      color="gray"
      variant="ghost"
      square
      aria-label="Reset view"
      @click="() => emit('resetView')"
    />
    <UButton
      icon="i-heroicons-map-pin"
      size="sm"
      color="gray"
      variant="ghost"
      square
      aria-label="My location"
      @click="() => emit('locateMe')"
    />
    <UButton
      :icon="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
      size="sm"
      color="gray"
      variant="ghost"
      square
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="() => emit('toggleFullscreen')"
    />
    <USeparator />
    <UButton
      :icon="isDarkMode ? 'i-heroicons-sun' : 'i-heroicons-moon'"
      size="sm"
      :color="isDarkMode ? 'primary' : 'gray'"
      :variant="isDarkMode ? 'soft' : 'ghost'"
      square
      :aria-label="isDarkMode ? 'Light mode' : 'Dark mode'"
      @click="() => emit('toggleDarkMode')"
    />
    <UDropdownMenu :items="layerMenuItems" :popper="{ placement: 'left' }">
      <UButton
        icon="i-heroicons-square-3-stack-3d"
        size="sm"
        color="gray"
        variant="ghost"
        square
        aria-label="Layer controls"
      />
      <template #item="{ item }">
        <div class="flex items-center justify-between w-full gap-3">
          <div class="flex items-center gap-2">
            <UIcon :name="item.icon" class="w-4 h-4" />
            <span>{{ item.label }}</span>
          </div>
          <UIcon
            v-if="item.active"
            name="i-heroicons-check"
            class="w-4 h-4 text-primary-500"
          />
        </div>
      </template>
    </UDropdownMenu>
  </div>
</template>
