import Supercluster, { type ClusterFeature, type PointFeature } from 'supercluster'
import type { Feature, GeoJsonObject, MultiPolygon, Polygon } from 'geojson'
import type { Outage } from '@/types/outage'

const EARTH_RADIUS_KM = 6371
const CANADA_BOUNDS_BBOX: [number, number, number, number] = [-170, 10, -40, 90]
const CLUSTER_ZOOM_RANGE: [number, number] = [4, 16] // start easing clustering at 4, end right before singletons
const CLUSTER_RADIUS_PX_RANGE: [number, number] = [64, 18] // heavy grouping at low zoom, light at high zoom
const CLUSTER_CACHE_LIMIT = 8

type OutageFeatureProps = {
  outage: Outage
}

type ClusterProperties = {
  cluster: true
  cluster_id: number
  point_count: number
  point_count_abbreviated: string
}

export type Point = [number, number]
export type Circle = [Point, number]
export type GeoPolygon = Polygon | MultiPolygon

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
  const validOutages = outages.filter(
    (o) =>
      Number.isFinite(o.latitude) &&
      Number.isFinite(o.longitude) &&
      Math.abs(o.latitude) <= 90 &&
      Math.abs(o.longitude) <= 180,
  )
  if (!validOutages.length) {
    return []
  }

  const radiusPx = clusterRadiusForZoom(zoomLevel)
  const index = getClusterIndex(validOutages, radiusPx)

  const clusters = index.getClusters(CANADA_BOUNDS_BBOX, Math.round(zoomLevel))

  return clusters
    .map((feature: PointFeature<OutageFeatureProps> | ClusterFeature<ClusterProperties>) => {
      if (isClusterFeature(feature)) {
        const clusterId = feature.properties.cluster_id
        const leaves = index.getLeaves(clusterId, validOutages.length)
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

/**
 * Returns a pixel radius for clustering that eases down as you zoom in, so
 * clusters break apart earlier at mid/high zoom levels.
 */
const clusterRadiusForZoom = (zoom: number): number => {
  const [zMin, zMax] = CLUSTER_ZOOM_RANGE
  const [rMax, rMin] = CLUSTER_RADIUS_PX_RANGE
  const t = clamp((zoom - zMin) / (zMax - zMin), 0, 1)
  const eased = t * t // bias toward keeping larger radius at low zooms
  const radius = rMax + (rMin - rMax) * eased
  return Math.max(8, Math.round(radius))
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const clusterIndexCache = new Map<string, Supercluster<OutageFeatureProps, ClusterProperties>>()

const makeClusterCacheKey = (outages: Outage[], radiusPx: number): string =>
  `${radiusPx}:${outages
    .map(
      (o) =>
        `${o.id}:${o.latitude.toFixed(4)},${o.longitude.toFixed(4)}:${o.ts}:${o.startTs ?? ''}:${o.endTs ?? ''}`,
    )
    .join('|')}`

const buildClusterIndex = (
  outages: Outage[],
  radiusPx: number,
): Supercluster<OutageFeatureProps, ClusterProperties> => {
  const index = new Supercluster<OutageFeatureProps, ClusterProperties>({
    radius: radiusPx,
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
  return index
}

const getClusterIndex = (
  outages: Outage[],
  radiusPx: number,
): Supercluster<OutageFeatureProps, ClusterProperties> => {
  const cacheKey = makeClusterCacheKey(outages, radiusPx)
  const cached = clusterIndexCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const index = buildClusterIndex(outages, radiusPx)
  clusterIndexCache.set(cacheKey, index)

  if (clusterIndexCache.size > CLUSTER_CACHE_LIMIT) {
    const firstKey = clusterIndexCache.keys().next().value
    if (firstKey) {
      clusterIndexCache.delete(firstKey)
    }
  }

  return index
}

/**
 * Determines whether the provided feature is a cluster feature by checking
 * for the presence of the `cluster` flag in its properties.
 *
 * @param feature - The feature to evaluate.
 * @returns `true` if the feature represents a cluster; otherwise, `false`.
 */
const isClusterFeature = (
  feature: PointFeature<OutageFeatureProps> | ClusterFeature<ClusterProperties>,
): feature is ClusterFeature<ClusterProperties> =>
  Boolean(feature.properties && 'cluster' in feature.properties)

/**
 * Summarizes a cluster of outages into a `GroupedOutage`.
 *
 * @param cluster - An array of outage objects to summarize.
 * @returns A `GroupedOutage` that includes the computed center point, maximum radius, list of providers, optional polygon, timestamp, and the original outages.
 */
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
  const polygons = cluster
    .map((outage) => outage.polygon)
    .filter((poly): poly is string => Boolean(poly))
  const polygon = polygons.length ? mergePolygons(polygons) : null
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

/**
 * Calculates the great-circle distance between two geographic points using the
 * Haversine formula.
 *
 * @param a - The first point specified as a tuple `[latitude, longitude]` in decimal degrees.
 * @param b - The second point specified as a tuple `[latitude, longitude]` in decimal degrees.
 * @returns The distance between the two points in kilometers.
 */
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

/**
 * Computes the minimum enclosing circle that contains all provided points using
 * Welzl's randomized algorithm. Intermediate helper routines construct circles
 * from two or three boundary points and cache computed circles to avoid redundant
 * calculations. Input points are shuffled before running the recursive algorithm,
 * so the result may vary slightly between invocations due to floating-point
 * precision, but it will always return the smallest circle that encloses all
 * given points.
 *
 * @param points - An array of 2D points represented as `[x, y]`.
 * @returns The enclosing circle represented as `[center, radius]`, where
 * `center` is a point `[x, y]` and `radius` is the distance from the center to
 * the circle boundary.
 */
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

  /**
   * Computes a circle defined by two points lying on its diameter.
   *
   * @param p - The first endpoint of the diameter.
   * @param q - The second endpoint of the diameter.
   * @returns A tuple containing the circle's center point and its radius.
   */
  const circleFromTwoPoints = (p: Point, q: Point): Circle => {
    const center: Point = [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5]
    const radius = distance(p, center)
    return [center, radius]
  }

  /**
   * Computes the unique circle passing through three non-collinear points.
   *
   * @param p - First point on the circle.
   * @param q - Second point on the circle.
   * @param r - Third point on the circle.
   * @returns The circle defined by its center and radius, or `null` if the points are collinear.
   */
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

  const CIRCLE_CACHE = new Map<string, Circle>()
  /**
   * Retrieves or creates a cached circle for the specified points.
   *
   * @param pts - The array of points defining the circle, used to generate a cache key.
   * @param createCircleFn - A callback that creates the circle if it is not already cached.
   * @returns The circle instance associated with the provided points, either from cache or newly created.
   */
  const getCachedCircle = (pts: Point[], createCircleFn: () => Circle): Circle => {
    const key = pts
      .map((pt) => pt.join(','))
      .sort()
      .join('|')
    if (!CIRCLE_CACHE.has(key)) {
      CIRCLE_CACHE.set(key, createCircleFn())
    }
    return CIRCLE_CACHE.get(key) as Circle
  }

  /**
   * Computes the minimum enclosing circle for a set of points using Welzl's randomized algorithm.
   *
   * @param pts - The array of points still to be processed. This array is modified during execution.
   * @param R - The array of boundary points defining the current circle. This array is mutated and restored by recursive calls.
   * @returns The smallest circle that encloses all points from the original set.
   */
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

  /**
   * Returns a new array containing the elements of the provided point array
   * in randomized order using the Fisher-Yates shuffle algorithm.
   *
   * @param array - The array of points to shuffle.
   * @returns A new array with the points shuffled.
   */
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

  if (CIRCLE_CACHE.size > 1000) {
    CIRCLE_CACHE.clear()
  }

  const shuffledPoints = shuffleArray(points)
  return welzl(shuffledPoints, [])
}

/**
 * Formats various date inputs into a human-readable string.
 *
 * @param input - The value to format, which can be a Date instance, a timestamp (in seconds or milliseconds), or a string representation of a date or numeric timestamp.
 * @returns A formatted date string in the "MMM D, YYYY h:mm:ss a" format.
 */
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

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)
}

/**
 * Merges multiple WKT polygon strings into a single MULTIPOLYGON representation.
 *
 * @param polygons - An array of WKT polygon strings.
 * @returns A WKT MULTIPOLYGON string if there is at least one valid polygon; otherwise, null.
 */
export const mergePolygons = (polygons: string[]): string | null => {
  if (polygons.length === 0) {
    return null
  }
  if (polygons.length === 1) {
    return stripSrid(polygons[0]!)
  }

  const wktPolygons = polygons
    .map((wkt) => stripSrid(wkt).replace(/^POLYGON/i, '').trim())
    .filter((wkt) => wkt.length > 0)

  if (wktPolygons.length === 0) {
    return null
  }

  const mergedWkt = `MULTIPOLYGON(${wktPolygons.map((poly) => `(${poly})`).join(', ')})`
  return mergedWkt
}

/**
 * Parses a WKT POLYGON or MULTIPOLYGON string into polygons with support for holes.
 *
 * @param wkt - The WKT string representing a POLYGON or MULTIPOLYGON geometry.
 * @returns An array of polygons, where each polygon is an array of rings, and each ring is an array of `[latitude, longitude]` points.
 *
 * @example
 * ```ts
 * const wkt = 'POLYGON ((30 10, 40 40, 20 40, 10 20, 30 10))';
 * const polygons = parsePolygonWKT(wkt);
 * // [
 * //   [
 * //     [10, 30],
 * //     [40, 40],
 * //     [40, 20],
 * //     [20, 10],
 * //     [10, 30],
 * //   ],
 * // ]
 * ```
 */
export const parsePolygonWKT = (wkt: string): Point[][][] => {
  const normalized = stripSrid(wkt)
  if (!normalized) return []

  const upper = normalized.toUpperCase()
  const isMulti = upper.startsWith('MULTIPOLYGON')
  const isSingle = upper.startsWith('POLYGON')
  if (!isMulti && !isSingle) return []

  const body = trimParens(
    normalized.replace(/^MULTIPOLYGON/i, '').replace(/^POLYGON/i, '').trim(),
  )
  const polygonStrings = isMulti ? splitTopLevelSegments(body) : [body]

  return polygonStrings
    .map((polyStr) => {
      const ringStrings = splitTopLevelSegments(trimParens(polyStr))
      const rings = ringStrings
        .map((ring) => parseRing(ring))
        .filter((ring) => ring.length > 2)
      return rings.length ? rings : null
    })
    .filter((poly): poly is Point[][] => Boolean(poly))
}

export const wktToGeoJSON = (wkt: string): GeoPolygon | null => {
  const polygons = parsePolygonWKT(wkt)
  if (!polygons.length) return null

  if (polygons.length === 1) {
    return {
      type: 'Polygon',
      coordinates: polygons[0]!.map((ring) => ring.map(([lat, lon]) => [lon, lat])),
    }
  }

  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((poly) => poly.map((ring) => ring.map(([lat, lon]) => [lon, lat]))),
  }
}

const stripSrid = (wkt: string): string => {
  const trimmed = wkt.trim()
  const sridIndex = trimmed.indexOf(';')
  if (sridIndex !== -1 && trimmed.toUpperCase().startsWith('SRID=')) {
    return trimmed.slice(sridIndex + 1).trim()
  }
  return trimmed
}

const trimParens = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const splitTopLevelSegments = (input: string): string[] => {
  const segments: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      segments.push(input.slice(start, i).trim())
      start = i + 1
    }
  }

  const tail = input.slice(start).trim()
  if (tail) segments.push(tail)
  return segments
}

const parseRing = (ringStr: string): Point[] => {
  const ringBody = trimParens(ringStr)
  return ringBody
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [lonStr = '0', latStr = '0'] = pair.split(/\s+/).filter(Boolean)
      const lat = Number.parseFloat(latStr)
      const lon = Number.parseFloat(lonStr)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null
      }
      return [lat, lon] as Point
    })
    .filter((point): point is Point => Boolean(point))
}
