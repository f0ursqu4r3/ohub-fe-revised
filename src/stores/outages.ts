import { ref, computed, watch, type ComputedRef } from 'vue'
import { defineStore } from 'pinia'
import { useFetch } from '@vueuse/core'
import {
  TimeInterval,
  type OutageResponse,
  type Outage,
  type OutageBlock,
  type FetchOutageParams,
} from '../types/outage'

export const useOutageStore = defineStore('outages', () => {
  const baseApiUrl = import.meta.env.VITE_BASE_API_URL || ''

  const timeInterval = ref<TimeInterval>(TimeInterval.FiveMinutes)
  const startTime = ref<Date | null>(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // Default to the last 3 days
  const endTime = ref<Date | null>(new Date())
  const selectedOutageTs = ref<number | null>(null)

  const url = computed(() => {
    const url = `${baseApiUrl}/outages`
    const params = new URLSearchParams()
    params.append('timeInterval', timeInterval.value)
    if (startTime.value) {
      params.append('start', dateToEpochSeconds(startTime.value).toString())
    }
    if (endTime.value) {
      params.append('end', dateToEpochSeconds(endTime.value).toString())
    }
    return `${url}?${params.toString()}`
  })

  const {
    data,
    isFetching: loading,
    error,
    execute: refetch,
  } = useFetch(url, {
    immediate: true,
    refetch: true,
  }).json<OutageResponse>()

  const outages: ComputedRef<Outage[]> = computed(() => data.value?.outages ?? [])
  const blocks: ComputedRef<OutageBlock[]> = computed(() => {
    const raw = data.value?.blocks

    if (!raw) return []

    const iterable: OutageBlock[] = Array.isArray(raw)
      ? raw
      : raw instanceof Map
        ? Array.from(raw.values())
        : Object.values(raw as Record<string, OutageBlock>)

    return iterable
      .map((block) => ({
        ...block,
        count: block.count ?? block.indexes?.length ?? 0,
      }))
      .sort((a, b) => a.ts - b.ts)
  })
  const maxCount: ComputedRef<number> = computed(() => data.value?.maxCount ?? 0)
  const selectedBlockOutages: ComputedRef<Outage[]> = computed(() => {
    if (selectedOutageTs.value === null) return []
    const block = blocks.value.find((b) => b.ts === selectedOutageTs.value)
    if (!block) return []
    return block.indexes
      .map((index) => outages.value[index])
      .filter((o): o is Outage => o !== undefined)
      .sort((a, b) => a.startTs - b.startTs)
  })

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

  return {
    // State
    timeInterval,
    startTime,
    endTime,
    outages,
    blocks,
    maxCount,
    selectedOutageTs,
    selectedBlockOutages,
    loading,
    error,
    refetch,
    fetchOutages,
    fetchOutage,
    fetchProviders,
  }
})

function dateToEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}
