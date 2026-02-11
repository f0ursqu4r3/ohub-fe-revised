<script lang="ts" setup>
import { computed } from 'vue'
import type { UserOutageReport } from '@/types/userOutage'
import { formatDate } from '@/lib/utils'

const props = defineProps<{
  reports: UserOutageReport[]
}>()

const title = computed(() => {
  const count = props.reports.length
  return count === 1 ? 'User Report' : `${count} User Reports`
})

const displayItems = computed(() => props.reports.slice(0, 6))
const extraCount = computed(() => Math.max(0, props.reports.length - 6))

function timeLabel(report: UserOutageReport): string {
  return formatDate(report.observedTs ?? report.createdAt)
}

function durationString(report: UserOutageReport): string | null {
  const ts = report.observedTs ?? report.createdAt
  if (!ts) return null
  const seconds = Math.floor(Date.now() / 1000) - ts
  if (seconds < 0) return null
  if (seconds < 60) return 'Less than a minute ago'
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  }
  const days = Math.floor(seconds / 86400)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}
</script>

<template>
  <div class="max-w-96 min-w-72 overflow-hidden p-0 pb-2.5 text-[15px] text-default py-6">
    <!-- Single report: detail view matching outage popup style -->
    <template v-if="reports.length === 1 && reports[0]">
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3.5 pt-3 pb-2 text-[13px]">
        <dt class="text-muted">Reported</dt>
        <dd class="text-violet-600 dark:text-violet-400">{{ timeLabel(reports[0]) }}</dd>

        <dt v-if="durationString(reports[0])" class="text-muted">Duration</dt>
        <dd v-if="durationString(reports[0])" class="text-default">{{ durationString(reports[0]) }}</dd>

        <dt class="text-muted">Provider</dt>
        <dd v-if="reports[0].provider" class="">{{ reports[0].provider }}</dd>
        <dd v-else class="text-muted italic">Unknown</dd>

        <dt class="text-muted">Cause</dt>
        <dd v-if="reports[0].cause" class="text-rose-600 dark:text-rose-400">{{ reports[0].cause }}</dd>
        <dd v-else class="text-muted italic">Not specified</dd>

        <dt v-if="reports[0].customerCount != null" class="text-muted">Affected</dt>
        <dd v-if="reports[0].customerCount != null" class="font-semibold text-default">
          {{ reports[0].customerCount.toLocaleString() }} customers
        </dd>

        <dt v-if="reports[0].isPlanned != null" class="text-muted">Status</dt>
        <dd v-if="reports[0].isPlanned != null" class="text-default">
          {{ reports[0].isPlanned ? 'Planned' : 'Unplanned' }}
        </dd>

        <dt v-if="reports[0].addressText" class="text-muted">Location</dt>
        <dd v-if="reports[0].addressText" class="text-default truncate">{{ reports[0].addressText }}</dd>

        <dt v-if="reports[0].notes" class="text-muted">Notes</dt>
        <dd v-if="reports[0].notes" class="text-default">{{ reports[0].notes }}</dd>
      </dl>
    </template>

    <!-- Multiple reports: list view -->
    <template v-else>
      <div class="px-3.5 pt-3 pb-1">
        <h3 class="text-[14px] font-bold text-default">{{ title }}</h3>
      </div>
      <dl
        v-for="report in displayItems"
        :key="report.id"
        class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-muted px-3.5 py-2.5 text-[13px] last:border-b-0"
      >
        <dt class="text-muted">Provider</dt>
        <dd class="font-semibold">{{ report.provider ?? 'Unknown' }}</dd>

        <dt class="text-muted">Reported</dt>
        <dd class="text-violet-600 dark:text-violet-400">{{ timeLabel(report) }}</dd>

        <dt v-if="report.notes" class="text-muted">Notes</dt>
        <dd v-if="report.notes" class="text-default truncate">{{ report.notes }}</dd>
      </dl>
    </template>

    <p
      v-if="extraCount > 0"
      class="mt-2 border-t border-muted px-3.5 pt-2 text-[13px] text-muted"
    >
      +{{ extraCount }} more report{{ extraCount !== 1 ? 's' : '' }} in this area
    </p>
  </div>
</template>
