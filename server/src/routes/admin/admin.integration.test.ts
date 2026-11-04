import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../index'
import { pool, query } from '../../db/client'

describe('Admin Authentication & Dashboard Integration Tests', () => {
  let authCookie: string

  beforeAll(async () => {
    // Clean up any test users or requests
    await query(`DELETE FROM users WHERE leetcode_username IN ('admintest_user', 'nonexistent_user_xyz')`)
    await query(`DELETE FROM join_requests WHERE leetcode_username IN ('req_approve_user', 'req_reject_user')`)
  })

  afterAll(async () => {
    await query(`DELETE FROM users WHERE leetcode_username IN ('admintest_user', 'nonexistent_user_xyz')`)
    await query(`DELETE FROM join_requests WHERE leetcode_username IN ('req_approve_user', 'req_reject_user')`)
    await pool.end()
  })

  describe('Authentication Endpoints', () => {
    it('should reject invalid admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'WrongPassword123!' })
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
      expect(res.body.error.message).toBe('Invalid credentials.')
    })

    it('should successfully log in with valid credentials and return auth cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'AdminSecurePassword123!' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.admin.username).toBe('admin')

      // Capture cookie
      const cookies = res.headers['set-cookie']
      expect(cookies).toBeDefined()
      authCookie = cookies.find((c: string) => c.startsWith('admin_token='))!
      expect(authCookie).toBeDefined()
    })

    it('should reject unauthenticated access to /api/auth/me', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('should verify active session with valid cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.admin.username).toBe('admin')
    })
  })

  describe('Admin Authorization Protection', () => {
    it('should block unauthenticated access to GET /api/admin/users', async () => {
      const res = await request(app).get('/api/admin/users')
      expect(res.status).toBe(401)
    })

    it('should block unauthenticated access to GET /api/admin/requests', async () => {
      const res = await request(app).get('/api/admin/requests')
      expect(res.status).toBe(401)
    })

    it('should block unauthenticated access to GET /api/admin/settings', async () => {
      const res = await request(app).get('/api/admin/settings')
      expect(res.status).toBe(401)
    })
  })

  describe('Admin Approved Users Management', () => {
    it('should list approved users when authenticated', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Cookie', authCookie)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.users).toBeInstanceOf(Array)
      expect(res.body.data.pagination).toBeDefined()
    })

    it('should reject adding a duplicate user already on leaderboard', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Cookie', authCookie)
        .send({ leetcode_username: 'lee215' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('USER_ALREADY_APPROVED')
    })

    it('should reject adding a non-existent LeetCode username', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Cookie', authCookie)
        .send({ leetcode_username: 'nonexistent_user_xyz' })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('USER_NOT_FOUND')
    })

    it('should remove (archive) an approved user with confirmation', async () => {
      // First, create a temporary user to archive
      const insert = await query(
        `INSERT INTO users (leetcode_username, solved_total, fetch_status)
         VALUES ('admintest_archive_user', 50, 'ok')
         RETURNING id`
      )
      const userId = insert.rows[0].id

      // Delete (archive) user
      const deleteRes = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set('Cookie', authCookie)
      expect(deleteRes.status).toBe(200)
      expect(deleteRes.body.data.message).toBe('User archived.')

      // Confirm archived user does not appear in active list
      const getRes = await request(app)
        .get('/api/admin/users?search=admintest_archive_user')
        .set('Cookie', authCookie)
      expect(getRes.body.data.users.length).toBe(0)

      // Clean up
      await query(`DELETE FROM users WHERE id = $1`, [userId])
    })
  })

  describe('Admin Pending Requests Management', () => {
    let requestIdToApprove: number
    let requestIdToReject: number

    beforeAll(async () => {
      // Create test requests
      const r1 = await query(
        `INSERT INTO join_requests (leetcode_username, display_name, status, requested_at)
         VALUES ('tourist', 'Gennady', 'pending', NOW())
         RETURNING id`
      )
      requestIdToApprove = r1.rows[0].id

      const r2 = await query(
        `INSERT INTO join_requests (leetcode_username, display_name, status, requested_at)
         VALUES ('req_reject_user', 'Reject Me', 'pending', NOW())
         RETURNING id`
      )
      requestIdToReject = r2.rows[0].id
    })

    it('should list pending requests and report pending count', async () => {
      const res = await request(app)
        .get('/api/admin/requests')
        .set('Cookie', authCookie)
      expect(res.status).toBe(200)
      expect(res.body.data.requests.length).toBeGreaterThanOrEqual(2)

      const countRes = await request(app)
        .get('/api/admin/requests/count')
        .set('Cookie', authCookie)
      expect(countRes.status).toBe(200)
      expect(countRes.body.data.count).toBeGreaterThanOrEqual(2)
    })

    it('should reject a pending request and update status', async () => {
      const res = await request(app)
        .post(`/api/admin/requests/${requestIdToReject}/reject`)
        .set('Cookie', authCookie)
        .send({ rejection_reason: 'Testing rejection workflow' })
      expect(res.status).toBe(200)
      expect(res.body.data.message).toBe('Request rejected.')

      // Confirm request status in DB
      const check = await query(`SELECT status FROM join_requests WHERE id = $1`, [requestIdToReject])
      expect(check.rows[0].status).toBe('rejected')
    })

    it('should approve a pending request and sync profile data', async () => {
      const res = await request(app)
        .post(`/api/admin/requests/${requestIdToApprove}/approve`)
        .set('Cookie', authCookie)
      expect(res.status).toBe(200)
      expect(res.body.data.user).toBeDefined()
      expect(res.body.data.user.leetcode_username).toBe('tourist')

      // Confirm request status is approved
      const check = await query(`SELECT status FROM join_requests WHERE id = $1`, [requestIdToApprove])
      expect(check.rows[0].status).toBe('approved')
    })
  })

  describe('Admin Settings & Controls', () => {
    it('should retrieve application settings', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Cookie', authCookie)
      expect(res.status).toBe(200)
      expect(res.body.data.refresh_interval_hours).toBeDefined()
      expect(res.body.data.refresh_concurrency).toBeDefined()
    })

    it('should update application settings with valid inputs', async () => {
      const res = await request(app)
        .put('/api/admin/settings')
        .set('Cookie', authCookie)
        .send({ refresh_interval_hours: 12, refresh_concurrency: 4 })
      expect(res.status).toBe(200)
      expect(res.body.data.refresh_interval_hours).toBe(12)
      expect(res.body.data.refresh_concurrency).toBe(4)

      // Restore default settings
      await request(app)
        .put('/api/admin/settings')
        .set('Cookie', authCookie)
        .send({ refresh_interval_hours: 6, refresh_concurrency: 3 })
    })

    it('should trigger refresh-all with authorization', async () => {
      const res = await request(app)
        .post('/api/admin/settings/refresh-all')
        .set('Cookie', authCookie)
      expect(res.status).toBe(202)
      expect(res.body.data.status).toBeDefined()
    })

    it('should reject password change when current password is wrong', async () => {
      const res = await request(app)
        .put('/api/admin/settings/password')
        .set('Cookie', authCookie)
        .send({
          current_password: 'WrongCurrentPassword!',
          new_password: 'NewSuperPassword123!',
        })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_PASSWORD')
    })
  })

  describe('Admin Logout', () => {
    it('should successfully log out and invalidate session', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookie)
      expect(res.status).toBe(200)
      expect(res.body.data.message).toBe('Logged out.')

      // Subsequent call to /api/auth/me without valid cookie should fail
      const checkRes = await request(app).get('/api/auth/me')
      expect(checkRes.status).toBe(401)
    })
  })
})

