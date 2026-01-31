<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import {
  select,
  scaleTime,
  scaleLinear,
  axisLeft,
  axisBottom,
  area,
  line,
  curveMonotoneX,
  timeWeek,
  timeFormat,
  format,
  extent,
  max,
} from 'd3'
import { useAnalyticsStore } from '@/stores/analytics'
import type { ComplianceBucket } from '@/types/analytics'

const analyticsStore = useAnalyticsStore()
const {
  providers,
  seriesByProvider,
  loadingProviders,
  workerRun,
  dirtyBuckets,
  isLoading,
  isLoadingSeries,
  selectedGranularity,
} = storeToRefs(analyticsStore)

// Compliance field keys for the popover breakdown
const complianceFields = [
  { value: 'customer_count_present', label: 'Customer count' },
  { value: 'cause_present', label: 'Cause' },
  { value: 'outage_type_present', label: 'Outage type' },
  { value: 'is_planned_present', label: 'Is planned' },
  { value: 'outage_start_present', label: 'Outage start' },
  { value: 'etr_present', label: 'ETR' },
  { value: 'polygon_present', label: 'Polygon' },
] as const

const complianceFieldKeys = complianceFields.map((f) => f.value)

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
  bucket?: ComplianceBucket
  empty?: boolean
}

type ProviderTile = {
  key: string
  label: string
  loading: boolean
  days: DayCell[]
  numWeeks: number
  monthLabels: { label: string; col: number }[]
  overallScore: number
  sparkPath: string | null
}

const CELL_SIZE = 11
const CELL_GAP = 2
const WEEK_PX = CELL_SIZE + CELL_GAP
const DAY_LABEL_WIDTH = 28

const dayOfWeekLabels = ['', 'M', '', 'W', '', 'F', ''] as const

// Compute composite completeness: average % across all 7 compliance fields
function compositeScore(bucket: ComplianceBucket): number {
  if (bucket.total === 0) return 0
  let sum = 0
  for (const key of complianceFieldKeys) {
    sum += bucket[key as keyof ComplianceBucket] as number
  }
  return Math.round((sum / (complianceFieldKeys.length * bucket.total)) * 100)
}

// Build provider tiles from seriesByProvider
const tiles = computed<ProviderTile[]>(() => {
  const loading = loadingProviders.value
  const providerNames = providers.value.map((p) => p.provider)
  const built = providerNames.map((name) => {
    const buckets = seriesByProvider.value.get(name)
    return buildTile(name, name, buckets ?? [], loading.has(name))
  })
  built.sort((a, b) => {
    if (a.overallScore === -1 && b.overallScore === -1) return a.label.localeCompare(b.label)
    if (a.overallScore === -1) return 1
    if (b.overallScore === -1) return -1
    return b.overallScore - a.overallScore
  })
  return built
})

function buildTile(
  key: string,
  label: string,
  buckets: ComplianceBucket[],
  loading: boolean,
): ProviderTile {
  if (!buckets.length)
    return {
      key,
      label,
      loading,
      days: [],
      numWeeks: 0,
      monthLabels: [],
      overallScore: -1,
      sparkPath: null,
    }

  const sorted = [...buckets].sort((a, b) => a.bucket_start_ts - b.bucket_start_ts)
  const rawDays: DayCell[] = sorted.map((b) => ({
    date: new Date(b.bucket_start_ts * 1000),
    value: compositeScore(b),
    total: b.total,
    bucket: b,
  }))

  const nonEmpty = rawDays.filter((d) => !d.empty)

  // Weighted overall score: days with more outages count proportionally more
  const totalOutages = nonEmpty.reduce((sum, d) => sum + d.total, 0)
  const overallScore =
    nonEmpty.length > 0 && totalOutages > 0
      ? Math.round(nonEmpty.reduce((sum, d) => sum + d.value * d.total, 0) / totalOutages)
      : -1

  // Weight each cell's display value by relative volume (sqrt to soften the curve)
  const maxTotal = Math.max(...nonEmpty.map((d) => d.total), 1)
  for (const day of rawDays) {
    if (!day.empty && day.total > 0) {
      const volumeWeight = Math.sqrt(day.total / maxTotal)
      day.value = Math.round(day.value * volumeWeight)
    }
  }

  const isDaily = selectedGranularity.value === 'day'
  const { grid, numCols } = isDaily ? buildGridDays(rawDays) : buildGridFlat(rawDays)
  const monthLabels = isDaily
    ? computeMonthLabelsDaily(grid, numCols)
    : computeMonthLabelsFlat(grid)

  // Sparkline: outage totals over time
  const sparkData = sorted.map((b) => b.total)
  const sparkPath = buildSparkPath(sparkData)

  return { key, label, loading, days: grid, numWeeks: numCols, monthLabels, overallScore, sparkPath }
}

