<script lang="ts" setup>
import { computed } from 'vue'
import type { PopupData, BoundsLiteral } from './types'

const props = defineProps<{
  popupData: PopupData
}>()

const emit = defineEmits<{
  (e: 'zoom', bounds: BoundsLiteral): void
}>()

function encodeBounds(bounds: BoundsLiteral) {
  return encodeURIComponent(JSON.stringify(bounds))
}

function onZoom(bounds: BoundsLiteral) {
  emit('zoom', bounds)
}

const isSingle = computed(
  () => props.popupData.items.length === 1 && props.popupData.extraCount === 0,
)
</script>

<template>
  <div class="max-w-[320px] min-w-[220px] overflow-hidden p-0 pb-2.5 text-[15px] text-default">
    <div class="flex items-center gap-3 pb-2.5 pl-3.5 pr-4 pt-3">
      <div class="min-w-0 flex-1">
        <h3 class="mb-px truncate text-[17px] font-bold leading-[1.2] text-default">
          {{ popupData.title }}
        </h3>
        <time class="block text-[12.5px] text-primary-600 opacity-[0.85] dark:text-primary-400">
          {{ popupData.timeLabel }}
        </time>
      </div>
    </div>
    <div class="flex flex-col gap-3 p-2">
      <div
        v-for="(item, idx) in popupData.items"
        :key="idx"
        class="flex items-start justify-between gap-2.5 rounded-lg border border-muted bg-(--ui-bg-elevated)/70 px-2.5 pb-[7px] pt-2 shadow-[0_1px_2px_rgba(24,184,166,0.04)] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(24,184,166,0.1)]"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5 wrap-break-word">
          <template v-if="isSingle">
            <span v-if="item.sizeLabel" class="text-[13px] text-muted">{{ item.sizeLabel }}</span>
            <span v-if="item.outageType" class="text-[13px] text-amber-600 dark:text-amber-400">
              {{ item.outageType }}
            </span>
            <span v-if="item.cause" class="text-[13px] text-rose-600 dark:text-rose-400">
              {{ item.cause }}
            </span>
            <span v-if="item.customerCount != null" class="text-[13px] text-default">
              {{ item.customerCount }} customers
            </span>
            <span v-if="item.isPlanned != null" class="text-[13px] text-muted">
              {{ item.isPlanned ? 'Planned' : 'Unplanned' }}
            </span>
            <span v-if="item.etr" class="text-[13px] text-primary-600 dark:text-primary-400">
              ETR: {{ item.etr }}
            </span>
          </template>
          <template v-else>
            <span class="text-[14px] font-semibold text-primary-600 dark:text-primary-400">{{
              item.provider
            }}</span>
            <span v-if="item.sizeLabel" class="text-[13px] text-muted">{{ item.sizeLabel }}</span>
            <span v-if="item.outageType" class="text-[13px] text-amber-600 dark:text-amber-400">
              {{ item.outageType }}
            </span>
            <span v-if="item.customerCount != null" class="text-[13px] text-default">
              {{ item.customerCount }} customers
            </span>
          </template>
        </div>
        <button
          v-if="item.bounds"
          class="ml-1.5 inline-flex cursor-pointer items-center gap-0.5 self-start rounded-[7px] border border-default bg-elevated p-1 text-primary-600 shadow-[0_1px_2px_rgba(24,184,166,0.07)] transition duration-150 hover:bg-primary-500/10 hover:text-primary-700 hover:shadow-[0_2px_8px_rgba(24,184,166,0.13)] active:scale-95 dark:text-primary-400 dark:hover:text-primary-300"
          :data-bounds="encodeBounds(item.bounds)"
          title="Zoom to extent"
          @click.stop="onZoom(item.bounds)"
        >
          <UIcon name="i-heroicons-magnifying-glass-plus" class="h-4 w-4" />
        </button>
      </div>
    </div>
    <p v-if="popupData.extraCount > 0" class="mt-2.5 pl-[18px] text-[13px] text-muted">
      +{{ popupData.extraCount }} more
    </p>
  </div>
</template>
