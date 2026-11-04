import bcrypt from 'bcryptjs'
import { query, pool } from '../db/client'
import { syncUserStats } from './sync.service'
import {
  LeetCodeGraphQLProvider,
  UserNotFoundError,
} from '../providers/leetcode.graphql.provider'
import type { ILeetCodeProvider } from '../providers/ILeetCodeProvider'
import type { RankingMetric } from './leaderboard.service'
import type { AdminPayload } from './auth.service'

const defaultProvider: ILeetCodeProvider = new LeetCodeGraphQLProvider()

export class AdminActionError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message)
    this.name = 'AdminActionError'
  }
}

// 1. List Approved Users
export async function getAdminUsers(params: {
  metric?: RankingMetric
  order?: 'asc' | 'desc'
  search?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 25))
  const offset = (page - 1) * limit
  const search = params.search?.trim().toLowerCase() || ''
  const metric = params.metric || 'solved_total'

  let orderByClause = ''
  switch (metric) {
    case 'contest_rating':
      orderByClause = `ORDER BY contest_rating DESC NULLS LAST, solved_total DESC NULLS LAST, leetcode_username ASC`
      break
    case 'contests_attended':
      orderByClause = `ORDER BY contests_attended DESC NULLS LAST, contest_rating DESC NULLS LAST, leetcode_username ASC`
      break
    case 'solved_total':
    default:
      orderByClause = `ORDER BY solved_total DESC NULLS LAST, contest_rating DESC NULLS LAST, leetcode_username ASC`
      break
  }

  const whereConditions = ['archived_at IS NULL']
  const queryParams: any[] = []

  if (search) {
    queryParams.push(`%${search}%`)
    const paramIndex = queryParams.length
    whereConditions.push(
      `(LOWER(leetcode_username) LIKE $${paramIndex} OR LOWER(COALESCE(display_name, '')) LIKE $${paramIndex})`
    )
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`

  const countRes = await query(`SELECT COUNT(*) as total FROM users ${whereClause}`, queryParams)
  const total = parseInt(countRes.rows[0].total, 10)
  const total_pages = Math.max(1, Math.ceil(total / limit))

  const rowsRes = await query(
    `SELECT
       id,
       leetcode_username,
       display_name,
       avatar_url,
       solved_total,
       solved_easy,
       solved_medium,
       solved_hard,
       contest_rating,
       contests_attended,
       fetch_status,
       last_refreshed_at,
       created_at
     FROM users
     ${whereClause}
     ${orderByClause}
     LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
    [...queryParams, limit, offset]
  )

  return {
    users: rowsRes.rows.map((row) => ({
      ...row,
      contest_rating: row.contest_rating !== null ? parseFloat(row.contest_rating) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      total_pages,
    },
  }
}

// 2. Manually Add an Approved User (Validates on LeetCode first)
export async function addAdminUser(
  data: { leetcode_username: string; display_name?: string },
  provider: ILeetCodeProvider = defaultProvider
) {
  const username = data.leetcode_username.trim()
  const displayName = data.display_name?.trim() || null

  if (!username) {
    throw new AdminActionError('LeetCode username is required.', 'VALIDATION_ERROR', 400)
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{1,30}$/
  if (!usernameRegex.test(username)) {
    throw new AdminActionError(
      'Username must be between 1 and 30 characters and only contain letters, numbers, underscores, or hyphens.',
      'VALIDATION_ERROR',
      400
    )
  }

  // Check if active user already exists
  const existing = await query(
    `SELECT id FROM users WHERE LOWER(leetcode_username) = LOWER($1) AND archived_at IS NULL`,
    [username]
  )
  if (existing.rows.length > 0) {
    throw new AdminActionError('This username is already on the leaderboard.', 'USER_ALREADY_APPROVED', 409)
  }

  // Fetch real statistics from LeetCode provider before approving
  let stats
  try {
    stats = await provider.fetchUserStats(username)
  } catch (err: any) {
    if (err instanceof UserNotFoundError) {
      throw new AdminActionError(`LeetCode user '${username}' not found.`, 'USER_NOT_FOUND', 400)
    }
    throw new AdminActionError(
      `Failed to validate LeetCode user: ${err.message || 'Provider error'}`,
      'PROVIDER_ERROR',
      502
    )
  }

  // Insert or unarchive user with real fetched statistics
  const insertRes = await query(
    `INSERT INTO users (
       leetcode_username, display_name, avatar_url,
       solved_total, solved_easy, solved_medium, solved_hard,
       contest_rating, contests_attended,
       fetch_status, last_refreshed_at, archived_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ok', NOW(), NULL, NOW(), NOW())
     ON CONFLICT (leetcode_username) DO UPDATE
     SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         solved_total = EXCLUDED.solved_total,
         solved_easy = EXCLUDED.solved_easy,
         solved_medium = EXCLUDED.solved_medium,
         solved_hard = EXCLUDED.solved_hard,
         contest_rating = EXCLUDED.contest_rating,
         contests_attended = EXCLUDED.contests_attended,
         fetch_status = 'ok',
         last_refreshed_at = NOW(),
         archived_at = NULL,
         updated_at = NOW()
     RETURNING id, leetcode_username, display_name, fetch_status`,
    [
      username,
      displayName || stats.displayName,
      stats.avatarUrl,
      stats.solvedTotal,
      stats.solvedEasy,
      stats.solvedMedium,
      stats.solvedHard,
      stats.contestRating,
      stats.contestsAttended,
    ]
  )

  return insertRes.rows[0]
}

// 3. Remove (Archive) User
export async function archiveAdminUser(id: number) {
  const result = await query(
    `UPDATE users
     SET archived_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND archived_at IS NULL
     RETURNING id, leetcode_username`,
    [id]
  )

  if (result.rows.length === 0) {
    throw new AdminActionError('User not found or already archived.', 'USER_NOT_FOUND', 404)
  }

  return { message: 'User archived.' }
}

// 4. Refresh Single User
export async function refreshAdminUser(
  id: number,
  provider: ILeetCodeProvider = defaultProvider
) {
  const userRes = await query(
    `SELECT leetcode_username FROM users WHERE id = $1 AND archived_at IS NULL`,
    [id]
  )
  if (userRes.rows.length === 0) {
    throw new AdminActionError('User not found.', 'USER_NOT_FOUND', 404)
  }

  const username = userRes.rows[0].leetcode_username
  const success = await syncUserStats(username, provider)
  if (!success) {
    throw new AdminActionError('Failed to refresh user statistics from provider.', 'REFRESH_FAILED', 502)
  }

  return { message: 'Refresh complete.' }
}

// 5. List Pending Requests
export async function getAdminRequests(
  params: { page?: number; limit?: number; community_id?: number; community_slug?: string },
  adminUser?: AdminPayload
) {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 25))
  const offset = (page - 1) * limit

  const whereConditions: string[] = []
  const queryParams: any[] = []

  // Role scoping: community owner only sees their own community
  if (adminUser && adminUser.role !== 'platform_admin' && adminUser.community_id) {
    queryParams.push(adminUser.community_id)
    whereConditions.push(`community_id = $${queryParams.length}`)
  } else if (params.community_id) {
    queryParams.push(params.community_id)
    whereConditions.push(`community_id = $${queryParams.length}`)
  } else if (params.community_slug) {
    queryParams.push(params.community_slug.toLowerCase())
    whereConditions.push(`LOWER(community_slug) = $${queryParams.length}`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  const countQuery = `
    WITH all_reqs AS (
      SELECT 
        cmr.id,
        cmr.leetcode_username,
        cmr.display_name,
        cmr.status,
        cmr.requested_at,
        cmr.community_id,
        c.name as community_name,
        c.slug as community_slug
      FROM community_member_requests cmr
      LEFT JOIN communities c ON c.id = cmr.community_id
      WHERE cmr.status = 'pending'

      UNION ALL

      SELECT
        jr.id,
        jr.leetcode_username,
        jr.display_name,
        jr.status,
        jr.requested_at,
        1 as community_id,
        'JoyBoys' as community_name,
        'joyboys' as community_slug
      FROM join_requests jr
      WHERE jr.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM community_member_requests cmr2 
          WHERE cmr2.community_id = 1 
            AND cmr2.status = 'pending'
            AND LOWER(cmr2.leetcode_username) = LOWER(jr.leetcode_username)
        )
    )
    SELECT COUNT(*) as total FROM all_reqs ${whereClause}
  `

  const countRes = await query(countQuery, queryParams)
  const total = parseInt(countRes.rows[0].total, 10)
  const total_pages = Math.max(1, Math.ceil(total / limit))

  const selectQueryParams = [...queryParams, limit, offset]
  const limitParamIdx = queryParams.length + 1
  const offsetParamIdx = queryParams.length + 2

  const selectQuery = `
    WITH all_reqs AS (
      SELECT 
        cmr.id,
        cmr.leetcode_username,
        cmr.display_name,
        cmr.status,
        cmr.requested_at,
        cmr.community_id,
        c.name as community_name,
        c.slug as community_slug
      FROM community_member_requests cmr
      LEFT JOIN communities c ON c.id = cmr.community_id
      WHERE cmr.status = 'pending'

      UNION ALL

      SELECT
        jr.id,
        jr.leetcode_username,
        jr.display_name,
        jr.status,
        jr.requested_at,
        1 as community_id,
        'JoyBoys' as community_name,
        'joyboys' as community_slug
      FROM join_requests jr
      WHERE jr.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM community_member_requests cmr2 
          WHERE cmr2.community_id = 1 
            AND cmr2.status = 'pending'
            AND LOWER(cmr2.leetcode_username) = LOWER(jr.leetcode_username)
        )
    )
    SELECT id, leetcode_username, display_name, status, requested_at, community_id, community_name, community_slug
    FROM all_reqs
    ${whereClause}
    ORDER BY requested_at ASC
    LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
  `

  const rowsRes = await query(selectQuery, selectQueryParams)

  return {
    requests: rowsRes.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages,
    },
  }
}

// 6. Get Pending Requests Count (Badge)
export async function getAdminRequestsCount(adminUser?: AdminPayload) {
  const whereConditions: string[] = []
  const queryParams: any[] = []

  if (adminUser && adminUser.role !== 'platform_admin' && adminUser.community_id) {
    queryParams.push(adminUser.community_id)
    whereConditions.push(`community_id = $${queryParams.length}`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  const countQuery = `
    WITH all_reqs AS (
      SELECT 
        cmr.id,
        cmr.community_id
      FROM community_member_requests cmr
      WHERE cmr.status = 'pending'

      UNION ALL

      SELECT
        jr.id,
        1 as community_id
      FROM join_requests jr
      WHERE jr.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM community_member_requests cmr2 
          WHERE cmr2.community_id = 1 
            AND cmr2.status = 'pending'
            AND LOWER(cmr2.leetcode_username) = LOWER(jr.leetcode_username)
        )
    )
    SELECT COUNT(*) as count FROM all_reqs ${whereClause}
  `

  const res = await query(countQuery, queryParams)
  return {
    count: parseInt(res.rows[0].count, 10),
  }
}

// 7. Approve Request (Transaction-safe & validates on LeetCode)
export async function approveAdminRequest(
  requestId: number,
  provider: ILeetCodeProvider = defaultProvider,
  reviewerId?: number
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Try finding in community_member_requests
    let reqRes = await client.query(
      `SELECT id, community_id, leetcode_username, display_name, status
       FROM community_member_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    )
    let isCommunityMemberReq = true

    // 2. If not found, try join_requests
    if (reqRes.rows.length === 0) {
      reqRes = await client.query(
        `SELECT id, 1 as community_id, leetcode_username, display_name, status
         FROM join_requests
         WHERE id = $1
         FOR UPDATE`,
        [requestId]
      )
      isCommunityMemberReq = false
    }

    if (reqRes.rows.length === 0) {
      throw new AdminActionError('Join request not found.', 'REQUEST_NOT_FOUND', 404)
    }

    const request = reqRes.rows[0]
    if (request.status !== 'pending') {
      throw new AdminActionError(
        `Request is already ${request.status}.`,
        'REQUEST_ALREADY_PROCESSED',
        409
      )
    }

    const targetCommunityId = request.community_id || 1

    // Check if user already exists
    let userId: number
    const userCheck = await client.query(
      `SELECT id FROM users WHERE LOWER(leetcode_username) = LOWER($1) AND archived_at IS NULL`,
      [request.leetcode_username]
    )

    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id
    } else {
      // Validate with LeetCode provider before committing approval
      let stats
      try {
        stats = await provider.fetchUserStats(request.leetcode_username)
      } catch (err: any) {
        if (err instanceof UserNotFoundError || err.name === 'UserNotFoundError') {
          throw new AdminActionError(
            `Cannot approve: LeetCode profile '${request.leetcode_username}' does not exist.`,
            'USER_NOT_FOUND',
            400
          )
        }
        throw new AdminActionError(
          `Cannot approve: Failed to fetch LeetCode data (${err.message || 'Provider error'}).`,
          'PROVIDER_ERROR',
          502
        )
      }

      // Insert user with real statistics
      const insertRes = await client.query(
        `INSERT INTO users (
           leetcode_username, display_name, avatar_url,
           solved_total, solved_easy, solved_medium, solved_hard,
           contest_rating, contests_attended,
           fetch_status, last_refreshed_at, archived_at, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ok', NOW(), NULL, NOW(), NOW())
         ON CONFLICT (leetcode_username) DO UPDATE
         SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
             solved_total = EXCLUDED.solved_total,
             solved_easy = EXCLUDED.solved_easy,
             solved_medium = EXCLUDED.solved_medium,
             solved_hard = EXCLUDED.solved_hard,
             contest_rating = EXCLUDED.contest_rating,
             contests_attended = EXCLUDED.contests_attended,
             fetch_status = 'ok',
             last_refreshed_at = NOW(),
             archived_at = NULL,
             updated_at = NOW()
         RETURNING id, leetcode_username`,
        [
          request.leetcode_username,
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
      userId = insertRes.rows[0].id
    }

    // Ensure member is in community_members for target community
    const memCheck = await client.query(
      `SELECT id, archived_at FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [targetCommunityId, userId]
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
        [targetCommunityId, userId]
      )
    }

    // Update status to approved in both tables
    if (isCommunityMemberReq) {
      await client.query(
        `UPDATE community_member_requests
         SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
         WHERE id = $2`,
        [reviewerId || null, requestId]
      )
      await client.query(
        `UPDATE join_requests
         SET status = 'approved', reviewed_at = NOW()
         WHERE LOWER(leetcode_username) = LOWER($1) AND status = 'pending'`,
        [request.leetcode_username]
      )
    } else {
      await client.query(
        `UPDATE join_requests
         SET status = 'approved', reviewed_at = NOW()
         WHERE id = $1`,
        [requestId]
      )
      await client.query(
        `UPDATE community_member_requests
         SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
         WHERE community_id = $2 AND LOWER(leetcode_username) = LOWER($3) AND status = 'pending'`,
        [reviewerId || null, targetCommunityId, request.leetcode_username]
      )
    }

    await client.query('COMMIT')

    return {
      user: { id: userId, leetcode_username: request.leetcode_username },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// 8. Reject Request
export async function rejectAdminRequest(requestId: number, reason?: string, reviewerId?: number) {
  // 1. Try community_member_requests
  const res1 = await query(
    `UPDATE community_member_requests
     SET status = 'rejected',
         rejection_reason = $1,
         reviewed_at = NOW(),
         reviewed_by = $2
     WHERE id = $3 AND status = 'pending'
     RETURNING id, leetcode_username, status`,
    [reason?.trim() || null, reviewerId || null, requestId]
  )

  if (res1.rows.length > 0) {
    await query(
      `UPDATE join_requests
       SET status = 'rejected', rejection_reason = $1, reviewed_at = NOW()
       WHERE LOWER(leetcode_username) = LOWER($2) AND status = 'pending'`,
      [reason?.trim() || null, res1.rows[0].leetcode_username]
    )
    return { message: 'Request rejected.' }
  }

  // 2. Try join_requests
  const res2 = await query(
    `UPDATE join_requests
     SET status = 'rejected',
         rejection_reason = $1,
         reviewed_at = NOW()
     WHERE id = $2 AND status = 'pending'
     RETURNING id, leetcode_username, status`,
    [reason?.trim() || null, requestId]
  )

  if (res2.rows.length > 0) {
    await query(
      `UPDATE community_member_requests
       SET status = 'rejected', rejection_reason = $1, reviewed_at = NOW(), reviewed_by = $2
       WHERE LOWER(leetcode_username) = LOWER($3) AND status = 'pending'`,
      [reason?.trim() || null, reviewerId || null, res2.rows[0].leetcode_username]
    )
    return { message: 'Request rejected.' }
  }

  // If neither updated, check if it exists in either table
  const check1 = await query(`SELECT status FROM community_member_requests WHERE id = $1`, [requestId])
  const check2 = await query(`SELECT status FROM join_requests WHERE id = $1`, [requestId])

  if (check1.rows.length === 0 && check2.rows.length === 0) {
    throw new AdminActionError('Join request not found.', 'REQUEST_NOT_FOUND', 404)
  }
  throw new AdminActionError('Request has already been processed.', 'REQUEST_ALREADY_PROCESSED', 409)
}

// 9. Get Settings
export async function getAdminSettings() {
  const res = await query(
    `SELECT refresh_interval_hours, refresh_concurrency
     FROM app_settings
     WHERE id = 1`
  )
  if (res.rows.length === 0) {
    return { refresh_interval_hours: 6, refresh_concurrency: 3 }
  }
  return {
    refresh_interval_hours: res.rows[0].refresh_interval_hours,
    refresh_concurrency: res.rows[0].refresh_concurrency,
  }
}

// 10. Update Settings
export async function updateAdminSettings(
  data: { refresh_interval_hours?: number; refresh_concurrency?: number },
  adminId: number
) {
  const interval = data.refresh_interval_hours
  const concurrency = data.refresh_concurrency

  if (interval !== undefined && (typeof interval !== 'number' || interval < 1 || interval > 168)) {
    throw new AdminActionError('Refresh interval must be between 1 and 168 hours.', 'VALIDATION_ERROR', 400)
  }

  if (concurrency !== undefined && (typeof concurrency !== 'number' || concurrency < 1 || concurrency > 10)) {
    throw new AdminActionError('Concurrency limit must be between 1 and 10.', 'VALIDATION_ERROR', 400)
  }

  const current = await getAdminSettings()
  const newInterval = interval ?? current.refresh_interval_hours
  const newConcurrency = concurrency ?? current.refresh_concurrency

  await query(
    `UPDATE app_settings
     SET refresh_interval_hours = $1,
         refresh_concurrency = $2,
         updated_by = $3,
         updated_at = NOW()
     WHERE id = 1`,
    [newInterval, newConcurrency, adminId]
  )

  return {
    refresh_interval_hours: newInterval,
    refresh_concurrency: newConcurrency,
  }
}

// 11. Change Password
export async function changeAdminPassword(
  adminId: number,
  currentPassword: string,
  newPassword: string
) {
  if (!currentPassword) {
    throw new AdminActionError('Current password is required.', 'VALIDATION_ERROR', 400)
  }
  if (!newPassword || newPassword.length < 12) {
    throw new AdminActionError('New password must be at least 12 characters long.', 'VALIDATION_ERROR', 400)
  }

  const res = await query(`SELECT password_hash FROM admin_users WHERE id = $1`, [adminId])
  if (res.rows.length === 0) {
    throw new AdminActionError('Administrator account not found.', 'UNAUTHORIZED', 401)
  }

  const valid = await bcrypt.compare(currentPassword, res.rows[0].password_hash)
  if (!valid) {
    throw new AdminActionError('Current password incorrect.', 'INVALID_PASSWORD', 401)
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await query(
    `UPDATE admin_users
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2`,
    [newHash, adminId]
  )

  return { message: 'Password updated.' }
}

// 12. Trigger Refresh for All Users
export async function refreshAllAdminUsers(provider: ILeetCodeProvider = defaultProvider) {
  const usersRes = await query(
    `SELECT leetcode_username FROM users WHERE archived_at IS NULL`
  )
  const usernames = usersRes.rows.map((r) => r.leetcode_username)

  // Asynchronously execute refresh in background
  Promise.resolve().then(async () => {
    for (const username of usernames) {
      try {
        await syncUserStats(username, provider)
      } catch (e) {
        console.error(`[Background Refresh] Error syncing ${username}:`, e)
      }
    }
  })

  return { message: 'Full refresh queued for all users.' }
}