const SPARK_W = 80
const SPARK_H = 20

function buildSparkPath(data: number[]): string | null {
  if (data.length < 2) return null
  const maxVal = Math.max(...data, 1)
  const stepX = SPARK_W / (data.length - 1)
  return data
    .map((v, i) => {
      const x = i * stepX
      const y = SPARK_H - (v / maxVal) * SPARK_H
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function buildGridDays(rawDays: DayCell[]): { grid: DayCell[]; numCols: number } {
  if (!rawDays.length) return { grid: [], numCols: 0 }
  const firstDay = rawDays[0]!
  const startDow = firstDay.date.getDay()
  const padded: DayCell[] = Array.from({ length: startDow }, () => ({
    date: new Date(0),
    value: 0,
    total: 0,
    empty: true,
  }))
  padded.push(...rawDays)
  const numCols = Math.ceil(padded.length / 7)
  while (padded.length < numCols * 7) {
    padded.push({ date: new Date(0), value: 0, total: 0, empty: true })
  }
  return { grid: padded, numCols }
}

function buildGridFlat(rawDays: DayCell[]): { grid: DayCell[]; numCols: number } {
  return { grid: rawDays, numCols: rawDays.length }
}

function computeMonthLabelsDaily(
  days: DayCell[],
  numCols: number,
): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1
  for (let w = 0; w < numCols; w++) {
    const cell = days[w * 7]
    if (!cell || cell.empty) continue
    const month = cell.date.getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      labels.push({
        label: cell.date.toLocaleDateString('en-US', { month: 'short' }),
        col: w,
      })
    }
  }
  return labels
}

function computeMonthLabelsFlat(days: DayCell[]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1
  for (let i = 0; i < days.length; i++) {
    const cell = days[i]
    if (!cell || cell.empty) continue
    const month = cell.date.getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      labels.push({
        label: cell.date.toLocaleDateString('en-US', { month: 'short' }),
        col: i,
      })
    }
  }
  return labels
}

// Continuous opacity with a visible floor so any cell with data is distinguishable from empty
const getCompletionOpacity = (value: number, hasData: boolean): number => {
  if (!hasData) return 0
  return 0.15 + (Math.max(0, value) / 100) * 0.85
}

// Line chart: outages per day over time, aggregated client-side across all providers
const chartEl = ref<HTMLDivElement>()

type ChartPoint = { date: Date; total: number }

const outageChartPoints = computed<ChartPoint[] | null>(() => {
  const byProvider = seriesByProvider.value
  if (byProvider.size === 0) return null

  const totalsMap = new Map<number, number>()
  for (const [key, buckets] of byProvider) {
    if (key === '__all__') continue
    for (const b of buckets) {
      totalsMap.set(b.bucket_start_ts, (totalsMap.get(b.bucket_start_ts) ?? 0) + b.total)
    }
  }

  const sorted = [...totalsMap.entries()].sort((a, b) => a[0] - b[0])
  if (!sorted.length) return null

  return sorted.map(([ts, total]) => ({ date: new Date(ts * 1000), total }))
})

