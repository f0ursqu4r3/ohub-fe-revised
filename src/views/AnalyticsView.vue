<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '@/stores/analytics'
import type { ComplianceBucket } from '@/types/analytics'

const analyticsStore = useAnalyticsStore()
const { series, providers, workerRun, isLoading, selectedProvider, selectedGranularity } =
  storeToRefs(analyticsStore)

// Compliance field keys for the metric selector
const complianceFields = [
  { value: 'customer_count_present', label: 'Customer count' },
  { value: 'cause_present', label: 'Cause' },
  { value: 'outage_type_present', label: 'Outage type' },
  { value: 'is_planned_present', label: 'Is planned' },
  { value: 'outage_start_present', label: 'Outage start' },
  { value: 'etr_present', label: 'ETR' },
  { value: 'polygon_present', label: 'Polygon' },
] as const

type ComplianceFieldKey = (typeof complianceFields)[number]['value']

const selectedMetric = ref<ComplianceFieldKey>('polygon_present')

const providerOptions = computed(() => [
  { value: '__all__', label: 'All Providers' },
  ...providers.value.map((p) => ({ value: p.provider, label: p.provider })),
])

const granularityOptions = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
] as const

// Heatmap types
type DayCell = {
  date: Date
  value: number
  total: number
  present: number
  empty?: boolean
}

type HeatmapRow = {
  label: string
  days: DayCell[]
  numWeeks: number
}

const CELL_SIZE = 13
const CELL_GAP = 3
const WEEK_PX = CELL_SIZE + CELL_GAP

// Convert series buckets to heatmap data, grouped by provider
const heatmapData = computed<HeatmapRow[]>(() => {
  if (!series.value.length) return []

  const metric = selectedMetric.value

  // Group buckets by provider
  const byProvider = new Map<string, ComplianceBucket[]>()
  for (const bucket of series.value) {
    const key = bucket.provider
    if (!byProvider.has(key)) byProvider.set(key, [])
    byProvider.get(key)!.push(bucket)
  }

  const rows: HeatmapRow[] = []
  for (const [provider, buckets] of byProvider) {
    const sorted = buckets.sort((a, b) => a.bucket_start_ts - b.bucket_start_ts)
    const rawDays: DayCell[] = sorted.map((b) => {
      const pct = b.total > 0 ? Math.round((b[metric] / b.total) * 100) : 0
      return {
        date: new Date(b.bucket_start_ts * 1000),
        value: pct,
        total: b.total,
        present: b[metric],
      }
    })

    const { grid, numWeeks } = buildGridDays(rawDays)
    rows.push({ label: provider === '__all__' ? 'All Providers' : provider, days: grid, numWeeks })
  }

  return rows
})

function buildGridDays(rawDays: DayCell[]): { grid: DayCell[]; numWeeks: number } {
  if (!rawDays.length) return { grid: [], numWeeks: 0 }
  const firstDay = rawDays[0]!
  const startDow = firstDay.date.getDay()
  const padded: DayCell[] = Array.from({ length: startDow }, () => ({
    date: new Date(0),
    value: 0,
    total: 0,
    present: 0,
    empty: true,
  }))
  padded.push(...rawDays)
  const numWeeks = Math.ceil(padded.length / 7)
  while (padded.length < numWeeks * 7) {
    padded.push({ date: new Date(0), value: 0, total: 0, present: 0, empty: true })
  }
  return { grid: padded, numWeeks }
}

const monthLabels = computed(() => {
  if (!heatmapData.value.length || !heatmapData.value[0]) return []
  const row = heatmapData.value[0]
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1

  for (let w = 0; w < row.numWeeks; w++) {
    const cell = row.days[w * 7]
    if (!cell || cell.empty) continue
    const month = cell.date.getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      const monthName = cell.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      labels.push({ label: monthName, col: w })
    }
  }
  return labels
})

const getCompletionColor = (value: number): string => {
  if (value >= 80) return 'var(--color-primary-800)'
  if (value >= 60) return 'var(--color-primary-600)'
  if (value >= 40) return 'var(--color-primary-400)'
  if (value >= 20) return 'var(--color-primary-200)'
  return 'var(--ui-bg-muted)'
}

// Worker status helpers
const workerStatusLabel = computed(() => {
  if (!workerRun.value) return 'unknown'
  if (workerRun.value.errors > 0) return 'error'
  return 'running'
})

const workerStatusColor = computed(() => {
  switch (workerStatusLabel.value) {
    case 'running':
      return 'text-primary-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-neutral-400'
  }
})

const lastRunLabel = computed(() => {
  if (!workerRun.value) return 'Never'
  const finishedMs = new Date(workerRun.value.finished_at).getTime()
  const diff = Date.now() - finishedMs
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
})

