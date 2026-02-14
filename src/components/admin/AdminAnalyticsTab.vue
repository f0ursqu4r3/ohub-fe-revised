<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useAdminStore } from '@/stores/admin'

const toast = useToast()
const adminStore = useAdminStore()
const { isLoading } = storeToRefs(adminStore)

async function handleEnable() {
  try {
    await adminStore.enableNormAnalytics()
    toast.add({ title: 'Norm analytics enabled', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({ title: 'Failed to enable norm analytics', color: 'error', icon: 'i-heroicons-exclamation-circle' })
  }
}

async function handleDisable() {
  try {
    await adminStore.disableNormAnalytics()
    toast.add({ title: 'Norm analytics disabled', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({ title: 'Failed to disable norm analytics', color: 'error', icon: 'i-heroicons-exclamation-circle' })
  }
}

async function handleKick() {
  try {
    await adminStore.kickNormAnalytics()
    toast.add({ title: 'Norm analytics kicked', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({ title: 'Failed to kick norm analytics', color: 'error', icon: 'i-heroicons-exclamation-circle' })
  }
}
</script>

<template>
  <div class="pt-4">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-muted" />
          <h3 class="text-sm font-semibold text-default">Norm Analytics Controls</h3>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          Control the norm analytics worker. Enable or disable processing, or kick to trigger an immediate recomputation.
        </p>

        <div class="flex items-center gap-3">
          <UButton
            icon="i-heroicons-play"
            color="success"
            variant="soft"
            size="sm"
            label="Enable"
            :loading="isLoading"
            @click="handleEnable"
          />
          <UButton
            icon="i-heroicons-pause"
            color="warning"
            variant="soft"
            size="sm"
            label="Disable"
            :loading="isLoading"
            @click="handleDisable"
          />
          <UButton
            icon="i-heroicons-arrow-path"
            color="neutral"
            variant="soft"
            size="sm"
            label="Kick"
            :loading="isLoading"
            @click="handleKick"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
