<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'

const darkModeStore = useDarkModeStore()
const { isDark } = storeToRefs(darkModeStore)
const authStore = useAuthStore()
const route = useRoute()

onMounted(() => {
  if (authStore.isAuthenticated && !authStore.customer) {
    authStore.fetchCustomer()
  }
})

const navItems = computed(() => {
  const items = [
    {
      label: 'Map',
      to: '/',
      icon: 'i-heroicons-map',
      active: route.path === '/',
    },
    {
      label: 'Analytics',
      to: '/analytics',
      icon: 'i-heroicons-chart-bar',
      active: route.path === '/analytics',
    },
    {
      label: 'API Docs',
      to: '/developers',
      icon: 'i-heroicons-code-bracket',
      active: route.path.startsWith('/developers'),
    },
  ]

  if (authStore.isAdmin) {
    items.push({
      label: 'Admin',
      to: '/admin',
      icon: 'i-heroicons-wrench-screwdriver',
      active: route.path.startsWith('/admin'),
    })
  }

  return items
})
</script>

<template>
  <header
    class="border-b border-default bg-elevated px-4 h-14 flex items-center justify-between shrink-0"
  >
    <!-- Left: Brand + Desktop Nav -->
    <div class="flex items-center gap-4">
      <RouterLink
        to="/"
        class="flex items-center gap-1.5 text-sm font-bold tracking-tight text-default hover:text-primary-500 transition-colors"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
          ></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-primary-500"></span>
        </span>
        OutageHub
      </RouterLink>
    </div>

    <!-- Right: Dark mode + Mobile hamburger -->
    <div class="flex items-center gap-1">
      <nav class="hidden sm:flex items-center gap-1">
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :color="item.active ? 'primary' : 'neutral'"
          :variant="item.active ? 'soft' : 'ghost'"
          size="lg"
        />
      </nav>

      <UButton
        :icon="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
        color="neutral"
        variant="ghost"
        size="lg"
        square
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        class="hidden sm:inline-flex"
        @click="darkModeStore.toggle()"
      />

      <UPopover :content="{ side: 'bottom', align: 'end' }" class="sm:hidden">
        <UButton
          icon="i-heroicons-bars-3"
          color="neutral"
          variant="ghost"
          size="lg"
          square
          aria-label="Menu"
        />
        <template #content>
          <div class="p-1 min-w-40">
            <UButton
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              :label="item.label"
              :color="item.active ? 'primary' : 'neutral'"
              :variant="item.active ? 'soft' : 'ghost'"
              block
              class="justify-start"
            />
            <USeparator class="my-1" />
            <UButton
              :icon="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
              :label="isDark ? 'Light mode' : 'Dark mode'"
              color="neutral"
              variant="ghost"
              block
              class="justify-start"
              @click="darkModeStore.toggle()"
            />
          </div>
        </template>
      </UPopover>
    </div>
  </header>
</template>
