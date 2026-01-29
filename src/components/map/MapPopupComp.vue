<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { PopupData, BoundsLiteral } from './types'

const props = defineProps<{
  popupData: PopupData
}>()

const emit = defineEmits<{
  (e: 'zoom', bounds: BoundsLiteral): void
}>()

function encodeBounds(bounds: BoundsLiteral): string {
  return encodeURIComponent(JSON.stringify(bounds))
}

function onZoom(bounds: BoundsLiteral) {
  emit('zoom', bounds)
}

interface OutageItem {
  id: string
  provider: string
  outageType: string | null
  cause: string | null
  customerCount: number | null
  sizeLabel: string | null
  isPlanned: boolean | null
  etr: string | null
  bounds: BoundsLiteral | null
  isSingle: boolean
}

const durationString = computed(() => {
  const startTs = props.popupData.startTs
  if (!startTs) return null

  // startTs is in seconds, Date.now() is in milliseconds
  const durationSeconds = Math.floor(Date.now() / 1000) - startTs
  if (durationSeconds < 0) return null

  if (durationSeconds < 60) {
    return 'Less than a minute'
  } else if (durationSeconds < 3600) {
    const mins = Math.floor(durationSeconds / 60)
    return `${mins} minute${mins !== 1 ? 's' : ''}`
  } else if (durationSeconds < 86400) {
    const hours = Math.floor(durationSeconds / 3600)
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  } else {
    const days = Math.floor(durationSeconds / 86400)
    return `${days} day${days !== 1 ? 's' : ''}`
  }
})

const outageItem = computed<OutageItem>(() => {
  const items = props.popupData.items
  const isSingle = items.length === 1 && props.popupData.extraCount === 0

  if (isSingle && items[0]) {
    const item = items[0]
    return {
      id: String(item.id),
      provider: item.provider,
      outageType: item.outageType ?? null,
      cause: item.cause ?? null,
      customerCount: item.customerCount ?? null,
      sizeLabel: item.sizeLabel ?? null,
      isPlanned: item.isPlanned ?? null,
      etr: item.etr ?? null,
      bounds: item.bounds,
      isSingle: true,
    }
  }

  // Combine multiple items
  const totalCustomers = items.reduce((sum, item) => sum + (item.customerCount ?? 0), 0)
  const outageTypes = [...new Set(items.map((i) => i.outageType))]
  const causes = [...new Set(items.map((i) => i.cause))]
  const hasPlanned = items.some((i) => i.isPlanned === true)
  const hasUnplanned = items.some((i) => i.isPlanned === false)

  // Compute combined bounds from all items
  const allBounds = items.map((i) => i.bounds).filter((b): b is BoundsLiteral => b !== null)
  let combinedBounds: BoundsLiteral | null = null
  if (allBounds.length > 0) {
    const minLng = Math.min(...allBounds.map((b) => b[0][0]))
    const minLat = Math.min(...allBounds.map((b) => b[0][1]))
    const maxLng = Math.max(...allBounds.map((b) => b[1][0]))
    const maxLat = Math.max(...allBounds.map((b) => b[1][1]))
    combinedBounds = [
      [minLng, minLat],
      [maxLng, maxLat],
    ]
  }

  return {
    id: 'combined',
    provider: props.popupData.title,
    outageType:
      outageTypes.length === 1 ? outageTypes[0]! : outageTypes.length > 1 ? 'Mixed' : null,
    cause: causes.length === 1 ? causes[0]! : causes.length > 1 ? 'Multiple causes' : null,
    customerCount: totalCustomers > 0 ? totalCustomers : null,
    sizeLabel: null,
    isPlanned: hasPlanned && !hasUnplanned ? true : !hasPlanned && hasUnplanned ? false : null,
    etr: null,
    bounds: combinedBounds,
    isSingle: false,
  }
})

// Help text for missing data. We do our best to collect comprehensive outage data,
// but sometimes data may be incomplete or missing due to provider data availability.
const whyIsDataMissingHelpText =
  'This information was not provided by the utility company in their outage report.'

const copyStatus = ref<'idle' | 'copied'>('idle')

