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
    class="timeline-shell pointer-events-none fixed inset-x-0 bottom-3 md:bottom-5 flex justify-center items-end gap-3 px-3 md:px-6"
  >
    <transition name="slide-up">
      <section v-show="open" class="timeline-panel pointer-events-auto">
        <div class="panel-header">
          <div class="header-primary">
            <p class="eyebrow">Timeline scrubber</p>
            <div class="headline">
              <span class="time">{{ selectedLabel }}</span>
              <span class="dot"></span>
              <span class="date">{{ selectedDateLabel }}</span>
            </div>
            <p class="hint">Drag the beam or scroll to move through outages.</p>
          </div>
          <div class="stat-group">
            <div class="stat-card">
              <p>total events</p>
              <span class="stat-value">{{ totalEventCount.toLocaleString() }}</span>
            </div>
            <div class="stat-card ghost">
              <p>selected window</p>
              <span class="stat-value">{{ selectedBlock ? selectedCountLabel : '—' }}</span>
            </div>
          </div>
        </div>

        <div ref="scrubber" class="scrubber" @pointerdown="onPointerDown" @wheel.passive="onWheel">
          <div class="scrubber-surface">
            <div class="glow glow-a"></div>
            <div class="glow glow-b"></div>
            <div class="rail">
              <div class="rail-highlight"></div>
            </div>

            <div class="bars">
              <div
                v-for="(bar, index) in histogramData"
                :key="`bar-${index}`"
                class="bar"
                :style="{
                  left: `${bar.left}%`,
                  width: `${bar.width}%`,
                  height: `${bar.heightPercentage}%`,
                  transform: 'translateX(-50%)',
                }"
              ></div>
            </div>

            <div class="ticks">
              <div
                v-for="(tick, index) in ticks"
                :key="`tick-${index}`"
                class="tick"
                :class="tickClass(tick.type)"
                :style="{ left: tick.position + '%' }"
              >
                <span v-if="tick.label" class="tick-label">{{ tick.label }}</span>
              </div>
            </div>

            <div class="indicator" :style="{ left: `${selectedRatio * 100}%` }">
              <span class="indicator-stem"></span>
              <span class="indicator-head">
                <span class="orb"></span>
                <span class="label">Drag</span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </transition>

    <UButton
      class="pointer-events-auto size-12 mb-3 rounded-full border border-white/40 bg-white/90 px-3 py-2 text-slate-900 shadow-[0_10px_30px_rgba(5,15,29,0.28)] backdrop-blur"
      @click="toggleScrubber"
      type="button"
      aria-label="Toggle timeline"
    >
      <transition name="rise" mode="out-in">
        <UIcon v-if="!open" name="i-heroicons-clock" class="size-6 text-emerald-700" />
        <UIcon v-else name="i-heroicons-x-mark" class="size-6 text-emerald-700" />
      </transition>
    </UButton>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.28s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(14px);
}
.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}
.rise-enter-active,
.rise-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}
.rise-enter-from,
.rise-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.rise-enter-to,
.rise-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.timeline-shell {
  z-index: 50;
}

.timeline-panel {
  position: relative;
  width: 100%;
  max-width: 1180px;
  border-radius: 22px;
  padding: 18px 18px 20px;
  background:
    radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.18), transparent 32%),
    radial-gradient(circle at 90% 10%, rgba(16, 185, 129, 0.18), transparent 32%),
    linear-gradient(135deg, #0b1224 0%, #0f1d35 55%, #101b33 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 24px 60px rgba(2, 6, 23, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.timeline-panel::after {
  content: '';
  position: absolute;
  inset: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 18px;
  pointer-events: none;
}

.panel-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  z-index: 1;
  color: #e2e8f0;
}
.header-primary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.headline {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: #f8fafc;
}
.headline .time {
  font-size: 1.6rem;
  line-height: 1.2;
}
.headline .date {
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.82);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(120deg, #22d3ee, #0ea5e9);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.18);
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.32em;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.55);
}
.hint {
  font-size: 0.92rem;
  color: rgba(226, 232, 240, 0.68);
}

