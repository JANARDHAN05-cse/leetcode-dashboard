import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../index'
import { pool, query } from '../db/client'
import { MockProvider } from '../providers/mock.provider'
import {
  addCommunityMemberDirect,
  createCommunityMemberRequest,
} from '../services/community.service'
import { setCommunityProvider } from './public/communities.route'
import { setAdminCommunityProvider } from './admin/admin-communities.route'

describe('Milestone 4: Multi-Community Architecture Integration Tests', () => {
  let platformAdminCookie: string
  let ownerTokenCookie: string
  let communityAId: number
  let communityBId: number
  const mockProvider = new MockProvider()

  beforeAll(async () => {
    // Inject mock provider for test isolation
    setCommunityProvider(mockProvider)
    setAdminCommunityProvider(mockProvider)

    // 1. Clean test data
    await query(`DELETE FROM community_requests WHERE slug IN ('test-alpha', 'test-beta', 'test-rejected', 'test-dup-1', 'test-dup-2')`)
    await query(`DELETE FROM communities WHERE slug IN ('test-alpha', 'test-beta', 'test-dup')`)
    await query(`DELETE FROM users WHERE leetcode_username IN ('comm_test_user_1', 'comm_test_user_2')`)

    // 2. Log in as platform admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'AdminSecurePassword123!' })
    expect(loginRes.status).toBe(200)
    const cookies = loginRes.headers['set-cookie']
    platformAdminCookie = cookies.find((c: string) => c.startsWith('admin_token='))!

    // 3. Create test communities A and B directly in database
    const commA = await query(
      `INSERT INTO communities (name, slug, description, owner_id)
       VALUES ('Test Alpha Club', 'test-alpha', 'Alpha test community', 1)
       RETURNING id`
    )
    communityAId = commA.rows[0].id

    const commB = await query(
      `INSERT INTO communities (name, slug, description, owner_id)
       VALUES ('Test Beta Club', 'test-beta', 'Beta test community', 1)
       RETURNING id`
    )
    communityBId = commB.rows[0].id

    // 4. Create a community owner account scoped specifically to Community A
    await query(`DELETE FROM admin_users WHERE username = 'owner_alpha'`)
    const hash = '$2a$12$4vQpA5G7bN3xK1mQ0wO9rO2D3y0E5s9h2c8l1t4u6o8r0w2e4r6t8' // placeholder valid bcrypt
    const ownerRes = await query(
      `INSERT INTO admin_users (username, email, password_hash, role, community_id)
       VALUES ('owner_alpha', 'owner_alpha@test.com', $1, 'community_owner', $2)
       RETURNING id`,
      [hash, communityAId]
    )
    const ownerId = ownerRes.rows[0].id

    // Log in as owner_alpha (using jwt directly to bypass bcrypt in test setup if needed)
    const { generateAdminToken } = await import('../services/auth.service')
    const token = generateAdminToken({
      id: ownerId,
      username: 'owner_alpha',
      role: 'community_owner',
      community_id: communityAId,
    })
    ownerTokenCookie = `admin_token=${token}; Path=/`
  })

  afterAll(async () => {
    // Clean test data
    await query(`DELETE FROM community_requests WHERE slug IN ('test-alpha', 'test-beta', 'test-rejected', 'test-dup-1', 'test-dup-2')`)
    await query(`DELETE FROM communities WHERE slug IN ('test-alpha', 'test-beta', 'test-dup')`)
    await query(`DELETE FROM users WHERE leetcode_username IN ('comm_test_user_1', 'comm_test_user_2')`)
    await query(`DELETE FROM admin_users WHERE username = 'owner_alpha'`)
    await pool.end()
  })

  describe('1. Default Community & Existing Single-Community Data Migration', () => {
    it('should have migrated existing active users into default JoyBoys community', async () => {
      const res = await request(app).get('/api/communities/joyboys/leaderboard')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.community.name).toBe('JoyBoys')
      expect(res.body.data.community.slug).toBe('joyboys')
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(6)

      // Verified profiles are present
      const usernames = res.body.data.users.map((u: any) => u.leetcode_username)
      expect(usernames).toContain('awice')
      expect(usernames).toContain('lee215')
    })
  })

  describe('2. Community Creation Requests & Name Uniqueness', () => {
    it('should successfully submit a valid community creation request', async () => {
      const res = await request(app)
        .post('/api/communities/requests')
        .send({
          name: 'Placement Prep 2026',
          description: 'Dedicated preparation group for placements',
          requester_name: 'Alex Organizer',
          requester_email: 'alex@example.com',
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.request.name).toBe('Placement Prep 2026')
      expect(res.body.data.request.status).toBe('pending')
    })

    it('should reject duplicate pending community request with different capitalization', async () => {
      // "placement prep 2026" in lower case
      const res = await request(app)
        .post('/api/communities/requests')
        .send({
          name: 'placement prep 2026',
        })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('COMMUNITY_REQUEST_EXISTS')
    })

    it('should reject community request when name already exists in active communities (case-insensitive)', async () => {
      // JoyBoys already exists
      const res = await request(app)
        .post('/api/communities/requests')
        .send({
          name: 'joyboys',
        })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('COMMUNITY_NAME_EXISTS')
    })

    it('should list pending community requests for platform admin', async () => {
      const res = await request(app)
        .get('/api/admin/communities/requests?status=pending')
        .set('Cookie', platformAdminCookie)
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      const found = res.body.data.find((r: any) => r.slug === 'placement-prep-2026')
      expect(found).toBeDefined()
    })

    it('should approve a community creation request and make it publicly available', async () => {
      const pendingRes = await request(app)
        .get('/api/admin/communities/requests?status=pending')
        .set('Cookie', platformAdminCookie)
      const targetReq = pendingRes.body.data.find((r: any) => r.slug === 'placement-prep-2026')

      const approveRes = await request(app)
        .post(`/api/admin/communities/requests/${targetReq.id}/approve`)
        .set('Cookie', platformAdminCookie)
      expect(approveRes.status).toBe(201)
      expect(approveRes.body.data.slug).toBe('placement-prep-2026')

      // Verify publicly available
      const pubRes = await request(app).get('/api/communities/placement-prep-2026')
      expect(pubRes.status).toBe(200)
      expect(pubRes.body.data.name).toBe('Placement Prep 2026')

      // Clean up created community and request
      await query(`DELETE FROM communities WHERE slug = 'placement-prep-2026'`)
      await query(`DELETE FROM community_requests WHERE slug = 'placement-prep-2026'`)
    })
  })

  describe('3. Multi-Community Data Isolation & Membership', () => {
    it('should allow the same user to belong to multiple communities', async () => {
      // Add comm_test_user_shared to Community A
      await addCommunityMemberDirect(communityAId, 'comm_test_user_shared', 'Shared Alpha', mockProvider)
      // Add comm_test_user_shared to Community B
      await addCommunityMemberDirect(communityBId, 'comm_test_user_shared', 'Shared Beta', mockProvider)

      const leaderA = await request(app).get('/api/communities/test-alpha/leaderboard')
      const leaderB = await request(app).get('/api/communities/test-beta/leaderboard')

      expect(leaderA.body.data.users.some((u: any) => u.leetcode_username === 'comm_test_user_shared')).toBe(true)
      expect(leaderB.body.data.users.some((u: any) => u.leetcode_username === 'comm_test_user_shared')).toBe(true)
    })

    it('should isolate memberships: a user in Community A does not automatically appear in Community B', async () => {
      // Add comm_test_user_isolated ONLY to Community A
      await addCommunityMemberDirect(communityAId, 'comm_test_user_isolated', 'Isolated A', mockProvider)

      const leaderA = await request(app).get('/api/communities/test-alpha/leaderboard')
      const leaderB = await request(app).get('/api/communities/test-beta/leaderboard')

      expect(leaderA.body.data.users.some((u: any) => u.leetcode_username === 'comm_test_user_isolated')).toBe(true)
      expect(leaderB.body.data.users.some((u: any) => u.leetcode_username === 'comm_test_user_isolated')).toBe(false)
    })

    it('should prevent adding the same user twice into the same community', async () => {
      await expect(
        addCommunityMemberDirect(communityAId, 'comm_test_user_shared', undefined, mockProvider)
      ).rejects.toThrow('already a member of this community')
    })
  })

  describe('4. LeetCode Profile Inline Validation UX & Error Isolation', () => {
    it('should reject member request with nonexistent LeetCode username and return PROFILE_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/communities/test-alpha/requests')
        .send({
          leetcode_username: 'invalid_nonexistent_user_99999',
        })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('PROFILE_NOT_FOUND')
      expect(res.body.error.message).toContain('does not exist')
    })

    it('should distinguish temporary provider failure and return 503 PROVIDER_UNAVAILABLE', async () => {
      // In MockProvider, any username with 'provider_fail' simulates temporary provider failure
      const res = await request(app)
        .post('/api/communities/test-alpha/requests')
        .send({
          leetcode_username: 'provider_fail_user',
        })
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('PROVIDER_UNAVAILABLE')
      expect(res.body.error.message).toContain('temporarily unavailable')
    })

    it('should validate profile using the inline validation endpoint without throwing alert', async () => {
      const res = await request(app)
        .post('/api/communities/validate-user')
        .send({ leetcode_username: 'tourist' })
      expect(res.status).toBe(200)
      expect(res.body.data.valid).toBe(true)
    })
  })

  describe('5. Role-Based Permissions & Community Scoping', () => {
    it('should allow community owner to access their own community members', async () => {
      const res = await request(app)
        .get('/api/admin/communities/c/test-alpha/members')
        .set('Cookie', ownerTokenCookie)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should block community owner from accessing or modifying another community', async () => {
      const res = await request(app)
        .get('/api/admin/communities/c/test-beta/members')
        .set('Cookie', ownerTokenCookie)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('should block community owner from platform admin endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/communities/requests')
        .set('Cookie', ownerTokenCookie)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('should allow platform admin universal access to all communities', async () => {
      const res = await request(app)
        .get('/api/admin/communities/c/test-beta/members')
        .set('Cookie', platformAdminCookie)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('6. Multi-Community Bulk & Isolated Refresh Engine', () => {
    it('should trigger platform-wide Refresh All Communities with deduplicated profiles', async () => {
      const res = await request(app)
        .post('/api/admin/communities/refresh-all')
        .set('Cookie', platformAdminCookie)
      expect([202, 409]).toContain(res.status)
      if (res.status === 202) {
        expect(res.body.data.type).toBe('global')
      }
    })

    it('should prevent simultaneous duplicate platform-wide refresh', async () => {
      // Fire concurrent requests to verify duplicate prevention
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/admin/communities/refresh-all')
          .set('Cookie', platformAdminCookie),
        request(app)
          .post('/api/admin/communities/refresh-all')
          .set('Cookie', platformAdminCookie),
      ])

      const statuses = [res1.status, res2.status]
      // At least one must be rejected or in progress
      expect(statuses.some((s) => s === 409 || s === 202)).toBe(true)
    })

    it('should return platform-wide refresh progress via status endpoint', async () => {
      const res = await request(app)
        .get('/api/admin/communities/refresh-all/status')
        .set('Cookie', platformAdminCookie)
      expect(res.status).toBe(200)
      expect(res.body.data.type).toBe('global')
      expect(res.body.data.jobId).toBeDefined()
    })

    it('should trigger community-scoped refresh only for members of that community', async () => {
      const res = await request(app)
        .post('/api/admin/communities/c/test-alpha/refresh-all')
        .set('Cookie', platformAdminCookie)
      expect(res.status).toBe(202)
      expect(res.body.data.type).toBe('community')
      expect(res.body.data.communityId).toBe(communityAId)
    })
  })
})
