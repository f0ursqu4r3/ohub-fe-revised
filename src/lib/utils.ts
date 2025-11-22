import moment from 'moment'
import type { Outage } from '@/types/outage'

type Point = [number, number]
type Circle = [Point, number]
type KilometerPoint = [number, number]
const EARTH_RADIUS_KM = 6371

export type GroupedOutage = {
  outages: Outage[]
  center: Point
  radius: number
  providers: string[]
  polygon: string | null
  ts: number
}

/**
 * Clusters outages based on spatial proximity using a grid-based spatial index.
 *
 * This function bins outages into grid cells determined by the provided threshold and
 * performs a depth-first search to build clusters of outages that fall within the
 * compared threshold distance of one another. Each cluster is summarized with its
 * minimum enclosing circle, unique providers, an optional polygon, and the most recent
 * timestamp.
 *
 * @param outages - The list of outages to process into clusters.
 * @param threshold - The distance threshold used for determining proximity (in kilometers).
 * @returns An array of grouped outage summaries including cluster metadata.
 */
export const clusterOutages = (outages: Outage[], thresholdKm: number): GroupedOutage[] => {
  const thresholdSquared = thresholdKm * thresholdKm

  const toKilometerCoords = (lat: number, lon: number): KilometerPoint => {
    const latRadians = (lat * Math.PI) / 180
    const latKm = lat * 111.32
    const lonKm = lon * 111.32 * Math.cos(latRadians)
    return [latKm, lonKm]
  }

  const projected: KilometerPoint[] = outages.map((outage) =>
    toKilometerCoords(outage.latitude, outage.longitude),
  )

  const isWithinThreshold = (i: number, j: number): boolean => {
    const coordA = projected[i]
    const coordB = projected[j]
    if (!coordA || !coordB) return false
    const dx = coordB[0] - coordA[0]
    const dy = coordB[1] - coordA[1]
    return dx * dx + dy * dy <= thresholdSquared
  }

  const grouped: GroupedOutage[] = []
  const visited = new Set<number>()
  const spatialIndex = new Map<string, number[]>()
  const cellSize = thresholdKm

  const cellKey = (x: number, y: number): string => `${x},${y}`

  outages.forEach((outage, idx) => {
    const coords = projected[idx]
    if (!coords) return
    const [x, y] = coords
    const cellX = Math.floor(x / cellSize)
    const cellY = Math.floor(y / cellSize)

    for (let nx = cellX - 1; nx <= cellX + 1; nx += 1) {
      for (let ny = cellY - 1; ny <= cellY + 1; ny += 1) {
        const key = cellKey(nx, ny)
        if (!spatialIndex.has(key)) {
          spatialIndex.set(key, [])
        }
        spatialIndex.get(key)?.push(idx)
      }
    }
  })

  outages.forEach((_, i) => {
    if (visited.has(i)) return

    const cluster: Outage[] = []
    const stack: number[] = [i]

    while (stack.length > 0) {
      const idx = stack.pop()
      if (idx === undefined || visited.has(idx)) {
        continue
      }

      const outage = outages[idx]
      if (!outage) {
        continue
      }

      visited.add(idx)
      cluster.push(outage)

      const coords = projected[idx]
      if (!coords) {
        continue
      }

      const [x, y] = coords
      const cellX = Math.floor(x / cellSize)
      const cellY = Math.floor(y / cellSize)
      const potentialNeighbors = spatialIndex.get(cellKey(cellX, cellY)) ?? []

      for (const j of potentialNeighbors) {
        if (visited.has(j)) continue
        const neighbor = outages[j]
        if (!neighbor) continue
        if (isWithinThreshold(idx, j)) {
          stack.push(j)
        }
      }
    }

    if (!cluster.length) {
      return
    }

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

    grouped.push({
      outages: cluster,
      center,
      radius,
      providers,
      polygon,
      ts,
    })
  })

  return grouped
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
