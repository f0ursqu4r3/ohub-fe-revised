/**
 * Map configuration constants
 */

// ─────────────────────────────────────────────────────────────
// Dev Mode Logging
// ─────────────────────────────────────────────────────────────
const IS_DEV = import.meta.env.DEV

/** Log errors in development mode only */
export const logDevError = (context: string, error: unknown): void => {
  if (IS_DEV) {
    console.warn(`[MapComp] ${context}:`, error)
  }
}

// ─────────────────────────────────────────────────────────────
// Layer Visibility
// ─────────────────────────────────────────────────────────────
/** Minimum zoom level at which polygons become visible */
export const POLYGON_VISIBLE_ZOOM = 5

// ─────────────────────────────────────────────────────────────
// Performance Thresholds
// ─────────────────────────────────────────────────────────────
/** Switch to lightweight CircleMarkers when marker count exceeds this */
export const CIRCLE_MARKER_THRESHOLD = 200

/** Debounce delay (ms) for marker rendering during rapid updates */
export const MARKER_RENDER_DEBOUNCE_MS = 120

// ─────────────────────────────────────────────────────────────
// Cluster Buckets & Animation
// ─────────────────────────────────────────────────────────────
/** Fixed cluster radius (px) for pre-computed zoom buckets (single Supercluster index) */
export const CLUSTER_BUCKET_RADIUS_PX = 50

/** Duration (ms) for cluster split/merge CSS transition */
export const CLUSTER_ANIMATION_DURATION_MS = 250

/** CSS easing function for cluster split/merge transitions */
export const CLUSTER_ANIMATION_EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

// ─────────────────────────────────────────────────────────────
// Popup & Tooltip
// ─────────────────────────────────────────────────────────────
/** Maximum items to show in popup before showing "+X more" */
export const POPUP_MAX_ITEMS = 6

// ─────────────────────────────────────────────────────────────
// Progressive Outage Loading
// ─────────────────────────────────────────────────────────────
/** Duration (seconds) of each chunk when progressively loading outages */
export const OUTAGE_CHUNK_DURATION_SEC = 6 * 3600

/** Maximum concurrent chunk fetches */
export const OUTAGE_CHUNK_CONCURRENCY = 3

// ─────────────────────────────────────────────────────────────
// Playback
// ─────────────────────────────────────────────────────────────
/** Base interval (ms) for time playback (divided by speed multiplier) */
export const PLAYBACK_BASE_INTERVAL_MS = 500

// ─────────────────────────────────────────────────────────────
// Colors — resolved at runtime from CSS custom properties
// ─────────────────────────────────────────────────────────────
const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Read theme colors once the DOM is available. Call this early in app init. */
let _colors: ReturnType<typeof resolveColors> | null = null

function resolveColors() {
  return {
    brand: cssVar('--color-primary-400'),
    brandDark: cssVar('--color-primary-500'),
    brandFill: hexToRgba(cssVar('--color-primary-400'), 0.18),
    highlight: cssVar('--color-secondary-300'),
    highlightFill: hexToRgba(cssVar('--color-secondary-300'), 0.25),
    search: '#6366f1',
    searchFill: 'rgba(99, 102, 241, 0.15)',
    report: cssVar('--color-secondary-500'),
    reportCluster: cssVar('--color-secondary-600'),
  }
}

export function getMapColors() {
  if (!_colors) _colors = resolveColors()
  return _colors
}

/** Force re-resolve (e.g. after theme switch) */
export function refreshMapColors() {
  _colors = resolveColors()
}

// Legacy named exports for consumers that import individual constants
export const SEARCH_COLOR = '#6366f1'
export const SEARCH_FILL = 'rgba(99, 102, 241, 0.15)'

// ─────────────────────────────────────────────────────────────
// Weather Radar (Environment Canada MSC GeoMet WMS)
// ─────────────────────────────────────────────────────────────
/** MSC GeoMet WMS endpoint */
export const GEOMET_WMS_URL = 'https://geo.weather.gc.ca/geomet'

/** WMS radar layer — rain precipitation rate (mm/hr) */
export const GEOMET_RADAR_LAYERS = 'RADAR_1KM_RRAI'

/** How often to re-fetch available timestamps (ms) — radar updates every 6 min */
export const WEATHER_REFRESH_INTERVAL_MS = 6 * 60 * 1000

/** Default opacity for the weather radar tile overlay */
export const WEATHER_RADAR_OPACITY = 0.5

/** z-index for the custom weather pane (between tilePane=200 and overlayPane=400) */
export const WEATHER_PANE_Z_INDEX = 250

// ─────────────────────────────────────────────────────────────
// Historical Precipitation (Open-Meteo Forecast API)
// ─────────────────────────────────────────────────────────────
/** Whether to enable fetching historical precipitation data from Open-Meteo API */
export const USE_OPENMETEO_API = false

/** Open-Meteo forecast endpoint (use past_days for historical hourly data) */
export const OPENMETEO_API_URL = 'https://api.open-meteo.com/v1/forecast'

/** Grid spacing in degrees for precipitation sampling (~2° ≈ 220 km) */
export const PRECIP_GRID_SPACING_DEG = 2.0

/** Grid bounds covering southern Canada's populated corridor */
export const PRECIP_GRID_BOUNDS = { latMin: 42, latMax: 60, lngMin: -140, lngMax: -52 } as const

/** Number of grid points per Open-Meteo API batch request (Open-Meteo rejects large batches) */
export const PRECIP_API_BATCH_SIZE = 8

/** CircleMarker radius (pixels) for precipitation overlay dots */
export const PRECIP_MARKER_RADIUS = 22
