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
  <div class="py-8 px-4">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-default mb-8">Profile</h1>

        <div v-if="isLoading" class="flex justify-center py-12">
          <span class="relative flex h-12 w-12">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-12 w-12 rounded-full bg-primary-500"></span>
          </span>
        </div>

        <UCard v-else>
          <template #header>
            <h2 class="text-xl font-semibold">Account Information</h2>
          </template>

          <div class="space-y-4">
            <div v-if="user?.picture" class="flex justify-center mb-6">
              <img
                :src="user.picture"
                :alt="user.name"
                class="h-24 w-24 rounded-full ring-4 ring-default"
              />
            </div>

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
        </UCard>

        <div class="flex gap-4 mt-6">
          <UButton
            to="/developers/api-keys"
            icon="i-heroicons-key"
            color="primary"
            variant="soft"
            label="Manage API Keys"
          />
          <UButton to="/" icon="i-heroicons-home" color="gray" variant="ghost" label="Home" />
        </div>
    </div>
  </div>
</template>
