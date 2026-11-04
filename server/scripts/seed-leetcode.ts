import { query, pool } from '../src/db/client'
import { syncUserStats } from '../src/services/sync.service'
import { LeetCodeGraphQLProvider } from '../src/providers/leetcode.graphql.provider'

const INITIAL_PROFILES = [
  'lee215',
  'neal_wu',
  'tourist',
  'awice',
  'yosupo',
  'bqi343',
]

async function seedRealLeetCodeData() {
  console.log('[Seed] Starting real LeetCode profile synchronization...')
  const provider = new LeetCodeGraphQLProvider({ delayMs: 600 })

  for (const username of INITIAL_PROFILES) {
    console.log(`\n--------------------------------------------------`)
    console.log(`[Seed] Processing real profile: ${username}`)

    // 1. Ensure user row exists in database
    await query(
      `INSERT INTO users (leetcode_username, fetch_status)
       VALUES ($1, 'pending')
       ON CONFLICT (leetcode_username) DO NOTHING`,
      [username]
    )

    // 2. Fetch and synchronize live statistics from LeetCode GraphQL
    const success = await syncUserStats(username, provider)

    if (success) {
      // 3. Query the saved row to inspect and verify stored stats
      const res = await query(
        `SELECT
           leetcode_username,
           display_name,
           solved_total,
           solved_easy,
           solved_medium,
           solved_hard,
           contest_rating,
           contests_attended,
           fetch_status,
           last_refreshed_at
         FROM users WHERE leetcode_username = $1`,
        [username]
      )
      console.log(`[Seed] Successfully synchronized '${username}':`, res.rows[0])
    } else {
      console.warn(`[Seed] Failed to synchronize '${username}'. Retained as pending/error.`)
    }
  }

  console.log(`\n==================================================`)
  console.log('[Seed] Live LeetCode synchronization complete.')
  await pool.end()
}

seedRealLeetCodeData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Seed Error]:', err)
    process.exit(1)
  })

