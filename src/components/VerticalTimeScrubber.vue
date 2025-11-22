<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'

const outageStore = useOutageStore()
const { selectedOutageTs, blocks, maxCount } = storeToRefs(outageStore)

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

const ticks = computed(() => {
  const tickArray: Array<{ position: number; label: string; type: TickType }> = []
  const blocksArr = blocks.value
  const total = blocksArr.length

  for (let i = 0; i < total; i++) {
    const block = blocksArr[i]
    if (!block) continue
    const position = total > 1 ? (i / (total - 1)) * 100 : 0
    let label = ''
    let type: TickType = 'level-3'

    const date = new Date(block.ts * 1000)

    if (date.getHours() === 0 && date.getMinutes() === 0) {
      label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      type = 'level-1'
    } else if (date.getMinutes() === 0) {
      if (date.getHours() === 12) {
        type = 'level-2'
      }
    }

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
</script>

<template>
  <div class="h-full">
    <div
      class="scrubber-panel glass flex h-full w-32 flex-col gap-6 border border-black/15 bg-white/10 p-4 text-black shadow-2xl shadow-black/40 backdrop-blur-sm transition-all duration-500 ease-out touch-none select-none"
      :class="[
        open
          ? 'translate-x-0 opacity-100'
          : '-translate-x-32 opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:translate-x-0',
        $attrs.class,
      ]"
    >
      <div class="space-y-1 text-right">
        <p class="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/60">Selected</p>
        <p class="text-xl font-semibold leading-tight text-black">{{ selectedLabel }}</p>
        <p class="text-xs text-black/60">{{ selectedDateLabel }}</p>
        <p v-if="selectedBlock" class="text-xs font-semibold text-amber-900">
          {{ selectedCountLabel }}
        </p>
      </div>

      <div
        ref="scrubber"
        class="relative flex-1"
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
                class="pointer-events-none absolute left-14 w-14 top-1/2 -translate-y-1/2 text-[10px] font-medium text-white/70"
              >
                {{ tick.label }}
              </span>
            </div>

            <div
              v-if="histogramData[index]"
              class="absolute left-0 h-1 rounded-r-full bg-linear-to-r from-rose-400/80 via-orange-300/80 to-amber-200/80 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
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
            <span class="h-1/4 w-full rounded-full bg-white/70 absolute"></span>
            <!-- handle -->
            <span
              class="flex z-10 h-5 w-10 items-center justify-center rounded-full border border-white/70 bg-white font-semibold"
            >
              <UIcon name="i-heroicons-bars-3" class="text-black/80" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <button
      class="btn btn-circle absolute bottom-4 border border-white/40 bg-white/90 p-2 text-slate-900 shadow-lg shadow-black/30 transition-all duration-300"
      :class="[open ? 'left-36' : 'left-4']"
      @click="toggleScrubber"
      type="button"
      aria-label="Toggle timeline"
    >
      <transition name="slide" mode="out-in">
        <UIcon v-if="!open" name="i-heroicons-clock" class="size-6" />
        <UIcon v-else name="i-heroicons-x-mark" class="size-6" />
      </transition>
    </button>
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

.glass::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/noise.svg');
  background-size: initial;
  background-position: center;
  background-repeat: repeat;
  opacity: 0.4;
  mix-blend-mode: screen;
  filter: brightness(1.5) contrast(1.5) grayscale(1);
}
</style>
