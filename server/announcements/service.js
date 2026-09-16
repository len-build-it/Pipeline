import { query, withTransaction } from '../../db/client.js';
import { generateRandomToken } from '../auth/crypto.js';
import { getCallerOrgPermission } from '../members/service.js';

/**
 * Validate that target organizations are valid, non-empty, and caller is Lead or Owner in ALL of them.
 */
async function validateTargetsForManagement(targetOrganizations, caller, customPool = null) {
  if (!Array.isArray(targetOrganizations) || targetOrganizations.length === 0) {
    const error = new Error('At least one target organization is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanTargets = [...new Set(targetOrganizations.map(t => String(t).trim()).filter(Boolean))];
  if (cleanTargets.length === 0) {
    const error = new Error('At least one target organization is required.');
    error.statusCode = 400;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  // Verify all target organizations exist and are active
  const orgsRes = await q(
    `SELECT id, name FROM organizations WHERE id = ANY($1) AND status = 'active'`,
    [cleanTargets]
  );

  if (orgsRes.rows.length !== cleanTargets.length) {
    const error = new Error('One or more target organizations are invalid or inactive.');
    error.statusCode = 400;
    throw error;
  }

  // Check caller authority: must be Owner or Lead in ALL target organizations
  for (const orgId of cleanTargets) {
    const perm = await getCallerOrgPermission(caller, orgId, customPool);
    if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
      const error = new Error(`You must be a Lead or Owner in all target organizations (lacking authority in ${orgId}).`);
      error.statusCode = 403;
      throw error;
    }
  }

  return cleanTargets;
}

/**
 * Create an announcement (Draft or immediately Published).
 */
export async function createAnnouncement(data, caller, customPool = null) {
  const { title, body, targetOrganizations, publish = false } = data;

  if (!title || title.trim().length === 0 || title.trim().length > 160) {
    const error = new Error('Title is required and must be between 1 and 160 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (!body || body.trim().length === 0 || body.trim().length > 10000) {
    const error = new Error('Body is required and must be between 1 and 10000 characters.');
    error.statusCode = 400;
    throw error;
  }

  const validTargets = await validateTargetsForManagement(targetOrganizations, caller, customPool);

  const announcementId = 'ann-' + generateRandomToken(12);
  const publicationStatus = publish ? 'Published' : 'Draft';
  const publishedAt = publish ? new Date() : null;

  const pool = customPool;
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const insertRes = await client.query(
      `INSERT INTO announcements (id, author_id, title, body, publication_status, target_organizations, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), NOW())
       RETURNING id, author_id AS "authorId", title, body, publication_status AS "publicationStatus", target_organizations AS "targetOrganizations", published_at AS "publishedAt", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        announcementId,
        caller.id,
        title.trim(),
        body.trim(),
        publicationStatus,
        JSON.stringify(validTargets),
        publishedAt,
      ]
    );

    // Record activity events in every target organization within the same transaction
    const action = publish ? 'publish' : 'draft_create';
    for (const orgId of validTargets) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'announcement', $4, $5, $6)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          announcementId,
          action,
          JSON.stringify({ title: title.trim(), targetOrganizations: validTargets, publicationStatus }),
        ]
      );
    }

    return {
      ...insertRes.rows[0],
      authorName: caller.displayName,
    };
  });
}

/**
 * Update an announcement draft.
 * Published announcements are strictly immutable.
 */
export async function updateAnnouncement(announcementId, updates, caller, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const annRes = await q(
    `SELECT * FROM announcements WHERE id = $1`,
    [announcementId]
  );

  if (annRes.rows.length === 0) {
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    throw error;
  }

  const current = annRes.rows[0];

  if (current.archived_at !== null) {
    const error = new Error('Archived announcements are read-only and cannot be modified.');
    error.statusCode = 400;
    throw error;
  }

  // REQ-007: Publishing freezes body and targets
  if (current.publication_status === 'Published') {
    const restrictedAttempted = ['title', 'body', 'targetOrganizations']
      .some(f => updates[f] !== undefined);
    if (restrictedAttempted) {
      const error = new Error('Published announcements are immutable and cannot be edited.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Verify caller authority on all current targets
  const currentTargets = current.target_organizations || [];
  for (const orgId of currentTargets) {
    const perm = await getCallerOrgPermission(caller, orgId, customPool);
    if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
      const error = new Error(`You lack Lead or Owner authority for target organization ${orgId}.`);
      error.statusCode = 403;
      throw error;
    }
  }

  // Validate changes
  let newTitle = current.title;
  let newBody = current.body;
  let newTargets = currentTargets;

  if (updates.title !== undefined) {
    if (!updates.title || updates.title.trim().length === 0 || updates.title.trim().length > 160) {
      const error = new Error('Title must be between 1 and 160 characters.');
      error.statusCode = 400;
      throw error;
    }
    newTitle = updates.title.trim();
  }

  if (updates.body !== undefined) {
    if (!updates.body || updates.body.trim().length === 0 || updates.body.trim().length > 10000) {
      const error = new Error('Body must be between 1 and 10000 characters.');
      error.statusCode = 400;
      throw error;
    }
    newBody = updates.body.trim();
  }

  if (updates.targetOrganizations !== undefined) {
    newTargets = await validateTargetsForManagement(updates.targetOrganizations, caller, customPool);
  }

  // Stale draft precondition check (optimistic concurrency)
  if (updates.updatedAt) {
    const clientUpdatedAt = new Date(updates.updatedAt).getTime();
    const dbUpdatedAt = new Date(current.updated_at).getTime();
    if (Math.abs(clientUpdatedAt - dbUpdatedAt) > 1000) { // allow 1s tolerance for timestamp serialization
      const error = new Error('This draft was modified by another user. Please reload and review before saving.');
      error.statusCode = 409;
      throw error;
    }
  }

  const pool = customPool;
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const updateRes = await client.query(
      `UPDATE announcements
       SET title = $1, body = $2, target_organizations = $3::jsonb, updated_at = NOW()
       WHERE id = $4
       RETURNING id, author_id AS "authorId", title, body, publication_status AS "publicationStatus", target_organizations AS "targetOrganizations", published_at AS "publishedAt", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        newTitle,
        newBody,
        JSON.stringify(newTargets),
        announcementId,
      ]
    );

    // Record activity events for all targets
    const allRelevantTargets = [...new Set([...currentTargets, ...newTargets])];
    for (const orgId of allRelevantTargets) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'announcement', $4, 'draft_edit', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          announcementId,
          JSON.stringify({ title: newTitle }),
        ]
      );
    }

    return updateRes.rows[0];
  });
}

