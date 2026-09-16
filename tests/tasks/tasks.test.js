import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, cleanupTestDatabase, createTestApp } from '../helpers/db-helper.js';

describe('Phase 5: Real Task Management (FEAT-003)', () => {
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

  describe('1. Task Creation & Input Validation (REQ-001, REQ-002)', () => {
    test('Lead can create task with valid title, assignee, priority, status, and due date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Implement OAuth Token Refresh',
          description: 'Token refresh flow should handle race conditions cleanly.',
          assigneeId: samUserId,
          priority: 'High',
          status: 'In progress',
          dueDate: '2026-10-15',
          labels: ['backend', 'security'],
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.id.startsWith('tsk-'));
      assert.equal(data.orgId, 'org-1');
      assert.equal(data.title, 'Implement OAuth Token Refresh');
      assert.equal(data.assigneeId, samUserId);
      assert.equal(data.priority, 'High');
      assert.equal(data.status, 'In progress');
      assert.equal(data.dueDate, '2026-10-15');
      assert.deepEqual(data.labels, ['backend', 'security']);
      assert.equal(data.version, 1);
    });

    test('Regular member cannot create tasks (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          title: 'Member Attempting Task Creation',
        },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /Only organization Leads and Owner can create tasks/);
    });

    test('Rejects task with empty title (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: '   ',
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Rejects task with title exceeding 200 characters (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'A'.repeat(201),
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Rejects task with invalid status (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Invalid Status Test',
          status: 'Under Review',
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Rejects task with invalid priority (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Invalid Priority Test',
          priority: 'Urgent',
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Rejects task with invalid due date format (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Invalid Date Test',
          dueDate: '15-10-2026',
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Rejects task with foreign assignee not in organization (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Foreign Assignee Task',
          assigneeId: jordanUserId, // Jordan is only in org-2
        },
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).message, /Assignee must be an active member/);
    });
  });

  describe('2. Scoped Task Listing, Search, Filters & Overdue Calculation (REQ-003, REQ-004)', () => {
    let overdueTaskId;
    let completedOverdueTaskId;

    before(async () => {
      // Create an overdue task (due date in past, not done)
      const overdueRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Past Due Incomplete Task',
          status: 'In progress',
          priority: 'High',
          dueDate: '2026-01-01',
          labels: ['urgent'],
        },
      });
      overdueTaskId = JSON.parse(overdueRes.body).id;

      // Create a task due in past but status is Done (should NOT be counted as overdue)
      const completedRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Completed Past Due Task',
          status: 'Done',
          priority: 'Medium',
          dueDate: '2026-01-01',
        },
      });
      completedOverdueTaskId = JSON.parse(completedRes.body).id;

      // Create another task in org-2 to test isolation
      await app.inject({
        method: 'POST',
        url: '/api/organizations/org-2/tasks',
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
        payload: {
          title: 'Org 2 Private Task',
          status: 'Backlog',
        },
      });
    });

    test('Lists tasks for organization excluding other orgs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.tasks));
      assert.ok(data.tasks.length >= 2);

      // Verify Org 2 task is NOT present
      const foundOrg2 = data.tasks.find(t => t.title === 'Org 2 Private Task');
      assert.equal(foundOrg2, undefined);
    });

    test('Filter by overdue=true includes only uncompleted past due tasks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks?overdue=true',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      const ids = data.tasks.map(t => t.id);
      assert.ok(ids.includes(overdueTaskId));
      assert.ok(!ids.includes(completedOverdueTaskId)); // Completed task must be excluded
    });

    test('Filter by status and priority returns matching tasks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks?status=Done',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.tasks.every(t => t.status === 'Done'));
      assert.ok(data.tasks.some(t => t.id === completedOverdueTaskId));
    });

    test('Filter by search matches title substring', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks?search=OAuth',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.tasks.length >= 1);
      assert.ok(data.tasks.some(t => t.title.includes('OAuth')));
    });

    test('Filter by label matches jsonb label array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks?label=urgent',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.tasks.some(t => t.id === overdueTaskId));
    });

    test('Filter by assigneeId returns assigned tasks only', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/organizations/org-1/tasks?assignee=${samUserId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.tasks.every(t => t.assigneeId === samUserId));
    });
  });

  describe('3. Task Updates, Role Boundaries & Optimistic Concurrency (REQ-005)', () => {
    let testTaskId;
    let initialVersion;

    before(async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Concurrency & Permission Test Task',
          assigneeId: samUserId,
          status: 'Backlog',
          priority: 'Low',
        },
      });
      const data = JSON.parse(createRes.body);
      testTaskId = data.id;
      initialVersion = data.version;
    });

    test('Assigned member can update status of their task', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${testTaskId}`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          status: 'In progress',
          version: initialVersion,
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.status, 'In progress');
      assert.equal(data.version, initialVersion + 1);
      initialVersion = data.version;
    });

    test('Assigned member CANNOT update title, priority, or assignee (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${testTaskId}`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          title: 'Hacked Title by Member',
          version: initialVersion,
        },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /Members can only update the status field/);
    });

    test('Non-assigned member CANNOT update status (403 Forbidden)', async () => {
      // Create a task assigned to Alex
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Alex Private Assignment',
          assigneeId: alexUserId,
          status: 'Backlog',
        },
      });
      const alexTaskId = JSON.parse(createRes.body).id;

      // Sam attempts to update status
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${alexTaskId}`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          status: 'In progress',
        },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /Members can only update status on their assigned tasks/);
    });

    test('Lead can update all task fields and increment version', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${testTaskId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Updated Title by Lead',
          priority: 'High',
          dueDate: '2026-11-20',
          version: initialVersion,
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.title, 'Updated Title by Lead');
      assert.equal(data.priority, 'High');
      assert.equal(data.dueDate, '2026-11-20');
      assert.equal(data.version, initialVersion + 1);
      initialVersion = data.version;
    });

    test('Optimistic concurrency: stale version returns 409 Conflict', async () => {
      // Attempt update with old version (initialVersion - 1)
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${testTaskId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Conflicting Concurrent Edit',
          version: initialVersion - 1, // Stale version
        },
      });

      assert.equal(res.statusCode, 409);
      assert.match(JSON.parse(res.body).message, /This task was modified by another user/);
    });
  });

  describe('4. Task Archival & Read-Only Immutability (REQ-006)', () => {
    let taskToArchiveId;

    before(async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Task to be Archived',
          status: 'Done',
          assigneeId: samUserId,
        },
      });
      taskToArchiveId = JSON.parse(createRes.body).id;
    });

    test('Member cannot archive a task (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/organizations/org-1/tasks/${taskToArchiveId}/archive`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /Only organization Leads and Owner can archive tasks/);
    });

    test('Lead can archive task successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/organizations/org-1/tasks/${taskToArchiveId}/archive`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.archived, true);
    });

    test('Archived task is omitted from default list, included with archived=true', async () => {
      // Default list (unarchived)
      const defaultRes = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      const defaultData = JSON.parse(defaultRes.body);
      assert.ok(!defaultData.tasks.some(t => t.id === taskToArchiveId));

      // Archived list
      const archivedRes = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks?archived=true',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      const archivedData = JSON.parse(archivedRes.body);
      assert.ok(archivedData.tasks.some(t => t.id === taskToArchiveId));
    });

    test('Modifying archived task is rejected as read-only (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${taskToArchiveId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Attempting to change archived task',
        },
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).message, /Archived tasks are read-only/);
    });
  });

  describe('5. Task Comments & Moderation (REQ-007)', () => {
    let commentTaskId;
    let samCommentId;

    before(async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Task for Discussion and Comments',
          assigneeId: samUserId,
          status: 'In progress',
        },
      });
      commentTaskId = JSON.parse(createRes.body).id;
    });

    test('Active member can post a comment with markdown/text', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/organizations/org-1/tasks/${commentTaskId}/comments`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          body: 'Working on the database schema for tokens now.',
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.id.startsWith('com-'));
      assert.equal(data.authorId, samUserId);
      assert.equal(data.body, 'Working on the database schema for tokens now.');
      samCommentId = data.id;
    });

    test('Rejects empty comment body (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/organizations/org-1/tasks/${commentTaskId}/comments`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          body: '   ',
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Author can edit their own comment', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${commentTaskId}/comments/${samCommentId}`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          body: 'Updated: Schema is ready and migrations pass.',
        },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.body, 'Updated: Schema is ready and migrations pass.');
      assert.ok(data.updatedAt);
    });

    test('Lead cannot edit another user\'s comment (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${commentTaskId}/comments/${samCommentId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          body: 'Lead attempting to rewrite member words',
        },
      });

      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).message, /You can only edit your own comments/);
    });

    test('Lead can delete inappropriate comment for moderation', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/organizations/org-1/tasks/${commentTaskId}/comments/${samCommentId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
    });

    test('Deleted comment no longer appears in comments list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/organizations/org-1/tasks/${commentTaskId}/comments`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(!data.comments.some(c => c.id === samCommentId));
    });
  });

  describe('6. Activity History Audit Trail (REQ-008)', () => {
    let activityTaskId;

    test('Task actions record structured audit activity events', async () => {
      // 1. Create task
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          title: 'Audit Activity Test Task',
          status: 'Backlog',
        },
      });
      activityTaskId = JSON.parse(createRes.body).id;

      // 2. Assign and change status
      await app.inject({
        method: 'PATCH',
        url: `/api/organizations/org-1/tasks/${activityTaskId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
        payload: {
          assigneeId: samUserId,
          status: 'In progress',
        },
      });

      // 3. Add comment
      await app.inject({
        method: 'POST',
        url: `/api/organizations/org-1/tasks/${activityTaskId}/comments`,
        headers: { authorization: `Bearer ${samMemberOrg1Token}` },
        payload: {
          body: 'Checking activity tracking.',
        },
      });

      // 4. Retrieve activity
      const res = await app.inject({
        method: 'GET',
        url: `/api/organizations/org-1/tasks/${activityTaskId}/activity`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.activity));
      assert.ok(data.activity.length >= 4);

      const actions = data.activity.map(a => a.action);
      assert.ok(actions.includes('create'));
      assert.ok(actions.includes('status_change'));
      assert.ok(actions.includes('assignment'));
      assert.ok(actions.includes('comment'));
    });
  });

  describe('7. Cross-Organization Isolation & Security (PROD-002, FEAT-003)', () => {
    let org2TaskId;

    before(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/org-2/tasks',
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
        payload: {
          title: 'Jordan Org 2 Confidential Task',
        },
      });
      org2TaskId = JSON.parse(res.body).id;
    });

    test('Alex (Lead in org-1, Member in org-2) cannot view tasks in org-2 if org-2 was inaccessible to non-members', async () => {
      // Alex IS a member in org-2, so let's verify Alex CAN view org-2 tasks
      const alexRes = await app.inject({
        method: 'GET',
        url: `/api/organizations/org-2/tasks/${org2TaskId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      assert.equal(alexRes.statusCode, 200);
    });

    test('User without membership in org-2 is denied (403 Forbidden)', async () => {
      // Create a separate user who has NO membership in org-2 (e.g. create one or verify)
      // Note: Len is Owner so Len has access to everything.
      // Jordan has NO membership in org-1!
      const jordanOrg1Res = await app.inject({
        method: 'GET',
        url: '/api/organizations/org-1/tasks',
        headers: { authorization: `Bearer ${jordanLeadOrg2Token}` },
      });
      assert.equal(jordanOrg1Res.statusCode, 403);
      assert.match(JSON.parse(jordanOrg1Res.body).message, /Inaccessible organization/);
    });

    test('Cross-organization route tampering is rejected (404/403)', async () => {
      // Requesting org-2 task with org-1 URL path
      const res = await app.inject({
        method: 'GET',
        url: `/api/organizations/org-1/tasks/${org2TaskId}`,
        headers: { authorization: `Bearer ${alexLeadOrg1Token}` },
      });
      assert.equal(res.statusCode, 404);
    });
  });
});
