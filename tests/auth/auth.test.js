import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, cleanupTestDatabase, createTestApp, getTestPool } from '../helpers/db-helper.js';
import { generateRandomToken, sha256Digest } from '../../server/auth/crypto.js';

describe('Phase 3: Authentication and Organization Isolation', () => {
  let app;
  let pool;

  before(async () => {
    pool = await setupTestDatabase();
    app = await createTestApp();
  });

  after(async () => {
    if (app) await app.close();
    await cleanupTestDatabase();
  });

  describe('1. Authentication & Credentials (REQ-002)', () => {
    test('Valid credentials return 200 with tokens and user info', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'len@example.com',
          password: 'password123456',
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.user.email, 'len@example.com');
      assert.equal(data.user.isOwner, true);
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      assert.ok(data.sessionId);
      assert.ok(data.csrfToken);

      // Verify cookies are set with HttpOnly and SameSite
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies);
      assert.ok(cookies.some(c => c.includes('refreshToken=') && c.includes('HttpOnly')));
      assert.ok(cookies.some(c => c.includes('sessionId=') && c.includes('HttpOnly')));
    });

    test('Incorrect password returns generic 401 error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'len@example.com',
          password: 'wrongPassword123!',
        },
      });

      assert.equal(res.statusCode, 401);
      const data = JSON.parse(res.body);
      assert.equal(data.message, 'Invalid email or password.');
    });

    test('Non-existent email returns generic 401 error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'doesnotexist@example.com',
          password: 'password123456',
        },
      });

      assert.equal(res.statusCode, 401);
      const data = JSON.parse(res.body);
      assert.equal(data.message, 'Invalid email or password.');
    });

    test('Inactive user account returns 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'inactive@example.com',
          password: 'password123456',
        },
      });

      assert.equal(res.statusCode, 403);
      const data = JSON.parse(res.body);
      assert.equal(data.message, 'Account is inactive.');
    });
  });

  describe('2. JWT Access Token Verification & Session Expiry', () => {
    let validToken;
    let sessionId;

    before(async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'alex@example.com', password: 'password123456' },
      });
      const body = JSON.parse(loginRes.body);
      validToken = body.accessToken;
      sessionId = body.sessionId;
    });

    test('Valid JWT allows access to /api/auth/me', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.user.email, 'alex@example.com');
      assert.ok(Array.isArray(body.organizations));
      assert.equal(body.organizations.length, 2);
    });

    test('Tampered JWT is rejected with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${validToken}tampered`,
        },
      });

      assert.equal(res.statusCode, 401);
    });

    test('Revoked session invalidates even an unexpired JWT', async () => {
      // Revoke session in database
      await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [sessionId]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.match(body.message, /revoked/i);
    });
  });

  describe('3. Refresh Token Rotation & Replay Attack Protection (REQ-007)', () => {
    let initialRefreshToken;
    let initialSessionId;

    before(async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'sam@example.com', password: 'password123456' },
      });
      const body = JSON.parse(loginRes.body);
      initialRefreshToken = body.refreshToken;
      initialSessionId = body.sessionId;
    });

    test('Refresh rotates token and returns new access & refresh tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          sessionId: initialSessionId,
          refreshToken: initialRefreshToken,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.accessToken);
      assert.ok(body.refreshToken);
      assert.notEqual(body.refreshToken, initialRefreshToken);

      // Verify the new access token is usable
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      assert.equal(meRes.statusCode, 200);
    });

    test('Replaying previously used refresh token revokes session immediately', async () => {
      // Re-send the old `initialRefreshToken` that was already rotated
      const replayRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          sessionId: initialSessionId,
          refreshToken: initialRefreshToken,
        },
      });

      assert.equal(replayRes.statusCode, 401);
      const replayBody = JSON.parse(replayRes.body);
      assert.match(replayBody.message, /reuse/i);

      // Verify session in database is now revoked
      const sessionRow = await pool.query('SELECT revoked_at FROM sessions WHERE id = $1', [initialSessionId]);
      assert.ok(sessionRow.rows[0].revoked_at !== null);
    });
  });

  describe('4. Logout & Revocation (REQ-007)', () => {
    test('Logout revokes the server session and clears cookies', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'jordan@example.com', password: 'password123456' },
      });
      const loginData = JSON.parse(loginRes.body);

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: { sessionId: loginData.sessionId },
      });

      assert.equal(logoutRes.statusCode, 200);

      // Verify session is revoked in database
      const row = await pool.query('SELECT revoked_at FROM sessions WHERE id = $1', [loginData.sessionId]);
      assert.ok(row.rows[0].revoked_at !== null);

      // Token replay after logout fails
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          sessionId: loginData.sessionId,
          refreshToken: loginData.refreshToken,
        },
      });
      assert.equal(refreshRes.statusCode, 401);
    });
  });

  describe('5. CSRF Protection for Cookie-Based Requests', () => {
    test('Cookie-based refresh without X-CSRF-Token is rejected with 403', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'len@example.com', password: 'password123456' },
      });
      const loginData = JSON.parse(loginRes.body);

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: {
          refreshToken: loginData.refreshToken,
          sessionId: loginData.sessionId,
          csrfToken: loginData.csrfToken,
        },
        // Missing X-CSRF-Token header!
      });

      assert.equal(refreshRes.statusCode, 403);
      const data = JSON.parse(refreshRes.body);
      assert.match(data.message, /CSRF/i);
    });

    test('Cookie-based refresh with matching X-CSRF-Token succeeds', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'alex@example.com', password: 'password123456' },
      });
      const loginData = JSON.parse(loginRes.body);

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: {
          refreshToken: loginData.refreshToken,
          sessionId: loginData.sessionId,
          csrfToken: loginData.csrfToken,
        },
        headers: {
          'x-csrf-token': loginData.csrfToken,
        },
      });

      assert.equal(refreshRes.statusCode, 200);
    });
  });

  describe('6. Organization Isolation & Scope Access (REQ-003, REQ-005)', () => {
    let ownerToken;
    let memberToken;

    before(async () => {
      // Owner (Len)
      const lenLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'len@example.com', password: 'password123456' },
      });
      ownerToken = JSON.parse(lenLogin.body).accessToken;

      // Jordan Lee (only has membership in org-2)
      const jordanLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'jordan@example.com', password: 'password123456' },
      });
      memberToken = JSON.parse(jordanLogin.body).accessToken;
    });

    test('Owner can access combined overview (scope=all)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=all',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.scope, 'all');
      assert.equal(data.metrics.activeMembers, 4); // Deduplicated 4 active users
      assert.equal(data.metrics.openTasks, 4);
      assert.equal(data.metrics.overdueTasks, 2);
      assert.equal(data.metrics.announcements, 2);
    });

    test('Non-owner cannot access combined overview (scope=all)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=all',
        headers: { authorization: `Bearer ${memberToken}` },
      });

      assert.equal(res.statusCode, 403);
      const data = JSON.parse(res.body);
      assert.match(data.message, /Owner role/i);
    });

    test('Non-member is forbidden from accessing unassigned organization (scope=org-1)', async () => {
      // Jordan Lee only belongs to org-2
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=org-1',
        headers: { authorization: `Bearer ${memberToken}` },
      });

      assert.equal(res.statusCode, 403);
      const data = JSON.parse(res.body);
      assert.match(data.message, /Inaccessible organization/i);
    });

    test('Member can access assigned organization (scope=org-2)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=org-2',
        headers: { authorization: `Bearer ${memberToken}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.scope, 'org-2');
    });

    test('Forged organization ID returns 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=forged-org-id',
        headers: { authorization: `Bearer ${memberToken}` },
      });

      assert.equal(res.statusCode, 403);
    });
  });

  describe('7. Invitation Lifecycle & Acceptance (REQ-001, REQ-007)', () => {
    test('Valid single-use invitation creates user and membership', async () => {
      const inviteToken = generateRandomToken(32);
      const inviteDigest = sha256Digest(inviteToken);
      const inviteEmail = 'invited_brand_new@example.com';

      await pool.query(
        `INSERT INTO invitations (id, email, organization_id, role, token_digest, status, expires_at)
         VALUES ('inv-test-1', $1, 'org-1', 'Member', $2, 'pending', NOW() + INTERVAL '72 hours')`,
        [inviteEmail, inviteDigest]
      );

      // Verify preview
      const previewRes = await app.inject({
        method: 'GET',
        url: `/api/auth/invitation/${inviteToken}`,
      });
      assert.equal(previewRes.statusCode, 200);
      const preview = JSON.parse(previewRes.body);
      assert.equal(preview.valid, true);
      assert.equal(preview.email, inviteEmail);
      assert.equal(preview.organizationName, 'AqOne');

      // Accept invitation
      const acceptRes = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: inviteEmail,
          password: 'newSecurePassword123!',
          displayName: 'Brand New User',
        },
      });

      assert.equal(acceptRes.statusCode, 200);
      const acceptData = JSON.parse(acceptRes.body);
      assert.equal(acceptData.success, true);
      assert.equal(acceptData.organizationId, 'org-1');

      // Assert user was created in database
      const userRow = await pool.query('SELECT id, status, display_name FROM users WHERE email = $1', [inviteEmail]);
      assert.equal(userRow.rows.length, 1);
      assert.equal(userRow.rows[0].display_name, 'Brand New User');

      // Assert membership was created
      const memRow = await pool.query('SELECT role, status FROM memberships WHERE user_id = $1 AND organization_id = $2', [userRow.rows[0].id, 'org-1']);
      assert.equal(memRow.rows.length, 1);
      assert.equal(memRow.rows[0].role, 'Member');
      assert.equal(memRow.rows[0].status, 'active');

      // Assert invitation status is now 'accepted'
      const invRow = await pool.query('SELECT status FROM invitations WHERE id = $1', ['inv-test-1']);
      assert.equal(invRow.rows[0].status, 'accepted');

      // Attempting to reuse the token must be rejected with 400
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: inviteEmail,
          password: 'newSecurePassword123!',
        },
      });
      assert.equal(reuseRes.statusCode, 400);
      const reuseData = JSON.parse(reuseRes.body);
      assert.match(reuseData.message, /already been accepted/i);
    });

    test('Email mismatch rejects invitation acceptance', async () => {
      const inviteToken = generateRandomToken(32);
      const inviteDigest = sha256Digest(inviteToken);

      await pool.query(
        `INSERT INTO invitations (id, email, organization_id, role, token_digest, status, expires_at)
         VALUES ('inv-test-2', 'legit_recipient@example.com', 'org-1', 'Member', $1, 'pending', NOW() + INTERVAL '72 hours')`,
        [inviteDigest]
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: 'attacker@example.com',
          password: 'password123456',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.message, /email does not match/i);
    });

    test('Expired invitation is rejected', async () => {
      const inviteToken = generateRandomToken(32);
      const inviteDigest = sha256Digest(inviteToken);

      await pool.query(
        `INSERT INTO invitations (id, email, organization_id, role, token_digest, status, expires_at)
         VALUES ('inv-test-3', 'expired@example.com', 'org-1', 'Member', $1, 'pending', NOW() - INTERVAL '1 hour')`,
        [inviteDigest]
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: 'expired@example.com',
          password: 'password123456',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.message, /expired/i);
    });

    test('Existing user can accept invitation to second organization', async () => {
      const inviteToken = generateRandomToken(32);
      const inviteDigest = sha256Digest(inviteToken);

      // Jordan Lee currently only has membership in org-2. Invite Jordan to org-1.
      await pool.query(
        `INSERT INTO invitations (id, email, organization_id, role, token_digest, status, expires_at)
         VALUES ('inv-test-4', 'jordan@example.com', 'org-1', 'Member', $1, 'pending', NOW() + INTERVAL '72 hours')`,
        [inviteDigest]
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: 'jordan@example.com',
        },
      });

      assert.equal(res.statusCode, 200);

      // Verify Jordan now has active membership in org-1
      const memRes = await pool.query(
        "SELECT role, status FROM memberships WHERE user_id = 'usr-jordan' AND organization_id = 'org-1'"
      );
      assert.equal(memRes.rows.length, 1);
      assert.equal(memRes.rows[0].role, 'Member');
      assert.equal(memRes.rows[0].status, 'active');
    });

    test('Concurrent duplicate accept calls result in exactly one membership', async () => {
      const inviteToken = generateRandomToken(32);
      const inviteDigest = sha256Digest(inviteToken);
      const email = 'concurrent_test@example.com';

      await pool.query(
        `INSERT INTO invitations (id, email, organization_id, role, token_digest, status, expires_at)
         VALUES ('inv-test-concurrent', $1, 'org-2', 'Member', $2, 'pending', NOW() + INTERVAL '72 hours')`,
        [email, inviteDigest]
      );

      // Fire two accept requests concurrently
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/auth/invitation/accept',
          payload: { token: inviteToken, email, password: 'password123456', displayName: 'Concurrent' },
        }),
        app.inject({
          method: 'POST',
          url: '/api/auth/invitation/accept',
          payload: { token: inviteToken, email, password: 'password123456', displayName: 'Concurrent' },
        }),
      ]);

      // Exactly one must succeed (200) and the other must be rejected (400)
      const statuses = [res1.statusCode, res2.statusCode].sort();
      assert.deepEqual(statuses, [200, 400]);

      // Verify only 1 user and 1 membership exist
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      assert.equal(userRes.rows.length, 1);

      const memRes = await pool.query(
        'SELECT id FROM memberships WHERE user_id = $1 AND organization_id = $2',
        [userRes.rows[0].id, 'org-2']
      );
      assert.equal(memRes.rows.length, 1);
    });
  });
});
