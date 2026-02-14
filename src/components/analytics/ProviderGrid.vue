<script setup lang="ts">
import { ref, computed, provide, onBeforeUnmount, watch } from 'vue'
import {
  granularityOptions,
  getCompletionOpacity,
  complianceFields,
  fieldPct,
} from '@/composables/useAnalyticsData'
import type { ProviderTile as ProviderTileType, DayCell } from '@/composables/useAnalyticsData'
import ProviderTile from './ProviderTile.vue'

export type CellTooltipApi = {
  show: (cell: DayCell, label: string, granularity: string, el: HTMLElement) => void
  hide: () => void
}

const props = defineProps<{
  tiles: ProviderTileType[]
  granularity: string
  isLoading: boolean
  isLoadingSeries: boolean
  loadingProgress: { done: number; total: number }
  providerCount: number
}>()

const emit = defineEmits<{
  'update:granularity': [value: string]
}>()

// --- Single shared tooltip ---
const tooltip = ref<{
  cell: DayCell
  label: string
  granularity: string
  rect: DOMRect
} | null>(null)

let showTimeout: number | null = null

function showCellTooltip(cell: DayCell, label: string, granularity: string, el: HTMLElement) {
  if (showTimeout) clearTimeout(showTimeout)
  showTimeout = window.setTimeout(() => {
    showTimeout = null
    tooltip.value = { cell, label, granularity, rect: el.getBoundingClientRect() }
  }, 150)
}

function hideCellTooltip() {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }
  tooltip.value = null
}

onBeforeUnmount(() => {
  if (showTimeout) clearTimeout(showTimeout)
})

provide<CellTooltipApi>('cellTooltip', { show: showCellTooltip, hide: hideCellTooltip })

const tooltipStyle = computed(() => {
  if (!tooltip.value) return {}
  const r = tooltip.value.rect
  return {
    position: 'fixed' as const,
    left: `${r.left + r.width / 2}px`,
    top: `${r.top - 8}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: 9999,
  }
})

// Fade-in the grid when sort completes (loading → done)
const sortAnimating = ref(false)
let sortTimer: number | null = null

watch(
  () => props.isLoadingSeries,
  (loading, wasLoading) => {
    if (wasLoading && !loading) {
      sortAnimating.value = true
      sortTimer = window.setTimeout(() => {
        sortAnimating.value = false
        sortTimer = null
      }, 400)
    }
  },
)

onBeforeUnmount(() => {
  if (sortTimer) clearTimeout(sortTimer)
})

function formatCellDate(cell: DayCell, granularity: string): string {
  if (granularity === 'day') {
    return cell.date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (granularity === 'week') {
    return `Week of ${cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return cell.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
</script>

<template>
  <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div class="text-center mb-8">
      <h2 class="text-3xl font-bold text-default mb-2">
        Coverage across {{ providerCount }} Canadian utilities
      </h2>
      <p class="text-muted">
        Each tile shows one provider's data completeness over time. Hover any cell for a detailed
        breakdown.
      </p>
    </div>

    <!-- Controls row -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">View:</span>
          <select
            :value="granularity"
            class="rounded-lg border border-default bg-elevated px-3 py-1.5 text-sm font-medium text-default shadow-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
            @change="emit('update:granularity', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="g in granularityOptions" :key="g.value" :value="g.value">
              {{ g.label }}
            </option>
          </select>
        </div>

        <!-- Loading progress -->
        <div v-if="isLoadingSeries" class="flex items-center gap-2">
          <span class="relative flex h-2.5 w-2.5">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500"></span>
          </span>
          <span class="text-xs text-muted tabular-nums">
            {{ loadingProgress.done }}/{{ loadingProgress.total }} providers
          </span>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-2 text-xs text-muted">
        <span class="font-medium">Less</span>
        <div
          v-for="val in [0, 25, 50, 75, 100]"
          :key="val"
          class="w-[11px] h-[11px] rounded-[2px] bg-muted relative overflow-hidden"
        >
          <div
            class="absolute inset-0 rounded-[2px]"
            :style="{
              backgroundColor: 'var(--color-primary-500)',
              opacity: getCompletionOpacity(val, val > 0),
            }"
          />
        </div>
        <span class="font-medium">More</span>
      </div>
    </div>

    <!-- Initial loading state -->
    <div v-if="isLoading && !tiles.length" class="flex items-center justify-center py-20">
      <span class="relative flex h-3 w-3 mr-3">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
        ></span>
        <span class="relative inline-flex h-3 w-3 rounded-full bg-primary-500"></span>
      </span>
      <span class="text-sm text-muted">Loading providers...</span>
    </div>

    <!-- Provider tile grid — cells are keyed by index so the grid never reflows;
         only the tile content inside each cell cross-fades on re-sort -->
    <div
      v-else
      class="grid gap-4"
      :class="{ 'sort-fade-in': sortAnimating }"
      style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
    >
      <ProviderTile
        v-for="(tile, index) in tiles"
        :key="index"
        :tile="tile"
        :granularity="granularity"
      />
    </div>

    <!-- Single shared tooltip (replaces per-cell UPopover instances) -->
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="tooltip"
          :style="tooltipStyle"
          class="pointer-events-none rounded-lg border border-accented bg-(--ui-bg-elevated)/95 backdrop-blur-xl shadow-lg p-3 min-w-[180px] text-xs text-default"
        >
          <div class="font-semibold mb-1">{{ tooltip.label }}</div>
          <div class="text-muted mb-1">{{ formatCellDate(tooltip.cell, tooltip.granularity) }}</div>
          <template v-if="tooltip.cell.total > 0">
            <div class="font-medium mb-2">Composite: {{ tooltip.cell.value }}%</div>
            <div class="space-y-1">
              <div
                v-for="field in complianceFields"
                :key="field.value"
                class="flex items-center justify-between gap-4"
              >
                <span class="text-muted">{{ field.label }}</span>
                <span
                  class="font-medium tabular-nums"
                  :class="
                    tooltip.cell.bucket && fieldPct(tooltip.cell.bucket, field.value) >= 80
                      ? 'text-primary-500'
                      : ''
                  "
                >
                  {{
                    tooltip.cell.bucket
                      ? `${tooltip.cell.bucket[field.value as keyof typeof tooltip.cell.bucket] as number}/${tooltip.cell.bucket.total}`
                      : '&ndash;'
                  }}
                </span>
              </div>
            </div>
            <div class="mt-2 pt-2 border-t border-default text-muted">
              Total outages: {{ tooltip.cell.total }}
            </div>
          </template>
          <div v-else class="text-muted">No outages reported</div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
@keyframes sort-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sort-fade-in {
  animation: sort-fade 0.4s ease;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.1s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