.stat-group {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.stat-card {
  min-width: 140px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  display: grid;
  gap: 6px;
}
.stat-card p {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.6);
}
.stat-value {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
}
.stat-card.ghost {
  background: rgba(14, 165, 233, 0.06);
  border-color: rgba(34, 211, 238, 0.2);
}

.scrubber {
  position: relative;
  margin-top: 16px;
}

.scrubber-surface {
  position: relative;
  height: 190px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.9));
  box-shadow:
    0 16px 50px rgba(2, 6, 23, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
}
.glow {
  position: absolute;
  width: 320px;
  height: 320px;
  filter: blur(60px);
  opacity: 0.8;
  pointer-events: none;
}
.glow-a {
  background: radial-gradient(circle, rgba(14, 165, 233, 0.35), transparent 50%);
  top: -120px;
  left: -60px;
}
.glow-b {
  background: radial-gradient(circle, rgba(16, 185, 129, 0.28), transparent 55%);
  bottom: -140px;
  right: -80px;
}

.rail {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 38px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.rail-highlight {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.9), rgba(16, 185, 129, 0.9));
  box-shadow: 0 0 24px rgba(34, 211, 238, 0.35);
  opacity: 0.75;
}
.scrubber-surface:hover .rail-highlight {
  opacity: 1;
}

.bars {
  position: absolute;
  inset: 18px 0 52px;
  pointer-events: none;
}
.bar {
  position: absolute;
  bottom: 0;
  min-width: 6px;
  border-radius: 10px 10px 6px 6px;
  background: linear-gradient(
    180deg,
    rgba(34, 211, 238, 0.9),
    rgba(14, 165, 233, 0.85),
    rgba(16, 185, 129, 0.8)
  );
  box-shadow:
    0 6px 14px rgba(2, 6, 23, 0.35),
    0 0 14px rgba(34, 211, 238, 0.35);
}

.ticks {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18px;
  top: 16px;
  pointer-events: none;
}
.tick {
  position: absolute;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
  color: #cbd5e1;
}
.tick-label {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.76);
  white-space: nowrap;
}
.tick-major {
  height: 22px;
  width: 2px;
  background: linear-gradient(to top, rgba(34, 211, 238, 0.8), rgba(255, 255, 255, 0.1));
}
.tick-mid {
  height: 15px;
  width: 1px;
  background: rgba(226, 232, 240, 0.4);
}
.tick-minor {
  height: 10px;
  width: 1px;
  background: rgba(226, 232, 240, 0.2);
}

.indicator {
  position: absolute;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.indicator-stem {
  width: 2px;
  height: 98px;
  background: linear-gradient(to top, rgba(34, 211, 238, 0.15), rgba(34, 211, 238, 0.9));
  box-shadow:
    0 0 18px rgba(34, 211, 238, 0.35),
    0 -6px 12px rgba(16, 185, 129, 0.18);
}
.indicator-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 700;
  color: #0b1224;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(226, 232, 240, 0.94));
  border: 1px solid rgba(34, 211, 238, 0.45);
  box-shadow:
    0 10px 20px rgba(2, 6, 23, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.orb {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, #22d3ee, #10b981);
  box-shadow:
    0 0 0 6px rgba(34, 211, 238, 0.22),
    0 0 0 10px rgba(34, 211, 238, 0.14);
}

@media (max-width: 768px) {
  .timeline-panel {
    padding: 14px 12px 16px;
    border-radius: 18px;
  }
  .stat-group {
    width: 100%;
    justify-content: space-between;
  }
  .stat-card {
    flex: 1;
  }
  .scrubber-surface {
    height: 170px;
  }
  .indicator-stem {
    height: 78px;
  }
}
</style>
