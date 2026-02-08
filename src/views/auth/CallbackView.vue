<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth0 = useAuth0()
const authStore = useAuthStore()

const error = ref<string | null>(null)
const errorDescription = ref<string | null>(null)

onMounted(async () => {
  console.log('CallbackView mounted', route.fullPath, route.query)

  // Check for error in URL params or sessionStorage
  const urlError = route.query.error as string
  const storedError = sessionStorage.getItem('auth_error')

  if (urlError || storedError) {
    error.value = urlError || storedError
    errorDescription.value =
      (route.query.error_description as string) ||
      sessionStorage.getItem('auth_error_description') ||
      null
    sessionStorage.removeItem('auth_error')
    sessionStorage.removeItem('auth_error_description')
    return
  }

  // Wait for Auth0 to finish processing the callback
  while (auth0.isLoading.value) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // Check for Auth0 error
  if (auth0.error.value) {
    error.value = auth0.error.value.name || 'Authentication Error'
    errorDescription.value = auth0.error.value.message
    return
  }

  // If not authenticated after processing, redirect to home
  if (!auth0.isAuthenticated.value) {
    router.push('/')
    return
  }

  await authStore.fetchCustomer()

  const redirectTo = localStorage.getItem('auth_redirect') || '/subscribe'
  localStorage.removeItem('auth_redirect')
  router.push(redirectTo)
})

const goHome = () => router.push('/')
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <div class="text-center max-w-2xl px-4">
      <!-- Debug info -->
      <div class="mb-6 text-left">
        <p class="text-xs text-muted mb-2">URL: {{ route.fullPath }}</p>
        <pre class="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-40">
          {{ JSON.stringify(route.query, null, 2) }}
        </pre>
      </div>

      <!-- Error state -->
      <template v-if="error">
        <div class="mb-4">
          <span class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </span>
        </div>
        <h2 class="text-lg font-semibold text-red-600 mb-2">{{ error }}</h2>
        <p v-if="errorDescription" class="text-sm text-muted mb-4">{{ errorDescription }}</p>
        <button
          @click="goHome"
          class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Go to Home
        </button>
      </template>

      <!-- Loading state -->
      <template v-else>
        <div class="mb-4">
          <span class="relative flex h-12 w-12 mx-auto">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-12 w-12 rounded-full bg-primary-500"></span>
          </span>
        </div>
        <p class="text-sm font-medium text-muted">Completing authentication...</p>
      </template>
    </div>
  </div>
</template>
