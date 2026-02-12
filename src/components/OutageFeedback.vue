<script setup lang="ts">
import { computed } from 'vue'
import { useFeedbackStore } from '@/stores/feedback'
import type { FeedbackTargetType } from '@/types/feedback'

const props = defineProps<{
  targetType: FeedbackTargetType
  targetId: number | string
}>()

const feedbackStore = useFeedbackStore()

const summary = computed(() => feedbackStore.getSummary(props.targetType, props.targetId))
const loading = computed(() => feedbackStore.loading && !summary.value)

const myVote = computed(() => summary.value?.myVote ?? null)
const upvotes = computed(() => summary.value?.upvotes ?? 0)
const downvotes = computed(() => summary.value?.downvotes ?? 0)
const myFlag = computed(() => summary.value?.myFlag ?? false)

const vote = async (action: 'upvote' | 'downvote') => {
  await feedbackStore.submitVote(props.targetType, props.targetId, action)
}

const toggleFlag = async () => {
  await feedbackStore.toggleFlag(props.targetType, props.targetId)
}
</script>

<template>
  <!-- Skeleton -->
  <div v-if="loading" class="flex items-center gap-1">
    <span class="h-5 w-8 rounded-md bg-accented/50 animate-pulse" />
    <span class="h-5 w-8 rounded-md bg-accented/50 animate-pulse" />
    <span class="h-5 w-5 rounded-md bg-accented/50 animate-pulse ml-auto" />
  </div>

  <!-- Loaded -->
  <div v-else-if="summary" class="flex items-center gap-1">
    <!-- Upvote -->
    <button
      class="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs transition-colors"
      :class="
        myVote === 1
          ? 'bg-success-500/15 text-success-600 dark:text-success-400'
          : 'text-muted hover:bg-accented hover:text-default'
      "
      title="Upvote"
      @click="vote('upvote')"
    >
      <UIcon name="i-heroicons-hand-thumb-up" class="w-3.5 h-3.5" />
      <span v-if="upvotes">{{ upvotes }}</span>
    </button>

    <!-- Downvote -->
    <button
      class="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs transition-colors"
      :class="
        myVote === -1
          ? 'bg-error-500/15 text-error-600 dark:text-error-400'
          : 'text-muted hover:bg-accented hover:text-default'
      "
      title="Downvote"
      @click="vote('downvote')"
    >
      <UIcon name="i-heroicons-hand-thumb-down" class="w-3.5 h-3.5" />
      <span v-if="downvotes">{{ downvotes }}</span>
    </button>

    <!-- Flag -->
    <button
      class="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs transition-colors ml-auto"
      :class="
        myFlag
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'text-muted hover:bg-accented hover:text-default'
      "
      :title="myFlag ? 'Remove flag' : 'Flag as inaccurate'"
      @click="toggleFlag"
    >
      <UIcon name="i-heroicons-flag" class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
