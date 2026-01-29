import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type { SubscriptionResponse, BillingPlan, PortalSessionResponse } from '@/types/auth'

export const useBillingStore = defineStore('billing', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  const subscription = ref<SubscriptionResponse | null>(null)
  const plans = ref<BillingPlan[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
      plans.value = await response.json()
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

  const currentPlan = () => {
    if (!subscription.value?.subscription?.price_id) return null
    return plans.value.find((p) => p.price_id === subscription.value?.subscription?.price_id)
  }

  return {
    subscription,
    plans,
    isLoading,
    error,
    fetchSubscription,
    fetchPlans,
    openBillingPortal,
    currentPlan,
  }
})
