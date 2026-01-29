<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const router = useRouter()
const authStore = useAuthStore()
const billingStore = useBillingStore()
const { user } = storeToRefs(authStore)
const { plans, subscription, isLoading, hasValidSubscription } = storeToRefs(billingStore)

const billingInterval = ref<'month' | 'year'>('year')

onMounted(async () => {
  await Promise.all([billingStore.fetchPlans(), billingStore.fetchSubscription()])

  // If user already has valid subscription, redirect to developer portal
  if (hasValidSubscription.value) {
    router.push({ name: 'getting-started' })
  }
})

const filteredPlans = computed(() => {
  if (!Array.isArray(plans.value)) return []
  return plans.value
    .filter((p) => p.interval === billingInterval.value)
    .sort((a, b) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0))
})

const getPlanSavings = (yearlyPlan: { productId: string | null; unitAmount: number | null }) => {
  if (!Array.isArray(plans.value) || !yearlyPlan.unitAmount) return null
  const monthlyPlan = plans.value.find(
    (p) => p.interval === 'month' && p.productId === yearlyPlan.productId,
  )
  if (!monthlyPlan?.unitAmount) return null
  const monthlyAnnual = monthlyPlan.unitAmount * 12
  const savings = Math.round(((monthlyAnnual - yearlyPlan.unitAmount) / monthlyAnnual) * 100)
  return savings > 0 ? savings : null
}

const getMonthlyEquivalent = (yearlyAmount: number | null) => {
  if (!yearlyAmount) return null
  return Math.round(yearlyAmount / 12)
}

const formatPrice = (amount: number | null, currency: string | null) => {
  if (amount === null || amount === 0) return 'Free'
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return formatter.format(amount / 100)
}

const handleSubscribe = async (priceId: string | null) => {
  if (!priceId) {
    console.error('No priceId available for plan')
    return
  }
  await billingStore.createCheckout(priceId)
}

const handleLogout = () => authStore.logout()
</script>

