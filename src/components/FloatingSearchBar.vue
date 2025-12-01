<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { BoundsLiteral } from './map/types'

type GeocodeResult = {
  id: string
  label: string
  description: string
  fullAddress: string
  lat: number
  lon: number
  bounds: BoundsLiteral
}

const emit = defineEmits<{
  (e: 'locationSelected', result: GeocodeResult): void
}>()

const query = ref('')
const results = ref<GeocodeResult[]>([])
const isFocused = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeIndex = ref(-1)
const controller = ref<AbortController | null>(null)
const listRef = ref<HTMLUListElement | null>(null)
let debounceId: number | null = null

const hasQuery = computed(() => query.value.trim().length >= 3)
const showDropdown = computed(
  () =>
    isFocused.value &&
    hasQuery.value &&
    (isLoading.value || error.value !== null || results.value.length > 0),
)

const resetDropdown = () => {
  results.value = []
  activeIndex.value = -1
}

const boundsFromBox = (
  boundingBox: string[] | number[],
  lat: number,
  lon: number,
): BoundsLiteral => {
  if (boundingBox.length === 4) {
    const [southRaw, northRaw, westRaw, eastRaw] = boundingBox as [
      string | number,
      string | number,
      string | number,
      string | number,
    ]
    const south = Number(southRaw)
    const north = Number(northRaw)
    const west = Number(westRaw)
    const east = Number(eastRaw)
    if ([south, north, west, east].every((v) => Number.isFinite(v))) {
      return [
        [south, west],
        [north, east],
      ]
    }
  }
  const delta = 0.01
  return [
    [lat - delta, lon - delta],
    [lat + delta, lon + delta],
  ]
}

const parseResult = (item: unknown): GeocodeResult | null => {
  const source = item as Record<string, unknown>
  const lat = Number((source as any)?.lat)
  const lon = Number((source as any)?.lon)
  const displayName = (source as any)?.display_name
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !displayName) return null

  const fullAddress = String(displayName)
  const title = fullAddress.split(',')[0]?.trim() || fullAddress
  const address = (source as any)?.address ?? {}
  const city = address.city || address.town || address.village || address.hamlet || ''
  const province = address.state || address.region || address.province || ''
  const postal = address.postcode ? address.postcode.toUpperCase() : ''
  const parts = [city, province, postal].filter(Boolean)
  const description = parts.join(' • ') || 'Canada'
  const bounds = boundsFromBox((source as any)?.boundingbox ?? [], lat, lon)

  return {
    id: String((source as any)?.place_id ?? `${lat}-${lon}`),
    label: title,
    description,
    fullAddress,
    lat,
    lon,
    bounds,
  }
}

const fetchResults = async (term: string) => {
  controller.value?.abort()
  controller.value = new AbortController()
  error.value = null
  isLoading.value = true

  try {
    const params = new URLSearchParams({
      q: term,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'ca',
    })
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en-CA',
      },
      signal: controller.value.signal,
    })
    if (!response.ok) {
      throw new Error(`Search failed with ${response.status}`)
    }
    const data = await response.json()
    const parsed = Array.isArray(data)
      ? data.map((item) => parseResult(item)).filter((item): item is GeocodeResult => Boolean(item))
      : []
    results.value = parsed
    activeIndex.value = parsed.length ? 0 : -1
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    if (typeof err === 'object' && err && (err as { name?: string }).name === 'AbortError') return
    error.value = 'Unable to search right now.'
    resetDropdown()
  } finally {
    isLoading.value = false
  }
}

const scheduleSearch = (term: string) => {
  if (debounceId) {
    clearTimeout(debounceId)
  }

  if (!hasQuery.value) {
    resetDropdown()
    error.value = null
    isLoading.value = false
    return
  }

  debounceId = window.setTimeout(() => fetchResults(term), 250)
}

const selectResult = (result: GeocodeResult) => {
  emit('locationSelected', result)
  query.value = result.fullAddress
  resetDropdown()
  isFocused.value = false
}

const blurTimeoutId = ref<number | null>(null)
const closeDropdownSoon = () => {
  if (blurTimeoutId.value) {
    window.clearTimeout(blurTimeoutId.value)
  }
  blurTimeoutId.value = window.setTimeout(() => {
    isFocused.value = false
  }, 120)
}

const onKeydown = (event: KeyboardEvent) => {
  if (!results.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % results.value.length
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value =
      activeIndex.value <= 0
        ? results.value.length - 1
        : (activeIndex.value - 1) % results.value.length
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const choice = results.value[activeIndex.value] ?? results.value[0]
    if (choice) {
      selectResult(choice)
    }
  }
}

watch(
  () => query.value.trim(),
  (term) => {
    if (term.length < 3) {
      resetDropdown()
      error.value = null
      return
    }
    scheduleSearch(term)
  },
)

onBeforeUnmount(() => {
  if (debounceId) {
    clearTimeout(debounceId)
  }
  if (blurTimeoutId.value) {
    window.clearTimeout(blurTimeoutId.value)
  }
  controller.value?.abort()
})

const scrollActiveIntoView = () => {
  const list = listRef.value
  if (!list || activeIndex.value < 0) return
  const activeItem = list.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
  activeItem?.scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <div class="pointer-events-none w-full max-w-xl" v-bind="$attrs">
    <div
      class="pointer-events-auto relative rounded-2xl border border-black/10 bg-white/90 shadow-[0_16px_35px_rgba(5,15,29,0.32)] backdrop-blur-md"
    >
      <div class="flex items-center gap-3 px-4 py-3">
        <svg class="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 5.5 5.5a7.5 7.5 0 0 0 11.15 11.15Z"
          />
        </svg>
        <input
          v-model="query"
          type="search"
          placeholder="Find a Canadian address"
          class="h-10 w-full rounded-xl border border-transparent bg-white/60 px-3 text-sm font-medium text-slate-900 outline-none ring-2 ring-transparent transition focus:border-emerald-400 focus:ring-emerald-100"
          @focus="isFocused = true"
          @blur="closeDropdownSoon"
          @keydown="onKeydown"
        />
        <div
          class="w-12 text-right text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600"
        >
          CA
        </div>
      </div>

      <transition name="fade">
        <div
          v-if="showDropdown"
          class="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_24px_rgba(5,15,29,0.28)]"
        >
          <div v-if="isLoading" class="px-4 py-3 text-sm text-slate-600">Searching…</div>
          <div v-else-if="error" class="px-4 py-3 text-sm font-medium text-amber-700">
            {{ error }}
          </div>
          <div v-else-if="!results.length" class="px-4 py-3 text-sm text-slate-600">
            No matches yet — keep typing.
          </div>
          <ul v-else ref="listRef" class="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            <li
              v-for="(item, index) in results"
              :key="item.id"
              class="cursor-pointer bg-white px-4 py-3 transition hover:bg-emerald-50"
              :class="{ 'bg-emerald-50': index === activeIndex }"
              :data-index="index"
              @mousedown.prevent="selectResult(item)"
            >
              <p class="text-sm font-semibold text-slate-900">{{ item.label }}</p>
              <p class="text-xs text-slate-600">{{ item.description }}</p>
            </li>
          </ul>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