/**
 * Publish an announcement draft.
 */
export async function publishAnnouncement(announcementId, caller, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const annRes = await q(
    `SELECT * FROM announcements WHERE id = $1`,
    [announcementId]
  );

  if (annRes.rows.length === 0) {
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    throw error;
  }

  const current = annRes.rows[0];

  if (current.archived_at !== null) {
    const error = new Error('Archived announcements cannot be published.');
    error.statusCode = 400;
    throw error;
  }

  if (current.publication_status === 'Published') {
    const error = new Error('Announcement is already published.');
    error.statusCode = 400;
    throw error;
  }

  const targets = current.target_organizations || [];
  for (const orgId of targets) {
    const perm = await getCallerOrgPermission(caller, orgId, customPool);
    if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
      const error = new Error(`You lack Lead or Owner authority to publish to organization ${orgId}.`);
      error.statusCode = 403;
      throw error;
    }
  }

  const pool = customPool;
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    const updateRes = await client.query(
      `UPDATE announcements
       SET publication_status = 'Published', published_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, author_id AS "authorId", title, body, publication_status AS "publicationStatus", target_organizations AS "targetOrganizations", published_at AS "publishedAt", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [announcementId]
    );

    for (const orgId of targets) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'announcement', $4, 'publish', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          announcementId,
          JSON.stringify({ title: current.title, targetOrganizations: targets }),
        ]
      );
    }

    return updateRes.rows[0];
  });
}

/**
 * Archive an announcement.
 */
export async function archiveAnnouncement(announcementId, caller, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const annRes = await q(
    `SELECT * FROM announcements WHERE id = $1`,
    [announcementId]
  );

  if (annRes.rows.length === 0) {
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    throw error;
  }

  const current = annRes.rows[0];

  if (current.archived_at !== null) {
    const error = new Error('Announcement is already archived.');
    error.statusCode = 400;
    throw error;
  }

  const targets = current.target_organizations || [];
  for (const orgId of targets) {
    const perm = await getCallerOrgPermission(caller, orgId, customPool);
    if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
      const error = new Error(`You lack Lead or Owner authority to archive announcements in ${orgId}.`);
      error.statusCode = 403;
      throw error;
    }
  }

  const pool = customPool;
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    await client.query(
      `UPDATE announcements
       SET archived_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [announcementId]
    );

    for (const orgId of targets) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'announcement', $4, 'archive', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          announcementId,
          JSON.stringify({ title: current.title }),
        ]
      );
    }

    return { success: true, id: announcementId, archived: true };
  });
}

