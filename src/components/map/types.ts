import type { Polygon, MultiPolygon } from 'geojson'

export type BoundsLiteral = [[number, number], [number, number]]

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
