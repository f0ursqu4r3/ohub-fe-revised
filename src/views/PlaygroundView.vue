<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useApiKeysStore } from '@/stores/apiKeys'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('go', go)
hljs.registerLanguage('json', json)

const apiKeysStore = useApiKeysStore()
const { apiKeys } = storeToRefs(apiKeysStore)

onMounted(() => {
  if (!apiKeys.value.length) {
    apiKeysStore.fetchApiKeys()
  }
})

const selectedEndpoint = ref('/v1/outages')
const selectedApiKey = ref('')
const sinceDatetime = ref('')
const untilDatetime = ref('')
const outageIdParam = ref('')
const providerParam = ref('')

// Convert datetime-local to epoch seconds
const sinceEpoch = computed(() => {
  if (!sinceDatetime.value) return ''
  return String(Math.floor(new Date(sinceDatetime.value).getTime() / 1000))
})

const untilEpoch = computed(() => {
  if (!untilDatetime.value) return ''
  return String(Math.floor(new Date(untilDatetime.value).getTime() / 1000))
})

const isLoading = ref(false)
const response = ref<object | null>(null)
const responseError = ref('')
const responseStatus = ref<number | null>(null)

const providers = ref<string[]>([])

const apiBaseUrl = import.meta.env.DEV ? '/api' : 'https://api.canadianpoweroutages.ca'

const fetchProviders = async (apiKey: string) => {
  try {
    const res = await fetch(`${apiBaseUrl}/v1/providers`, {
      headers: { 'X-API-Key': apiKey },
    })
    if (res.ok) {
      const data = await res.json()
      providers.value = data.providers || []
    }
  } catch {
    // Silently fail - providers are optional
  }
}

watch(selectedApiKey, (newKey) => {
  if (newKey) {
    fetchProviders(newKey)
  } else {
    providers.value = []
  }
})

const selectedLanguage = ref('curl')
const copiedCode = ref(false)
const showApiKey = ref(false)

const endpoints = [
  { value: '/v1/outages', label: 'GET /v1/outages', description: 'List outages in time range' },
  { value: '/v1/outages/:id', label: 'GET /v1/outages/:id', description: 'Get outage by ID' },
  { value: '/v1/providers', label: 'GET /v1/providers', description: 'List all providers' },
]

