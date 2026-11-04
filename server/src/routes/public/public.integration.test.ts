import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../index'
import { pool, query } from '../../db/client'

describe('Public API Endpoints Integration', () => {
  beforeAll(async () => {
    // Ensure test request handle is cleaned up before running
    await query(`DELETE FROM join_requests WHERE leetcode_username = 'integration_test_user'`)
  })

  afterAll(async () => {
    // Clean up test request handle
    await query(`DELETE FROM join_requests WHERE leetcode_username = 'integration_test_user'`)
    await pool.end()
  })

  describe('GET /api/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.timestamp).toBeDefined()
    })
  })

  describe('GET /api/users', () => {
    it('should return leaderboard users sorted by solved_total by default', async () => {
      const res = await request(app).get('/api/users')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.users).toBeInstanceOf(Array)
      expect(res.body.data.users.length).toBeGreaterThan(0)
      expect(res.body.data.pagination).toBeDefined()
      expect(res.body.data.pagination.page).toBe(1)
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(6)

      // First user by solved_total should be awice (3268+)
      const users = res.body.data.users
      expect(users[0].leetcode_username).toBe('awice')
      expect(users[0].solved_total).toBeGreaterThan(3000)
      // Verify streak is not returned
      expect(users[0].current_streak).toBeUndefined()
    })

    it('should return leaderboard users sorted by contest_rating', async () => {
      const res = await request(app).get('/api/users?sort=contest_rating')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      const users = res.body.data.users
      expect(users.length).toBeGreaterThan(0)
      // Top contestant in our seed is neal_wu (~3686)
      expect(users[0].leetcode_username).toBe('neal_wu')
      expect(users[0].contest_rating).toBeGreaterThan(3000)

      // Non-contestants (e.g. tourist, yosupo) should have contest_rating === null and be at the end (NULLS LAST)
      const lastUser = users[users.length - 1]
      expect(lastUser.contest_rating).toBeNull()
    })

    it('should return leaderboard users sorted by contests_attended', async () => {
      const res = await request(app).get('/api/users?sort=contests_attended')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      const users = res.body.data.users
      expect(users.length).toBeGreaterThan(0)
      // Top attendee in our seed is awice (221 contests)
      expect(users[0].leetcode_username).toBe('awice')
      expect(users[0].contests_attended).toBeGreaterThan(200)
    })

    it('should reject streak sorting as unsupported', async () => {
      const res = await request(app).get('/api/users?sort=current_streak')
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should search users by leetcode_username or display_name', async () => {
      const res = await request(app).get('/api/users?search=neal')
      expect(res.status).toBe(200)
      expect(res.body.data.users.length).toBe(1)
      expect(res.body.data.users[0].leetcode_username).toBe('neal_wu')
    })

    it('should support pagination', async () => {
      const res = await request(app).get('/api/users?page=1&limit=2')
      expect(res.status).toBe(200)
      expect(res.body.data.users.length).toBe(2)
      expect(res.body.data.pagination.page).toBe(1)
      expect(res.body.data.pagination.limit).toBe(2)
      expect(res.body.data.pagination.total_pages).toBeGreaterThanOrEqual(3)
    })
  })

  describe('POST /api/requests', () => {
    it('should reject invalid username format', async () => {
      const res = await request(app)
        .post('/api/requests')
        .send({ leetcode_username: 'invalid user with spaces!' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBeDefined()
    })

    it('should reject already approved leaderboard users', async () => {
      const res = await request(app)
        .post('/api/requests')
        .send({ leetcode_username: 'lee215' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('USER_ALREADY_APPROVED')
    })

    it('should successfully submit a valid new join request', async () => {
      const res = await request(app)
        .post('/api/requests')
        .send({
          leetcode_username: 'integration_test_user',
          display_name: 'Integration Test User',
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.message).toContain('pending admin approval')
    })

    it('should reject duplicate pending requests for the same username', async () => {
      const res = await request(app)
        .post('/api/requests')
        .send({
          leetcode_username: 'integration_test_user',
        })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('DUPLICATE_REQUEST')
    })
  })
})
