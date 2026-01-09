<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDarkModeStore } from '@/stores/darkMode'

const darkModeStore = useDarkModeStore()
const { isDark } = storeToRefs(darkModeStore)

// Apply dark class to html element
watch(
  isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
  },
  { immediate: true },
)
</script>

<template>
  <UApp :ui="{ root: isDark ? 'dark' : '' }">
    <RouterView />
  </UApp>
</template>
