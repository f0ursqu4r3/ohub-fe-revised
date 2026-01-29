import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

export const subscriptionGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()
  const billingStore = useBillingStore()

  // Wait for auth to be ready
  while (authStore.isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // If not authenticated, let authGuard handle it
  if (!authStore.isAuthenticated) {
    next()
    return
  }

  // Fetch subscription if not already loaded
  if (billingStore.subscription === null) {
    await billingStore.fetchSubscription()
  }

  // Check if user has valid subscription
  if (billingStore.hasValidSubscription) {
    next()
  } else {
    next({ name: 'subscribe' })
  }
}

export const subscribedUserGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()
  const billingStore = useBillingStore()

  // Wait for auth to be ready
  while (authStore.isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // If not authenticated, let authGuard handle it
  if (!authStore.isAuthenticated) {
    next()
    return
  }

  // Fetch subscription if not already loaded
  if (billingStore.subscription === null) {
    await billingStore.fetchSubscription()
  }

  // If user has valid subscription, redirect to developer portal
  if (billingStore.hasValidSubscription) {
    next({ name: 'getting-started' })
  } else {
    next()
  }
}

export const guestOnlyGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()

  // Wait for auth to be ready
  while (authStore.isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  if (authStore.isAuthenticated) {
    next({ name: 'subscribe' })
  } else {
    next()
  }
}
