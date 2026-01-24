<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import UserMenu from './UserMenu.vue'
import { onMounted } from 'vue'

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

onMounted(() => {
  if (isAuthenticated.value) {
    authStore.fetchCustomer()
  }
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <header class="border-b border-default bg-elevated">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton
            to="/developers"
            icon="i-heroicons-arrow-left"
            color="gray"
            variant="ghost"
            square
          />
          <h1 class="text-xl font-bold text-default">Developer Portal</h1>
        </div>
        <UserMenu />
      </div>
    </header>

    <!-- Content -->
    <slot />
  </div>
</template>
