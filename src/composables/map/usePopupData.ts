import { POPUP_MAX_ITEMS } from '@/config/map'
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

    const items = sortedOutages.slice(0, POPUP_MAX_ITEMS).map((entry, idx) => {
      const { outage, areaKm2, durationSeconds } = entry
      const nickname = nicknameForIndex(idx)
      const areaLabel = areaKm2 > 0.1 ? `${Math.round(areaKm2)} km²` : null
      const durationMinutes = Math.round(durationSeconds / 60)
      const durationLabel = durationMinutes > 0 ? `${durationMinutes} min` : null
      const sizeLabel = areaLabel ?? durationLabel ?? undefined
      const bounds =
        entry.bounds ?? groupBounds ?? fallbackPointBounds(outage.latitude, outage.longitude)
      return {
        provider: outage.provider,
        nickname,
        bounds,
        sizeLabel,
        outageType: outage.outage_type ?? null,
        cause: outage.cause ?? null,
        customerCount: outage.customer_count ?? null,
        isPlanned: outage.is_planned ?? null,
        etr: outage.etr_local || outage.etr_utc || outage.etr_tz || null,
      }
    })
    const extraCount = Math.max(0, outages.length - POPUP_MAX_ITEMS)

    return {
      title,
      timeLabel,
      items,
      extraCount,
      geoJsonText: geometry ? JSON.stringify(geometry) : null,
      coordsText: group.polygon ?? null,
    }
  }

  return { buildPopupData }
}
