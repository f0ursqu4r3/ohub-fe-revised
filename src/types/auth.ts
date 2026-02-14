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
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

export interface SubscriptionDetails {
  status: string
  priceId: string | null
  currentPeriodEnd: number | null
  cancelAt: number | null
  trialEnd: number | null
}

export interface SubscriptionResponse {
  hasSubscription: boolean
  subscription: SubscriptionDetails | null
}

export interface BillingPlan {
  priceId: string | null
  productId: string | null
  name: string
  description: string | null
  currency: string | null
  unitAmount: number | null
  interval: string | null
  intervalCount: number | null
  features: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export interface PortalSessionResponse {
  url: string
}
