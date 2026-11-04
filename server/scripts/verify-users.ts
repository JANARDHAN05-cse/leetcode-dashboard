import { query, pool } from '../src/db/client'

async function main() {
  try {
    // 1. Inspect actual column names in users table
    const colCheck = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `)
    const columns = colCheck.rows.map((r: { column_name: string }) => r.column_name)
    const hasUsernameCol = columns.includes('username')
    const userCol = hasUsernameCol ? 'username' : 'leetcode_username'

    console.log(`[Info] Table 'users' column used for username: '${userCol}'`)

    // 2. Execute query as requested by user
    // We alias leetcode_username AS username if the column is leetcode_username
    const sql = `
      SELECT
        ${userCol} AS username,
        display_name,
        solved_total,
        solved_easy,
        solved_medium,
        solved_hard,
        contest_rating,
        contests_attended
      FROM users
      ORDER BY ${userCol} ASC
    `
    const result = await query(sql)

    console.log('\n================ DATABASE RECORDS (users) ================')
    console.table(result.rows)
    console.log('Total profiles in database:', result.rows.length)
    console.log('==========================================================\n')
  } catch (err) {
    console.error('[Error querying database]:', err)
  } finally {
    await pool.end()
  }
}

main()

