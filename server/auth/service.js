import { query, withTransaction } from '../../db/client.js';
import { hashPassword, verifyPassword, sha256Digest, generateRandomToken } from './crypto.js';

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarColor: user.avatar_color,
    status: user.status,
    isOwner: Boolean(user.is_owner),
    skills: user.skills || [],
    interests: user.interests || [],
  };
}

export async function login(email, password, { userAgent = '', ip = '' } = {}, customPool = null) {
  if (!email || !password) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  const result = await q(
    `SELECT id, email, password_hash, display_name, avatar_color, status, is_owner, skills, interests
     FROM users WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const user = result.rows[0];

  if (user.status === 'inactive') {
    const error = new Error('Account is inactive.');
    error.statusCode = 403;
    throw error;
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  // Create session
  const sessionId = 'ses-' + generateRandomToken(16);
  const refreshToken = generateRandomToken(32);
  const refreshTokenDigest = sha256Digest(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await q(
    `INSERT INTO sessions (id, user_id, refresh_token_digest, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, user.id, refreshTokenDigest, expiresAt]
  );

  // Activity event
  await q(
    `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
     VALUES ($1, NULL, $2, 'session', $3, 'login', $4)`,
    ['act-' + generateRandomToken(12), user.id, sessionId, JSON.stringify({ ip, userAgent })]
  );

  return {
    user: sanitizeUser(user),
    sessionId,
    refreshToken,
    expiresAt,
  };
}

export async function rotateRefreshToken(sessionId, presentedToken, customPool = null) {
  if (!sessionId || !presentedToken) {
    const error = new Error('Invalid session or refresh token.');
    error.statusCode = 401;
    throw error;
  }

  const presentedDigest = sha256Digest(presentedToken);
  const pool = customPool;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  const result = await q(
    `SELECT id, user_id, refresh_token_digest, prev_token_digest, revoked_at, expires_at
     FROM sessions WHERE id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid session.');
    error.statusCode = 401;
    throw error;
  }

  const session = result.rows[0];

  if (session.revoked_at !== null) {
    const error = new Error('Session has been revoked.');
    error.statusCode = 401;
    throw error;
  }

  if (new Date(session.expires_at) < new Date()) {
    const error = new Error('Session has expired.');
    error.statusCode = 401;
    throw error;
  }

  // Detect token reuse / replay
  if (session.prev_token_digest && presentedDigest === session.prev_token_digest) {
    // Replay attack! Revoke session immediately
    await q('UPDATE sessions SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1', [sessionId]);
    const error = new Error('Session revoked due to token reuse.');
    error.statusCode = 401;
    throw error;
  }

  if (presentedDigest !== session.refresh_token_digest) {
    const error = new Error('Invalid refresh token.');
    error.statusCode = 401;
    throw error;
  }

  // Check user is still active
  const userResult = await q(
    `SELECT id, email, display_name, avatar_color, status, is_owner, skills, interests
     FROM users WHERE id = $1`,
    [session.user_id]
  );

  if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
    await q('UPDATE sessions SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1', [sessionId]);
    const error = new Error('Account is inactive.');
    error.statusCode = 403;
    throw error;
  }

  const newRefreshToken = generateRandomToken(32);
  const newDigest = sha256Digest(newRefreshToken);

  await q(
    `UPDATE sessions
     SET refresh_token_digest = $1, prev_token_digest = $2, updated_at = NOW()
     WHERE id = $3`,
    [newDigest, presentedDigest, sessionId]
  );

  return {
    user: sanitizeUser(userResult.rows[0]),
    sessionId,
    newRefreshToken,
  };
}

export async function revokeSession(sessionId, customPool = null) {
  if (!sessionId) return;
  const q = customPool ? (t, p) => customPool.query(t, p) : query;
  await q('UPDATE sessions SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1', [sessionId]);
}

export async function getUserOrganizations(userId, isOwner = false, customPool = null) {
  const q = customPool ? (t, p) => customPool.query(t, p) : query;

  if (isOwner) {
    const res = await q(
      `SELECT id, name, status, 'Lead' AS role, 'active' AS membership_status
       FROM organizations WHERE status = 'active' ORDER BY name ASC`
    );
    return res.rows;
  }

  const res = await q(
    `SELECT o.id, o.name, o.status, m.role, m.status AS membership_status
     FROM memberships m
     JOIN organizations o ON m.organization_id = o.id
     WHERE m.user_id = $1 AND m.status = 'active' AND o.status = 'active'
     ORDER BY o.name ASC`,
    [userId]
  );
  return res.rows;
}

export async function acceptInvitation({ token, email, password, displayName }, customPool = null) {
  if (!token || !email) {
    const error = new Error('Token and email are required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const tokenDigest = sha256Digest(token);

  return withTransaction(async (client) => {
    const invRes = await client.query(
      `SELECT id, email, organization_id, role, status, expires_at
       FROM invitations
       WHERE token_digest = $1 FOR UPDATE`,
      [tokenDigest]
    );

    if (invRes.rows.length === 0) {
      const error = new Error('Invalid invitation link.');
      error.statusCode = 404;
      throw error;
    }

    const invitation = invRes.rows[0];

    if (invitation.status !== 'pending') {
      const error = new Error('Invitation has already been accepted or is no longer valid.');
      error.statusCode = 400;
      throw error;
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await client.query("UPDATE invitations SET status = 'expired', updated_at = NOW() WHERE id = $1", [invitation.id]);
      const error = new Error('Invitation has expired.');
      error.statusCode = 400;
      throw error;
    }

    if (normalizedEmail !== invitation.email.toLowerCase()) {
      const error = new Error('Invitation email does not match.');
      error.statusCode = 400;
      throw error;
    }

    // Check if user exists
    const userRes = await client.query(
      'SELECT id, status, display_name FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    let userId;

    if (userRes.rows.length > 0) {
      const existingUser = userRes.rows[0];
      if (existingUser.status !== 'active') {
        const error = new Error('Account is inactive.');
        error.statusCode = 403;
        throw error;
      }
      userId = existingUser.id;
    } else {
      if (!password || password.length < 12 || password.length > 128) {
        const error = new Error('Password must be between 12 and 128 characters.');
        error.statusCode = 400;
        throw error;
      }
      const name = (displayName || '').trim() || normalizedEmail.split('@')[0];
      const passwordHash = await hashPassword(password);
      userId = 'usr-' + generateRandomToken(8);

      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name, avatar_color, status, is_owner)
         VALUES ($1, $2, $3, $4, '#0D9488', 'active', FALSE)`,
        [userId, normalizedEmail, passwordHash, name]
      );
    }

    // Upsert membership
    const membershipId = 'mem-' + generateRandomToken(10);
    await client.query(
      `INSERT INTO memberships (id, user_id, organization_id, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()`,
      [membershipId, userId, invitation.organization_id, invitation.role]
    );

    // Mark invitation accepted
    await client.query(
      "UPDATE invitations SET status = 'accepted', updated_at = NOW() WHERE id = $1",
      [invitation.id]
    );

    // Record activity event
    await client.query(
      `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, metadata)
       VALUES ($1, $2, $3, 'invitation', $4, 'accepted', $5)`,
      ['act-' + generateRandomToken(12), invitation.organization_id, userId, invitation.id, JSON.stringify({ role: invitation.role })]
    );

    return {
      success: true,
      userId,
      organizationId: invitation.organization_id,
      role: invitation.role,
    };
  }, customPool);
}
