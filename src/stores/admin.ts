import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type {
  AdminProviderDirectoryItem,
  AdminProviderMember,
  AdminFeedbackComment,
  CreateProviderRequest,
  PatchProviderRequest,
  ProviderMemberRequest,
  ProviderMemberResponse,
} from '@/types/admin'

export const useAdminStore = defineStore('admin', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  const providers = ref<AdminProviderDirectoryItem[]>([])
  const members = ref<AdminProviderMember[]>([])
  const feedbackComments = ref<AdminFeedbackComment[]>([])
  const feedbackTotal = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const authHeaders = async () => {
    const token = await authStore.getAccessToken()
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  // -- Providers CRUD --

  const fetchProviders = async () => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/providers`, { headers })
      if (!response.ok) throw new Error('Failed to fetch providers')
      const data = await response.json()
      providers.value = data.providers ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const createProvider = async (req: CreateProviderRequest) => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/providers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to create provider')
      }
      await fetchProviders()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create provider'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const updateProvider = async (name: string, req: PatchProviderRequest) => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/providers/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(req),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update provider')
      }
      await fetchProviders()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update provider'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteProvider = async (name: string) => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/providers/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete provider')
      }
      await fetchProviders()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete provider'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // -- Provider Members --

  const fetchMembers = async () => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/provider-members`, { headers })
      if (!response.ok) throw new Error('Failed to fetch members')
      const data = await response.json()
      members.value = data.members ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const addProviderMember = async (req: ProviderMemberRequest): Promise<ProviderMemberResponse> => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/provider-members`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to add provider member')
      }
      const result = await response.json()
      await fetchMembers()
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add provider member'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const removeProviderMember = async (customerEmail: string, provider: string) => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/provider-members`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ customerEmail, provider }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to remove provider member')
      }
      await fetchMembers()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove provider member'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // -- Norm Analytics --

  const enableNormAnalytics = async () => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/norm-analytics/enable`, {
        method: 'POST',
        headers,
      })
      if (!response.ok) throw new Error('Failed to enable norm analytics')
      return await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to enable norm analytics'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const disableNormAnalytics = async () => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/norm-analytics/disable`, {
        method: 'POST',
        headers,
      })
      if (!response.ok) throw new Error('Failed to disable norm analytics')
      return await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to disable norm analytics'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const kickNormAnalytics = async () => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/norm-analytics/kick`, {
        method: 'POST',
        headers,
      })
      if (!response.ok) throw new Error('Failed to kick norm analytics')
      return await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to kick norm analytics'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // -- Feedback --

  const fetchFeedbackComments = async (limit = 100, offset = 0) => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      const response = await fetch(`${baseUrl}/v1/admin/feedback/comments?${query}`, { headers })
      if (!response.ok) throw new Error('Failed to fetch feedback comments')
      const data = await response.json()
      feedbackComments.value = data.comments ?? []
      feedbackTotal.value = data.total ?? 0
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  const deleteFeedbackComment = async (id: number) => {
    isLoading.value = true
    error.value = null
    try {
      const headers = await authHeaders()
      const response = await fetch(`${baseUrl}/v1/admin/feedback/comments/${id}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete comment')
      }
      await fetchFeedbackComments()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete comment'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    providers,
    members,
    feedbackComments,
    feedbackTotal,
    isLoading,
    error,
    fetchProviders,
    fetchMembers,
    fetchFeedbackComments,
    createProvider,
    updateProvider,
    deleteProvider,
    addProviderMember,
    removeProviderMember,
    enableNormAnalytics,
    disableNormAnalytics,
    kickNormAnalytics,
    deleteFeedbackComment,
  }
})
