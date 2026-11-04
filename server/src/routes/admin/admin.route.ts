import { Router, type Request, type Response, type NextFunction } from 'express'
import {
  getAdminUsers,
  addAdminUser,
  archiveAdminUser,
  refreshAdminUser,
  getAdminRequests,
  getAdminRequestsCount,
  approveAdminRequest,
  rejectAdminRequest,
  getAdminSettings,
  updateAdminSettings,
  changeAdminPassword,
} from '../../services/admin.service'
import {
  startRefreshAllJob,
  getRefreshJobStatus,
} from '../../services/refresh-job.service'
import type { RankingMetric } from '../../services/leaderboard.service'

export const adminRouter = Router()

// 1. Approved Users
adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sort, order, search, page, limit } = req.query
    const result = await getAdminUsers({
      metric: sort as RankingMetric,
      order: order === 'asc' ? 'asc' : 'desc',
      search: typeof search === 'string' ? search : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
    })
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leetcode_username, display_name } = req.body || {}
    const user = await addAdminUser({ leetcode_username, display_name })
    return res.status(201).json({ success: true, data: { user } })
  } catch (err) {
    next(err)
  }
})

adminRouter.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10)
    const result = await archiveAdminUser(id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/users/:id/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10)
    const result = await refreshAdminUser(id)
    return res.status(202).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// 2. Pending Requests
adminRouter.get('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, community_id, community_slug } = req.query
    const result = await getAdminRequests(
      {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 25,
        community_id: community_id ? parseInt(community_id as string, 10) : undefined,
        community_slug: community_slug as string | undefined,
      },
      req.admin
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.get('/requests/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAdminRequestsCount(req.admin)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/requests/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10)
    const result = await approveAdminRequest(id, undefined, req.admin?.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/requests/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { rejection_reason } = req.body || {}
    const result = await rejectAdminRequest(id, rejection_reason, req.admin?.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// 3. Refresh All & Status
adminRouter.post('/refresh-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await startRefreshAllJob()
    return res.status(202).json({ success: true, data: job })
  } catch (err) {
    next(err)
  }
})

adminRouter.get('/refresh-all/status', (req: Request, res: Response) => {
  const status = getRefreshJobStatus()
  return res.status(200).json({ success: true, data: status })
})

// 4. Settings
adminRouter.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAdminSettings()
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_interval_hours, refresh_concurrency } = req.body || {}
    const result = await updateAdminSettings(
      { refresh_interval_hours, refresh_concurrency },
      req.admin!.id
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

adminRouter.post('/settings/refresh-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await startRefreshAllJob()
    return res.status(202).json({ success: true, data: job })
  } catch (err) {
    next(err)
  }
})

adminRouter.put('/settings/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { current_password, new_password } = req.body || {}
    const result = await changeAdminPassword(req.admin!.id, current_password, new_password)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

