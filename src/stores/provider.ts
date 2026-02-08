import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type {
  ProviderMembership,
  ProviderOutage,
  ProviderOutageCreateRequest,
  ProviderOutagePatchRequest,
  ProviderOutageFetchParams,
} from '@/types/provider'

export const useProviderStore = defineStore('provider', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  const memberships = ref<ProviderMembership[]>([])
  const selectedProvider = ref<string | null>(null)
  const outages = ref<ProviderOutage[]>([])
  const currentOutage = ref<ProviderOutage | null>(null)
  const isLoading = ref(false)
  const isMembershipsLoaded = ref(false)
  const error = ref<string | null>(null)

  const currentMembership = computed(() =>
    memberships.value.find((m) => m.provider === selectedProvider.value) ?? null,
  )
  const isEditor = computed(() => currentMembership.value?.role === 'editor')
  const isProviderMember = computed(() => memberships.value.length > 0)

  const fetchMemberships = async () => {
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/me/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        memberships.value = []
        isMembershipsLoaded.value = true
        return
      }
      const data = await response.json()
      memberships.value = data.providers ?? []
      if (memberships.value.length > 0 && !selectedProvider.value) {
        selectedProvider.value = memberships.value[0]!.provider
      }
    } catch {
      memberships.value = []
    } finally {
      isMembershipsLoaded.value = true
    }
  }

  const fetchOutages = async (params?: ProviderOutageFetchParams) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const query = new URLSearchParams()
      const p = params ?? {}
      if (p.provider) query.set('provider', p.provider)
      else if (selectedProvider.value) query.set('provider', selectedProvider.value)
      if (p.since != null) query.set('since', String(p.since))
      if (p.until != null) query.set('until', String(p.until))
      if (p.includeDrafts != null) query.set('includeDrafts', String(p.includeDrafts))
      if (p.includeHidden != null) query.set('includeHidden', String(p.includeHidden))
      if (p.includeDeleted != null) query.set('includeDeleted', String(p.includeDeleted))
      if (p.limit != null) query.set('limit', String(p.limit))
      if (p.offset != null) query.set('offset', String(p.offset))

      const response = await fetch(`${baseUrl}/v1/provider/outages?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch outages')
      const data = await response.json()
      outages.value = data.outages ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const fetchOutage = async (id: number) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/outages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch outage')
      const data = await response.json()
      currentOutage.value = data.outage
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const createOutage = async (request: ProviderOutageCreateRequest) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/outages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to create outage')
      }
      const data = await response.json()
      await fetchOutages()
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create outage'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const updateOutage = async (id: number, request: ProviderOutagePatchRequest) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/outages/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update outage')
      }
      const data = await response.json()
      currentOutage.value = data.outage
      await fetchOutages()
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update outage'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const hideOutage = async (id: number) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/outages/${id}/hide`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to hide outage')
      }
      await fetchOutages()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to hide outage'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const unhideOutage = async (id: number) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/outages/${id}/unhide`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to unhide outage')
      }
      await fetchOutages()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to unhide outage'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteOutage = async (id: number) => {
    isLoading.value = true
    error.value = null
    try {
      const token = await authStore.getAccessToken()
      const response = await fetch(`${baseUrl}/v1/provider/outages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete outage')
      }
      await fetchOutages()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete outage'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    memberships,
    selectedProvider,
    outages,
    currentOutage,
    isLoading,
    isMembershipsLoaded,
    error,
    currentMembership,
    isEditor,
    isProviderMember,
    fetchMemberships,
    fetchOutages,
    fetchOutage,
    createOutage,
    updateOutage,
    hideOutage,
    unhideOutage,
    deleteOutage,
  }
})
