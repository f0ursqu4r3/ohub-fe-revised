import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import type {
  FeedbackTargetType,
  FeedbackAction,
  FeedbackSummaryItem,
  FeedbackSummaryResponse,
} from '@/types/feedback'

const summaryKey = (targetType: FeedbackTargetType, targetId: number | string) =>
  `${targetType}:${targetId}`

export const useFeedbackStore = defineStore('feedback', () => {
  const authStore = useAuthStore()
  const baseUrl = import.meta.env.VITE_BASE_API_URL

  // ── State ──
  const summaries = reactive(new Map<string, FeedbackSummaryItem>())

  // ── Helpers ──
  const buildHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.isAuthenticated) {
      try {
        const token = await authStore.getAccessToken()
        headers['Authorization'] = `Bearer ${token}`
      } catch {
        // Proceed without auth
      }
    }
    return headers
  }

  const getSummary = (targetType: FeedbackTargetType, targetId: number | string) =>
    summaries.get(summaryKey(targetType, targetId)) ?? null

  // ── Fetch summaries ──
  const fetchSummaries = async (outageIds: (number | string)[], userOutageIds?: (number | string)[]) => {
    const params = new URLSearchParams()
    if (outageIds.length) params.set('outageIds', outageIds.join(','))
    if (userOutageIds?.length) params.set('userOutageIds', userOutageIds.join(','))
    if (!params.toString()) return

    const headers = await buildHeaders()
    const response = await fetch(`${baseUrl}/v1/feedback/summary?${params}`, { headers })
    if (!response.ok) return

    const data: FeedbackSummaryResponse = await response.json()
    for (const item of data.items) {
      summaries.set(summaryKey(item.targetType, item.targetId), item)
    }
  }

  // ── Vote ──
  const submitVote = async (
    targetType: FeedbackTargetType,
    targetId: number | string,
    action: 'upvote' | 'downvote',
  ) => {
    const key = summaryKey(targetType, targetId)
    const prev = summaries.get(key)

    // Optimistic update
    if (prev) {
      const clone = { ...prev }
      const voteVal = action === 'upvote' ? 1 : -1

      if (clone.myVote === voteVal) {
        // Toggling same vote off → clear
        if (action === 'upvote') clone.upvotes--
        else clone.downvotes--
        clone.myVote = null
      } else {
        // Undo previous vote if any
        if (clone.myVote === 1) clone.upvotes--
        else if (clone.myVote === -1) clone.downvotes--
        // Apply new vote
        if (action === 'upvote') clone.upvotes++
        else clone.downvotes++
        clone.myVote = voteVal
      }
      clone.score = clone.upvotes - clone.downvotes
      summaries.set(key, clone)
    }

    try {
      // If toggling off the same vote, call clear endpoint
      if (prev?.myVote === (action === 'upvote' ? 1 : -1)) {
        const params = new URLSearchParams({
          targetType,
          targetId: String(targetId),
        })
        const headers = await buildHeaders()
        const response = await fetch(`${baseUrl}/v1/feedback/vote?${params}`, {
          method: 'DELETE',
          headers,
        })
        if (!response.ok) throw new Error('Failed to clear vote')
      } else {
        const headers = await buildHeaders()
        const response = await fetch(`${baseUrl}/v1/feedback`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ targetType, targetId: Number(targetId), action }),
        })
        if (!response.ok) throw new Error('Failed to submit vote')
      }
    } catch {
      // Revert on error
      if (prev) summaries.set(key, prev)
    }
  }

  // ── Flag ──
  const toggleFlag = async (targetType: FeedbackTargetType, targetId: number | string) => {
    const key = summaryKey(targetType, targetId)
    const prev = summaries.get(key)

    // Optimistic update
    if (prev) {
      const clone = { ...prev }
      if (clone.myFlag) {
        clone.flags--
        clone.myFlag = false
      } else {
        clone.flags++
        clone.myFlag = true
      }
      summaries.set(key, clone)
    }

    try {
      if (prev?.myFlag) {
        // Was flagged, now clearing
        const params = new URLSearchParams({
          targetType,
          targetId: String(targetId),
        })
        const headers = await buildHeaders()
        const response = await fetch(`${baseUrl}/v1/feedback/flag?${params}`, {
          method: 'DELETE',
          headers,
        })
        if (!response.ok) throw new Error('Failed to clear flag')
      } else {
        const headers = await buildHeaders()
        const response = await fetch(`${baseUrl}/v1/feedback`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            targetType,
            targetId: Number(targetId),
            action: 'flag' as FeedbackAction,
          }),
        })
        if (!response.ok) throw new Error('Failed to submit flag')
      }
    } catch {
      // Revert on error
      if (prev) summaries.set(key, prev)
    }
  }

  return {
    summaries,
    getSummary,
    fetchSummaries,
    submitVote,
    toggleFlag,
  }
})
