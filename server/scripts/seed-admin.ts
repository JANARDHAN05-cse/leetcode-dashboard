import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { query, pool } from '../src/db/client'

dotenv.config()

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!'

  console.log(`[Seed Admin] Initializing administrator account '${username}' (${email})...`)

  try {
    // Hash password with bcrypt cost factor >= 12
    const passwordHash = await bcrypt.hash(password, 12)

    await query(
      `INSERT INTO admin_users (username, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           email = EXCLUDED.email,
           updated_at = NOW()`,
      [username, email, passwordHash]
    )

    console.log(`[Seed Admin] Administrator account '${username}' successfully seeded.`)
  } catch (err) {
    console.error('[Seed Admin] Error seeding administrator:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedAdmin()

