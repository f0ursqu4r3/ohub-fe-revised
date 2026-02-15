import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  ComplianceSummary,
  ComplianceBucket,
  ProviderSummary,
  ProvidersResponse,
  ProviderDirectoryItem,
  WorkerRun,
  DirtyBucketsResponse,
  Granularity,
} from '@/types/analytics'

export const useAnalyticsStore = defineStore('analytics', () => {
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  // State
  const summaries = ref<ComplianceSummary[]>([])
  const providers = ref<ProviderSummary[]>([])
  const allSummary = ref<ComplianceSummary | null>(null)
  const series = ref<ComplianceBucket[]>([])
  const seriesByProvider = ref<Map<string, ComplianceBucket[]>>(new Map())
  const loadingProviders = ref<Set<string>>(new Set())
  const providerDirectory = ref<Map<string, ProviderDirectoryItem>>(new Map())
  const workerRun = ref<WorkerRun | null>(null)
  const dirtyBuckets = ref<DirtyBucketsResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Filters
  const selectedGranularity = ref<Granularity>('day')

  // AbortController for cancelling in-flight series requests
  let seriesAbort: AbortController | null = null

  // Derived: true when any provider is still loading
  const isLoadingSeries = computed(() => loadingProviders.value.size > 0)

  const fetchSummaries = async () => {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`${baseUrl}/v1/norm-compliance/summary`)
      if (!response.ok) throw new Error('Failed to fetch compliance summaries')
      const data = await response.json()
      summaries.value = data.summaries
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const fetchProviders = async () => {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`${baseUrl}/v1/norm-compliance/providers`)
      if (!response.ok) throw new Error('Failed to fetch providers')
      const data: ProvidersResponse = await response.json()
      providers.value = data.providers
      allSummary.value = data.allSummary
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const fetchProviderDirectory = async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/providers/directory`)
      if (!response.ok) throw new Error('Failed to fetch provider directory')
      const data: { providers: ProviderDirectoryItem[] } = await response.json()
      const map = new Map<string, ProviderDirectoryItem>()
      for (const p of data.providers) map.set(p.name, p)
      providerDirectory.value = map
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    }
  }

  const fetchSeries = async (params: {
    provider: string
    granularity: Granularity
    since?: number
    until?: number
  }) => {
    isLoading.value = true
    error.value = null
    try {
      const searchParams = new URLSearchParams({
        provider: params.provider,
        granularity: params.granularity,
      })
      if (params.since != null) searchParams.set('since', params.since.toString())
      if (params.until != null) searchParams.set('until', params.until.toString())

      const response = await fetch(
        `${baseUrl}/v1/norm-compliance/series?${searchParams.toString()}`,
      )
      if (!response.ok) throw new Error('Failed to fetch compliance series')
      const data = await response.json()
      series.value = data.buckets ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const fetchProviderSeries = async (
    provider: string,
    granularity: Granularity,
    signal?: AbortSignal,
  ) => {
    loadingProviders.value = new Set([...loadingProviders.value, provider])
    try {
      const searchParams = new URLSearchParams({ provider, granularity })
      const response = await fetch(
        `${baseUrl}/v1/norm-compliance/series?${searchParams.toString()}`,
        { signal },
      )
      if (!response.ok) throw new Error(`Failed to fetch series for ${provider}`)
      const data = await response.json()
      const updated = new Map(seriesByProvider.value)
      updated.set(provider, data.buckets ?? [])
      seriesByProvider.value = updated
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      const next = new Set(loadingProviders.value)
      next.delete(provider)
      loadingProviders.value = next
    }
  }

  const fetchAllSeries = async (granularity: Granularity) => {
    // Cancel any in-flight series requests
    if (seriesAbort) seriesAbort.abort()
    seriesAbort = new AbortController()
    const { signal } = seriesAbort

    seriesByProvider.value = new Map()
    const providerNames = ['__all__', ...providers.value.map((p) => p.provider)]
    loadingProviders.value = new Set(providerNames)

    // Concurrency-limited fetching (6 at a time instead of all at once)
    const concurrency = 6
    let idx = 0
    const next = async (): Promise<void> => {
      while (idx < providerNames.length) {
        const i = idx++
        await fetchProviderSeries(providerNames[i]!, granularity, signal)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, providerNames.length) }, () => next()),
    )
  }

  const fetchWorkerHealth = async () => {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`${baseUrl}/v1/norm-compliance/worker`)
      if (!response.ok) throw new Error('Failed to fetch worker health')
      const data = await response.json()
      workerRun.value = data.latest
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const fetchDirtyBuckets = async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/norm-compliance/dirty`)
      if (!response.ok) throw new Error('Failed to fetch dirty buckets')
      const data: DirtyBucketsResponse = await response.json()
      dirtyBuckets.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    }
  }

  /** Cancel in-flight requests and release all cached data */
  const cleanup = () => {
    if (seriesAbort) {
      seriesAbort.abort()
      seriesAbort = null
    }
    seriesByProvider.value = new Map()
    loadingProviders.value = new Set()
    series.value = []
  }

  return {
    // State
    summaries,
    providers,
    allSummary,
    series,
    seriesByProvider,
    loadingProviders,
    providerDirectory,
    workerRun,
    dirtyBuckets,
    isLoading,
    isLoadingSeries,
    error,

    // Filters
    selectedGranularity,

    // Actions
    fetchSummaries,
    fetchProviders,
    fetchProviderDirectory,
    fetchSeries,
    fetchProviderSeries,
    fetchAllSeries,
    fetchWorkerHealth,
    fetchDirtyBuckets,
    cleanup,
  }
})
