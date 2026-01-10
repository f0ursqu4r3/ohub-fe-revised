import type { Polygon, MultiPolygon } from 'geojson'
import type { BoundsLiteral } from '@/lib/utils'

// Re-export for convenience
export type { BoundsLiteral }

export type PopupItem = {
  provider: string
  nickname: string
  bounds: BoundsLiteral | null
  sizeLabel?: string
}

export type PopupData = {
  title: string
  timeLabel: string
  items: PopupItem[]
  extraCount: number
  geoJsonText?: string | null
  coordsText?: string | null
}

export type MarkerData = {
  lat: number
  lng: number
  popupData?: PopupData
  count?: number
}

export type PolygonData = {
  geometry: Polygon | MultiPolygon
  isCluster: boolean
}
