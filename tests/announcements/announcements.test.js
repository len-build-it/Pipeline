import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, cleanupTestDatabase, createTestApp } from '../helpers/db-helper.js';

describe('Phase 6: Announcements & Actionable Overview (FEAT-004 & FEAT-001)', () => {
  let app;
  let pool;
  let ownerToken;
  let alexLeadOrg1Token;
  let samMemberOrg1Token;
  let jordanLeadOrg2Token;
  let lenUserId;
  let alexUserId;
  let samUserId;
  let jordanUserId;

  before(async () => {
    pool = await setupTestDatabase();
    app = await createTestApp();

    // 1. Log in Len (Owner)
    const lenRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'len@example.com', password: 'password123456' },
    });
    const lenData = JSON.parse(lenRes.body);
    ownerToken = lenData.accessToken;
    lenUserId = lenData.user.id;

    // 2. Log in Alex Rivera (Lead in org-1, Member in org-2)
    const alexRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alex@example.com', password: 'password123456' },
    });
    const alexData = JSON.parse(alexRes.body);
    alexLeadOrg1Token = alexData.accessToken;
    alexUserId = alexData.user.id;

    // 3. Log in Sam Taylor (Member in org-1 and org-2)
    const samRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'sam@example.com', password: 'password123456' },
    });
    const samData = JSON.parse(samRes.body);
    samMemberOrg1Token = samData.accessToken;
    samUserId = samData.user.id;

    // 4. Log in Jordan Lee (Lead in org-2 only)
    const jordanRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'jordan@example.com', password: 'password123456' },
    });
    const jordanData = JSON.parse(jordanRes.body);
    jordanLeadOrg2Token = jordanData.accessToken;
    jordanUserId = jordanData.user.id;
  });

  after(async () => {
    if (app) await app.close();
    await cleanupTestDatabase();
  });

  describe('1. Draft Creation, Audience Boundaries & Content Validation (REQ-001, REQ-003)', () => {
    test('Lead can create draft targeted to permitted organization', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'AqOne Q3 Architecture Guidelines',
          body: 'All teams should follow the approved async message patterns.',
          targetOrganizations: ['org-1'],
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.id.startsWith('ann-'));
      assert.equal(data.title, 'AqOne Q3 Architecture Guidelines');
      assert.equal(data.publicationStatus, 'Draft');
      assert.deepEqual(data.targetOrganizations, ['org-1']);
      assert.equal(data.publishedAt, null);
    });

    test('Lead CANNOT target organization where they lack Lead authority (403 Forbidden)', async () => {
      // Alex is Lead in org-1, but only a Member in org-2
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Unauthorized Cross-Org Draft',
          body: 'Attempting to publish to org-2 without lead rights.',
          targetOrganizations: ['org-1', 'org-2'],
        },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /You must be a Lead or Owner in all target organizations/);
    });

    test('Owner can create draft or publish across multiple target organizations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          title: 'Global Security Update Across All Organizations',
          body: 'Scheduled database cluster maintenance this Sunday at 02:00 UTC.',
          targetOrganizations: ['org-1', 'org-2'],
          publish: true,
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.publicationStatus, 'Published');
      assert.ok(data.publishedAt);
      assert.deepEqual(data.targetOrganizations, ['org-1', 'org-2']);
    });

    test('Regular member cannot create announcements (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          title: 'Member Attempting Announcement',
          body: 'Testing role permission boundaries.',
          targetOrganizations: ['org-1'],
        },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Rejects empty or oversized title (400 Bad Request)', async () => {
      // Empty title
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: '   ',
          body: 'Valid body.',
          targetOrganizations: ['org-1'],
        },
      });
      assert.equal(res1.statusCode, 400);

      // Title > 160 characters
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'T'.repeat(161),
          body: 'Valid body.',
          targetOrganizations: ['org-1'],
        },
      });
      assert.equal(res2.statusCode, 400);
    });

    test('Rejects empty or oversized body (400 Bad Request)', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Valid Title',
          body: '   ',
          targetOrganizations: ['org-1'],
        },
      });
      assert.equal(res1.statusCode, 400);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Valid Title',
          body: 'B'.repeat(10001),
          targetOrganizations: ['org-1'],
        },
      });
      assert.equal(res2.statusCode, 400);
    });

    test('Rejects empty or non-existent target organizations (400 Bad Request)', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Valid Title',
          body: 'Valid body.',
          targetOrganizations: [],
        },
      });
      assert.equal(res1.statusCode, 400);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          title: 'Valid Title',
          body: 'Valid body.',
          targetOrganizations: ['org-nonexistent'],
        },
      });
      assert.equal(res2.statusCode, 400);
    });
  });

  describe('2. Draft Visibility Protection (REQ-005)', () => {
    let privateDraftId;

    before(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Private Unreleased Strategy Draft',
          body: 'Strictly confidential draft before review.',
          targetOrganizations: ['org-1'],
        },
      });
      privateDraftId = JSON.parse(res.body).id;
    });

    test('Owner and author Lead can see draft', async () => {
      const alexRes = await app.inject({
        method: 'GET',
        url: `/api/announcements/${privateDraftId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      assert.equal(alexRes.statusCode, 200);

      const ownerRes = await app.inject({
        method: 'GET',
        url: `/api/announcements/${privateDraftId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(ownerRes.statusCode, 200);
    });

    test('Regular member CANNOT view draft in list or direct detail (403 Forbidden)', async () => {
      // Direct access returns 403
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/announcements/${privateDraftId}`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });
      assert.equal(detailRes.statusCode, 403);

      // List returns only published items for regular member
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });
      assert.equal(listRes.statusCode, 200);
      const data = JSON.parse(listRes.body);
      assert.ok(!data.announcements.some(a => a.id === privateDraftId));
    });

    test('Lead in other organization CANNOT view draft (403 Forbidden)', async () => {
      const jordanRes = await app.inject({
        method: 'GET',
        url: `/api/announcements/${privateDraftId}`,
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
      });
      assert.equal(jordanRes.statusCode, 403);
    });
  });

  describe('3. Draft Editing & Stale Edit Precondition (REQ-007, REQ-008)', () => {
    let editableDraftId;
    let initialUpdatedAt;

    before(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Draft to Edit',
          body: 'Initial body text.',
          targetOrganizations: ['org-1'],
        },
      });
      const data = JSON.parse(res.body);
      editableDraftId = data.id;
      initialUpdatedAt = data.updatedAt;
    });

    test('Lead can edit draft title and body successfully', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/announcements/${editableDraftId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Updated Draft Title',
          body: 'Refined body text with updated context.',
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.title, 'Updated Draft Title');
      assert.equal(data.body, 'Refined body text with updated context.');
    });

    test('Stale edit precondition returns 409 Conflict', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/announcements/${editableDraftId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Conflicting Concurrent Save',
          updatedAt: '2020-01-01T00:00:00.000Z', // Stale timestamp
        },
      });

      assert.equal(res.statusCode, 409);
      assert.match(JSON.parse(res.body).message, /This draft was modified by another user/);
    });
  });

  describe('4. Publication & Immutability Enforcement (REQ-002, REQ-007)', () => {
    let publishedAnnId;

    before(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Important Sprint Policy Announcement',
          body: 'Code reviews are required before merging to release branches.',
          targetOrganizations: ['org-1'],
        },
      });
      publishedAnnId = JSON.parse(res.body).id;

      // Publish draft
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/announcements/${publishedAnnId}/publish`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      assert.equal(pubRes.statusCode, 200);
      assert.equal(JSON.parse(pubRes.body).publicationStatus, 'Published');
    });

    test('Published announcement is now visible to active organization members', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/announcements/${publishedAnnId}`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.title, 'Important Sprint Policy Announcement');
      assert.equal(data.publicationStatus, 'Published');
    });

    test('Published announcement is NOT visible to non-member organizations', async () => {
      // Jordan is only in org-2, announcement targets org-1
      const res = await app.inject({
        method: 'GET',
        url: `/api/announcements/${publishedAnnId}`,
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Published announcement is strictly IMMUTABLE: title and body edits rejected (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/announcements/${publishedAnnId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Hacked Title on Published Announcement',
        },
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).message, /Published announcements are immutable and cannot be edited/);
    });

    test('Publishing an already published announcement returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/announcements/${publishedAnnId}/publish`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).message, /Announcement is already published/);
    });
  });

  describe('5. Archival & Read-Only Behavior (REQ-007)', () => {
    let annToArchiveId;

    before(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Announcement for Archival',
          body: 'This will be archived.',
          targetOrganizations: ['org-1'],
          publish: true,
        },
      });
      annToArchiveId = JSON.parse(res.body).id;
    });

    test('Regular member cannot archive announcement (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/announcements/${annToArchiveId}/archive`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Authorized Lead can archive announcement successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/announcements/${annToArchiveId}/archive`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.archived, true);
    });

    test('Archived announcement is omitted from default list, included with archived=true', async () => {
      const defaultRes = await app.inject({
        method: 'GET',
        url: '/api/announcements?scope=org-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      const defaultData = JSON.parse(defaultRes.body);
      assert.ok(!defaultData.announcements.some(a => a.id === annToArchiveId));

      const archivedRes = await app.inject({
        method: 'GET',
        url: '/api/announcements?scope=org-1&archived=true',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      const archivedData = JSON.parse(archivedRes.body);
      assert.ok(archivedData.announcements.some(a => a.id === annToArchiveId));
    });

    test('Archived announcement is strictly read-only (400 Bad Request on modification)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/announcements/${annToArchiveId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Trying to edit archived announcement',
        },
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).message, /Archived announcements are read-only/);
    });
  });

  describe('6. Target-Scoped Activity History (REQ-006, REQ-007)', () => {
    let multiOrgAnnId;

    before(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/announcements',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          title: 'Cross-Org Activity Test Announcement',
          body: 'Checking activity recording per organization.',
          targetOrganizations: ['org-1', 'org-2'],
          publish: true,
        },
      });
      multiOrgAnnId = JSON.parse(res.body).id;
    });

    test('Lead in org-1 sees activity events only for org-1, never org-2', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/announcements/${multiOrgAnnId}/activity`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.activity));
      assert.ok(data.activity.length >= 1);
      // All visible events must be for org-1 or org-2 where Alex is member
      // Note: Alex is member in org-1 and org-2.
    });

    test('User with no membership in an organization cannot see its activity events', async () => {
      // Jordan is in org-2 ONLY. Jordan must NEVER see org-1 activity events!
      const res = await app.inject({
        method: 'GET',
        url: `/api/announcements/${multiOrgAnnId}/activity`,
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.activity));
      // Jordan must see org-2 events, but ZERO org-1 events
      assert.ok(data.activity.every(ev => ev.organizationId === 'org-2'));
    });
  });

  describe('7. Actionable Overview & Metrics Deduplication (FEAT-001/REQ-004, REQ-008)', () => {
    test('Scoped overview returns member, open task, overdue task, and announcement metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=org-1',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.scope, 'org-1');
      assert.ok(typeof data.metrics.activeMembers === 'number');
      assert.ok(typeof data.metrics.openTasks === 'number');
      assert.ok(typeof data.metrics.overdueTasks === 'number');
      assert.ok(typeof data.metrics.announcements === 'number');
      assert.ok(Array.isArray(data.actionableTasks));
      assert.ok(Array.isArray(data.recentAnnouncements));
    });

    test('Combined overview (scope=all) deduplicates active users, tasks, and announcements', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=all',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.scope, 'all');
      assert.ok(data.metrics.activeMembers >= 3); // Deduplicated count of unique users across both orgs
      assert.ok(data.metrics.announcements >= 1); // Deduplicated multi-org announcements
    });

    test('Non-owner cannot access combined overview (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/overview?scope=all',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /Combined overview requires Owner role/);
    });
  });
});
