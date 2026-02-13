<script setup lang="ts">
import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'
import { refreshMapColors } from '@/config/map'
import { useRoute } from 'vue-router'
import EmptyLayout from '@/layouts/EmptyLayout.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import DeveloperLayout from '@/layouts/DeveloperLayout.vue'
import ProviderLayout from '@/layouts/ProviderLayout.vue'

const darkModeStore = useDarkModeStore()
const { isDark } = storeToRefs(darkModeStore)
const route = useRoute()

// Apply dark class to html element
watch(
  isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    // Re-resolve cached JS colors from CSS vars after theme switch
    requestAnimationFrame(() => refreshMapColors())
  },
  { immediate: true },
)

// Map layout names to components
const layouts = {
  empty: EmptyLayout,
  default: DefaultLayout,
  developer: DeveloperLayout,
  provider: ProviderLayout,
}

// Get the current layout component based on route meta
const layout = computed(() => {
  const layoutName = (route.meta.layout as string) || 'empty'
  return layouts[layoutName as keyof typeof layouts] || EmptyLayout
})
</script>

<template>
  <UApp :ui="{ root: isDark ? 'dark' : '' }">
    <component :is="layout">
      <RouterView />
    </component>
  </UApp>
</template>
