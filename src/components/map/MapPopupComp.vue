<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { PopupData } from './types'

const props = defineProps<{
  data: PopupData
}>()

const copyFeedback = ref<'geojson' | 'coords' | null>(null)
const copyErrored = ref(false)
const resetTimer = ref<number | null>(null)

const hasGeoJson = computed(() => Boolean(props.data.geoJsonText))
const hasCoords = computed(() => Boolean(props.data.coordsText))
const hasCopyTargets = computed(() => hasGeoJson.value || hasCoords.value)

const resetFeedback = () => {
  copyFeedback.value = null
  copyErrored.value = false
  if (resetTimer.value) {
    window.clearTimeout(resetTimer.value)
    resetTimer.value = null
  }
}

const setResetTimer = () => {
  resetTimer.value = window.setTimeout(() => {
    copyFeedback.value = null
    copyErrored.value = false
    resetTimer.value = null
  }, 1600)
}

const copyToClipboard = async (text: string | null | undefined, kind: 'geojson' | 'coords') => {
  if (!text) return
  resetFeedback()
  try {
    await navigator.clipboard.writeText(text)
    copyFeedback.value = kind
  } catch (error) {
    console.error('Failed to copy polygon', error)
    copyErrored.value = true
  } finally {
    setResetTimer()
  }
}

onBeforeUnmount(() => {
  if (resetTimer.value) {
    window.clearTimeout(resetTimer.value)
  }
})
</script>

<template>
  <div class="min-w-[200px] max-w-[260px] text-slate-900 font-sans">
    <div class="flex items-center justify-between gap-2 font-bold text-sm mb-2">
      <span>{{ data.title }}</span>
      <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">{{ data.timeLabel }}</span>
    </div>
    <ul class="grid gap-1.5">
      <li
        v-for="(item, idx) in data.items"
        :key="`item-${idx}`"
        class="flex items-center justify-between gap-2 text-xs"
      >
        <span class="font-semibold text-slate-800">{{ item.provider }}</span>
      </li>
      <li v-if="data.extraCount > 0" class="text-xs text-slate-600">+{{ data.extraCount }} more…</li>
    </ul>

    <div v-if="hasCopyTargets" class="mt-3 border-t border-slate-200 pt-3">
      <div class="flex flex-wrap gap-2">
        <button
          v-if="hasGeoJson"
          type="button"
          class="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
          @click="copyToClipboard(data.geoJsonText, 'geojson')"
        >
          Copy GeoJSON
        </button>
        <button
          v-if="hasCoords"
          type="button"
          class="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1"
          @click="copyToClipboard(data.coordsText, 'coords')"
        >
          Copy coords
        </button>
      </div>
      <p v-if="copyFeedback && !copyErrored" class="mt-2 text-[11px] font-semibold text-emerald-600">
        {{ copyFeedback === 'geojson' ? 'GeoJSON copied' : 'Coordinates copied' }}
      </p>
      <p v-else-if="copyErrored" class="mt-2 text-[11px] font-semibold text-rose-600">
        Unable to copy. Please try again.
      </p>
    </div>
  </div>
</template>
