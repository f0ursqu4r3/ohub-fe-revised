<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
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
    return { key, label, loading, days: [], numWeeks: 0, monthLabels: [], overallScore: -1 }

  const sorted = [...buckets].sort((a, b) => a.bucket_start_ts - b.bucket_start_ts)
  const rawDays: DayCell[] = sorted.map((b) => ({
    date: new Date(b.bucket_start_ts * 1000),
    value: compositeScore(b),
    total: b.total,
    bucket: b,
  }))

  const nonEmpty = rawDays.filter((d) => !d.empty)
  const overallScore =
    nonEmpty.length > 0
      ? Math.round(nonEmpty.reduce((sum, d) => sum + d.value, 0) / nonEmpty.length)
      : -1

  const { grid, numWeeks } = buildGridDays(rawDays)
  const monthLabels = computeMonthLabels(grid, numWeeks)
  return { key, label, loading, days: grid, numWeeks, monthLabels, overallScore }
}

function buildGridDays(rawDays: DayCell[]): { grid: DayCell[]; numWeeks: number } {
  if (!rawDays.length) return { grid: [], numWeeks: 0 }
  const firstDay = rawDays[0]!
  const startDow = firstDay.date.getDay()
  const padded: DayCell[] = Array.from({ length: startDow }, () => ({
    date: new Date(0),
    value: 0,
    total: 0,
    empty: true,
  }))
  padded.push(...rawDays)
  const numWeeks = Math.ceil(padded.length / 7)
  while (padded.length < numWeeks * 7) {
    padded.push({ date: new Date(0), value: 0, total: 0, empty: true })
  }
  return { grid: padded, numWeeks }
}

function computeMonthLabels(
  days: DayCell[],
  numWeeks: number,
): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1
  for (let w = 0; w < numWeeks; w++) {
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

// Continuous opacity: 0% → 0.1, 100% → 1.0, with a floor so any data is visible
const getCompletionOpacity = (value: number): number => {
  if (value <= 0) return 0
  return 0.1 + (value / 100) * 0.9
}

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
                opacity: getCompletionOpacity(val),
              }"
            />
          </div>
          <span class="font-medium">More</span>
        </div>
      </div>

      <!-- Initial loading state -->
      <div
        v-if="isLoading && !tiles.length"
        class="flex items-center justify-center py-20"
      >
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
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500"
              ></span>
            </span>
            <span
              v-if="tile.overallScore >= 0"
              class="ml-auto text-[10px] font-medium tabular-nums shrink-0"
              :class="tile.overallScore >= 80 ? 'text-primary-500' : 'text-muted'"
            >
              {{ tile.overallScore }}%
            </span>
          </div>

          <!-- Loading placeholder -->
          <div
            v-if="tile.loading && !tile.days.length"
            class="flex items-center justify-center"
            :style="{ height: `${7 * (CELL_SIZE + CELL_GAP) + 14}px` }"
          >
            <div class="h-1.5 w-16 rounded-full bg-default animate-pulse" />
          </div>

          <!-- Mini heatmap -->
          <div v-else-if="tile.days.length">
            <!-- Month labels -->
            <div
              class="relative h-3.5 mb-0.5"
              :style="{
                marginLeft: `${DAY_LABEL_WIDTH}px`,
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
              <!-- Day-of-week labels -->
              <div
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
                :style="{
                  gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                  gridAutoFlow: 'column',
                  gridAutoColumns: `${CELL_SIZE}px`,
                  gap: `${CELL_GAP}px`,
                  width: `${tile.numWeeks * WEEK_PX}px`,
                }"
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
                          opacity: getCompletionOpacity(cell.value),
                        }"
                      />
                    </div>
                    <template #content>
                      <div class="p-3 min-w-[180px] text-xs">
                        <div class="font-semibold mb-1">
                          {{ tile.label }}
                        </div>
                        <div class="text-muted mb-1">
                          {{
                            cell.date.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          }}
                        </div>
                        <div class="font-medium mb-2">
                          Composite: {{ cell.value }}%
                        </div>
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
                                  ? `${(cell.bucket[field.value as keyof typeof cell.bucket] as number)}/${cell.bucket.total}`
                                  : '–'
                              }}
                            </span>
                          </div>
                        </div>
                        <div class="mt-2 pt-2 border-t border-default text-muted">
                          Total outages: {{ cell.total }}
                        </div>
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
            :style="{ height: `${7 * (CELL_SIZE + CELL_GAP) + 14}px` }"
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
</style>
