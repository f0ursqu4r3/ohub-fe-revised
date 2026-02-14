<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  select,
  scaleTime,
  scaleLinear,
  axisLeft,
  axisBottom,
  area,
  line,
  curveMonotoneX,
  timeWeek,
  timeFormat,
  extent,
} from 'd3'
import type { TrendPoint } from '@/composables/useAnalyticsData'

const props = defineProps<{
  points: TrendPoint[]
}>()

const chartEl = ref<HTMLDivElement>()

function render() {
  if (!chartEl.value || !props.points.length) return

  const container = chartEl.value
  const points = props.points

  select(container).selectAll('*').remove()

  const margin = { top: 8, right: 16, bottom: 24, left: 48 }
  const width = container.clientWidth - margin.left - margin.right
  const height = container.clientHeight - margin.top - margin.bottom

  const svg = select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const x = scaleTime()
    .domain(extent(points, (d) => d.date) as [Date, Date])
    .range([0, width])

  const y = scaleLinear().domain([0, 100]).range([height, 0])

  svg
    .append('g')
    .attr('class', 'chart-grid')
    .call(
      axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(() => ''),
    )
    .call((g) => g.select('.domain').remove())

  svg
    .append('g')
    .attr('class', 'chart-axis-x')
    .attr('transform', `translate(0,${height})`)
    .call(
      axisBottom(x)
        .ticks(timeWeek.every(1))
        .tickFormat((d) => timeFormat('%b %d')(d as Date))
        .tickSizeOuter(0),
    )
    .call((g) => g.select('.domain').remove())

  svg
    .append('g')
    .attr('class', 'chart-axis-y')
    .call(
      axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${d}%`)
        .tickSizeOuter(0),
    )
    .call((g) => g.select('.domain').remove())

  const areaGen = area<TrendPoint>()
    .x((d) => x(d.date))
    .y0(height)
    .y1((d) => y(d.score))
    .curve(curveMonotoneX)

  svg.append('path').datum(points).attr('class', 'chart-area').attr('d', areaGen)

  const lineGen = line<TrendPoint>()
    .x((d) => x(d.date))
    .y((d) => y(d.score))
    .curve(curveMonotoneX)

  svg.append('path').datum(points).attr('class', 'chart-line').attr('d', lineGen)
}

watch(() => props.points, () => nextTick(render), { flush: 'post' })

onBeforeUnmount(() => {
  if (chartEl.value) {
    select(chartEl.value).selectAll('*').remove()
  }
})
</script>

<template>
  <div ref="chartEl" class="outage-chart text-muted" style="height: 200px" />
</template>

<style scoped>
.outage-chart :deep(.chart-line) {
  fill: none;
  stroke: var(--color-primary-500);
  stroke-width: 1.5px;
}
.outage-chart :deep(.chart-area) {
  fill: var(--color-primary-500);
  fill-opacity: 0.1;
}
.outage-chart :deep(.chart-grid line) {
  stroke: currentColor;
  stroke-opacity: 0.1;
}
.outage-chart :deep(.chart-axis-x text),
.outage-chart :deep(.chart-axis-y text) {
  fill: currentColor;
  opacity: 0.5;
  font-size: 10px;
}
.outage-chart :deep(.chart-axis-x .domain),
.outage-chart :deep(.chart-axis-y .domain),
.outage-chart :deep(.chart-axis-x line),
.outage-chart :deep(.chart-axis-y line) {
  stroke: none;
}
</style>
