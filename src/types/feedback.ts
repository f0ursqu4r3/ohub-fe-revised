export type FeedbackTargetType = 'outage' | 'userOutage'
export type FeedbackAction = 'upvote' | 'downvote' | 'flag'

export interface FeedbackSummaryItem {
  targetType: FeedbackTargetType
  targetId: number
  upvotes: number
  downvotes: number
  score: number
  flags: number
  commentCount: number
  myVote: number | null
  myFlag: boolean
}

export interface FeedbackSummaryResponse {
  items: FeedbackSummaryItem[]
}