const languages = [
  { value: 'curl', label: 'cURL' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
]

const baseUrl = import.meta.env.DEV ? '/api' : 'https://api.canadianpoweroutages.ca'
const displayBaseUrl = 'https://api.canadianpoweroutages.ca'

const buildPath = computed(() => {
  let path = ''

  if (selectedEndpoint.value === '/v1/outages/:id') {
    path = `/v1/outages/${outageIdParam.value || ':id'}`
  } else {
    path = selectedEndpoint.value
  }

  if (selectedEndpoint.value === '/v1/outages') {
    const params = new URLSearchParams()
    if (sinceEpoch.value) params.append('since', sinceEpoch.value)
    if (untilEpoch.value) params.append('until', untilEpoch.value)
    if (providerParam.value) params.append('provider', providerParam.value)
    const queryString = params.toString()
    if (queryString) path += `?${queryString}`
  }

  return path
})

const buildUrl = computed(() => baseUrl + buildPath.value)
const displayUrl = computed(() => displayBaseUrl + buildPath.value)

const apiKeyDisplay = computed(() => {
  if (!selectedApiKey.value) return 'YOUR_API_KEY'
  if (showApiKey.value) return selectedApiKey.value
  // Show first 8 chars + masked remainder
  const key = selectedApiKey.value
  return key.substring(0, 8) + '••••••••••••••••'
})

const generatedCode = computed(() => {
  const url = displayUrl.value
  const apiKey = apiKeyDisplay.value

  switch (selectedLanguage.value) {
    case 'curl':
      return `curl -X GET "${url}" \\
  -H "X-API-Key: ${apiKey}"`

    case 'javascript':
      return `const response = await fetch("${url}", {
  method: "GET",
  headers: {
    "X-API-Key": "${apiKey}"
  }
});

const data = await response.json();
console.log(data);`

    case 'python':
      return `import requests

response = requests.get(
    "${url}",
    headers={"X-API-Key": "${apiKey}"}
)

data = response.json()
print(data)`

    case 'rust':
      return `use reqwest::header;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .get("${url}")
        .header("X-API-Key", "${apiKey}")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    println!("{:#?}", response);
    Ok(())
}`

    case 'go':
      return `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("GET", "${url}", nil)
	req.Header.Set("X-API-Key", "${apiKey}")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`

    default:
      return ''
  }
})

const copyableCode = computed(() => {
  const url = displayUrl.value
  const apiKey = selectedApiKey.value || 'YOUR_API_KEY'

  switch (selectedLanguage.value) {
    case 'curl':
      return `curl -X GET "${url}" \\
  -H "X-API-Key: ${apiKey}"`

    case 'javascript':
      return `const response = await fetch("${url}", {
  method: "GET",
  headers: {
    "X-API-Key": "${apiKey}"
  }
});

const data = await response.json();
console.log(data);`

    case 'python':
      return `import requests

response = requests.get(
    "${url}",
    headers={"X-API-Key": "${apiKey}"}
)

data = response.json()
print(data)`

    case 'rust':
      return `use reqwest::header;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .get("${url}")
        .header("X-API-Key", "${apiKey}")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    println!("{:#?}", response);
    Ok(())
}`

    case 'go':
      return `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("GET", "${url}", nil)
	req.Header.Set("X-API-Key", "${apiKey}")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`

    default:
      return ''
  }
})

const hljsLanguageMap: Record<string, string> = {
  curl: 'bash',
  javascript: 'javascript',
  python: 'python',
  rust: 'rust',
  go: 'go',
}

const highlightedCode = computed(() => {
  const lang = hljsLanguageMap[selectedLanguage.value] || 'bash'
  return hljs.highlight(generatedCode.value, { language: lang }).value
})

const truncatedResponse = computed(() => {
  if (!response.value) return null
  const data = response.value as { outages?: unknown[] }
  if (data.outages && data.outages.length > 10) {
    return {
      ...data,
      outages: data.outages.slice(0, 10),
    }
  }
  return response.value
})

const truncatedCount = computed(() => {
  if (!response.value) return 0
  const data = response.value as { outages?: unknown[] }
  if (data.outages && data.outages.length > 10) {
    return data.outages.length - 10
  }
  return 0
})

const highlightedResponse = computed(() => {
  if (!truncatedResponse.value) return ''
  const jsonStr = JSON.stringify(truncatedResponse.value, null, 2)
  return hljs.highlight(jsonStr, { language: 'json' }).value
})

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(copyableCode.value)
    copiedCode.value = true
    setTimeout(() => {
      copiedCode.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const executeRequest = async () => {
  if (!selectedApiKey.value) {
    responseError.value = 'Please select an API key'
    return
  }

  isLoading.value = true
  response.value = null
  responseError.value = ''
  responseStatus.value = null

  try {
    const res = await fetch(buildUrl.value, {
      method: 'GET',
      headers: {
        'X-API-Key': selectedApiKey.value,
      },
    })

    responseStatus.value = res.status
    const data = await res.json()

    if (!res.ok) {
      responseError.value = data.message || data.error || 'Request failed'
    } else {
      response.value = data
    }
  } catch (err) {
    responseError.value = err instanceof Error ? err.message : 'Network error'
  } finally {
    isLoading.value = false
  }
}

// Convert Date to datetime-local format (YYYY-MM-DDTHH:mm)
const toDatetimeLocal = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const setTimeRange = (hours: number) => {
  const now = new Date()
  const since = new Date(now.getTime() - hours * 3600 * 1000)
  sinceDatetime.value = toDatetimeLocal(since)
  untilDatetime.value = toDatetimeLocal(now)
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-6xl">
      <h1 class="text-2xl font-semibold text-default mb-6">API Playground</h1>

      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Request Builder -->
        <div class="w-full lg:w-1/2 space-y-4">
          <UCard>
            <template #header>
              <h2 class="text-base font-semibold">Request</h2>
            </template>

            <div class="space-y-4">
              <!-- Endpoint -->
              <div>
                <label class="block text-sm font-medium text-default mb-2">Endpoint</label>
                <USelectMenu
                  v-model="selectedEndpoint"
                  :items="endpoints"
                  value-key="value"
                  class="w-full"
                />
              </div>

              <!-- API Key -->
              <div>
                <label class="block text-sm font-medium text-default mb-2">API Key</label>
                <USelectMenu
                  v-model="selectedApiKey"
                  :items="
                    apiKeys.map((k) => ({
                      value: k.apiKey,
                      label: k.note || k.apiKey.substring(0, 12) + '...',
                    }))
                  "
                  value-key="value"
                  placeholder="Select an API key..."
                  class="w-full"
                />
                <p v-if="!apiKeys.length" class="text-xs text-muted mt-1">
                  <RouterLink to="/developers/api-keys" class="text-primary-500 hover:underline">
                    Create an API key
                  </RouterLink>
                  to test requests
                </p>
              </div>

              <!-- Parameters for /v1/outages -->
              <template v-if="selectedEndpoint === '/v1/outages'">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-default mb-2">Since</label>
                    <UInput v-model="sinceDatetime" type="datetime-local" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-default mb-2">Until</label>
                    <UInput v-model="untilDatetime" type="datetime-local" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <UButton
                    size="xs"
                    color="gray"
                    variant="soft"
                    label="Last hour"
                    @click="setTimeRange(1)"
                  />
                  <UButton
                    size="xs"
                    color="gray"
                    variant="soft"
                    label="Last 24h"
                    @click="setTimeRange(24)"
                  />
                  <UButton
                    size="xs"
                    color="gray"
                    variant="soft"
                    label="Last 7d"
                    @click="setTimeRange(168)"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-default mb-2">
                    Provider (optional)
                  </label>
                  <USelectMenu
                    v-model="providerParam"
                    :items="providers.map((p) => ({ value: p, label: p }))"
                    value-key="value"
                    placeholder="All providers"
                    class="w-full"
                    clear
                  />
                </div>
              </template>

              <!-- Parameters for /v1/outages/:id -->
              <template v-if="selectedEndpoint === '/v1/outages/:id'">
                <div>
                  <label class="block text-sm font-medium text-default mb-2">Outage ID</label>
                  <UInput v-model="outageIdParam" placeholder="123" />
                </div>
              </template>

              <!-- URL Preview -->
              <div>
                <label class="block text-sm font-medium text-muted mb-2">Request URL</label>
                <code
                  class="block text-xs font-mono bg-elevated px-3 py-2 rounded border border-default break-all"
                >
                  {{ displayUrl }}
                </code>
              </div>

              <UButton
                icon="i-heroicons-play"
                color="primary"
                label="Send Request"
                :loading="isLoading"
                :disabled="!selectedApiKey"
                block
                @click="executeRequest"
              />
            </div>
          </UCard>

          <!-- Code Generator -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold">Generated Code</h2>
                <div class="flex items-center gap-1">
                  <UButton
                    :icon="showApiKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    color="gray"
                    variant="ghost"
                    size="xs"
                    :title="showApiKey ? 'Hide API key' : 'Show API key'"
                    @click="showApiKey = !showApiKey"
                  />
                  <UButton
                    :icon="copiedCode ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
                    :color="copiedCode ? 'green' : 'gray'"
                    variant="ghost"
                    size="xs"
                    @click="copyCode"
                  />
                </div>
              </div>
            </template>

            <div class="space-y-4">
              <div class="flex gap-1 flex-wrap">
                <UButton
                  v-for="lang in languages"
                  :key="lang.value"
                  :label="lang.label"
                  :color="selectedLanguage === lang.value ? 'primary' : 'gray'"
                  :variant="selectedLanguage === lang.value ? 'soft' : 'ghost'"
                  size="xs"
                  @click="selectedLanguage = lang.value"
                />
              </div>

              <div class="rounded-md overflow-hidden min-h-0">
                <pre
                  class="hljs p-4 text-xs font-mono overflow-x-auto max-h-[500px]"
                  v-html="highlightedCode"
                ></pre>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Response - uses absolute positioning so height is determined by left column -->
        <div class="w-full lg:w-1/2 relative">
          <div class="lg:absolute lg:inset-0">
            <UCard
              class="h-full flex flex-col"
              :ui="{ body: 'flex-1 min-h-0 overflow-hidden flex flex-col p-0!' }"
            >
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-base font-semibold">Response</h2>
                  <UBadge
                    v-if="responseStatus"
                    :color="responseStatus >= 200 && responseStatus < 300 ? 'green' : 'red'"
                    variant="soft"
                    size="xs"
                  >
                    {{ responseStatus }}
                  </UBadge>
                </div>
              </template>

              <div v-if="responseError" class="text-sm text-red-500 p-4">
                {{ responseError }}
              </div>
              <div v-else-if="response" class="flex flex-1 min-h-0 overflow-auto">
                <pre class="flex-1 text-xs font-mono hljs p-4" v-html="highlightedResponse"></pre>
                <p v-if="truncatedCount > 0" class="text-xs text-muted p-4">
                  Showing 10 of {{ truncatedCount + 10 }} outages.
                </p>
              </div>
              <div v-else class="text-sm text-muted flex-1 flex items-center justify-center p-4">
                Send a request to see the response
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
