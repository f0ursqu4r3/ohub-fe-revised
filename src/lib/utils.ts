import Supercluster, { type ClusterFeature, type PointFeature } from 'supercluster'
import moment from 'moment'
import type { Outage } from '@/types/outage'

type Point = [number, number]
type Circle = [Point, number]
const EARTH_RADIUS_KM = 6371
const EARTH_CIRCUMFERENCE_KM = 40075
const WORLD_BOUNDS: [number, number, number, number] = [-180, -85, 180, 85]
const KM_RANGE: [number, number] = [0.01, 100]
const ZOOM_RANGE: [number, number] = [4, 19]
const SINGLETON_ZOOM = 16

type OutageFeatureProps = {
  outage: Outage
}

type ClusterProperties = {
  cluster: true
  cluster_id: number
  point_count: number
  point_count_abbreviated: string
}

export type GroupedOutage = {
  outages: Outage[]
  center: Point
  radius: number
  providers: string[]
  polygon: string | null
  ts: number
}

/**
 * Clusters outages into grouped representations based on the current zoom level.
 *
 * @param outages - The list of outages to cluster.
 * @param zoomLevel - The current map zoom level used to determine clustering sensitivity.
 * @returns An array of grouped outage summaries, either individual outages when zoomed in
 *          or clustered groups when zoomed out.
 */
export const clusterOutages = (outages: Outage[], zoomLevel: number): GroupedOutage[] => {
  if (!outages.length) {
    return []
  }
  if (zoomLevel >= SINGLETON_ZOOM) {
    return outages.map((outage) => summarizeCluster([outage]))
  }

  const thresholdKm = zoomToThresholdKm(zoomLevel)
  const radiusPixels = kmToRadiusPixels(thresholdKm, zoomLevel)

  const index = new Supercluster<OutageFeatureProps, ClusterProperties>({
    radius: radiusPixels,
    minZoom: 0,
    maxZoom: 19,
  })

  const features: PointFeature<OutageFeatureProps>[] = outages.map((outage, idx) => ({
    type: 'Feature' as const,
    id: idx,
    properties: { outage },
    geometry: {
      type: 'Point' as const,
      coordinates: [outage.longitude, outage.latitude],
    },
  }))

  index.load(features)

  const clusters = index.getClusters(WORLD_BOUNDS, Math.round(zoomLevel))

  return clusters
    .map((feature: PointFeature<OutageFeatureProps> | ClusterFeature<ClusterProperties>) => {
      if (isClusterFeature(feature)) {
        const clusterId = feature.properties.cluster_id
        const leaves = index.getLeaves(clusterId, outages.length)
        const clusterOutagesList = leaves
          .map((leaf: PointFeature<OutageFeatureProps>) => leaf.properties?.outage)
          .filter((outage: Outage | undefined): outage is Outage => Boolean(outage))
        if (!clusterOutagesList.length) {
          return null
        }
        return summarizeCluster(clusterOutagesList)
      }

      const outage = feature.properties?.outage
      if (!outage) {
        return null
      }
      return summarizeCluster([outage])
    })
    .filter((group): group is GroupedOutage => Boolean(group))
}

const kmToRadiusPixels = (km: number, zoom: number): number => {
  const kmPerPixel = EARTH_CIRCUMFERENCE_KM / (512 * 2 ** zoom)
  return Math.max(1, Math.round(km / kmPerPixel))
}

