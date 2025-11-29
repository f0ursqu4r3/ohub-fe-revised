<script setup lang="ts">
import type { PopupData } from './types'

defineProps<{
  data: PopupData
}>()
</script>

<template>
  <div class="min-w-[200px] max-w-[260px] text-slate-900 font-sans">
    <div class="flex items-center justify-between gap-2 font-bold text-sm mb-2">
      <span>{{ data.title }}</span>
      <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">{{ data.timeLabel }}</span>
    </div>
    <ul class="grid gap-1.5">
      <li
        v-for="(item, idx) in data.items"
        :key="`item-${idx}`"
        class="flex items-center justify-between gap-2 text-xs"
      >
        <span class="font-semibold text-slate-800">{{ item.provider }}</span>
      </li>
      <li v-if="data.extraCount > 0" class="text-xs text-slate-600">+{{ data.extraCount }} more…</li>
    </ul>
  </div>
</template>
