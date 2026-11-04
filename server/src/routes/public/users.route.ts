import { Router, type Request, type Response, type NextFunction } from 'express'
import { getLeaderboardUsers, type RankingMetric } from '../../services/leaderboard.service'

export const publicUsersRouter = Router()

const ALLOWED_METRICS: RankingMetric[] = [
  'solved_total',
  'contest_rating',
  'contests_attended',
]

publicUsersRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sort, order, search, page, limit } = req.query

      if (sort && !ALLOWED_METRICS.includes(sort as RankingMetric)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid sort metric '${sort}'. Supported metrics are: ${ALLOWED_METRICS.join(', ')}.`,
          },
        })
      }

      const data = await getLeaderboardUsers({
        metric: (sort as RankingMetric) || 'solved_total',
        order: order === 'asc' ? 'asc' : 'desc',
        search: typeof search === 'string' ? search : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 25,
      })

      return res.status(200).json({
        success: true,
        data,
      })
    } catch (err) {
      next(err)
    }
  }
)