const zoomToThresholdKm = (zoom: number): number => {
  const [kmMin, kmMax] = KM_RANGE
  const [zoomMin, zoomMax] = ZOOM_RANGE
  const clampedZoom = clamp(zoom, zoomMin, zoomMax)
  const factor = (clampedZoom - zoomMin) / (zoomMax - zoomMin)
  const biasedFactor = Math.pow(factor, 2) // slows the drop, so lower zooms cluster more
  const km = kmMax + biasedFactor * (kmMin - kmMax)
  return clamp(km, kmMin, kmMax)
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const isClusterFeature = (
  feature: PointFeature<OutageFeatureProps> | ClusterFeature<ClusterProperties>,
): feature is ClusterFeature<ClusterProperties> =>
  Boolean(feature.properties && 'cluster' in feature.properties)

const summarizeCluster = (cluster: Outage[]): GroupedOutage => {
  let sumLat = 0
  let sumLon = 0
  for (const outage of cluster) {
    sumLat += outage.latitude
    sumLon += outage.longitude
  }

  const center: Point = [sumLat / cluster.length, sumLon / cluster.length]
  const radius = cluster.reduce((max, outage) => {
    const distance = haversineDistance(center, [outage.latitude, outage.longitude])
    return Math.max(max, distance)
  }, 0)
  const providers = Array.from(new Set(cluster.map((outage) => outage.provider)))
  const polygon = cluster.find((outage) => outage.polygon)?.polygon ?? null
  const ts = cluster.reduce((latest, outage) => Math.max(latest, outage.ts), cluster[0]!.ts)

  return {
    outages: cluster,
    center,
    radius,
    providers,
    polygon,
    ts,
  }
}

const haversineDistance = (a: Point, b: Point): number => {
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((b[1] - a[1]) * Math.PI) / 180

  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

export function minimumEnclosingCircle(points: Point[]): Circle {
  const distanceSquared = (p1: Point, p2: Point): number => {
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    return dx * dx + dy * dy
  }

  const distance = (p1: Point, p2: Point): number => Math.sqrt(distanceSquared(p1, p2))

  const isInCircle = (p: Point, circle: Circle): boolean => {
    const [center, radius] = circle
    return distanceSquared(p, center) <= radius * radius + 1e-8
  }

  const circleFromTwoPoints = (p: Point, q: Point): Circle => {
    const center: Point = [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5]
    const radius = distance(p, center)
    return [center, radius]
  }

  const circleFromThreePoints = (p: Point, q: Point, r: Point): Circle | null => {
    const [ax, ay] = p
    const [bx, by] = q
    const [cx, cy] = r

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if (Math.abs(d) < 1e-10) {
      return null
    }

    const aSq = ax * ax + ay * ay
    const bSq = bx * bx + by * by
    const cSq = cx * cx + cy * cy

    const ux = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d
    const uy = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d

    const center: Point = [ux, uy]
    const radius = distance(p, center)
    return [center, radius]
  }

  const circleCache = new Map<string, Circle>()
  const getCachedCircle = (pts: Point[], createCircleFn: () => Circle): Circle => {
    const key = pts
      .map((pt) => pt.join(','))
      .sort()
      .join('|')
    if (!circleCache.has(key)) {
      circleCache.set(key, createCircleFn())
    }
    return circleCache.get(key) as Circle
  }

  const welzl = (pts: Point[], R: Point[]): Circle => {
    if (pts.length === 0 || R.length === 3) {
      if (R.length === 0) return [[0, 0], 0]
      if (R.length === 1) return [R[0] as Point, 0]
      if (R.length === 2) {
        const [p0, p1] = R as [Point, Point]
        return getCachedCircle([p0, p1], () => circleFromTwoPoints(p0, p1))
      }

      return getCachedCircle([...R], () => {
        const [p0, p1, p2] = R as [Point, Point, Point]
        const circ = circleFromThreePoints(p0, p1, p2)
        if (circ) return circ

        let fallback = circleFromTwoPoints(p0, p1)
        const distSq = distanceSquared(p2, fallback[0])
        const radSq = fallback[1] * fallback[1]

        if (distSq > radSq) {
          fallback = circleFromTwoPoints(p0, p2)
          if (distanceSquared(p1, fallback[0]) > fallback[1] * fallback[1]) {
            fallback = circleFromTwoPoints(p1, p2)
          }
        }
        return fallback
      })
    }

    const p = pts[pts.length - 1] as Point
    pts.length -= 1

    const circle = welzl(pts, R)

    if (isInCircle(p, circle)) {
      pts.push(p)
      return circle
    }

    R.push(p)
    const result = welzl(pts, R)
    R.pop()
    pts.push(p)
    return result
  }

  const shuffleArray = (array: Point[]): Point[] => {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = result[i] as Point
      result[i] = result[j] as Point
      result[j] = temp
    }
    return result
  }

  if (circleCache.size > 1000) {
    circleCache.clear()
  }

  const shuffledPoints = shuffleArray(points)
  return welzl(shuffledPoints, [])
}

export const formatDate = (input: number | string | Date): string => {
  let value: Date

  if (input instanceof Date) {
    value = input
  } else if (typeof input === 'number') {
    const normalized = input.toString().length === 10 ? input * 1000 : input
    value = new Date(normalized)
  } else {
    const parsed = Number(input)
    if (!Number.isNaN(parsed)) {
      const normalized = input.trim().length === 10 ? parsed * 1000 : parsed
      value = new Date(normalized)
    } else {
      value = new Date(input)
    }
  }

  return moment(value).format('MMM D, YYYY h:mm:ss a')
}

export type { Point, Circle }
