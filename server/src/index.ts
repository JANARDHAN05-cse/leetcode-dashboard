import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'

import { publicUsersRouter } from './routes/public/users.route'
import { publicRequestsRouter } from './routes/public/requests.route'
import { publicCommunitiesRouter } from './routes/public/communities.route'
import { authRouter } from './routes/auth/auth.route'
import { adminRouter } from './routes/admin/admin.route'
import { adminCommunitiesRouter } from './routes/admin/admin-communities.route'
import { requireAdmin } from './middleware/auth.middleware'
import { publicRateLimiter } from './middleware/rate-limit.middleware'
import { errorHandler } from './middleware/error.middleware'
import { pool } from './db/client'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 1. Security & Core Middleware
app.use(helmet())
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

// 2. Health & Diagnostic Check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (err: any) {
    res.status(500).json({ status: 'db_error', message: err.message })
  }
})

// 3. API Routes
app.use('/api', publicRateLimiter)
app.use('/api/communities', publicCommunitiesRouter)
app.use('/api/users', publicUsersRouter)
app.use('/api/requests', publicRequestsRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin/communities', requireAdmin, adminCommunitiesRouter)
app.use('/api/admin', requireAdmin, adminRouter)

// 4. Centralized Error Handler
app.use(errorHandler)

// 5. Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Server] LeetCode Leaderboard API running on http://localhost:${PORT}`)
  })
}

export default app

