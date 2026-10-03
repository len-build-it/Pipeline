import { setupTestDatabase, createTestApp } from '../helpers/db-helper.js';
import { manilaToday } from '../../server/finance/validation.js';

export const THIRD_ORG_ID = 'org-harbor';
const SEED_PASSWORD = 'password123456';

/**
 * Fresh seeded database plus a third organization where Sam is the only member,
 * so finance tests always run against three differently named organizations.
 */
export async function setupFinanceTest() {
  const pool = await setupTestDatabase();
  await pool.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Harbor Robotics Club', 'active')`, [THIRD_ORG_ID]);
  await pool.query(
    `INSERT INTO memberships (id, user_id, organization_id, role, status)
     VALUES ('mem-sam-harbor', 'usr-sam', $1, 'Member', 'active')`,
    [THIRD_ORG_ID]
  );

  const app = await createTestApp();
  const tokens = {};
  for (const name of ['len', 'alex', 'sam', 'jordan']) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${name}@example.com`, password: SEED_PASSWORD },
    });
    tokens[name] = JSON.parse(res.body).accessToken;
  }

  /** Sends a JSON request as the named seed user and returns { status, body }. */
  async function api(user, method, path, payload) {
    const res = await app.inject({
      method,
      url: `/api${path}`,
      headers: user ? { authorization: `Bearer ${tokens[user]}` } : {},
      payload,
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  }

  /** Uploads a spreadsheet as the raw request body and returns { status, body }. */
  async function upload(user, path, buffer, contentType) {
    const res = await app.inject({
      method: 'POST',
      url: `/api${path}`,
      headers: { authorization: `Bearer ${tokens[user]}`, 'content-type': contentType },
      payload: buffer,
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  }

  /** Downloads a binary response and returns { status, headers, buffer }. */
  async function download(user, path) {
    const res = await app.inject({
      method: 'GET',
      url: `/api${path}`,
      headers: user ? { authorization: `Bearer ${tokens[user]}` } : {},
    });
    return { status: res.statusCode, headers: res.headers, buffer: res.rawPayload };
  }

  return { app, pool, api, upload, download };
}

/** Manila calendar date offset by whole days from today, as YYYY-MM-DD. */
export function manilaDate(offsetDays = 0) {
  const [year, month, day] = manilaToday().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

export function expenseInput(overrides = {}) {
  return {
    occurredOn: manilaDate(-1),
    amount: '100.00',
    category: 'Supplies',
    description: 'Whiteboard markers',
    ...overrides,
  };
}
