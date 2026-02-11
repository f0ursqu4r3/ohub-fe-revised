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
