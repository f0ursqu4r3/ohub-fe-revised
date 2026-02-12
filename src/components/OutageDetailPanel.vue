<script setup lang="ts">
import { computed, watch } from 'vue'
import type { PopupData, PopupItem, BoundsLiteral } from '@/components/map/types'
import { useFeedbackStore } from '@/stores/feedback'
import OutageFeedback from '@/components/OutageFeedback.vue'

const props = defineProps<{
  data: PopupData | null
}>()

const feedbackStore = useFeedbackStore()

// Fetch feedback summaries whenever the panel data changes
watch(
  () => props.data,
  (d) => {
    if (!d?.items.length) return
    const ids = d.items.map((item) => item.id)
    feedbackStore.fetchSummaries(ids)
  },
  { immediate: true },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'selectItem', item: PopupItem): void
  (e: 'zoomToAll', bounds: BoundsLiteral): void
  (e: 'highlight', id: string | number): void
  (e: 'unhighlight'): void
}>()

const formatCustomerCount = (count: number | null | undefined) => {
  if (!count) return null
  return count.toLocaleString()
}

const combinedBounds = computed<BoundsLiteral | null>(() => {
  const items = props.data?.items
  if (!items || items.length < 2) return null
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity
  for (const item of items) {
    if (!item.bounds) continue
    const [[s, w], [n, e]] = item.bounds
    if (s < minLat) minLat = s
    if (w < minLng) minLng = w
    if (n > maxLat) maxLat = n
    if (e > maxLng) maxLng = e
  }
  if (!isFinite(minLat)) return null
  return [[minLat, minLng], [maxLat, maxLng]]
})
</script>

<template>
  <Transition name="slide-right">
    <div
      v-if="data"
      class="fixed top-0 right-0 bottom-0 z-40 w-80 flex flex-col bg-(--ui-bg-elevated)/95 backdrop-blur-xl border-l border-accented shadow-2xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-accented h-16">
        <div class="min-w-0">
          <h2 class="text-sm font-bold text-default truncate">{{ data.title }}</h2>
          <p class="text-xs text-muted">{{ data.timeLabel }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            v-if="combinedBounds"
            icon="i-heroicons-arrows-pointing-out"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            aria-label="Zoom to all outages"
            @click="emit('zoomToAll', combinedBounds!)"
          />
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            aria-label="Close panel"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="!data.items.length" class="px-4 py-8 text-center text-sm text-muted">
          No outage details available.
        </div>

        <div v-else class="divide-y divide-accented/50">
          <div
            v-for="item in data.items"
            :key="item.id"
            class="px-4 py-3 space-y-2 hover:bg-accented/30 transition-colors"
            @mouseenter="emit('highlight', item.id)"
            @mouseleave="emit('unhighlight')"
          >
            <!-- Provider + zoom -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold text-default truncate">{{ item.provider }}</span>
                <span
                  v-if="item.isPlanned"
                  class="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded"
                >
                  Planned
                </span>
              </div>
              <button
                v-if="item.bounds"
                class="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors"
                title="Zoom to outage"
                @click="emit('selectItem', item)"
              >
                <UIcon name="i-heroicons-arrows-pointing-out" class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Details grid -->
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <template v-if="item.areaLabel">
                <span class="text-muted">Area</span>
                <span class="text-default font-medium">{{ item.areaLabel }}</span>
              </template>

              <template v-if="formatCustomerCount(item.customerCount)">
                <span class="text-muted">Customers</span>
                <span class="text-default font-medium">{{
                  formatCustomerCount(item.customerCount)
                }}</span>
              </template>

              <template v-if="item.outageType">
                <span class="text-muted">Type</span>
                <span class="text-default font-medium capitalize">{{ item.outageType }}</span>
              </template>

              <template v-if="item.cause">
                <span class="text-muted">Cause</span>
                <span class="text-default font-medium capitalize">{{ item.cause }}</span>
              </template>

              <template v-if="item.etr">
                <span class="text-muted">ETR</span>
                <span class="text-default font-medium">{{ item.etr }}</span>
              </template>
            </div>

            <!-- Feedback -->
            <OutageFeedback :target-type="'outage'" :target-id="item.id" />
          </div>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.2s ease;
}
.slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
