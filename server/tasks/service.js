import { query, withTransaction } from '../../db/client.js';
import { generateRandomToken } from '../auth/crypto.js';
import { getCallerOrgPermission } from '../members/service.js';

const VALID_STATUSES = ['Backlog', 'In progress', 'Blocked', 'Done'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

/**
 * List tasks for an organization with rich search, filters, overdue calculation, and pagination.
 */
export async function listTasks(orgId, filters = {}, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const page = Math.max(1, parseInt(filters.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '25', 10)));
  const offset = (page - 1) * limit;

  const conditions = ['t.organization_id = $1'];
  const params = [orgId];
  let paramIdx = 2;

  // Archival filter: default is unarchived
  if (filters.archived === 'true') {
    conditions.push('t.archived_at IS NOT NULL');
  } else {
    conditions.push('t.archived_at IS NULL');
  }

  if (filters.search) {
    conditions.push(`(t.title ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx})`);
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
  }

  if (filters.status && VALID_STATUSES.includes(filters.status)) {
    conditions.push(`t.status = $${paramIdx}`);
    params.push(filters.status);
    paramIdx++;
  }

  if (filters.priority && VALID_PRIORITIES.includes(filters.priority)) {
    conditions.push(`t.priority = $${paramIdx}`);
    params.push(filters.priority);
    paramIdx++;
  }

  if (filters.assignee) {
    if (filters.assignee === 'unassigned') {
      conditions.push('t.assignee_id IS NULL');
    } else {
      conditions.push(`t.assignee_id = $${paramIdx}`);
      params.push(filters.assignee);
      paramIdx++;
    }
  }

  if (filters.label) {
    conditions.push(`t.labels ? $${paramIdx}`);
    params.push(filters.label.trim());
    paramIdx++;
  }

  if (filters.overdue === 'true') {
    conditions.push(`t.due_date < CURRENT_DATE AND t.status != 'Done' AND t.archived_at IS NULL`);
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching
  const countRes = await q(
    `SELECT COUNT(*) AS total FROM tasks t WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].total, 10);

  // Fetch records with creator and assignee names
  const queryParams = [...params, limit, offset];
  const listRes = await q(
    `SELECT
       t.id,
       t.organization_id AS "orgId",
       t.title,
       t.description,
       t.creator_id AS "creatorId",
       cu.display_name AS "creatorName",
       t.assignee_id AS "assigneeId",
       au.display_name AS "assigneeName",
       au.avatar_color AS "assigneeAvatarColor",
       t.status,
       t.priority,
       TO_CHAR(t.due_date, 'YYYY-MM-DD') AS "dueDate",
       t.labels,
       t.version,
       t.archived_at AS "archivedAt",
       t.created_at AS "createdAt",
       t.updated_at AS "updatedAt",
       (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS "commentCount"
     FROM tasks t
     JOIN users cu ON t.creator_id = cu.id
     LEFT JOIN users au ON t.assignee_id = au.id
     WHERE ${whereClause}
     ORDER BY
       CASE WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status != 'Done' THEN 0 ELSE 1 END,
       t.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    queryParams
  );

  const tasks = listRes.rows.map(row => ({
    id: row.id,
    orgId: row.orgId,
    title: row.title,
    description: row.description || '',
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName || 'Unassigned',
    assigneeAvatarColor: row.assigneeAvatarColor || '#64748B',
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    labels: row.labels || [],
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    commentCount: parseInt(row.commentCount, 10),
  }));

  return {
    tasks,
    total,
    page,
    limit,
    hasMore: offset + tasks.length < total,
  };
}

/**
 * Get single task details including comments and permissions.
 */
export async function getTask(orgId, taskId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const res = await q(
    `SELECT
       t.id,
       t.organization_id AS "orgId",
       t.title,
       t.description,
       t.creator_id AS "creatorId",
       cu.display_name AS "creatorName",
       t.assignee_id AS "assigneeId",
       au.display_name AS "assigneeName",
       au.avatar_color AS "assigneeAvatarColor",
       t.status,
       t.priority,
       TO_CHAR(t.due_date, 'YYYY-MM-DD') AS "dueDate",
       t.labels,
       t.version,
       t.archived_at AS "archivedAt",
       t.created_at AS "createdAt",
       t.updated_at AS "updatedAt"
     FROM tasks t
     JOIN users cu ON t.creator_id = cu.id
     LEFT JOIN users au ON t.assignee_id = au.id
     WHERE t.id = $1 AND t.organization_id = $2`,
    [taskId, orgId]
  );

  if (res.rows.length === 0) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const row = res.rows[0];

  return {
    id: row.id,
    orgId: row.orgId,
    title: row.title,
    description: row.description || '',
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName || 'Unassigned',
    assigneeAvatarColor: row.assigneeAvatarColor || '#64748B',
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    labels: row.labels || [],
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create a new task in an organization.
 * Only Lead or Owner can create tasks.
 */
export async function createTask(orgId, taskData, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
    const error = new Error('Only organization Leads and Owner can create tasks.');
    error.statusCode = 403;
    throw error;
  }

  const { title, description = '', assigneeId = null, priority = 'Medium', status = 'Backlog', dueDate = null, labels = [] } = taskData;

  if (!title || title.trim().length === 0 || title.length > 200) {
    const error = new Error('Title is required and must be between 1 and 200 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_STATUSES.includes(status)) {
    const error = new Error(`Invalid status: must be one of ${VALID_STATUSES.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    const error = new Error(`Invalid priority: must be one of ${VALID_PRIORITIES.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  if (dueDate !== null && dueDate !== undefined && dueDate !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || isNaN(Date.parse(dueDate))) {
      const error = new Error('Due date must be in YYYY-MM-DD format.');
      error.statusCode = 400;
      throw error;
    }
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  // Validate assignee if provided
  let validatedAssigneeId = null;
  if (assigneeId) {
    const memRes = await q(
      `SELECT user_id FROM memberships
       WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
      [assigneeId, orgId]
    );
    if (memRes.rows.length === 0) {
      const error = new Error('Assignee must be an active member of this organization.');
      error.statusCode = 400;
      throw error;
    }
    validatedAssigneeId = assigneeId;
  }

  const taskId = 'tsk-' + generateRandomToken(12);
  const cleanLabels = Array.isArray(labels) ? labels.map(l => String(l).trim()).filter(Boolean) : [];

  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const insertRes = await client.query(
      `INSERT INTO tasks (id, organization_id, title, description, creator_id, assignee_id, status, priority, due_date, labels, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 1)
       RETURNING id, organization_id AS "orgId", title, description, creator_id AS "creatorId", assignee_id AS "assigneeId", status, priority, TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", labels, version, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        taskId,
        orgId,
        title.trim(),
        description.trim(),
        caller.id,
        validatedAssigneeId,
        status,
        priority,
        dueDate || null,
        JSON.stringify(cleanLabels),
      ]
    );

    // Record creation event
    await client.query(
      `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
       VALUES ($1, $2, $3, 'task', $4, 'create', $5)`,
      [
        'act-' + generateRandomToken(12),
        orgId,
        caller.id,
        taskId,
        JSON.stringify({ title: title.trim(), assigneeId: validatedAssigneeId, status, priority }),
      ]
    );

    return insertRes.rows[0];
  });
}

/**
 * Update task fields or status.
 * Assigned members can update ONLY status.
 * Leads and Owner can update any field.
 * Enforces optimistic concurrency (version match).
 */
export async function updateTask(orgId, taskId, updates, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  // 1. Fetch current task
  const taskRes = await q(
    `SELECT t.*, TO_CHAR(t.due_date, 'YYYY-MM-DD') AS "dueDateStr"
     FROM tasks t
     WHERE t.id = $1 AND t.organization_id = $2`,
    [taskId, orgId]
  );

  if (taskRes.rows.length === 0) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const current = taskRes.rows[0];

  // 2. Reject edits to archived tasks
  if (current.archived_at !== null) {
    const error = new Error('Archived tasks are read-only and cannot be modified.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Optimistic Concurrency Check
  if (updates.version !== undefined && updates.version !== null) {
    if (parseInt(updates.version, 10) !== current.version) {
      const error = new Error('This task was modified by another user. Please refresh and review before saving.');
      error.statusCode = 409;
      throw error;
    }
  }

  // 4. Role-based field permissions
  const isLeadOrOwner = perm.isOwner || perm.isLead;
  const isAssignedMember = current.assignee_id === caller.id;

  if (!isLeadOrOwner) {
    if (!isAssignedMember) {
      const error = new Error('Members can only update status on their assigned tasks.');
      error.statusCode = 403;
      throw error;
    }

    // Member attempting to update restricted fields
    const restrictedAttempted = ['title', 'description', 'assigneeId', 'priority', 'dueDate', 'labels', 'archived']
      .some(field => updates[field] !== undefined);

    if (restrictedAttempted) {
      const error = new Error('Members can only update the status field of assigned tasks.');
      error.statusCode = 403;
      throw error;
    }

    if (!updates.status || !VALID_STATUSES.includes(updates.status)) {
      const error = new Error(`Invalid status: must be one of ${VALID_STATUSES.join(', ')}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // 5. Validation for fields if provided by Lead/Owner
  let newTitle = current.title;
  let newDescription = current.description || '';
  let newAssigneeId = current.assignee_id;
  let newStatus = current.status;
  let newPriority = current.priority;
  let newDueDate = current.dueDateStr;
  let newLabels = current.labels || [];

  if (updates.title !== undefined) {
    if (!updates.title || updates.title.trim().length === 0 || updates.title.length > 200) {
      const error = new Error('Title must be between 1 and 200 characters.');
      error.statusCode = 400;
      throw error;
    }
    newTitle = updates.title.trim();
  }

  if (updates.description !== undefined) {
    newDescription = String(updates.description || '').trim();
  }

  if (updates.status !== undefined) {
    if (!VALID_STATUSES.includes(updates.status)) {
      const error = new Error(`Invalid status: must be one of ${VALID_STATUSES.join(', ')}.`);
      error.statusCode = 400;
      throw error;
    }
    newStatus = updates.status;
  }

  if (updates.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(updates.priority)) {
      const error = new Error(`Invalid priority: must be one of ${VALID_PRIORITIES.join(', ')}.`);
      error.statusCode = 400;
      throw error;
    }
    newPriority = updates.priority;
  }

  if (updates.dueDate !== undefined) {
    if (updates.dueDate === null || updates.dueDate === '') {
      newDueDate = null;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.dueDate) || isNaN(Date.parse(updates.dueDate))) {
        const error = new Error('Due date must be in YYYY-MM-DD format.');
        error.statusCode = 400;
        throw error;
      }
      newDueDate = updates.dueDate;
    }
  }

  if (updates.labels !== undefined) {
    newLabels = Array.isArray(updates.labels) ? updates.labels.map(l => String(l).trim()).filter(Boolean) : [];
  }

  if (updates.assigneeId !== undefined) {
    if (updates.assigneeId === null || updates.assigneeId === '') {
      newAssigneeId = null;
    } else {
      // Must be active member of this organization
      const memRes = await q(
        `SELECT user_id FROM memberships
         WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
        [updates.assigneeId, orgId]
      );
      if (memRes.rows.length === 0) {
        const error = new Error('Assignee must be an active member of this organization.');
        error.statusCode = 400;
        throw error;
      }
      newAssigneeId = updates.assigneeId;
    }
  }

  // 6. Execute atomic update
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const nextVersion = current.version + 1;

    const updateRes = await client.query(
      `UPDATE tasks
       SET title = $1, description = $2, assignee_id = $3, status = $4, priority = $5, due_date = $6, labels = $7::jsonb, version = $8, updated_at = NOW()
       WHERE id = $9 AND organization_id = $10 AND version = $11
       RETURNING id, organization_id AS "orgId", title, description, creator_id AS "creatorId", assignee_id AS "assigneeId", status, priority, TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", labels, version, updated_at AS "updatedAt"`,
      [
        newTitle,
        newDescription,
        newAssigneeId,
        newStatus,
        newPriority,
        newDueDate,
        JSON.stringify(newLabels),
        nextVersion,
        taskId,
        orgId,
        current.version,
      ]
    );

    if (updateRes.rows.length === 0) {
      const error = new Error('This task was modified by another user. Please refresh and review before saving.');
      error.statusCode = 409;
      throw error;
    }

    // Record activity events
    if (newStatus !== current.status) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'task', $4, 'status_change', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          taskId,
          JSON.stringify({ oldStatus: current.status, newStatus }),
        ]
      );
    }

    if (newAssigneeId !== current.assignee_id) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'task', $4, 'assignment', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          taskId,
          JSON.stringify({ oldAssigneeId: current.assignee_id, newAssigneeId }),
        ]
      );
    }

    return updateRes.rows[0];
  });
}

