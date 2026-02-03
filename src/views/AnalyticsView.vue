<script setup lang="ts">
import { useAnalyticsData } from '@/composables/useAnalyticsData'
import OutageChart from '@/components/analytics/OutageChart.vue'
import CompletenessChart from '@/components/analytics/CompletenessChart.vue'
import FieldBreakdown from '@/components/analytics/FieldBreakdown.vue'
import ProviderGrid from '@/components/analytics/ProviderGrid.vue'

const {
  selectedGranularity,
  isLoading,
  isLoadingSeries,
  tiles,
  outageChartPoints,
  completenessTrendPoints,
  fieldBreakdown,
  loadingProgress,
  kpiProviderCount,
  kpiTotalOutages,
  kpiAvgCompleteness,
} = useAnalyticsData()
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <!-- Section 1: Hero -->
    <section
      class="relative bg-linear-to-b from-primary-50 to-transparent dark:from-primary-950/20"
    >
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <div
          class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25 mb-6"
        >
          <UIcon name="i-heroicons-chart-bar" class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-4xl sm:text-5xl font-bold text-default mb-4">
          Real-time Power Outage Intelligence
        </h1>
        <p class="text-xl text-muted max-w-2xl mx-auto mb-10">
          We monitor every utility provider in Canada, tracking outage reports and data quality
          around the clock. Everything below is live data.
        </p>

        <!-- Live stat pills -->
        <div class="flex flex-wrap justify-center gap-8 sm:gap-12 mb-10">
          <div class="flex flex-col items-center">
            <span class="text-3xl font-bold text-default tabular-nums">
              {{ kpiProviderCount }}
            </span>
            <span class="text-sm text-muted">Providers monitored</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-3xl font-bold text-default tabular-nums">
              {{ kpiTotalOutages.toLocaleString() }}
            </span>
            <span class="text-sm text-muted">Outages tracked</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-3xl font-bold tabular-nums">
              <template v-if="kpiAvgCompleteness != null">
                <span :class="kpiAvgCompleteness >= 80 ? 'text-primary-500' : 'text-default'">
                  {{ kpiAvgCompleteness }}%
                </span>
              </template>
              <span v-else class="text-muted">&ndash;</span>
            </span>
            <span class="text-sm text-muted">Avg completeness</span>
          </div>
        </div>

        <!-- CTAs -->
        <div class="flex flex-wrap justify-center gap-3">
          <UButton
            to="/developers"
            icon="i-heroicons-code-bracket"
            color="primary"
            size="lg"
            label="Get API Access"
          />
          <UButton
            href="mailto:sales@ohub.ca"
            icon="i-heroicons-building-office-2"
            color="neutral"
            variant="soft"
            size="lg"
            label="Contact Sales"
          />
        </div>
      </div>
    </section>

    <!-- Section 2: Problem statement -->
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <h2 class="text-3xl font-bold text-default mb-4">
        Utility outage data is fragmented and inconsistent
      </h2>
      <p class="text-lg text-muted mb-4">
        Every Canadian utility publishes outage data differently &mdash; different formats,
        different fields, different update frequencies. Critical information like affected customer
        counts, estimated restoration times, and outage cause is often missing entirely.
      </p>
      <p class="text-lg text-muted">
        Whether you're a utility looking to benchmark your reporting or a developer building on
        outage data, you need a single source of truth with quality you can measure.
      </p>
    </section>

    <!-- Section 3: Outage volume chart -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold text-default mb-2">Thousands of outages tracked daily</h2>
        <p class="text-muted">
          Every data point is a real outage report, aggregated and normalized from provider feeds
          across Canada.
        </p>
      </div>

      <div
        v-if="outageChartPoints"
        class="rounded-lg border border-default bg-elevated p-4 shadow-sm mb-8"
      >
        <OutageChart :points="outageChartPoints" />
      </div>
      <div
        v-else-if="isLoadingSeries"
        class="rounded-lg border border-default bg-elevated p-4 shadow-sm mb-8 flex items-center justify-center"
        style="height: 240px"
      >
        <div class="h-2 w-24 rounded-full bg-default animate-pulse" />
      </div>

      <!-- Audience value cards -->
      <div class="grid md:grid-cols-2 gap-6">
        <div class="rounded-xl border border-default bg-elevated p-6 shadow-sm">
          <div class="flex items-center gap-3 mb-3">
            <div
              class="shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
            >
              <UIcon name="i-heroicons-code-bracket" class="w-5 h-5 text-primary-500" />
            </div>
            <h3 class="font-semibold text-default">For Developers</h3>
          </div>
          <p class="text-sm text-muted">
            Access this data via our REST API. Every outage includes provider, location polygon,
            customer count, cause, ETR, and more. Query by time range, provider, or geography.
          </p>
        </div>
        <div class="rounded-xl border border-default bg-elevated p-6 shadow-sm">
          <div class="flex items-center gap-3 mb-3">
            <div
              class="shrink-0 w-10 h-10 rounded-lg bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center"
            >
              <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-secondary-500" />
            </div>
            <h3 class="font-semibold text-default">For Utilities</h3>
          </div>
          <p class="text-sm text-muted">
            See how your outage reporting compares. We track completeness across 7 critical data
            fields so you can identify gaps and improve your public reporting.
          </p>
        </div>
      </div>
    </section>

    <!-- Section 4: Data quality -->
    <section class="bg-elevated/50 dark:bg-elevated/20 border-y border-default">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-default mb-2">
            We measure data quality so you don't have to
          </h2>
          <p class="text-muted">
            Every outage report is scored across 7 compliance fields. Here's how Canadian utilities
            are performing right now.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            v-if="fieldBreakdown"
            class="rounded-lg border border-default bg-elevated p-4 shadow-sm"
          >
            <h3 class="text-sm font-medium text-default mb-3">Field completeness</h3>
            <FieldBreakdown :fields="fieldBreakdown" />
          </div>

          <div
            v-if="completenessTrendPoints"
            class="rounded-lg border border-default bg-elevated p-4 shadow-sm"
          >
            <h3 class="text-sm font-medium text-default mb-3">Completeness over time</h3>
            <CompletenessChart :points="completenessTrendPoints" />
          </div>
        </div>

        <p class="text-sm text-muted text-center">
          Fields tracked: customer count, cause, outage type, planned/unplanned, start time,
          estimated time to restore, and geographic polygon.
        </p>
      </div>
    </section>

    <!-- Section 5: Provider coverage heatmap -->
    <ProviderGrid
      :tiles="tiles"
      :granularity="selectedGranularity"
      :is-loading="isLoading"
      :is-loading-series="isLoadingSeries"
      :loading-progress="loadingProgress"
      :provider-count="kpiProviderCount"
      @update:granularity="selectedGranularity = $event as 'day' | 'week' | 'month'"
    />

    <!-- Section 6: Two-audience value proposition -->
    <section class="bg-linear-to-b from-transparent to-primary-50/50 dark:to-primary-950/10">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="text-center mb-10">
          <h2 class="text-3xl font-bold text-default">Built for two audiences</h2>
        </div>
        <div class="grid md:grid-cols-2 gap-8">
          <!-- Developer card -->
          <div
            class="rounded-xl border-2 border-primary-200 dark:border-primary-800 bg-elevated p-8"
          >
            <div
              class="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4"
            >
              <UIcon name="i-heroicons-code-bracket" class="w-6 h-6 text-primary-500" />
            </div>
            <h3 class="text-xl font-bold text-default mb-3">Build on reliable outage data</h3>
            <ul class="space-y-2 text-sm text-muted mb-6">
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-primary-500 shrink-0 mt-0.5"
                />
                <span>Normalized JSON from every Canadian utility</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-primary-500 shrink-0 mt-0.5"
                />
                <span>7 enriched fields per outage record</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-primary-500 shrink-0 mt-0.5"
                />
                <span>Geographic polygons for map integration</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-primary-500 shrink-0 mt-0.5"
                />
                <span>Historical and real-time access via REST API</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-primary-500 shrink-0 mt-0.5"
                />
                <span>Simple API key authentication</span>
              </li>
            </ul>
            <UButton
              to="/developers"
              color="primary"
              label="Get API Access"
              icon="i-heroicons-arrow-right"
              block
            />
          </div>

          <!-- Enterprise card -->
          <div
            class="rounded-xl border-2 border-secondary-200 dark:border-secondary-800 bg-elevated p-8"
          >
            <div
              class="w-12 h-12 rounded-lg bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center mb-4"
            >
              <UIcon name="i-heroicons-building-office-2" class="w-6 h-6 text-secondary-500" />
            </div>
            <h3 class="text-xl font-bold text-default mb-3">Benchmark your outage reporting</h3>
            <ul class="space-y-2 text-sm text-muted mb-6">
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-secondary-500 shrink-0 mt-0.5"
                />
                <span>See how your data completeness compares</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-secondary-500 shrink-0 mt-0.5"
                />
                <span>Track improvement across 7 compliance fields</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-secondary-500 shrink-0 mt-0.5"
                />
                <span>Identify missing fields before regulators do</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-secondary-500 shrink-0 mt-0.5"
                />
                <span>Historical trend analysis and scoring</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-heroicons-check"
                  class="w-4 h-4 text-secondary-500 shrink-0 mt-0.5"
                />
                <span>Enterprise dashboards and custom reporting</span>
              </li>
            </ul>
            <UButton
              href="mailto:sales@ohub.ca"
              color="neutral"
              variant="soft"
              label="Contact Sales"
              icon="i-heroicons-arrow-right"
              block
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Section 7: Final CTA -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div
        class="text-center bg-primary-50 dark:bg-primary-950/20 rounded-xl p-10 border border-primary-200 dark:border-primary-800"
      >
        <h2 class="text-3xl font-bold text-default mb-4">Ready to get started?</h2>
        <p class="text-lg text-muted mb-8 max-w-2xl mx-auto">
          Everything you saw on this page is live data from our API. Start building today, or talk
          to our team about enterprise solutions.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton
            to="/developers"
            icon="i-heroicons-code-bracket"
            color="primary"
            size="lg"
            label="Get API Access"
          />
          <UButton
            href="mailto:sales@ohub.ca"
            icon="i-heroicons-building-office-2"
            color="neutral"
            variant="soft"
            size="lg"
            label="Contact Sales"
          />
          <UButton
            to="/"
            icon="i-heroicons-map"
            color="neutral"
            variant="ghost"
            size="lg"
            label="View Live Map"
          />
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-default py-8">
      <div class="max-w-7xl mx-auto px-4 text-center text-sm text-muted">
        <p>
          Canadian Power Outages &middot; Real-time outage data and quality analytics across Canada
        </p>
      </div>
    </footer>
  </div>
</template>
