/**
 * Weather radar overlay using Environment Canada's MSC GeoMet WMS service.
 *
 * Displays precipitation radar (RADAR_1KM_RRAI) synced to the timeline scrubber.
 * Available timestamps are fetched from the WMS GetCapabilities response so we
 * only ever request frames that actually exist on the server.
 *
 * @see https://eccc-msc.github.io/open-data/msc-data/obs_radar/readme_radar_geomet_en/
 */
import L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'
import {
  GEOMET_WMS_URL,
  GEOMET_RADAR_LAYERS,
  WEATHER_REFRESH_INTERVAL_MS,
  WEATHER_RADAR_OPACITY,
  WEATHER_PANE_Z_INDEX,
  USE_OPENMETEO_API,
  OPENMETEO_API_URL,
  PRECIP_GRID_SPACING_DEG,
  PRECIP_GRID_BOUNDS,
  PRECIP_API_BATCH_SIZE,
  PRECIP_MARKER_RADIUS,
  logDevError,
} from '../../config/map'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface UseWeatherLayerOptions {
  map: ShallowRef<L.Map | null>
  showWeather: Ref<boolean>
  /** Current scrubber timestamp (Unix seconds) from the outage store */
  selectedTs: Ref<number | null>
}

export interface WeatherLayerRefs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weatherTileLayer: Ref<any>
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Parse "start/end/step" time dimension into an array of Unix-ms timestamps */
function parseTimeDimension(dimension: string): number[] {
  const parts = dimension.trim().split('/')
  if (parts.length !== 3) return []

  const startMs = new Date(parts[0]!).getTime()
  const endMs = new Date(parts[1]!).getTime()
  const stepMs = parseISODuration(parts[2]!)

  if (isNaN(startMs) || isNaN(endMs) || stepMs <= 0) return []

  const times: number[] = []
  for (let t = startMs; t <= endMs; t += stepMs) {
    times.push(t)
  }
  return times
}

