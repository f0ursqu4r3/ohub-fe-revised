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
