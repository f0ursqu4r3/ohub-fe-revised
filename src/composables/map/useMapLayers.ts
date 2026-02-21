import L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { wktToGeoJSON } from '@/lib/utils'
import type { Outage } from '@/types/outage'
import type {
  MarkerData,
  PolygonData,
  ReportMarkerData,
} from '../../components/map/types'
import {
  POLYGON_VISIBLE_ZOOM,
  CIRCLE_MARKER_THRESHOLD,
  MARKER_RENDER_DEBOUNCE_MS,
  getMapColors,
  SEARCH_COLOR,
  SEARCH_FILL,
  logDevError,
} from '../../config/map'

// Re-export constants for consumers
export { POLYGON_VISIBLE_ZOOM, SEARCH_COLOR, SEARCH_FILL, getMapColors }

// ─────────────────────────────────────────────────────────────
// Icon Factories
// ─────────────────────────────────────────────────────────────
const BOLT_PATH =
  'M293.33,59.58V168c0,13.25,10.75,24,24,24h36.85c13.25,0,24,10.75,24,24a24,24,0,0,1-4.27,13.67L230.53,436.68c-7.55,10.9-22.5,13.61-33.4,6.06a24,24,0,0,1-10.33-19.77l.16-97.93a24,24,0,0,0-23.56-24.04h-38.34c-13.25,0-24-10.75-24-24a24,24,0,0,1,4-13.27L249.34,46.31c7.33-11.04,22.22-14.06,33.27-6.73a24,24,0,0,1,10.73,20Z'

const boltSvg = (cls: string) =>
  `<svg class="${cls}" viewBox="96 28 288 428" xmlns="http://www.w3.org/2000/svg"><path d="${BOLT_PATH}"/></svg>`

let _cachedMarkerIcon: L.DivIcon | null = null
export const createMarkerIcon = (): L.DivIcon => {
  if (_cachedMarkerIcon) return _cachedMarkerIcon
  _cachedMarkerIcon = L.divIcon({
    html: `
      <div class="marker-pulse"></div>
      ${boltSvg('marker-bolt')}
    `,
    className: 'map-marker',
    iconSize: [22, 28],
    iconAnchor: [11, 14],
    popupAnchor: [0, -14],
  })
  return _cachedMarkerIcon
}

const ICON_CACHE_MAX = 64
const _clusterIconCache = new Map<number, L.DivIcon>()
export const createClusterIcon = (count: number): L.DivIcon => {
  const cached = _clusterIconCache.get(count)
  if (cached) return cached
  const sizeClass = count >= 100 ? 'xl' : count >= 20 ? 'lg' : count >= 5 ? 'md' : 'sm'

  const icon = L.divIcon({
    html: `
      <div class="marker-pulse"></div>
      ${boltSvg('marker-bolt')}
      <div class="cluster-badge"><span>${count}</span></div>
    `,
    className: `map-marker map-cluster map-cluster--${sizeClass}`,
    iconSize: [22, 28],
    iconAnchor: [11, 14],
    popupAnchor: [0, -14],
  })
  _clusterIconCache.set(count, icon)
  // Evict oldest entry when cache exceeds limit
  if (_clusterIconCache.size > ICON_CACHE_MAX) {
    const firstKey = _clusterIconCache.keys().next().value
    if (firstKey !== undefined) _clusterIconCache.delete(firstKey)
  }
  return icon
}

