import { watch } from 'vue'
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import { useProviderStore } from '@/stores/provider'

/** Resolves once the auth store finishes loading (no polling). */
function waitForAuth(authStore: ReturnType<typeof useAuthStore>): Promise<void> {
  if (!authStore.isLoading) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const stop = watch(
      () => authStore.isLoading,
      (loading) => {
        if (!loading) {
          stop()
          resolve()
        }
      },
      { immediate: true },
    )
  })
}

export const subscriptionGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()
  const billingStore = useBillingStore()

  // Wait for auth to be ready
  await waitForAuth(authStore)

  // If not authenticated, let authGuard handle it
  if (!authStore.isAuthenticated) {
    next()
    return
  }

  // Fetch plans to check isFreeMode
  if (billingStore.plans.length === 0) {
    await billingStore.fetchPlans()
  }

  // Allow access if in free mode
  if (billingStore.isFreeMode) {
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
  await waitForAuth(authStore)

  // If not authenticated, let authGuard handle it
  if (!authStore.isAuthenticated) {
    next()
    return
  }

  // Fetch plans to check isFreeMode
  if (billingStore.plans.length === 0) {
    await billingStore.fetchPlans()
  }

  // If in free mode, redirect to developer portal
  if (billingStore.isFreeMode) {
    next({ name: 'getting-started' })
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
  const billingStore = useBillingStore()

  // Wait for auth to be ready
  await waitForAuth(authStore)

  if (authStore.isAuthenticated) {
    // Fetch plans to check isFreeMode
    if (billingStore.plans.length === 0) {
      await billingStore.fetchPlans()
    }

    // If in free mode, go directly to developer portal
    if (billingStore.isFreeMode) {
      next({ name: 'getting-started' })
    } else {
      next({ name: 'subscribe' })
    }
  } else {
    next()
  }
}

export const adminGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()

  await waitForAuth(authStore)

  if (!authStore.isAuthenticated) {
    next()
    return
  }

  if (!authStore.customer) {
    await authStore.fetchCustomer()
  }

  if (authStore.isAdmin) {
    next()
  } else {
    next({ name: 'map' })
  }
}

export const providerGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()
  const providerStore = useProviderStore()

  // Wait for auth to be ready
  await waitForAuth(authStore)

  // If not authenticated, let authGuard handle it
  if (!authStore.isAuthenticated) {
    next()
    return
  }

  // Fetch memberships if not already loaded
  if (!providerStore.isMembershipsLoaded) {
    await providerStore.fetchMemberships()
  }

  if (providerStore.isProviderMember) {
    next()
  } else {
    next({ name: 'map' })
  }
}
