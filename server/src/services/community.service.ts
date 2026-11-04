import { query, getClient } from '../db/client'
import { AdminActionError } from './admin.service'
import { RequestValidationError, RequestConflictError } from './request.service'
import { syncUserStats } from './sync.service'
import {
  LeetCodeGraphQLProvider,
} from '../providers/leetcode.graphql.provider'
import type { ILeetCodeProvider } from '../providers/ILeetCodeProvider'
import type { RankingMetric } from './leaderboard.service'

const defaultProvider: ILeetCodeProvider = new LeetCodeGraphQLProvider()

export interface CommunityRecord {
  id: number
  name: string
  slug: string
  description: string | null
  owner_id: number | null
  owner_username?: string | null
  member_count?: number
  refresh_interval_hours: number
  refresh_concurrency: number
  status: 'approved' | 'archived'
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface CommunityLeaderboardUser {
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
  fetch_status: 'pending' | 'fetching' | 'ok' | 'error' | 'not_found'
  last_refreshed_at: string | null
  community_role?: string
  joined_at?: string
}

export interface CommunityRequestRecord {
  id: number
  name: string
  slug: string
  description: string | null
  requester_name: string | null
  requester_email: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  reviewed_at: string | null
  reviewed_by: number | null
  created_at: string
}

export interface CommunityMemberRequestRecord {
  id: number
  community_id: number
  leetcode_username: string
  display_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  requested_at: string
  reviewed_at: string | null
  reviewed_by: number | null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ==========================================
// 1. PUBLIC COMMUNITY DISCOVERY & DIRECTORY
// ==========================================

export async function getApprovedCommunities(search?: string): Promise<CommunityRecord[]> {
  let sql = `
    SELECT 
      c.id, c.name, c.slug, c.description, c.owner_id, 
      c.refresh_interval_hours, c.refresh_concurrency, c.status,
      c.created_at, c.updated_at, c.archived_at,
      COUNT(cm.id)::int as member_count
    FROM communities c
    LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.archived_at IS NULL
    WHERE c.status = 'approved' AND c.archived_at IS NULL
  `
  const params: any[] = []

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`)
    sql += ` AND (LOWER(c.name) LIKE $1 OR LOWER(c.description) LIKE $1) `
  }

  sql += `
    GROUP BY c.id
    ORDER BY member_count DESC, c.name ASC
  `

  const res = await query<CommunityRecord>(sql, params)
  return res.rows
}

export async function getCommunityBySlug(slug: string): Promise<CommunityRecord | null> {
  const sql = `
    SELECT 
      c.id, c.name, c.slug, c.description, c.owner_id,
      c.refresh_interval_hours, c.refresh_concurrency, c.status,
      c.created_at, c.updated_at, c.archived_at,
      COUNT(cm.id)::int as member_count
    FROM communities c
    LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.archived_at IS NULL
    WHERE c.slug = $1 AND c.archived_at IS NULL
    GROUP BY c.id
  `
  const res = await query<CommunityRecord>(sql, [slug.trim().toLowerCase()])
  return res.rows[0] || null
}

// ==========================================
// 2. COMMUNITY CREATION REQUESTS
// ==========================================

export async function createCommunityRequest(data: {
  name: string
  description?: string
  requester_name?: string
  requester_email?: string
}): Promise<CommunityRequestRecord> {
  const cleanName = data.name.trim()
  if (!cleanName || cleanName.length < 3 || cleanName.length > 100) {
    throw new RequestValidationError('Community name must be between 3 and 100 characters.')
  }

  const slug = slugify(cleanName)
  if (!slug) {
    throw new RequestValidationError('Invalid community name. Cannot generate URL slug.')
  }

  // 1. Check duplicate active community name or slug
  const activeCheck = await query(
    `SELECT id FROM communities WHERE (LOWER(name) = LOWER($1) OR slug = $2) AND archived_at IS NULL`,
    [cleanName, slug]
  )
  if (activeCheck.rows.length > 0) {
    throw new AdminActionError(
      `A community with the name '${cleanName}' already exists.`,
      'COMMUNITY_NAME_EXISTS',
      409
    )
  }

  // 2. Check duplicate pending community request name or slug
  const pendingCheck = await query(
    `SELECT id FROM community_requests WHERE (LOWER(name) = LOWER($1) OR slug = $2) AND status = 'pending'`,
    [cleanName, slug]
  )
  if (pendingCheck.rows.length > 0) {
    throw new AdminActionError(
      `A pending creation request for '${cleanName}' already exists.`,
      'COMMUNITY_REQUEST_EXISTS',
      409
    )
  }

  const res = await query<CommunityRequestRecord>(
    `INSERT INTO community_requests (name, slug, description, requester_name, requester_email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      cleanName,
      slug,
      data.description?.trim() || null,
      data.requester_name?.trim() || null,
      data.requester_email?.trim() || null,
    ]
  )

