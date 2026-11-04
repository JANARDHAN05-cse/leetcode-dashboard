import { query, pool } from '../src/db/client'

async function check() {
  const comms = await query('SELECT * FROM communities')
  console.log('COMMUNITIES:', comms.rows)
  const mems = await query(`
    SELECT cm.id, cm.community_id, u.leetcode_username, cm.role 
    FROM community_members cm 
    JOIN users u ON u.id = cm.user_id
    ORDER BY u.leetcode_username
  `)
  console.log('MEMBERS count:', mems.rows.length)
  console.log('MEMBERS:', mems.rows)
  const reqs = await query('SELECT * FROM community_member_requests')
  console.log('MEMBER REQUESTS count:', reqs.rows.length)
  await pool.end()
}

check().catch(console.error)

