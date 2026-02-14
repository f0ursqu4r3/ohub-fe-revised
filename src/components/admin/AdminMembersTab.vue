<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useAdminStore } from '@/stores/admin'
import type { AdminProviderMember } from '@/types/admin'

const toast = useToast()
const adminStore = useAdminStore()
const { providers, members, isLoading, error } = storeToRefs(adminStore)

onMounted(() => {
  adminStore.fetchMembers()
})

const providerOptions = computed(() =>
  providers.value.map((p) => ({ label: p.niceName || p.name, value: p.name })),
)

const roleOptions = [
  { label: 'Viewer', value: 'viewer' },
  { label: 'Editor', value: 'editor' },
]

// -- Search / filter --
const search = ref('')
const filteredMembers = computed(() => {
  if (!search.value) return members.value
  const q = search.value.toLowerCase()
  return members.value.filter(
    (m) => m.email.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
  )
})

// -- Add Member --
const showAddModal = ref(false)
const addEmail = ref('')
const addProvider = ref<string | undefined>(undefined)
const addRole = ref('viewer')

function openAddModal() {
  addEmail.value = ''
  addProvider.value = undefined
  addRole.value = 'viewer'
  showAddModal.value = true
}

async function handleAddMember() {
  if (!addEmail.value.trim() || !addProvider.value) return
  try {
    const result = await adminStore.addProviderMember({
      customerEmail: addEmail.value.trim(),
      provider: addProvider.value,
      role: addRole.value,
    })
    toast.add({
      title: `Member added: ${result.customerEmail} as ${result.role} for ${result.provider}`,
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    showAddModal.value = false
  } catch {
    toast.add({
      title: 'Failed to add member',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

// -- Remove Member --
const showRemoveModal = ref(false)
const removingMember = ref<AdminProviderMember | null>(null)

function openRemoveModal(member: AdminProviderMember) {
  removingMember.value = member
  showRemoveModal.value = true
}

async function handleRemoveMember() {
  if (!removingMember.value) return
  try {
    await adminStore.removeProviderMember(removingMember.value.email, removingMember.value.provider)
    toast.add({
      title: 'Member removed',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
    showRemoveModal.value = false
    removingMember.value = null
  } catch {
    toast.add({
      title: 'Failed to remove member',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}
</script>

<template>
  <div class="pt-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <UInput
          v-model="search"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search members..."
          size="sm"
          class="w-64"
        />
        <span class="text-xs text-muted">{{ filteredMembers.length }} members</span>
      </div>
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        size="sm"
        label="Add Member"
        @click="openAddModal"
      />
    </div>

    <!-- Error -->
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="error"
      class="mb-4"
    />

    <!-- Loading -->
    <div v-if="isLoading && !members.length" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="mb-3">
          <span class="relative flex h-10 w-10 mx-auto">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
            <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
          </span>
        </div>
        <p class="text-xs font-medium text-muted">Loading members...</p>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && !members.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-users" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No members</h3>
      <p class="text-muted text-xs mb-4">Add your first provider member to get started</p>
    </div>

    <!-- Table -->
    <div v-else-if="filteredMembers.length" class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated border-b border-default">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Email</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Provider</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Role</th>
            <th class="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="member in filteredMembers"
            :key="`${member.customerId}-${member.provider}`"
            class="hover:bg-elevated/50 transition-colors"
          >
            <td class="px-4 py-3 text-default text-xs">{{ member.email }}</td>
            <td class="px-4 py-3 text-default font-mono text-xs">{{ member.provider }}</td>
            <td class="px-4 py-3">
              <UBadge
                :color="member.role === 'editor' ? 'success' : 'neutral'"
                variant="soft"
                size="xs"
              >
                {{ member.role }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end">
                <UTooltip text="Remove" :delay-open="0">
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="openRemoveModal(member)"
                  />
                </UTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No search results -->
    <div
      v-else-if="!isLoading && members.length && !filteredMembers.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-funnel" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No matching members</h3>
      <p class="text-muted text-xs">Try a different search term</p>
    </div>

    <!-- Add Member Modal -->
    <UModal v-model:open="showAddModal" title="Add / Update Member">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-default mb-1">Email</label>
            <UInput v-model="addEmail" placeholder="user@example.com" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-default mb-1">Provider</label>
            <USelect
              v-model="addProvider"
              :items="providerOptions"
              placeholder="Select provider"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-default mb-1">Role</label>
            <USelect v-model="addRole" :items="roleOptions" class="w-full" />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showAddModal = false" />
          <UButton
            color="primary"
            label="Add Member"
            :loading="isLoading"
            :disabled="!addEmail.trim() || !addProvider"
            @click="handleAddMember"
          />
        </div>
      </template>
    </UModal>

    <!-- Remove Confirmation Modal -->
    <UModal v-model:open="showRemoveModal" title="Remove Member">
      <template #body>
        <div class="space-y-4">
          <p class="text-default">
            Are you sure you want to remove this member?
          </p>
          <div v-if="removingMember" class="bg-accented px-4 py-3 rounded">
            <p class="text-sm text-default">
              <span class="font-medium">Email:</span> {{ removingMember.email }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Provider:</span> {{ removingMember.provider }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Role:</span> {{ removingMember.role }}
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showRemoveModal = false" />
          <UButton color="error" label="Remove" :loading="isLoading" @click="handleRemoveMember" />
        </div>
      </template>
    </UModal>
  </div>
</template>
