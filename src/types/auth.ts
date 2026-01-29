export interface User {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

export interface Customer {
  id: number
  email: string
  company: string
  planId: string
  createdAt: string
  updatedAt: string
}

export interface SubscriptionDetails {
  status: string
  price_id: string | null
  current_period_end: number | null
  cancel_at: number | null
  trial_end: number | null
}

export interface SubscriptionResponse {
  has_subscription: boolean
  subscription: SubscriptionDetails | null
}

export interface BillingPlan {
  price_id: string
  product_id: string | null
  name: string
  description: string | null
  currency: string | null
  unit_amount: number | null
  interval: string | null
  interval_count: number | null
  features: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export interface PortalSessionResponse {
  url: string
}
