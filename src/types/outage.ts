export interface Outage {
  id: number
  provider: string
  latitude: number
  longitude: number
  polygon: string | null // WKT POLYGON or MULTIPOLYGON
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
