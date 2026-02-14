<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useAdminStore } from '@/stores/admin'
import type { AdminCustomer } from '@/types/admin'

const toast = useToast()
const adminStore = useAdminStore()
const { customers, isLoading, error } = storeToRefs(adminStore)

onMounted(() => {
  adminStore.fetchCustomers()
})

// -- Search / filter --
const search = ref('')
const filteredCustomers = computed(() => {
  if (!search.value) return customers.value
  const q = search.value.toLowerCase()
  return customers.value.filter(
    (c) =>
      c.email.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.planId.toLowerCase().includes(q) ||
      String(c.id).includes(q),
  )
})

// -- Delete Customer --
const showDeleteModal = ref(false)
const deletingCustomer = ref<AdminCustomer | null>(null)

function openDeleteModal(customer: AdminCustomer) {
  deletingCustomer.value = customer
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingCustomer.value) return
  try {
    await adminStore.deleteCustomer(deletingCustomer.value.id)
    toast.add({ title: 'Customer deleted', color: 'success', icon: 'i-heroicons-check-circle' })
    showDeleteModal.value = false
    deletingCustomer.value = null
  } catch {
    toast.add({
      title: 'Failed to delete customer',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
          placeholder="Search customers..."
          size="sm"
          class="w-64"
        />
        <span class="text-xs text-muted">{{ filteredCustomers.length }} customers</span>
      </div>
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
    <div v-if="isLoading && !customers.length" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="mb-3">
          <span class="relative flex h-10 w-10 mx-auto">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
            <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
          </span>
        </div>
        <p class="text-xs font-medium text-muted">Loading customers...</p>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && !customers.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-user-group" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No customers</h3>
      <p class="text-muted text-xs">No customers found</p>
    </div>

    <!-- Table -->
    <div v-else-if="filteredCustomers.length" class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated border-b border-default">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">ID</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Email</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Company</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Plan</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Admin</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Created</th>
            <th class="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="customer in filteredCustomers"
            :key="customer.id"
            class="hover:bg-elevated/50 transition-colors"
          >
            <td class="px-4 py-3 text-default font-mono text-xs">{{ customer.id }}</td>
            <td class="px-4 py-3 text-default text-xs">{{ customer.email }}</td>
            <td class="px-4 py-3 text-default text-xs">{{ customer.company }}</td>
            <td class="px-4 py-3">
              <UBadge color="neutral" variant="soft" size="xs">
                {{ customer.planId }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <UBadge
                v-if="customer.isAdmin"
                color="success"
                variant="soft"
                size="xs"
              >
                admin
              </UBadge>
            </td>
            <td class="px-4 py-3 text-muted text-xs whitespace-nowrap">{{ formatDate(customer.createdAt) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end">
                <UTooltip text="Delete" :delay-open="0">
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="openDeleteModal(customer)"
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
      v-else-if="!isLoading && customers.length && !filteredCustomers.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-funnel" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No matching customers</h3>
      <p class="text-muted text-xs">Try a different search term</p>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteModal" title="Delete Customer">
      <template #body>
        <div class="space-y-4">
          <p class="text-default">
            Are you sure you want to delete this customer?
          </p>
          <div v-if="deletingCustomer" class="bg-accented px-4 py-3 rounded space-y-1">
            <p class="text-sm text-default">
              <span class="font-medium">ID:</span> {{ deletingCustomer.id }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Email:</span> {{ deletingCustomer.email }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Company:</span> {{ deletingCustomer.company }}
            </p>
          </div>
          <UAlert
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="This will permanently delete the customer and all associated data"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showDeleteModal = false" />
          <UButton color="error" label="Delete" :loading="isLoading" @click="handleDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