/**
 * List announcements with privacy protection:
 * - Published announcements: visible to active members of AT LEAST ONE target organization.
 * - Draft announcements: visible ONLY to users who are Owner or Lead in ALL target organizations of that draft.
 */
export async function listAnnouncements(caller, filters = {}, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const page = Math.max(1, parseInt(filters.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '25', 10)));
  const offset = (page - 1) * limit;

  // 1. Get caller's active organizations and lead organizations
  let callerMemberOrgs = [];
  let callerLeadOrgs = [];

  if (caller.isOwner) {
    const allOrgs = await q(`SELECT id FROM organizations WHERE status = 'active'`);
    callerMemberOrgs = allOrgs.rows.map(r => r.id);
    callerLeadOrgs = [...callerMemberOrgs];
  } else {
    const memRes = await q(
      `SELECT organization_id, role FROM memberships WHERE user_id = $1 AND status = 'active'`,
      [caller.id]
    );
    callerMemberOrgs = memRes.rows.map(r => r.organization_id);
    callerLeadOrgs = memRes.rows.filter(r => r.role === 'Lead').map(r => r.organization_id);
  }

  // 2. Validate requested scope
  if (filters.scope && filters.scope !== 'all') {
    if (!caller.isOwner && !callerMemberOrgs.includes(filters.scope)) {
      const error = new Error('Inaccessible organization scope.');
      error.statusCode = 403;
      throw error;
    }
  } else if (filters.scope === 'all') {
    if (!caller.isOwner) {
      const error = new Error('Combined overview requires Owner role.');
      error.statusCode = 403;
      throw error;
    }
  }

  // 3. Build query conditions
  // Archival filter: default unarchived
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (filters.archived === 'true') {
    conditions.push('a.archived_at IS NOT NULL');
  } else {
    conditions.push('a.archived_at IS NULL');
  }

  // Scope filter:
  if (filters.scope && filters.scope !== 'all') {
    conditions.push(`a.target_organizations ? $${paramIdx}`);
    params.push(filters.scope);
    paramIdx++;
  }

  // Title search (case-insensitive substring)
  if (filters.search) {
    conditions.push(`a.title ILIKE $${paramIdx}`);
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
  }

  // Publication status filter if explicitly specified
  if (filters.status === 'Draft') {
    conditions.push(`a.publication_status = 'Draft'`);
  } else if (filters.status === 'Published') {
    conditions.push(`a.publication_status = 'Published'`);
  }

  // Visibility boundary:
  // (Published AND target intersects callerMemberOrgs)
  // OR
  // (Draft AND all targets are subset of callerLeadOrgs)
  if (!caller.isOwner) {
    if (callerMemberOrgs.length === 0) {
      return { announcements: [], total: 0, page, limit, hasMore: false };
    }

    // Published condition: target_organizations has at least one matching element in callerMemberOrgs
    // In PostgreSQL: target_organizations ?| array
    const pubCondition = `(a.publication_status = 'Published' AND a.target_organizations ?| $${paramIdx})`;
    params.push(callerMemberOrgs);
    paramIdx++;

    // Draft condition: target_organizations is contained within callerLeadOrgs (all targets in leadOrgs)
    let draftCondition = 'FALSE';
    if (callerLeadOrgs.length > 0) {
      draftCondition = `(a.publication_status = 'Draft' AND a.target_organizations <@ $${paramIdx}::jsonb)`;
      params.push(JSON.stringify(callerLeadOrgs));
      paramIdx++;
    }

    conditions.push(`(${pubCondition} OR ${draftCondition})`);
  }

  const whereClause = conditions.join(' AND ');

  // Count query
  const countRes = await q(
    `SELECT COUNT(*) AS total FROM announcements a WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].total, 10);

  // List query
  const queryParams = [...params, limit, offset];
  const listRes = await q(
    `SELECT
       a.id,
       a.author_id AS "authorId",
       u.display_name AS "authorName",
       u.avatar_color AS "authorAvatarColor",
       a.title,
       a.body,
       a.publication_status AS "publicationStatus",
       a.target_organizations AS "targetOrganizations",
       a.published_at AS "publishedAt",
       a.archived_at AS "archivedAt",
       a.created_at AS "createdAt",
       a.updated_at AS "updatedAt"
     FROM announcements a
     JOIN users u ON a.author_id = u.id
     WHERE ${whereClause}
     ORDER BY COALESCE(a.published_at, a.created_at) DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    queryParams
  );

  const announcements = listRes.rows.map(r => ({
    id: r.id,
    authorId: r.authorId,
    authorName: r.authorName,
    authorAvatarColor: r.authorAvatarColor || '#0F766E',
    title: r.title,
    body: r.body,
    publicationStatus: r.publicationStatus,
    targetOrganizations: r.targetOrganizations || [],
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));

  return {
    announcements,
    total,
    page,
    limit,
    hasMore: offset + announcements.length < total,
  };
}