function renderChart() {
  if (!chartEl.value || !outageChartPoints.value) return

  const container = chartEl.value
  const points = outageChartPoints.value

  // Clear previous
  select(container).selectAll('*').remove()

  const margin = { top: 8, right: 16, bottom: 24, left: 48 }
  const width = container.clientWidth - margin.left - margin.right
  const height = container.clientHeight - margin.top - margin.bottom

  const svg = select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Scales
  const x = scaleTime()
    .domain(extent(points, (d) => d.date) as [Date, Date])
    .range([0, width])

  const y = scaleLinear()
    .domain([0, max(points, (d) => d.total) ?? 0])
    .nice()
    .range([height, 0])

  // Grid lines (y only)
  svg
    .append('g')
    .attr('class', 'chart-grid')
    .call(
      axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(() => ''),
    )
    .call((g) => g.select('.domain').remove())

  // X axis
  svg
    .append('g')
    .attr('class', 'chart-axis-x')
    .attr('transform', `translate(0,${height})`)
    .call(
      axisBottom(x)
        .ticks(timeWeek.every(1))
        .tickFormat((d) => timeFormat('%b %d')(d as Date))
        .tickSizeOuter(0),
    )
    .call((g) => g.select('.domain').remove())

  // Y axis
  svg
    .append('g')
    .attr('class', 'chart-axis-y')
    .call(axisLeft(y).ticks(5).tickFormat(format('~s')).tickSizeOuter(0))
    .call((g) => g.select('.domain').remove())

  // Area
  const areaGen = area<ChartPoint>()
    .x((d) => x(d.date))
    .y0(height)
    .y1((d) => y(d.total))
    .curve(curveMonotoneX)

  svg
    .append('path')
    .datum(points)
    .attr('class', 'chart-area')
    .attr('d', areaGen)

  // Line
  const lineGen = line<ChartPoint>()
    .x((d) => x(d.date))
    .y((d) => y(d.total))
    .curve(curveMonotoneX)

  svg
    .append('path')
    .datum(points)
    .attr('class', 'chart-line')
    .attr('d', lineGen)
}

watch(outageChartPoints, () => nextTick(renderChart), { flush: 'post' })

// Dirty bucket total
const dirtyBucketTotal = computed(() => {
  if (!dirtyBuckets.value) return 0
  return dirtyBuckets.value.counts.reduce((sum, c) => sum + c.count, 0)
})

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

// Helper to compute percentage for a compliance field
function fieldPct(bucket: ComplianceBucket, field: string): number {
  const val = bucket[field as keyof ComplianceBucket] as number
  return bucket.total > 0 ? Math.round((val / bucket.total) * 100) : 0
}

// Loading progress
const loadingProgress = computed(() => {
  const total = providers.value.length
  const done = total - loadingProviders.value.size
  return { done, total }
})

// --- KPI cards ---
const kpiProviderCount = computed(() => providers.value.length)

const kpiTotalOutages = computed(() => {
  let total = 0
  for (const [key, buckets] of seriesByProvider.value) {
    if (key === '__all__') continue
    for (const b of buckets) total += b.total
  }
  return total
})

const kpiAvgCompleteness = computed(() => {
  const scored = tiles.value.filter((t) => t.overallScore >= 0)
  if (!scored.length) return null
  return Math.round(scored.reduce((s, t) => s + t.overallScore, 0) / scored.length)
})

const kpiDataFreshness = computed(() => {
  let maxTs = 0
  for (const [, buckets] of seriesByProvider.value) {
    for (const b of buckets) {
      if (b.fetch_ts_max > maxTs) maxTs = b.fetch_ts_max
    }
  }
  if (!maxTs) return null
  const diff = Date.now() - maxTs * 1000
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
})

// --- Field completeness breakdown ---
const fieldBreakdown = computed(() => {
  let grandTotal = 0
  const fieldTotals: Record<string, number> = {}
  for (const f of complianceFields) fieldTotals[f.value] = 0

  for (const [key, buckets] of seriesByProvider.value) {
    if (key === '__all__') continue
    for (const b of buckets) {
      grandTotal += b.total
      for (const f of complianceFields) {
        fieldTotals[f.value] = (fieldTotals[f.value] ?? 0) + (b[f.value as keyof ComplianceBucket] as number)
      }
    }
  }

  if (!grandTotal) return null
  return complianceFields.map((f) => ({
    label: f.label,
    key: f.value,
    pct: Math.round(((fieldTotals[f.value] ?? 0) / grandTotal) * 100),
  }))
})

// --- Completeness trend ---
const completenessChartEl = ref<HTMLDivElement>()

type TrendPoint = { date: Date; score: number }

const completenessTrendPoints = computed<TrendPoint[] | null>(() => {
  const byProvider = seriesByProvider.value
  if (byProvider.size === 0) return null

  // For each timestamp, compute weighted avg completeness across providers
  const scoreMap = new Map<number, { weightedSum: number; totalWeight: number }>()

  for (const [key, buckets] of byProvider) {
    if (key === '__all__') continue
    for (const b of buckets) {
      if (b.total === 0) continue
      const score = compositeScore(b)
      const entry = scoreMap.get(b.bucket_start_ts) ?? { weightedSum: 0, totalWeight: 0 }
      entry.weightedSum += score * b.total
      entry.totalWeight += b.total
      scoreMap.set(b.bucket_start_ts, entry)
    }
  }

  const sorted = [...scoreMap.entries()].sort((a, b) => a[0] - b[0])
  if (!sorted.length) return null

  return sorted.map(([ts, { weightedSum, totalWeight }]) => ({
    date: new Date(ts * 1000),
    score: Math.round(weightedSum / totalWeight),
  }))
})

