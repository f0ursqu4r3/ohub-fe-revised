<script setup lang="ts">
import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'
import { useRoute } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import DeveloperLayout from '@/layouts/DeveloperLayout.vue'

const darkModeStore = useDarkModeStore()
const { isDark } = storeToRefs(darkModeStore)
const route = useRoute()

// Apply dark class to html element
watch(
  isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
  },
  { immediate: true },
)

// Map layout names to components
const layouts = {
  default: DefaultLayout,
  developer: DeveloperLayout,
}

// Get the current layout component based on route meta
const layout = computed(() => {
  const layoutName = (route.meta.layout as string) || 'default'
  return layouts[layoutName as keyof typeof layouts] || DefaultLayout
})
</script>

<template>
  <UApp :ui="{ root: isDark ? 'dark' : '' }">
    <component :is="layout">
      <RouterView />
    </component>
  </UApp>
</template>