/**
 * Get a single announcement by ID with visibility checks.
 */
export async function getAnnouncement(announcementId, caller, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const res = await q(
    `SELECT
       a.id,
       a.author_id AS "authorId",
       u.display_name AS "authorName",
       u.avatar_color AS "authorAvatarColor",
       a.title,
       a.body,
       a.publication_status AS "publicationStatus",
       a.target_organizations AS "targetOrganizations",
       a.published_at AS "publishedAt",
       a.archived_at AS "archivedAt",
       a.created_at AS "createdAt",
       a.updated_at AS "updatedAt"
     FROM announcements a
     JOIN users u ON a.author_id = u.id
     WHERE a.id = $1`,
    [announcementId]
  );

  if (res.rows.length === 0) {
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    throw error;
  }

  const row = res.rows[0];
  const targets = row.targetOrganizations || [];

  // Visibility check
  if (!caller.isOwner) {
    if (row.publicationStatus === 'Published') {
      // Must be member in at least one target org
      let hasAccess = false;
      for (const orgId of targets) {
        const perm = await getCallerOrgPermission(caller, orgId, customPool);
        if (perm.hasAccess) {
          hasAccess = true;
          break;
        }
      }
      if (!hasAccess) {
        const error = new Error('You do not have permission to view this announcement.');
        error.statusCode = 403;
        throw error;
      }
    } else {
      // Draft: Must be Lead or Owner in ALL targets
      for (const orgId of targets) {
        const perm = await getCallerOrgPermission(caller, orgId, customPool);
        if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
          const error = new Error('Draft announcements are visible only to Leads with access to all target organizations.');
          error.statusCode = 403;
          throw error;
        }
      }
    }
  }

  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    authorAvatarColor: row.authorAvatarColor || '#0F766E',
    title: row.title,
    body: row.body,
    publicationStatus: row.publicationStatus,
    targetOrganizations: targets,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/**
 * Get target-scoped activity history for an announcement.
 * Viewers see activity only for organizations they have active membership in.
 */
export async function getAnnouncementActivity(announcementId, caller, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const annRes = await q(
    `SELECT id, target_organizations FROM announcements WHERE id = $1`,
    [announcementId]
  );

  if (annRes.rows.length === 0) {
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    throw error;
  }

  const targets = annRes.rows[0].target_organizations || [];
  let callerAccessibleTargets = [];

  if (caller.isOwner) {
    callerAccessibleTargets = targets;
  } else {
    for (const orgId of targets) {
      const perm = await getCallerOrgPermission(caller, orgId, customPool);
      if (perm.hasAccess) {
        callerAccessibleTargets.push(orgId);
      }
    }
  }

  if (callerAccessibleTargets.length === 0) {
    const error = new Error('You do not have access to activity history for this announcement.');
    error.statusCode = 403;
    throw error;
  }

  const res = await q(
    `SELECT
       ae.id,
       ae.organization_id AS "organizationId",
       ae.action,
       ae.metadata,
       ae.created_at AS "createdAt",
       u.display_name AS "actorName"
     FROM activity_events ae
     JOIN users u ON ae.actor_id = u.id
     WHERE ae.entity_type = 'announcement' AND ae.entity_id = $1 AND ae.organization_id = ANY($2)
     ORDER BY ae.created_at DESC`,
    [announcementId, callerAccessibleTargets]
  );

  return res.rows.map(r => ({
    id: r.id,
    organizationId: r.organizationId,
    action: r.action,
    metadata: r.metadata,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    actorName: r.actorName,
  }));
}