<template>
  <div class="h-screen bg-default flex flex-col">
    <!-- Header -->
    <header class="border-b border-default bg-elevated/80 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/" icon="i-heroicons-arrow-left" color="neutral" variant="ghost" square />
          <h1 class="text-xl font-bold text-default">Choose Your Plan</h1>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ user?.email }}</span>
          <UButton color="neutral" variant="ghost" label="Sign Out" @click="handleLogout" />
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-auto">
      <!-- Hero with gradient background -->
      <div
        class="relative bg-linear-to-b from-primary-50 to-transparent dark:from-primary-950/20 dark:to-transparent"
      >
        <div class="max-w-5xl mx-auto px-4 pt-16 pb-8">
          <div class="text-center">
            <div
              class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-linear-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25 mb-6"
            >
              <UIcon name="i-heroicons-bolt" class="w-10 h-10 text-white" />
            </div>
            <h2 class="text-4xl font-bold text-default mb-4">Power Your Applications</h2>
            <p class="text-xl text-muted max-w-2xl mx-auto">
              Get instant access to real-time Canadian power outage data. Start your free trial
              today.
            </p>

            <!-- Billing Interval Toggle -->
            <div class="flex items-center justify-center gap-2 mt-10">
              <div
                class="inline-flex rounded-full bg-elevated border border-default p-1.5 shadow-sm"
              >
                <button
                  :class="[
                    'px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-200',
                    billingInterval === 'month'
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'text-muted hover:text-default',
                  ]"
                  @click="billingInterval = 'month'"
                >
                  Monthly
                </button>
                <button
                  :class="[
                    'px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-200',
                    billingInterval === 'year'
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'text-muted hover:text-default',
                  ]"
                  @click="billingInterval = 'year'"
                >
                  Yearly
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="max-w-5xl mx-auto px-4 py-12">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-center py-12">
          <span class="relative flex h-12 w-12">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-12 w-12 rounded-full bg-primary-500"></span>
          </span>
        </div>

        <!-- Already Subscribed Alert -->
        <UAlert
          v-else-if="subscription?.hasSubscription"
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          title="You already have a subscription"
          description="Your subscription may be in an inactive state. You can manage it in the billing portal."
          class="mb-8"
        >
          <template #actions>
            <UButton
              color="info"
              variant="outline"
              label="Manage Subscription"
              @click="billingStore.openBillingPortal"
            />
          </template>
        </UAlert>

        <!-- Plans Grid -->
        <div
          v-else-if="filteredPlans.length > 0"
          class="grid gap-8"
          :class="{
            'md:grid-cols-2': filteredPlans.length === 2,
            'md:grid-cols-3': filteredPlans.length >= 3,
            'max-w-lg mx-auto': filteredPlans.length === 1,
          }"
        >
          <div
            v-for="plan in filteredPlans"
            :key="plan.priceId ?? undefined"
            :class="[
              'relative rounded-xl bg-elevated border-2 p-8 transition-all duration-200 hover:shadow-xl',
              billingInterval === 'year'
                ? 'border-primary-500 shadow-lg shadow-primary-500/10'
                : 'border-default hover:border-primary-300 dark:hover:border-primary-700',
            ]"
          >
            <!-- Savings Badge -->
            <div
              v-if="billingInterval === 'year' && getPlanSavings(plan)"
              class="absolute -top-4 left-1/2 -translate-x-1/2"
            >
              <span
                class="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-linear-to-r from-primary-500 to-primary-600 text-white text-sm font-bold shadow-lg"
              >
                Save {{ getPlanSavings(plan) }}%
              </span>
            </div>

            <div class="space-y-6">
              <!-- Plan Header -->
              <div class="text-center">
                <h3 class="text-2xl font-bold text-default">{{ plan.name }}</h3>
                <p v-if="plan.description" class="text-sm text-muted mt-2">
                  {{ plan.description }}
                </p>
              </div>

              <!-- Price -->
              <div class="text-center py-4">
                <div class="flex items-baseline justify-center gap-1">
                  <span class="text-5xl font-bold text-default">
                    {{ formatPrice(plan.unitAmount, plan.currency) }}
                  </span>
                  <span class="text-muted text-lg">/{{ plan.interval }}</span>
                </div>
                <p
                  v-if="billingInterval === 'year' && getMonthlyEquivalent(plan.unitAmount)"
                  class="text-sm text-muted mt-2"
                >
                  Just
                  {{ formatPrice(getMonthlyEquivalent(plan.unitAmount), plan.currency) }}/month
                </p>
              </div>

              <!-- Subscribe Button -->
              <UButton
                :color="billingInterval === 'year' ? 'primary' : 'neutral'"
                :variant="billingInterval === 'year' ? 'solid' : 'outline'"
                block
                size="xl"
                :loading="isLoading"
                :disabled="!plan.priceId"
                class="font-semibold"
                @click="handleSubscribe(plan.priceId)"
              >
                Start Free Trial
              </UButton>

              <!-- Features (from Stripe) -->
              <div
                v-if="plan.features && Object.keys(plan.features).length > 0"
                class="pt-6 border-t border-default"
              >
                <p class="text-sm font-semibold text-default mb-4">What's included:</p>
                <ul class="space-y-3">
                  <li
                    v-for="(value, key) in plan.features"
                    :key="key"
                    class="flex items-start gap-3"
                  >
                    <UIcon
                      name="i-heroicons-check-circle-solid"
                      class="w-5 h-5 text-primary-500 shrink-0 mt-0.5"
                    />
                    <span class="text-sm text-default">{{ value }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- No Plans Available -->
        <div v-else class="text-center py-12">
          <UIcon name="i-heroicons-exclamation-circle" class="h-12 w-12 text-muted mx-auto mb-4" />
          <p class="text-muted">No subscription plans available at this time.</p>
          <p class="text-sm text-muted mt-2">Please check back later or contact support.</p>
        </div>

        <!-- Trust Indicators -->
        <div class="mt-16 pt-8 border-t border-default">
          <div class="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div
                class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-3"
              >
                <UIcon name="i-heroicons-shield-check" class="w-6 h-6 text-primary-500" />
              </div>
              <h4 class="font-semibold text-default">7-Day Free Trial</h4>
              <p class="text-sm text-muted mt-1">Try risk-free, cancel anytime</p>
            </div>
            <div>
              <div
                class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-3"
              >
                <UIcon name="i-heroicons-credit-card" class="w-6 h-6 text-primary-500" />
              </div>
              <h4 class="font-semibold text-default">Secure Billing</h4>
              <p class="text-sm text-muted mt-1">Powered by Stripe</p>
            </div>
            <div>
              <div
                class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-3"
              >
                <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-primary-500" />
              </div>
              <h4 class="font-semibold text-default">Cancel Anytime</h4>
              <p class="text-sm text-muted mt-1">No long-term commitment</p>
            </div>
          </div>
        </div>

        <!-- FAQ or Additional Info -->
        <div class="mt-12 text-center">
          <p class="text-sm text-muted">
            Questions?
            <a
              href="mailto:support@canadianpoweroutages.ca"
              class="text-primary-500 hover:underline"
              >Contact our team</a
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
