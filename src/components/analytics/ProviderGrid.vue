<script setup lang="ts">
import {
  granularityOptions,
  getCompletionOpacity,
} from '@/composables/useAnalyticsData'
import type { ProviderTile as ProviderTileType } from '@/composables/useAnalyticsData'
import ProviderTile from './ProviderTile.vue'

const props = defineProps<{
  tiles: ProviderTileType[]
  granularity: string
  isLoading: boolean
  isLoadingSeries: boolean
  loadingProgress: { done: number; total: number }
  providerCount: number
}>()

const emit = defineEmits<{
  'update:granularity': [value: string]
}>()
</script>

<template>
  <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div class="text-center mb-8">
      <h2 class="text-3xl font-bold text-default mb-2">
        Coverage across {{ providerCount }} Canadian utilities
      </h2>
      <p class="text-muted">
        Each tile shows one provider's data completeness over time. Hover any cell for a detailed
        breakdown.
      </p>
    </div>

    <!-- Controls row -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">View:</span>
          <select
            :value="granularity"
            class="rounded-lg border border-default bg-elevated px-3 py-1.5 text-sm font-medium text-default shadow-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-colors"
            @change="emit('update:granularity', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="g in granularityOptions" :key="g.value" :value="g.value">
              {{ g.label }}
            </option>
          </select>
        </div>

        <!-- Loading progress -->
        <div v-if="isLoadingSeries" class="flex items-center gap-2">
          <span class="relative flex h-2.5 w-2.5">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500"></span>
          </span>
          <span class="text-xs text-muted tabular-nums">
            {{ loadingProgress.done }}/{{ loadingProgress.total }} providers
          </span>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-2 text-xs text-muted">
        <span class="font-medium">Less</span>
        <div
          v-for="val in [0, 25, 50, 75, 100]"
          :key="val"
          class="w-[11px] h-[11px] rounded-[2px] bg-muted relative overflow-hidden"
        >
          <div
            class="absolute inset-0 rounded-[2px]"
            :style="{
              backgroundColor: 'var(--color-primary-500)',
              opacity: getCompletionOpacity(val, val > 0),
            }"
          />
        </div>
        <span class="font-medium">More</span>
      </div>
    </div>

    <!-- Initial loading state -->
    <div v-if="isLoading && !tiles.length" class="flex items-center justify-center py-20">
      <span class="relative flex h-3 w-3 mr-3">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
        ></span>
        <span class="relative inline-flex h-3 w-3 rounded-full bg-primary-500"></span>
      </span>
      <span class="text-sm text-muted">Loading providers...</span>
    </div>

    <!-- Provider tile grid -->
    <TransitionGroup
      v-else
      name="tile"
      tag="div"
      class="grid gap-4"
      style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
    >
      <ProviderTile
        v-for="tile in tiles"
        :key="tile.key"
        :tile="tile"
        :granularity="granularity"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.tile-move {
  transition: transform 0.5s ease;
}
</style>
