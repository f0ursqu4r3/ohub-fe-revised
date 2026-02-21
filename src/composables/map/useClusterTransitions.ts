import L from 'leaflet'
import type { Ref, ShallowRef } from 'vue'
import type { ClusterBucketResult } from './useClusterBuckets'
import { featureKey } from './useClusterBuckets'
import {
  CIRCLE_MARKER_THRESHOLD,
  CLUSTER_ANIMATION_DURATION_MS,
  CLUSTER_ANIMATION_EASING,
} from '@/config/map'
import { createMarkerIcon, createClusterIcon } from './useMapLayers'
import type { GroupedOutage } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface TransitionItem {
  /** Marker at starting position */
  marker: L.Marker
  /** Pixel delta to animate */
  dx: number
  dy: number
  /** Whether this marker should fade in (split) or will be replaced */
  type: 'split' | 'merge' | 'static'
}

export interface UseClusterTransitionsOptions {
  map: ShallowRef<L.Map | null>
  bucketResult: Ref<ClusterBucketResult | null>
}

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────

export function useClusterTransitions(options: UseClusterTransitionsOptions) {
  const { map, bucketResult } = options

  let transitionLayer: L.LayerGroup | null = null
  let animationFrame: number | null = null
  let animationTimer: number | null = null
  let isAnimating = false

  /**
   * Execute the animated transition between zoom levels.
   * Called after zoomend fires and Leaflet's CSS zoom is complete.
   *
   * @param fromZoom - Previous integer zoom level
   * @param toZoom - New integer zoom level
   * @param realMarkerLayer - The "real" marker layer to hide during animation
   * @param onComplete - Callback when animation finishes (renders real markers)
   */
  function animate(
    fromZoom: number,
    toZoom: number,
    realMarkerLayer: L.LayerGroup | null,
    onComplete: () => void,
  ) {
    const activeMap = map.value
    const result = bucketResult.value
    if (!activeMap || !result) {
      onComplete()
      return
    }

    const fromBucket = result.buckets.get(Math.round(fromZoom))
    const toBucket = result.buckets.get(Math.round(toZoom))
    if (!fromBucket || !toBucket) {
      onComplete()
      return
    }

    // Skip animation for CircleMarker mode (canvas-drawn, no DOM)
    if (toBucket.groups.length > CIRCLE_MARKER_THRESHOLD) {
      onComplete()
      return
    }

    // Skip animation if zoom delta > 1 (rapid zoom)
    if (Math.abs(toZoom - fromZoom) > 1) {
      onComplete()
      return
    }

    // Cancel any in-flight animation
    cancelAnimation()
    isAnimating = true

    const linkage = result.linkage
    const zoomingIn = toZoom > fromZoom
    const items: TransitionItem[] = []

    if (zoomingIn) {
      // SPLIT: Children appear from parent's position → animate to their own position
      for (const [key, group] of toBucket.keyToGroup) {
        const parentKey = linkage.childToParent.get(key)
        const parentGroup = parentKey ? fromBucket.keyToGroup.get(parentKey) : null

        if (parentGroup) {
          // Child starts at parent's center, ends at its own center
          const startLatLng = L.latLng(parentGroup.center[0], parentGroup.center[1])
          const endLatLng = L.latLng(group.center[0], group.center[1])
          const startPx = activeMap.latLngToLayerPoint(startLatLng)
          const endPx = activeMap.latLngToLayerPoint(endLatLng)

          const marker = createTransitionMarker(group, startLatLng)
          items.push({
            marker,
            dx: endPx.x - startPx.x,
            dy: endPx.y - startPx.y,
            type: 'split',
          })
        } else {
          // Feature exists at both levels or is new — static position
          const fromGroup = fromBucket.keyToGroup.get(key)
          if (fromGroup) {
            const startLatLng = L.latLng(fromGroup.center[0], fromGroup.center[1])
            const endLatLng = L.latLng(group.center[0], group.center[1])
            const startPx = activeMap.latLngToLayerPoint(startLatLng)
            const endPx = activeMap.latLngToLayerPoint(endLatLng)

            const marker = createTransitionMarker(group, startLatLng)
            items.push({
              marker,
              dx: endPx.x - startPx.x,
              dy: endPx.y - startPx.y,
              type: 'static',
            })
          }
        }
      }
    } else {
      // MERGE: Children animate from their position → to parent's position
      for (const [key, group] of fromBucket.keyToGroup) {
        const parentKey = linkage.childToParent.get(key)
        const parentGroup = parentKey ? toBucket.keyToGroup.get(parentKey) : null

        if (parentGroup) {
          const startLatLng = L.latLng(group.center[0], group.center[1])
          const endLatLng = L.latLng(parentGroup.center[0], parentGroup.center[1])
          const startPx = activeMap.latLngToLayerPoint(startLatLng)
          const endPx = activeMap.latLngToLayerPoint(endLatLng)

          const marker = createTransitionMarker(group, startLatLng)
          items.push({
            marker,
            dx: endPx.x - startPx.x,
            dy: endPx.y - startPx.y,
            type: 'merge',
          })
        } else {
          // Feature persists — static
          const toGroup = toBucket.keyToGroup.get(key)
          if (toGroup) {
            const startLatLng = L.latLng(group.center[0], group.center[1])
            const endLatLng = L.latLng(toGroup.center[0], toGroup.center[1])
            const startPx = activeMap.latLngToLayerPoint(startLatLng)
            const endPx = activeMap.latLngToLayerPoint(endLatLng)

            const marker = createTransitionMarker(group, startLatLng)
            items.push({
              marker,
              dx: endPx.x - startPx.x,
              dy: endPx.y - startPx.y,
              type: 'static',
            })
          }
        }
      }
    }

    if (items.length === 0) {
      isAnimating = false
      onComplete()
      return
    }

    // Hide real markers during animation
    if (realMarkerLayer) {
      realMarkerLayer.eachLayer((layer) => {
        const el = (layer as L.Marker).getElement?.()
        if (el) el.style.opacity = '0'
      })
    }

    // Create transition layer and add all temporary markers
    transitionLayer = L.layerGroup().addTo(activeMap)
    for (const item of items) {
      item.marker.addTo(transitionLayer)
    }

    // On next frame: apply CSS transition + translate to end position
    animationFrame = requestAnimationFrame(() => {
      animationFrame = null

      for (const item of items) {
        const el = item.marker.getElement()
        if (!el) continue

        el.style.transition = `transform ${CLUSTER_ANIMATION_DURATION_MS}ms ${CLUSTER_ANIMATION_EASING}`

        if (item.type === 'split') {
          // Start small, grow to full size while moving
          el.style.transform += ' scale(0.4)'
          el.style.opacity = '0.3'
          // Force reflow before applying end state
          el.offsetHeight
          el.style.transition = `transform ${CLUSTER_ANIMATION_DURATION_MS}ms ${CLUSTER_ANIMATION_EASING}, opacity ${CLUSTER_ANIMATION_DURATION_MS}ms ${CLUSTER_ANIMATION_EASING}`
          el.style.transform = el.style.transform.replace(
            ' scale(0.4)',
            ` translate(${item.dx}px, ${item.dy}px) scale(1)`,
          )
          el.style.opacity = '1'
        } else if (item.type === 'merge') {
          // Move to parent position and shrink
          el.style.transition = `transform ${CLUSTER_ANIMATION_DURATION_MS}ms ${CLUSTER_ANIMATION_EASING}, opacity ${CLUSTER_ANIMATION_DURATION_MS}ms ${CLUSTER_ANIMATION_EASING}`
          el.style.transform += ` translate(${item.dx}px, ${item.dy}px) scale(0.4)`
          el.style.opacity = '0.3'
        } else {
          // Static: just translate
          if (item.dx !== 0 || item.dy !== 0) {
            el.style.transform += ` translate(${item.dx}px, ${item.dy}px)`
          }
        }
      }

      // Wait for animation to complete, then swap to real markers
      animationTimer = window.setTimeout(() => {
        animationTimer = null
        cleanupTransition()
        isAnimating = false
        onComplete()
      }, CLUSTER_ANIMATION_DURATION_MS + 30) // buffer for CSS completion
    })
  }

  function createTransitionMarker(group: GroupedOutage, latLng: L.LatLng): L.Marker {
    const count = group.outages.length
    const icon = count > 1 ? createClusterIcon(count) : createMarkerIcon()
    return L.marker(latLng, { icon, interactive: false })
  }

  function cancelAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
    if (animationTimer !== null) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
    cleanupTransition()
    isAnimating = false
  }

  function cleanupTransition() {
    if (transitionLayer) {
      const activeMap = map.value
      if (activeMap) {
        transitionLayer.clearLayers()
        activeMap.removeLayer(transitionLayer)
      }
      transitionLayer = null
    }
  }

  function cleanup() {
    cancelAnimation()
  }

  return {
    animate,
    cancelAnimation,
    isAnimating: () => isAnimating,
    cleanup,
  }
}
