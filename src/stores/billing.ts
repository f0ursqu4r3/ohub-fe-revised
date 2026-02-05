import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type { SubscriptionResponse, BillingPlan, PortalSessionResponse } from '@/types/auth'

const VALID_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due']

export const useBillingStore = defineStore('billing', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  const subscription = ref<SubscriptionResponse | null>(null)
  const plans = ref<BillingPlan[]>([])
  const isFreeMode = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const hasValidSubscription = computed(() => {
    if (!subscription.value?.hasSubscription) return false
    const status = subscription.value.subscription?.status
    return status ? VALID_SUBSCRIPTION_STATUSES.includes(status) : false
  })

  const fetchSubscription = async () => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/billing/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch subscription')
      subscription.value = await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/billing/plans`)
      if (!response.ok) throw new Error('Failed to fetch plans')
      const data = await response.json()
      plans.value = data.plans ?? []
      isFreeMode.value = data.isFreeMode ?? false
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    }
  }

  const openBillingPortal = async () => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/billing/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to open billing portal')
      const data: PortalSessionResponse = await response.json()
      window.location.href = data.url
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const currentPlan = computed(() => {
    if (!subscription.value?.subscription?.priceId) return null
    return plans.value.find((p) => p.priceId === subscription.value?.subscription?.priceId)
  })

  const createCheckout = async (priceId: string) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price: priceId, trialDays: 14 }),
      })
      if (!response.ok) throw new Error('Failed to create checkout session')
      const data: { url: string } = await response.json()
      window.location.href = data.url
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  return {
    subscription,
    plans,
    isFreeMode,
    isLoading,
    error,
    hasValidSubscription,
    currentPlan,
    fetchSubscription,
    fetchPlans,
    openBillingPortal,
    createCheckout,
  }
})
