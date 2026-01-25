<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useApiKeysStore } from '@/stores/apiKeys'

const emit = defineEmits<{
  created: [apiKey: string]
}>()

const apiKeysStore = useApiKeysStore()
const { isLoading, lastCreatedKey } = storeToRefs(apiKeysStore)

const showCreateModal = ref(false)
const showKeyModal = ref(false)
const createForm = ref({ note: '' })
const copiedFullKey = ref(false)

const open = () => {
  createForm.value = { note: '' }
  showCreateModal.value = true
}

const handleCreate = async () => {
  const result = await apiKeysStore.createApiKey(createForm.value)
  if (result) {
    showCreateModal.value = false
    showKeyModal.value = true
    emit('created', result.apiKey)
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

defineExpose({ open })
</script>

<template>
  <!-- Create API Key modal -->
  <UModal v-model:open="showCreateModal" title="Create API Key">
    <template #body>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-default mb-2">
            Description (optional)
          </label>
          <UTextarea
            v-model="createForm.note"
            placeholder="e.g., Production server access"
            :rows="3"
            class="w-full"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="ghost" label="Cancel" @click="showCreateModal = false" />
        <UButton color="primary" label="Create Key" :loading="isLoading" @click="handleCreate" />
      </div>
    </template>
  </UModal>

  <!-- Show created key modal -->
  <UModal v-model:open="showKeyModal" title="API Key Created Successfully!" :dismissible="false">
    <template #body>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-default mb-2">Your API Key</label>
          <div class="flex gap-2">
            <code
              class="flex-1 font-mono text-sm bg-accented px-3 py-2 rounded border border-default break-all"
            >
              {{ lastCreatedKey }}
            </code>
            <UButton
              :icon="copiedFullKey ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
              :color="copiedFullKey ? 'success' : 'neutral'"
              variant="soft"
              @click="copyFullKey"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton color="primary" label="Done" @click="closeKeyModal" />
      </div>
    </template>
  </UModal>
</template>
