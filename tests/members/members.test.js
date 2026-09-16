import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, cleanupTestDatabase, createTestApp, getTestPool } from '../helpers/db-helper.js';
import { setSimulateEmailFailure, getCapturedEmails, clearCapturedEmails } from '../../server/services/email.js';

describe('Phase 4: Real Member Management (FEAT-002)', () => {
  let app;
  let pool;
  let ownerToken;
  let alexLeadOrg1Token;
  let samMemberOrg1Token;
  let jordanLeadOrg2Token;

  before(async () => {
    pool = await setupTestDatabase();
    app = await createTestApp();

    // 1. Log in Len (Owner)
    const lenRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'len@example.com', password: 'password123456' },
    });
    ownerToken = JSON.parse(lenRes.body).accessToken;

    // 2. Log in Alex Rivera (Lead in org-1, Member in org-2)
    const alexRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alex@example.com', password: 'password123456' },
    });
    alexLeadOrg1Token = JSON.parse(alexRes.body).accessToken;

    // 3. Log in Sam Taylor (Member in org-1 and org-2)
    const samRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'sam@example.com', password: 'password123456' },
    });
    samMemberOrg1Token = JSON.parse(samRes.body).accessToken;

    // 4. Log in Jordan Lee (Lead in org-2 only)
    const jordanRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'jordan@example.com', password: 'password123456' },
    });
    jordanLeadOrg2Token = JSON.parse(jordanRes.body).accessToken;
  });

  after(async () => {
    if (app) await app.close();
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    clearCapturedEmails();
    setSimulateEmailFailure(false);
  });

  describe('1. Scoped Member Listing, Search, Filter & Pagination (REQ-001, REQ-002)', () => {
    test('Lead can list members with pagination and default limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members?page=1&limit=10',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.members));
      assert.ok(data.total >= 3); // Len, Alex, Sam
      assert.equal(data.page, 1);
      assert.equal(data.limit, 10);
      assert.equal(data.hasMore, false);

      // Verify Jordan (org-2 only) is NOT in org-1
      const foundJordan = data.members.find(m => m.email === 'jordan@example.com');
      assert.equal(foundJordan, undefined);
    });

    test('Search by name or email returns matching records only', async () => {
      // Search by email substring 'alex'
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members?search=alex',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.members.length, 1);
      assert.equal(data.members[0].email, 'alex@example.com');

      // Search by display name 'Sam'
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members?search=Sam',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res2.statusCode, 200);
      const data2 = JSON.parse(res2.body);
      assert.equal(data2.members.length, 1);
      assert.equal(data2.members[0].displayName, 'Sam Taylor');
    });

    test('Filter by role and status returns only matching records', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members?role=Member&status=active',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.members.every(m => m.role === 'Member' && m.status === 'active'));
    });
  });

  describe('2. Private Notes Redaction (REQ-007)', () => {
    test('Lead and Owner can see membership notes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      const lenMem = data.members.find(m => m.email === 'len@example.com');
      assert.ok(lenMem);
      assert.ok(typeof lenMem.notes === 'string');
      assert.match(lenMem.notes, /Founder and global owner/i);
    });

    test('Members CANNOT read notes even in raw API responses (notes field omitted)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      for (const m of data.members) {
        assert.equal(m.notes, undefined, `Member ${m.email} notes must not be leaked to Member role`);
      }

      // Also verify on single member GET
      const singleRes = await app.inject({
        method: 'GET',
        url: `/api/organizations/org-1/members/mem-alex-1`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });

      assert.equal(singleRes.statusCode, 200);
      const singleData = JSON.parse(singleRes.body);
      assert.equal(singleData.notes, undefined, 'Single member detail must not leak notes to Member');
    });
  });

  describe('3. Organization Isolation & Cross-Org Protection (REQ-006)', () => {
    test('Lead in Org A cannot view members in Org B', async () => {
      // Jordan is Lead in org-2 only, not a member of org-1
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members',
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Lead in Org B cannot mutate Org A memberships', async () => {
      // Jordan (org-2 Lead) attempts to mutate Alex in org-1
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-alex-1',
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
        payload: { status: 'inactive' },
      });

      assert.equal(res.statusCode, 403);
    });
  });

  describe('4. Privilege Elevation & Owner Protection (REQ-005, REQ-006)', () => {
    test('Member cannot update memberships', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: { role: 'Lead' },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Lead cannot promote a Member to Lead (privilege elevation rejected)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { role: 'Lead' },
      });

      assert.equal(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.match(body.message, /Owner can promote/i);
    });

    test('Lead cannot alter another Lead in the same organization', async () => {
      // Alex (Lead) tries to alter Len (Owner/Lead) or another Lead
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-len-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { notes: 'Attempted edit by peer lead' },
      });

      assert.equal(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.match(body.message, /cannot alter other Leads/i);
    });

    test('Global Owner cannot be demoted or deactivated', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-len-1',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { role: 'Member', status: 'inactive' },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.message, /Global owner cannot be demoted/i);
    });

    test('Owner can promote a Member to Lead', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { role: 'Lead' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.role, 'Lead');

      // Restore Sam to Member for subsequent tests
      await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { role: 'Member' },
      });
    });
  });

  describe('5. Safe Deactivation & Task Unassignment (REQ-008)', () => {
    test('Deactivation clears open tasks in this org only and preserves completed tasks', async () => {
      // Prior to deactivation: Sam has open task 'tsk-103' in org-1, and 'tsk-104' in org-2
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { status: 'inactive' },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.status, 'inactive');
      assert.equal(data.unassignedTaskCount, 1); // tsk-103 in org-1 unassigned

      // Verify org-1 open task tsk-103 is now unassigned
      const task103 = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', ['tsk-103']);
      assert.equal(task103.rows[0].assignee_id, null);

      // Verify org-2 task tsk-104 is UNTOUCHED (still assigned to Sam)
      const task104 = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', ['tsk-104']);
      assert.equal(task104.rows[0].assignee_id, 'usr-sam');

      // Verify activity event recorded for deactivation
      const act = await pool.query(
        "SELECT action, metadata FROM activity_events WHERE entity_id = 'mem-sam-1' AND action = 'deactivate' ORDER BY created_at DESC LIMIT 1"
      );
      assert.equal(act.rows.length, 1);
      assert.equal(act.rows[0].metadata.unassignedTasks, 1);

      // Reactivate Sam in org-1
      const reactivateRes = await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { status: 'active' },
      });
      assert.equal(reactivateRes.statusCode, 200);
    });

    test('Concurrent deactivation is safe and idempotent', async () => {
      const [call1, call2] = await Promise.all([
        app.inject({
          method: 'PATCH',
          url: '/api/organizations/org-1/members/mem-sam-1',
          headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
          payload: { status: 'inactive' },
        }),
        app.inject({
          method: 'PATCH',
          url: '/api/organizations/org-1/members/mem-sam-1',
          headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
          payload: { status: 'inactive' },
        }),
      ]);

      assert.equal(call1.statusCode, 200);
      assert.equal(call2.statusCode, 200);

      // Reactivate Sam
      await app.inject({
        method: 'PATCH',
        url: '/api/organizations/org-1/members/mem-sam-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { status: 'active' },
      });
    });
  });

  describe('6. Invitation Lifecycle, SMTP Capture & Delivery Recovery (REQ-003, REQ-004, REQ-009)', () => {
    test('Lead can invite a member and email is captured locally', async () => {
      const inviteEmail = 'new_hire_dev@example.com';
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/invitations',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { email: inviteEmail, role: 'Member' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.emailSent, true);
      assert.equal(body.invitation.email, inviteEmail);
      assert.equal(body.invitation.status, 'pending');

      // Assert captured email
      const captured = getCapturedEmails();
      assert.equal(captured.length, 1);
      assert.equal(captured[0].to, inviteEmail);
      assert.match(captured[0].inviteUrl, /token=/);
    });

    test('Duplicate pending invitation is rejected with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/invitations',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { email: 'new_hire_dev@example.com', role: 'Member' },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.message, /pending invitation already exists/i);
    });

    test('Invitation to already active member is rejected with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/invitations',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { email: 'alex@example.com', role: 'Member' },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.message, /already an active member/i);
    });

    test('Simulated SMTP failure records delivery_failed status with feedback', async () => {
      setSimulateEmailFailure(true);
      const failEmail = 'delivery_retry_user@example.com';
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/invitations',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { email: failEmail, role: 'Member' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.emailSent, false);
      assert.equal(body.invitation.status, 'delivery_failed');
      assert.ok(body.deliveryError);

      // Verify in database
      const row = await pool.query('SELECT status, delivery_error FROM invitations WHERE id = $1', [body.invitation.id]);
      assert.equal(row.rows[0].status, 'delivery_failed');
      assert.ok(row.rows[0].delivery_error);
    });

    test('Explicit resend replaces invitation token and clears failure status', async () => {
      // 1. Fetch delivery_failed invitation
      const invRow = await pool.query("SELECT id, token_digest FROM invitations WHERE email = 'delivery_retry_user@example.com'");
      const invId = invRow.rows[0].id;
      const oldDigest = invRow.rows[0].token_digest;

      // 2. Resend with failure simulation disabled
      setSimulateEmailFailure(false);
      const res = await app.inject({
        method: 'POST',
        url: `/api/organizations/org-1/invitations/${invId}/resend`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.token);

      // Verify token digest was replaced in database
      const updatedRow = await pool.query('SELECT token_digest, status, delivery_error FROM invitations WHERE id = $1', [invId]);
      assert.notEqual(updatedRow.rows[0].token_digest, oldDigest);
      assert.equal(updatedRow.rows[0].delivery_error, null);
    });

    test('Complete invite-to-member journey through local inbox and API acceptance', async () => {
      const inviteEmail = 'end_to_end_joiner@example.com';
      clearCapturedEmails();

      // 1. Lead creates invitation
      const inviteRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/invitations',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: { email: inviteEmail, role: 'Member' },
      });
      assert.equal(inviteRes.statusCode, 200);

      // 2. Read token from captured local inbox
      const captured = getCapturedEmails();
      assert.equal(captured.length, 1);
      assert.equal(captured[0].to, inviteEmail);
      const tokenMatch = captured[0].inviteUrl.match(/token=([a-f0-9]+)/);
      assert.ok(tokenMatch);
      const inviteToken = tokenMatch[1];

      // 3. User accepts invitation via API
      const acceptRes = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: inviteEmail,
          displayName: 'End-to-End Joiner',
          password: 'securePassword123456!',
        },
      });

      assert.equal(acceptRes.statusCode, 200);
      const acceptData = JSON.parse(acceptRes.body);
      assert.equal(acceptData.success, true);
      assert.equal(acceptData.organizationId, 'org-1');

      // 4. Verify membership exists in organization listing
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/members?search=End-to-End',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      assert.equal(listRes.statusCode, 200);
      const listData = JSON.parse(listRes.body);
      assert.equal(listData.members.length, 1);
      assert.equal(listData.members[0].displayName, 'End-to-End Joiner');
      assert.equal(listData.members[0].role, 'Member');
      assert.equal(listData.members[0].status, 'active');

      // 5. Assert used token cannot be accepted again (no duplicate membership)
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/auth/invitation/accept',
        payload: {
          token: inviteToken,
          email: inviteEmail,
          displayName: 'End-to-End Joiner Duplicate',
          password: 'securePassword123456!',
        },
      });
      assert.equal(reuseRes.statusCode, 400);

      // Verify still exactly 1 membership
      const countRow = await pool.query(
        "SELECT COUNT(*) AS total FROM memberships m JOIN users u ON m.user_id = u.id WHERE u.email = $1",
        [inviteEmail]
      );
      assert.equal(parseInt(countRow.rows[0].total, 10), 1);
    });
  });

  describe('7. Own-Profile Editing (REQ-007)', () => {
    test('Member can update their own display name, avatar color, skills, and interests', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/profile',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          displayName: 'Sam Taylor Senior',
          avatarColor: '#2563EB',
          skills: ['Playwright', 'Fastify', 'Security Auditing'],
          interests: ['Open Source', 'Mentorship'],
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.user.displayName, 'Sam Taylor Senior');
      assert.equal(body.user.avatarColor, '#2563EB');
      assert.deepEqual(body.user.skills, ['Playwright', 'Fastify', 'Security Auditing']);
      assert.deepEqual(body.user.interests, ['Open Source', 'Mentorship']);

      // Revert display name
      await app.inject({
        method: 'PATCH',
        url: '/api/users/profile',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: { displayName: 'Sam Taylor' },
      });
    });

    test('Profile update with invalid length or color is rejected with 400', async () => {
      const emptyNameRes = await app.inject({
        method: 'PATCH',
        url: '/api/users/profile',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: { displayName: '' },
      });
      assert.equal(emptyNameRes.statusCode, 400);

      const invalidColorRes = await app.inject({
        method: 'PATCH',
        url: '/api/users/profile',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: { avatarColor: 'not-a-color' },
      });
      assert.equal(invalidColorRes.statusCode, 400);
    });
  });
});
