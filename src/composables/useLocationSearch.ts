import { computed, onBeforeUnmount, ref } from 'vue'
import type { MultiPolygon, Polygon } from 'geojson'
import type { BoundsLiteral } from '@/components/map/types'

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  hamlet?: string
  state?: string
  region?: string
  province?: string
  postcode?: string
}

type NominatimResult = {
  place_id?: number | string
  display_name?: string
  lat?: number | string
  lon?: number | string
  boundingbox?: Array<number | string>
  address?: NominatimAddress
  geojson?: Polygon | MultiPolygon | { type?: string }
}

export type GeocodeResult = {
  id: string
  label: string
  description: string
  fullAddress: string
  lat: number
  lon: number
  bounds: BoundsLiteral
  geometry: Polygon | MultiPolygon | null
}

const boundsFromBox = (
  boundingBox: Array<string | number>,
  lat: number,
  lon: number,
): BoundsLiteral => {
  if (boundingBox.length === 4) {
    const [southRaw, northRaw, westRaw, eastRaw] = boundingBox as [
      string | number,
      string | number,
      string | number,
      string | number,
    ]
    const south = Number(southRaw)
    const north = Number(northRaw)
    const west = Number(westRaw)
    const east = Number(eastRaw)
    if ([south, north, west, east].every((v) => Number.isFinite(v))) {
      return [
        [south, west],
        [north, east],
      ]
    }
  }
  const delta = 0.01
  return [
    [lat - delta, lon - delta],
    [lat + delta, lon + delta],
  ]
}

const parseResult = (item: NominatimResult): GeocodeResult | null => {
  const lat = Number(item.lat)
  const lon = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !item.display_name) return null

  const fullAddress = String(item.display_name)
  const title = fullAddress.split(',')[0]?.trim() || fullAddress
  const address = item.address ?? {}
  const city = address.city || address.town || address.village || address.hamlet || ''
  const province = address.state || address.region || address.province || ''
  const postal = address.postcode ? address.postcode.toUpperCase() : ''
  const parts = [city, province, postal].filter(Boolean)
  const description = parts.join(' \u2022 ') || 'Canada'
  const geometry =
    item.geojson && (item.geojson as { type?: string }).type?.includes('Polygon')
      ? (item.geojson as Polygon | MultiPolygon)
      : null
  const bounds = boundsFromBox(item.boundingbox ?? [], lat, lon)

  return {
    id: String(item.place_id ?? `${lat}-${lon}`),
    label: title,
    description,
    fullAddress,
    lat,
    lon,
    bounds,
    geometry,
  }
}

export function useLocationSearch() {
  const query = ref('')
  const results = ref<GeocodeResult[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const activeIndex = ref(-1)
  const controller = ref<AbortController | null>(null)
  let debounceId: number | null = null

  const hasQuery = computed(() => query.value.trim().length >= 3)

  const resetResults = () => {
    results.value = []
    activeIndex.value = -1
  }

  const fetchResults = async (term: string) => {
    controller.value?.abort()
    controller.value = new AbortController()
    error.value = null
    isLoading.value = true

    try {
      const params = new URLSearchParams({
        q: term,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'ca',
        polygon_geojson: '1',
      })
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en-CA' },
        signal: controller.value.signal,
      })
      if (!response.ok) {
        throw new Error(`Search failed with ${response.status}`)
      }
      const data: unknown = await response.json()
      const parsed = Array.isArray(data)
        ? data
            .map((item) => parseResult(item as NominatimResult))
            .filter((item): item is GeocodeResult => Boolean(item))
        : []
      results.value = parsed
      activeIndex.value = parsed.length ? 0 : -1
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (typeof err === 'object' && err && (err as { name?: string }).name === 'AbortError') return
      error.value = 'Unable to search right now.'
      resetResults()
    } finally {
      isLoading.value = false
    }
  }

  const scheduleSearch = (term: string) => {
    if (debounceId) clearTimeout(debounceId)

    if (!hasQuery.value) {
      resetResults()
      error.value = null
      isLoading.value = false
      return
    }

    debounceId = window.setTimeout(() => fetchResults(term), 250)
  }

  const clearSearch = () => {
    query.value = ''
    resetResults()
    error.value = null
  }

  const moveActiveIndex = (direction: 'up' | 'down') => {
    if (!results.value.length) return
    if (direction === 'down') {
      activeIndex.value = (activeIndex.value + 1) % results.value.length
    } else {
      activeIndex.value =
        activeIndex.value <= 0
          ? results.value.length - 1
          : (activeIndex.value - 1) % results.value.length
    }
  }

  onBeforeUnmount(() => {
    if (debounceId) clearTimeout(debounceId)
    controller.value?.abort()
  })

  return {
    query,
    results,
    isLoading,
    error,
    activeIndex,
    hasQuery,
    scheduleSearch,
    resetResults,
    clearSearch,
    moveActiveIndex,
  }
}
