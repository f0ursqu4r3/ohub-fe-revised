export type ProviderRole = 'viewer' | 'editor'

export interface ProviderMembership {
  provider: string
  role: ProviderRole
  timezone?: string
}

export interface ProviderOutage {
  id: number
  provider: string
  latitude: number
  longitude: number
  polygon: string | null
  startTs: number
  endTs: number | null
  isDraft: boolean
  draftedAt: string
  publishedAt: string | null
  isHidden: boolean
  hiddenAt: string | null
  deletedAt: string | null
  customerCount: number | null
  cause: string | null
  outageType: string | null
  isPlanned: boolean | null
  notes: string | null
  raw: Record<string, unknown>
  outageStartLocal: string | null
  outageStartTz: string | null
  outageStartUtc: string | null
  etrLocal: string | null
  etrTz: string | null
  etrUtc: string | null
  createdByCustomerId: number | null
  updatedByCustomerId: number | null
  createdAt: string
  updatedAt: string
}

export interface ProviderOutageCreateRequest {
  provider: string
  latitude: number
  longitude: number
  polygon?: [number, number][]
  outageStartLocal: string
  outageStartTz: string
  etrLocal?: string
  etrTz?: string
  endTs?: number
  customerCount?: number
  cause?: string
  outageType?: string
  isPlanned?: boolean
  notes?: string
  isDraft?: boolean
}

export interface ProviderOutagePatchRequest {
  latitude?: number
  longitude?: number
  polygon?: [number, number][] | null
  outageStartLocal?: string
  outageStartTz?: string
  etrLocal?: string | null
  etrTz?: string | null
  endTs?: number | null
  customerCount?: number | null
  cause?: string | null
  outageType?: string | null
  isPlanned?: boolean | null
  notes?: string | null
  isDraft?: boolean
}

export interface ProviderOutageFetchParams {
  provider?: string
  since?: number
  until?: number
  includeDrafts?: boolean
  includeHidden?: boolean
  includeDeleted?: boolean
  limit?: number
  offset?: number
}

export type OutageStatus = 'draft' | 'active' | 'hidden' | 'ended'
