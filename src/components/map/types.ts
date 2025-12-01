export type PopupItem = {
  provider: string
}

export type PopupData = {
  title: string
  timeLabel: string
  items: PopupItem[]
  extraCount: number
  geoJsonText?: string | null
  coordsText?: string | null
}
