import { query } from '../db/client'
import {
  LeetCodeGraphQLProvider,
  UserNotFoundError,
} from '../providers/leetcode.graphql.provider'
import type { ILeetCodeProvider } from '../providers/ILeetCodeProvider'

const defaultProvider: ILeetCodeProvider = new LeetCodeGraphQLProvider()

export async function syncUserStats(
  username: string,
  provider: ILeetCodeProvider = defaultProvider
): Promise<boolean> {
  const cleanUsername = username.trim()

  // 1. Mark fetch attempt
  await query(
    `UPDATE users
     SET last_attempted_at = NOW(),
         fetch_status = CASE WHEN fetch_status = 'pending' THEN 'fetching' ELSE fetch_status END
     WHERE leetcode_username = $1`,
    [cleanUsername]
  )

  try {
    const stats = await provider.fetchUserStats(cleanUsername)

    // 2. On success: update stats, set fetch_status='ok', last_refreshed_at=NOW()
    await query(
      `UPDATE users
       SET solved_total = $1,
           solved_easy = $2,
           solved_medium = $3,
           solved_hard = $4,
           contest_rating = $5,
           contests_attended = $6,
           avatar_url = COALESCE($7, avatar_url),
           display_name = COALESCE(display_name, $8),
           fetch_status = 'ok',
           last_refreshed_at = NOW(),
           last_error = NULL,
           updated_at = NOW()
       WHERE leetcode_username = $9`,
      [
        stats.solvedTotal,
        stats.solvedEasy,
        stats.solvedMedium,
        stats.solvedHard,
        stats.contestRating,
        stats.contestsAttended,
        stats.avatarUrl,
        stats.displayName,
        cleanUsername,
      ]
    )

    return true
  } catch (err: any) {
    if (err instanceof UserNotFoundError) {
      await query(
        `UPDATE users
         SET fetch_status = 'not_found',
             last_error = $1,
             updated_at = NOW()
         WHERE leetcode_username = $2`,
        [err.message, cleanUsername]
      )
    } else {
      // Temporary network error / timeout / rate limit:
      // CRITICAL: Preserve all previous statistics!
      await query(
        `UPDATE users
         SET fetch_status = 'error',
             last_error = $1,
             updated_at = NOW()
         WHERE leetcode_username = $2`,
        [err.message || 'Unknown provider error', cleanUsername]
      )
    }
    return false
  }
}