  return res.rows[0]
}

export async function getCommunityRequests(status?: string): Promise<CommunityRequestRecord[]> {
  let sql = `SELECT * FROM community_requests`
  const params: any[] = []

  if (status) {
    sql += ` WHERE status = $1`
    params.push(status)
  }

  sql += ` ORDER BY created_at DESC`
  const res = await query<CommunityRequestRecord>(sql, params)
  return res.rows
}

export async function approveCommunityRequest(
  requestId: number,
  reviewerId: number
): Promise<CommunityRecord> {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    const reqRes = await client.query(
      `SELECT * FROM community_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    )

    if (reqRes.rows.length === 0) {
      throw new AdminActionError('Community request not found.', 'REQUEST_NOT_FOUND', 404)
    }

    const request = reqRes.rows[0]
    if (request.status !== 'pending') {
      throw new AdminActionError(
        `Request is already ${request.status}.`,
        'REQUEST_ALREADY_REVIEWED',
        400
      )
    }

    // Re-verify name & slug uniqueness
    const activeCheck = await client.query(
      `SELECT id FROM communities WHERE (LOWER(name) = LOWER($1) OR slug = $2) AND archived_at IS NULL`,
      [request.name, request.slug]
    )
    if (activeCheck.rows.length > 0) {
      throw new AdminActionError(
        `A community with name '${request.name}' or slug '${request.slug}' already exists.`,
        'COMMUNITY_NAME_EXISTS',
        409
      )
    }

    // Insert new community
    const insertComm = await client.query(
      `INSERT INTO communities (name, slug, description, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.name, request.slug, request.description, reviewerId]
    )

    // Mark request approved
    await client.query(
      `UPDATE community_requests 
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
       WHERE id = $2`,
      [reviewerId, requestId]
    )

    await client.query('COMMIT')
    return insertComm.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function rejectCommunityRequest(
  requestId: number,
  reason: string | undefined,
  reviewerId: number
): Promise<{ message: string }> {
  const res = await query(
    `UPDATE community_requests
     SET status = 'rejected', rejection_reason = $1, reviewed_at = NOW(), reviewed_by = $2
     WHERE id = $3 AND status = 'pending'
     RETURNING id`,
    [reason?.trim() || null, reviewerId, requestId]
  )

  if (res.rows.length === 0) {
    throw new AdminActionError(
      'Community request not found or already reviewed.',
      'REQUEST_NOT_FOUND',
      404
    )
  }

  return { message: 'Community request rejected.' }
}

// ==========================================
// 3. COMMUNITY LEADERBOARD (SCOPED)
// ==========================================

export async function getCommunityLeaderboard(
  slug: string,
  params: {
    metric?: RankingMetric
    order?: 'asc' | 'desc'
    search?: string
    page?: number
    limit?: number
  } = {}
): Promise<{
  community: CommunityRecord
  users: CommunityLeaderboardUser[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}> {
  const community = await getCommunityBySlug(slug)
  if (!community) {
    throw new AdminActionError(`Community '${slug}' not found.`, 'COMMUNITY_NOT_FOUND', 404)
  }

  const {
    metric = 'solved_total',
    order = 'desc',
    search,
    page = 1,
    limit = 25,
  } = params

  const cleanLimit = Math.min(Math.max(Number(limit) || 25, 1), 100)
  const cleanPage = Math.max(Number(page) || 1, 1)
  const offset = (cleanPage - 1) * cleanLimit

  const conditions: string[] = [
    'cm.community_id = $1',
    'cm.archived_at IS NULL',
    'u.archived_at IS NULL',
  ]
  const queryParams: any[] = [community.id]

  if (search && search.trim()) {
    const cleanSearch = `%${search.trim().toLowerCase()}%`
    queryParams.push(cleanSearch)
    const idx = queryParams.length
    conditions.push(`(LOWER(u.leetcode_username) LIKE $${idx} OR LOWER(u.display_name) LIKE $${idx})`)
  }

  const whereClause = conditions.join(' AND ')

  // Total count
  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM community_members cm 
     JOIN users u ON u.id = cm.user_id 
     WHERE ${whereClause}`,
    queryParams
  )
  const total = parseInt(countRes.rows[0]?.count || '0', 10)
  const total_pages = Math.max(Math.ceil(total / cleanLimit), 1)

  // Order clause
  let orderClause: string
  const sortDirection = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  switch (metric) {
    case 'contest_rating':
      orderClause = `u.contest_rating ${sortDirection} NULLS LAST, u.solved_total DESC NULLS LAST, LOWER(u.leetcode_username) ASC`
      break
    case 'contests_attended':
      orderClause = `u.contests_attended ${sortDirection} NULLS LAST, u.contest_rating DESC NULLS LAST, LOWER(u.leetcode_username) ASC`
      break
    case 'solved_total':
    default:
      orderClause = `u.solved_total ${sortDirection} NULLS LAST, u.contest_rating DESC NULLS LAST, LOWER(u.leetcode_username) ASC`
      break
  }

  const listParams = [...queryParams, cleanLimit, offset]
  const limitIdx = queryParams.length + 1
  const offsetIdx = queryParams.length + 2

  const usersRes = await query<CommunityLeaderboardUser>(
    `SELECT 
       u.id,
       u.leetcode_username,
       u.display_name,
       u.avatar_url,
       u.solved_total,
       u.solved_easy,
       u.solved_medium,
       u.solved_hard,
       u.contest_rating,
       u.contests_attended,
       u.fetch_status,
       u.last_refreshed_at,
       cm.role as community_role,
       cm.joined_at
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE ${whereClause}
     ORDER BY ${orderClause}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams
  )

  const users = usersRes.rows.map((row) => ({
    ...row,
    contest_rating: row.contest_rating !== null ? parseFloat(row.contest_rating as any) : null,
  }))

  return {
    community,
    users,
    pagination: {
      page: cleanPage,
      limit: cleanLimit,
      total,
      total_pages,
    },
  }
}

// ==========================================
// 4. COMMUNITY MEMBER REQUESTS (PUBLIC ADD)
// ==========================================

export async function createCommunityMemberRequest(
  communitySlug: string,
  data: { leetcode_username: string; display_name?: string },
  provider: ILeetCodeProvider = defaultProvider
): Promise<{ request: CommunityMemberRequestRecord }> {
  const community = await getCommunityBySlug(communitySlug)
  if (!community) {
    throw new AdminActionError(`Community '${communitySlug}' not found.`, 'COMMUNITY_NOT_FOUND', 404)
  }

  const cleanUsername = data.leetcode_username?.trim()
  if (!cleanUsername) {
    throw new RequestValidationError('LeetCode username is required.')
  }

  const USERNAME_REGEX = /^[a-zA-Z0-9_-]{1,30}$/
  if (!USERNAME_REGEX.test(cleanUsername)) {
    throw new RequestValidationError(
      'Username must be 1-30 characters and contain only letters, numbers, underscores, or hyphens.'
    )
  }

  // 1. Verify existence against LeetCode provider before saving request
  const check = await provider.checkProfile(cleanUsername)
  if (!check.valid) {
    if (check.reason === 'not_found') {
      throw new RequestValidationError(
        `LeetCode profile '${cleanUsername}' does not exist.`,
        'leetcode_username',
        'PROFILE_NOT_FOUND'
      )
    } else {
      throw new AdminActionError(
        'LeetCode service is temporarily unavailable. Please try again shortly.',
        'PROVIDER_UNAVAILABLE',
        503
      )
    }
  }

  // 2. Check if already a member in this community
  const memberCheck = await query(
    `SELECT cm.id 
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1 
       AND LOWER(u.leetcode_username) = LOWER($2) 
       AND cm.archived_at IS NULL`,
    [community.id, cleanUsername]
  )
  if (memberCheck.rows.length > 0) {
    throw new RequestConflictError(
      `User '${cleanUsername}' is already a member of this community.`
    )
  }

  // 3. Check if already a pending request in this community
  const pendingCheck = await query(
    `SELECT id FROM community_member_requests 
     WHERE community_id = $1 
       AND LOWER(leetcode_username) = LOWER($2) 
       AND status = 'pending'`,
    [community.id, cleanUsername]
  )
  if (pendingCheck.rows.length > 0) {
    throw new RequestConflictError(
      `A pending request for '${cleanUsername}' already exists in this community.`
    )
  }

  const res = await query<CommunityMemberRequestRecord>(
    `INSERT INTO community_member_requests (community_id, leetcode_username, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [community.id, cleanUsername, data.display_name?.trim() || null]
  )

  return { request: res.rows[0] }
}

export async function getCommunityMemberRequests(
  communityId: number,
  params: { page?: number; limit?: number } = {}
): Promise<{
  requests: CommunityMemberRequestRecord[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}> {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), 100)
  const offset = (page - 1) * limit

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM community_member_requests WHERE community_id = $1 AND status = 'pending'`,
    [communityId]
  )
  const total = parseInt(countRes.rows[0]?.count || '0', 10)
  const total_pages = Math.max(Math.ceil(total / limit), 1)

  const res = await query<CommunityMemberRequestRecord>(
    `SELECT * FROM community_member_requests
     WHERE community_id = $1 AND status = 'pending'
     ORDER BY requested_at DESC
     LIMIT $2 OFFSET $3`,
    [communityId, limit, offset]
  )

  return {
    requests: res.rows,
    pagination: { page, limit, total, total_pages },
  }
}

export async function getCommunityMemberRequestsCount(communityId: number): Promise<number> {
  const res = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM community_member_requests WHERE community_id = $1 AND status = 'pending'`,
    [communityId]
  )
  return parseInt(res.rows[0]?.count || '0', 10)
}

export async function approveCommunityMemberRequest(
  communityId: number,
  requestId: number,
  reviewerId: number,
  provider: ILeetCodeProvider = defaultProvider
): Promise<{ user: { id: number; leetcode_username: string } }> {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    const reqRes = await client.query(
      `SELECT * FROM community_member_requests 
       WHERE id = $1 AND community_id = $2 FOR UPDATE`,
      [requestId, communityId]
    )

    if (reqRes.rows.length === 0) {
      throw new AdminActionError('Member request not found in this community.', 'REQUEST_NOT_FOUND', 404)
    }

    const request = reqRes.rows[0]
    if (request.status !== 'pending') {
      throw new AdminActionError(
        `Request is already ${request.status}.`,
        'REQUEST_ALREADY_REVIEWED',
        400
      )
    }

    // 1. Fetch real stats from LeetCode
    let stats
    try {
      stats = await provider.fetchUserStats(request.leetcode_username)
    } catch (err: any) {
      if (err.name === 'UserNotFoundError') {
        throw new AdminActionError(
          `Cannot approve: LeetCode profile '${request.leetcode_username}' does not exist.`,
          'USER_NOT_FOUND',
          400
        )
      }
      throw new AdminActionError(
        `Provider error validating profile: ${err.message}`,
        'PROVIDER_ERROR',
        502
      )
    }

    // 2. Upsert canonical user record
    const userRes = await client.query(
      `INSERT INTO users (
         leetcode_username, display_name, avatar_url,
         solved_total, solved_easy, solved_medium, solved_hard,
         contest_rating, contests_attended, fetch_status, last_refreshed_at, archived_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ok', NOW(), NULL)
       ON CONFLICT (leetcode_username) DO UPDATE
       SET 
         avatar_url = EXCLUDED.avatar_url,
         solved_total = EXCLUDED.solved_total,
         solved_easy = EXCLUDED.solved_easy,
         solved_medium = EXCLUDED.solved_medium,
         solved_hard = EXCLUDED.solved_hard,
         contest_rating = EXCLUDED.contest_rating,
         contests_attended = EXCLUDED.contests_attended,
         fetch_status = 'ok',
         last_refreshed_at = NOW(),
         archived_at = NULL
       RETURNING id, leetcode_username`,
      [
        stats.username,
        request.display_name || stats.displayName,
        stats.avatarUrl,
        stats.solvedTotal,
        stats.solvedEasy,
        stats.solvedMedium,
        stats.solvedHard,
        stats.contestRating,
        stats.contestsAttended,
      ]
    )
    const userId = userRes.rows[0].id

    // 3. Add to community_members
    const memCheck = await client.query(
      `SELECT id, archived_at FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    )
    if (memCheck.rows.length > 0) {
      if (memCheck.rows[0].archived_at) {
        await client.query(
          `UPDATE community_members SET archived_at = NULL, role = 'member' WHERE id = $1`,
          [memCheck.rows[0].id]
        )
      }
    } else {
      await client.query(
        `INSERT INTO community_members (community_id, user_id, role, joined_at, archived_at)
         VALUES ($1, $2, 'member', NOW(), NULL)`,
        [communityId, userId]
      )
    }

    // 4. Mark request approved
    await client.query(
      `UPDATE community_member_requests
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
       WHERE id = $2`,
      [reviewerId, requestId]
    )

    await client.query('COMMIT')
    return { user: { id: userId, leetcode_username: stats.username } }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function rejectCommunityMemberRequest(
  communityId: number,
  requestId: number,
  reason: string | undefined,
  reviewerId: number
): Promise<{ message: string }> {
  const res = await query(
    `UPDATE community_member_requests
     SET status = 'rejected', rejection_reason = $1, reviewed_at = NOW(), reviewed_by = $2
     WHERE id = $3 AND community_id = $4 AND status = 'pending'
     RETURNING id`,
    [reason?.trim() || null, reviewerId, requestId, communityId]
  )

  if (res.rows.length === 0) {
    throw new AdminActionError(
      'Member request not found or already reviewed.',
      'REQUEST_NOT_FOUND',
      404
    )
  }

  return { message: 'Member request rejected.' }
}

// ==========================================
// 5. COMMUNITY MEMBER MANAGEMENT (ADMIN/OWNER)
// ==========================================

export async function addCommunityMemberDirect(
  communityId: number,
  leetcodeUsername: string,
  displayName?: string,
  provider: ILeetCodeProvider = defaultProvider
): Promise<{ user: CommunityLeaderboardUser }> {
  const cleanUsername = leetcodeUsername.trim()
  if (!cleanUsername) {
    throw new AdminActionError('LeetCode username is required.', 'VALIDATION_ERROR', 400)
  }

  // 1. Fetch real stats from LeetCode
  let stats
  try {
    stats = await provider.fetchUserStats(cleanUsername)
  } catch (err: any) {
    if (err.name === 'UserNotFoundError') {
      throw new AdminActionError(
        `Cannot add: LeetCode profile '${cleanUsername}' does not exist.`,
        'USER_NOT_FOUND',
        400
      )
    }
    throw new AdminActionError(
      `Provider error validating profile: ${err.message}`,
      'PROVIDER_ERROR',
      502
    )
  }

  // 2. Check if already active member in this community
  const memberCheck = await query(
    `SELECT cm.id FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1 AND LOWER(u.leetcode_username) = LOWER($2) AND cm.archived_at IS NULL`,
    [communityId, stats.username]
  )
  if (memberCheck.rows.length > 0) {
    throw new AdminActionError(
      `User '${stats.username}' is already a member of this community.`,
      'USER_ALREADY_MEMBER',
      409
    )
  }

  // 3. Upsert canonical user
  const userRes = await query<CommunityLeaderboardUser>(
    `INSERT INTO users (
       leetcode_username, display_name, avatar_url,
       solved_total, solved_easy, solved_medium, solved_hard,
       contest_rating, contests_attended, fetch_status, last_refreshed_at, archived_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ok', NOW(), NULL)
     ON CONFLICT (leetcode_username) DO UPDATE
     SET 
       avatar_url = EXCLUDED.avatar_url,
       solved_total = EXCLUDED.solved_total,
       solved_easy = EXCLUDED.solved_easy,
       solved_medium = EXCLUDED.solved_medium,
       solved_hard = EXCLUDED.solved_hard,
       contest_rating = EXCLUDED.contest_rating,
       contests_attended = EXCLUDED.contests_attended,
       fetch_status = 'ok',
       last_refreshed_at = NOW(),
       archived_at = NULL
     RETURNING *`,
    [
      stats.username,
      displayName?.trim() || stats.displayName,
      stats.avatarUrl,
      stats.solvedTotal,
      stats.solvedEasy,
      stats.solvedMedium,
      stats.solvedHard,
      stats.contestRating,
      stats.contestsAttended,
    ]
  )
  const user = userRes.rows[0]

  // 4. Link into community_members
  const existingMem = await query(
    `SELECT id, archived_at FROM community_members WHERE community_id = $1 AND user_id = $2`,
    [communityId, user.id]
  )
  if (existingMem.rows.length > 0) {
    if (existingMem.rows[0].archived_at) {
      await query(
        `UPDATE community_members SET archived_at = NULL, role = 'member' WHERE id = $1`,
        [existingMem.rows[0].id]
      )
    }
  } else {
    await query(
      `INSERT INTO community_members (community_id, user_id, role, joined_at, archived_at)
       VALUES ($1, $2, 'member', NOW(), NULL)`,
      [communityId, user.id]
    )
  }

  return { user }
}

export async function removeCommunityMember(
  communityId: number,
  userId: number
): Promise<{ message: string }> {
  const res = await query(
    `UPDATE community_members
     SET archived_at = NOW()
     WHERE community_id = $1 AND user_id = $2 AND archived_at IS NULL
     RETURNING id`,
    [communityId, userId]
  )

  if (res.rows.length === 0) {
    throw new AdminActionError('Member not found in this community.', 'MEMBER_NOT_FOUND', 404)
  }

  return { message: 'Member removed from community.' }
}

export async function refreshCommunityMember(
  communityId: number,
  userId: number,
  provider: ILeetCodeProvider = defaultProvider
): Promise<{ message: string }> {
  // Confirm membership
  const memCheck = await query(
    `SELECT u.leetcode_username 
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1 AND cm.user_id = $2 AND cm.archived_at IS NULL`,
    [communityId, userId]
  )
  if (memCheck.rows.length === 0) {
    throw new AdminActionError('User is not a member of this community.', 'MEMBER_NOT_FOUND', 404)
  }

  const username = memCheck.rows[0].leetcode_username
  const success = await syncUserStats(username, provider)
  if (!success) {
    throw new AdminActionError(
      `Refresh failed for '${username}'. Previous statistics preserved.`,
      'REFRESH_FAILED',
      502
    )
  }

  return { message: `Statistics refreshed for '${username}'.` }
}

// ==========================================
// 6. ALL COMMUNITIES (PLATFORM ADMIN MANAGEMENT)
// ==========================================

export async function getAllCommunitiesForAdmin(): Promise<CommunityRecord[]> {
  const sql = `
    SELECT 
      c.id, c.name, c.slug, c.description, c.owner_id,
      a.username as owner_username,
      c.refresh_interval_hours, c.refresh_concurrency, c.status,
      c.created_at, c.updated_at, c.archived_at,
      COUNT(cm.id)::int as member_count
    FROM communities c
    LEFT JOIN admin_users a ON a.id = c.owner_id
    LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.archived_at IS NULL
    WHERE c.archived_at IS NULL
    GROUP BY c.id, a.username
    ORDER BY c.created_at ASC
  `
  const res = await query<CommunityRecord>(sql)
  return res.rows
}

export async function updateCommunity(
  communityId: number,
  data: {
    name?: string
    description?: string
    refresh_interval_hours?: number
    refresh_concurrency?: number
  }
): Promise<CommunityRecord> {
  const fields: string[] = []
  const values: any[] = []

  if (data.name !== undefined) {
    values.push(data.name.trim())
    fields.push(`name = $${values.length}`)
    const slug = slugify(data.name)
    values.push(slug)
    fields.push(`slug = $${values.length}`)
  }

  if (data.description !== undefined) {
    values.push(data.description.trim() || null)
    fields.push(`description = $${values.length}`)
  }

  if (data.refresh_interval_hours !== undefined) {
    const hours = Math.max(1, Number(data.refresh_interval_hours) || 6)
    values.push(hours)
    fields.push(`refresh_interval_hours = $${values.length}`)
  }

  if (data.refresh_concurrency !== undefined) {
    const conc = Math.max(1, Math.min(5, Number(data.refresh_concurrency) || 3))
    values.push(conc)
    fields.push(`refresh_concurrency = $${values.length}`)
  }

  if (fields.length === 0) {
    throw new AdminActionError('No fields provided to update.', 'VALIDATION_ERROR', 400)
  }

  fields.push(`updated_at = NOW()`)
  values.push(communityId)
  const idIdx = values.length

  const res = await query<CommunityRecord>(
    `UPDATE communities SET ${fields.join(', ')} WHERE id = $${idIdx} AND archived_at IS NULL RETURNING *`,
    values
  )

  if (res.rows.length === 0) {
    throw new AdminActionError('Community not found.', 'COMMUNITY_NOT_FOUND', 404)
  }

  return res.rows[0]
}

export async function archiveCommunity(communityId: number): Promise<{ message: string }> {
  const res = await query(
    `UPDATE communities SET archived_at = NOW(), status = 'archived' WHERE id = $1 AND archived_at IS NULL RETURNING id`,
    [communityId]
  )

  if (res.rows.length === 0) {
    throw new AdminActionError('Community not found.', 'COMMUNITY_NOT_FOUND', 404)
  }

  return { message: 'Community archived successfully.' }
}