function renderCompleteness() {
  if (!completenessChartEl.value || !completenessTrendPoints.value) return

  const container = completenessChartEl.value
  const points = completenessTrendPoints.value

  select(container).selectAll('*').remove()

  const margin = { top: 8, right: 16, bottom: 24, left: 48 }
  const width = container.clientWidth - margin.left - margin.right
  const height = container.clientHeight - margin.top - margin.bottom

  const svg = select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const x = scaleTime()
    .domain(extent(points, (d) => d.date) as [Date, Date])
    .range([0, width])

  const y = scaleLinear().domain([0, 100]).range([height, 0])

  svg
    .append('g')
    .attr('class', 'chart-grid')
    .call(
      axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(() => ''),
    )
    .call((g) => g.select('.domain').remove())

  svg
    .append('g')
    .attr('class', 'chart-axis-x')
    .attr('transform', `translate(0,${height})`)
    .call(
      axisBottom(x)
        .ticks(timeWeek.every(1))
        .tickFormat((d) => timeFormat('%b %d')(d as Date))
        .tickSizeOuter(0),
    )
    .call((g) => g.select('.domain').remove())

  svg
    .append('g')
    .attr('class', 'chart-axis-y')
    .call(
      axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${d}%`)
        .tickSizeOuter(0),
    )
    .call((g) => g.select('.domain').remove())

  const areaGen = area<TrendPoint>()
    .x((d) => x(d.date))
    .y0(height)
    .y1((d) => y(d.score))
    .curve(curveMonotoneX)

  svg.append('path').datum(points).attr('class', 'chart-area').attr('d', areaGen)

  const lineGen = line<TrendPoint>()
    .x((d) => x(d.date))
    .y((d) => y(d.score))
    .curve(curveMonotoneX)

  svg.append('path').datum(points).attr('class', 'chart-line').attr('d', lineGen)
}

watch(completenessTrendPoints, () => nextTick(renderCompleteness), { flush: 'post' })

// Fetch all series when granularity changes
async function loadAllSeries() {
  await analyticsStore.fetchAllSeries(selectedGranularity.value)
}

const initialized = ref(false)

watch(selectedGranularity, () => {
  if (initialized.value) {
    loadAllSeries()
  }
})

onMounted(async () => {
  await Promise.all([
    analyticsStore.fetchProviders(),
    analyticsStore.fetchWorkerHealth(),
    analyticsStore.fetchDirtyBuckets(),
  ])
  await loadAllSeries()
  initialized.value = true
})
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <div class="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Data completeness</h1>
          <p class="text-sm text-muted mt-1">
            Composite score across all compliance fields per provider
          </p>
        </div>

        <div class="flex items-center gap-3">
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
      </div>

      <!-- Status bar -->
      <div class="flex flex-wrap items-center gap-4 mb-6 text-xs text-muted">
        <!-- Worker status -->
        <div class="flex items-center gap-1.5">
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
          <span :class="workerStatusColor" class="font-medium">
            Worker: {{ workerStatusLabel }}
          </span>
          <span v-if="workerRun">· {{ lastRunLabel }}</span>
        </div>

        <!-- Dirty buckets -->
        <div v-if="dirtyBucketTotal > 0" class="flex items-center gap-1.5">
          <span class="font-medium">{{ dirtyBucketTotal.toLocaleString() }}</span>
          <span>dirty buckets queued</span>
        </div>

        <!-- Legend -->
        <div class="flex items-center gap-2 ml-auto">
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

      <!-- KPI cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="rounded-lg border border-default bg-elevated p-4 shadow-sm">
          <div class="text-xs text-muted mb-1">Providers tracked</div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ kpiProviderCount }}
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-4 shadow-sm">
          <div class="text-xs text-muted mb-1">Total outages</div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ kpiTotalOutages.toLocaleString() }}
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-4 shadow-sm">
          <div class="text-xs text-muted mb-1">Avg completeness</div>
          <div class="text-2xl font-semibold tabular-nums">
            <template v-if="kpiAvgCompleteness != null">
              <span :class="kpiAvgCompleteness >= 80 ? 'text-primary-500' : ''">
                {{ kpiAvgCompleteness }}%
              </span>
            </template>
            <span v-else class="text-muted">–</span>
          </div>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-4 shadow-sm">
          <div class="text-xs text-muted mb-1">Data freshness</div>
          <div class="text-2xl font-semibold">
            {{ kpiDataFreshness ?? '–' }}
          </div>
        </div>
      </div>

      <!-- Outages over time chart -->
      <div
        v-if="outageChartPoints"
        class="mb-6 rounded-lg border border-default bg-elevated p-4 shadow-sm"
      >
        <h2 class="text-sm font-medium text-default mb-3">Outages over time</h2>
        <div ref="chartEl" class="outage-chart text-muted" style="height: 200px" />
      </div>

      <!-- Field breakdown + Completeness trend -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <!-- Field completeness breakdown -->
        <div
          v-if="fieldBreakdown"
          class="rounded-lg border border-default bg-elevated p-4 shadow-sm"
        >
          <h2 class="text-sm font-medium text-default mb-3">Field completeness</h2>
          <div class="space-y-2.5">
            <div v-for="field in fieldBreakdown" :key="field.key">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-muted">{{ field.label }}</span>
                <span
                  class="text-xs font-medium tabular-nums"
                  :class="field.pct >= 80 ? 'text-primary-500' : 'text-muted'"
                >
                  {{ field.pct }}%
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary-500 transition-all duration-500"
                  :style="{ width: `${field.pct}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Completeness trend chart -->
        <div
          v-if="completenessTrendPoints"
          class="rounded-lg border border-default bg-elevated p-4 shadow-sm"
        >
          <h2 class="text-sm font-medium text-default mb-3">Completeness over time</h2>
          <div ref="completenessChartEl" class="outage-chart text-muted" style="height: 200px" />
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

      <!-- Provider tile grid -->
      <TransitionGroup
        v-else
        name="tile"
        tag="div"
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
      >
        <div
          v-for="tile in tiles"
          :key="tile.key"
          class="rounded-lg border border-default bg-elevated p-3 shadow-sm"
        >
          <!-- Provider name + score + loading -->
          <div class="flex items-center gap-1.5 mb-2">
            <span class="text-xs font-medium text-default truncate">{{ tile.label }}</span>
            <span v-if="tile.loading" class="relative flex h-1.5 w-1.5 shrink-0">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
              ></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500"></span>
            </span>
            <span
              v-if="tile.overallScore >= 0"
              class="ml-auto text-[10px] font-medium tabular-nums shrink-0"
              :class="tile.overallScore >= 80 ? 'text-primary-500' : 'text-muted'"
            >
              {{ tile.overallScore }}%
            </span>
          </div>

          <!-- Sparkline -->
          <svg
            v-if="tile.sparkPath"
            :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
            class="mb-1.5 w-full"
            :style="{ height: `${SPARK_H}px` }"
            preserveAspectRatio="none"
          >
            <path
              :d="tile.sparkPath"
              fill="none"
              stroke="var(--color-primary-500)"
              vector-effect="non-scaling-stroke"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <!-- Loading placeholder -->
          <div
            v-if="tile.loading && !tile.days.length"
            class="flex items-center justify-center"
            :style="{
              height:
                selectedGranularity === 'day'
                  ? `${7 * (CELL_SIZE + CELL_GAP) + 14}px`
                  : `${CELL_SIZE + 14}px`,
            }"
          >
            <div class="h-1.5 w-16 rounded-full bg-default animate-pulse" />
          </div>

          <!-- Mini heatmap -->
          <div v-else-if="tile.days.length">
            <!-- Month labels -->
            <div
              class="relative h-3.5 mb-0.5"
              :style="{
                marginLeft: selectedGranularity === 'day' ? `${DAY_LABEL_WIDTH}px` : '0',
                width: `${tile.numWeeks * WEEK_PX}px`,
              }"
            >
              <span
                v-for="ml in tile.monthLabels"
                :key="ml.label"
                class="absolute text-[10px] font-medium text-muted leading-none"
                :style="{ left: `${ml.col * WEEK_PX}px` }"
              >
                {{ ml.label }}
              </span>
            </div>

            <div class="flex">
              <!-- Day-of-week labels (daily only) -->
              <div
                v-if="selectedGranularity === 'day'"
                class="flex flex-col shrink-0"
                :style="{
                  width: `${DAY_LABEL_WIDTH}px`,
                  gap: `${CELL_GAP}px`,
                }"
              >
                <span
                  v-for="day in dayOfWeekLabels"
                  :key="day"
                  class="text-[10px] text-muted leading-none"
                  :style="{ height: `${CELL_SIZE}px`, lineHeight: `${CELL_SIZE}px` }"
                >
                  {{ day }}
                </span>
              </div>

              <!-- Cells -->
              <div
                class="grid"
                :style="
                  selectedGranularity === 'day'
                    ? {
                        gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                        gridAutoFlow: 'column',
                        gridAutoColumns: `${CELL_SIZE}px`,
                        gap: `${CELL_GAP}px`,
                        width: `${tile.numWeeks * WEEK_PX}px`,
                      }
                    : {
                        gridTemplateRows: `${CELL_SIZE}px`,
                        gridAutoFlow: 'column',
                        gridAutoColumns: `${CELL_SIZE}px`,
                        gap: `${CELL_GAP}px`,
                        width: `${tile.numWeeks * WEEK_PX}px`,
                      }
                "
              >
                <template v-for="(cell, colIdx) in tile.days" :key="colIdx">
                  <div
                    v-if="cell.empty"
                    class="invisible"
                    :style="{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }"
                  />
                  <UPopover
                    v-else
                    mode="hover"
                    :open-delay="150"
                    :close-delay="50"
                    :content="{ side: 'top', align: 'center', sideOffset: 6 }"
                  >
                    <div
                      class="rounded-[2px] cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-primary-400/50 hover:scale-125 bg-muted relative overflow-hidden"
                      :style="{
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                      }"
                    >
                      <div
                        class="absolute inset-0 rounded-[2px]"
                        :style="{
                          backgroundColor: 'var(--color-primary-500)',
                          opacity: getCompletionOpacity(cell.value, cell.total > 0),
                        }"
                      />
                    </div>
                    <template #content>
                      <div class="p-3 min-w-[180px] text-xs">
                        <div class="font-semibold mb-1">
                          {{ tile.label }}
                        </div>
                        <div class="text-muted mb-1">
                          <template v-if="selectedGranularity === 'day'">
                            {{
                              cell.date.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            }}
                          </template>
                          <template v-else-if="selectedGranularity === 'week'">
                            Week of
                            {{
                              cell.date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            }}
                          </template>
                          <template v-else>
                            {{
                              cell.date.toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                              })
                            }}
                          </template>
                        </div>
                        <template v-if="cell.total > 0">
                          <div class="font-medium mb-2">Composite: {{ cell.value }}%</div>
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
                                  cell.bucket && fieldPct(cell.bucket, field.value) >= 80
                                    ? 'text-primary-500'
                                    : ''
                                "
                              >
                                {{
                                  cell.bucket
                                    ? `${cell.bucket[field.value as keyof typeof cell.bucket] as number}/${cell.bucket.total}`
                                    : '–'
                                }}
                              </span>
                            </div>
                          </div>
                          <div class="mt-2 pt-2 border-t border-default text-muted">
                            Total outages: {{ cell.total }}
                          </div>
                        </template>
                        <div v-else class="text-muted">No outages reported</div>
                      </div>
                    </template>
                  </UPopover>
                </template>
              </div>
            </div>
          </div>

          <!-- No data -->
          <div
            v-else
            class="flex items-center justify-center text-[10px] text-muted"
            :style="{
              height:
                selectedGranularity === 'day'
                  ? `${7 * (CELL_SIZE + CELL_GAP) + 14}px`
                  : `${CELL_SIZE + 14}px`,
            }"
          >
            No data
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.tile-move {
  transition: transform 0.5s ease;
}

/* D3 chart theme using CSS variables */
.outage-chart :deep(.chart-line) {
  fill: none;
  stroke: var(--color-primary-500);
  stroke-width: 1.5px;
}

.outage-chart :deep(.chart-area) {
  fill: var(--color-primary-500);
  fill-opacity: 0.1;
}

.outage-chart :deep(.chart-grid line) {
  stroke: currentColor;
  stroke-opacity: 0.1;
}

.outage-chart :deep(.chart-axis-x text),
.outage-chart :deep(.chart-axis-y text) {
  fill: currentColor;
  opacity: 0.5;
  font-size: 10px;
}

.outage-chart :deep(.chart-axis-x .domain),
.outage-chart :deep(.chart-axis-y .domain),
.outage-chart :deep(.chart-axis-x line),
.outage-chart :deep(.chart-axis-y line) {
  stroke: none;
}
</style>
