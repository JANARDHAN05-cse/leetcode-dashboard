import type {
  AdminUser,
  AppSettings,
  AdminUsersResponse,
  AdminRequestsResponse,
  RefreshJobStatus,
  CommunityCreationRequest,
} from '@/types/admin'
import type { RankingMetric, LeaderboardUser, Community, PaginationMeta } from '@/types'

export class AdminApiError extends Error {
  code?: string
  status?: number

  constructor(message: string, code?: string, status?: number) {
    super(message)
    this.name = 'AdminApiError'
    this.code = code
    this.status = status
  }
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Ensures HTTP-only cookies are included
  })

  let json: ApiResponse<T> | undefined
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    throw new AdminApiError('Failed to parse server response', 'INVALID_JSON', res.status)
  }

  if (!res.ok) {
    const errorMsg = json?.error?.message || 'Request failed'
    const errorCode = json?.error?.code || 'UNKNOWN_ERROR'
    throw new AdminApiError(errorMsg, errorCode, res.status)
  }

  return json.data as T
}

export const adminApi = {
  // 1. Auth
  async login(username: string, password: string): Promise<{ admin: AdminUser; token?: string }> {
    return request<{ admin: AdminUser; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    })
  },

  async getMe(): Promise<{ admin: AdminUser }> {
    return request<{ admin: AdminUser }>('/api/auth/me')
  },

  // 2. Approved Users
  async getApprovedUsers(params: {
    sort?: RankingMetric
    search?: string
    page?: number
    limit?: number
  }): Promise<AdminUsersResponse> {
    const searchParams = new URLSearchParams()
    if (params.sort) searchParams.set('sort', params.sort)
    if (params.search) searchParams.set('search', params.search)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return request<AdminUsersResponse>(`/api/admin/users?${searchParams.toString()}`)
  },

  async addUser(data: { leetcode_username: string; display_name?: string }): Promise<{ user: LeaderboardUser }> {
    return request<{ user: LeaderboardUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async removeUser(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    })
  },

  async refreshUser(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/admin/users/${id}/refresh`, {
      method: 'POST',
    })
  },

  // 3. Pending Requests
  async getPendingRequests(params: {
    page?: number
    limit?: number
    community_id?: number
    community_slug?: string
  } = {}): Promise<AdminRequestsResponse> {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.community_id) searchParams.set('community_id', String(params.community_id))
    if (params.community_slug) searchParams.set('community_slug', params.community_slug)

    return request<AdminRequestsResponse>(`/api/admin/requests?${searchParams.toString()}`)
  },

  async getPendingRequestsCount(): Promise<{ count: number }> {
    return request<{ count: number }>('/api/admin/requests/count')
  },

  async approveRequest(id: number): Promise<{ user: { id: number; leetcode_username: string } }> {
    return request<{ user: { id: number; leetcode_username: string } }>(`/api/admin/requests/${id}/approve`, {
      method: 'POST',
    })
  },

  async rejectRequest(id: number, rejection_reason?: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/admin/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason }),
    })
  },

  // 4. Settings
  async getSettings(): Promise<AppSettings> {
    return request<AppSettings>('/api/admin/settings')
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return request<AppSettings>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  },

  async refreshAll(): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>('/api/admin/settings/refresh-all', {
      method: 'POST',
    })
  },

  async startRefreshAll(): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>('/api/admin/refresh-all', {
      method: 'POST',
    })
  },

  async getRefreshAllStatus(): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>('/api/admin/refresh-all/status')
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/admin/settings/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  },

  // 5. Multi-Community Platform Admin APIs
  async getAdminCommunities(): Promise<Community[]> {
    return request<Community[]>('/api/admin/communities')
  },

  async getCommunityRequests(status?: string): Promise<CommunityCreationRequest[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : ''
    return request<CommunityCreationRequest[]>(`/api/admin/communities/requests${q}`)
  },

  async approveCommunityRequest(id: number): Promise<Community> {
    return request<Community>(`/api/admin/communities/requests/${id}/approve`, {
      method: 'POST',
    })
  },

  async rejectCommunityRequest(id: number, rejection_reason?: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/admin/communities/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason }),
    })
  },

  async updateCommunity(id: number, data: Partial<Community>): Promise<Community> {
    return request<Community>(`/api/admin/communities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async archiveCommunity(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/admin/communities/${id}`, {
      method: 'DELETE',
    })
  },

  async refreshAllCommunities(): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>('/api/admin/communities/refresh-all', {
      method: 'POST',
    })
  },

  async getRefreshAllCommunitiesStatus(): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>('/api/admin/communities/refresh-all/status')
  },

  // 6. Community-Scoped Management APIs (Platform Admin & Community Owner)
  async getCommunityMembers(
    slug: string,
    params: { sort?: RankingMetric; search?: string; page?: number; limit?: number } = {}
  ): Promise<{ community: Community; users: LeaderboardUser[]; pagination: PaginationMeta }> {
    const sp = new URLSearchParams()
    if (params.sort) sp.set('sort', params.sort)
    if (params.search) sp.set('search', params.search)
    if (params.page) sp.set('page', String(params.page))
    if (params.limit) sp.set('limit', String(params.limit))
    return request<{ community: Community; users: LeaderboardUser[]; pagination: PaginationMeta }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/members?${sp.toString()}`
    )
  },

  async addCommunityMember(
    slug: string,
    data: { leetcode_username: string; display_name?: string }
  ): Promise<{ user: LeaderboardUser }> {
    return request<{ user: LeaderboardUser }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/members`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  },

  async removeCommunityMember(slug: string, userId: number): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/members/${userId}`,
      {
        method: 'DELETE',
      }
    )
  },

  async refreshCommunityMember(slug: string, userId: number): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/members/${userId}/refresh`,
      {
        method: 'POST',
      }
    )
  },

  async refreshCommunity(slug: string): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/refresh-all`,
      {
        method: 'POST',
      }
    )
  },

  async getRefreshCommunityStatus(slug: string): Promise<RefreshJobStatus> {
    return request<RefreshJobStatus>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/refresh-all/status`
    )
  },

  async getCommunityMemberRequests(
    slug: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<AdminRequestsResponse> {
    const sp = new URLSearchParams()
    if (params.page) sp.set('page', String(params.page))
    if (params.limit) sp.set('limit', String(params.limit))
    return request<AdminRequestsResponse>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/requests?${sp.toString()}`
    )
  },

  async getCommunityMemberRequestsCount(slug: string): Promise<{ count: number }> {
    return request<{ count: number }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/requests/count`
    )
  },

  async approveCommunityMemberRequest(
    slug: string,
    id: number
  ): Promise<{ user: { id: number; leetcode_username: string } }> {
    return request<{ user: { id: number; leetcode_username: string } }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/requests/${id}/approve`,
      {
        method: 'POST',
      }
    )
  },

  async rejectCommunityMemberRequest(
    slug: string,
    id: number,
    rejection_reason?: string
  ): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/api/admin/communities/c/${encodeURIComponent(slug)}/requests/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ rejection_reason }),
      }
    )
  },
}
