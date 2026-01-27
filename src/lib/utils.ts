import Supercluster, { type ClusterFeature, type PointFeature } from 'supercluster'
import type { MultiPolygon, Polygon } from 'geojson'
import type { Outage } from '@/types/outage'

export type BoundsLiteral = [[number, number], [number, number]]

const EARTH_RADIUS_KM = 6371
const KM_PER_DEGREE = 111.32
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

/**
 * Creates a cache key for the cluster index.
 * Uses a simpler, faster key based on outage IDs and count rather than all data.
 */
const makeClusterCacheKey = (outages: Outage[], radiusPx: number): string => {
  // Sort IDs for consistent keys regardless of input order
  const ids = outages.map((o) => o.id).sort((a, b) => a - b)
  return `${radiusPx}:${ids.length}:${ids.join(',')}`
}

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
 * Formats various date inputs into a human-readable string.
 *
 * @param input - The value to format, which can be a Date instance, a timestamp (in seconds or milliseconds), or a string representation of a date or numeric timestamp.
 * @returns A formatted date string in the "MMM D, YYYY h:mm:ss a" format.
 */
export const formatDate = (input: number | string | Date | null): string => {
  if (input === null) {
    return ''
  }

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
    .map((wkt) =>
      stripSrid(wkt)
        .replace(/^POLYGON/i, '')
        .trim(),
    )
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
    normalized
      .replace(/^MULTIPOLYGON/i, '')
      .replace(/^POLYGON/i, '')
      .trim(),
  )
  const polygonStrings = isMulti ? splitTopLevelSegments(body) : [body]

  return polygonStrings
    .map((polyStr) => {
      const ringStrings = splitTopLevelSegments(polyStr)
      const rings = ringStrings.map((ring) => parseRing(ring)).filter((ring) => ring.length > 2)
      return rings.length ? rings : null
    })
    .filter((poly): poly is Point[][] => Boolean(poly))
}

export const wktToGeoJSON = (wkt: string): GeoPolygon | null => {
  // Check cache first
  const cached = wktCache.get(wkt)
  if (cached !== undefined) return cached

  const polygons = parsePolygonWKT(wkt)
  if (!polygons.length) {
    wktCache.set(wkt, null)
    return null
  }

  let result: GeoPolygon
  if (polygons.length === 1) {
    result = {
      type: 'Polygon',
      coordinates: polygons[0]!.map((ring) => ring.map(([lat, lon]) => [lon, lat])),
    }
  } else {
    result = {
      type: 'MultiPolygon',
      coordinates: polygons.map((poly) => poly.map((ring) => ring.map(([lat, lon]) => [lon, lat]))),
    }
  }

  wktCache.set(wkt, result)
  return result
}

// WKT parse cache - stores parsed GeoJSON by WKT string
const wktCache = new Map<string, GeoPolygon | null>()

/** Clear the WKT parse cache (useful when switching datasets) */
export const clearWktCache = (): void => {
  wktCache.clear()
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

// ─────────────────────────────────────────────────────────────
// Geometry Bounds & Area Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Computes the bounding box and approximate area of a GeoJSON polygon.
 * Uses a fast approximation based on bounding box with latitude-adjusted longitude span.
 *
 * @param geometry - A GeoJSON Polygon or MultiPolygon
 * @returns An object containing the bounds as [[minLat, minLon], [maxLat, maxLon]] and area in km²
 */
export const computeBoundsAndArea = (
  geometry: GeoPolygon,
): { bounds: BoundsLiteral | null; areaKm2: number } => {
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.coordinates.flatMap((poly) => poly)

  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLon = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY

  for (const ring of rings) {
    for (const coordinate of ring) {
      const lon = Number(coordinate?.[0])
      const lat = Number(coordinate?.[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLon = Math.min(minLon, lon)
      maxLon = Math.max(maxLon, lon)
    }
  }

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon)
  ) {
    return { bounds: null, areaKm2: 0 }
  }

  const latSpan = Math.max(0, maxLat - minLat)
  const lonSpan = Math.max(0, maxLon - minLon)
  if (latSpan === 0 || lonSpan === 0) {
    return {
      bounds: [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      areaKm2: 0,
    }
  }

  const meanLat = (minLat + maxLat) / 2
  const widthKm = Math.abs(lonSpan * Math.cos((meanLat * Math.PI) / 180) * KM_PER_DEGREE)
  const heightKm = Math.abs(latSpan * KM_PER_DEGREE)
  const areaKm2 = Math.max(0, widthKm * heightKm)

  return {
    bounds: [
      [minLat, minLon],
      [maxLat, maxLon],
    ],
    areaKm2,
  }
}

/**
 * Creates a small bounding box around a single point for fallback cases.
 *
 * @param lat - Latitude of the point
 * @param lon - Longitude of the point
 * @returns A small bounding box centered on the point
 */
export const fallbackPointBounds = (lat: number, lon: number): BoundsLiteral => {
  const delta = 0.01
  return [
    [lat - delta, lon - delta],
    [lat + delta, lon + delta],
  ]
}
