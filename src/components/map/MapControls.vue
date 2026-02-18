<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isDarkMode: boolean
  isFullscreen: boolean
  showMarkers: boolean
  showPolygons: boolean
  showReportMarkers: boolean
  showMinimap: boolean
  showWeather: boolean
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
  toggleReportMarkers: []
  toggleMinimap: []
  toggleWeather: []
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
    label: 'Weather Radar',
    icon: 'i-heroicons-cloud',
    onClick: () => emit('toggleWeather'),
    active: props.showWeather,
  },
  {
    label: 'Minimap',
    icon: 'i-heroicons-map',
    onClick: () => emit('toggleMinimap'),
    active: props.showMinimap,
  },
])
</script>

<template>
  <div
    class="map-control-panel absolute top-20 right-2 z-1000 flex flex-row gap-0.5 p-1 rounded-full bg-white/92 dark:bg-slate-800/92 backdrop-blur-xl sm:top-1/2 sm:-translate-y-1/2 sm:right-4 sm:flex-col sm:gap-1 sm:p-1.5 sm:rounded-[14px]"
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
    <USeparator class="hidden sm:block" />
    <UButton
      icon="i-heroicons-arrow-path"
      size="sm"
      color="neutral"
      variant="ghost"
      square
      class="hidden sm:inline-flex"
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
      class="hidden sm:inline-flex"
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="() => emit('toggleFullscreen')"
    />
    <USeparator class="hidden sm:block" />
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
            class="w-full min-w-52 flex items-center justify-between gap-4 px-3 py-2 rounded-md hover:bg-accented transition-colors text-left"
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

<style scoped>
/* Short viewport (landscape mobile): tighter position below shorter top bar */
@media (max-height: 500px) {
  .map-control-panel {
    top: 3rem;
  }
}
</style>
