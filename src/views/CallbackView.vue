<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth0 = useAuth0()
const authStore = useAuthStore()

onMounted(async () => {
  // Wait for Auth0 to finish processing the callback
  while (auth0.isLoading.value) {
    await new Promise((resolve) => setTimeout(resolve, 50))
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
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <div class="text-center">
      <div class="mb-4">
        <span class="relative flex h-12 w-12 mx-auto">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
          ></span>
          <span class="relative inline-flex h-12 w-12 rounded-full bg-primary-500"></span>
        </span>
      </div>
      <p class="text-sm font-medium text-muted">Completing authentication...</p>
    </div>
  </div>
</template>
