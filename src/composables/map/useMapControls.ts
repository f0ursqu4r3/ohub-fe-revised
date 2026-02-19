import { onBeforeUnmount } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import type L from 'leaflet'
import type { BoundsLiteral } from '../../components/map/types'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface UseMapControlsOptions {
  map: ShallowRef<L.Map | null>
  wrapperEl: Ref<HTMLElement | null>
  isFullscreen: Ref<boolean>
  pendingFocusBounds: Ref<BoundsLiteral | null>
}

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────
export function useMapControls(options: UseMapControlsOptions) {
  const { map, wrapperEl, isFullscreen, pendingFocusBounds } = options

  const zoomIn = () => map.value?.zoomIn()
  const zoomOut = () => map.value?.zoomOut()

  const resetView = () => {
    map.value?.setView([56.0, -96.0], 4)
  }

  const locateMe = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.value?.setView([pos.coords.latitude, pos.coords.longitude], 10)
      },
      () => {
        // Silently fail
      },
    )
  }

  const onFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
    setTimeout(() => map.value?.invalidateSize(), 100)
  }
  document.addEventListener('fullscreenchange', onFullscreenChange)
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  })

  const toggleFullscreen = async () => {
    if (!wrapperEl.value) return
    if (!document.fullscreenElement) {
      await wrapperEl.value.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  const zoomToBounds = (bounds: BoundsLiteral) => {
    map.value?.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }

  const focusMap = (bounds: BoundsLiteral) => {
    if (!bounds) return
    if (!map.value) {
      pendingFocusBounds.value = bounds
      return
    }
    zoomToBounds(bounds)
  }

  return {
    zoomIn,
    zoomOut,
    resetView,
    locateMe,
    toggleFullscreen,
    zoomToBounds,
    focusMap,
  }
}
