<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOutageStore, type FetchOutageParams } from '@/stores/outages'
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

const outageStore = useOutageStore()
const { fetchProviders, fetchOutages, fetchOutage } = outageStore

const displayBaseUrl = 'https://api.canadianpoweroutages.ca'

const selectedEndpoint = ref('/v1/outages')
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
const selectedLanguage = ref('curl')
const copiedCode = ref(false)

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

const displayUrl = computed(() => displayBaseUrl + buildPath.value)

const queryParams = computed(() => {
  const params: { key: string; value: string }[] = []
  if (selectedEndpoint.value === '/v1/outages') {
    if (sinceEpoch.value) params.push({ key: 'since', value: sinceEpoch.value })
    if (untilEpoch.value) params.push({ key: 'until', value: untilEpoch.value })
    if (providerParam.value) params.push({ key: 'provider', value: providerParam.value })
  }
  return params
})

const baseEndpointUrl = computed(() => {
  let path = ''
  if (selectedEndpoint.value === '/v1/outages/:id') {
    path = `/v1/outages/${outageIdParam.value || ':id'}`
  } else {
    path = selectedEndpoint.value
  }
  return displayBaseUrl + path
})

const generatedCode = computed(() => {
  const url = displayUrl.value
  const base = baseEndpointUrl.value
  const params = queryParams.value

  switch (selectedLanguage.value) {
    case 'curl':
      return `curl -X GET "${url}" \\
  -H "X-API-Key: YOUR_API_KEY"`

    case 'javascript': {
      if (params.length === 0) {
        return `const response = await fetch("${url}", {
  headers: {
    "X-API-Key": "YOUR_API_KEY"
  }
});

const data = await response.json();
console.log(data);`
      }
      const jsParams = params.map((p) => `url.searchParams.set("${p.key}", "${p.value}");`).join('\n')
      return `const url = new URL("${base}");
${jsParams}

const response = await fetch(url, {
  headers: {
    "X-API-Key": "YOUR_API_KEY"
  }
});

const data = await response.json();
console.log(data);`
    }

    case 'python': {
      if (params.length === 0) {
        return `import httpx

response = httpx.get(
    "${url}",
    headers={"X-API-Key": "YOUR_API_KEY"}
)

data = response.json()
print(data)`
      }
      const pyParams = params.map((p) => `    "${p.key}": "${p.value}",`).join('\n')
      return `import httpx

response = httpx.get(
    "${base}",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={
${pyParams}
    }
)

data = response.json()
print(data)`
    }

    case 'rust': {
      if (params.length === 0) {
        return `use reqwest::header;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .get("${url}")
        .header("X-API-Key", "YOUR_API_KEY")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    println!("{:#?}", response);
    Ok(())
}`
      }
      const rsQuery = params.map((p) => `        ("${p.key}", "${p.value}"),`).join('\n')
      return `use reqwest::header;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .get("${base}")
        .header("X-API-Key", "YOUR_API_KEY")
        .query(&[
${rsQuery}
        ])
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    println!("{:#?}", response);
    Ok(())
}`
    }

    case 'go': {
      if (params.length === 0) {
        return `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("GET", "${url}", nil)
	req.Header.Set("X-API-Key", "YOUR_API_KEY")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`
      }
      const goParams = params.map((p) => `	q.Set("${p.key}", "${p.value}")`).join('\n')
      return `package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
)

func main() {
	u, _ := url.Parse("${base}")
	q := u.Query()
${goParams}
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("X-API-Key", "YOUR_API_KEY")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`
    }

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
    await navigator.clipboard.writeText(generatedCode.value)
    copiedCode.value = true
    setTimeout(() => {
      copiedCode.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const executeRequest = async () => {
  isLoading.value = true
  response.value = null
  responseError.value = ''
  responseStatus.value = null

  try {
    switch (selectedEndpoint.value) {
      case '/v1/outages': {
        const params: FetchOutageParams = {}
        if (sinceEpoch.value) params.since = Number(sinceEpoch.value)
        if (untilEpoch.value) params.until = Number(untilEpoch.value)
        if (providerParam.value) params.provider = providerParam.value
        const res = await fetchOutages(params)
        response.value = { outages: res.outages }
        responseStatus.value = res.status
        break
      }
      case '/v1/outages/:id': {
        if (!outageIdParam.value) {
          throw new Error('Outage ID is required')
        }
        const res = await fetchOutage(outageIdParam.value)
        console.log(res)
        response.value = res
        responseStatus.value = res.status
        break
      }
      case '/v1/providers': {
        const res = await fetchProviders()
        response.value = { providers: res.providers }
        responseStatus.value = res.status
        break
      }
      default:
        throw new Error('Invalid endpoint selected')
    }
  } catch (err: any) {
    responseError.value = err.message || 'An error occurred'
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

onMounted(async () => {
  const providersResp = await fetchProviders()
  providers.value = providersResp.providers || []
})
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
                    color="neutral"
                    variant="soft"
                    label="Last hour"
                    @click="setTimeRange(1)"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="soft"
                    label="Last 24h"
                    @click="setTimeRange(24)"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
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
                :disabled="isLoading"
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
                    :icon="copiedCode ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
                    :color="copiedCode ? 'success' : 'neutral'"
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
                  :color="selectedLanguage === lang.value ? 'primary' : 'neutral'"
                  :variant="selectedLanguage === lang.value ? 'soft' : 'ghost'"
                  size="xs"
                  @click="selectedLanguage = lang.value"
                />
              </div>

              <div class="rounded-md overflow-hidden min-h-0 border border-default">
                <pre
                  class="hljs p-4 text-xs font-mono overflow-x-auto"
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
              :ui="{ body: 'min-h-0 overflow-hidden flex flex-col flex-1 p-0!' }"
            >
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-base font-semibold">Response</h2>
                  <UBadge
                    v-if="responseStatus"
                    :color="responseStatus >= 200 && responseStatus < 300 ? 'success' : 'error'"
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
              <div
                v-else-if="response"
                class="flex-1 min-h-0 overflow-auto text-xs font-mono hljs p-4 whitespace-pre"
                v-html="highlightedResponse"
              ></div>
              <div v-else class="text-sm text-muted flex-1 flex items-center justify-center p-4">
                Send a request to see the response
              </div>

              <template v-if="truncatedCount > 0" #footer>
                <p class="text-xs text-muted">Showing 10 of {{ truncatedCount + 10 }} outages.</p>
              </template>
            </UCard>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
