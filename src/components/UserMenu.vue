<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useProviderStore } from '@/stores/provider'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const { isAuthenticated, user, isLoading } = storeToRefs(authStore)
const router = useRouter()

const providerStore = useProviderStore()
const { isProviderMember } = storeToRefs(providerStore)

watch(isAuthenticated, (authed) => {
  if (authed && !providerStore.isMembershipsLoaded) {
    providerStore.fetchMemberships()
  }
}, { immediate: true })

const userInitials = computed(() => {
  if (!user.value?.name) return user.value?.email?.[0]?.toUpperCase() || 'U'
  const parts = user.value.name.split(' ')
  return parts.length > 1
    ? `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    : parts[0]![0]!.toUpperCase()
})

const menuItems = computed(() => [
  [
    {
      type: 'label' as const,
      label: user.value?.email || 'Account',
    },
  ],
  [
    ...(isProviderMember.value
      ? [
          {
            label: 'Provider Portal',
            icon: 'i-heroicons-building-office',
            onSelect: () => router.push('/provider'),
          },
        ]
      : []),
    {
      label: 'API Keys',
      icon: 'i-heroicons-key',
      onSelect: () => router.push('/developers/api-keys'),
    },
    {
      label: 'Profile',
      icon: 'i-heroicons-user',
      onSelect: () => router.push('/developers/profile'),
    },
  ],
  [
    {
      label: 'Sign Out',
      icon: 'i-heroicons-arrow-right-on-rectangle',
      color: 'error' as const,
      onSelect: () => authStore.logout(),
    },
  ],
])
</script>

<template>
  <div v-if="isLoading" class="h-10 w-10 animate-pulse rounded-full bg-elevated" />

  <UButton
    v-else-if="!isAuthenticated"
    icon="i-heroicons-user"
    color="primary"
    variant="soft"
    label="Sign In"
    @click="authStore.login()"
  />

  <UDropdownMenu v-else :items="menuItems">
    <UButton
      class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white font-semibold text-sm shadow-md hover:bg-primary-600 hover:scale-105 active:scale-95 transition-all p-0"
      :title="user?.email"
    >
      {{ userInitials }}
    </UButton>
  </UDropdownMenu>
</template>
