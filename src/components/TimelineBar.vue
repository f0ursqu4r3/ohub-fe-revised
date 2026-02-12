<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'
import { usePlayback } from '@/composables/map/usePlayback'
import { TimeInterval } from '@/types/outage'

const outageStore = useOutageStore()
const {
  selectedOutageTs,
  blocks,
  maxCount,
  timeInterval,
  startTime,
  endTime,
  selectedProvider,
  providers,
} = storeToRefs(outageStore)

const {
  isPlaying,
  playbackSpeed,
  canPlayForward,
  canPlayBackward,
  stepForward,
  stepBackward,
  togglePlayback,
  cycleSpeed,
} = usePlayback()

const open = ref(true)
const scrubber = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const selectedRatio = ref(1)


const gradientId = `tl-gradient-${Math.random().toString(36).slice(2, 9)}`
const areaGradientId = `tl-area-${Math.random().toString(36).slice(2, 9)}`

// Filtered blocks within the time range
const filteredBlocks = computed(() => {
  const start = startTime.value
  const end = endTime.value
  if (start === null || end === null) return blocks.value
  const startTs = Math.floor(start.getTime() / 1000)
  const endTs = Math.floor(end.getTime() / 1000)
  return blocks.value.filter((block) => block.ts >= startTs && block.ts <= endTs)
})

const totalTicks = computed(() => filteredBlocks.value.length)

const selectedBlock = computed(() => {
  const total = totalTicks.value
  if (!total) return null
  const index = Math.round(selectedRatio.value * (total - 1))
  return filteredBlocks.value[index] ?? null
})

const selectedTime = computed<number | null>(() => selectedBlock.value?.ts ?? null)

const selectedLabel = computed(() => {
  const ts = selectedTime.value
  if (ts === null) return '--:--'
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
})

const selectedDateLabel = computed(() => {
  const ts = selectedTime.value
  if (ts === null) return 'Awaiting data'
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
})

const selectedCountLabel = computed(() => {
  const block = selectedBlock.value
  if (!block) return '—'
  const count = block.count ?? 0
  return count.toLocaleString()
})

// Tick classification for the horizontal axis
type TickType = 'level-1' | 'level-2' | 'level-3'

const getTickInfo = (date: Date, interval: TimeInterval): { type: TickType; label: string } => {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const dayOfWeek = date.getDay()
  const dayOfMonth = date.getDate()

  switch (interval) {
    case TimeInterval.OneMinute:
    case TimeInterval.FiveMinutes:
    case TimeInterval.FifteenMinutes:
    case TimeInterval.ThirtyMinutes:
      if (hours === 0 && minutes === 0) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        }
      }
      if (minutes === 0) {
        return {
          type: hours === 12 ? 'level-1' : 'level-2',
          label: hours === 12 ? '12 PM' : '',
        }
      }
      return { type: 'level-3', label: '' }

    case TimeInterval.OneHour:
      if (hours === 0) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        }
      }
      if (hours === 12) return { type: 'level-2', label: '12 PM' }
      if (hours % 6 === 0) return { type: 'level-2', label: '' }
      return { type: 'level-3', label: '' }

    case TimeInterval.OneDay:
      if (dayOfWeek === 0) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        }
      }
      if (dayOfMonth === 1) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short' }),
        }
      }
      if (dayOfWeek === 3) return { type: 'level-2', label: '' }
      return { type: 'level-3', label: '' }

    case TimeInterval.SevenDays:
      if (dayOfMonth <= 7) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        }
      }
      if (dayOfMonth >= 14 && dayOfMonth <= 16) return { type: 'level-2', label: '' }
      return { type: 'level-3', label: '' }

    case TimeInterval.ThirtyDays:
    case TimeInterval.OneYear: {
      const month = date.getMonth()
      if (month === 0 && dayOfMonth <= 30) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { year: 'numeric' }),
        }
      }
      if ([3, 6, 9].includes(month) && dayOfMonth <= 30) {
        return {
          type: 'level-2',
          label: date.toLocaleDateString(undefined, { month: 'short' }),
        }
      }
      return { type: 'level-3', label: '' }
    }

    default:
      return { type: 'level-3', label: '' }
  }
}

