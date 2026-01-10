<script setup lang="ts">
defineProps<{
  isDarkMode: boolean
  isFullscreen: boolean
  showLayerControls: boolean
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  resetView: []
  locateMe: []
  toggleFullscreen: []
  toggleDarkMode: []
  toggleLayerControls: []
}>()
</script>

<template>
  <div class="map-controls">
    <button class="map-control-btn" title="Zoom in" aria-label="Zoom in" @click="emit('zoomIn')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
    <button class="map-control-btn" title="Zoom out" aria-label="Zoom out" @click="emit('zoomOut')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14" />
      </svg>
    </button>
    <div class="map-controls__divider"></div>
    <button
      class="map-control-btn"
      title="Reset view"
      aria-label="Reset view"
      @click="emit('resetView')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
    <button
      class="map-control-btn"
      title="My location"
      aria-label="My location"
      @click="emit('locateMe')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    </button>
    <button
      class="map-control-btn"
      :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="emit('toggleFullscreen')"
    >
      <svg
        v-if="!isFullscreen"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"
        />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path
          d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"
        />
      </svg>
    </button>
    <div class="map-controls__divider"></div>
    <!-- Dark Mode Toggle -->
    <button
      class="map-control-btn"
      :class="{ 'map-control-btn--active': isDarkMode }"
      :title="isDarkMode ? 'Light mode' : 'Dark mode'"
      :aria-label="isDarkMode ? 'Light mode' : 'Dark mode'"
      @click="emit('toggleDarkMode')"
    >
      <svg
        v-if="!isDarkMode"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <path
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        />
      </svg>
    </button>
    <!-- Layer Controls Toggle -->
    <button
      class="map-control-btn"
      :class="{ 'map-control-btn--active': showLayerControls }"
      title="Layer controls"
      aria-label="Layer controls"
      @click="emit('toggleLayerControls')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </button>
  </div>
</template>
