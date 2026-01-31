import { createApp } from 'vue'
// Static import for popup Vue component (wrapper provides UApp context for tooltips)
import MapPopupComp from '../../components/map/MapPopupWrapper.vue'
import L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type {
  MarkerData,
  PolygonData,
  BoundsLiteral,
  PopupData,
  PopupDataBuilder,
} from '../../components/map/types'
import {
  POLYGON_VISIBLE_ZOOM,
  CIRCLE_MARKER_THRESHOLD,
  MARKER_RENDER_DEBOUNCE_MS,
  BRAND_CLUSTER_COLOR,
  BRAND_CLUSTER_FILL,
  BRAND_OUTAGE_COLOR,
  BRAND_OUTAGE_FILL,
  SEARCH_COLOR,
  SEARCH_FILL,
  logDevError,
} from '../../config/map'

// Re-export constants for consumers
export {
  POLYGON_VISIBLE_ZOOM,
  BRAND_CLUSTER_COLOR,
  BRAND_CLUSTER_FILL,
  BRAND_OUTAGE_COLOR,
  BRAND_OUTAGE_FILL,
  SEARCH_COLOR,
  SEARCH_FILL,
}

// ─────────────────────────────────────────────────────────────
// Icon Factories
// ─────────────────────────────────────────────────────────────
export const createMarkerIcon = (): L.DivIcon => {
  return L.divIcon({
    html: `
      <div class="marker-pulse"></div>
      <div class="marker-dot"></div>
    `,
    className: 'map-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  })
}

export const createClusterIcon = (count: number): L.DivIcon => {
  const size = count >= 100 ? 52 : count >= 20 ? 44 : count >= 5 ? 36 : 28
  const sizeClass = count >= 100 ? 'xl' : count >= 20 ? 'lg' : count >= 5 ? 'md' : 'sm'

  return L.divIcon({
    html: `
      <div class="cluster-ring"></div>
      <div class="cluster-core">
        <span class="cluster-count">${count}</span>
      </div>
    `,
    className: `map-cluster map-cluster--${sizeClass}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

export const createSearchIcon = (): L.DivIcon => {
  return L.divIcon({
    html: `
      <div class="search-marker-ring"></div>
      <div class="search-marker-dot"></div>
    `,
    className: 'map-search-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
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
  const isCluster = count > 1
  return {
    radius: getCircleMarkerRadius(count),
    color: isCluster ? BRAND_CLUSTER_COLOR : BRAND_OUTAGE_COLOR,
    fillColor: isCluster ? BRAND_CLUSTER_COLOR : BRAND_OUTAGE_COLOR,
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
// Tooltip & Popup Builders
// ─────────────────────────────────────────────────────────────
export const buildTooltipContent = (data: MarkerData): string => {
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
  showHeatmap: Ref<boolean>
  isZooming: Ref<boolean>
  onZoomToBounds: (bounds: BoundsLiteral) => void
  /** Optional lazy popup data builder - if provided, popups compute on open */
  popupBuilder?: PopupDataBuilder
}

export interface MapLayerRefs {
  /** L.LayerGroup for markers (vue-use-leaflet returns compatible type) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markerLayer: Ref<any>
  /** L.GeoJSON for polygons */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonLayer: Ref<any>
  /** L.Layer for heatmap (leaflet.heat) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  heatmapLayer: Ref<any>
  /** L.Marker for search result marker */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchMarkerLayer: Ref<any>
  /** L.GeoJSON for search result polygon */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchPolygonLayer: Ref<any>
  polygonsVisible: Ref<boolean>
  renderPending: Ref<boolean>
  heatmapPending: Ref<boolean>
}

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────
export function useMapLayers(options: UseMapLayersOptions, refs: MapLayerRefs) {
  const { map, showMarkers, showPolygons, showHeatmap, isZooming, onZoomToBounds, popupBuilder } =
    options
  const {
    markerLayer,
    geoJsonLayer,
    heatmapLayer,
    searchMarkerLayer,
    searchPolygonLayer,
    polygonsVisible,
    renderPending,
    heatmapPending,
  } = refs

  let debounceTimer: number | null = null

  const queueMarkerRender = (markers: MarkerData[]) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      renderMarkers(markers)
    }, MARKER_RENDER_DEBOUNCE_MS)
  }

  const popupApps = new WeakMap<L.Popup, ReturnType<typeof createApp>>()

  const unmountPopupApp = (popup: L.Popup) => {
    const prev = popupApps.get(popup)
    if (prev) {
      prev.unmount()
      popupApps.delete(popup)
    }
  }

  const mountPopupContent = (popup: L.Popup, popupData: PopupData | null | undefined) => {
    unmountPopupApp(popup)

    if (!popupData) {
      popup.setContent('<div class="map-popup__empty">No details available</div>')
      return
    }

    const container = document.createElement('div')
    const app = createApp(MapPopupComp, {
      popupData,
      onZoom: (bounds: BoundsLiteral) => onZoomToBounds(bounds),
    })
    app.mount(container)
    popupApps.set(popup, app)
    popup.setContent(container)
    if (typeof popup.update === 'function') {
      setTimeout(() => popup.update(), 0)
    }
  }

  const renderMarkers = (markers: MarkerData[]) => {
    const activeMap = map.value
    if (!activeMap || !activeMap.getContainer()) return

    if (isZooming.value) {
      renderPending.value = true
      return
    }

    // Initialize marker layer
    if (!markerLayer.value) {
      const layer = L.layerGroup()
      layer.addTo(activeMap)
      markerLayer.value = layer
    }
    markerLayer.value.clearLayers()

    // Skip if markers are hidden
    if (!showMarkers.value) return

    // Use CircleMarkers for large datasets (better performance)
    const useCircleMarkers = markers.length > CIRCLE_MARKER_THRESHOLD

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

      const popupOptions = {
        className: 'map-popup-container',
        maxWidth: 280,
        minWidth: 200,
      }

      // Use lazy popup building if builder is provided and marker has outageGroup
      if (popupBuilder && marker.outageGroup) {
        // Bind empty popup initially - content will be set on open
        m.bindPopup('', popupOptions)
          .on('popupopen', (e) => {
            const popupData = popupBuilder(marker.outageGroup!, marker.blockTs ?? null)
            mountPopupContent(e.popup, popupData)
          })
          .on('popupclose', (e) => unmountPopupApp(e.popup))
      } else {
        // Use pre-computed popup data (legacy path)
        m.bindPopup('', popupOptions)
          .on('popupopen', (e) => {
            mountPopupContent(e.popup, marker.popupData ?? null)
          })
          .on('popupclose', (e) => unmountPopupApp(e.popup))
      }

      markerLayer.value!.addLayer(m)

      // Add count label for CircleMarker clusters
      if (useCircleMarkers && count > 1) {
        const label = L.marker([marker.lat, marker.lng], {
          icon: createClusterLabelIcon(count),
          interactive: false, // Don't intercept clicks - let them pass to circle
        })
        markerLayer.value!.addLayer(label)
      }
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

    const layer = L.geoJSON(featureCollection, {
      style: (feature) => {
        const isCluster = feature?.properties?.isCluster
        return {
          color: isCluster ? BRAND_CLUSTER_COLOR : BRAND_OUTAGE_COLOR,
          fillColor: isCluster ? BRAND_CLUSTER_FILL : BRAND_OUTAGE_FILL,
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.4,
        }
      },
    })
    layer.addTo(activeMap)
    geoJsonLayer.value = layer
  }

  // Track if heatmap plugin is loaded (lazy-loaded on first use)
  let heatmapPluginLoaded = false
  let heatmapPluginLoading = false

  const loadHeatmapPlugin = async (): Promise<boolean> => {
    if (heatmapPluginLoaded) return true
    if (heatmapPluginLoading) return false // Already loading, skip this render

    heatmapPluginLoading = true
    try {
      await import('leaflet.heat')
      heatmapPluginLoaded = true
      heatmapPluginLoading = false
      return true
    } catch (e) {
      logDevError('Failed to load leaflet.heat plugin', e)
      heatmapPluginLoading = false
      return false
    }
  }

  const renderHeatmap = async (markers: MarkerData[]) => {
    const activeMap = map.value
    if (!activeMap) return

    // Don't re-render during zoom animations to avoid errors - queue it
    if (isZooming.value) {
      heatmapPending.value = true
      return
    }

    heatmapPending.value = false

    // Remove existing heatmap layer safely
    if (heatmapLayer.value) {
      const layerToRemove = heatmapLayer.value
      heatmapLayer.value = null
      try {
        layerToRemove.off()
        layerToRemove.remove()
      } catch (e) {
        logDevError('Failed to remove heatmap layer', e)
      }
    }

    // Skip if heatmap is hidden or no markers
    if (!showHeatmap.value || !markers.length) return

    // Lazy-load the heatmap plugin on first use
    const pluginReady = await loadHeatmapPlugin()
    if (!pluginReady) return

    // Build heatmap data: [lat, lng, intensity]
    const heatData: Array<[number, number, number]> = markers.map((marker) => {
      const intensity = Math.min(1, 0.5 + (marker.count ?? 1) / 20)
      return [marker.lat, marker.lng, intensity]
    })

    // Create heatmap with high visibility colors
    const heat = L.heatLayer(heatData, {
      radius: 35,
      blur: 10,
      maxZoom: 14,
      max: 1.0,
      minOpacity: 0.4,
      gradient: {
        0.0: 'rgba(0, 150, 136, 0.2)',
        0.3: 'rgba(24, 184, 166, 0.7)',
        0.5: 'rgba(255, 193, 7, 0.85)',
        0.7: 'rgba(255, 120, 0, 0.95)',
        0.85: 'rgba(244, 67, 54, 1)',
        1.0: 'rgba(183, 28, 28, 1)',
      },
    })
    heat.addTo(activeMap)
    heatmapLayer.value = heat
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

  const cleanup = () => {
    if (debounceTimer) clearTimeout(debounceTimer)

    if (heatmapLayer.value) {
      try {
        heatmapLayer.value.remove()
      } catch (e) {
        logDevError('Failed to cleanup heatmap layer', e)
      }
      heatmapLayer.value = null
    }
  }

  return {
    queueMarkerRender,
    renderMarkers,
    renderPolygons,
    renderHeatmap,
    renderSearchMarker,
    renderSearchPolygon,
    cleanup,
  }
}
