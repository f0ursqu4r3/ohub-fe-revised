import Supercluster, { type ClusterFeature, type PointFeature } from 'supercluster'
import { shallowRef, watch, type Ref, type ComputedRef } from 'vue'
import type { Outage } from '@/types/outage'
import { mergePolygons, CANADA_BOUNDS_BBOX, type GroupedOutage, type Point } from '@/lib/utils'
import { CLUSTER_BUCKET_RADIUS_PX } from '@/config/map'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type OutageFeatureProps = { outage: Outage }

type ClusterProps = {
  cluster: true
  cluster_id: number
  point_count: number
  point_count_abbreviated: string
}

type Feature = ClusterFeature<ClusterProps> | PointFeature<OutageFeatureProps>

/** Unique key for a feature across zoom levels within the same index */
export type FeatureKey = string // "c:<cluster_id>" or "p:<outage_id>"

export interface BucketEntry {
  zoom: number
  groups: GroupedOutage[]
  /** Map from FeatureKey → GroupedOutage for fast lookup */
  keyToGroup: Map<FeatureKey, GroupedOutage>
}

export interface ZoomLinkage {
  /** child FeatureKey → parent FeatureKey (one zoom level up) */
  childToParent: Map<FeatureKey, FeatureKey>
  /** parent FeatureKey → child FeatureKey[] (one zoom level down) */
  parentToChildren: Map<FeatureKey, FeatureKey[]>
}

export interface ClusterBucketResult {
  buckets: Map<number, BucketEntry>
  linkage: ZoomLinkage
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MIN_ZOOM = 3
const MAX_ZOOM = 18

// ─────────────────────────────────────────────────────────────
// Feature key helpers
// ─────────────────────────────────────────────────────────────

const isCluster = (f: Feature): f is ClusterFeature<ClusterProps> =>
  Boolean(f.properties && 'cluster' in f.properties && f.properties.cluster)

export const featureKey = (feature: Feature): FeatureKey => {
  if (isCluster(feature)) {
    return `c:${feature.properties.cluster_id}`
  }
  return `p:${(feature.properties as OutageFeatureProps).outage.id}`
}

// ─────────────────────────────────────────────────────────────
// Pure computation
// ─────────────────────────────────────────────────────────────

/**
 * Build a single Supercluster index with fixed radius, then pre-compute
 * cluster buckets for every integer zoom level and cross-zoom linkage.
 */
export function buildClusterBuckets(outages: Outage[]): ClusterBucketResult {
  const validOutages = outages.filter(
    (o) =>
      Number.isFinite(o.latitude) &&
      Number.isFinite(o.longitude) &&
      Math.abs(o.latitude) <= 90 &&
      Math.abs(o.longitude) <= 180,
  )

  const index = new Supercluster<OutageFeatureProps, ClusterProps>({
    radius: CLUSTER_BUCKET_RADIUS_PX,
    minZoom: 0,
    maxZoom: MAX_ZOOM + 1, // +1 so getChildren works at MAX_ZOOM
  })

  const features: PointFeature<OutageFeatureProps>[] = validOutages.map((outage, idx) => ({
    type: 'Feature' as const,
    id: idx,
    properties: { outage },
    geometry: {
      type: 'Point' as const,
      coordinates: [outage.longitude, outage.latitude],
    },
  }))

  index.load(features)

  // ── Build buckets for each zoom level ──
  const buckets = new Map<number, BucketEntry>()
  const zoomFeatures = new Map<number, Feature[]>()

  for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom++) {
    const clusters = index.getClusters(CANADA_BOUNDS_BBOX, zoom)
    zoomFeatures.set(zoom, clusters)

    const keyToGroup = new Map<FeatureKey, GroupedOutage>()
    const groups: GroupedOutage[] = []

    for (const feature of clusters) {
      const key = featureKey(feature)
      const group = featureToGroup(feature, index, validOutages.length)
      keyToGroup.set(key, group)
      groups.push(group)
    }

    buckets.set(zoom, { zoom, groups, keyToGroup })
  }

  // ── Build cross-zoom parent↔child linkage ──
  const childToParent = new Map<FeatureKey, FeatureKey>()
  const parentToChildren = new Map<FeatureKey, FeatureKey[]>()