/**
 * Archive a task (soft delete with history preserved).
 * Only Lead or Owner can archive.
 */
export async function archiveTask(orgId, taskId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
    const error = new Error('Only organization Leads and Owner can archive tasks.');
    error.statusCode = 403;
    throw error;
  }

  const pool = customPool;
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const taskRes = await client.query(
      'SELECT id, title, archived_at FROM tasks WHERE id = $1 AND organization_id = $2',
      [taskId, orgId]
    );

    if (taskRes.rows.length === 0) {
      const error = new Error('Task not found.');
      error.statusCode = 404;
      throw error;
    }

    if (taskRes.rows[0].archived_at !== null) {
      const error = new Error('Task is already archived.');
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      'UPDATE tasks SET archived_at = NOW(), updated_at = NOW() WHERE id = $1',
      [taskId]
    );

    // Record activity event
    await client.query(
      `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
       VALUES ($1, $2, $3, 'task', $4, 'archive', $5)`,
      [
        'act-' + generateRandomToken(12),
        orgId,
        caller.id,
        taskId,
        JSON.stringify({ title: taskRes.rows[0].title }),
      ]
    );

    return { success: true, taskId, archived: true };
  });
}

/**
 * List comments on a task.
 */
export async function listComments(orgId, taskId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  // Verify task exists in org
  const taskRes = await q('SELECT id FROM tasks WHERE id = $1 AND organization_id = $2', [taskId, orgId]);
  if (taskRes.rows.length === 0) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const res = await q(
    `SELECT
       tc.id,
       tc.task_id AS "taskId",
       tc.author_id AS "authorId",
       u.display_name AS "authorName",
       u.avatar_color AS "authorAvatarColor",
       u.email AS "authorEmail",
       tc.body,
       tc.created_at AS "createdAt",
       tc.updated_at AS "updatedAt"
     FROM task_comments tc
     JOIN users u ON tc.author_id = u.id
     WHERE tc.task_id = $1
     ORDER BY tc.created_at ASC`,
    [taskId]
  );

  return res.rows;
}

