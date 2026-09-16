import { query, withTransaction } from '../../db/client.js';
import { generateRandomToken, sha256Digest } from '../auth/crypto.js';
import { sendInvitationEmail } from '../services/email.js';

/**
 * Check if caller has access to the given organization.
 * Returns { isOwner, isLead, isMember, membership }
 */
export async function getCallerOrgPermission(caller, orgId, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  if (caller.isOwner) {
    return {
      hasAccess: true,
      isOwner: true,
      isLead: true,
      isMember: true,
      membership: null,
    };
  }

  const res = await q(
    `SELECT id, role, status, notes FROM memberships
     WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
    [caller.id, orgId]
  );

  if (res.rows.length === 0) {
    return {
      hasAccess: false,
      isOwner: false,
      isLead: false,
      isMember: false,
      membership: null,
    };
  }

  const mem = res.rows[0];
  return {
    hasAccess: true,
    isOwner: false,
    isLead: mem.role === 'Lead',
    isMember: true,
    membership: mem,
  };
}

/**
 * List organization members with search, filters, pagination, and role-based notes redaction.
 */
export async function listMembers(orgId, filters = {}, caller, customPool = null) {
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

  const conditions = ['m.organization_id = $1'];
  const params = [orgId];
  let paramIdx = 2;

  if (filters.search) {
    conditions.push(`(u.display_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
  }

  if (filters.role) {
    conditions.push(`m.role = $${paramIdx}`);
    params.push(filters.role);
    paramIdx++;
  }

  if (filters.status) {
    conditions.push(`m.status = $${paramIdx}`);
    params.push(filters.status);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching
  const countRes = await q(
    `SELECT COUNT(*) AS total
     FROM memberships m
     JOIN users u ON m.user_id = u.id
     WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].total, 10);

  // Fetch paginated records
  const queryParams = [...params, limit, offset];
  const listRes = await q(
    `SELECT
       m.id,
       m.user_id AS "userId",
       m.organization_id AS "orgId",
       m.role,
       m.status,
       m.notes,
       m.joined_at AS "joinedAt",
       u.display_name AS "displayName",
       u.email,
       u.avatar_color AS "avatarColor",
       u.is_owner AS "isOwner",
       u.skills,
       u.interests
     FROM memberships m
     JOIN users u ON m.user_id = u.id
     WHERE ${whereClause}
     ORDER BY m.status ASC, m.role ASC, u.display_name ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    queryParams
  );

  const canSeeNotes = perm.isOwner || perm.isLead;

  const members = listRes.rows.map((row) => {
    const member = {
      id: row.id,
      userId: row.userId,
      orgId: row.orgId,
      displayName: row.displayName,
      email: row.email,
      avatarColor: row.avatarColor,
      isOwner: row.isOwner,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt,
      skills: row.skills || [],
      interests: row.interests || [],
    };

    if (canSeeNotes) {
      member.notes = row.notes || '';
    }

    return member;
  });

  return {
    members,
    total,
    page,
    limit,
    hasMore: offset + members.length < total,
  };
}

/**
 * Get single member details by membership ID.
 */
export async function getMember(orgId, membershipId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess) {
    const error = new Error('Inaccessible organization.');
    error.statusCode = 403;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const res = await q(
    `SELECT
       m.id,
       m.user_id AS "userId",
       m.organization_id AS "orgId",
       m.role,
       m.status,
       m.notes,
       m.joined_at AS "joinedAt",
       u.display_name AS "displayName",
       u.email,
       u.avatar_color AS "avatarColor",
       u.is_owner AS "isOwner",
       u.skills,
       u.interests
     FROM memberships m
     JOIN users u ON m.user_id = u.id
     WHERE m.id = $1 AND m.organization_id = $2`,
    [membershipId, orgId]
  );

  if (res.rows.length === 0) {
    const error = new Error('Member not found.');
    error.statusCode = 404;
    throw error;
  }

  const row = res.rows[0];
  const canSeeNotes = perm.isOwner || perm.isLead;

  const member = {
    id: row.id,
    userId: row.userId,
    orgId: row.orgId,
    displayName: row.displayName,
    email: row.email,
    avatarColor: row.avatarColor,
    isOwner: row.isOwner,
    role: row.role,
    status: row.status,
    joinedAt: row.joinedAt,
    skills: row.skills || [],
    interests: row.interests || [],
  };

  if (canSeeNotes) {
    member.notes = row.notes || '';
  }

  return member;
}

/**
 * Update membership role, status, or notes.
 */
export async function updateMembership(orgId, membershipId, updates, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
    const error = new Error('Only organization Leads and Owner can update memberships.');
    error.statusCode = 403;
    throw error;
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  // 1. Fetch current membership
  const targetRes = await q(
    `SELECT m.id, m.user_id, m.organization_id, m.role, m.status, m.notes, u.is_owner, u.display_name
     FROM memberships m
     JOIN users u ON m.user_id = u.id
     WHERE m.id = $1 AND m.organization_id = $2`,
    [membershipId, orgId]
  );

  if (targetRes.rows.length === 0) {
    const error = new Error('Member not found.');
    error.statusCode = 404;
    throw error;
  }

  const current = targetRes.rows[0];

  // 2. Global Owner protection
  if (current.is_owner) {
    if ((updates.role && updates.role !== current.role) || (updates.status && updates.status !== 'active')) {
      const error = new Error('Global owner cannot be demoted or deactivated through membership controls.');
      error.statusCode = 400;
      throw error;
    }
  }

  // 3. Lead privileges and boundary checks
  if (!perm.isOwner) {
    // Caller is a Lead
    if (current.role === 'Lead' && caller.id !== current.user_id) {
      // Cannot modify another Lead
      const error = new Error('Leads cannot alter other Leads in this organization.');
      error.statusCode = 403;
      throw error;
    }

    if (updates.role && updates.role === 'Lead' && current.role !== 'Lead') {
      // Cannot promote to Lead
      const error = new Error('Only the global Owner can promote members to Lead.');
      error.statusCode = 403;
      throw error;
    }
  }

  // 4. Perform updates atomically
  const runner = pool ? (fn) => withTransaction(fn, pool) : withTransaction;

  return runner(async (client) => {
    let newRole = current.role;
    let newStatus = current.status;
    let newNotes = current.notes;
    let unassignedTaskCount = 0;

    if (updates.role && ['Lead', 'Member'].includes(updates.role)) {
      newRole = updates.role;
    }

    if (updates.status && ['active', 'inactive'].includes(updates.status)) {
      newStatus = updates.status;
    }

    if (typeof updates.notes === 'string') {
      newNotes = updates.notes;
    }

    // Status change to inactive -> unassign open tasks in this organization
    if (newStatus === 'inactive' && current.status === 'active') {
      const taskUpdateRes = await client.query(
        `UPDATE tasks
         SET assignee_id = NULL, updated_at = NOW()
         WHERE organization_id = $1 AND assignee_id = $2 AND status != 'Done' AND archived_at IS NULL`,
        [orgId, current.user_id]
      );
      unassignedTaskCount = taskUpdateRes.rowCount || 0;

      // Activity event
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'membership', $4, 'deactivate', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          membershipId,
          JSON.stringify({
            userId: current.user_id,
            unassignedTasks: unassignedTaskCount,
          }),
        ]
      );
    } else if (newStatus === 'active' && current.status === 'inactive') {
      // Reactivation event
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'membership', $4, 'reactivate', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          membershipId,
          JSON.stringify({ userId: current.user_id }),
        ]
      );
    }

    // Role change event
    if (newRole !== current.role) {
      await client.query(
        `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, 'membership', $4, 'role_change', $5)`,
        [
          'act-' + generateRandomToken(12),
          orgId,
          caller.id,
          membershipId,
          JSON.stringify({ oldRole: current.role, newRole }),
        ]
      );
    }

    // Update membership row
    const updateRes = await client.query(
      `UPDATE memberships
       SET role = $1, status = $2, notes = $3, updated_at = NOW()
       WHERE id = $4 AND organization_id = $5
       RETURNING id, user_id AS "userId", organization_id AS "orgId", role, status, notes, joined_at AS "joinedAt"`,
      [newRole, newStatus, newNotes, membershipId, orgId]
    );

    const updated = updateRes.rows[0];

    return {
      ...updated,
      displayName: current.display_name,
      unassignedTaskCount,
    };
  });
}

