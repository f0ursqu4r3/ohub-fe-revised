<script setup lang="ts">
import { inject } from 'vue'
import {
  getCompletionOpacity,
  CELL_SIZE,
  CELL_GAP,
  WEEK_PX,
  DAY_LABEL_WIDTH,
  SPARK_W,
  SPARK_H,
  dayOfWeekLabels,
} from '@/composables/useAnalyticsData'
import type { ProviderTile, DayCell } from '@/composables/useAnalyticsData'
import type { CellTooltipApi } from './ProviderGrid.vue'

const props = defineProps<{
  tile: ProviderTile
  granularity: string
}>()

const cellTooltip = inject<CellTooltipApi>('cellTooltip')

function onCellEnter(cell: DayCell, event: MouseEvent) {
  cellTooltip?.show(cell, props.tile.label, props.granularity, event.currentTarget as HTMLElement)
}

function onCellLeave() {
  cellTooltip?.hide()
}


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

    <!-- Loading skeleton -->
    <div v-if="tile.loading && !tile.days.length" class="animate-pulse">
      <!-- Sparkline placeholder -->
      <div class="mb-1.5 w-full overflow-hidden" :style="{ height: `${SPARK_H}px` }">
        <div class="h-[1.5px] mt-2.5 rounded-full bg-muted/60 w-full" />
      </div>
      <!-- Month label row -->
      <div class="flex gap-6 mb-0.5 h-3.5" :style="{ marginLeft: granularity === 'day' ? `${DAY_LABEL_WIDTH}px` : '0' }">
        <div class="h-2 w-5 rounded bg-muted/40" />
        <div class="h-2 w-5 rounded bg-muted/40" />
        <div class="h-2 w-5 rounded bg-muted/40" />
      </div>
      <!-- Grid placeholder -->
      <div class="flex">
        <div
          v-if="granularity === 'day'"
          class="shrink-0"
          :style="{ width: `${DAY_LABEL_WIDTH}px` }"
        />
        <div
          class="grid"
          :style="
            granularity === 'day'
              ? {
                  gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                  gridAutoFlow: 'column',
                  gridAutoColumns: `${CELL_SIZE}px`,
                  gap: `${CELL_GAP}px`,
                }
              : {
                  gridTemplateRows: `${CELL_SIZE}px`,
                  gridAutoFlow: 'column',
                  gridAutoColumns: `${CELL_SIZE}px`,
                  gap: `${CELL_GAP}px`,
                }
          "
        >
          <div
            v-for="n in (granularity === 'day' ? 56 : 8)"
            :key="n"
            class="rounded-[2px] bg-muted/30"
            :style="{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }"
          />
        </div>
      </div>
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
            <div
              v-else
              class="rounded-[2px] cursor-pointer transition-all duration-150 z-0 hover:z-10 hover:ring-2 hover:ring-primary-400/50 hover:scale-125 bg-muted relative overflow-hidden"
              :style="{
                width: `${CELL_SIZE}px`,
                height: `${CELL_SIZE}px`,
              }"
              @mouseenter="onCellEnter(cell, $event)"
              @mouseleave="onCellLeave"
            >
              <div
                class="absolute inset-0 rounded-[2px]"
                :style="{
                  backgroundColor: 'var(--color-primary-500)',
                  opacity: getCompletionOpacity(cell.value, cell.total > 0),
                }"
              />
            </div>
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