/**
 * Add a comment to a task.
 */
export async function addComment(orgId, taskId, { body }, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  if (!body || body.trim().length === 0) {
    const error = new Error('Comment body cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  const taskRes = await q('SELECT id, archived_at FROM tasks WHERE id = $1 AND organization_id = $2', [taskId, orgId]);
  if (taskRes.rows.length === 0) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  if (taskRes.rows[0].archived_at !== null) {
    const error = new Error('Cannot add comments to an archived task.');
    error.statusCode = 400;
    throw error;
  }

  const commentId = 'com-' + generateRandomToken(12);

  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const insertRes = await client.query(
      `INSERT INTO task_comments (id, task_id, author_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, task_id AS "taskId", author_id AS "authorId", body, created_at AS "createdAt"`,
      [commentId, taskId, caller.id, body.trim()]
    );

    // Record activity event
    await client.query(
      `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
       VALUES ($1, $2, $3, 'task', $4, 'comment', $5)`,
      [
        'act-' + generateRandomToken(12),
        orgId,
        caller.id,
        taskId,
        JSON.stringify({ commentId, excerpt: body.trim().slice(0, 50) }),
      ]
    );

    const comment = insertRes.rows[0];
    return {
      ...comment,
      authorName: caller.displayName,
      authorAvatarColor: caller.avatarColor,
    };
  });
}

