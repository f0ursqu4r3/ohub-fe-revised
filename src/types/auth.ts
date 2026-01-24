export interface User {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

export interface Customer {
  id: number
  email: string
  company: string
  planId: string
  createdAt: string
  updatedAt: string
}
