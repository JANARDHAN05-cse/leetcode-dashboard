import { query } from '../db/client'
import { syncUserStats } from './sync.service'
import { getAdminSettings, AdminActionError } from './admin.service'
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
  status: 'idle' | 'running' | 'completed' | 'failed'
  total: number
  processed: number
  successful: number
  failed: number
  currentUser?: string
  results: RefreshResultItem[]
  startedAt: string | null
  completedAt: string | null
}

// In-memory job state (singleton for the server instance)
let activeJob: RefreshJobStatus = {
  jobId: 'initial',
  status: 'idle',
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  results: [],
  startedAt: null,
  completedAt: null,
}

export function getRefreshJobStatus(): RefreshJobStatus {
  return { ...activeJob }
}

/**
 * Executes tasks with bounded concurrency to respect provider rate limits.
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

    // Remove finished promises from pool
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

export async function startRefreshAllJob(
  provider: ILeetCodeProvider = defaultProvider
): Promise<RefreshJobStatus> {
  // Prevent duplicate concurrent full refresh operations
  if (activeJob.status === 'running') {
    throw new AdminActionError(
      'A refresh operation is already in progress.',
      'REFRESH_IN_PROGRESS',
      409
    )
  }

  // 1. Fetch all active approved users
  const usersRes = await query(
    `SELECT leetcode_username FROM users WHERE archived_at IS NULL ORDER BY leetcode_username ASC`
  )
  const usernames: string[] = usersRes.rows.map((r) => r.leetcode_username)

  const settings = await getAdminSettings()
  const concurrency = Math.max(1, Math.min(5, settings.refresh_concurrency || 3))

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  activeJob = {
    jobId,
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

  // If no users exist, complete immediately
  if (usernames.length === 0) {
    activeJob.status = 'completed'
    activeJob.completedAt = new Date().toISOString()
    return { ...activeJob }
  }

  // 2. Launch execution in background without blocking the HTTP request
  const runBackground = async () => {
    try {
      await runWithBoundedConcurrency(usernames, concurrency, async (username) => {
        activeJob.currentUser = username

        try {
          const success = await syncUserStats(username, provider)
          activeJob.processed += 1

          if (success) {
            activeJob.successful += 1
            activeJob.results.push({ username, status: 'ok' })
          } else {
            activeJob.failed += 1
            activeJob.results.push({ username, status: 'failed', error: 'Fetch failed or returned error status' })
          }
        } catch (err: any) {
          activeJob.processed += 1
          activeJob.failed += 1
          activeJob.results.push({
            username,
            status: 'failed',
            error: err.message || 'Unknown error during sync',
          })
        }
      })

      activeJob.status = 'completed'
      activeJob.currentUser = undefined
      activeJob.completedAt = new Date().toISOString()
    } catch (err: any) {
      activeJob.status = 'failed'
      activeJob.completedAt = new Date().toISOString()
      console.error('[RefreshAll] Fatal background error:', err)
    }
  }

  // Start asynchronous worker
  runBackground()

  return { ...activeJob }
}
