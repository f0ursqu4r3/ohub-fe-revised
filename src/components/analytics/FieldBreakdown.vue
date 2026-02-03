<script setup lang="ts">
import type { FieldBreakdownItem } from '@/composables/useAnalyticsData'

defineProps<{
  fields: FieldBreakdownItem[]
}>()
</script>

<template>
  <div class="space-y-2.5">
    <div v-for="field in fields" :key="field.key">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-muted">{{ field.label }}</span>
        <span
          class="text-xs font-medium tabular-nums"
          :class="field.pct >= 80 ? 'text-primary-500' : 'text-muted'"
        >
          {{ field.pct }}%
        </span>
      </div>
      <div class="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          class="h-full rounded-full bg-primary-500 transition-all duration-500"
          :style="{ width: `${field.pct}%` }"
        />
      </div>
    </div>
  </div>
</template>
