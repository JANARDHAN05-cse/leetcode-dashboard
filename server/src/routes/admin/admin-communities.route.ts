import { Router, type Request, type Response, type NextFunction } from 'express'
import {
  getAllCommunitiesForAdmin,
  getCommunityRequests,
  approveCommunityRequest,
  rejectCommunityRequest,
  updateCommunity,
  archiveCommunity,
  getCommunityBySlug,
  getCommunityLeaderboard,
  addCommunityMemberDirect,
  removeCommunityMember,
  refreshCommunityMember,
  getCommunityMemberRequests,
  getCommunityMemberRequestsCount,
  approveCommunityMemberRequest,
  rejectCommunityMemberRequest,
} from '../../services/community.service'
import {
  startRefreshAllCommunitiesJob,
  getGlobalRefreshStatus,
  startRefreshCommunityJob,
  getCommunityRefreshStatus,
} from '../../services/community-refresh.service'
import {
  requirePlatformAdmin,
  requireCommunityAccess,
} from '../../middleware/auth.middleware'
import {
  LeetCodeGraphQLProvider,
} from '../../providers/leetcode.graphql.provider'
import type { ILeetCodeProvider } from '../../providers/ILeetCodeProvider'
import type { RankingMetric } from '../../services/leaderboard.service'

let provider: ILeetCodeProvider = new LeetCodeGraphQLProvider()

export function setAdminCommunityProvider(p: ILeetCodeProvider) {
  provider = p
}

export const adminCommunitiesRouter = Router()

// Helper to resolve community ID from :slug or :communityId
async function resolveCommunityId(slugOrId: string): Promise<number> {
  if (/^\d+$/.test(slugOrId)) {
    return Number(slugOrId)
  }
  const comm = await getCommunityBySlug(slugOrId)
  if (!comm) {
    throw new Error(`Community '${slugOrId}' not found.`)
  }
  return comm.id
}

// ==========================================
// A. PLATFORM ADMIN: COMMUNITIES & CREATION REQUESTS
// ==========================================

// 1. List all communities (Platform Admin)
adminCommunitiesRouter.get('/', requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getAllCommunitiesForAdmin()
    return res.status(200).json({ success: true, data: list })
  } catch (err) {
    next(err)
  }
})

// 2. List community creation requests (Platform Admin)
adminCommunitiesRouter.get('/requests', requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const list = await getCommunityRequests(status)
    return res.status(200).json({ success: true, data: list })
  } catch (err) {
    next(err)
  }
})

// 3. Approve community creation request (Platform Admin)
adminCommunitiesRouter.post('/requests/:id/approve', requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const community = await approveCommunityRequest(Number(req.params.id), req.admin!.id)
    return res.status(201).json({ success: true, data: community })
  } catch (err) {
    next(err)
  }
})

// 4. Reject community creation request (Platform Admin)
adminCommunitiesRouter.post('/requests/:id/reject', requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rejection_reason } = req.body || {}
    const result = await rejectCommunityRequest(Number(req.params.id), rejection_reason, req.admin!.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// 5. Update community details (Platform Admin or Owner)
adminCommunitiesRouter.put(
  '/:id',
  requireCommunityAccess((req) => req.params.id),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = Number(req.params.id)
      const updated = await updateCommunity(communityId, req.body || {})
      return res.status(200).json({ success: true, data: updated })
    } catch (err) {
      next(err)
    }
  }
)

// 6. Archive community (Platform Admin)
adminCommunitiesRouter.delete('/:id', requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await archiveCommunity(Number(req.params.id))
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// 7. Platform-wide Refresh All Communities (Platform Admin)
adminCommunitiesRouter.post('/refresh-all', requirePlatformAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await startRefreshAllCommunitiesJob(provider)
    return res.status(202).json({ success: true, data: job })
  } catch (err) {
    next(err)
  }
})

// 8. Platform-wide Refresh All Status (Platform Admin)
adminCommunitiesRouter.get('/refresh-all/status', requirePlatformAdmin, (req: Request, res: Response) => {
  const status = getGlobalRefreshStatus()
  return res.status(200).json({ success: true, data: status })
})

// ==========================================
// B. COMMUNITY-SCOPED MEMBERS & MEMBER REQUESTS
// ==========================================

// 9. List members of a community
adminCommunitiesRouter.get(
  '/c/:slug/members',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sort, order, search, page, limit } = req.query
      const result = await getCommunityLeaderboard(req.params.slug, {
        metric: sort as RankingMetric,
        order: order === 'asc' ? 'asc' : 'desc',
        search: typeof search === 'string' ? search : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      })
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// 10. Add member directly to community
adminCommunitiesRouter.post(
  '/c/:slug/members',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const { leetcode_username, display_name } = req.body || {}
      const result = await addCommunityMemberDirect(communityId, leetcode_username, display_name, provider)
      return res.status(201).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// 11. Remove member from community
adminCommunitiesRouter.delete(
  '/c/:slug/members/:userId',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const result = await removeCommunityMember(communityId, Number(req.params.userId))
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// 12. Refresh single member in community
adminCommunitiesRouter.post(
  '/c/:slug/members/:userId/refresh',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const result = await refreshCommunityMember(communityId, Number(req.params.userId), provider)
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// 13. Refresh all members belonging to a specific community
adminCommunitiesRouter.post(
  '/c/:slug/refresh-all',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const job = await startRefreshCommunityJob(communityId, provider)
      return res.status(202).json({ success: true, data: job })
    } catch (err) {
      next(err)
    }
  }
)

// 14. Poll status of community member refresh
adminCommunitiesRouter.get(
  '/c/:slug/refresh-all/status',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const status = getCommunityRefreshStatus(communityId)
      return res.status(200).json({ success: true, data: status })
    } catch (err) {
      next(err)
    }
  }
)

// 15. List pending member requests for a community
adminCommunitiesRouter.get(
  '/c/:slug/requests',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const { page, limit } = req.query
      const result = await getCommunityMemberRequests(communityId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      })
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// 16. Count pending member requests for a community (badge)
adminCommunitiesRouter.get(
  '/c/:slug/requests/count',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const count = await getCommunityMemberRequestsCount(communityId)
      return res.status(200).json({ success: true, data: { count } })
    } catch (err) {
      next(err)
    }
  }
)

// 17. Approve member request for community
adminCommunitiesRouter.post(
  '/c/:slug/requests/:id/approve',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const result = await approveCommunityMemberRequest(
        communityId,
        Number(req.params.id),
        req.admin!.id,
        provider
      )
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)

// 18. Reject member request for community
adminCommunitiesRouter.post(
  '/c/:slug/requests/:id/reject',
  requireCommunityAccess((req) => req.params.slug),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communityId = await resolveCommunityId(req.params.slug)
      const { rejection_reason } = req.body || {}
      const result = await rejectCommunityMemberRequest(
        communityId,
        Number(req.params.id),
        rejection_reason,
        req.admin!.id
      )
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  }
)
