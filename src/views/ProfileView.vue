<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const authStore = useAuthStore()
const billingStore = useBillingStore()
const { user, customer, isLoading } = storeToRefs(authStore)
const { subscription, plans, isLoading: billingLoading } = storeToRefs(billingStore)

onMounted(() => {
  if (!customer.value) authStore.fetchCustomer()
  billingStore.fetchSubscription()
  billingStore.fetchPlans()
})

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  // dateString is in epoch seconds format
  return new Date(parseInt(dateString) * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatTimestamp = (timestamp?: number | null) => {
  if (!timestamp) return 'N/A'
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const currentPlan = computed(() => {
  if (!subscription.value?.subscription?.priceId) return null
  return plans.value.find((p) => p.priceId === subscription.value?.subscription?.priceId)
})

const formatPrice = (amount: number | null, currency: string | null) => {
  if (amount === null) return 'Free'
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  })
  return formatter.format(amount / 100)
}

const statusColor = computed(() => {
  const status = subscription.value?.subscription?.status
  switch (status) {
    case 'active':
      return 'success'
    case 'trialing':
      return 'info'
    case 'past_due':
      return 'warning'
    case 'canceled':
    case 'incomplete':
      return 'error'
    default:
      return 'neutral'
  }
})

const statusLabel = computed(() => {
  const status = subscription.value?.subscription?.status
  switch (status) {
    case 'active':
      return 'Active'
    case 'trialing':
      return 'Trial'
    case 'past_due':
      return 'Past Due'
    case 'canceled':
      return 'Canceled'
    case 'incomplete':
      return 'Incomplete'
    default:
      return status || 'Unknown'
  }
})
</script>

<template>
  <div class="p-6">
    <div class="max-w-3xl space-y-6">
      <div v-if="isLoading" class="flex justify-center py-8">
        <span class="relative flex h-10 w-10">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
          ></span>
          <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
        </span>
      </div>

      <UCard v-else>
        <template #header>
          <h2 class="text-base font-semibold">Account Information</h2>
        </template>

        <div class="space-y-4">
          <div class="flex justify-center">
            <UAvatar
              :src="user?.picture"
              :alt="user?.name"
              class="h-16 w-16 rounded-full ring-2 ring-primary-500/20"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-muted">Name</label>
              <p class="text-default mt-1">{{ user?.name || 'Not set' }}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-muted">Email</label>
              <p class="text-default mt-1">{{ user?.email }}</p>
              <UBadge
                v-if="user?.email_verified"
                color="primary"
                variant="soft"
                size="xs"
                class="mt-1"
              >
                Verified
              </UBadge>
            </div>

            <div v-if="customer">
              <label class="text-sm font-medium text-muted">Member Since</label>
              <p class="text-default mt-1">{{ formatDate(customer.createdAt) }}</p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="error" variant="outline" @click="authStore.logout"> Log out </UButton>
          </div>
        </template>
      </UCard>

      <!-- Subscription Card -->
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold">Subscription</h2>
        </template>

        <div v-if="billingLoading" class="flex justify-center py-4">
          <span class="relative flex h-6 w-6">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-6 w-6 rounded-full bg-primary-500"></span>
          </span>
        </div>

        <div v-else-if="!subscription?.hasSubscription" class="text-center py-4">
          <UIcon name="i-heroicons-credit-card" class="h-12 w-12 text-muted mx-auto mb-3" />
          <p class="text-muted">No active subscription</p>
          <p class="text-sm text-muted mt-1">Subscribe to access premium features</p>
        </div>

        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-muted">Plan</label>
              <p class="text-default mt-1">{{ currentPlan?.name || 'Unknown Plan' }}</p>
              <p v-if="currentPlan" class="text-sm text-muted">
                {{ formatPrice(currentPlan.unitAmount, currentPlan.currency) }}
                <span v-if="currentPlan.interval">/{{ currentPlan.interval }}</span>
              </p>
            </div>

            <div>
              <label class="text-sm font-medium text-muted">Status</label>
              <div class="mt-1">
                <UBadge :color="statusColor" variant="soft">
                  {{ statusLabel }}
                </UBadge>
              </div>
            </div>

            <div v-if="subscription.subscription?.currentPeriodEnd">
              <label class="text-sm font-medium text-muted">Current Period Ends</label>
              <p class="text-default mt-1">
                {{ formatTimestamp(subscription.subscription.currentPeriodEnd) }}
              </p>
            </div>

            <div v-if="subscription.subscription?.trialEnd">
              <label class="text-sm font-medium text-muted">Trial Ends</label>
              <p class="text-default mt-1">
                {{ formatTimestamp(subscription.subscription.trialEnd) }}
              </p>
            </div>

            <div v-if="subscription.subscription?.cancelAt">
              <label class="text-sm font-medium text-muted">Cancels On</label>
              <p class="mt-1 text-warning">
                {{ formatTimestamp(subscription.subscription.cancelAt) }}
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              color="primary"
              variant="outline"
              :loading="billingLoading"
              @click="billingStore.openBillingPortal"
            >
              Manage Subscription
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
