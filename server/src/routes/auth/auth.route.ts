import { Router, type Request, type Response, type NextFunction } from 'express'
import {
  verifyAdminCredentials,
  generateAdminToken,
} from '../../services/auth.service'
import { requireAdmin } from '../../middleware/auth.middleware'
import { loginLimiter } from '../../middleware/rate-limit.middleware'

export const authRouter = Router()

// 1. Admin Login
authRouter.post(
  '/login',
  loginLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body || {}

      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials.',
          },
        })
      }

      const admin = await verifyAdminCredentials(username, password)
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials.',
          },
        })
      }

      const token = generateAdminToken(admin)

      // Set secure HTTP-only cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      return res.status(200).json({
        success: true,
        data: {
          admin: {
            id: admin.id,
            username: admin.username,
          },
          token, // Returned for programmatic client access
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// 2. Admin Logout
authRouter.post('/logout', requireAdmin, (req: Request, res: Response) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })

  return res.status(200).json({
    success: true,
    data: {
      message: 'Logged out.',
    },
  })
})

// 3. Verify Session (GET /api/auth/me)
authRouter.get('/me', requireAdmin, (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      admin: req.admin,
    },
  })
})

