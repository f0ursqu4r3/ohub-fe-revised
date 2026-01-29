<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const { isAuthenticated, isLoading } = storeToRefs(authStore)

onMounted(() => {
  // If already authenticated, redirect to subscribe flow
  if (isAuthenticated.value) {
    router.push({ name: 'subscribe' })
  }
})

const handleLogin = () => authStore.login()
const handleSignup = () => authStore.signup()
</script>

<template>
  <div class="min-h-screen bg-default flex flex-col">
    <!-- Header -->
    <header class="border-b border-default bg-elevated">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/" icon="i-heroicons-arrow-left" color="neutral" variant="ghost" square />
          <h1 class="text-xl font-bold text-default">Canadian Power Outages</h1>
        </div>
      </div>
    </header>

    <div class="flex-1 flex items-center justify-center px-4 py-16">
      <div class="w-full max-w-md">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-center py-12">
          <span class="relative flex h-10 w-10">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
          </span>
        </div>

        <div v-else class="space-y-8">
          <!-- Branding -->
          <div class="text-center">
            <div
              class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-6"
            >
              <UIcon name="i-heroicons-bolt" class="w-8 h-8 text-primary-500" />
            </div>
            <h2 class="text-2xl font-bold text-default mb-2">Welcome to the Developer Portal</h2>
            <p class="text-muted">Access real-time Canadian power outage data through our API</p>
          </div>

          <!-- Auth Options -->
          <UCard>
            <div class="space-y-4">
              <UButton
                color="primary"
                size="lg"
                block
                icon="i-heroicons-user-plus"
                @click="handleSignup"
              >
                Create an Account
              </UButton>

              <USeparator label="or" />

              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                block
                icon="i-heroicons-arrow-right-on-rectangle"
                @click="handleLogin"
              >
                Sign In
              </UButton>
            </div>
          </UCard>

          <!-- Benefits -->
          <div class="space-y-3">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-primary-500 mt-0.5" />
              <p class="text-sm text-muted">7-day free trial on all plans</p>
            </div>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-primary-500 mt-0.5" />
              <p class="text-sm text-muted">Real-time outage data from major Canadian providers</p>
            </div>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-primary-500 mt-0.5" />
              <p class="text-sm text-muted">Simple REST API with JSON responses</p>
            </div>
          </div>

          <!-- Footer Link -->
          <p class="text-center text-sm text-muted">
            Just exploring?
            <RouterLink to="/developers" class="text-primary-500 hover:underline">
              View API documentation
            </RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
