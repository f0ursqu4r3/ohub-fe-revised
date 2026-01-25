import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type { ApiKey, ApiKeyCreateRequest, ApiKeyUpdateRequest } from '@/types/apiKey'

export const useApiKeysStore = defineStore('apiKeys', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  const apiKeys = ref<ApiKey[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastCreatedKey = ref<string | null>(null)

  const fetchApiKeys = async () => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch API keys')
      apiKeys.value = await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const createApiKey = async (request: ApiKeyCreateRequest) => {
    isLoading.value = true
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/api-keys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      const data = await response.json()
      lastCreatedKey.value = data.apiKey
      await fetchApiKeys()
      return data
    } finally {
      isLoading.value = false
    }
  }

  const updateApiKey = async (apiKey: string, request: ApiKeyUpdateRequest) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/api-keys/${encodeURIComponent(apiKey)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update API key')
      }
      await fetchApiKeys()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update API key'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteApiKey = async (apiKey: string) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/api-keys/${encodeURIComponent(apiKey)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete API key')
      }
      await fetchApiKeys()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete API key'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const clearLastCreatedKey = () => {
    lastCreatedKey.value = null
  }

  return {
    apiKeys,
    isLoading,
    error,
    lastCreatedKey,
    fetchApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    clearLastCreatedKey,
  }
})
