import type { ILeetCodeProvider, UserStats, ProfileValidationResult } from './ILeetCodeProvider'

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql'

const USER_PROFILE_QUERY = `
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      realName
      userAvatar
      ranking
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
}
`

export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`LeetCode user '${username}' not found.`)
    this.name = 'UserNotFoundError'
  }
}

export class LeetCodeProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'LeetCodeProviderError'
  }
}

export class LeetCodeGraphQLProvider implements ILeetCodeProvider {
  private lastRequestTime = 0
  private delayMs: number
  private timeoutMs: number

  constructor(options?: { delayMs?: number; timeoutMs?: number }) {
    this.delayMs = options?.delayMs ?? Number(process.env.LEETCODE_REQUEST_DELAY_MS || 500)
    this.timeoutMs = options?.timeoutMs ?? 10000
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  async validateUsername(username: string): Promise<boolean> {
    try {
      await this.fetchUserStats(username)
      return true
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return false
      }
      throw err
    }
  }

  async checkProfile(username: string): Promise<ProfileValidationResult> {
    try {
      const stats = await this.fetchUserStats(username)
      return { valid: true, stats }
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return {
          valid: false,
          reason: 'not_found',
          message: `LeetCode profile '${username}' does not exist.`,
        }
      }
      return {
        valid: false,
        reason: 'provider_error',
        message: 'LeetCode service is temporarily unavailable. Please try again shortly.',
      }
    }
  }

  async fetchUserStats(username: string): Promise<UserStats> {
    await this.throttle()

    const cleanUsername = username.trim()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    let res: Response
    try {
      res = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://leetcode.com',
        },
        body: JSON.stringify({
          query: USER_PROFILE_QUERY,
          variables: { username: cleanUsername },
        }),
        signal: controller.signal,
      })
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new LeetCodeProviderError(
          `Request timeout after ${this.timeoutMs}ms while fetching LeetCode profile for '${cleanUsername}'`
        )
      }
      throw new LeetCodeProviderError(
        `Network error fetching LeetCode profile for '${cleanUsername}': ${err.message}`
      )
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      throw new LeetCodeProviderError(
        `LeetCode API returned HTTP status ${res.status} for '${cleanUsername}'`,
        res.status
      )
    }

    const payload = (await res.json()) as any

    // Check if user does not exist
    if (
      !payload.data ||
      !payload.data.matchedUser ||
      (payload.errors && payload.errors.some((e: any) => e.message?.includes('does not exist')))
    ) {
      throw new UserNotFoundError(cleanUsername)
    }

    const matchedUser = payload.data.matchedUser
    const contestRanking = payload.data.userContestRanking

    // 1. Solve counts breakdown
    const acSubmissions: Array<{ difficulty: string; count: number }> =
      matchedUser.submitStatsGlobal?.acSubmissionNum || []

    let solvedTotal: number | null = null
    let solvedEasy: number | null = null
    let solvedMedium: number | null = null
    let solvedHard: number | null = null

    for (const item of acSubmissions) {
      if (item.difficulty === 'All') solvedTotal = item.count
      else if (item.difficulty === 'Easy') solvedEasy = item.count
      else if (item.difficulty === 'Medium') solvedMedium = item.count
      else if (item.difficulty === 'Hard') solvedHard = item.count
    }

    // 2. Contest Rating & Contests Attended
    let contestRating: number | null = null
    let contestsAttended: number | null = null

    if (contestRanking) {
      if (typeof contestRanking.rating === 'number') {
        contestRating = Math.round(contestRanking.rating * 10) / 10
      }
      if (typeof contestRanking.attendedContestsCount === 'number') {
        contestsAttended = contestRanking.attendedContestsCount
      }
    }

    // 3. Avatar and Display Name
    const avatarUrl = matchedUser.profile?.userAvatar || null
    const displayName = matchedUser.profile?.realName || null

    return {
      username: matchedUser.username || cleanUsername,
      displayName,
      avatarUrl,
      solvedTotal,
      solvedEasy,
      solvedMedium,
      solvedHard,
      contestRating,
      contestsAttended,
    }
  }
}

