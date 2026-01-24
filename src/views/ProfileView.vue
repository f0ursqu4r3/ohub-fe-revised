<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { user, customer, isLoading } = storeToRefs(authStore)

onMounted(() => {
  if (!customer.value) authStore.fetchCustomer()
})

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  // dateString is in epoch seconds format
  return new Date(parseInt(dateString) * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="bg-elevated px-6 py-4 border-b border-default">
      <h1 class="text-xl font-semibold text-default">Profile</h1>
      <p class="text-muted mt-0.5 text-xs">Manage your account information</p>
    </div>

    <!-- Content -->
    <div class="p-6">
      <div class="max-w-3xl">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="relative flex h-10 w-10">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
          </span>
        </div>

        <UCard v-else>
          <template #header>
            <h2 class="text-base font-semibold">Account Information</h2>
          </template>

          <div class="space-y-4">
            <div v-if="user?.picture" class="flex justify-center">
              <img
                :src="user.picture"
                :alt="user.name"
                class="h-16 w-16 rounded-full ring-2 ring-primary-500/20"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-muted">Name</label>
                <p class="text-default mt-1">{{ user?.name || 'Not set' }}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-muted">Email</label>
                <p class="text-default mt-1">{{ user?.email }}</p>
                <UBadge
                  v-if="user?.email_verified"
                  color="primary"
                  variant="soft"
                  size="xs"
                  class="mt-1"
                >
                  Verified
                </UBadge>
              </div>

              <div v-if="customer">
                <label class="text-sm font-medium text-muted">Member Since</label>
                <p class="text-default mt-1">{{ formatDate(customer.createdAt) }}</p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
