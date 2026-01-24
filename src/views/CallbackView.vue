<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await authStore.fetchCustomer()
  router.push('/developers/api-keys')
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
      <p class="text-sm font-medium text-(--ui-text-muted)">Completing authentication...</p>
    </div>
  </div>
</template>