let _cachedSearchIcon: L.DivIcon | null = null
export const createSearchIcon = (): L.DivIcon => {
  if (_cachedSearchIcon) return _cachedSearchIcon
  _cachedSearchIcon = L.divIcon({
    html: `
      <div class="search-marker-ring"></div>
      <div class="search-marker-dot"></div>
    `,
    className: 'map-search-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
  return _cachedSearchIcon
}

// ─────────────────────────────────────────────────────────────
// CircleMarker Factories (lightweight, for large datasets)
// ─────────────────────────────────────────────────────────────
export const getCircleMarkerRadius = (count: number): number => {
  if (count >= 100) return 14
  if (count >= 20) return 11
  if (count >= 5) return 9
  return count > 1 ? 7 : 6
}

export const createCircleMarkerOptions = (count: number): L.CircleMarkerOptions => {
  const c = getMapColors()
  return {
    radius: getCircleMarkerRadius(count),
    color: c.brand,
    fillColor: c.brand,
    fillOpacity: 0.8,
    weight: 2,
    opacity: 1,
    className: 'map-circle-marker',
  }
}

/** Lightweight text label for cluster counts (used with CircleMarkers) */
export const createClusterLabelIcon = (count: number): L.DivIcon => {
  const size = getCircleMarkerRadius(count) * 2
  return L.divIcon({
    html: `<span class="circle-marker-label">${count}</span>`,
    className: 'circle-marker-label-container',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// ─────────────────────────────────────────────────────────────
// User Report Icon Factories (violet theme)
// ─────────────────────────────────────────────────────────────
let _cachedReportMarkerIcon: L.DivIcon | null = null
export const createReportMarkerIcon = (): L.DivIcon => {
  if (_cachedReportMarkerIcon) return _cachedReportMarkerIcon
  _cachedReportMarkerIcon = L.divIcon({
    html: `
      <div class="report-marker-pulse"></div>
      ${boltSvg('report-marker-bolt')}
    `,
    className: 'map-report-marker',
    iconSize: [22, 28],
    iconAnchor: [11, 14],
    popupAnchor: [0, -14],
  })
  return _cachedReportMarkerIcon
}

export const createReportClusterIcon = (count: number): L.DivIcon => {
  const size = count >= 100 ? 52 : count >= 20 ? 44 : count >= 5 ? 36 : 28
  const sizeClass = count >= 100 ? 'xl' : count >= 20 ? 'lg' : count >= 5 ? 'md' : 'sm'
  return L.divIcon({
    html: `
      <div class="report-cluster-ring"></div>
      <div class="report-cluster-core">
        <span class="cluster-count">${count}</span>
      </div>
    `,
    className: `map-report-cluster map-report-cluster--${sizeClass}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

export const createReportCircleMarkerOptions = (count: number): L.CircleMarkerOptions => {
  const c = getMapColors()
  const color = count > 1 ? c.reportCluster : c.report
  return {
    radius: getCircleMarkerRadius(count),
    color,
    fillColor: color,
    fillOpacity: 0.8,
    weight: 2,
    opacity: 1,
    className: 'map-circle-marker',
  }
}

const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const buildReportTooltipContent = (marker: ReportMarkerData): string => {
  const count = marker.count
  const title = count === 1 ? 'User Report' : `${count} user reports`
  const providers = [...new Set(marker.reports.map((r) => r.provider).filter(Boolean))]
  const subtitle = providers.length ? providers.join(', ') : 'Click for details'
  return `
    <div class="map-tooltip">
      <strong>${title}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
  `
}


// ─────────────────────────────────────────────────────────────
// Tooltip & Popup Builders
// ─────────────────────────────────────────────────────────────
export const buildTooltipContent = (data: MarkerData): string => {
  // Use pre-built tooltip HTML if available (avoids work during render loop)
  if (data.tooltipHtml) return data.tooltipHtml

  // Use pre-computed popupData if available (legacy path)
  if (data.popupData) {
    const { title, timeLabel } = data.popupData
    return `
      <div class="map-tooltip">
        <strong>${title}</strong>
        <span>${timeLabel}</span>
      </div>
    `
  }

  // Build tooltip from outageGroup for lazy popup mode
  if (data.outageGroup) {
    const { outages, providers } = data.outageGroup
    const count = outages.length
    const title = count === 1 ? (providers[0] ?? 'Outage') : `${count} events`
    return `
      <div class="map-tooltip">
        <strong>${title}</strong>
        <span>${count === 1 ? 'Click for details' : `${providers.length} provider${providers.length > 1 ? 's' : ''}`}</span>
      </div>
    `
  }

  return 'Outage'
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface UseMapLayersOptions {
  map: ShallowRef<L.Map | null>
  showMarkers: Ref<boolean>
  showPolygons: Ref<boolean>
  showReportMarkers: Ref<boolean>
  isZooming: Ref<boolean>
  /** When provided, marker clicks fire this callback instead of opening a popup */
  onMarkerClick?: (marker: MarkerData) => void
  /** When provided, report marker clicks fire this callback instead of opening a popup */
  onReportMarkerClick?: (marker: ReportMarkerData) => void
}

export interface MapLayerRefs {
  /** L.LayerGroup for markers (vue-use-leaflet returns compatible type) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markerLayer: Ref<any>
  /** L.GeoJSON for polygons */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonLayer: Ref<any>
  /** L.Marker for search result marker */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchMarkerLayer: Ref<any>
  /** L.GeoJSON for search result polygon */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPolygonLayer: Ref<any>
  /** L.LayerGroup for user report markers */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportMarkerLayer: Ref<any>
  polygonsVisible: Ref<boolean>
  renderPending: Ref<boolean>
}

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────
export function useMapLayers(options: UseMapLayersOptions, refs: MapLayerRefs) {
  const {
    map,
    showMarkers,
    showPolygons,
    showReportMarkers,
    isZooming,
    onMarkerClick,
    onReportMarkerClick,
  } = options
  const {
    markerLayer,
    geoJsonLayer,
    searchMarkerLayer,
    searchPolygonLayer,
    reportMarkerLayer,
    polygonsVisible,
    renderPending,
  } = refs

  let debounceTimer: number | null = null

  // ── Skip redundant renders ──
  let lastMarkerKey = ''
  let lastReportMarkerKey = ''

  /** Build a cheap fingerprint from marker data to detect changes */
  const markerFingerprint = (markers: MarkerData[]): string => {
    if (!markers.length) return ''
    // Use length + first/last lat/lng/count as a fast proxy
    const first = markers[0]!
    const last = markers[markers.length - 1]!
    return `${markers.length}:${first.lat},${first.lng},${first.count}:${last.lat},${last.lng},${last.count}`
  }

  const reportMarkerFingerprint = (markers: ReportMarkerData[]): string => {
    if (!markers.length) return ''
    const first = markers[0]!
    const last = markers[markers.length - 1]!
    return `${markers.length}:${first.lat},${first.lng},${first.count}:${last.lat},${last.lng},${last.count}`
  }

  // ── Highlight tracking ──
  // Maps outage ID → the Leaflet marker layer that contains it
  const outageMarkerMap = new Map<string | number, L.Layer>()
  // Maps outage ID → the raw outage (for polygon WKT)
  const outageDataMap = new Map<string | number, Outage>()
  // Whether we're using circle markers (affects how we highlight)
  let usingCircleMarkers = false
  // Currently active highlight state
  let activeHighlightId: string | number | null = null
  let highlightPolygonLayer: L.GeoJSON | null = null

  const queueMarkerRender = (markers: MarkerData[]) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      renderMarkers(markers)
    }, MARKER_RENDER_DEBOUNCE_MS)
  }

  const renderMarkers = (markers: MarkerData[], force = false) => {
    const activeMap = map.value
    if (!activeMap || !activeMap.getContainer()) return

    if (isZooming.value) {
      renderPending.value = true
      return
    }

    // Skip re-render if marker data hasn't changed
    const key = markerFingerprint(markers)
    if (!force && key === lastMarkerKey && markerLayer.value) return
    lastMarkerKey = key

    // Clear lookup maps (rebuilt below)
    outageMarkerMap.clear()
    outageDataMap.clear()
    unhighlightOutage()

    // Build new markers in a fresh layer (double-buffer to prevent flash)
    const newLayer = L.layerGroup()

    if (showMarkers.value) {
      // Use CircleMarkers for large datasets (better performance)
      const useCircleMarkers = markers.length > CIRCLE_MARKER_THRESHOLD
      usingCircleMarkers = useCircleMarkers

      // Add markers with tooltips
      for (const marker of markers) {
        const count = marker.count ?? 1

        // Create either CircleMarker (fast) or Marker with DivIcon (pretty)
        const m = useCircleMarkers
          ? L.circleMarker([marker.lat, marker.lng], createCircleMarkerOptions(count))
          : L.marker([marker.lat, marker.lng], {
              icon: count > 1 ? createClusterIcon(count) : createMarkerIcon(),
            })

        // Bind tooltip
        m.bindTooltip(buildTooltipContent(marker), {
          className: 'map-tooltip-container',
          direction: 'top',
          offset: useCircleMarkers ? [0, -8] : [0, -10],
          opacity: 1,
        })

        if (onMarkerClick) {
          m.on('click', () => onMarkerClick(marker))
        }

        newLayer.addLayer(m)

        // Index outage IDs → this marker layer for highlighting
        if (marker.outageGroup) {
          for (const outage of marker.outageGroup.outages) {
            outageMarkerMap.set(outage.id, m)
            outageDataMap.set(outage.id, outage)
          }
        }

        // Add count label for CircleMarker clusters
        if (useCircleMarkers && count > 1) {
          const label = L.marker([marker.lat, marker.lng], {
            icon: createClusterLabelIcon(count),
            interactive: false, // Don't intercept clicks - let them pass to circle
          })
          newLayer.addLayer(label)
        }
      }
    }

    // Atomic swap: add new layer before removing old to prevent flash
    newLayer.addTo(activeMap)
    const oldLayer = markerLayer.value
    markerLayer.value = newLayer
    if (oldLayer) {
      oldLayer.clearLayers()
      activeMap.removeLayer(oldLayer)
    }
  }

  const renderPolygons = (polygons: PolygonData[]) => {
    const activeMap = map.value
    if (!activeMap) return

    // Remove existing layer
    if (geoJsonLayer.value) {
      activeMap.removeLayer(geoJsonLayer.value as unknown as L.Layer)
      geoJsonLayer.value = null
    }

    const currentZoom = activeMap.getZoom()
    polygonsVisible.value = currentZoom >= POLYGON_VISIBLE_ZOOM

    // Skip if polygons are hidden or zoom level is too low
    if (!showPolygons.value || !polygonsVisible.value || !polygons.length) return

    const features: Feature[] = polygons.map((p) => ({
      type: 'Feature',
      geometry: p.geometry,
      properties: { isCluster: p.isCluster },
    }))

    const featureCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    }

    const c = getMapColors()
    const layer = L.geoJSON(featureCollection, {
      style: () => ({
        color: c.brand,
        fillColor: c.brandFill,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.4,
      }),
    })
    layer.addTo(activeMap)
    geoJsonLayer.value = layer
  }

  const renderSearchMarker = (searchMarker: { lat: number; lng: number } | null) => {
    const activeMap = map.value
    if (!activeMap) return

    // Clear existing
    if (searchMarkerLayer.value) {
      activeMap.removeLayer(searchMarkerLayer.value as unknown as L.Layer)
      searchMarkerLayer.value = null
    }

    if (!searchMarker) return

    const marker = L.marker([searchMarker.lat, searchMarker.lng], {
      icon: createSearchIcon(),
      zIndexOffset: 1000,
    })
    marker.addTo(activeMap)
    searchMarkerLayer.value = marker
  }

  const renderSearchPolygon = (searchPolygon: Polygon | MultiPolygon | null) => {
    const activeMap = map.value
    if (!activeMap) return

    if (searchPolygonLayer.value) {
      activeMap.removeLayer(searchPolygonLayer.value as unknown as L.Layer)
      searchPolygonLayer.value = null
    }

    if (!searchPolygon) return

    const feature: Feature<Polygon | MultiPolygon> = {
      type: 'Feature',
      geometry: searchPolygon,
      properties: {},
    }

    const layer = L.geoJSON(feature, {
      style: {
        color: SEARCH_COLOR,
        fillColor: SEARCH_FILL,
        weight: 3,
        opacity: 1,
        fillOpacity: 0.25,
        dashArray: '6, 4',
      },
    })
    layer.addTo(activeMap)
    searchPolygonLayer.value = layer
  }

  // ─────────────────────────────────────────────────────────────
  // User Report Markers (violet, separate layer)
  // ─────────────────────────────────────────────────────────────
  let reportDebounceTimer: number | null = null

  const queueReportMarkerRender = (markers: ReportMarkerData[]) => {
    if (reportDebounceTimer) clearTimeout(reportDebounceTimer)
    reportDebounceTimer = window.setTimeout(() => {
      reportDebounceTimer = null
      renderReportMarkers(markers)
    }, MARKER_RENDER_DEBOUNCE_MS)
  }

  const renderReportMarkers = (markers: ReportMarkerData[], force = false) => {
    const activeMap = map.value
    if (!activeMap || !activeMap.getContainer()) return

    if (isZooming.value) {
      renderPending.value = true
      return
    }

    // Skip re-render if report marker data hasn't changed
    const key = reportMarkerFingerprint(markers)
    if (!force && key === lastReportMarkerKey && reportMarkerLayer.value) return
    lastReportMarkerKey = key

    // Build new markers in a fresh layer (double-buffer to prevent flash)
    const newLayer = L.layerGroup()

    if (showReportMarkers.value && markers.length) {
      const useCircleMarkers = markers.length > CIRCLE_MARKER_THRESHOLD

      for (const marker of markers) {
        const count = marker.count

        const m = useCircleMarkers
          ? L.circleMarker([marker.lat, marker.lng], createReportCircleMarkerOptions(count))
          : L.marker([marker.lat, marker.lng], {
              icon: count > 1 ? createReportClusterIcon(count) : createReportMarkerIcon(),
            })

        m.bindTooltip(buildReportTooltipContent(marker), {
          className: 'map-tooltip-container',
          direction: 'top',
          offset: useCircleMarkers ? [0, -8] : [0, -10],
          opacity: 1,
        })

        if (onReportMarkerClick) {
          m.on('click', () => onReportMarkerClick(marker))
        }

        newLayer.addLayer(m)

        if (useCircleMarkers && count > 1) {
          const label = L.marker([marker.lat, marker.lng], {
            icon: createClusterLabelIcon(count),
            interactive: false,
          })
          newLayer.addLayer(label)
        }
      }
    }

    // Atomic swap: add new layer before removing old to prevent flash
    newLayer.addTo(activeMap)
    const oldLayer = reportMarkerLayer.value
    reportMarkerLayer.value = newLayer
    if (oldLayer) {
      oldLayer.clearLayers()
      activeMap.removeLayer(oldLayer)
    }
  }

  // ── Outage Highlighting ──
  const highlightOutage = (id: string | number) => {
    if (activeHighlightId === id) return
    unhighlightOutage()
    activeHighlightId = id

    const activeMap = map.value
    if (!activeMap) return

    // Highlight the marker
    const c = getMapColors()
    const markerLeaflet = outageMarkerMap.get(id)
    if (markerLeaflet) {
      if (usingCircleMarkers && 'setStyle' in markerLeaflet) {
        ;(markerLeaflet as L.CircleMarker).setStyle({
          color: c.highlight,
          fillColor: c.highlight,
          fillOpacity: 1,
          weight: 3,
        })
      } else if ('getElement' in markerLeaflet) {
        const el = (markerLeaflet as L.Marker).getElement()
        el?.classList.add('map-marker--highlight')
      }
    }

    // Show the individual outage polygon as a highlight overlay
    const outage = outageDataMap.get(id)
    if (outage?.polygon) {
      const geometry = wktToGeoJSON(outage.polygon)
      if (geometry) {
        const feature: Feature<Polygon | MultiPolygon> = {
          type: 'Feature',
          geometry,
          properties: {},
        }
        highlightPolygonLayer = L.geoJSON(feature, {
          style: {
            color: c.highlight,
            fillColor: c.highlightFill,
            weight: 3,
            opacity: 1,
            fillOpacity: 0.35,
          },
        })
        highlightPolygonLayer.addTo(activeMap)
      }
    }
  }

  const unhighlightOutage = () => {
    if (activeHighlightId === null) return
    const activeMap = map.value

    // Restore marker style
    const markerLeaflet = outageMarkerMap.get(activeHighlightId)
    if (markerLeaflet) {
      if (usingCircleMarkers && 'setStyle' in markerLeaflet) {
        const colors = getMapColors()
        ;(markerLeaflet as L.CircleMarker).setStyle({
          color: colors.brand,
          fillColor: colors.brand,
          fillOpacity: 0.8,
          weight: 2,
        })
      } else if ('getElement' in markerLeaflet) {
        const el = (markerLeaflet as L.Marker).getElement()
        el?.classList.remove('map-marker--highlight')
      }
    }

    // Remove highlight polygon
    if (highlightPolygonLayer && activeMap) {
      activeMap.removeLayer(highlightPolygonLayer)
      highlightPolygonLayer = null
    }

    activeHighlightId = null
  }

  /** Cancel any pending debounced renders (call on zoomstart to prevent mid-zoom rendering) */
  const cancelPendingRenders = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (reportDebounceTimer) {
      clearTimeout(reportDebounceTimer)
      reportDebounceTimer = null
    }
  }

  const cleanup = () => {
    cancelPendingRenders()

    // Clear highlight state
    unhighlightOutage()

    // Release marker/outage reference maps
    outageMarkerMap.clear()
    outageDataMap.clear()

    // Remove all layers from the map
    const activeMap = map.value
    if (activeMap) {
      if (markerLayer.value) {
        markerLayer.value.clearLayers()
        activeMap.removeLayer(markerLayer.value)
        markerLayer.value = null
      }
      if (geoJsonLayer.value) {
        activeMap.removeLayer(geoJsonLayer.value as unknown as L.Layer)
        geoJsonLayer.value = null
      }
      if (searchMarkerLayer.value) {
        activeMap.removeLayer(searchMarkerLayer.value as unknown as L.Layer)
        searchMarkerLayer.value = null
      }
      if (searchPolygonLayer.value) {
        activeMap.removeLayer(searchPolygonLayer.value as unknown as L.Layer)
        searchPolygonLayer.value = null
      }
      if (reportMarkerLayer.value) {
        reportMarkerLayer.value.clearLayers()
        activeMap.removeLayer(reportMarkerLayer.value)
        reportMarkerLayer.value = null
      }
    }
  }

  return {
    queueMarkerRender,
    renderMarkers,
    renderPolygons,
    renderSearchMarker,
    renderSearchPolygon,
    queueReportMarkerRender,
    renderReportMarkers,
    highlightOutage,
    unhighlightOutage,
    cancelPendingRenders,
    cleanup,
  }
}