  for (let zoom = MIN_ZOOM; zoom < MAX_ZOOM; zoom++) {
    const featuresAtZoom = zoomFeatures.get(zoom)!
    for (const feature of featuresAtZoom) {
      if (!isCluster(feature)) continue

      const parentKey = featureKey(feature)
      const clusterId = feature.properties.cluster_id

      try {
        const children = index.getChildren(clusterId)
        const childKeys: FeatureKey[] = []

        for (const child of children) {
          const childKey = featureKey(child)
          childToParent.set(childKey, parentKey)
          childKeys.push(childKey)
        }

        parentToChildren.set(parentKey, childKeys)
      } catch {
        // getChildren can throw if cluster_id is invalid at this level
      }
    }
  }

  return {
    buckets,
    linkage: { childToParent, parentToChildren },
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Convert a Supercluster feature to a GroupedOutage (polygon deferred) */
function featureToGroup(
  feature: Feature,
  index: Supercluster<OutageFeatureProps, ClusterProps>,
  totalCount: number,
): GroupedOutage {
  const coords = feature.geometry.coordinates
  const lng = coords[0] as number
  const lat = coords[1] as number

  if (isCluster(feature)) {
    const clusterId = feature.properties.cluster_id
    const leaves = index.getLeaves(clusterId, totalCount)
    const outages = leaves
      .map((leaf) => leaf.properties?.outage)
      .filter((o): o is Outage => Boolean(o))

    return summarizeLightweight(outages, [lat, lng])
  }

  const outage = (feature.properties as OutageFeatureProps).outage
  return summarizeLightweight([outage], [lat, lng])
}

/**
 * Lightweight summarize that defers polygon WKT merging.
 * Polygon is set to null here and computed lazily for the visible zoom level.
 */
function summarizeLightweight(outages: Outage[], center: Point): GroupedOutage {
  const providers = Array.from(new Set(outages.map((o) => o.provider)))
  const ts = outages.reduce((latest, o) => Math.max(latest, o.ts), outages[0]!.ts)

  // Compute radius (rough Euclidean, not haversine — sufficient for clustering)
  let maxDist = 0
  for (const o of outages) {
    const dLat = o.latitude - center[0]
    const dLng = o.longitude - center[1]
    const dist = Math.sqrt(dLat * dLat + dLng * dLng)
    if (dist > maxDist) maxDist = dist
  }

  return {
    outages,
    center,
    radius: maxDist,
    providers,
    polygon: null, // deferred
    ts,
  }
}

/** Lazily fill in polygon WKT for all groups in a bucket */
export function hydratePolygons(groups: GroupedOutage[]): void {
  for (const group of groups) {
    if (group.polygon !== null) continue
    const polygons = group.outages
      .map((o) => o.polygon)
      .filter((p): p is string => Boolean(p))
    group.polygon = polygons.length ? mergePolygons(polygons) : null
  }
}

// ─────────────────────────────────────────────────────────────
// Vue Composable
// ─────────────────────────────────────────────────────────────

export interface UseClusterBucketsOptions {
  outages: ComputedRef<Outage[]>
  zoomLevel: Ref<number>
}

export function useClusterBuckets(options: UseClusterBucketsOptions) {
  const { outages, zoomLevel } = options

  const bucketResult = shallowRef<ClusterBucketResult | null>(null)
  const currentGroups = shallowRef<GroupedOutage[]>([])
  const previousZoom = shallowRef<number>(zoomLevel.value)

  /** Look up the bucket for a given zoom and hydrate polygons on demand */
  const lookupBucket = (zoom: number): GroupedOutage[] => {
    const result = bucketResult.value
    if (!result) return []
    const bucket = result.buckets.get(Math.round(zoom))
    if (!bucket) return []

    // Lazily hydrate polygons for this zoom level
    hydratePolygons(bucket.groups)
    return bucket.groups
  }

  // Re-compute all buckets when outage data changes
  watch(
    outages,
    (newOutages) => {
      if (!newOutages.length) {
        bucketResult.value = null
        currentGroups.value = []
        return
      }

      const compute = () => {
        bucketResult.value = buildClusterBuckets(newOutages)
        currentGroups.value = lookupBucket(zoomLevel.value)
      }

      // Use requestIdleCallback to avoid blocking the main thread
      if ('requestIdleCallback' in window) {
        requestIdleCallback(compute, { timeout: 100 })
      } else {
        setTimeout(compute, 0)
      }
    },
    { immediate: true },
  )

  // On zoom change, instant O(1) bucket lookup
  watch(zoomLevel, (newZoom, oldZoom) => {
    previousZoom.value = oldZoom
    currentGroups.value = lookupBucket(newZoom)
  })

  return {
    bucketResult,
    currentGroups,
    previousZoom,
  }
}
