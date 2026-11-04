import { Router, type Request, type Response, type NextFunction } from 'express'
import {
  getApprovedCommunities,
  getCommunityBySlug,
  createCommunityRequest,
  getCommunityLeaderboard,
  createCommunityMemberRequest,
} from '../../services/community.service'
import {
  LeetCodeGraphQLProvider,
} from '../../providers/leetcode.graphql.provider'
import type { ILeetCodeProvider } from '../../providers/ILeetCodeProvider'
import type { RankingMetric } from '../../services/leaderboard.service'

let provider: ILeetCodeProvider = new LeetCodeGraphQLProvider()

export function setCommunityProvider(p: ILeetCodeProvider) {
  provider = p
}

export const publicCommunitiesRouter = Router()

// 1. List approved communities (with search)
publicCommunitiesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const communities = await getApprovedCommunities(search)
    return res.status(200).json({ success: true, data: communities })
  } catch (err) {
    next(err)
  }
})

// 2. Submit community creation request
publicCommunitiesRouter.post('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, requester_name, requester_email } = req.body || {}
    const result = await createCommunityRequest({
      name,
      description,
      requester_name,
      requester_email,
    })
    return res.status(201).json({
      success: true,
      data: {
        request: result,
        message: 'Community creation request submitted for administrative review.',
      },
    })
  } catch (err) {
    next(err)
  }
})

// 3. Inline LeetCode username validation utility (no browser alert)
publicCommunitiesRouter.post('/validate-user', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username = req.body?.leetcode_username?.trim()
    if (!username) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'LeetCode username is required.' },
      })
    }

    const check = await provider.checkProfile(username)
    return res.status(200).json({
      success: true,
      data: check,
    })
  } catch (err) {
    next(err)
  }
})

// 4. Get community public details
publicCommunitiesRouter.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const community = await getCommunityBySlug(req.params.slug)
    if (!community) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMMUNITY_NOT_FOUND', message: 'Community not found.' },
      })
    }
    return res.status(200).json({ success: true, data: community })
  } catch (err) {
    next(err)
  }
})

// 5. Get community-specific leaderboard
publicCommunitiesRouter.get('/:slug/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
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
})

// 6. Submit member-addition request to a community
publicCommunitiesRouter.post('/:slug/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leetcode_username, display_name } = req.body || {}
    const result = await createCommunityMemberRequest(
      req.params.slug,
      { leetcode_username, display_name },
      provider
    )
    return res.status(201).json({
      success: true,
      data: {
        request: result.request,
        message: 'Member addition request submitted for community approval.',
      },
    })
  } catch (err) {
    next(err)
  }
})
