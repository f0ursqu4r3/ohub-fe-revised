<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'
import { TimeInterval } from '@/types/outage'

let openScrubberCount = 0

const syncTimelineBodyClass = () => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('timeline-open', openScrubberCount > 0)
}

const outageStore = useOutageStore()
const { selectedOutageTs, blocks, maxCount, timeInterval } = storeToRefs(outageStore)

const emit = defineEmits<{
  (e: 'timeSelected', ts: number): void
}>()

const open = ref(false)
const selectedRatio = ref(1)
const scrubber = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const totalTicks = computed(() => blocks.value.length)
const histogramHeight = computed(() => (totalTicks.value > 0 ? 100 / totalTicks.value : 0))

const selectedBlock = computed(() => {
  const total = totalTicks.value
  if (!total) return null
  const index = Math.round(selectedRatio.value * (total - 1))
  const block = blocks.value[index]
  return block ?? null
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
  return `${count.toLocaleString()} events`
})

type TickType = 'level-1' | 'level-2' | 'level-3'

/**
 * Returns tick classification based on the current time interval.
 * Level-1: Major boundaries (days for hourly intervals, months for daily, years for monthly)
 * Level-2: Secondary boundaries (noon for hourly, week starts for daily)
 * Level-3: Regular ticks
 */
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
      // For minute-based intervals: show hours as level-1, half-hours as level-2
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
      if (minutes === 30) {
        return { type: 'level-3', label: '' }
      }
      return { type: 'level-3', label: '' }

    case TimeInterval.OneHour:
      // For hourly: show days as level-1, 6-hour marks as level-2
      if (hours === 0) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        }
      }
      if (hours === 12) {
        return { type: 'level-2', label: '12 PM' }
      }
      if (hours % 6 === 0) {
        return { type: 'level-2', label: '' }
      }
      return { type: 'level-3', label: '' }

    case TimeInterval.OneDay:
      // For daily: show week starts as level-1, mid-week as level-2
      if (dayOfWeek === 0) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        }
      }
      if (dayOfWeek === 3) {
        return { type: 'level-2', label: '' }
      }
      if (dayOfMonth === 1) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short' }),
        }
      }
      return { type: 'level-3', label: '' }

    case TimeInterval.SevenDays:
      // For weekly: show month starts as level-1
      if (dayOfMonth <= 7) {
        return {
          type: 'level-1',
          label: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        }
      }
      if (dayOfMonth >= 14 && dayOfMonth <= 16) {
        return { type: 'level-2', label: '' }
      }
      return { type: 'level-3', label: '' }

    case TimeInterval.ThirtyDays:
    case TimeInterval.OneYear:
      // For monthly/yearly: show year starts as level-1, quarters as level-2
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
      if (dayOfMonth <= 30) {
        return {
          type: 'level-3',
          label: '',
        }
      }
      return { type: 'level-3', label: '' }

    default:
      return { type: 'level-3', label: '' }
  }
}

const ticks = computed(() => {
  const tickArray: Array<{ position: number; label: string; type: TickType }> = []
  const blocksArr = blocks.value
  const total = blocksArr.length
  const interval = timeInterval.value

  for (let i = 0; i < total; i++) {
    const block = blocksArr[i]
    if (!block) continue
    const position = total > 1 ? (i / (total - 1)) * 100 : 0
    const date = new Date(block.ts * 1000)
    const { type, label } = getTickInfo(date, interval)

    tickArray.push({ position, label, type })
  }

  return tickArray
})

const tickClass = (type: TickType) => {
  switch (type) {
    case 'level-1':
      return 'w-full h-[2px] bg-gray-700'
    case 'level-2':
      return 'w-1/2 h-px bg-gray-400'
    case 'level-3':
    default:
      return 'w-1/4 h-px bg-gray-400'
  }
}

const histogramData = computed(() => {
  const blocksArr = blocks.value
  const total = blocksArr.length

  return blocksArr.map((block, i) => {
    const widthPercentage = maxCount.value > 0 ? ((block.count ?? 0) / maxCount.value) * 100 : 0
    return {
      count: block.count ?? 0,
      position: total > 1 ? (i / (total - 1)) * 100 : 0,
      widthPercentage,
    }
  })
})

const snapRatio = (ratio: number) => {
  const total = totalTicks.value
  if (total > 1) {
    const snappedIndex = Math.round(ratio * (total - 1))
    return snappedIndex / (total - 1)
  }
  return 0
}

const updateSelectedRatio = (clientY: number) => {
  if (!scrubber.value) return
  const rect = scrubber.value.getBoundingClientRect()
  const y = clientY - rect.top
  let ratio = y / rect.height
  ratio = Math.min(Math.max(ratio, 0), 1)

  selectedRatio.value = snapRatio(ratio)

  const ts = selectedTime.value
  if (ts === null) return

  selectedOutageTs.value = ts
  emit('timeSelected', ts)
}

