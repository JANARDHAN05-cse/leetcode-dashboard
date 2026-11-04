import { query } from '../db/client'

export class RequestValidationError extends Error {
  constructor(message: string, public field?: string, public code = 'VALIDATION_ERROR') {
    super(message)
    this.name = 'RequestValidationError'
  }
}

export class RequestConflictError extends Error {
  constructor(message: string, public code = 'DUPLICATE_REQUEST') {
    super(message)
    this.name = 'RequestConflictError'
  }
}

export async function createJoinRequest(data: {
  leetcode_username: string
  display_name?: string
}) {
  const username = data.leetcode_username.trim()
  const displayName = data.display_name?.trim() || null

  if (!username) {
    throw new RequestValidationError('LeetCode username is required.', 'leetcode_username')
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{1,30}$/
  if (!usernameRegex.test(username)) {
    throw new RequestValidationError(
      'Username must be between 1 and 30 characters and only contain letters, numbers, underscores, or hyphens.',
      'leetcode_username'
    )
  }

  if (displayName && displayName.length > 60) {
    throw new RequestValidationError(
      'Display name cannot exceed 60 characters.',
      'display_name'
    )
  }

  // 1. Check if user already exists as an approved user
  const approvedCheck = await query(
    `SELECT id FROM users WHERE LOWER(leetcode_username) = LOWER($1) AND archived_at IS NULL`,
    [username]
  )
  if (approvedCheck.rows.length > 0) {
    throw new RequestConflictError(
      'This username is already on the leaderboard.',
      'USER_ALREADY_APPROVED'
    )
  }

  // 2. Check if user already has an active pending request
  const pendingCheck = await query(
    `SELECT id FROM join_requests WHERE LOWER(leetcode_username) = LOWER($1) AND status = 'pending'`,
    [username]
  )
  if (pendingCheck.rows.length > 0) {
    throw new RequestConflictError(
      'A request for this username is already pending.',
      'DUPLICATE_REQUEST'
    )
  }

  // 3. Insert new request
  await query(
    `INSERT INTO join_requests (leetcode_username, display_name, status, requested_at)
     VALUES ($1, $2, 'pending', NOW())`,
    [username, displayName]
  )

  return {
    success: true,
    data: {
      message:
        'Your request has been submitted and is pending admin approval. Your profile will be added to the leaderboard once approved.',
    },
  }
}
