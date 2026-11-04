import { query } from '../db/client'

export type RankingMetric =
  | 'solved_total'
  | 'contest_rating'
  | 'contests_attended'

export interface LeaderboardParams {
  metric?: RankingMetric
  order?: 'asc' | 'desc'
  search?: string
  page?: number
  limit?: number
}

export async function getLeaderboardUsers(params: LeaderboardParams) {
  const metric = params.metric || 'solved_total'
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 25))
  const offset = (page - 1) * limit
  const search = params.search?.trim().toLowerCase() || ''

  // Deterministic tie-breaking rules per specification:
  // - Problems Solved tie -> Contest Rating DESC, then username ASC
  // - Contest Rating tie -> Problems Solved DESC, then username ASC
  // - Contests Attended tie -> Contest Rating DESC, then username ASC
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

  const whereConditions: string[] = ['archived_at IS NULL']
  const queryParams: any[] = []

  if (search) {
    queryParams.push(`%${search}%`)
    const paramIndex = queryParams.length
    whereConditions.push(
      `(LOWER(leetcode_username) LIKE $${paramIndex} OR LOWER(COALESCE(display_name, '')) LIKE $${paramIndex})`
    )
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`

  // Count total matching
  const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`
  const countResult = await query(countSql, queryParams)
  const total = parseInt(countResult.rows[0].total, 10)
  const total_pages = Math.max(1, Math.ceil(total / limit))

  // Fetch paginated rows (last_error is omitted for security/cleanliness)
  const rowsSql = `
    SELECT
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
      last_refreshed_at
    FROM users
    ${whereClause}
    ${orderByClause}
    LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
  `

  const rowsResult = await query(rowsSql, [...queryParams, limit, offset])

  return {
    users: rowsResult.rows.map((row) => ({
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

