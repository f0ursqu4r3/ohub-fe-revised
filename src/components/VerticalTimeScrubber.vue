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

const selectedTime = computed<number | null>(() => {
  const total = totalTicks.value
  if (!total) return null
  const index = Math.round(selectedRatio.value * (total - 1))
  const block = blocks.value[index]
  return block ? block.ts : null
})

const selectedLabel = computed(() => {
  const ts = selectedTime.value
  if (ts === null) return '--:--'
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
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
  <!-- The scrubber component shown/hidden based on "open" state -->
  <div
    class="w-24 transition-all duration-300 h-full overflow-y-hidden touch-none bg-linear-to-r from-white/50 to-white/0 py-12 overflow-hidden glass"
    :class="{ '-translate-x-24': !open, 'translate-x-0': open, [$attrs.class]: !!$attrs.class }"
  >
    <div
      ref="scrubber"
      class="relative h-full w-full"
      @pointerdown="onPointerDown"
      @wheel.passive="onWheel"
    >
      <!-- The track with histogram and tick marks -->
      <div class="relative h-full w-10">
        <!-- Tick marks for each block (with major ticks every 24 blocks) -->
        <template v-for="(tick, index) in ticks" :key="index">
          <div
            class="absolute left-0"
            :class="tickClass(tick.type)"
            :style="{ top: tick.position + '%' }"
          >
            <span
              v-if="tick.label"
              class="pointer-events-none absolute left-12 w-12 top-1/2 -translate-y-1/2 text-[10pt] text-[#333]"
            >
              {{ tick.label }}
            </span>
          </div>

          <div
            v-if="histogramData[index]"
            class="absolute left-0 h-1 bg-[rgba(200,0,0,0.6)] transform rounded-tr-sm rounded-br-sm"
            :style="{
              top: `${tick.position}%`,
              width: `${histogramData[index].widthPercentage}%`,
              height: `${histogramHeight}%`,
            }"
          ></div>
        </template>
      </div>

      <!-- The draggable thumb -->
      <div
        class="absolute left-0 w-full pointer-events-none bg-primary"
        :style="{
          top: `${selectedRatio * 100}%`,
          height: `${histogramHeight}%`,
        }"
      >
        <div class="w-full h-full flex items-center justify-end">
          <div
            class="text-[8pt] text-[#333] whitespace-nowrap bg-primary px-1 pl-3 inv-rad inv-rad-l-2"
          >
            {{ selectedLabel }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toggle Button positioned in the lower left corner -->
  <button
    class="btn btn-circle absolute transition-all duration-300 bottom-4 bg-white border border-gray-300 p-2 shadow-md"
    :class="[open ? 'left-28' : 'left-4']"
    @click="toggleScrubber"
    type="button"
    aria-label="Toggle timeline"
  >
    <transition name="slide" mode="out-in">
      <span v-if="!open" key="clock" class="flex h-6 w-6 items-center justify-center text-gray-700">
        ⏱
      </span>
      <span v-else key="close" class="flex h-6 w-6 items-center justify-center text-gray-700">
        ×
      </span>
    </transition>
  </button>
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