const ticks = computed(() => {
  const tickArray: Array<{ position: number; label: string; type: TickType }> = []
  const blocksArr = filteredBlocks.value
  const total = blocksArr.length

  for (let i = 0; i < total; i++) {
    const block = blocksArr[i]
    if (!block) continue
    const position = total > 1 ? (i / (total - 1)) * 100 : 0
    const date = new Date(block.ts * 1000)
    const { type, label } = getTickInfo(date, timeInterval.value)
    tickArray.push({ position, label, type })
  }

  return tickArray
})

// Histogram / sparkline data for the horizontal bar
const histogramData = computed(() => {
  const blocksArr = filteredBlocks.value
  const total = blocksArr.length

  return blocksArr.map((block, i) => {
    const heightPercentage = maxCount.value > 0 ? ((block.count ?? 0) / maxCount.value) * 100 : 0
    return {
      count: block.count ?? 0,
      position: total > 1 ? (i / (total - 1)) * 100 : 0,
      heightPercentage,
    }
  })
})

// SVG sparkline path (horizontal: x=time position, y=count)
const graphPath = computed(() => {
  const points = histogramData.value.map((entry) => {
    const x = entry.position
    const minY = 92
    const maxY = 8
    const y = minY - (entry.heightPercentage / 100) * (minY - maxY)
    return { x, y }
  })

  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`

  let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    if (!p1 || !p2) break
    const p0 = points[i - 1] ?? p1
    const p3 = points[i + 2] ?? p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  return d
})

const graphAreaPath = computed(() => {
  const points = histogramData.value.map((entry) => {
    const x = entry.position
    const minY = 92
    const maxY = 8
    const y = minY - (entry.heightPercentage / 100) * (minY - maxY)
    return { x, y }
  })

  const first = points[0]
  if (!first) return ''
  if (points.length === 1) {
    return `M ${first.x.toFixed(2)} 100 L ${first.x.toFixed(2)} ${first.y.toFixed(2)} L ${first.x.toFixed(2)} 100 Z`
  }

  let d = `M ${first.x.toFixed(2)} 100 L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    if (!p1 || !p2) break
    const p0 = points[i - 1] ?? p1
    const p3 = points[i + 2] ?? p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  const last = points[points.length - 1]
  if (last) d += ` L ${last.x.toFixed(2)} 100 Z`
  return d
})

// Scrubber interaction
const snapRatio = (ratio: number) => {
  const total = totalTicks.value
  if (total > 1) {
    const snappedIndex = Math.round(ratio * (total - 1))
    return snappedIndex / (total - 1)
  }
  return 0
}

const updateSelectedRatio = (clientX: number) => {
  if (!scrubber.value) return
  const rect = scrubber.value.getBoundingClientRect()
  const x = clientX - rect.left
  let ratio = x / rect.width
  ratio = Math.min(Math.max(ratio, 0), 1)

  selectedRatio.value = snapRatio(ratio)

  const ts = selectedTime.value
  if (ts === null) return
  selectedOutageTs.value = ts
}

