import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/client'

const JWT_SECRET = process.env.JWT_SECRET || 'leetcode_leaderboard_super_secret_jwt_key_2026_dev'

export type AdminRole = 'platform_admin' | 'community_owner' | 'community_moderator'

export interface AdminPayload {
  id: number
  username: string
  role: AdminRole
  community_id?: number | null
}

export async function verifyAdminCredentials(
  identifier: string,
  plainPassword: string
): Promise<AdminPayload | null> {
  const cleanId = identifier.trim().toLowerCase()
  if (!cleanId || !plainPassword) return null

  // Lookup admin by username or email (case-insensitive)
  const result = await query(
    `SELECT id, username, email, password_hash, role, community_id
     FROM admin_users
     WHERE LOWER(username) = $1 OR LOWER(email) = $1
     LIMIT 1`,
    [cleanId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const admin = result.rows[0]
  const isValid = await bcrypt.compare(plainPassword, admin.password_hash)
  if (!isValid) {
    return null
  }

  // Update last_login_at
  await query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [admin.id])

  return {
    id: admin.id,
    username: admin.username,
    role: admin.role || 'platform_admin',
    community_id: admin.community_id || null,
  }
}

export function generateAdminToken(admin: AdminPayload): string {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: admin.role || 'platform_admin',
      community_id: admin.community_id || null,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload
    if (decoded && typeof decoded.id === 'number' && typeof decoded.username === 'string') {
      return {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'platform_admin',
        community_id: decoded.community_id || null,
      }
    }
    return null
  } catch {
    return null
  }
}

