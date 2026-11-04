import type { ILeetCodeProvider, UserStats, ProfileValidationResult } from './ILeetCodeProvider'

export class MockProvider implements ILeetCodeProvider {
  async validateUsername(username: string): Promise<boolean> {
    return !username.includes('invalid')
  }

  async checkProfile(username: string): Promise<ProfileValidationResult> {
    if (username.includes('provider_fail')) {
      return {
        valid: false,
        reason: 'provider_error',
        message: 'LeetCode service is temporarily unavailable. Please try again shortly.',
      }
    }
    const valid = await this.validateUsername(username)
    if (valid) {
      const stats = await this.fetchUserStats(username)
      return { valid: true, stats }
    }
    return {
      valid: false,
      reason: 'not_found',
      message: `LeetCode profile '${username}' does not exist.`,
    }
  }

  async fetchUserStats(username: string): Promise<UserStats> {
    const clean = username.toLowerCase()
    if (clean === 'awice') {
      return {
        username: 'awice',
        displayName: 'Alex Wice',
        avatarUrl: null,
        solvedTotal: 3268,
        solvedEasy: 805,
        solvedMedium: 1701,
        solvedHard: 762,
        contestRating: 3091.4,
        contestsAttended: 221,
      }
    }
    if (clean === 'neal_wu') {
      return {
        username: 'neal_wu',
        displayName: 'Neal Wu',
        avatarUrl: null,
        solvedTotal: 253,
        solvedEasy: 60,
        solvedMedium: 141,
        solvedHard: 52,
        contestRating: 3686.2,
        contestsAttended: 51,
      }
    }
    if (clean === 'lee215') {
      return {
        username: 'lee215',
        displayName: 'lee',
        avatarUrl: null,
        solvedTotal: 695,
        solvedEasy: 127,
        solvedMedium: 416,
        solvedHard: 152,
        contestRating: 2204.3,
        contestsAttended: 27,
      }
    }
    if (clean === 'tourist') {
      return {
        username: 'tourist',
        displayName: 'Gennady',
        avatarUrl: null,
        solvedTotal: 4,
        solvedEasy: 1,
        solvedMedium: 2,
        solvedHard: 1,
        contestRating: null,
        contestsAttended: null,
      }
    }
    if (clean === 'yosupo') {
      return {
        username: 'yosupo',
        displayName: 'yosupo',
        avatarUrl: null,
        solvedTotal: 2,
        solvedEasy: 1,
        solvedMedium: 1,
        solvedHard: 0,
        contestRating: null,
        contestsAttended: null,
      }
    }

    const isSpecialCase = clean === 'zero_contest_user'
    return {
      username,
      displayName: `${username.charAt(0).toUpperCase() + username.slice(1)} (Mock)`,
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80`,
      solvedTotal: 450,
      solvedEasy: 180,
      solvedMedium: 220,
      solvedHard: 50,
      contestRating: isSpecialCase ? null : 1850.5,
      contestsAttended: isSpecialCase ? 0 : 25,
    }
  }
}

