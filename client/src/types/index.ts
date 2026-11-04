export type FetchStatus = 'pending' | 'fetching' | 'ok' | 'error' | 'not_found'

export type RankingMetric =
  | 'solved_total'
  | 'contest_rating'
  | 'contests_attended'

export type SortOrder = 'asc' | 'desc'

export interface LeaderboardUser {
  id: number
  leetcode_username: string
  display_name: string | null
  avatar_url: string | null
  solved_total: number | null
  solved_easy: number | null
  solved_medium: number | null
  solved_hard: number | null
  contest_rating: number | null
  contests_attended: number | null
  fetch_status: FetchStatus
  last_refreshed_at: string | null
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface JoinRequestPayload {
  leetcode_username: string
  display_name?: string
}

export interface JoinRequestResponse {
  success: boolean
  message: string
}

export interface Community {
  id: number
  name: string
  slug: string
  description: string | null
  member_count?: number
  owner_id?: number | null
  owner_username?: string | null
  refresh_interval_hours?: number
  refresh_concurrency?: number
  created_at?: string
  status?: 'approved' | 'archived'
}

export interface CommunityRequestPayload {
  name: string
  description?: string
  requester_name?: string
  requester_email?: string
}

export interface ProfileValidationResult {
  valid: boolean
  reason?: 'not_found' | 'provider_error'
  message?: string
}

