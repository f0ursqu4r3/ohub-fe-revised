<script setup lang="ts">
import {
  complianceFields,
  fieldPct,
  getCompletionOpacity,
  CELL_SIZE,
  CELL_GAP,
  WEEK_PX,
  DAY_LABEL_WIDTH,
  SPARK_W,
  SPARK_H,
  dayOfWeekLabels,
} from '@/composables/useAnalyticsData'
import type { ProviderTile } from '@/composables/useAnalyticsData'

defineProps<{
  tile: ProviderTile
  granularity: string
}>()
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated p-3 shadow-sm">
    <!-- Provider name + score + loading -->
    <div class="flex items-center gap-1.5 mb-2">
      <span class="text-xs font-medium text-default truncate">{{ tile.label }}</span>
      <span v-if="tile.loading" class="relative flex h-1.5 w-1.5 shrink-0">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"
        ></span>
        <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500"></span>
      </span>
      <span
        v-if="tile.overallScore >= 0"
        class="ml-auto text-[10px] font-medium tabular-nums shrink-0"
        :class="tile.overallScore >= 80 ? 'text-primary-500' : 'text-muted'"
      >
        {{ tile.overallScore }}%
      </span>
    </div>

    <!-- Sparkline -->
    <svg
      v-if="tile.sparkPath"
      :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
      class="mb-1.5 w-full"
      :style="{ height: `${SPARK_H}px` }"
      preserveAspectRatio="none"
    >
      <path
        :d="tile.sparkPath"
        fill="none"
        stroke="var(--color-primary-500)"
        vector-effect="non-scaling-stroke"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- Loading placeholder -->
    <div
      v-if="tile.loading && !tile.days.length"
      class="flex items-center justify-center"
      :style="{
        height:
          granularity === 'day'
            ? `${7 * (CELL_SIZE + CELL_GAP) + 14}px`
            : `${CELL_SIZE + 14}px`,
      }"
    >
      <div class="h-1.5 w-16 rounded-full bg-default animate-pulse" />
    </div>

    <!-- Mini heatmap -->
    <div v-else-if="tile.days.length">
      <!-- Month labels -->
      <div
        class="relative h-3.5 mb-0.5"
        :style="{
          marginLeft: granularity === 'day' ? `${DAY_LABEL_WIDTH}px` : '0',
          width: `${tile.numWeeks * WEEK_PX}px`,
        }"
      >
        <span
          v-for="ml in tile.monthLabels"
          :key="ml.label"
          class="absolute text-[10px] font-medium text-muted leading-none"
          :style="{ left: `${ml.col * WEEK_PX}px` }"
        >
          {{ ml.label }}
        </span>
      </div>

      <div class="flex">
        <!-- Day-of-week labels (daily only) -->
        <div
          v-if="granularity === 'day'"
          class="flex flex-col shrink-0"
          :style="{
            width: `${DAY_LABEL_WIDTH}px`,
            gap: `${CELL_GAP}px`,
          }"
        >
          <span
            v-for="day in dayOfWeekLabels"
            :key="day"
            class="text-[10px] text-muted leading-none"
            :style="{ height: `${CELL_SIZE}px`, lineHeight: `${CELL_SIZE}px` }"
          >
            {{ day }}
          </span>
        </div>

        <!-- Cells -->
        <div
          class="grid"
          :style="
            granularity === 'day'
              ? {
                  gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                  gridAutoFlow: 'column',
                  gridAutoColumns: `${CELL_SIZE}px`,
                  gap: `${CELL_GAP}px`,
                  width: `${tile.numWeeks * WEEK_PX}px`,
                }
              : {
                  gridTemplateRows: `${CELL_SIZE}px`,
                  gridAutoFlow: 'column',
                  gridAutoColumns: `${CELL_SIZE}px`,
                  gap: `${CELL_GAP}px`,
                  width: `${tile.numWeeks * WEEK_PX}px`,
                }
          "
        >
          <template v-for="(cell, colIdx) in tile.days" :key="colIdx">
            <div
              v-if="cell.empty"
              class="invisible"
              :style="{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }"
            />
            <UPopover
              v-else
              mode="hover"
              :open-delay="150"
              :close-delay="50"
              :content="{ side: 'top', align: 'center', sideOffset: 6 }"
            >
              <div
                class="rounded-[2px] cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-primary-400/50 hover:scale-125 bg-muted relative overflow-hidden"
                :style="{
                  width: `${CELL_SIZE}px`,
                  height: `${CELL_SIZE}px`,
                }"
              >
                <div
                  class="absolute inset-0 rounded-[2px]"
                  :style="{
                    backgroundColor: 'var(--color-primary-500)',
                    opacity: getCompletionOpacity(cell.value, cell.total > 0),
                  }"
                />
              </div>
              <template #content>
                <div class="p-3 min-w-[180px] text-xs">
                  <div class="font-semibold mb-1">
                    {{ tile.label }}
                  </div>
                  <div class="text-muted mb-1">
                    <template v-if="granularity === 'day'">
                      {{
                        cell.date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      }}
                    </template>
                    <template v-else-if="granularity === 'week'">
                      Week of
                      {{
                        cell.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      }}
                    </template>
                    <template v-else>
                      {{
                        cell.date.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })
                      }}
                    </template>
                  </div>
                  <template v-if="cell.total > 0">
                    <div class="font-medium mb-2">Composite: {{ cell.value }}%</div>
                    <div class="space-y-1">
                      <div
                        v-for="field in complianceFields"
                        :key="field.value"
                        class="flex items-center justify-between gap-4"
                      >
                        <span class="text-muted">{{ field.label }}</span>
                        <span
                          class="font-medium tabular-nums"
                          :class="
                            cell.bucket && fieldPct(cell.bucket, field.value) >= 80
                              ? 'text-primary-500'
                              : ''
                          "
                        >
                          {{
                            cell.bucket
                              ? `${cell.bucket[field.value as keyof typeof cell.bucket] as number}/${cell.bucket.total}`
                              : '&ndash;'
                          }}
                        </span>
                      </div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-default text-muted">
                      Total outages: {{ cell.total }}
                    </div>
                  </template>
                  <div v-else class="text-muted">No outages reported</div>
                </div>
              </template>
            </UPopover>
          </template>
        </div>
      </div>
    </div>

    <!-- No data -->
    <div
      v-else
      class="flex items-center justify-center text-[10px] text-muted"
      :style="{
        height:
          granularity === 'day'
            ? `${7 * (CELL_SIZE + CELL_GAP) + 14}px`
            : `${CELL_SIZE + 14}px`,
      }"
    >
      No data
    </div>
  </div>
</template>
