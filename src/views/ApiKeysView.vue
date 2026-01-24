<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useApiKeysStore } from '@/stores/apiKeys'
import ApiKeyCard from '@/components/ApiKeyCard.vue'
import DeveloperLayout from '@/components/DeveloperLayout.vue'
import type { ApiKeyCreateRequest, ApiKeyUpdateRequest } from '@/types/apiKey'

const apiKeysStore = useApiKeysStore()
const { apiKeys, isLoading, error, lastCreatedKey } = storeToRefs(apiKeysStore)

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showKeyModal = ref(false)

const createForm = ref<ApiKeyCreateRequest>({
  note: '',
})
const editingKeyId = ref<number | null>(null)
const editForm = ref<ApiKeyUpdateRequest>({
  note: '',
})
const deletingKeyId = ref<number | null>(null)

const copiedFullKey = ref(false)

onMounted(() => {
  apiKeysStore.fetchApiKeys()
})

const openCreateModal = () => {
  createForm.value = { note: '' }
  showCreateModal.value = true
}

const handleCreate = async () => {
  const result = await apiKeysStore.createApiKey(createForm.value)
  if (result) {
    showCreateModal.value = false
    showKeyModal.value = true
  }
}

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

const copyFullKey = async () => {
  if (lastCreatedKey.value) {
    try {
      await navigator.clipboard.writeText(lastCreatedKey.value)
      copiedFullKey.value = true
      setTimeout(() => {
        copiedFullKey.value = false
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
}

const closeKeyModal = () => {
  showKeyModal.value = false
  apiKeysStore.clearLastCreatedKey()
  copiedFullKey.value = false
}

const deletingKeyPrefix = computed(() => {
  const key = apiKeys.value.find((k) => k.id === deletingKeyId.value)
  return key?.apiKey.substring(0, 8) || ''
})
</script>

<template>
  <DeveloperLayout>
    <div class="py-8 px-4">
      <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-(--ui-text)">API Keys</h1>
          <p class="text-(--ui-text-muted) mt-2">
            Manage your API keys for programmatic access
          </p>
        </div>
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          label="Create API Key"
          @click="openCreateModal"
        />
      </div>

      <!-- Error state -->
      <UAlert
        v-if="error"
        color="red"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="error"
        class="mb-6"
      />

      <!-- Loading state -->
      <div v-if="isLoading && !apiKeys.length" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="mb-4">
            <span class="relative flex h-12 w-12 mx-auto">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
              ></span>
              <span class="relative inline-flex h-12 w-12 rounded-full bg-primary-500"></span>
            </span>
          </div>
          <p class="text-sm font-medium text-(--ui-text-muted)">Loading API keys...</p>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!apiKeys.length"
        class="text-center py-12 bg-(--ui-bg-elevated) rounded-lg border border-(--ui-border)"
      >
        <UIcon name="i-heroicons-key" class="h-12 w-12 text-(--ui-text-dimmed) mx-auto mb-4" />
        <h3 class="text-lg font-semibold text-(--ui-text) mb-2">No API keys yet</h3>
        <p class="text-(--ui-text-muted) mb-6">
          Create your first API key to access the outage data programmatically
        </p>
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          label="Create API Key"
          @click="openCreateModal"
        />
      </div>

      <!-- API keys list -->
      <div v-else class="space-y-4">
        <ApiKeyCard
          v-for="key in apiKeys"
          :key="key.id"
          :api-key="key"
          @edit="openEditModal"
          @delete="openDeleteModal"
        />
      </div>

      <!-- Create modal -->
      <UModal v-model="showCreateModal">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-(--ui-text)">Create API Key</h3>
          </template>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-(--ui-text) mb-2">
                Description (optional)
              </label>
              <UTextarea
                v-model="createForm.note"
                placeholder="e.g., Production server access"
                :rows="3"
              />
            </div>

            <UAlert
              color="blue"
              variant="soft"
              icon="i-heroicons-information-circle"
              title="The API key will only be shown once"
              description="Make sure to copy it immediately after creation."
            />
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton
                color="gray"
                variant="ghost"
                label="Cancel"
                @click="showCreateModal = false"
              />
              <UButton
                color="primary"
                label="Create Key"
                :loading="isLoading"
                @click="handleCreate"
              />
            </div>
          </template>
        </UCard>
      </UModal>

      <!-- Show created key modal -->
      <UModal v-model="showKeyModal" :prevent-close="true">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-green-600 dark:text-green-400">
              API Key Created Successfully!
            </h3>
          </template>

          <div class="space-y-4">
            <UAlert
              color="amber"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              title="Save this key now"
              description="This is the only time you'll see the full key. Store it securely."
            />

            <div>
              <label class="block text-sm font-medium text-(--ui-text) mb-2"> Your API Key </label>
              <div class="flex gap-2">
                <code
                  class="flex-1 font-mono text-sm bg-(--ui-bg-accented) px-3 py-2 rounded border border-(--ui-border) break-all"
                >
                  {{ lastCreatedKey }}
                </code>
                <UButton
                  :icon="copiedFullKey ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
                  :color="copiedFullKey ? 'green' : 'gray'"
                  variant="soft"
                  @click="copyFullKey"
                />
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton color="primary" label="Done" @click="closeKeyModal" />
            </div>
          </template>
        </UCard>
      </UModal>

      <!-- Edit modal -->
      <UModal v-model="showEditModal">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-(--ui-text)">Edit API Key</h3>
          </template>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-(--ui-text) mb-2"> Description </label>
              <UTextarea
                v-model="editForm.note"
                placeholder="e.g., Production server access"
                :rows="3"
              />
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton
                color="gray"
                variant="ghost"
                label="Cancel"
                @click="showEditModal = false"
              />
              <UButton
                color="primary"
                label="Save Changes"
                :loading="isLoading"
                @click="handleEdit"
              />
            </div>
          </template>
        </UCard>
      </UModal>

      <!-- Delete confirmation modal -->
      <UModal v-model="showDeleteModal">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-red-600 dark:text-red-400">Delete API Key</h3>
          </template>

          <div class="space-y-4">
            <p class="text-(--ui-text)">
              Are you sure you want to delete this API key? This action cannot be undone.
            </p>
            <div class="bg-(--ui-bg-accented) px-4 py-3 rounded">
              <p class="font-mono text-sm text-(--ui-text)">{{ deletingKeyPrefix }}...</p>
            </div>
            <UAlert
              color="red"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              title="This will immediately revoke access"
              description="Any applications using this key will stop working."
            />
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton
                color="gray"
                variant="ghost"
                label="Cancel"
                @click="showDeleteModal = false"
              />
              <UButton
                color="red"
                label="Delete Key"
                :loading="isLoading"
                @click="handleDelete"
              />
            </div>
          </template>
        </UCard>
      </UModal>
      </div>
    </div>
  </DeveloperLayout>
</template>
