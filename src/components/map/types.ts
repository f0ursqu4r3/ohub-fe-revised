import type { Polygon, MultiPolygon } from 'geojson'
import type { BoundsLiteral, GroupedOutage } from '@/lib/utils'
import type { UserOutageReport } from '@/types/userOutage'

// Re-export for convenience
export type { BoundsLiteral }

export type PopupItem = {
  id: string | number
  provider: string
  nickname: string
  bounds: BoundsLiteral | null
  areaLabel?: string
  outageType?: string | null
  cause?: string | null
  customerCount?: number | null
  isPlanned?: boolean | null
  etr?: string | null
  /** User report fields */
  notes?: string | null
  reportedAt?: string | null
  /** 'outage' (default) or 'userOutage' — used for feedback targetType */
  targetType?: 'outage' | 'userOutage'
}

export type PopupData = {
  title: string
  startTs?: number
  timeLabel: string
  items: PopupItem[]
  extraCount: number
  geoJsonText?: string | null
  coordsText?: string | null
}

export type MarkerData = {
  lat: number
  lng: number
  /** Pre-computed popup data (legacy) */
  popupData?: PopupData
  /** Outage group for lazy popup computation */
  outageGroup?: GroupedOutage
  /** Block timestamp for lazy popup computation */
  blockTs?: number | null
  count?: number
}

export type PolygonData = {
  geometry: Polygon | MultiPolygon
  isCluster: boolean
}

export type ReportMarkerData = {
  lat: number
  lng: number
  count: number
  reports: UserOutageReport[]
}
