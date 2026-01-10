import L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type TileStyle = 'light' | 'dark' | 'voyager'

export const TILE_LAYERS = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const

export interface UseMinimapOptions {
  map: ShallowRef<L.Map | null>
  minimapEl: Ref<HTMLElement | null>
  initialStyle: TileStyle
}

export interface MinimapRefs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  minimapInstance: Ref<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  minimapRect: Ref<any>
}

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────
export function useMinimap(options: UseMinimapOptions, refs: MinimapRefs) {
  const { map, minimapEl, initialStyle } = options
  const { minimapInstance, minimapRect } = refs

  const initMinimap = () => {
    if (!minimapEl.value || minimapInstance.value) return

    const config = TILE_LAYERS[initialStyle]
    minimapInstance.value = L.map(minimapEl.value, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      center: [56.0, -96.0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 4,
    })

    L.tileLayer(config.url, {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(minimapInstance.value)

    // Add viewport rectangle
    const rect = L.rectangle(
      [
        [40, -140],
        [70, -50],
      ],
      {
        color: '#18b8a6',
        weight: 2,
        fill: true,
        fillColor: '#18b8a6',
        fillOpacity: 0.25,
        interactive: false,
      },
    )
    rect.addTo(minimapInstance.value)
    minimapRect.value = rect

    // Initial update after a small delay to ensure main map is ready
    setTimeout(() => updateMinimapRect(), 200)
  }

  const updateMinimapRect = () => {
    const activeMap = map.value
    if (!activeMap || !minimapRect.value || !minimapInstance.value) return

    try {
      const bounds = activeMap.getBounds()
      if (bounds.isValid()) {
        minimapRect.value.setBounds(bounds)
        // Keep minimap centered on the viewport
        minimapInstance.value.setView(bounds.getCenter(), minimapInstance.value.getZoom(), {
          animate: false,
        })
      }
    } catch {
      // Bounds not ready yet, ignore
    }
  }

  const updateMinimapTiles = (style: TileStyle) => {
    if (!minimapInstance.value) return

    // Remove all tile layers safely
    minimapInstance.value.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.TileLayer) {
        try {
          layer.remove()
        } catch {
          // Ignore
        }
      }
    })

    const config = TILE_LAYERS[style]
    L.tileLayer(config.url, {
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(minimapInstance.value)
  }

  const cleanup = () => {
    if (minimapInstance.value) {
      minimapInstance.value.remove()
      minimapInstance.value = null
    }
  }

  return {
    initMinimap,
    updateMinimapRect,
    updateMinimapTiles,
    cleanup,
  }
}
