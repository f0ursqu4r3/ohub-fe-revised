<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import AdminProvidersTab from '@/components/admin/AdminProvidersTab.vue'
import AdminMembersTab from '@/components/admin/AdminMembersTab.vue'
import AdminAnalyticsTab from '@/components/admin/AdminAnalyticsTab.vue'
import AdminFeedbackTab from '@/components/admin/AdminFeedbackTab.vue'
import AdminCustomersTab from '@/components/admin/AdminCustomersTab.vue'

const adminStore = useAdminStore()

onMounted(() => {
  adminStore.fetchProviders()
})

const tabs = [
  { label: 'Providers', icon: 'i-heroicons-building-office-2', slot: 'providers' },
  { label: 'Provider Members', icon: 'i-heroicons-users', slot: 'members' },
  { label: 'Analytics', icon: 'i-heroicons-chart-bar', slot: 'analytics' },
  { label: 'Feedback', icon: 'i-heroicons-chat-bubble-left-right', slot: 'feedback' },
  { label: 'Customers', icon: 'i-heroicons-user-group', slot: 'customers' },
]
</script>

<template>
  <div class="flex justify-center p-6">
    <div class="max-w-7xl w-full">
      <h1 class="text-2xl font-semibold text-default mb-6">Admin</h1>

      <UTabs :items="tabs">
        <template #providers>
          <AdminProvidersTab />
        </template>
        <template #members>
          <AdminMembersTab />
        </template>
        <template #analytics>
          <AdminAnalyticsTab />
        </template>
        <template #feedback>
          <AdminFeedbackTab />
        </template>
        <template #customers>
          <AdminCustomersTab />
        </template>
      </UTabs>
    </div>
  </div>
</template>