/** Parse an ISO 8601 duration like "PT6M" into milliseconds */
function parseISODuration(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

/** Format a Unix-ms timestamp as ISO 8601 for the WMS TIME param */
function toWmsTime(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z')
}

// ─────────────────────────────────────────────────────────────
// Historical Precipitation Helpers
// ─────────────────────────────────────────────────────────────

interface GridPoint {
  lat: number
  lng: number
}

/** Precipitation data: "lat,lng" → Map of "YYYY-MM-DDTHH:00" → mm */
type PrecipCache = Map<string, Map<string, number>>

/** Generate a fixed grid of sample points across southern Canada */
function generateGrid(): GridPoint[] {
  const points: GridPoint[] = []
  for (let lat = PRECIP_GRID_BOUNDS.latMin; lat <= PRECIP_GRID_BOUNDS.latMax; lat += PRECIP_GRID_SPACING_DEG) {
    for (let lng = PRECIP_GRID_BOUNDS.lngMin; lng <= PRECIP_GRID_BOUNDS.lngMax; lng += PRECIP_GRID_SPACING_DEG) {
      points.push({ lat, lng })
    }
  }
  return points
}

/** Snap a Unix-seconds timestamp to the nearest hour as "YYYY-MM-DDTHH:00" */
function snapToHour(tsSec: number): string {
  const date = new Date(tsSec * 1000)
  if (date.getMinutes() >= 30) date.setHours(date.getHours() + 1)
  date.setMinutes(0, 0, 0)
  return date.toISOString().slice(0, 13) + ':00'
}

/** Map precipitation mm to a color + opacity for the circle marker */
function precipColor(mm: number): { color: string; fillOpacity: number } {
  if (mm < 0.1) return { color: '#a0c4ff', fillOpacity: 0.15 }
  if (mm < 1.0) return { color: '#72b4ff', fillOpacity: 0.3 }
  if (mm < 5.0) return { color: '#3a8dff', fillOpacity: 0.5 }
  if (mm < 15.0) return { color: '#1a5fff', fillOpacity: 0.7 }
  return { color: '#6a0dad', fillOpacity: 0.85 }
}

// ─────────────────────────────────────────────────────────────
// GeoMet Radar Helpers
// ─────────────────────────────────────────────────────────────

/** Find the closest value in a sorted array to the target */
function findClosest(sorted: number[], target: number): number | null {
  if (!sorted.length) return null
  if (target <= sorted[0]!) return sorted[0]!
  if (target >= sorted[sorted.length - 1]!) return sorted[sorted.length - 1]!

  let lo = 0
  let hi = sorted.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < target) lo = mid + 1
    else if (sorted[mid]! > target) hi = mid - 1
    else return sorted[mid]!
  }

  // lo is the insertion point; compare neighbors
  const before = sorted[hi]!
  const after = sorted[lo]!
  return target - before <= after - target ? before : after
}

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────
export function useWeatherLayer(options: UseWeatherLayerOptions, refs: WeatherLayerRefs) {
  const { map, showWeather, selectedTs } = options
  const { weatherTileLayer } = refs

  let refreshTimer: number | null = null
  let paneCreated = false
  let activeWmsTime = ''

  /** Available radar timestamps (Unix ms), fetched from GetCapabilities */
  let availableTimes: number[] = []

  // --- Historical precipitation (Open-Meteo fallback) ---
  const gridPoints = generateGrid()
  let precipCache: PrecipCache = new Map()
  let precipFetched = false
  let precipFetching = false
  let precipLayerGroup: L.LayerGroup | null = null
  let activePrecipHour = ''
  let syncGeneration = 0

  /** Ensure the custom Leaflet pane exists for z-ordering */
  const ensurePane = () => {
    const activeMap = map.value
    if (!activeMap || paneCreated) return

    const pane = activeMap.createPane('weatherPane')
    pane.style.zIndex = String(WEATHER_PANE_Z_INDEX)
    pane.style.pointerEvents = 'none'
    paneCreated = true
  }

  /** Fetch available radar timestamps from GeoMet GetCapabilities */
  const fetchAvailableTimes = async (): Promise<boolean> => {
    try {
      const url = `${GEOMET_WMS_URL}?service=WMS&version=1.3.0&request=GetCapabilities&layer=${GEOMET_RADAR_LAYERS}`
      const response = await fetch(url)
      if (!response.ok) {
        logDevError('GeoMet GetCapabilities', `HTTP ${response.status}`)
        return false
      }

      const xml = await response.text()
      const doc = new DOMParser().parseFromString(xml, 'text/xml')

      // Find the <Dimension name="time"> element
      const dims = doc.querySelectorAll('Dimension')
      let timeDimText = ''
      for (const dim of dims) {
        if (dim.getAttribute('name') === 'time') {
          timeDimText = dim.textContent?.trim() ?? ''
          break
        }
      }

      if (!timeDimText) {
        logDevError('GeoMet GetCapabilities', 'No time dimension found')
        return false
      }

      availableTimes = parseTimeDimension(timeDimText)
      return availableTimes.length > 0
    } catch (error) {
      logDevError('GeoMet GetCapabilities fetch', error)
      return false
    }
  }

  /** Remove the current weather tile layer from the map */
  const removeLayer = () => {
    const activeMap = map.value
    if (weatherTileLayer.value) {
      if (activeMap && activeMap.hasLayer(weatherTileLayer.value)) {
        activeMap.removeLayer(weatherTileLayer.value)
      }
      weatherTileLayer.value = null
    }
  }

  /** Create a fresh WMS tile layer for the given time and add it to the map */
  const applyTime = (wmsTime: string, addToMap: boolean) => {
    if (wmsTime === activeWmsTime && weatherTileLayer.value) return

    const activeMap = map.value
    if (!activeMap) return

    ensurePane()

    // Remove old layer before creating new one
    removeLayer()

    activeWmsTime = wmsTime

    const layer = L.tileLayer.wms(`${GEOMET_WMS_URL}?`, {
      layers: GEOMET_RADAR_LAYERS,
      version: '1.3.0',
      format: 'image/png',
      transparent: true,
      opacity: WEATHER_RADAR_OPACITY,
      pane: 'weatherPane',
      attribution:
        '&copy; <a href="https://eccc-msc.github.io/open-data/licence/readme_en/">ECCC</a>',
      time: wmsTime,
    } as L.WMSOptions & { time: string })

    weatherTileLayer.value = layer

    if (addToMap) {
      layer.addTo(activeMap)
    }
  }

  /**
   * Pick the best available radar time for the current scrubber position.
   * Returns the WMS time string, or null if no matching frame exists.
   */
  const resolveRadarTime = (): string | null => {
    if (!availableTimes.length) return null

    const ts = selectedTs.value
    if (ts === null) {
      // No scrubber selection — use the latest available frame
      return toWmsTime(availableTimes[availableTimes.length - 1]!)
    }

    const scrubberMs = ts * 1000
    const oldest = availableTimes[0]!
    const newest = availableTimes[availableTimes.length - 1]!

    // Scrubber is before radar window — no radar data, fall back to Open-Meteo
    if (scrubberMs < oldest - 3 * 60 * 1000) {
      return null
    }

    // Scrubber is ahead of latest radar frame — clamp to newest available
    if (scrubberMs > newest + 3 * 60 * 1000) {
      return toWmsTime(newest)
    }

    const closest = findClosest(availableTimes, scrubberMs)
    return closest !== null ? toWmsTime(closest) : null
  }

  // ─────────────────────────────────────────────────────────────
  // Historical Precipitation (Open-Meteo fallback)
  // ─────────────────────────────────────────────────────────────

  /** Parse a single batch response into the precipitation cache */
  const parseBatchResponse = (data: unknown, batch: GridPoint[]) => {
    // Multi-location response is an array; single location is an object
    const locations = Array.isArray(data) ? data : [data]

    for (let locIdx = 0; locIdx < locations.length; locIdx++) {
      const loc = locations[locIdx]
      const point = batch[locIdx]
      if (!loc?.hourly?.time || !loc?.hourly?.precipitation || !point) continue

      const key = `${point.lat},${point.lng}`
      const hourMap = new Map<string, number>()

      for (let h = 0; h < loc.hourly.time.length; h++) {
        const timeStr: string = loc.hourly.time[h]
        const precip: number = loc.hourly.precipitation[h] ?? 0
        hourMap.set(timeStr, precip)
      }

      precipCache.set(key, hourMap)
    }
  }

  /** Fetch 3 days of hourly precipitation for all grid points */
  const fetchPrecipData = async (): Promise<boolean> => {
    if (precipFetched || precipFetching) return precipFetched
    precipFetching = true

    try {
      // Batch grid points into small groups (Open-Meteo rejects large requests)
      const batches: GridPoint[][] = []
      for (let i = 0; i < gridPoints.length; i += PRECIP_API_BATCH_SIZE) {
        batches.push(gridPoints.slice(i, i + PRECIP_API_BATCH_SIZE))
      }

      // Process in waves of 6 concurrent requests to stay within rate limits
      const CONCURRENCY = 6
      for (let w = 0; w < batches.length; w += CONCURRENCY) {
        const wave = batches.slice(w, w + CONCURRENCY)

        const results = await Promise.allSettled(
          wave.map(async (batch) => {
            const lats = batch.map((p) => p.lat.toFixed(2)).join(',')
            const lngs = batch.map((p) => p.lng.toFixed(2)).join(',')
            const url =
              `${OPENMETEO_API_URL}?` +
              `latitude=${lats}&longitude=${lngs}` +
              `&hourly=precipitation` +
              `&past_days=3&forecast_days=0&timezone=UTC`
            const res = await fetch(url)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return { data: await res.json(), batch }
          }),
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            parseBatchResponse(result.value.data, result.value.batch)
          }
        }

        // Brief pause between waves to avoid rate limits
        if (w + CONCURRENCY < batches.length) {
          await new Promise((r) => setTimeout(r, 100))
        }
      }

      precipFetched = precipCache.size > 0
      return precipFetched
    } catch (error) {
      logDevError('Open-Meteo precipitation fetch', error)
      return false
    } finally {
      precipFetching = false
    }
  }

  /** Remove the precipitation circle overlay from the map */
  const removePrecipLayer = () => {
    const activeMap = map.value
    if (precipLayerGroup) {
      if (activeMap && activeMap.hasLayer(precipLayerGroup)) {
        activeMap.removeLayer(precipLayerGroup)
      }
      precipLayerGroup = null
    }
    activePrecipHour = ''
  }

  /** Render precipitation circles for a given hour string */
  const applyPrecipHour = (hourStr: string) => {
    if (hourStr === activePrecipHour && precipLayerGroup) return

    const activeMap = map.value
    if (!activeMap) return

    ensurePane()
    removePrecipLayer()
    activePrecipHour = hourStr

    const group = L.layerGroup()

    for (const point of gridPoints) {
      const key = `${point.lat},${point.lng}`
      const hourMap = precipCache.get(key)
      if (!hourMap) continue

      const mm = hourMap.get(hourStr) ?? 0
      if (mm < 0.1) continue

      const { color, fillOpacity } = precipColor(mm)

      L.circleMarker([point.lat, point.lng], {
        radius: PRECIP_MARKER_RADIUS,
        color: 'transparent',
        fillColor: color,
        fillOpacity,
        weight: 0,
        pane: 'weatherPane',
        interactive: false,
      }).addTo(group)
    }

    precipLayerGroup = group

    if (showWeather.value) {
      group.addTo(activeMap)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Sync / Visibility / Lifecycle
  // ─────────────────────────────────────────────────────────────

  /** Sync the weather overlay to the current scrubber timestamp */
  const syncToTimestamp = async () => {
    const gen = ++syncGeneration
    const activeMap = map.value
    if (!activeMap) return

    const wmsTime = resolveRadarTime()

    if (wmsTime !== null) {
      // GeoMet radar is available — use high-fidelity WMS tiles
      removePrecipLayer()
      applyTime(wmsTime, showWeather.value)
      return
    }

    // Outside radar window — fall back to Open-Meteo historical precipitation
    removeLayer()

    if (!USE_OPENMETEO_API) {
      removePrecipLayer()
      return
    }

    const ts = selectedTs.value
    if (ts === null) {
      removePrecipLayer()
      return
    }

    // Lazy-fetch precipitation data on first need
    if (!precipFetched) {
      const ok = await fetchPrecipData()
      if (!ok || gen !== syncGeneration) return // stale or failed
    }

    if (gen !== syncGeneration) return // another sync superseded us

    const hourStr = snapToHour(ts)
    applyPrecipHour(hourStr)
  }

  /** Toggle layer visibility */
  const setVisible = (visible: boolean) => {
    const activeMap = map.value
    if (!activeMap) return

    if (visible) {
      syncToTimestamp()
    } else {
      if (weatherTileLayer.value && activeMap.hasLayer(weatherTileLayer.value)) {
        activeMap.removeLayer(weatherTileLayer.value)
      }
      if (precipLayerGroup && activeMap.hasLayer(precipLayerGroup)) {
        activeMap.removeLayer(precipLayerGroup)
      }
    }
  }

  /** Force WMS tile layer to redraw after zoom */
  const onZoomEnd = () => {
    if (weatherTileLayer.value && showWeather.value && weatherTileLayer.value._map) {
      weatherTileLayer.value.redraw()
    }
  }

  /** Initialize: fetch available times, create layer, start refresh timer */
  const initWeatherLayer = async () => {
    // Attach zoom handler so WMS tiles refresh at new zoom levels
    map.value?.on('zoomend', onZoomEnd)

    try {
      const ok = await fetchAvailableTimes()
      if (ok) syncToTimestamp()
    } catch (error) {
      logDevError('Weather layer init', error)
    }

    // Refresh available times periodically so the latest frame stays current
    refreshTimer = window.setInterval(async () => {
      try {
        const ok = await fetchAvailableTimes()
        if (ok) syncToTimestamp()
      } catch (error) {
        logDevError('Weather layer refresh', error)
      }
    }, WEATHER_REFRESH_INTERVAL_MS)
  }

  /** Cleanup: remove all layers and stop timers */
  const cleanup = () => {
    map.value?.off('zoomend', onZoomEnd)
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    if (weatherTileLayer.value) {
      weatherTileLayer.value.remove()
      weatherTileLayer.value = null
    }
    removePrecipLayer()
    activeWmsTime = ''
    availableTimes = []
    precipCache = new Map()
    precipFetched = false
    activePrecipHour = ''
  }

  return {
    initWeatherLayer,
    syncToTimestamp,
    setVisible,
    cleanup,
  }
}
