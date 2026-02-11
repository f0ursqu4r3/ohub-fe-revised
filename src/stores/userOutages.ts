import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type { CreateUserOutageRequest, CreateUserOutageResponse } from '@/types/userOutage'

export const useUserOutageStore = defineStore('userOutages', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  const submitting = ref(false)
  const lastSubmission = ref<CreateUserOutageResponse | null>(null)

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

      const response = await fetch(`${baseUrl}/v1/outage-reports`, {
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

  return {
    submitting,
    lastSubmission,
    submitReport,
  }
})
