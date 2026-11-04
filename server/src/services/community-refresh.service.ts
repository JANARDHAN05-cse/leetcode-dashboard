import { query } from '../db/client'
import { syncUserStats } from './sync.service'
import { AdminActionError } from './admin.service'
import {
  LeetCodeGraphQLProvider,
} from '../providers/leetcode.graphql.provider'
import type { ILeetCodeProvider } from '../providers/ILeetCodeProvider'

const defaultProvider: ILeetCodeProvider = new LeetCodeGraphQLProvider()

export interface RefreshResultItem {
  username: string
  status: 'ok' | 'failed'
  error?: string
}

export interface RefreshJobStatus {
  jobId: string
  type: 'global' | 'community'
  communityId?: number
  communityName?: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  totalCommunities?: number
  total: number
  processed: number
  successful: number
  failed: number
  currentUser?: string
  results: RefreshResultItem[]
  startedAt: string | null
  completedAt: string | null
}

// In-memory tracker for the global platform-wide refresh job
let activeGlobalJob: RefreshJobStatus = {
  jobId: 'initial',
  type: 'global',
  status: 'idle',
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  results: [],
  startedAt: null,
  completedAt: null,
}

// In-memory map of community-specific refresh jobs
const activeCommunityJobs = new Map<number, RefreshJobStatus>()

export function getGlobalRefreshStatus(): RefreshJobStatus {
  return { ...activeGlobalJob }
}

export function getCommunityRefreshStatus(communityId: number): RefreshJobStatus {
  const job = activeCommunityJobs.get(communityId)
  if (!job) {
    return {
      jobId: 'idle',
      type: 'community',
      communityId,
      status: 'idle',
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      results: [],
      startedAt: null,
      completedAt: null,
    }
  }
  return { ...job }
}

/**
 * Executes async tasks with bounded concurrency.
 */
async function runWithBoundedConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const p = Promise.resolve().then(() => task(item))
    executing.push(p)

    const clean = () => {
      const idx = executing.indexOf(p)
      if (idx !== -1) executing.splice(idx, 1)
    }
    p.then(clean, clean)

    if (executing.length >= limit) {
      await Promise.race(executing)
    }
  }
  await Promise.all(executing)
}

// ==============================================================
// 1. PLATFORM ADMIN: REFRESH ALL COMMUNITIES (DEDUPLICATED PROFILES)
// ==============================================================

export async function startRefreshAllCommunitiesJob(
  provider: ILeetCodeProvider = defaultProvider
): Promise<RefreshJobStatus> {
  if (activeGlobalJob.status === 'running') {
    throw new AdminActionError(
      'A platform-wide refresh operation is already in progress.',
      'REFRESH_IN_PROGRESS',
      409
    )
  }

  // Count active communities
  const commRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM communities WHERE status = 'approved' AND archived_at IS NULL`
  )
  const totalCommunities = parseInt(commRes.rows[0]?.count || '0', 10)

  // Fetch DISTINCT active usernames across all approved communities
  const usersRes = await query<{ leetcode_username: string }>(
    `SELECT DISTINCT u.leetcode_username
     FROM users u
     JOIN community_members cm ON cm.user_id = u.id
     JOIN communities c ON c.id = cm.community_id
     WHERE c.status = 'approved' 
       AND c.archived_at IS NULL
       AND cm.archived_at IS NULL
       AND u.archived_at IS NULL
     ORDER BY u.leetcode_username ASC`
  )
  const usernames = usersRes.rows.map((r) => r.leetcode_username)

  const jobId = `global_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  activeGlobalJob = {
    jobId,
    type: 'global',
    status: 'running',
    totalCommunities,
    total: usernames.length,
    processed: 0,
    successful: 0,
    failed: 0,
    currentUser: usernames[0] || undefined,
    results: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  }

  if (usernames.length === 0) {
    activeGlobalJob.status = 'completed'
    activeGlobalJob.completedAt = new Date().toISOString()
    return { ...activeGlobalJob }
  }

  // Concurrency bounded to 3 by default
  const concurrency = 3

  const runBackground = async () => {
    try {
      await runWithBoundedConcurrency(usernames, concurrency, async (username) => {
        activeGlobalJob.currentUser = username

        try {
          const success = await syncUserStats(username, provider)
          activeGlobalJob.processed += 1

          if (success) {
            activeGlobalJob.successful += 1
            activeGlobalJob.results.push({ username, status: 'ok' })
          } else {
            activeGlobalJob.failed += 1
            activeGlobalJob.results.push({
              username,
              status: 'failed',
              error: 'Failed to update stats or user not found',
            })
          }
        } catch (err: any) {
          activeGlobalJob.processed += 1
          activeGlobalJob.failed += 1
          activeGlobalJob.results.push({
            username,
            status: 'failed',
            error: err.message || 'Unknown sync error',
          })
        }
      })

      activeGlobalJob.status = 'completed'
      activeGlobalJob.currentUser = undefined
      activeGlobalJob.completedAt = new Date().toISOString()
    } catch (err: any) {
      activeGlobalJob.status = 'failed'
      activeGlobalJob.completedAt = new Date().toISOString()
      console.error('[RefreshAllCommunities] Fatal error:', err)
    }
  }

  runBackground()
  return { ...activeGlobalJob }
}