/**
 * Edit a comment (author only).
 */
export async function updateComment(orgId, taskId, commentId, { body }, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  if (!body || body.trim().length === 0) {
    const error = new Error('Comment body cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  const comRes = await q(
    `SELECT tc.id, tc.author_id, t.archived_at
     FROM task_comments tc
     JOIN tasks t ON tc.task_id = t.id
     WHERE tc.id = $1 AND tc.task_id = $2 AND t.organization_id = $3`,
    [commentId, taskId, orgId]
  );

  if (comRes.rows.length === 0) {
    const error = new Error('Comment not found.');
    error.statusCode = 404;
    throw error;
  }

  if (comRes.rows[0].archived_at !== null) {
    const error = new Error('Cannot edit comments on an archived task.');
    error.statusCode = 400;
    throw error;
  }

  // Spec: "Authors can edit or remove their comments while membership is active; Owner and authorized Leads can remove inappropriate comments but cannot rewrite another author's words."
  if (comRes.rows[0].author_id !== caller.id) {
    const error = new Error('You can only edit your own comments.');
    error.statusCode = 403;
    throw error;
  }

  const updateRes = await q(
    `UPDATE task_comments
     SET body = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, task_id AS "taskId", author_id AS "authorId", body, updated_at AS "updatedAt"`,
    [body.trim(), commentId]
  );

  return updateRes.rows[0];
}

/**
 * Delete a comment (author OR Lead/Owner moderation).
 */
export async function deleteComment(orgId, taskId, commentId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  const comRes = await q(
    `SELECT tc.id, tc.author_id, t.archived_at
     FROM task_comments tc
     JOIN tasks t ON tc.task_id = t.id
     WHERE tc.id = $1 AND tc.task_id = $2 AND t.organization_id = $3`,
    [commentId, taskId, orgId]
  );

  if (comRes.rows.length === 0) {
    const error = new Error('Comment not found.');
    error.statusCode = 404;
    throw error;
  }

  const isAuthor = comRes.rows[0].author_id === caller.id;
  const isLeadOrOwner = perm.isOwner || perm.isLead;

  if (!isAuthor && !isLeadOrOwner) {
    const error = new Error('You do not have permission to delete this comment.');
    error.statusCode = 403;
    throw error;
  }

  await q('DELETE FROM task_comments WHERE id = $1', [commentId]);

  return { success: true, commentId };
}

/**
 * Get activity history for a specific task.
 */
export async function getTaskActivity(orgId, taskId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const res = await q(
    `SELECT
       ae.id,
       ae.action,
       ae.metadata,
       ae.created_at AS "createdAt",
       u.display_name AS "actorName",
       u.avatar_color AS "actorAvatarColor"
     FROM activity_events ae
     JOIN users u ON ae.actor_id = u.id
     WHERE ae.entity_type = 'task' AND ae.entity_id = $1 AND ae.organization_id = $2
     ORDER BY ae.created_at DESC`,
    [taskId, orgId]
  );

  return res.rows;
}
