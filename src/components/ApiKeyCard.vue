<script setup lang="ts">
import { ref } from 'vue'
import type { ApiKey } from '@/types/apiKey'

const props = defineProps<{
  apiKey: ApiKey
}>()

const emit = defineEmits<{
  edit: [id: number]
  delete: [id: number]
}>()

const copied = ref(false)

const copyKeyPrefix = async () => {
  await navigator.clipboard.writeText(props.apiKey.apiKey.substring(0, 8) + '...')
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1">
        <div class="flex items-center gap-1.5 mb-1.5">
          <code class="font-mono text-xs font-semibold bg-accented px-1.5 py-0.5 rounded">
            {{ apiKey.apiKey.substring(0, 8) }}...
          </code>
          <button @click="copyKeyPrefix" class="p-1 rounded hover:bg-accented">
            <UIcon :name="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="h-3.5 w-3.5" />
          </button>
        </div>
        <p v-if="apiKey.note" class="text-xs text-muted mb-2">{{ apiKey.note }}</p>
        <div class="flex gap-3 text-xs text-dimmed">
          <span>Created: {{ formatDate(apiKey.createdAt) }}</span>
          <span v-if="apiKey.expiresAt">Expires: {{ formatDate(apiKey.expiresAt) }}</span>
        </div>
      </div>
      <div class="flex gap-0.5">
        <UButton
          icon="i-heroicons-pencil"
          color="gray"
          variant="ghost"
          size="xs"
          square
          @click="emit('edit', apiKey.id)"
        />
        <UButton
          icon="i-heroicons-trash"
          color="red"
          variant="ghost"
          size="xs"
          square
          @click="emit('delete', apiKey.id)"
        />
      </div>
    </div>
  </UCard>
</template>
