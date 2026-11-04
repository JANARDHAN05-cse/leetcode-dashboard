export interface UserStats {
  username: string
  displayName: string | null
  avatarUrl: string | null
  solvedTotal: number | null
  solvedEasy: number | null
  solvedMedium: number | null
  solvedHard: number | null
  contestRating: number | null
  contestsAttended: number | null // null = unavailable; 0 = confirmed zero
}

export type ProfileValidationResult =
  | { valid: true; stats?: UserStats }
  | { valid: false; reason: 'not_found' | 'provider_error'; message: string }

export interface ILeetCodeProvider {
  fetchUserStats(username: string): Promise<UserStats>
  validateUsername(username: string): Promise<boolean>
  checkProfile(username: string): Promise<ProfileValidationResult>
}