// ==============================================================
// 2. COMMUNITY-SPECIFIC REFRESH (OWNER OR PLATFORM ADMIN)
// ==============================================================

export async function startRefreshCommunityJob(
  communityId: number,
  provider: ILeetCodeProvider = defaultProvider
): Promise<RefreshJobStatus> {
  const existingJob = activeCommunityJobs.get(communityId)
  if (existingJob && existingJob.status === 'running') {
    throw new AdminActionError(
      'A refresh operation for this community is already in progress.',
      'REFRESH_IN_PROGRESS',
      409
    )
  }

  const commRes = await query<{ name: string; refresh_concurrency: number }>(
    `SELECT name, refresh_concurrency FROM communities WHERE id = $1 AND archived_at IS NULL`,
    [communityId]
  )
  if (commRes.rows.length === 0) {
    throw new AdminActionError('Community not found.', 'COMMUNITY_NOT_FOUND', 404)
  }

  const community = commRes.rows[0]
  const concurrency = Math.max(1, Math.min(5, community.refresh_concurrency || 3))

  // Fetch usernames for this community
  const usersRes = await query<{ leetcode_username: string }>(
    `SELECT u.leetcode_username
     FROM users u
     JOIN community_members cm ON cm.user_id = u.id
     WHERE cm.community_id = $1 
       AND cm.archived_at IS NULL
       AND u.archived_at IS NULL
     ORDER BY u.leetcode_username ASC`,
    [communityId]
  )
  const usernames = usersRes.rows.map((r) => r.leetcode_username)

  const jobId = `comm_job_${communityId}_${Date.now()}`

  const job: RefreshJobStatus = {
    jobId,
    type: 'community',
    communityId,
    communityName: community.name,
    status: 'running',
    total: usernames.length,
    processed: 0,
    successful: 0,
    failed: 0,
    currentUser: usernames[0] || undefined,
    results: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  }

  activeCommunityJobs.set(communityId, job)

  if (usernames.length === 0) {
    job.status = 'completed'
    job.completedAt = new Date().toISOString()
    return { ...job }
  }

  const runBackground = async () => {
    try {
      await runWithBoundedConcurrency(usernames, concurrency, async (username) => {
        job.currentUser = username

        try {
          const success = await syncUserStats(username, provider)
          job.processed += 1

          if (success) {
            job.successful += 1
            job.results.push({ username, status: 'ok' })
          } else {
            job.failed += 1
            job.results.push({
              username,
              status: 'failed',
              error: 'Failed to update stats or user not found',
            })
          }
        } catch (err: any) {
          job.processed += 1
          job.failed += 1
          job.results.push({
            username,
            status: 'failed',
            error: err.message || 'Unknown sync error',
          })
        }
      })

      job.status = 'completed'
      job.currentUser = undefined
      job.completedAt = new Date().toISOString()
    } catch (err: any) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      console.error(`[RefreshCommunity ${communityId}] Fatal error:`, err)
    }
  }

  runBackground()
  return { ...job }
}

