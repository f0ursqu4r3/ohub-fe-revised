import { ref, shallowRef, computed, watch, type ComputedRef } from 'vue'
import { defineStore } from 'pinia'
import {
  TimeInterval,
  type OutageResponse,
  type Outage,
  type OutageBlock,
  type FetchOutageParams,
} from '../types/outage'
import {
  OUTAGE_CHUNK_DURATION_SEC,
  OUTAGE_CHUNK_CONCURRENCY,
} from '../config/map'

// ─── Internal merge state (not reactive — mutated during chunk merging) ───
interface AccumulatedState {
  outages: Outage[]
  idToIndex: Map<number, number>
  blocksByTs: Map<number, OutageBlock>
  maxCount: number
}

function createAccumulatedState(): AccumulatedState {
  return { outages: [], idToIndex: new Map(), blocksByTs: new Map(), maxCount: 0 }
}

/**
 * Merge a chunk response into accumulated state.
 * Deduplicates outages by id and remaps block indexes to global positions.
 */
function mergeChunk(state: AccumulatedState, response: OutageResponse): void {
  const localToGlobal = new Map<number, number>()

  for (let localIdx = 0; localIdx < response.outages.length; localIdx++) {
    const outage = response.outages[localIdx]!
    const existing = state.idToIndex.get(outage.id)
    if (existing !== undefined) {
      localToGlobal.set(localIdx, existing)
    } else {
      const globalIdx = state.outages.length
      state.outages.push(outage)
      state.idToIndex.set(outage.id, globalIdx)
      localToGlobal.set(localIdx, globalIdx)
    }
  }

  const rawBlocks: OutageBlock[] = Array.isArray(response.blocks)
    ? response.blocks
    : response.blocks instanceof Map
      ? Array.from(response.blocks.values())
      : Object.values(response.blocks as Record<string, OutageBlock>)

  for (const block of rawBlocks) {
    const remapped = block.indexes
      .map((i) => localToGlobal.get(i))
      .filter((i): i is number => i !== undefined)

    const existing = state.blocksByTs.get(block.ts)
    if (existing) {
      const merged = new Set([...existing.indexes, ...remapped])
      existing.indexes = Array.from(merged)
      existing.count = existing.indexes.length
    } else {
      state.blocksByTs.set(block.ts, {
        ts: block.ts,
        indexes: remapped,
        count: remapped.length,
      })
    }
  }

  state.maxCount = 0
  for (const block of state.blocksByTs.values()) {
    if ((block.count ?? 0) > state.maxCount) state.maxCount = block.count ?? 0
  }
}

/** Convert a TimeInterval enum value to seconds */
function intervalToSeconds(iv: TimeInterval): number {
  switch (iv) {
    case TimeInterval.OneMinute: return 60
    case TimeInterval.FiveMinutes: return 300
    case TimeInterval.FifteenMinutes: return 900
    case TimeInterval.ThirtyMinutes: return 1800
    case TimeInterval.OneHour: return 3600
    case TimeInterval.OneDay: return 86400
    case TimeInterval.SevenDays: return 604800
    case TimeInterval.ThirtyDays: return 2592000
    case TimeInterval.OneYear: return 31536000
    default: return 900
  }
}

/**
 * Ensure blocks exist for the full time range so the timeline extends to "now".
 * Inserts empty blocks (count=0) for any missing interval-aligned timestamps.
 */
function padBlocks(state: AccumulatedState, startEpoch: number, endEpoch: number, stepSec: number): void {
  const alignedStart = Math.ceil(startEpoch / stepSec) * stepSec
  for (let t = alignedStart; t <= endEpoch; t += stepSec) {
    if (!state.blocksByTs.has(t)) {
      state.blocksByTs.set(t, { ts: t, indexes: [], count: 0 })
    }
  }
}

/**
 * Split a time range into chunks ordered by proximity to an anchor timestamp.
 * The chunk containing the anchor is returned first, then alternating outward.
 */
