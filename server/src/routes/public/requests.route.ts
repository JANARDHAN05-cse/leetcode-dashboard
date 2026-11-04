import { Router, type Request, type Response, type NextFunction } from 'express'
import { createJoinRequest } from '../../services/request.service'
import { requestSubmissionLimiter } from '../../middleware/rate-limit.middleware'

export const publicRequestsRouter = Router()

publicRequestsRouter.post(
  '/',
  requestSubmissionLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leetcode_username, display_name } = req.body || {}
      const result = await createJoinRequest({
        leetcode_username,
        display_name,
      })

      return res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
)

