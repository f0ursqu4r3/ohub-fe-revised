<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const { isAuthenticated, user } = storeToRefs(authStore)

const route = useRoute()
const collapsed = ref(false)

onMounted(() => {
  if (isAuthenticated.value) {
    authStore.fetchCustomer()
  }
})

const navItems = computed(() => [
  {
    label: 'Getting Started',
    to: '/developers/getting-started',
    icon: 'i-heroicons-rocket-launch',
    active: route.path === '/developers/getting-started',
  },
  {
    label: 'API Keys',
    to: '/developers/api-keys',
    icon: 'i-heroicons-key',
    active: route.path === '/developers/api-keys',
  },
  {
    label: 'Playground',
    to: '/developers/playground',
    icon: 'i-heroicons-command-line',
    active: route.path === '/developers/playground',
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
    <aside
      :class="[
        'border-r border-default bg-elevated flex flex-col shrink-0 transition-all duration-200',
        collapsed ? 'w-12' : 'w-56',
      ]"
    >
      <!-- Logo/Title -->
      <div class="px-3 py-3">
        <div class="flex items-center gap-2">
          <UButton to="/" icon="i-heroicons-home" color="gray" variant="ghost" size="sm" square />
          <h1 v-if="!collapsed" class="text-sm font-semibold text-default">Developers</h1>
        </div>
      </div>

      <USeparator />

      <!-- Navigation -->
      <nav class="flex-1 p-2">
        <ul class="space-y-0.5">
          <li v-for="item in navItems" :key="item.to">
            <UTooltip :text="item.label" :delay-open="0" side="right" :disabled="!collapsed">
              <UButton
                :to="item.to"
                :icon="item.icon"
                :label="collapsed ? undefined : item.label"
                :color="item.active ? 'primary' : 'gray'"
                :variant="item.active ? 'soft' : 'ghost'"
                :block="!collapsed"
                :square="collapsed"
                :class="{ 'justify-start': !collapsed }"
              />
            </UTooltip>
          </li>
        </ul>
      </nav>

      <USeparator />

      <!-- Collapse toggle -->
      <div class="flex justify-end items-center p-2">
        <UButton
          class="w-full flex justify-end"
          color="neutral"
          variant="ghost"
          @click="collapsed = !collapsed"
        >
          <UIcon :name="collapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'" />
        </UButton>
      </div>
    </aside>

    <!-- Main content area -->
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
