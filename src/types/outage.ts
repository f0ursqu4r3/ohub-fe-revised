export interface Outage {
  id: number
  provider: string
  latitude: number
  longitude: number
  polygon: string | null // WKT POLYGON or MULTIPOLYGON
  customerCount?: number | null
  cause?: string | null
  outageType?: string | null
  isPlanned?: boolean | null
  outageStartLocal?: string | null
  outageStartTz?: string | null
  outageStartUtc?: string | null // ISO string for UTC datetime
  etrLocal?: string | null
  etrTz?: string | null
  etrUtc?: string | null // ISO string for UTC datetime
  startTs: number
  endTs: number | null
  ts: number
}

export interface OutageResponse {
  outages: Outage[]
  blocks: Record<number, OutageBlock> | OutageBlock[]
  timeInterval: TimeInterval | string
  startTs: number
  endTs: number
  minCount: number
  maxCount: number
}

export interface OutageBlock {
  ts: number
  indexes: number[]
  count?: number
}

export enum TimeInterval {
  OneMinute = '1m',
  FiveMinutes = '5m',
  FifteenMinutes = '15m',
  ThirtyMinutes = '30m',
  OneHour = '1h',
  OneDay = '24h',
  SevenDays = '7d',
  ThirtyDays = '30d',
  OneYear = '365d',
}
