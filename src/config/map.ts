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
export const CIRCLE_MARKER_THRESHOLD = 150

/** Debounce delay (ms) for marker rendering during rapid updates */
export const MARKER_RENDER_DEBOUNCE_MS = 80

// ─────────────────────────────────────────────────────────────
// Popup & Tooltip
// ─────────────────────────────────────────────────────────────
/** Maximum items to show in popup before showing "+X more" */
export const POPUP_MAX_ITEMS = 6

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
    brand: cssVar('--color-primary-500'),
    brandDark: cssVar('--color-primary-600'),
    brandFill: hexToRgba(cssVar('--color-primary-500'), 0.18),
    highlight: cssVar('--color-secondary-400'),
    highlightFill: hexToRgba(cssVar('--color-secondary-400'), 0.25),
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