// Tooltip
const hoveredCell = ref<{
  row: number
  col: number
  date: Date
  value: number
  total: number
  present: number
} | null>(null)
const tooltipStyle = ref({ top: '0px', left: '0px' })

function onCellHover(event: MouseEvent, rowIdx: number, colIdx: number, cell: DayCell) {
  hoveredCell.value = {
    row: rowIdx,
    col: colIdx,
    date: cell.date,
    value: cell.value,
    total: cell.total,
    present: cell.present,
  }
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  tooltipStyle.value = {
    top: `${rect.top - 55}px`,
    left: `${rect.left + rect.width / 2}px`,
  }
}

function onCellLeave() {
  hoveredCell.value = null
}

// Fetch series when provider or granularity changes
async function loadSeries() {
  const provider = selectedProvider.value || '__all__'
  await analyticsStore.fetchSeries({
    provider,
    granularity: selectedGranularity.value,
  })
}

const initialized = ref(false)

watch([selectedProvider, selectedGranularity], () => {
  if (initialized.value) {
    loadSeries()
  }
})

onMounted(async () => {
  await Promise.all([analyticsStore.fetchProviders(), analyticsStore.fetchWorkerHealth()])
  if (!selectedProvider.value) {
    selectedProvider.value = '__all__'
  }
  await loadSeries()
  initialized.value = true
})
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 class="text-2xl font-semibold tracking-tight">Data completeness</h1>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Provider:</span>
            <select
              :value="selectedProvider || '__all__'"
              class="rounded-lg border border-default bg-elevated px-3 py-1.5 text-sm font-medium text-default shadow-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
              @change="selectedProvider = ($event.target as HTMLSelectElement).value"
            >
              <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Metric:</span>
            <select
              :value="selectedMetric"
              class="rounded-lg border border-default bg-elevated px-3 py-1.5 text-sm font-medium text-default shadow-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
              @change="
                selectedMetric = ($event.target as HTMLSelectElement).value as ComplianceFieldKey
              "
            >
              <option v-for="m in complianceFields" :key="m.value" :value="m.value">
                {{ m.label }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Granularity:</span>
            <select
              :value="selectedGranularity"
              class="rounded-lg border border-default bg-elevated px-3 py-1.5 text-sm font-medium text-default shadow-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
              @change="
                selectedGranularity = ($event.target as HTMLSelectElement).value as
                  | 'day'
                  | 'week'
                  | 'month'
              "
            >
              <option v-for="g in granularityOptions" :key="g.value" :value="g.value">
                {{ g.label }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Heatmap area -->
        <div class="flex-1 min-w-0">
          <div class="rounded-xl border border-default bg-elevated p-6 shadow-sm">
            <!-- Loading state -->
            <div v-if="isLoading" class="flex items-center justify-center py-20">
              <span class="relative flex h-3 w-3 mr-3">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
                ></span>
                <span class="relative inline-flex h-3 w-3 rounded-full bg-primary-500"></span>
              </span>
              <span class="text-sm text-muted">Loading analytics data...</span>
            </div>

            <!-- Empty state -->
            <div
              v-else-if="!heatmapData.length"
              class="flex flex-col items-center justify-center py-20 text-muted"
            >
              <UIcon name="i-heroicons-chart-bar" class="w-10 h-10 mb-3 opacity-40" />
              <span class="text-sm">No compliance data available for this selection.</span>
            </div>

            <!-- Heatmap grid -->
            <div v-else class="overflow-x-auto">
              <!-- Month labels -->
              <div
                class="relative h-5 mb-1"
                :style="{ width: `${(heatmapData[0]?.numWeeks ?? 0) * WEEK_PX}px` }"
              >
                <span
                  v-for="ml in monthLabels"
                  :key="ml.label"
                  class="absolute text-xs font-medium text-muted"
                  :style="{ left: `${ml.col * WEEK_PX}px` }"
                >
                  {{ ml.label }}
                </span>
              </div>

              <!-- Rows -->
              <div class="space-y-5">
                <div v-for="(row, rowIdx) in heatmapData" :key="row.label">
                  <div class="text-xs font-medium text-muted mb-1.5">{{ row.label }}</div>
                  <div
                    class="grid gap-[3px]"
                    :style="{
                      gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                      gridAutoFlow: 'column',
                      gridAutoColumns: `${CELL_SIZE}px`,
                      width: `${row.numWeeks * WEEK_PX}px`,
                    }"
                  >
                    <div
                      v-for="(cell, colIdx) in row.days"
                      :key="colIdx"
                      class="rounded-[3px] transition-all duration-150"
                      :class="
                        cell.empty
                          ? 'invisible'
                          : 'cursor-pointer hover:ring-2 hover:ring-primary-400/50 hover:scale-125'
                      "
                      :style="{
                        backgroundColor: cell.empty
                          ? 'transparent'
                          : getCompletionColor(cell.value),
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                      }"
                      @mouseenter="!cell.empty && onCellHover($event, rowIdx, colIdx, cell)"
                      @mouseleave="onCellLeave"
                    />
                  </div>
                </div>
              </div>

              <!-- Legend -->
              <div class="mt-6 pt-4 border-t border-default">
                <div class="flex items-center gap-4">
                  <span class="text-xs font-medium text-muted">Completeness</span>
                  <div class="flex items-center gap-3">
                    <div
                      v-for="band in [
                        { label: '0\u201320%', color: getCompletionColor(10) },
                        { label: '20\u201340%', color: getCompletionColor(30) },
                        { label: '40\u201360%', color: getCompletionColor(50) },
                        { label: '60\u201380%', color: getCompletionColor(70) },
                        { label: '80\u2013100%', color: getCompletionColor(90) },
                      ]"
                      :key="band.label"
                      class="flex items-center gap-1.5"
                    >
                      <div class="w-3 h-3 rounded-[3px]" :style="{ backgroundColor: band.color }" />
                      <span class="text-xs text-dimmed">{{ band.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="w-full lg:w-72 space-y-4">
          <!-- Worker status card -->
          <div class="rounded-xl border border-default bg-elevated p-5 shadow-sm">
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <span class="relative flex h-2 w-2">
                  <span
                    v-if="workerStatusLabel === 'running'"
                    class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
                  ></span>
                  <span
                    class="relative inline-flex h-2 w-2 rounded-full"
                    :class="{
                      'bg-primary-500': workerStatusLabel === 'running',
                      'bg-neutral-400': workerStatusLabel === 'unknown',
                      'bg-red-500': workerStatusLabel === 'error',
                    }"
                  ></span>
                </span>
                <span class="text-sm font-semibold" :class="workerStatusColor">
                  Worker: {{ workerStatusLabel }}
                </span>
              </div>

              <template v-if="workerRun">
                <div class="space-y-2 pt-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-muted">Processed</span>
                    <span class="text-sm font-semibold">
                      {{ workerRun.processed_buckets }} buckets
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-muted">Skipped</span>
                    <span class="text-sm font-semibold">
                      {{ workerRun.skipped_buckets }} buckets
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-muted">Avg bucket time</span>
                    <span class="text-sm font-semibold"
                      >{{ Math.round(workerRun.bucket_ms_avg) }} ms</span
                    >
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-muted">Elapsed</span>
                    <span class="text-sm font-semibold"
                      >{{ Math.round(workerRun.elapsed_ms) }} ms</span
                    >
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-muted">Last run</span>
                    <span class="text-sm font-semibold">{{ lastRunLabel }}</span>
                  </div>
                  <div v-if="workerRun.errors > 0" class="flex items-center justify-between">
                    <span class="text-sm text-muted">Errors</span>
                    <span class="text-sm font-semibold text-red-500">{{ workerRun.errors }}</span>
                  </div>
                </div>
              </template>
              <div v-else class="text-sm text-muted pt-1">No worker data available.</div>
            </div>
          </div>

          <!-- Sidebar filters (duplicate for mobile convenience) -->
          <div class="rounded-xl border border-default bg-elevated p-5 shadow-sm space-y-3">
            <div>
              <label class="block text-xs font-medium text-muted mb-1.5">Provider</label>
              <select
                :value="selectedProvider || '__all__'"
                class="w-full rounded-lg border border-default bg-default px-3 py-1.5 text-sm text-default outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
                @change="selectedProvider = ($event.target as HTMLSelectElement).value"
              >
                <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1.5">Metric</label>
              <select
                :value="selectedMetric"
                class="w-full rounded-lg border border-default bg-default px-3 py-1.5 text-sm text-default outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
                @change="
                  selectedMetric = ($event.target as HTMLSelectElement).value as ComplianceFieldKey
                "
              >
                <option v-for="m in complianceFields" :key="m.value" :value="m.value">
                  {{ m.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1.5">Granularity</label>
              <select
                :value="selectedGranularity"
                class="w-full rounded-lg border border-default bg-default px-3 py-1.5 text-sm text-default outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
                @change="
                  selectedGranularity = ($event.target as HTMLSelectElement).value as
                    | 'day'
                    | 'week'
                    | 'month'
                "
              >
                <option v-for="g in granularityOptions" :key="g.value" :value="g.value">
                  {{ g.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="hoveredCell"
          class="fixed z-50 pointer-events-none -translate-x-1/2 rounded-lg border border-default bg-elevated px-3 py-1.5 text-xs shadow-lg"
          :style="tooltipStyle"
        >
          <div class="font-medium">
            {{
              hoveredCell.date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            }}
          </div>
          <div class="text-muted">
            {{ hoveredCell.present }}/{{ hoveredCell.total }} ({{ hoveredCell.value }}%)
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
