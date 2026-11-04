import type { LeaderboardUser, PaginationMeta } from './index'

export type { PaginationMeta }

export interface AdminUser {
  id: number
  username: string
  role?: 'platform_admin' | 'community_owner' | 'community_moderator'
  community_id?: number | null
}

export interface CommunityCreationRequest {
  id: number
  name: string
  slug: string
  description: string | null
  requester_name: string | null
  requester_email: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
}

export interface PendingRequest {
  id: number
  leetcode_username: string
  display_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  community_id?: number
  community_name?: string
  community_slug?: string
}

export interface AppSettings {
  refresh_interval_hours: number
  refresh_concurrency: number
}

export interface RefreshResultItem {
  username: string
  status: 'ok' | 'failed'
  error?: string
}

export interface RefreshJobStatus {
  jobId: string
  type?: 'global' | 'community'
  communityId?: number
  communityName?: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  totalCommunities?: number
  total: number
  processed: number
  successful: number
  failed: number
  currentUser?: string
  results: RefreshResultItem[]
  startedAt: string | null
  completedAt: string | null
}

export interface AdminUsersResponse {
  users: LeaderboardUser[]
  pagination: PaginationMeta
}

export interface AdminRequestsResponse {
  requests: PendingRequest[]
  pagination: PaginationMeta
}
