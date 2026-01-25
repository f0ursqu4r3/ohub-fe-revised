<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { isAuthenticated, user, isLoading } = storeToRefs(authStore)

const handleLogin = () => authStore.login()
</script>

<template>
  <div class="h-screen bg-default flex flex-col">
    <!-- Header -->
    <header class="border-b border-default bg-elevated">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/" icon="i-heroicons-arrow-left" color="gray" variant="ghost" square />
          <h1 class="text-xl font-bold text-default">Developer Portal</h1>
        </div>
        <div v-if="isLoading" class="h-10 w-24 animate-pulse rounded bg-accented" />
        <div v-else-if="isAuthenticated" class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ user?.email }}</span>
          <UButton
            to="/developers/api-keys"
            icon="i-heroicons-key"
            color="primary"
            label="My API Keys"
          />
        </div>
        <UButton
          v-else
          icon="i-heroicons-user"
          color="primary"
          label="Sign In"
          @click="handleLogin"
        />
      </div>
    </header>

    <div class="flex-1 overflow-auto">
      <!-- Hero Section -->
      <div class="max-w-5xl mx-auto px-4 py-16">
        <div class="text-center mb-16">
          <div
            class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-6"
          >
            <UIcon name="i-heroicons-code-bracket" class="w-8 h-8 text-primary-500" />
          </div>
          <h2 class="text-4xl font-bold text-default mb-4">Canadian Power Outage API</h2>
          <p class="text-xl text-muted max-w-2xl mx-auto">
            Access real-time and historical power outage data across Canada through our simple REST
            API
          </p>
        </div>

        <!-- Features Grid -->
        <div class="grid md:grid-cols-3 gap-6 mb-16">
          <UCard>
            <div class="flex items-start gap-4">
              <div
                class="shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
              >
                <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h3 class="font-semibold text-default mb-2">Real-time Data</h3>
                <p class="text-sm text-muted">
                  Access up-to-date outage information aggregated from multiple Canadian power
                  providers
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-start gap-4">
              <div
                class="shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
              >
                <UIcon name="i-heroicons-shield-check" class="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h3 class="font-semibold text-default mb-2">Secure Access</h3>
                <p class="text-sm text-muted">
                  API keys with expiration, secure token-based authentication via Auth0
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-start gap-4">
              <div
                class="shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
              >
                <UIcon name="i-heroicons-key" class="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h3 class="font-semibold text-default mb-2">Easy Integration</h3>
                <p class="text-sm text-muted">
                  Simple REST endpoints with JSON responses, ready to integrate into your
                  application
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- API Example -->
        <div class="mb-16">
          <h3 class="text-2xl font-bold text-default mb-6">Quick Start</h3>
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-semibold text-default mb-3">1. Get an API Key</h4>
              <p class="text-sm text-muted mb-4">
                Sign in with your email to create and manage API keys. Keys are free and can be
                created instantly.
              </p>
              <UButton
                v-if="!isAuthenticated"
                icon="i-heroicons-user"
                color="primary"
                label="Sign In to Get Started"
                @click="handleLogin"
              />
              <UButton
                v-else
                to="/developers/api-keys"
                icon="i-heroicons-key"
                color="primary"
                label="Manage API Keys"
              />
            </div>

            <div>
              <h4 class="font-semibold text-default mb-3">2. Make Your First Request</h4>
              <div class="bg-elevated border border-default rounded-lg p-4 overflow-x-auto">
                <pre
                  class="text-xs font-mono text-default"
                ><span class="text-dimmed">curl -H "X-API-Key: your_api_key" \</span>
  "https://api.canadianpoweroutages.ca/v1/outages?since=1700000000&until=1700100000"</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- API Documentation -->
        <div class="mb-16">
          <h3 class="text-2xl font-bold text-default mb-6">API Endpoints</h3>
          <div class="space-y-4">
            <UCard>
              <div class="space-y-2">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      >
                        GET
                      </span>
                      <code class="text-sm font-mono text-default">/v1/outages</code>
                    </div>
                    <p class="text-sm text-muted">Retrieve power outages within a time range</p>
                  </div>
                </div>
                <div class="text-xs text-dimmed space-y-1">
                  <p><strong>Parameters:</strong></p>
                  <ul class="list-disc list-inside pl-4">
                    <li><code>since</code> (required) - Unix timestamp for start of range</li>
                    <li><code>until</code> (required) - Unix timestamp for end of range</li>
                    <li><code>provider</code> (optional) - Filter by specific provider</li>
                  </ul>
                </div>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-2">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      >
                        GET
                      </span>
                      <code class="text-sm font-mono text-default">/v1/outages/:id</code>
                    </div>
                    <p class="text-sm text-muted">Get details for a specific outage</p>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-2">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      >
                        GET
                      </span>
                      <code class="text-sm font-mono text-default">/v1/providers</code>
                    </div>
                    <p class="text-sm text-muted">List all available power providers</p>
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <!-- CTA Section -->
        <div
          class="text-center bg-primary-50 dark:bg-primary-950/20 rounded-lg p-8 border border-primary-200 dark:border-primary-800"
        >
          <h3 class="text-2xl font-bold text-default mb-4">Ready to Get Started?</h3>
          <p class="text-muted mb-6 max-w-2xl mx-auto">
            Sign in to create your first API key and start accessing Canadian power outage data in
            seconds.
          </p>
          <div class="flex gap-3 justify-center">
            <UButton
              v-if="!isAuthenticated"
              icon="i-heroicons-user"
              color="primary"
              size="lg"
              label="Sign In"
              @click="handleLogin"
            />
            <UButton
              v-else
              to="/developers/api-keys"
              icon="i-heroicons-key"
              color="primary"
              size="lg"
              label="Manage API Keys"
            />
            <UButton
              to="/"
              icon="i-heroicons-map"
              color="gray"
              variant="soft"
              size="lg"
              label="View Outage Map"
            />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="border-t border-default py-8 mt-16">
        <div class="max-w-7xl mx-auto px-4 text-center text-sm text-muted">
          <p>Canadian Power Outage API • Real-time outage data across Canada</p>
        </div>
      </footer>
    </div>
  </div>
</template>
