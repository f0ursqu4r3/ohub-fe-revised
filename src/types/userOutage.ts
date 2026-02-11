export interface CreateUserOutageRequest {
  latitude: number
  longitude: number
  provider?: string
  notes?: string
  cause?: string
  isPlanned?: boolean
  customerCount?: number
  observedTs?: number
  outageStartTs?: number
  locationAccuracyM?: number
  addressText?: string
  contactEmail?: string
  raw?: Record<string, unknown>
  website?: string // honeypot — always send empty
}

export interface CreateUserOutageResponse {
  id: number
  status: string
}

export interface UserOutageReport {
  id: number
  createdAt: number
  status: string
  latitude: number
  longitude: number
  addressText: string | null
  provider: string | null
  observedTs: number | null
  outageStartTs: number | null
  customerCount: number | null
  isPlanned: boolean | null
  cause: string | null
  notes: string | null
}

export interface UserOutageReportsResponse {
  reports: UserOutageReport[]
}
