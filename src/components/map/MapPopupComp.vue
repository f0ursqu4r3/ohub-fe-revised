<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { PopupData, BoundsLiteral } from './types'
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  data: PopupData
  onZoomTo?: (bounds: BoundsLiteral) => void
}>()

const copyFeedback = ref<'geojson' | 'coords' | null>(null)
const copyErrored = ref(false)
const resetTimer = ref<number | null>(null)

const hasGeoJson = computed(() => Boolean(props.data.geoJsonText))
const hasCoords = computed(() => Boolean(props.data.coordsText))
const hasCopyTargets = computed(() => hasGeoJson.value || hasCoords.value)

const copyMenuItems = computed<DropdownMenuItem[]>(
  () =>
    [
      hasGeoJson.value
        ? {
            label: 'GeoJSON',
            onSelect: () => copyToClipboard(props.data.geoJsonText, 'geojson'),
            class: 'cursor-pointer',
          }
        : null,
      hasCoords.value
        ? {
            label: 'Coordinates',
            onSelect: () => copyToClipboard(props.data.coordsText, 'coords'),
            class: 'cursor-pointer',
          }
        : null,
    ].filter(Boolean) as DropdownMenuItem[],
)

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

const zoomTo = (item: PopupData['items'][number]) => {
  if (!item.bounds || !props.onZoomTo) return
  props.onZoomTo(item.bounds)
}
</script>

<template>
  <div class="min-w-[200px] max-w-[260px] text-slate-900 font-sans p-3">
    <div class="flex items-center justify-between gap-2 font-bold text-sm mb-2">
      <span>{{ data.title }}</span>
      <span class="text-xs font-semibold text-primary-700 whitespace-nowrap">
        {{ data.timeLabel }}
      </span>
    </div>
    <ul class="grid gap-1.5">
      <li
        v-for="(item, idx) in data.items"
        :key="`item-${idx}`"
        class="flex items-center justify-between gap-2 text-xs"
      >
        <button
          type="button"
          class="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 transition hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
          @click="zoomTo(item)"
        >
          <div class="flex flex-col gap-0.5 text-left">
            <span class="font-semibold text-slate-900 group-hover:text-slate-950">
              {{ item.nickname }}
            </span>
            <span class="text-slate-600 group-hover:text-slate-700">{{ item.provider }}</span>
          </div>
          <span
            v-if="item.sizeLabel"
            class="rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 shadow-[0_0_6px_rgba(24,184,166,0.25)]"
          >
            {{ item.sizeLabel }}
          </span>
        </button>
      </li>
      <li v-if="data.extraCount > 0" class="text-xs text-slate-600">
        +{{ data.extraCount }} more…
      </li>
    </ul>

    <div v-if="hasCopyTargets" class="mt-3 border-t border-primary-100 pt-3 flex justify-end">
      <UDropdownMenu arrow :items="copyMenuItems">
        <UButton variant="text" size="sm" icon="i-heroicons-clipboard" class="cursor-pointer">
          <span v-if="copyFeedback && !copyErrored">{{ 'copied!' }}</span>
        </UButton>
      </UDropdownMenu>
    </div>
    <p v-else-if="copyErrored" class="mt-2 text-[11px] font-semibold text-rose-600">
      Unable to copy. Please try again.
    </p>
  </div>
</template>
