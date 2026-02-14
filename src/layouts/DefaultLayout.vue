<script setup lang="ts">
import AppNavBar from '@/components/AppNavBar.vue'
</script>

<template>
  <div class="h-screen bg-default flex flex-col overflow-hidden">
    <AppNavBar />
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
