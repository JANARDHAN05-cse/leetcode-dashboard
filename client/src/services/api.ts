import type {
  LeaderboardUser,
  PaginationMeta,
  RankingMetric,
  JoinRequestPayload,
  JoinRequestResponse,
  Community,
  CommunityRequestPayload,
  ProfileValidationResult,
} from '@/types'
import { MOCK_DEVELOPMENT_USERS } from '@/test/mocks/fixtures'

export interface LeaderboardResponse {
  users: LeaderboardUser[]
  pagination: PaginationMeta
}

/**
 * Compares two nullable numbers placing nulls last in descending order.
 */
function compareDescNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

/**
 * Sorts users deterministically by metric and tie-breaking rules per FR-001.
 */
export function sortUsersByMetric(
  users: LeaderboardUser[],
  metric: RankingMetric
): LeaderboardUser[] {
  return [...users].sort((a, b) => {
    switch (metric) {
      case 'solved_total': {
        const primaryDiff = compareDescNullsLast(a.solved_total, b.solved_total)
        if (primaryDiff !== 0) return primaryDiff
        const secondaryDiff = compareDescNullsLast(a.contest_rating, b.contest_rating)
        if (secondaryDiff !== 0) return secondaryDiff
        return a.leetcode_username.localeCompare(b.leetcode_username)
      }

      case 'contest_rating': {
        const primaryDiff = compareDescNullsLast(a.contest_rating, b.contest_rating)
        if (primaryDiff !== 0) return primaryDiff
        const secondaryDiff = compareDescNullsLast(a.solved_total, b.solved_total)
        if (secondaryDiff !== 0) return secondaryDiff
        return a.leetcode_username.localeCompare(b.leetcode_username)
      }

      case 'contests_attended': {
        const primaryDiff = compareDescNullsLast(a.contests_attended, b.contests_attended)
        if (primaryDiff !== 0) return primaryDiff
        const secondaryDiff = compareDescNullsLast(a.contest_rating, b.contest_rating)
        if (secondaryDiff !== 0) return secondaryDiff
        return a.leetcode_username.localeCompare(b.leetcode_username)
      }
    }
  })
}

/**
 * In-memory pending requests for local UI simulation.
 */
const mockPendingRequests = new Set<string>()

/**
 * Fetches leaderboard data with search, ranking metric sort, and pagination.
 * Connects to live backend API, falling back to local preview fixtures if unreachable.
 */
export async function getLeaderboard(params: {
  metric: RankingMetric
  search?: string
  page?: number
  limit?: number
}): Promise<LeaderboardResponse> {
  const { metric, search = '', page = 1, limit = 25 } = params

  const searchParams = new URLSearchParams()
  searchParams.set('sort', metric)
  if (search.trim()) {
    searchParams.set('search', search.trim())
  }
  searchParams.set('page', String(page))
  searchParams.set('limit', String(limit))

  try {
    const response = await fetch(`/api/users?${searchParams.toString()}`)
    if (response.ok) {
      const result = await response.json()
      if (result.success && result.data) {
        return result.data
      }
    }
  } catch {
    // If backend is not currently running, fall back to development sample fixtures
  }

  // Simulate network latency (150ms) for realistic loading state demonstration in fallback mode
  await new Promise((resolve) => setTimeout(resolve, 150))

  // 1. Filter by search query (case-insensitive across username and display_name)
  const trimmedSearch = search.trim().toLowerCase()
  const filtered = trimmedSearch
    ? MOCK_DEVELOPMENT_USERS.filter((user) => {
        const usernameMatch = user.leetcode_username.toLowerCase().includes(trimmedSearch)
        const displayMatch = user.display_name?.toLowerCase().includes(trimmedSearch) ?? false
        return usernameMatch || displayMatch
      })
    : MOCK_DEVELOPMENT_USERS

  // 2. Sort deterministically
  const sorted = sortUsersByMetric(filtered, metric)

  // 3. Paginate
  const total = sorted.length
  const total_pages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(Math.max(1, page), total_pages)
  const startIndex = (safePage - 1) * limit
  const paginatedUsers = sorted.slice(startIndex, startIndex + limit)

  return {
    users: paginatedUsers,
    pagination: {
      page: safePage,
      limit,
      total,
      total_pages,
    },
  }
}

/**
 * Submits a "Request to Add" profile join request.
 * Connects to live backend API with fallback simulation if server is offline.
 */