/**
 * Create a new pending invitation.
 */
export async function createInvitation(orgId, { email, role = 'Member' }, caller, options = {}, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
    const error = new Error('Only organization Leads and Owner can invite members.');
    error.statusCode = 403;
    throw error;
  }

  if (!perm.isOwner && role === 'Lead') {
    const error = new Error('Only the global Owner can invite Lead members.');
    error.statusCode = 403;
    throw error;
  }

  if (!email || !email.includes('@')) {
    const error = new Error('Valid email address is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  // 1. Verify organization exists
  const orgRes = await q('SELECT id, name FROM organizations WHERE id = $1 AND status = \'active\'', [orgId]);
  if (orgRes.rows.length === 0) {
    const error = new Error('Organization not found.');
    error.statusCode = 404;
    throw error;
  }
  const org = orgRes.rows[0];

  // 2. Reject duplicate active membership
  const existingMem = await q(
    `SELECT m.id FROM memberships m
     JOIN users u ON m.user_id = u.id
     WHERE LOWER(u.email) = $1 AND m.organization_id = $2 AND m.status = 'active'`,
    [normalizedEmail, orgId]
  );
  if (existingMem.rows.length > 0) {
    const error = new Error('User is already an active member of this organization.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Reject duplicate pending invitation
  const existingInv = await q(
    `SELECT id FROM invitations
     WHERE LOWER(email) = $1 AND organization_id = $2 AND status = 'pending' AND expires_at > NOW()`,
    [normalizedEmail, orgId]
  );
  if (existingInv.rows.length > 0) {
    const error = new Error('A pending invitation already exists for this email address.');
    error.statusCode = 400;
    throw error;
  }

  // 4. Create invitation token & record
  const token = generateRandomToken(32);
  const tokenDigest = sha256Digest(token);
  const invId = 'inv-' + generateRandomToken(16);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await q(
    `INSERT INTO invitations (id, email, organization_id, role, token_digest, status, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)`,
    [invId, normalizedEmail, orgId, role, tokenDigest, caller.id, expiresAt]
  );

  // 5. Send invitation email
  let emailSent = false;
  let deliveryError = null;

  try {
    await sendInvitationEmail({
      to: normalizedEmail,
      organizationName: org.name,
      role,
      inviteUrl: `http://127.0.0.1:3000/#invite?token=${token}&email=${encodeURIComponent(normalizedEmail)}`,
    });
    emailSent = true;
  } catch (err) {
    deliveryError = err.message;
    await q(
      `UPDATE invitations SET status = 'delivery_failed', delivery_error = $1, updated_at = NOW() WHERE id = $2`,
      [deliveryError, invId]
    );
  }

  return {
    invitation: {
      id: invId,
      email: normalizedEmail,
      organizationId: orgId,
      role,
      status: emailSent ? 'pending' : 'delivery_failed',
      deliveryError,
      expiresAt,
    },
    token, // Provided for testing and offline flows
    emailSent,
    deliveryError,
  };
}

/**
 * Resend invitation: replaces token, refreshes expiry, clears failure, and retries delivery.
 */
export async function resendInvitation(orgId, invitationId, caller, options = {}, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
    const error = new Error('Only organization Leads and Owner can resend invitations.');
    error.statusCode = 403;
    throw error;
  }

  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  const invRes = await q(
    `SELECT i.*, o.name AS org_name
     FROM invitations i
     JOIN organizations o ON i.organization_id = o.id
     WHERE i.id = $1 AND i.organization_id = $2`,
    [invitationId, orgId]
  );

  if (invRes.rows.length === 0) {
    const error = new Error('Invitation not found.');
    error.statusCode = 404;
    throw error;
  }

  const inv = invRes.rows[0];

  if (inv.status === 'accepted') {
    const error = new Error('Invitation has already been accepted.');
    error.statusCode = 400;
    throw error;
  }

  // Generate new token & digest
  const newToken = generateRandomToken(32);
  const newDigest = sha256Digest(newToken);
  const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  let emailSent = false;
  let deliveryError = null;

  try {
    await sendInvitationEmail({
      to: inv.email,
      organizationName: inv.org_name,
      role: inv.role,
      inviteUrl: `http://127.0.0.1:3000/#invite?token=${newToken}&email=${encodeURIComponent(inv.email)}`,
    });
    emailSent = true;
  } catch (err) {
    deliveryError = err.message;
  }

  const newStatus = emailSent ? 'pending' : 'delivery_failed';

  await q(
    `UPDATE invitations
     SET token_digest = $1, status = $2, delivery_error = $3, expires_at = $4, updated_at = NOW()
     WHERE id = $5`,
    [newDigest, newStatus, deliveryError, newExpiresAt, invitationId]
  );

  return {
    invitation: {
      id: invitationId,
      email: inv.email,
      organizationId: orgId,
      role: inv.role,
      status: newStatus,
      deliveryError,
      expiresAt: newExpiresAt,
    },
    token: newToken,
    emailSent,
    deliveryError,
  };
}

/**
 * List pending/failed invitations for an organization.
 */
export async function listInvitations(orgId, caller, customPool = null) {
  const perm = await getCallerOrgPermission(caller, orgId, customPool);
  if (!perm.hasAccess || (!perm.isOwner && !perm.isLead)) {
    const error = new Error('Only organization Leads and Owner can view invitations.');
    error.statusCode = 403;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const res = await q(
    `SELECT id, email, organization_id AS "organizationId", role, status, delivery_error AS "deliveryError", expires_at AS "expiresAt", created_at AS "createdAt"
     FROM invitations
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [orgId]
  );

  return res.rows;
}

/**
 * User profile update: self-service display name, avatar color, skills, and interests.
 */
export async function updateUserProfile(userId, updates, caller, customPool = null) {
  if (caller.id !== userId) {
    const error = new Error('You can only update your own profile.');
    error.statusCode = 403;
    throw error;
  }

  const { displayName, avatarColor, skills, interests } = updates;

  if (displayName !== undefined && (!displayName || displayName.trim().length === 0 || displayName.length > 100)) {
    const error = new Error('Display name must be between 1 and 100 characters.');
    error.statusCode = 400;
    throw error;
  }

  const allowedColors = ['#0D9488', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#059669', '#475569'];
  if (avatarColor !== undefined && !allowedColors.includes(avatarColor) && !/^#[0-9A-Fa-f]{6}$/.test(avatarColor)) {
    const error = new Error('Invalid avatar color.');
    error.statusCode = 400;
    throw error;
  }

  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  const userRes = await q('SELECT id, display_name, avatar_color, skills, interests FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const currentUser = userRes.rows[0];

  const newName = displayName !== undefined ? displayName.trim() : currentUser.display_name;
  const newColor = avatarColor !== undefined ? avatarColor : currentUser.avatar_color;
  const newSkills = Array.isArray(skills) ? JSON.stringify(skills.map(s => String(s).trim()).filter(Boolean)) : JSON.stringify(currentUser.skills || []);
  const newInterests = Array.isArray(interests) ? JSON.stringify(interests.map(i => String(i).trim()).filter(Boolean)) : JSON.stringify(currentUser.interests || []);

  const updateRes = await q(
    `UPDATE users
     SET display_name = $1, avatar_color = $2, skills = $3::jsonb, interests = $4::jsonb, updated_at = NOW()
     WHERE id = $5
     RETURNING id, email, display_name AS "displayName", avatar_color AS "avatarColor", is_owner AS "isOwner", status, skills, interests`,
    [newName, newColor, newSkills, newInterests, userId]
  );

  return updateRes.rows[0];
}
