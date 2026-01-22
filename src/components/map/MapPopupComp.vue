<script lang="ts" setup>
import type { PopupData, BoundsLiteral } from './types'

defineProps<{
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
</script>

<template>
  <div class="max-w-[320px] min-w-[220px] overflow-hidden p-0 pb-2.5 text-[15px]">
    <div class="flex items-center gap-3 pb-2.5 pl-3.5 pr-4 pt-3">
      <div class="min-w-0 flex-1">
        <h3 class="mb-px truncate text-[17px] font-bold leading-[1.2] text-primary-900">
          {{ popupData.title }}
        </h3>
        <time class="block text-[12.5px] text-[#2563eb] opacity-[0.85]">
          {{ popupData.timeLabel }}
        </time>
      </div>
    </div>
    <div class="flex flex-col gap-3 px-4 pt-3">
      <div
        v-for="(item, idx) in popupData.items"
        :key="idx"
        class="flex items-start justify-between gap-2.5 rounded-lg bg-[#f1f5f9] px-2.5 pb-[7px] pt-2 shadow-[0_1px_2px_rgba(24,184,166,0.04)] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(24,184,166,0.1)]"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5 wrap-break-word">
          <span class="text-[14px] font-semibold text-[#18b8a6]">{{ item.provider }}</span>
          <span v-if="item.sizeLabel" class="text-[13px] text-[#64748b]">{{ item.sizeLabel }}</span>
          <span v-if="item.outageType" class="text-[13px] text-[#ff7c00]">
            {{ item.outageType }}
          </span>
          <span v-if="item.cause" class="text-[13px] text-[#b91c1c]">{{ item.cause }}</span>
          <span v-if="item.customerCount != null" class="text-[13px] text-primary-900">
            {{ item.customerCount }} customers
          </span>
          <span v-if="item.isPlanned != null" class="text-[13px] text-[#64748b]">
            {{ item.isPlanned ? 'Planned' : 'Unplanned' }}
          </span>
          <span v-if="item.etr" class="text-[13px] text-[#2563eb]">ETR: {{ item.etr }}</span>
        </div>
        <button
          v-if="item.bounds"
          class="ml-1.5 inline-flex cursor-pointer items-center gap-0.5 self-start rounded-[7px] border-0 bg-[linear-gradient(90deg,#e8eef7_60%,#d8e4f3_100%)] px-2 py-1 text-[#18b8a6] shadow-[0_1px_2px_rgba(24,184,166,0.07)] transition duration-150 hover:bg-[#c7e6e2] hover:text-primary-900 hover:shadow-[0_2px_8px_rgba(24,184,166,0.13)] active:scale-95"
          :data-bounds="encodeBounds(item.bounds)"
          title="Zoom to extent"
          @click.stop="onZoom(item.bounds)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            width="16"
            height="16"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    </div>
    <p v-if="popupData.extraCount > 0" class="mt-2.5 pl-[18px] text-[13px] text-[#64748b]">
      +{{ popupData.extraCount }} more
    </p>
  </div>
</template>
