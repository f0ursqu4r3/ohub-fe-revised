import {
  computeBoundsAndArea,
  fallbackPointBounds,
  formatDate,
  wktToGeoJSON,
  type GroupedOutage,
} from '@/lib/utils'
import type { PopupData } from '@/components/map/types'

export const usePopupData = () => {
  const buildPopupData = (group: GroupedOutage, blockTs: number | null): PopupData | undefined => {
    const outages = group.outages
    if (!outages.length) return undefined

    const title =
      outages.length === 1 ? (outages[0]?.provider ?? 'Outage') : `${outages.length} events`
    const startTs = outages.reduce(
      (earliest, outage) => Math.min(earliest, outage.startTs),
      outages[0]!.startTs,
    )
    const timeLabel = formatDate(startTs)
    const geometry = group.polygon ? wktToGeoJSON(group.polygon) : null
    const groupAreaInfo = geometry ? computeBoundsAndArea(geometry) : { bounds: null, areaKm2: 0 }
    const groupBounds = groupAreaInfo.bounds
    const scoredOutages = outages.map((outage) => {
      const outageGeometry = outage.polygon ? wktToGeoJSON(outage.polygon) : null
      const outageAreaInfo = outageGeometry
        ? computeBoundsAndArea(outageGeometry)
        : { bounds: null, areaKm2: 0 }
      const areaKm2 = outageAreaInfo.areaKm2
      const durationSeconds = Math.max(0, (outage.endTs ?? blockTs ?? outage.ts) - outage.startTs)
      const score = areaKm2 * 2 + durationSeconds // weight area a bit higher than duration
      return {
        outage,
        areaKm2,
        bounds: outageAreaInfo.bounds,
        durationSeconds,
        score,
      }
    })

    const sortedOutages = scoredOutages
      .slice()
      .sort(
        (a, b) =>
          (b.score || 0) - (a.score || 0) || a.outage.provider.localeCompare(b.outage.provider),
      )

    const nicknameForIndex = (idx: number) => {
      const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const letter = alpha[idx % alpha.length]
      const suffix = idx >= alpha.length ? Math.floor(idx / alpha.length) + 1 : ''
      return `Outage ${letter}${suffix}`
    }

    const items = sortedOutages.map((entry, idx) => {
      const { outage, areaKm2 } = entry
      const nickname = nicknameForIndex(idx)
      const areaLabel = areaKm2 > 0.1 ? `${Math.round(areaKm2)} km²` : null
      const areaLabelStr = areaLabel ?? undefined
      const bounds =
        entry.bounds ?? groupBounds ?? fallbackPointBounds(outage.latitude, outage.longitude)
      return {
        id: outage.id,
        provider: outage.provider,
        nickname,
        bounds,
        areaLabel: areaLabelStr,
        outageType: outage.outageType ?? null,
        cause: outage.cause ?? null,
        customerCount: outage.customerCount ?? null,
        isPlanned: outage.isPlanned ?? null,
        etr: formatDate(outage.etrLocal || outage.etrUtc || outage.etrTz || null),
      }
    })

    return {
      title,
      timeLabel,
      startTs,
      items,
      extraCount: 0,
      geoJsonText: geometry ? JSON.stringify(geometry) : null,
      coordsText: group.polygon ?? null,
    }
  }

  return { buildPopupData }
}
