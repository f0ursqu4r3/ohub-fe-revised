<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const darkModeStore = useDarkModeStore()
const { isDark } = storeToRefs(darkModeStore)

const route = useRoute()

const navItems = computed(() => [
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
])
</script>

<template>
  <div class="h-screen bg-default flex flex-col overflow-hidden">
    <!-- Navbar -->
    <header class="border-b border-default bg-elevated px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
      <nav class="flex items-center gap-1">
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          :color="item.active ? 'primary' : 'neutral'"
          :variant="item.active ? 'soft' : 'ghost'"
        />
      </nav>

      <div class="flex items-center gap-1">
        <UButton
          :icon="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          @click="darkModeStore.toggle()"
        />
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
