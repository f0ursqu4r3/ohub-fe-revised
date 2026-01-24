export interface ApiKey {
  id: number
  customerId: number
  apiKey: string
  note: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

export interface ApiKeyCreateRequest {
  note?: string
}

export interface ApiKeyUpdateRequest {
  note?: string
}