export async function submitJoinRequest(
  payload: JoinRequestPayload
): Promise<JoinRequestResponse> {
  const cleanUsername = payload.leetcode_username.trim()

  if (!cleanUsername) {
    throw new Error('LeetCode username is required.')
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{1,30}$/
  if (!usernameRegex.test(cleanUsername)) {
    throw new Error(
      'Username must be between 1 and 30 characters and only contain letters, numbers, underscores, or hyphens.'
    )
  }

  try {
    const response = await fetch('/api/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leetcode_username: cleanUsername,
        display_name: payload.display_name?.trim() || undefined,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const error: Error & { code?: string } = new Error(
        data.error?.message || 'Failed to submit request.'
      )
      error.code = data.error?.code
      throw error
    }

    return {
      success: true,
      message:
        data.data?.message ||
        'Your request has been submitted and is pending admin approval. Your profile will be added to the leaderboard once approved.',
    }
  } catch (err: unknown) {
    const apiError = err as (Error & { code?: string }) | undefined
    // If the error has a specific API error code or is an intentional validation error, propagate it
    if (
      apiError?.code ||
      (apiError?.message && !apiError.message.includes('Failed to fetch'))
    ) {
      throw err
    }

    // Fallback simulation if backend is offline during isolated UI development
    const isAlreadyApproved = MOCK_DEVELOPMENT_USERS.some(
      (u) => u.leetcode_username.toLowerCase() === cleanUsername.toLowerCase()
    )
    if (isAlreadyApproved) {
      const error: Error & { code?: string } = new Error(
        'This username is already on the leaderboard.'
      )
      error.code = 'USER_ALREADY_APPROVED'
      throw error
    }

    if (mockPendingRequests.has(cleanUsername.toLowerCase())) {
      const error: Error & { code?: string } = new Error(
        'A request for this username is already pending admin approval.'
      )
      error.code = 'DUPLICATE_REQUEST'
      throw error
    }

    mockPendingRequests.add(cleanUsername.toLowerCase())

    return {
      success: true,
      message:
        'Your request has been submitted and is pending admin approval. Your profile will be added to the leaderboard once approved.',
    }
  }
}

// ==========================================
// MULTI-COMMUNITY PUBLIC APIS
// ==========================================

export async function getCommunities(search?: string): Promise<Community[]> {
  const query = search ? `?search=${encodeURIComponent(search.trim())}` : ''
  const res = await fetch(`/api/communities${query}`)
  if (!res.ok) {
    throw new Error('Failed to fetch communities.')
  }
  const json = await res.json()
  return json.data || []
}

export async function getCommunity(slug: string): Promise<Community> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    throw new Error(`Community '${slug}' not found.`)
  }
  const json = await res.json()
  return json.data
}

export async function getCommunityLeaderboard(
  slug: string,
  params: {
    metric: RankingMetric
    search?: string
    page?: number
    limit?: number
  }
): Promise<{ community: Community; users: LeaderboardUser[]; pagination: PaginationMeta }> {
  const { metric, search = '', page = 1, limit = 25 } = params
  const searchParams = new URLSearchParams()
  searchParams.set('sort', metric)
  if (search.trim()) searchParams.set('search', search.trim())
  searchParams.set('page', String(page))
  searchParams.set('limit', String(limit))

  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/leaderboard?${searchParams.toString()}`)
  if (!res.ok) {
    throw new Error('Failed to load community leaderboard.')
  }
  const json = await res.json()
  return json.data
}

export async function submitCommunityRequest(
  payload: CommunityRequestPayload
): Promise<{ request: unknown; message: string }> {
  const res = await fetch('/api/communities/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) {
    const error: Error & { code?: string } = new Error(json.error?.message || 'Failed to submit community request.')
    error.code = json.error?.code
    throw error
  }
  return json.data
}

export async function submitCommunityMemberRequest(
  slug: string,
  payload: JoinRequestPayload
): Promise<{ request: unknown; message: string }> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) {
    const error: Error & { code?: string } = new Error(json.error?.message || 'Failed to submit member request.')
    error.code = json.error?.code
    throw error
  }
  return json.data
}

export async function validateLeetCodeUser(username: string): Promise<ProfileValidationResult> {
  const res = await fetch('/api/communities/validate-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leetcode_username: username }),
  })
  const json = await res.json()
  if (!res.ok || !json.data) {
    return {
      valid: false,
      reason: 'provider_error',
      message: 'Failed to validate profile with server.',
    }
  }
  return json.data
}
