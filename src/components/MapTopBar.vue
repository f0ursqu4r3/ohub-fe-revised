<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useLocationSearch, type GeocodeResult } from '@/composables/useLocationSearch'
import type { MultiPolygon, Polygon } from 'geojson'
import type { BoundsLiteral } from '@/components/map/types'

const emit = defineEmits<{
  (
    e: 'locationSelected',
    result: {
      label: string
      bounds: BoundsLiteral
      lat: number
      lon: number
      geometry: Polygon | MultiPolygon | null
    },
  ): void
  (e: 'clearSearch'): void
  (e: 'reportOutage'): void
}>()

const {
  query,
  results,
  isLoading,
  error,
  activeIndex,
  hasQuery,
  scheduleSearch,
  clearSearch: clearSearchState,
  moveActiveIndex,
} = useLocationSearch()

const isFocused = ref(false)
const listRef = ref<HTMLUListElement | null>(null)
const blurTimeoutId = ref<number | null>(null)

const showDropdown = computed(
  () =>
    isFocused.value &&
    hasQuery.value &&
    (isLoading.value || error.value !== null || results.value.length > 0),
)

const selectResult = (result: GeocodeResult) => {
  emit('locationSelected', result)
  query.value = result.fullAddress
  isFocused.value = false
}

const closeDropdownSoon = () => {
  if (blurTimeoutId.value) window.clearTimeout(blurTimeoutId.value)
  blurTimeoutId.value = window.setTimeout(() => {
    isFocused.value = false
  }, 120)
}

const clearSearch = () => {
  clearSearchState()
  isFocused.value = true
  emit('clearSearch')
}

const onKeydown = (event: KeyboardEvent) => {
  if (!results.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveIndex('down')
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveIndex('up')
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const choice = results.value[activeIndex.value] ?? results.value[0]
    if (choice) selectResult(choice)
  }
}

const scrollActiveIntoView = () => {
  const list = listRef.value
  if (!list || activeIndex.value < 0) return
  const activeItem = list.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
  activeItem?.scrollIntoView({ block: 'nearest' })
}

watch(
  () => query.value.trim(),
  (term) => {
    if (term.length < 3) return
    scheduleSearch(term)
  },
)

defineProps<{
  loading?: boolean
  loadError?: boolean
  noOutages?: boolean
}>()
</script>

<template>
  <div class="fixed top-0 inset-x-0 z-40 pointer-events-none">
    <div
      class="topbar pointer-events-auto flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3 bg-(--ui-bg-elevated)/85 backdrop-blur-lg border-b border-accented/50 shadow-sm h-14 sm:h-16"
    >
      <!-- Left: Logo / brand -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="flex items-center gap-1.5 text-sm font-bold tracking-tight text-default">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-primary-500"></span>
          </span>
          OHub
        </div>
      </div>

      <!-- Center: Search -->
      <div class="relative flex-1 max-w-xl mx-auto">
        <UInput
          v-model="query"
          type="search"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search addresses..."
          size="sm"
          class="w-full transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary-300/50 rounded-full"
          :loading="isLoading"
          :ui="{ trailing: 'pe-1', base: 'rounded-full' }"
          @focus="isFocused = true"
          @blur="closeDropdownSoon"
          @keydown="onKeydown"
        >
          <template v-if="query.length" #trailing>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="soft"
              size="xs"
              square
              aria-label="Clear search"
              class="cursor-pointer"
              @click="clearSearch"
            />
          </template>
        </UInput>

        <!-- Search dropdown -->
        <Transition name="fade">
          <div
            v-if="showDropdown"
            class="absolute left-0 right-0 top-[calc(100%+4px)] overflow-hidden rounded-xl border border-accented bg-(--ui-bg-elevated)/95 backdrop-blur-xl shadow-lg z-50"
          >
            <div v-if="isLoading" class="px-4 py-3 text-sm text-muted">Searching...</div>
            <div
              v-else-if="error"
              class="px-4 py-3 text-sm font-medium text-amber-600 dark:text-amber-400"
            >
              {{ error }}
            </div>
            <div v-else-if="!results.length" class="px-4 py-3 text-sm text-muted">
              No matches yet — keep typing.
            </div>
            <ul v-else ref="listRef" class="max-h-64 divide-y divide-muted/30 overflow-y-auto">
              <li
                v-for="(item, index) in results"
                :key="item.id"
                class="cursor-pointer px-4 py-2.5 transition hover:bg-accented"
                :class="{ 'bg-accented': index === activeIndex }"
                :data-index="index"
                @mousedown.prevent="selectResult(item)"
              >
                <p class="text-sm font-semibold text-default">{{ item.label }}</p>
                <p class="text-xs text-muted">{{ item.description }}</p>
              </li>
            </ul>
          </div>
        </Transition>
      </div>

      <!-- Right: Status badges + actions -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Inline status badges -->
        <div
          v-if="loading"
          class="hidden sm:flex items-center gap-1.5 rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500"></span>
          </span>
          Loading...
        </div>
        <div
          v-else-if="loadError"
          class="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="h-3 w-3" />
          Error
        </div>
        <div
          v-else-if="noOutages"
          class="hidden sm:flex items-center gap-1.5 rounded-full bg-muted/10 px-2.5 py-1 text-xs font-medium text-muted"
        >
          <UIcon name="i-heroicons-map" class="h-3 w-3" />
          No outages
        </div>

        <!-- Report: icon-only on mobile, with label on desktop -->
        <UButton
          icon="i-heroicons-exclamation-triangle"
          color="primary"
          variant="soft"
          size="xs"
          square
          class="sm:hidden"
          aria-label="Report outage"
          @click="emit('reportOutage')"
        />
        <UButton
          icon="i-heroicons-exclamation-triangle"
          color="primary"
          variant="soft"
          label="Report"
          size="xs"
          class="hidden sm:inline-flex"
          @click="emit('reportOutage')"
        />

        <UPopover :content="{ side: 'bottom', align: 'end' }">
          <UButton
            icon="i-heroicons-bars-3"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            aria-label="Menu"
          />
          <template #content>
            <div class="p-1 min-w-[140px]">
              <UButton
                to="/analytics"
                icon="i-heroicons-chart-bar"
                color="neutral"
                variant="ghost"
                label="Analytics"
                size="sm"
                block
                class="justify-start"
              />
              <UButton
                to="/developers"
                icon="i-heroicons-code-bracket"
                color="neutral"
                variant="ghost"
                label="API Docs"
                size="sm"
                block
                class="justify-start"
              />
            </div>
          </template>
        </UPopover>
      </div>
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

/* Short viewport (landscape mobile) */
@media (max-height: 500px) {
  .topbar {
    height: 2.75rem; /* 44px */
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }
}
</style>
