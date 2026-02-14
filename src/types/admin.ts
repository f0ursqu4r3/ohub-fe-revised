export interface AdminProviderDirectoryItem {
  name: string
  implemented: boolean
  isHidden: boolean
  enableFetcher: boolean
  enableParser: boolean
  enableAggregation: boolean
  niceName?: string
  mapLink?: string
  blurb?: string
  contactLink?: string
  picScenic?: string
  picOffice?: string
  picUtility?: string
  createdAt: number
  updatedAt: number
}

export interface CreateProviderRequest {
  name: string
  implemented?: boolean
  isHidden?: boolean
  enableFetcher?: boolean
  enableParser?: boolean
  enableAggregation?: boolean
  niceName?: string
  mapLink?: string
  blurb?: string
  contactLink?: string
  picScenic?: string
  picOffice?: string
  picUtility?: string
}

export interface PatchProviderRequest {
  implemented?: boolean
  isHidden?: boolean
  enableFetcher?: boolean
  enableParser?: boolean
  enableAggregation?: boolean
  niceName?: string
  mapLink?: string
  blurb?: string
  contactLink?: string
  picScenic?: string
  picOffice?: string
  picUtility?: string
}

export interface AdminProviderMember {
  customerId: number
  email: string
  provider: string
  role: string
}

export interface ProviderMemberRequest {
  customerEmail: string
  provider: string
  role: string
}

export interface ProviderMemberResponse {
  customerId: number
  customerEmail: string
  provider: string
  role: string
}

export interface AdminFeedbackComment {
  id: number
  targetType: string
  targetId: number
  authorCustomerId: number | null
  authorEmail: string | null
  comment: string
  createdAt: number
}
