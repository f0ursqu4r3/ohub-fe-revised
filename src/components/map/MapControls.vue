<script setup lang="ts">
import {
  Layers,
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Sun,
} from 'lucide-vue-next'

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
      <Plus />
    </button>
    <button class="map-control-btn" title="Zoom out" aria-label="Zoom out" @click="emit('zoomOut')">
      <Minus />
    </button>
    <div class="map-controls__divider"></div>
    <button
      class="map-control-btn"
      title="Reset view"
      aria-label="Reset view"
      @click="emit('resetView')"
    >
      <RotateCcw />
    </button>
    <button
      class="map-control-btn"
      title="My location"
      aria-label="My location"
      @click="emit('locateMe')"
    >
      <LocateFixed />
    </button>
    <button
      class="map-control-btn"
      :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="emit('toggleFullscreen')"
    >
      <Maximize2 v-if="!isFullscreen" />
      <Minimize2 v-else />
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
      <Moon v-if="!isDarkMode" />
      <Sun v-else />
    </button>
    <!-- Layer Controls Toggle -->
    <button
      class="map-control-btn"
      :class="{ 'map-control-btn--active': showLayerControls }"
      title="Layer controls"
      aria-label="Layer controls"
      @click="emit('toggleLayerControls')"
    >
      <Layers />
    </button>
  </div>
</template>
