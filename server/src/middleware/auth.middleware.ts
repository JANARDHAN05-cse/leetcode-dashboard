import type { Request, Response, NextFunction } from 'express'
import { verifyAdminToken, type AdminPayload } from '../services/auth.service'
import { query } from '../db/client'

// Extend Express Request type to include authenticated admin info
declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload
    }
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract token from HTTP-only cookie or Authorization header
  let token = req.cookies?.admin_token

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ')
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1]
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. No valid session found.',
      },
    })
  }

  const payload = verifyAdminToken(token)
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session.',
      },
    })
  }

  // Confirm admin user still exists in database
  const adminCheck = await query(
    `SELECT id, username, role, community_id FROM admin_users WHERE id = $1`,
    [payload.id]
  )
  if (adminCheck.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Administrator account no longer exists.',
      },
    })
  }

  const row = adminCheck.rows[0]
  req.admin = {
    id: payload.id,
    username: row.username,
    role: row.role || 'platform_admin',
    community_id: row.community_id || null,
  }

  next()
}

/**
 * Middleware: Requires platform_admin role.
 */
export function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
  }

  if (req.admin.role !== 'platform_admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Platform administrator privileges required.',
      },
    })
  }

  next()
}

/**
 * Middleware generator: Requires platform_admin OR community_owner of the target community.
 */
export function requireCommunityAccess(
  getCommunityIdOrSlug: (req: Request) => number | string | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      })
    }

    // Platform admin has universal access
    if (req.admin.role === 'platform_admin') {
      return next()
    }

    const param = getCommunityIdOrSlug(req)
    if (!param) {
      return res.status(400).json({
        success: false,
        error: { code: 'COMMUNITY_REQUIRED', message: 'Target community not specified.' },
      })
    }

    let targetCommunityId: number
    if (typeof param === 'number' || /^\d+$/.test(String(param))) {
      targetCommunityId = Number(param)
    } else {
      const commRes = await query(`SELECT id FROM communities WHERE slug = $1`, [param])
      if (commRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'COMMUNITY_NOT_FOUND', message: 'Community not found.' },
        })
      }
      targetCommunityId = commRes.rows[0].id
    }

    if (req.admin.community_id !== targetCommunityId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have administrative permission for this community.',
        },
      })
    }

    next()
  }
}

