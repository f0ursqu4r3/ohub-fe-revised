<script setup lang="ts">
import { computed } from 'vue'
import {
  complianceFields,
  compositeScore,
  SPARK_W,
  SPARK_H,
} from '@/composables/useAnalyticsData'
import type { ProviderTile } from '@/composables/useAnalyticsData'
import type { ProviderDirectoryItem, ComplianceBucket } from '@/types/analytics'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  providerName: string
  directory: ProviderDirectoryItem | null
  tile: ProviderTile | null
  buckets: ComplianceBucket[]
  granularity: string
}>()

const displayName = computed(() => props.directory?.niceName ?? props.providerName)

const images = computed(() => {
  if (!props.directory) return []
  const imgs: { src: string; label: string }[] = []
  if (props.directory.picScenic) imgs.push({ src: props.directory.picScenic, label: 'Scenic' })
  if (props.directory.picOffice) imgs.push({ src: props.directory.picOffice, label: 'Office' })
  if (props.directory.picUtility) imgs.push({ src: props.directory.picUtility, label: 'Utility' })
  return imgs
})

const fieldBreakdown = computed(() => {
  if (!props.buckets.length) return null
  let grandTotal = 0
  const totals: Record<string, number> = {}
  for (const f of complianceFields) totals[f.value] = 0

  for (const b of props.buckets) {
    grandTotal += b.total
    for (const f of complianceFields) {
      totals[f.value]! += b[f.value as keyof ComplianceBucket] as number
    }
  }

  if (!grandTotal) return null
  return complianceFields.map((f) => ({
    label: f.label,
    key: f.value,
    pct: Math.round((totals[f.value]! / grandTotal) * 100),
  }))
})

const totalOutages = computed(() => {
  return props.buckets.reduce((sum, b) => sum + b.total, 0)
})

const overallScore = computed(() => {
  if (!props.buckets.length) return null
  const weighted = props.buckets.reduce((sum, b) => {
    if (b.total === 0) return sum
    return sum + compositeScore(b) * b.total
  }, 0)
  const total = totalOutages.value
  return total > 0 ? Math.round(weighted / total) : null
})

const scoreColor = computed(() => {
  if (overallScore.value == null) return ''
  if (overallScore.value >= 80) return 'text-emerald-500'
  if (overallScore.value >= 50) return 'text-amber-500'
  return 'text-red-400'
})
</script>

<template>
  <UModal v-model:open="open" :title="displayName" description="" size="lg">
    <template #body>
      <div class="-mx-6 -mt-6">
        <!-- Hero banner -->
        <div class="relative overflow-hidden" :class="images.length ? 'h-48' : 'h-24'">
          <!-- Single image or first of many as full hero -->
          <img
            v-if="images.length"
            :src="images[0]!.src"
            :alt="displayName"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full bg-linear-to-br from-primary-500/20 to-primary-600/10"
          />
          <div class="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />

          <!-- Name + links overlay at bottom of hero -->
          <div class="absolute bottom-0 left-0 right-0 p-5">
            <!-- <h2 class="text-xl font-bold text-white mb-2 drop-shadow-sm">{{ displayName }}</h2> -->
            <div class="flex items-center gap-2">
              <a
                v-if="directory?.mapLink"
                :href="directory.mapLink"
                target="_blank"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium text-white hover:bg-white/30 transition-colors"
              >
                <UIcon name="i-heroicons-map" class="w-3.5 h-3.5" />
                Outage Map
              </a>
              <a
                v-if="directory?.contactLink"
                :href="directory.contactLink"
                target="_blank"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium text-white hover:bg-white/30 transition-colors"
              >
                <UIcon name="i-heroicons-globe-alt" class="w-3.5 h-3.5" />
                Website
              </a>
            </div>
          </div>
        </div>

        <!-- Secondary images -->
        <div v-if="images.length > 1" class="flex gap-3 px-6 pt-4">
          <div
            v-for="img in images.slice(1)"
            :key="img.label"
            class="relative flex-1 h-24 rounded-lg overflow-hidden"
          >
            <img :src="img.src" :alt="img.label" class="w-full h-full object-cover" />

          </div>
        </div>

        <!-- Content -->
        <div class="px-6 pt-5 pb-1 space-y-5">
          <!-- Stats row -->
          <div class="flex items-stretch gap-3">
            <div
              v-if="overallScore != null"
              class="flex-1 rounded-xl border border-default bg-elevated/50 p-3.5 text-center"
            >
              <div class="text-2xl font-bold tabular-nums" :class="scoreColor">
                {{ overallScore }}%
              </div>
              <div class="text-[11px] text-muted mt-0.5">Completeness</div>
            </div>
            <div class="flex-1 rounded-xl border border-default bg-elevated/50 p-3.5 text-center">
              <div class="text-2xl font-bold text-default tabular-nums">
                {{ totalOutages.toLocaleString() }}
              </div>
              <div class="text-[11px] text-muted mt-0.5">Outages tracked</div>
            </div>
            <div
              v-if="fieldBreakdown"
              class="flex-1 rounded-xl border border-default bg-elevated/50 p-3.5 text-center"
            >
              <div class="text-2xl font-bold text-default tabular-nums">
                {{ fieldBreakdown.filter((f) => f.pct >= 80).length }}/{{ fieldBreakdown.length }}
              </div>
              <div class="text-[11px] text-muted mt-0.5">Fields above 80%</div>
            </div>
          </div>

          <!-- Blurb -->
          <p v-if="directory?.blurb" class="text-sm text-muted leading-relaxed">
            {{ directory.blurb }}
          </p>

          <!-- Sparkline -->
          <div v-if="tile?.sparkPath" class="rounded-xl border border-default bg-elevated/50 p-4">
            <div class="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
              Outage volume trend
            </div>
            <svg
              :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
              class="w-full"
              :style="{ height: '36px' }"
              preserveAspectRatio="none"
            >
              <path
                :d="tile.sparkPath"
                fill="none"
                stroke="var(--color-primary-500)"
                vector-effect="non-scaling-stroke"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>

          <!-- Field breakdown -->
          <div v-if="fieldBreakdown">
            <div class="text-[11px] font-medium text-muted uppercase tracking-wider mb-3">
              Field completeness
            </div>
            <div class="space-y-2.5">
              <div v-for="field in fieldBreakdown" :key="field.key">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-muted">{{ field.label }}</span>
                  <span
                    class="text-xs font-semibold tabular-nums"
                    :class="
                      field.pct >= 80
                        ? 'text-emerald-500'
                        : field.pct >= 50
                          ? 'text-amber-500'
                          : 'text-red-400'
                    "
                  >
                    {{ field.pct }}%
                  </span>
                </div>
                <div class="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="
                      field.pct >= 80
                        ? 'bg-emerald-500'
                        : field.pct >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                    "
                    :style="{ width: `${field.pct}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