async function copyGeoJsonText() {
  if (!props.popupData.geoJsonText) return
  await navigator.clipboard.writeText(props.popupData.geoJsonText)
  copyStatus.value = 'copied'
  setTimeout(() => {
    copyStatus.value = 'idle'
  }, 2000)
}
</script>

<template>
  <div class="max-w-96 min-w-72 overflow-hidden p-0 pb-2.5 text-[15px] text-default">
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
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3.5 pb-2 text-[13px]">
      <dt class="text-muted">Type</dt>
      <dd v-if="outageItem.outageType" class="text-amber-600 dark:text-amber-400">
        {{ outageItem.outageType }}
      </dd>
      <UTooltip v-else :text="whyIsDataMissingHelpText">
        <dd class="cursor-help text-muted italic">Unknown</dd>
      </UTooltip>

      <dt class="text-muted">Status</dt>
      <dd v-if="outageItem.isPlanned != null" class="text-default">
        {{ outageItem.isPlanned ? 'Planned' : 'Unplanned' }}
      </dd>
      <UTooltip v-else :text="whyIsDataMissingHelpText">
        <dd class="cursor-help text-muted italic">Unknown</dd>
      </UTooltip>

      <dt class="text-muted">Affected</dt>
      <dd v-if="outageItem.customerCount != null" class="font-semibold text-default">
        {{ outageItem.customerCount.toLocaleString() }} customers
      </dd>
      <UTooltip v-else :text="whyIsDataMissingHelpText">
        <dd class="cursor-help text-muted italic">Unknown</dd>
      </UTooltip>

      <dt v-if="outageItem.sizeLabel" class="text-muted">Area</dt>
      <dd v-if="outageItem.sizeLabel" class="text-default">{{ outageItem.sizeLabel }}</dd>

      <dt class="text-muted">Cause</dt>
      <dd v-if="outageItem.cause" class="text-rose-600 dark:text-rose-400">
        {{ outageItem.cause }}
      </dd>
      <UTooltip v-else :text="whyIsDataMissingHelpText">
        <dd class="cursor-help text-muted italic">Unknown</dd>
      </UTooltip>

      <dt v-if="durationString" class="text-muted">Duration</dt>
      <dd v-if="durationString" class="text-default">{{ durationString }}</dd>

      <dt class="text-muted">Est. restore</dt>
      <dd v-if="outageItem.etr" class="text-primary-600 dark:text-primary-400">
        {{ outageItem.etr }}
      </dd>
      <UTooltip v-else :text="whyIsDataMissingHelpText">
        <dd class="cursor-help text-muted italic">Unknown</dd>
      </UTooltip>
    </dl>

    <div v-if="outageItem.bounds" class="flex gap-2 px-3.5 pb-1">
      <!-- Zoom button -->
      <button
        class="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 rounded-[7px] border border-default bg-elevated px-2 py-1 text-[13px] text-primary-600 shadow-sm transition duration-150 hover:bg-primary-500/10 hover:text-primary-700 active:scale-95 dark:text-primary-400 dark:hover:text-primary-300"
        :data-bounds="encodeBounds(outageItem.bounds)"
        title="Zoom to extent"
        @click.stop="onZoom(outageItem.bounds)"
      >
        <UIcon name="i-heroicons-magnifying-glass-plus" class="h-4 w-4" />
        <span>Zoom to area</span>
      </button>
      <!-- Copy GeoJSON button -->
      <button
        class="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 rounded-[7px] border border-default bg-elevated px-2 py-1 text-[13px] text-primary-600 shadow-sm transition duration-150 hover:bg-primary-500/10 hover:text-primary-700 active:scale-95 dark:text-primary-400 dark:hover:text-primary-300"
        title="Copy bounds as GeoJSON"
        @click.stop="copyGeoJsonText"
      >
        <UIcon
          :name="copyStatus === 'copied' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
          class="h-4 w-4"
        />
        <span>{{ copyStatus === 'copied' ? 'Copied!' : 'Copy GeoJSON' }}</span>
      </button>
    </div>
    <!-- Multi-item indicator -->
    <p
      v-if="!outageItem.isSingle"
      class="mt-2 border-t border-muted px-3.5 pt-2 text-[13px] text-muted"
    >
      {{ popupData.items.length }}{{ popupData.extraCount > 0 ? '+' : '' }} outages in this area
    </p>
  </div>
</template>
