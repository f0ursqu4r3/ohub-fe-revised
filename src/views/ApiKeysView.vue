<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useApiKeysStore } from '@/stores/apiKeys'
import ApiKeyCard from '@/components/ApiKeyCard.vue'
import CreateApiKeyModal from '@/components/CreateApiKeyModal.vue'
import type { ApiKeyUpdateRequest } from '@/types/apiKey'

const apiKeysStore = useApiKeysStore()
const { apiKeys, isLoading, error } = storeToRefs(apiKeysStore)

const createApiKeyModal = ref<InstanceType<typeof CreateApiKeyModal> | null>(null)

const showEditModal = ref(false)
const showDeleteModal = ref(false)

const editingKeyId = ref<number | null>(null)
const editForm = ref<ApiKeyUpdateRequest>({
  note: '',
})
const deletingKeyId = ref<number | null>(null)

onMounted(() => {
  apiKeysStore.fetchApiKeys()
})

const openEditModal = (id: number) => {
  const key = apiKeys.value.find((k) => k.id === id)
  if (key) {
    editingKeyId.value = id
    editForm.value = { note: key.note || '' }
    showEditModal.value = true
  }
}

const handleEdit = async () => {
  if (editingKeyId.value) {
    const key = apiKeys.value.find((k) => k.id === editingKeyId.value)
    if (key) {
      await apiKeysStore.updateApiKey(key.apiKey, editForm.value)
      showEditModal.value = false
      editingKeyId.value = null
    }
  }
}

const openDeleteModal = (id: number) => {
  deletingKeyId.value = id
  showDeleteModal.value = true
}

const handleDelete = async () => {
  if (deletingKeyId.value) {
    const key = apiKeys.value.find((k) => k.id === deletingKeyId.value)
    if (key) {
      await apiKeysStore.deleteApiKey(key.apiKey)
      showDeleteModal.value = false
      deletingKeyId.value = null
    }
  }
}

const deletingKeyPrefix = computed(() => {
  const key = apiKeys.value.find((k) => k.id === deletingKeyId.value)
  return key?.apiKey.substring(0, 8) || ''
})
</script>

<template>
  <div class="p-6">
    <div class="max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold text-default">API Keys</h1>
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          label="Create API Key"
          @click="createApiKeyModal?.open()"
        />
      </div>
      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="error"
        class="mb-6"
      />

      <!-- Loading state -->
      <div v-if="isLoading && !apiKeys.length" class="flex items-center justify-center py-8">
        <div class="text-center">
          <div class="mb-3">
            <span class="relative flex h-10 w-10 mx-auto">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
              ></span>
              <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
            </span>
          </div>
          <p class="text-xs font-medium text-muted">Loading API keys...</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!isLoading && !apiKeys.length"
        class="text-center py-12 bg-elevated rounded-lg border border-default"
      >
        <UIcon name="i-heroicons-key" class="h-10 w-10 text-dimmed mx-auto mb-3" />
        <h3 class="text-base font-semibold text-default mb-1">No API keys yet</h3>
        <p class="text-muted text-xs mb-4">
          Create your first API key to access the outage data programmatically
        </p>
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          label="Create API Key"
          @click="createApiKeyModal?.open()"
        />
      </div>

      <!-- API keys list -->
      <div v-else-if="apiKeys.length" class="space-y-2">
        <ApiKeyCard
          v-for="key in apiKeys"
          :key="key.id"
          :api-key="key"
          @edit="openEditModal"
          @delete="openDeleteModal"
        />
      </div>
    </div>

    <CreateApiKeyModal ref="createApiKeyModal" />

    <!-- Edit modal -->
    <UModal v-model:open="showEditModal" title="Edit API Key">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-default mb-2">Description</label>
            <UTextarea
              v-model="editForm.note"
              placeholder="e.g., Production server access"
              :rows="3"
              class="w-full"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showEditModal = false" />
          <UButton color="primary" label="Save Changes" :loading="isLoading" @click="handleEdit" />
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteModal" title="Delete API Key">
      <template #body>
        <div class="space-y-4">
          <p class="text-default">
            Are you sure you want to delete this API key? This action cannot be undone.
          </p>
          <div class="bg-accented px-4 py-3 rounded">
            <p class="font-mono text-sm text-default">{{ deletingKeyPrefix }}...</p>
          </div>
          <UAlert
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="This will immediately revoke access"
            description="Any applications using this key will stop working."
          />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showDeleteModal = false" />
          <UButton color="error" label="Delete Key" :loading="isLoading" @click="handleDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
