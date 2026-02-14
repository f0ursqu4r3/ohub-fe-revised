import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '@/stores/analytics'
import type { ComplianceBucket } from '@/types/analytics'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const complianceFields = [
  { value: 'customer_count_present', label: 'Customer count' },
  { value: 'cause_present', label: 'Cause' },
  { value: 'outage_type_present', label: 'Outage type' },
  { value: 'is_planned_present', label: 'Is planned' },
  { value: 'outage_start_present', label: 'Outage start' },
  { value: 'etr_present', label: 'ETR' },
  { value: 'polygon_present', label: 'Polygon' },
] as const

export const complianceFieldKeys = complianceFields.map((f) => f.value)

export const granularityOptions = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
] as const

export const CELL_SIZE = 11
export const CELL_GAP = 2
export const WEEK_PX = CELL_SIZE + CELL_GAP
export const DAY_LABEL_WIDTH = 28
export const SPARK_W = 80
export const SPARK_H = 20

export const dayOfWeekLabels = ['', 'M', '', 'W', '', 'F', ''] as const

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type DayCell = {
  date: Date
  value: number
  total: number
  bucket?: ComplianceBucket
  empty?: boolean
}

export type ProviderTile = {
  key: string
  label: string
  loading: boolean
  days: DayCell[]
  numWeeks: number
  monthLabels: { label: string; col: number }[]
  overallScore: number
  sparkPath: string | null
}

export type ChartPoint = { date: Date; total: number }

export type TrendPoint = { date: Date; score: number }

export type FieldBreakdownItem = { label: string; key: string; pct: number }

// ─────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────

export function compositeScore(bucket: ComplianceBucket): number {
  if (bucket.total === 0) return 0
  let sum = 0
  for (const key of complianceFieldKeys) {
    sum += bucket[key as keyof ComplianceBucket] as number
  }
  return Math.round((sum / (complianceFieldKeys.length * bucket.total)) * 100)
}

export function getCompletionOpacity(value: number, hasData: boolean): number {
  if (!hasData) return 0
  return 0.15 + (Math.max(0, value) / 100) * 0.85
}

export function fieldPct(bucket: ComplianceBucket, field: string): number {
  const val = bucket[field as keyof ComplianceBucket] as number
  return bucket.total > 0 ? Math.round((val / bucket.total) * 100) : 0
}

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

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────

export function useAnalyticsData() {
  const analyticsStore = useAnalyticsStore()
  const {
    providers,
    seriesByProvider,
    loadingProviders,
    isLoading,
    isLoadingSeries,
    selectedGranularity,
  } = storeToRefs(analyticsStore)

  // --- Tile building ---

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

    const totalOutages = nonEmpty.reduce((sum, d) => sum + d.total, 0)
    const overallScore =
      nonEmpty.length > 0 && totalOutages > 0
        ? Math.round(nonEmpty.reduce((sum, d) => sum + d.value * d.total, 0) / totalOutages)
        : -1

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

    const sparkData = sorted.map((b) => b.total)
    const sparkPath = buildSparkPath(sparkData)

    return { key, label, loading, days: grid, numWeeks: numCols, monthLabels, overallScore, sparkPath }
  }

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

  // --- Chart data ---

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

  const completenessTrendPoints = computed<TrendPoint[] | null>(() => {
    const byProvider = seriesByProvider.value
    if (byProvider.size === 0) return null

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

  // --- KPIs ---

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

  // --- Field breakdown ---

  const fieldBreakdown = computed<FieldBreakdownItem[] | null>(() => {
    let grandTotal = 0
    const fieldTotals: Record<string, number> = {}
    for (const f of complianceFields) fieldTotals[f.value] = 0

    for (const [key, buckets] of seriesByProvider.value) {
      if (key === '__all__') continue
      for (const b of buckets) {
        grandTotal += b.total
        for (const f of complianceFields) {
          fieldTotals[f.value] =
            (fieldTotals[f.value] ?? 0) + (b[f.value as keyof ComplianceBucket] as number)
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

  // --- Loading ---

  const loadingProgress = computed(() => {
    const total = providers.value.length
    const done = total - loadingProviders.value.size
    return { done, total }
  })

  // --- Data fetching ---

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
    await analyticsStore.fetchProviders()
    await loadAllSeries()
    initialized.value = true
  })

  onBeforeUnmount(() => {
    analyticsStore.cleanup()
  })

  return {
    // Store refs
    selectedGranularity,
    isLoading,
    isLoadingSeries,

    // Computed data
    tiles,
    outageChartPoints,
    completenessTrendPoints,
    fieldBreakdown,
    loadingProgress,

    // KPIs
    kpiProviderCount,
    kpiTotalOutages,
    kpiAvgCompleteness,
  }
}
