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
// Colors (matches theme.css brand palette)
// ─────────────────────────────────────────────────────────────
export const BRAND_COLOR = '#1ec968'
export const BRAND_COLOR_DARK = '#0fa757'
export const BRAND_FILL = 'rgba(30, 201, 104, 0.2)'
export const BRAND_HIGHLIGHT = '#ffc020'
export const BRAND_HIGHLIGHT_FILL = 'rgba(255, 192, 32, 0.3)'
export const SEARCH_COLOR = '#6366f1'
export const SEARCH_FILL = 'rgba(99, 102, 241, 0.15)'

// User Reports (secondary amber — distinct from primary green)
export const USER_REPORT_COLOR = '#f0a500'
export const USER_REPORT_CLUSTER_COLOR = '#cc7f02'