const onPointerDown = (event: PointerEvent) => {
  event.preventDefault()
  isDragging.value = true
  updateSelectedRatio(event.clientY)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const onPointerMove = (event: PointerEvent) => {
  if (!isDragging.value) return
  updateSelectedRatio(event.clientY)
}

const onPointerUp = (event: PointerEvent) => {
  isDragging.value = false
  updateSelectedRatio(event.clientY)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

const onWheel = (event: WheelEvent) => {
  const total = totalTicks.value
  if (total <= 1) return

  const scrollAmount = Math.sign(event.deltaY) / (total - 1)
  let ratio = selectedRatio.value + scrollAmount
  ratio = Math.min(Math.max(ratio, 0), 1)
  selectedRatio.value = snapRatio(ratio)

  const ts = selectedTime.value
  if (ts === null) return

  selectedOutageTs.value = ts
  emit('timeSelected', ts)
}

const toggleScrubber = () => {
  open.value = !open.value
}

watch(open, (next, prev) => {
  if (next === prev) return
  if (next) {
    openScrubberCount += 1
  } else {
    openScrubberCount = Math.max(0, openScrubberCount - 1)
  }
  syncTimelineBodyClass()
})

watch(
  () => selectedOutageTs.value,
  (ts) => {
    if (ts === null) return
    const blockList = blocks.value
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

onMounted(() => {
  open.value = window.innerWidth >= 768
})

onBeforeUnmount(() => {
  if (open.value) {
    openScrubberCount = Math.max(0, openScrubberCount - 1)
    syncTimelineBodyClass()
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div class="h-full py-4 pl-4 flex items-start pointer-events-none">
    <transition name="slide">
      <div
        v-show="open"
        class="scrubber-panel glass mr-4 map-control-surface pointer-events-auto flex h-full w-28 flex-col gap-6 p-4 pl-0 text-(--ui-text) transition-all duration-300 ease-out touch-none select-none"
        :class="[$attrs.class]"
      >
        <div class="space-y-1 text-right">
          <p class="text-[10px] font-semibold uppercase tracking-[0.35em] text-(--ui-text-dimmed)">
            Selected
          </p>
          <p class="text-xl font-semibold leading-tight text-(--ui-text)">
            {{ selectedLabel }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">{{ selectedDateLabel }}</p>
          <p
            v-if="selectedBlock"
            class="text-xs font-semibold text-secondary-500 dark:text-secondary-400"
          >
            {{ selectedCountLabel }}
          </p>
        </div>

        <div
          ref="scrubber"
          class="relative flex-1 cursor-pointer select-none"
          style="min-height: 280px"
          @pointerdown="onPointerDown"
          @wheel.passive="onWheel"
        >
          <div class="relative mx-0 h-full w-12">
            <template v-for="(tick, index) in ticks" :key="`tick-${index}`">
              <div
                class="absolute left-0"
                :class="tickClass(tick.type)"
                :style="{ top: tick.position + '%' }"
              >
                <span
                  v-if="tick.label"
                  class="pointer-events-none absolute left-14 w-14 top-1/2 -translate-y-1/2 text-[10px] font-medium text-(--ui-text-muted)"
                >
                  {{ tick.label }}
                </span>
              </div>

              <div
                v-if="histogramData[index]"
                class="absolute left-0 h-1 rounded-r-full bg-linear-to-r from-primary-500/85 to-secondary-400/80 shadow-[0_0_12px_rgba(24,184,166,0.45)]"
                :style="{
                  top: `${tick.position}%`,
                  width: `${histogramData[index].widthPercentage}%`,
                  height: `${histogramHeight}%`,
                }"
              ></div>
            </template>
          </div>

          <div
            class="pointer-events-none absolute inset-x-0"
            :style="{
              top: `${selectedRatio * 100}%`,
              height: `${histogramHeight}%`,
            }"
          >
            <div class="flex h-full w-full items-center justify-end gap-2 pr-1 relative">
              <span class="h-1/4 w-full rounded-full bg-secondary/70 absolute"></span>
              <!-- handle -->
              <span
                class="flex -mr-4 z-10 h-5 w-10 items-center justify-center rounded-full border border-secondary/70 bg-secondary font-semibold text-[#0b172c]"
              >
                <UIcon name="i-heroicons-bars-3" class="text-black/80" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <UButton
      class="map-control-btn map-control-fab pointer-events-auto cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
      @click="toggleScrubber"
      type="button"
      aria-label="Toggle timeline"
    >
      <transition name="slide" mode="out-in">
        <UIcon v-if="!open" name="i-heroicons-clock" class="size-6" />
        <UIcon v-else name="i-heroicons-x-mark" class="size-6" />
      </transition>
    </UButton>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.1s ease,
    opacity 0.1s ease;
}
.slide-enter-from {
  transform: translateX(20px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
.slide-enter-to,
.slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.glass {
  overflow: hidden;
  position: relative;
}
</style>
