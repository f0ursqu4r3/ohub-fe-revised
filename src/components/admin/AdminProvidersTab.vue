<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useAdminStore } from '@/stores/admin'
import type { AdminProviderDirectoryItem, CreateProviderRequest, PatchProviderRequest } from '@/types/admin'

const toast = useToast()
const adminStore = useAdminStore()
const { providers, isLoading, error } = storeToRefs(adminStore)

// -- Search --
const search = ref('')
const filteredProviders = computed(() => {
  if (!search.value) return providers.value
  const q = search.value.toLowerCase()
  return providers.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.niceName && p.niceName.toLowerCase().includes(q)),
  )
})

// -- Create/Edit modal --
const showFormModal = ref(false)
const isEditing = ref(false)
const formData = ref<CreateProviderRequest>({ name: '' })

function openCreateModal() {
  isEditing.value = false
  formData.value = {
    name: '',
    implemented: false,
    isHidden: false,
    enableFetcher: false,
    enableParser: false,
    enableAggregation: false,
  }
  showFormModal.value = true
}

function openEditModal(provider: AdminProviderDirectoryItem) {
  isEditing.value = true
  formData.value = {
    name: provider.name,
    implemented: provider.implemented,
    isHidden: provider.isHidden,
    enableFetcher: provider.enableFetcher,
    enableParser: provider.enableParser,
    enableAggregation: provider.enableAggregation,
    niceName: provider.niceName ?? '',
    mapLink: provider.mapLink ?? '',
    blurb: provider.blurb ?? '',
    contactLink: provider.contactLink ?? '',
    picScenic: provider.picScenic ?? '',
    picOffice: provider.picOffice ?? '',
    picUtility: provider.picUtility ?? '',
  }
  showFormModal.value = true
}