function computeChunks(
  startEpoch: number,
  endEpoch: number,
  anchorTs: number,
  chunkDuration: number = OUTAGE_CHUNK_DURATION_SEC,
): { start: number; end: number }[] {
  const chunks: { start: number; end: number }[] = []
  for (let t = startEpoch; t < endEpoch; t += chunkDuration) {
    chunks.push({ start: t, end: Math.min(t + chunkDuration, endEpoch) })
  }
  if (!chunks.length) return []

  let priorityIdx = chunks.findIndex((c) => anchorTs >= c.start && anchorTs < c.end)
  if (priorityIdx === -1) priorityIdx = chunks.length - 1

  const ordered: typeof chunks = [chunks[priorityIdx]!]
  for (let offset = 1; ordered.length < chunks.length; offset++) {
    if (priorityIdx + offset < chunks.length) ordered.push(chunks[priorityIdx + offset]!)
    if (priorityIdx - offset >= 0) ordered.push(chunks[priorityIdx - offset]!)
  }
  return ordered
}

// ─── Store ───────────────────────────────────────────────────

export const useOutageStore = defineStore('outages', () => {
  const baseApiUrl = import.meta.env.VITE_BASE_API_URL || ''

  const interval = ref<TimeInterval>(TimeInterval.FifteenMinutes)
  const startTime = ref<Date | null>(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
  const endTime = ref<Date | null>(new Date())
  const selectedOutageTs = ref<number | null>(null)
  const selectedProvider = ref<string | null>(null)
  const providers = ref<string[]>([])

  // ─── Accumulated state (reactive snapshots updated after each chunk) ───
  const accOutages = shallowRef<Outage[]>([])
  const accBlocks = shallowRef<OutageBlock[]>([])
  const accMaxCount = ref(0)
  const chunksLoaded = ref(0)
  const chunksTotal = ref(0)
  const priorityChunkLoaded = ref(false)
  const isLoadingChunks = ref(false)
  const error = ref<string | null>(null)

  let _state = createAccumulatedState()
  let _chunksAbort: AbortController | null = null

  /** Loading is true only until the priority (first) chunk arrives */
  const loading = computed(() => isLoadingChunks.value && !priorityChunkLoaded.value)

  /** Progress 0→1 for optional UI indicators */
  const loadingProgress = computed(() =>
    chunksTotal.value > 0 ? chunksLoaded.value / chunksTotal.value : 0,
  )

  // ─── Derived state (same API surface as before) ───
  const outages: ComputedRef<Outage[]> = computed(() => accOutages.value)

  const blocks: ComputedRef<OutageBlock[]> = computed(() => accBlocks.value)

  const filteredBlocks: ComputedRef<OutageBlock[]> = computed(() => {
    if (!selectedProvider.value) return blocks.value
    const provider = selectedProvider.value
    return blocks.value.map((block) => {
      const count = block.indexes.filter(
        (i) => outages.value[i]?.provider === provider,
      ).length
      return { ...block, count }
    })
  })

  const maxCount: ComputedRef<number> = computed(() => {
    if (selectedProvider.value) {
      return Math.max(0, ...filteredBlocks.value.map((b) => b.count ?? 0))
    }
    return accMaxCount.value
  })

  const selectedBlockOutages: ComputedRef<Outage[]> = computed(() => {
    if (selectedOutageTs.value === null) return []
    const block = blocks.value.find((b) => b.ts === selectedOutageTs.value)
    if (!block) return []
    let result = block.indexes
      .map((index) => outages.value[index])
      .filter((o): o is Outage => o !== undefined)
    if (selectedProvider.value) {
      result = result.filter((o) => o.provider === selectedProvider.value)
    }
    return result.sort((a, b) => a.startTs - b.startTs)
  })

  // ─── Progressive chunk loading ────────────────────────────

  const loadChunks = async () => {
    if (_chunksAbort) _chunksAbort.abort()
    _chunksAbort = new AbortController()
    const { signal } = _chunksAbort

    // Reset
    _state = createAccumulatedState()
    accOutages.value = []
    accBlocks.value = []
    accMaxCount.value = 0
    chunksLoaded.value = 0
    priorityChunkLoaded.value = false
    isLoadingChunks.value = true
    error.value = null

    if (!startTime.value || !endTime.value) {
      isLoadingChunks.value = false
      return
    }

    const startEpoch = dateToEpochSeconds(startTime.value)
    const endEpoch = dateToEpochSeconds(endTime.value)
    const stepSec = intervalToSeconds(interval.value)
    const anchor = selectedOutageTs.value ?? endEpoch
    const chunks = computeChunks(startEpoch, endEpoch, anchor)
    chunksTotal.value = chunks.length

    if (!chunks.length) {
      isLoadingChunks.value = false
      return
    }

    // Concurrency-limited fetch (same pattern as analytics.ts)
    let idx = 0
    const next = async (): Promise<void> => {
      while (idx < chunks.length) {
        const chunk = chunks[idx++]!
        if (signal.aborted) return

        try {
          const params = new URLSearchParams({
            interval: interval.value,
            start: chunk.start.toString(),
            end: chunk.end.toString(),
          })
          const res = await fetch(`${baseApiUrl}/outages?${params}`, { signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data: OutageResponse = await res.json()

          if (signal.aborted) return

          mergeChunk(_state, data)
          padBlocks(_state, startEpoch, endEpoch, stepSec)

          // Snapshot to reactive refs
          accOutages.value = [..._state.outages]
          accBlocks.value = Array.from(_state.blocksByTs.values()).sort(
            (a, b) => a.ts - b.ts,
          )
          accMaxCount.value = _state.maxCount
          chunksLoaded.value++
          if (chunksLoaded.value === 1) priorityChunkLoaded.value = true
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          console.warn('[OutageStore] Chunk fetch failed:', err)
        }
      }
    }

    try {
      await Promise.all(
        Array.from(
          { length: Math.min(OUTAGE_CHUNK_CONCURRENCY, chunks.length) },
          () => next(),
        ),
      )
    } finally {
      if (!signal.aborted) {
        isLoadingChunks.value = false
      }
    }
  }

  const refetch = () => loadChunks()

  /** Refresh time range to "now" if stale (e.g. after route navigation) */
  const refreshTimeRange = () => {
    const now = Date.now()
    const current = endTime.value?.getTime() ?? 0
    if (now - current > 60_000) {
      endTime.value = new Date(now)
      startTime.value = new Date(now - 3 * 24 * 60 * 60 * 1000)
    }
  }

  // Trigger chunk loading when time range or interval changes
  watch([startTime, endTime, interval], () => loadChunks(), { immediate: true })

  // ─── Auto-select last block when blocks first arrive ──────

  watch(
    [blocks, selectedOutageTs],
    ([blockList, selected]) => {
      if (!blockList.length) {
        if (selected !== null) selectedOutageTs.value = null
        return
      }

      if (selected === null) {
        const lastBlock = blockList[blockList.length - 1]
        if (lastBlock) {
          selectedOutageTs.value = lastBlock.ts
        }
      }
    },
    { immediate: true },
  )

  // ─── One-off fetch helpers (unchanged) ────────────────────

  const fetchOutages = async (params: FetchOutageParams): Promise<Response> => {
    const fetchUrl = new URL(`${baseApiUrl}/outages`)
    if (params.since) {
      fetchUrl.searchParams.append('start', params.since.toString())
    }
    if (params.until) {
      fetchUrl.searchParams.append('end', params.until.toString())
    }
    if (params.provider) {
      fetchUrl.searchParams.append('provider', params.provider)
    }
    return fetch(fetchUrl.toString())
  }

  const fetchOutage = async (id: string): Promise<Response> => {
    const fetchUrl = new URL(`${baseApiUrl}/outages/${id}`)
    return fetch(fetchUrl.toString())
  }

  const fetchProviders = async (): Promise<Response> => {
    const fetchUrl = new URL(`${baseApiUrl}/v1/providers`)
    return fetch(fetchUrl.toString())
  }

  const loadProviders = async () => {
    try {
      const res = await fetchProviders()
      if (res.ok) {
        const data = await res.json()
        providers.value = (data.providers as string[]).sort((a, b) => a.localeCompare(b))
      }
    } catch {
      // silently fail — provider list is non-critical
    }
  }

  return {
    // State
    timeInterval: interval,
    startTime,
    endTime,
    outages,
    blocks: filteredBlocks,
    maxCount,
    selectedOutageTs,
    selectedBlockOutages,
    selectedProvider,
    providers,
    loading,
    loadingProgress,
    error,
    refetch,
    refreshTimeRange,
    fetchOutages,
    fetchOutage,
    fetchProviders,
    loadProviders,
  }
})

function dateToEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}
