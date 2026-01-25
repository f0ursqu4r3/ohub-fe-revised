<script setup lang="ts">
import { ref, computed } from 'vue'
import hljs from 'highlight.js/lib/core'

import bash from 'highlight.js/lib/languages/bash'

hljs.registerLanguage('bash', bash)

const copiedCurl = ref(false)

const curlExample = `curl -H "X-API-Key: your_api_key" \\
  "https://api.canadianpoweroutages.ca/v1/outages?since=1700000000&until=1700100000"`

const hilightedCurl = computed(() => hljs.highlight(curlExample, { language: 'bash' }).value)

const copyExample = async () => {
  try {
    await navigator.clipboard.writeText(curlExample)
    copiedCurl.value = true
    setTimeout(() => {
      copiedCurl.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-4xl">
      <h1 class="text-2xl font-semibold text-default mb-6">Getting Started</h1>

      <div class="space-y-6">
        <!-- Step 1 -->
        <UCard>
          <div class="flex gap-4">
            <div
              class="shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
            >
              <span class="text-sm font-semibold text-primary-600 dark:text-primary-400">1</span>
            </div>
            <div class="flex-1">
              <h2 class="text-base font-semibold text-default mb-2">Create an API Key</h2>
              <p class="text-sm text-muted mb-3">
                Generate an API key from the API Keys page. You'll need this to authenticate your
                requests.
              </p>
              <UButton
                to="/developers/api-keys"
                icon="i-heroicons-key"
                color="primary"
                size="sm"
                label="Go to API Keys"
              />
            </div>
          </div>
        </UCard>

        <!-- Step 2 -->
        <UCard>
          <div class="flex gap-4">
            <div
              class="shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
            >
              <span class="text-sm font-semibold text-primary-600 dark:text-primary-400">2</span>
            </div>
            <div class="flex-1">
              <h2 class="text-base font-semibold text-default mb-2">Make Your First Request</h2>
              <p class="text-sm text-muted mb-3">
                Use your API key in the
                <code class="text-sm font-mono text-default">X-API-KEY</code> header to authenticate
                requests.
              </p>
              <div class="relative">
                <pre
                  class="bg-elevated border border-default rounded-lg p-4 text-xs font-mono text-default overflow-x-auto"
                  v-html="hilightedCurl"
                ></pre>
                <UButton
                  :icon="copiedCurl ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
                  :color="copiedCurl ? 'success' : 'neutral'"
                  variant="ghost"
                  size="xs"
                  class="absolute top-2 right-2"
                  @click="copyExample"
                />
              </div>
            </div>
          </div>
        </UCard>

        <!-- API Endpoints -->
        <div>
          <h2 class="text-lg font-semibold text-default mb-4">API Endpoints</h2>
          <div class="space-y-3">
            <UCard>
              <div class="flex items-start gap-3">
                <span
                  class="shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  GET
                </span>
                <div class="flex-1 min-w-0">
                  <code class="text-sm font-mono text-default">/v1/outages</code>
                  <p class="text-xs text-muted mt-1">
                    Retrieve power outages within a time range. Requires
                    <code class="text-xs">since</code> and <code class="text-xs">until</code> query
                    parameters (Unix timestamps).
                  </p>
                </div>
              </div>
            </UCard>

            <UCard>
              <div class="flex items-start gap-3">
                <span
                  class="shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  GET
                </span>
                <div class="flex-1 min-w-0">
                  <code class="text-sm font-mono text-default">/v1/outages/:id</code>
                  <p class="text-xs text-muted mt-1">Get details for a specific outage by ID.</p>
                </div>
              </div>
            </UCard>

            <UCard>
              <div class="flex items-start gap-3">
                <span
                  class="shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  GET
                </span>
                <div class="flex-1 min-w-0">
                  <code class="text-sm font-mono text-default">/v1/providers</code>
                  <p class="text-xs text-muted mt-1">List all available power providers.</p>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Base URL -->
        <UAlert
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          title="Base URL"
          description="All API requests should be made to https://api.canadianpoweroutages.ca"
        />
      </div>
    </div>
  </div>
</template>
computed,
