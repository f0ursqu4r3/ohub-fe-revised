<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import type { ApiKey } from '@/types/apiKey'

const toast = useToast()

const props = defineProps<{
  apiKey: ApiKey
}>()

const emit = defineEmits<{
  edit: [apiKey: string]
  delete: [apiKey: string]
}>()

const copied = ref(false)
const showKey = ref(false)

const copyKey = async () => {
  try {
    await navigator.clipboard.writeText(props.apiKey.apiKey)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
    toast.add({
      title: 'API key copied to clipboard',
      color: 'success',
      icon: 'i-heroicons-clipboard-document-check',
    })
  } catch {
    toast.add({
      title: 'Failed to copy to clipboard',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

const formatDate = (timestamp: number | null) => {
  if (!timestamp) return 'Never'
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-1.5 min-w-0">
          <div
            class="shrink font-mono text-xs font-semibold bg-accented p-2 rounded truncate min-w-0"
          >
            {{ showKey ? apiKey.apiKey : '•'.repeat(apiKey.apiKey.length) }}
          </div>
          <button @click="showKey = !showKey" class="p-1 rounded hover:bg-accented">
            <UIcon
              :name="showKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              class="h-3.5 w-3.5"
            />
          </button>
          <button @click="copyKey" class="p-1 rounded hover:bg-accented">
            <UIcon
              :name="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
              class="h-3.5 w-3.5"
            />
          </button>
        </div>
        <p v-if="apiKey.note" class="text-xs text-muted mb-2">Description: {{ apiKey.note }}</p>
        <div class="flex gap-3 text-xs text-dimmed">
          <span v-if="apiKey.expiresAt">Expires: {{ formatDate(apiKey.expiresAt) }}</span>
        </div>
      </div>
      <div class="flex gap-0.5">
        <UButton
          icon="i-heroicons-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          @click="emit('edit', apiKey.apiKey)"
        />
        <UButton
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          size="xs"
          square
          @click="emit('delete', apiKey.apiKey)"
        />
      </div>
    </div>
  </UCard>
</template>
