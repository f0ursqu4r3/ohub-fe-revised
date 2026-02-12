import { ref, computed, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useOutageStore } from '@/stores/outages'
import { PLAYBACK_BASE_INTERVAL_MS } from '@/config/map'

export function usePlayback() {
  const outageStore = useOutageStore()
  const { selectedOutageTs, blocks } = storeToRefs(outageStore)

  const isPlaying = ref(false)
  const playbackSpeed = ref(1)
  const playbackIntervalId = ref<number | null>(null)

  const currentBlockIndex = computed(() => {
    if (selectedOutageTs.value === null) return -1
    return blocks.value.findIndex((b) => b.ts === selectedOutageTs.value)
  })

  const canPlayForward = computed(() => currentBlockIndex.value < blocks.value.length - 1)
  const canPlayBackward = computed(() => currentBlockIndex.value > 0)

  const stepForward = () => {
    const idx = currentBlockIndex.value
    const nextBlock = blocks.value[idx + 1]
    if (idx < blocks.value.length - 1 && nextBlock) {
      outageStore.selectedOutageTs = nextBlock.ts
    } else {
      stopPlayback()
    }
  }

  const stepBackward = () => {
    const idx = currentBlockIndex.value
    const prevBlock = blocks.value[idx - 1]
    if (idx > 0 && prevBlock) {
      outageStore.selectedOutageTs = prevBlock.ts
    } else {
      stopPlayback()
    }
  }

  const startPlayback = (direction: 'forward' | 'backward' = 'forward') => {
    if (playbackIntervalId.value) {
      stopPlayback()
    }

    isPlaying.value = true
    const intervalMs = PLAYBACK_BASE_INTERVAL_MS / playbackSpeed.value

    playbackIntervalId.value = window.setInterval(() => {
      if (direction === 'forward') {
        if (canPlayForward.value) {
          stepForward()
        } else {
          stopPlayback()
        }
      } else {
        if (canPlayBackward.value) {
          stepBackward()
        } else {
          stopPlayback()
        }
      }
    }, intervalMs)
  }

  const stopPlayback = () => {
    if (playbackIntervalId.value) {
      clearInterval(playbackIntervalId.value)
      playbackIntervalId.value = null
    }
    isPlaying.value = false
  }

  const togglePlayback = () => {
    if (isPlaying.value) {
      stopPlayback()
    } else {
      startPlayback('forward')
    }
  }

  const cycleSpeed = () => {
    const speeds = [0.5, 1, 2] as const
    const currentIdx = speeds.indexOf(playbackSpeed.value as 0.5 | 1 | 2)
    playbackSpeed.value = speeds[(currentIdx + 1) % speeds.length] ?? 1

    if (isPlaying.value) {
      startPlayback('forward')
    }
  }

  onBeforeUnmount(() => {
    stopPlayback()
  })

  return {
    isPlaying,
    playbackSpeed,
    canPlayForward,
    canPlayBackward,
    stepForward,
    stepBackward,
    togglePlayback,
    cycleSpeed,
    stopPlayback,
  }
}