const onPointerDown = (event: PointerEvent) => {
  event.preventDefault()
  isDragging.value = true
  updateSelectedRatio(event.clientX)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const onPointerMove = (event: PointerEvent) => {
  if (!isDragging.value) return
  updateSelectedRatio(event.clientX)
}

const onPointerUp = (event: PointerEvent) => {
  isDragging.value = false
  updateSelectedRatio(event.clientX)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

const onWheel = (event: WheelEvent) => {
  const total = totalTicks.value
  if (total <= 1) return

  const scrollAmount = Math.sign(event.deltaX || event.deltaY) / (total - 1)
  let ratio = selectedRatio.value + scrollAmount
  ratio = Math.min(Math.max(ratio, 0), 1)
  selectedRatio.value = snapRatio(ratio)

  const ts = selectedTime.value
  if (ts === null) return
  selectedOutageTs.value = ts
}

// Sync ratio when store timestamp changes externally
watch(
  () => selectedOutageTs.value,
  (ts) => {
    if (ts === null) return
    const blockList = filteredBlocks.value
    if (!blockList.length) return
    if (blockList.length === 1) {
      selectedRatio.value = 0
      return
    }
    const index = blockList.findIndex((block) => block.ts === ts)
    if (index === -1) return
    selectedRatio.value = index / (blockList.length - 1)
  },
  { immediate: true },
)

// Provider filter
const ALL_PROVIDERS = '__all__'

const providerOptions = computed(() => [
  { label: 'All Providers', value: ALL_PROVIDERS },
  ...providers.value.map((p) => ({ label: p, value: p })),
])

const providerModel = computed({
  get: () => selectedProvider.value ?? ALL_PROVIDERS,
  set: (val: string) => {
    outageStore.selectedProvider = val === ALL_PROVIDERS ? null : val
  },
})

const tickHeight = (type: TickType) => {
  switch (type) {
    case 'level-1':
      return 'h-full'
    case 'level-2':
      return 'h-1/2'
    case 'level-3':
    default:
      return 'h-1/4'
  }
}

onMounted(() => {
  open.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div class="absolute bottom-0 inset-x-0 z-30 pointer-events-none flex justify-center px-2 pb-2 sm:px-4 sm:pb-4">
    <Transition name="tl-swap" mode="out-in">
      <!-- Expanded bar -->
      <div
        v-if="open"
        key="expanded"
        class="pointer-events-auto w-full max-w-5xl rounded-2xl border border-accented bg-(--ui-bg-elevated)/95 shadow-xl shadow-primary-900/10 backdrop-blur-sm"
      >
        <div class="tl-row flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <!-- Playback controls -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-all hover:bg-primary-500/10 hover:text-primary-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
              :disabled="!canPlayBackward"
              title="Step backward"
              @click="stepBackward"
            >
              <UIcon name="i-heroicons-backward" class="h-3.5 w-3.5" />
            </button>

            <button
              class="tl-play flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-white shadow-md transition-all hover:bg-primary-600 hover:scale-105 active:scale-95"
              :title="isPlaying ? 'Pause' : 'Play'"
              @click="togglePlayback"
            >
              <UIcon v-if="!isPlaying" name="i-heroicons-play" class="ml-0.5 h-4 w-4" />
              <UIcon v-else name="i-heroicons-pause" class="h-4 w-4" />
            </button>

            <button
              class="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-all hover:bg-primary-500/10 hover:text-primary-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
              :disabled="!canPlayForward"
              title="Step forward"
              @click="stepForward"
            >
              <UIcon name="i-heroicons-forward" class="h-3.5 w-3.5" />
            </button>

            <button
              class="hidden sm:flex h-6 items-center rounded-full px-1.5 text-[10px] font-bold text-muted transition-all hover:bg-primary-500/10 hover:text-primary-500"
              title="Change playback speed"
              @click="cycleSpeed"
            >
              {{ playbackSpeed }}x
            </button>
          </div>

          <div class="hidden sm:block h-8 w-px bg-border shrink-0"></div>

          <!-- Horizontal scrubber -->
          <div
            ref="scrubber"
            class="tl-scrubber relative flex-1 h-12 cursor-pointer select-none touch-none"
            @pointerdown="onPointerDown"
            @wheel.passive="onWheel"
          >
            <!-- Sparkline background -->
            <svg
              class="pointer-events-none absolute inset-0 z-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="var(--ui-primary, #18b8a6)" stop-opacity="0.9" />
                  <stop
                    offset="100%"
                    stop-color="var(--ui-secondary, #6ee9d7)"
                    stop-opacity="0.8"
                  />
                </linearGradient>
                <linearGradient :id="areaGradientId" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--ui-secondary, #18b8a6)" stop-opacity="0.3" />
                  <stop
                    offset="100%"
                    stop-color="var(--ui-accent, #6ee9d7)"
                    stop-opacity="0.05"
                  />
                </linearGradient>
              </defs>
              <path v-if="graphAreaPath" :d="graphAreaPath" :fill="`url(#${areaGradientId})`" />
              <path
                v-if="graphPath"
                :d="graphPath"
                :stroke="`url(#${gradientId})`"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            <!-- Tick marks along bottom -->
            <div class="absolute bottom-0 left-0 right-0 h-3 z-10">
              <template v-for="(tick, index) in ticks" :key="`tick-${index}`">
                <div
                  class="absolute bottom-0 w-px"
                  :class="[
                    tickHeight(tick.type),
                    tick.type === 'level-1'
                      ? 'bg-default/40'
                      : tick.type === 'level-2'
                        ? 'bg-muted/30'
                        : 'bg-muted/15',
                  ]"
                  :style="{ left: tick.position + '%' }"
                >
                  <span
                    v-if="tick.label"
                    class="pointer-events-none absolute bottom-full mb-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-muted"
                  >
                    {{ tick.label }}
                  </span>
                </div>
              </template>
            </div>

            <!-- Selected position indicator -->
            <div
              class="absolute top-0 bottom-0 z-20"
              :style="{ left: `${selectedRatio * 100}%` }"
            >
              <div class="relative h-full">
                <span
                  class="absolute top-0 bottom-0 left-0 w-0.5 -translate-x-1/2 rounded-full bg-secondary/70 shadow-lg"
                ></span>
                <!-- Draggable handle -->
                <span
                  class="absolute top-1/2 left-0 z-10 flex h-6 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-secondary/70 bg-secondary shadow-lg cursor-grab active:cursor-grabbing"
                >
                  <span class="w-px h-3 bg-black/20 rounded-full"></span>
                </span>
              </div>
            </div>
          </div>

          <div class="hidden sm:block h-8 w-px bg-border shrink-0"></div>

          <!-- Time display & info -->
          <div class="shrink-0 text-right">
            <p class="text-sm sm:text-lg font-semibold leading-tight text-default">{{ selectedLabel }}</p>
            <p class="hidden sm:block text-xs text-muted">{{ selectedDateLabel }}</p>
            <p
              v-if="selectedBlock"
              class="hidden sm:block text-xs font-semibold text-secondary-500 dark:text-secondary-400"
            >
              {{ selectedCountLabel }} events
            </p>
          </div>

          <div class="hidden sm:block h-8 w-px bg-border shrink-0"></div>

          <!-- Provider filter -->
          <div class="hidden sm:block shrink-0 w-36">
            <USelectMenu
              v-model="providerModel"
              :items="providerOptions"
              value-key="value"
              placeholder="All Providers"
              size="sm"
              class="w-full"
            />
          </div>

          <!-- Collapse button -->
          <button
            class="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-all hover:bg-accented hover:text-default"
            title="Minimize timeline"
            @click="open = false"
          >
            <UIcon name="i-heroicons-chevron-down" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Collapsed pill -->
      <button
        v-else
        key="collapsed"
        class="pointer-events-auto flex items-center gap-2 rounded-full border border-accented bg-(--ui-bg-elevated)/95 px-4 py-2 text-sm font-medium text-default shadow-lg backdrop-blur-sm transition-colors hover:shadow-xl"
        @click="open = true"
      >
        <UIcon name="i-heroicons-clock" class="h-4 w-4 text-primary-500" />
        <span>{{ selectedLabel }}</span>
        <span class="text-muted">{{ selectedDateLabel }}</span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.tl-swap-enter-active,
.tl-swap-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
}
.tl-swap-enter-from {
  transform: translateY(20px);
  opacity: 0;
}
.tl-swap-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

/* Short viewport (landscape mobile) */
@media (max-height: 500px) {
  .tl-row {
    padding: 0.25rem 0.5rem;
    gap: 0.375rem;
  }
  .tl-scrubber {
    height: 2rem; /* 32px instead of 48px */
  }
  .tl-play {
    height: 1.75rem;
    width: 1.75rem;
  }
}
</style>