async function handleSave() {
  try {
    if (isEditing.value) {
      const { name, ...patch } = formData.value
      await adminStore.updateProvider(name, patch as PatchProviderRequest)
      toast.add({ title: 'Provider updated', color: 'success', icon: 'i-heroicons-check-circle' })
    } else {
      await adminStore.createProvider(formData.value)
      toast.add({ title: 'Provider created', color: 'success', icon: 'i-heroicons-check-circle' })
    }
    showFormModal.value = false
  } catch {
    toast.add({
      title: isEditing.value ? 'Failed to update provider' : 'Failed to create provider',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

// -- Delete modal --
const showDeleteModal = ref(false)
const deletingProvider = ref<AdminProviderDirectoryItem | null>(null)

function openDeleteModal(provider: AdminProviderDirectoryItem) {
  deletingProvider.value = provider
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingProvider.value) return
  try {
    await adminStore.deleteProvider(deletingProvider.value.name)
    showDeleteModal.value = false
    deletingProvider.value = null
    toast.add({ title: 'Provider deleted', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch {
    toast.add({
      title: 'Failed to delete provider',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

function formatDate(epoch: number) {
  return new Date(epoch * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
          placeholder="Search providers..."
          size="sm"
          class="w-64"
        />
        <span class="text-xs text-muted">{{ filteredProviders.length }} providers</span>
      </div>
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        size="sm"
        label="Create Provider"
        @click="openCreateModal"
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
    <div v-if="isLoading && !providers.length" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="mb-3">
          <span class="relative flex h-10 w-10 mx-auto">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
            <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
          </span>
        </div>
        <p class="text-xs font-medium text-muted">Loading providers...</p>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && !providers.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-building-office-2" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No providers</h3>
      <p class="text-muted text-xs mb-4">Create your first provider to get started</p>
    </div>

    <!-- Table -->
    <div v-else-if="filteredProviders.length" class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated border-b border-default">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Name</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Nice Name</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-muted uppercase">Impl</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-muted uppercase">Hidden</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-muted uppercase">Fetcher</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-muted uppercase">Parser</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-muted uppercase">Agg</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Updated</th>
            <th class="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="provider in filteredProviders"
            :key="provider.name"
            class="hover:bg-elevated/50 transition-colors"
          >
            <td class="px-4 py-3 text-default font-mono text-xs">{{ provider.name }}</td>
            <td class="px-4 py-3 text-default text-xs max-w-40 truncate">{{ provider.niceName ?? '--' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="provider.implemented ? 'success' : 'neutral'" variant="soft" size="xs">
                {{ provider.implemented ? 'Yes' : 'No' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="provider.isHidden ? 'warning' : 'neutral'" variant="soft" size="xs">
                {{ provider.isHidden ? 'Yes' : 'No' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="provider.enableFetcher ? 'success' : 'neutral'" variant="soft" size="xs">
                {{ provider.enableFetcher ? 'On' : 'Off' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="provider.enableParser ? 'success' : 'neutral'" variant="soft" size="xs">
                {{ provider.enableParser ? 'On' : 'Off' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="provider.enableAggregation ? 'success' : 'neutral'" variant="soft" size="xs">
                {{ provider.enableAggregation ? 'On' : 'Off' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-muted text-xs">{{ formatDate(provider.updatedAt) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-1">
                <UTooltip text="Edit" :delay-open="0">
                  <UButton
                    icon="i-heroicons-pencil-square"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="openEditModal(provider)"
                  />
                </UTooltip>
                <UTooltip text="Delete" :delay-open="0">
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="openDeleteModal(provider)"
                  />
                </UTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="showFormModal" :title="isEditing ? 'Edit Provider' : 'Create Provider'">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-default mb-1">Name</label>
            <UInput v-model="formData.name" :disabled="isEditing" placeholder="provider-slug" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-default mb-1">Nice Name</label>
            <UInput v-model="formData.niceName" placeholder="Display Name" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-default mb-1">Map Link</label>
            <UInput v-model="formData.mapLink" placeholder="https://..." class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-default mb-1">Contact Link</label>
            <UInput v-model="formData.contactLink" placeholder="https://..." class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-default mb-1">Blurb</label>
            <UTextarea v-model="formData.blurb" placeholder="Short description..." class="w-full" :rows="3" />
          </div>

          <USeparator />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-default mb-1">Pic Scenic</label>
              <UInput v-model="formData.picScenic" placeholder="URL" class="w-full" />
            </div>
            <div>
              <label class="block text-sm font-medium text-default mb-1">Pic Office</label>
              <UInput v-model="formData.picOffice" placeholder="URL" class="w-full" />
            </div>
            <div>
              <label class="block text-sm font-medium text-default mb-1">Pic Utility</label>
              <UInput v-model="formData.picUtility" placeholder="URL" class="w-full" />
            </div>
          </div>

          <USeparator />

          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2 text-sm text-default">
              <UCheckbox v-model="formData.implemented" />
              Implemented
            </label>
            <label class="flex items-center gap-2 text-sm text-default">
              <UCheckbox v-model="formData.isHidden" />
              Hidden
            </label>
            <label class="flex items-center gap-2 text-sm text-default">
              <UCheckbox v-model="formData.enableFetcher" />
              Fetcher
            </label>
            <label class="flex items-center gap-2 text-sm text-default">
              <UCheckbox v-model="formData.enableParser" />
              Parser
            </label>
            <label class="flex items-center gap-2 text-sm text-default">
              <UCheckbox v-model="formData.enableAggregation" />
              Aggregation
            </label>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showFormModal = false" />
          <UButton
            color="primary"
            :label="isEditing ? 'Save' : 'Create'"
            :loading="isLoading"
            @click="handleSave"
          />
        </div>
      </template>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model:open="showDeleteModal" title="Delete Provider">
      <template #body>
        <div class="space-y-4">
          <p class="text-default">
            Are you sure you want to delete this provider? This action cannot be undone.
          </p>
          <div v-if="deletingProvider" class="bg-accented px-4 py-3 rounded">
            <p class="text-sm text-default">
              <span class="font-medium">Name:</span> {{ deletingProvider.name }}
            </p>
            <p v-if="deletingProvider.niceName" class="text-sm text-default">
              <span class="font-medium">Nice Name:</span> {{ deletingProvider.niceName }}
            </p>
          </div>
          <UAlert
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="This may fail if the provider is referenced by other records"
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
