<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@nuxt/ui/composables'
import { useAdminStore } from '@/stores/admin'
import type { AdminFeedbackComment } from '@/types/admin'

const toast = useToast()
const adminStore = useAdminStore()
const { feedbackComments, feedbackTotal, isLoading, error } = storeToRefs(adminStore)

onMounted(() => {
  adminStore.fetchFeedbackComments()
})

// -- Search / filter --
const search = ref('')
const filteredComments = computed(() => {
  if (!search.value) return feedbackComments.value
  const q = search.value.toLowerCase()
  return feedbackComments.value.filter(
    (c) =>
      c.comment.toLowerCase().includes(q) ||
      (c.authorEmail && c.authorEmail.toLowerCase().includes(q)) ||
      c.targetType.toLowerCase().includes(q) ||
      String(c.id).includes(q),
  )
})

// -- Delete Comment --
const showDeleteModal = ref(false)
const deletingComment = ref<AdminFeedbackComment | null>(null)

function openDeleteModal(comment: AdminFeedbackComment) {
  deletingComment.value = comment
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingComment.value) return
  try {
    await adminStore.deleteFeedbackComment(deletingComment.value.id)
    toast.add({ title: 'Comment deleted', color: 'success', icon: 'i-heroicons-check-circle' })
    showDeleteModal.value = false
    deletingComment.value = null
  } catch {
    toast.add({
      title: 'Failed to delete comment',
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
    hour: '2-digit',
    minute: '2-digit',
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
          placeholder="Search comments..."
          size="sm"
          class="w-64"
        />
        <span class="text-xs text-muted">{{ filteredComments.length }} of {{ feedbackTotal }} comments</span>
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
    <div v-if="isLoading && !feedbackComments.length" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="mb-3">
          <span class="relative flex h-10 w-10 mx-auto">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
            <span class="relative inline-flex h-10 w-10 rounded-full bg-primary-500"></span>
          </span>
        </div>
        <p class="text-xs font-medium text-muted">Loading comments...</p>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && !feedbackComments.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-chat-bubble-left-right" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No feedback comments</h3>
      <p class="text-muted text-xs">No comments have been submitted yet</p>
    </div>

    <!-- Table -->
    <div v-else-if="filteredComments.length" class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated border-b border-default">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">ID</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Target</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Author</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Comment</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Created</th>
            <th class="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="comment in filteredComments"
            :key="comment.id"
            class="hover:bg-elevated/50 transition-colors"
          >
            <td class="px-4 py-3 text-default font-mono text-xs">{{ comment.id }}</td>
            <td class="px-4 py-3">
              <UBadge color="neutral" variant="soft" size="xs">
                {{ comment.targetType }}
              </UBadge>
              <span class="ml-1 font-mono text-xs text-muted">#{{ comment.targetId }}</span>
            </td>
            <td class="px-4 py-3 text-default text-xs">{{ comment.authorEmail || 'Anonymous' }}</td>
            <td class="px-4 py-3 text-default text-xs max-w-xs truncate">{{ comment.comment }}</td>
            <td class="px-4 py-3 text-muted text-xs whitespace-nowrap">{{ formatDate(comment.createdAt) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end">
                <UTooltip text="Delete" :delay-open="0">
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="openDeleteModal(comment)"
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
      v-else-if="!isLoading && feedbackComments.length && !filteredComments.length"
      class="text-center py-12 bg-elevated rounded-lg border border-default"
    >
      <UIcon name="i-heroicons-funnel" class="h-10 w-10 text-dimmed mx-auto mb-3" />
      <h3 class="text-base font-semibold text-default mb-1">No matching comments</h3>
      <p class="text-muted text-xs">Try a different search term</p>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteModal" title="Delete Comment">
      <template #body>
        <div class="space-y-4">
          <p class="text-default">
            Are you sure you want to delete this comment?
          </p>
          <div v-if="deletingComment" class="bg-accented px-4 py-3 rounded space-y-1">
            <p class="text-sm text-default">
              <span class="font-medium">ID:</span> {{ deletingComment.id }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Author:</span> {{ deletingComment.authorEmail || 'Anonymous' }}
            </p>
            <p class="text-sm text-default">
              <span class="font-medium">Comment:</span> {{ deletingComment.comment }}
            </p>
          </div>
          <UAlert
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="This action cannot be undone"
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
