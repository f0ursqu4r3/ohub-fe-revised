<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const selectedBlock = computed(() => {
  const total = totalTicks.value
  if (!total) return null
  const index = Math.round(selectedRatio.value * (total - 1))
  return blocks.value[index] ?? null
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

const totalEventCount = computed(() =>
  blocks.value.reduce((sum, block) => sum + (block?.count ?? 0), 0),
)

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
      return 'h-[22px] w-[2px] bg-[linear-gradient(to_top,rgba(34,211,238,0.8),rgba(255,255,255,0.1))]'
    case 'level-2':
      return 'h-[15px] w-px bg-[rgba(226,232,240,0.4)]'
    case 'level-3':
    default:
      return 'h-[10px] w-px bg-[rgba(226,232,240,0.2)]'
  }
}

const histogramData = computed(() => {
  const blocksArr = blocks.value
  const total = blocksArr.length
  const widthPercentage = total > 0 ? 100 / total : 0

  return blocksArr.map((block, i) => {
    const heightPercentage = maxCount.value > 0 ? ((block.count ?? 0) / maxCount.value) * 100 : 0
    return {
      count: block.count ?? 0,
      left: total > 1 ? (i / (total - 1)) * 100 : 0,
      width: widthPercentage,
      heightPercentage,
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
  emit('timeSelected', ts)
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

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-3 md:bottom-5 flex justify-center items-end gap-2 px-3 md:px-6 z-50"
  >
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-3"
    >
      <section
        v-show="open"
        class="pointer-events-auto relative w-full max-w-[1180px] rounded-[22px] px-[18px] pb-5 pt-[18px] bg-[linear-gradient(135deg,#0b1224_0%,#0f1d35_55%,#101b33_100%)] border border-white/10 shadow-[0_24px_60px_rgba(2,6,23,0.6)] overflow-hidden"
      >
        <div
          class="pointer-events-none absolute inset-[10px_12px] rounded-[18px] border border-white/5"
        ></div>

        <div class="relative flex flex-wrap justify-between gap-4 text-slate-200">
          <div class="flex flex-col gap-1.5">
            <p class="text-[10px] tracking-[0.32em] font-bold uppercase text-slate-200/55">
              Timeline scrubber
            </p>
            <div class="flex items-center gap-2 font-bold text-slate-50">
              <span class="text-[1.6rem] leading-tight">{{ selectedLabel }}</span>
              <span
                class="h-1.5 w-1.5 rounded-full bg-linear-to-tr from-cyan-400 to-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.18)]"
              ></span>
              <span class="text-sm text-slate-200/80">{{ selectedDateLabel }}</span>
            </div>
            <p class="text-sm text-slate-200/70">
              Drag the beam or scroll to move through outages.
            </p>
          </div>

          <div class="flex items-stretch gap-2">
            <div
              class="grid min-w-[140px] gap-1.5 rounded-[14px] border border-white/10 bg-white/5 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <p class="text-[11px] uppercase tracking-widest text-slate-200/70">total events</p>
              <span class="text-lg font-bold text-slate-50">
                {{ totalEventCount.toLocaleString() }}
              </span>
            </div>
            <div
              class="grid min-w-[140px] gap-1.5 rounded-[14px] border border-cyan-200/30 bg-cyan-500/10 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              <p class="text-[11px] uppercase tracking-widest text-slate-200/70">selected window</p>
              <span class="text-lg font-bold text-slate-50">
                {{ selectedBlock ? selectedCountLabel : '—' }}
              </span>
            </div>
          </div>
        </div>

        <div class="relative mt-4">
          <div
            ref="scrubber"
            class="group relative h-[190px] cursor-pointer overflow-hidden rounded-[16px] border border-white/10 bg-linear-to-b from-slate-900/80 to-slate-900/90 px-4 shadow-[0_16px_50px_rgba(2,6,23,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
            @pointerdown="onPointerDown"
            @wheel.passive="onWheel"
          >
            <div
              class="pointer-events-none absolute -left-[60px] -top-[120px] h-80 w-[320px] opacity-80 blur-[60px] bg-[radial-gradient(circle,rgba(14,165,233,0.35),transparent_50%)]"
            ></div>
            <div
              class="pointer-events-none absolute -right-20 -bottom-[140px] h-80 w-[320px] opacity-80 blur-[60px] bg-[radial-gradient(circle,rgba(16,185,129,0.28),transparent_55%)]"
            ></div>

            <div
              class="absolute inset-x-0 bottom-[38px] h-1.5 overflow-hidden rounded-full border border-white/10 bg-white/5"
            >
              <div
                class="h-full w-full opacity-75 bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(16,185,129,0.9))] shadow-[0_0_24px_rgba(34,211,238,0.35)] transition-opacity duration-200 group-hover:opacity-100"
              ></div>
            </div>

            <div class="absolute inset-x-0 top-[18px] bottom-[52px] pointer-events-none">
              <div
                v-for="(bar, index) in histogramData"
                :key="`bar-${index}`"
                class="absolute bottom-0 min-w-1.5 rounded-[10px_10px_6px_6px] bg-[linear-gradient(180deg,rgba(34,211,238,0.9),rgba(14,165,233,0.85),rgba(16,185,129,0.8))] shadow-[0_6px_14px_rgba(2,6,23,0.35),0_0_14px_rgba(34,211,238,0.35)]"
                :style="{
                  left: `${bar.left}%`,
                  width: `${bar.width}%`,
                  height: `${bar.heightPercentage}%`,
                  transform: 'translateX(-50%)',
                }"
              ></div>
            </div>

            <div class="absolute inset-x-0 top-4 bottom-[18px] pointer-events-none">
              <div
                v-for="(tick, index) in ticks"
                :key="`tick-${index}`"
                class="absolute bottom-0 flex flex-col items-center -translate-x-1/2 text-slate-200"
                :class="tickClass(tick.type)"
                :style="{ left: tick.position + '%' }"
              >
                <span
                  v-if="tick.label"
                  class="mt-1.5 text-[11px] font-semibold text-slate-200/75 whitespace-nowrap"
                >
                  {{ tick.label }}
                </span>
              </div>
            </div>

            <div
              class="absolute bottom-4 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
              :style="{ left: `${selectedRatio * 100}%` }"
            >
              <span
                class="h-[98px] w-0.5 bg-linear-to-t from-[rgba(34,211,238,0.15)] to-[rgba(34,211,238,0.9)] shadow-[0_0_18px_rgba(34,211,238,0.35),0_-6px_12px_rgba(16,185,129,0.18)]"
              ></span>
              <span
                class="inline-flex items-center gap-2 rounded-[14px] border border-cyan-200/45 bg-linear-to-tr from-white/95 to-slate-200/90 px-3 py-2 text-[12px] font-bold text-slate-900 shadow-[0_10px_20px_rgba(2,6,23,0.35),inset_0_1px_0_rgba(255,255,255,0.9)]"
              >
                <span
                  class="h-3 w-3 rounded-full bg-linear-to-tr from-cyan-400 to-emerald-500 shadow-[0_0_0_6px_rgba(34,211,238,0.22),0_0_0_10px_rgba(34,211,238,0.14)]"
                ></span>
                <span class="uppercase tracking-[0.06em]">Drag</span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </Transition>

    <UButton
      class="pointer-events-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white/90 text-slate-900 shadow-[0_10px_30px_rgba(5,15,29,0.28)] backdrop-blur"
      @click="toggleScrubber"
      type="button"
      aria-label="Toggle timeline"
    >
      <Transition
        enter-active-class="transition ease-out duration-150"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-120"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
        mode="out-in"
      >
        <UIcon v-if="!open" name="i-heroicons-clock" class="h-6 w-6 text-emerald-700" />
        <UIcon v-else name="i-heroicons-x-mark" class="h-6 w-6 text-emerald-700" />
      </Transition>
    </UButton>
  </div>
</template>
