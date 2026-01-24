<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const { isAuthenticated, user } = storeToRefs(authStore)

const route = useRoute()

onMounted(() => {
  if (isAuthenticated.value) {
    authStore.fetchCustomer()
  }
})

const navItems = computed(() => [
  {
    label: 'Getting Started',
    to: '/developers',
    icon: 'i-heroicons-rocket-launch',
    active: route.path === '/developers',
  },
  {
    label: 'API Keys',
    to: '/developers/api-keys',
    icon: 'i-heroicons-key',
    active: route.path === '/developers/api-keys',
  },
  {
    label: 'Profile',
    to: '/developers/profile',
    icon: 'i-heroicons-user',
    active: route.path === '/developers/profile',
  },
])
</script>

<template>
  <div class="h-screen bg-default flex overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-56 border-r border-default bg-elevated flex flex-col shrink-0">
      <!-- Logo/Title -->
      <div class="px-3 py-3">
        <div class="flex items-center gap-2">
          <UButton to="/" icon="i-heroicons-home" color="gray" variant="ghost" size="sm" square />
          <h1 class="text-sm font-semibold text-default">Developers</h1>
        </div>
      </div>

      <USeparator />

      <!-- Navigation -->
      <nav class="flex-1 p-2">
        <ul class="space-y-0.5">
          <li v-for="item in navItems" :key="item.to">
            <UButton
              :to="item.to"
              :icon="item.icon"
              :label="item.label"
              :color="item.active ? 'primary' : 'gray'"
              :variant="item.active ? 'soft' : 'ghost'"
              size="sm"
              block
              class="justify-start"
            />
          </li>
        </ul>
      </nav>

      <USeparator />

      <div class="bg-elevated px-3 py-2 flex items-center gap-2">
        <UAvatar :src="user?.picture" :alt="user?.name" size="xs" />
        <span class="text-xs text-muted truncate">{{ user?.email }}</span>
      </div>
    </aside>

    <!-- Main content area -->
    <main class="flex-1 flex flex-col">
      <!-- Content -->
      <div class="flex-1 overflow-auto">
        <slot />
      </div>
    </main>
  </div>
</template>
