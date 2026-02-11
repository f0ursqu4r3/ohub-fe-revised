import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type {
  CreateUserOutageRequest,
  CreateUserOutageResponse,
  UserOutageReport,
  UserOutageReportsResponse,
} from '@/types/userOutage'

export const useUserOutageStore = defineStore('userOutages', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  // Submit state
  const submitting = ref(false)
  const lastSubmission = ref<CreateUserOutageResponse | null>(null)

  // Read state
  const reports = ref<UserOutageReport[]>([])
  const reportsLoading = ref(false)
  const reportsError = ref<string | null>(null)

  const submitReport = async (req: CreateUserOutageRequest): Promise<CreateUserOutageResponse> => {
    submitting.value = true
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Attach auth token if user is logged in (optional auth)
      if (authStore.isAuthenticated) {
        try {
          const token = await authStore.getAccessToken()
          headers['Authorization'] = `Bearer ${token}`
        } catch {
          // Proceed without auth — endpoint allows anonymous
        }
      }

      const response = await fetch(`${baseUrl}/v1/user-outages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
      })

      if (response.status === 429) {
        throw new Error('Too many reports. Please try again later.')
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to submit report')
      }

      const data: CreateUserOutageResponse = await response.json()
      lastSubmission.value = data
      return data
    } finally {
      submitting.value = false
    }
  }

  const fetchReports = async () => {
    reportsLoading.value = true
    reportsError.value = null
    try {
      const now = Math.floor(Date.now() / 1000)
      const since = now - 7 * 24 * 60 * 60 // last 7 days
      const params = new URLSearchParams({
        since: String(since),
        until: String(now),
        limit: '500',
      })
      const response = await fetch(`${baseUrl}/v1/user-outages?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch user reports')
      }
      const data: UserOutageReportsResponse = await response.json()
      reports.value = data.reports
    } catch (err) {
      reportsError.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      reportsLoading.value = false
    }
  }

  return {
    submitting,
    lastSubmission,
    submitReport,
    reports,
    reportsLoading,
    reportsError,
    fetchReports,
  }
})
