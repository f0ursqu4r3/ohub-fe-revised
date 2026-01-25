export interface ApiKey {
  apiKey: string
  note: string | null
  expiresAt: number | null
}

export interface ApiKeyCreateRequest {
  note?: string
}

export interface ApiKeyUpdateRequest {
  note?: string
}
