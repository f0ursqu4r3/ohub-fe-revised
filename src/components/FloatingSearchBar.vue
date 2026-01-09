<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { MultiPolygon, Polygon } from 'geojson'
import type { BoundsLiteral } from './map/types'

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  hamlet?: string
  state?: string
  region?: string
  province?: string
  postcode?: string
}

type NominatimResult = {
  place_id?: number | string
  display_name?: string
  lat?: number | string
  lon?: number | string
  boundingbox?: Array<number | string>
  address?: NominatimAddress
  geojson?: Polygon | MultiPolygon | { type?: string }
}

type GeocodeResult = {
  id: string
  label: string
  description: string
  fullAddress: string
  lat: number
  lon: number
  bounds: BoundsLiteral
  geometry: Polygon | MultiPolygon | null
}

const emit = defineEmits<{
  (e: 'locationSelected', result: GeocodeResult): void
  (e: 'clearSearch'): void
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
  boundingBox: Array<string | number>,
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

const parseResult = (item: NominatimResult): GeocodeResult | null => {
  const lat = Number(item.lat)
  const lon = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !item.display_name) return null

  const fullAddress = String(item.display_name)
  const title = fullAddress.split(',')[0]?.trim() || fullAddress
  const address = item.address ?? {}
  const city = address.city || address.town || address.village || address.hamlet || ''
  const province = address.state || address.region || address.province || ''
  const postal = address.postcode ? address.postcode.toUpperCase() : ''
  const parts = [city, province, postal].filter(Boolean)
  const description = parts.join(' • ') || 'Canada'
  const geometry =
    item.geojson && (item.geojson as { type?: string }).type?.includes('Polygon')
      ? (item.geojson as Polygon | MultiPolygon)
      : null
  const bounds = boundsFromBox(item.boundingbox ?? [], lat, lon)

  return {
    id: String(item.place_id ?? `${lat}-${lon}`),
    label: title,
    description,
    fullAddress,
    lat,
    lon,
    bounds,
    geometry,
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
      polygon_geojson: '1',
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
    const data: unknown = await response.json()
    const parsed = Array.isArray(data)
      ? data
          .map((item) => parseResult(item as NominatimResult))
          .filter((item): item is GeocodeResult => Boolean(item))
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

const clearSearch = () => {
  query.value = ''
  resetDropdown()
  error.value = null
  isFocused.value = true
  emit('clearSearch')
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
      class="pointer-events-auto relative rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/90 shadow-[0_16px_35px_rgba(5,15,29,0.32)] backdrop-blur-md transition-colors duration-300"
    >
      <div class="flex items-center gap-3 px-4 py-3">
        <UInput
          v-model="query"
          type="search"
          icon="i-heroicons-magnifying-glass"
          placeholder="Find a Canadian address"
          size="lg"
          class="flex-1 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary-300/50 focus-within:shadow-[0_0_20px_rgba(24,184,166,0.15)] rounded-full"
          :loading="isLoading"
          :ui="{ trailing: 'pe-1', base: 'rounded-full' }"
          @focus="isFocused = true"
          @blur="closeDropdownSoon"
          @keydown="onKeydown"
        >
          <template v-if="query.length" #trailing>
            <UButton
              icon="i-heroicons-x-mark"
              color="gray"
              variant="soft"
              size="sm"
              square
              aria-label="Clear search"
              class="cursor-pointer hover:scale-105 transition-transform"
              @click="clearSearch"
            />
          </template>
        </UInput>
        <div class="text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
          CA
        </div>
      </div>

      <transition name="fade">
        <div
          v-if="showDropdown"
          class="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] shadow-[0_12px_24px_rgba(5,15,29,0.28)] transition-colors duration-300"
        >
          <div v-if="isLoading" class="px-4 py-3 text-sm text-[var(--ui-text-muted)]">
            Searching…
          </div>
          <div
            v-else-if="error"
            class="px-4 py-3 text-sm font-medium text-amber-600 dark:text-amber-400"
          >
            {{ error }}
          </div>
          <div v-else-if="!results.length" class="px-4 py-3 text-sm text-[var(--ui-text-muted)]">
            No matches yet — keep typing.
          </div>
          <ul
            v-else
            ref="listRef"
            class="max-h-64 divide-y divide-[var(--ui-border-muted)] overflow-y-auto"
          >
            <li
              v-for="(item, index) in results"
              :key="item.id"
              class="cursor-pointer bg-[var(--ui-bg-elevated)] px-4 py-3 transition hover:bg-primary-50 dark:hover:bg-primary-950/50"
              :class="{ 'bg-primary-50 dark:bg-primary-950/50': index === activeIndex }"
              :data-index="index"
              @mousedown.prevent="selectResult(item)"
            >
              <p class="text-sm font-semibold text-[var(--ui-text)]">{{ item.label }}</p>
              <p class="text-xs text-[var(--ui-text-muted)]">{{ item.description }}</p>
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
