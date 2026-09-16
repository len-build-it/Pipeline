import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, withTransaction } from './client.js';
import { hashPassword } from '../server/auth/crypto.js';

export async function seedDatabase({ customUrl = null } = {}) {
  const pool = createPool(customUrl);

  try {
    await withTransaction(async (client) => {
      // 1. Organizations
      await client.query(`
        INSERT INTO organizations (id, name, status) VALUES
          ('org-1', 'AqOne', 'active'),
          ('org-2', 'Dev Guild', 'active')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;
      `);

      // 2. Users with hashed passwords
      const defaultPasswordHash = await hashPassword('password123456');

      await client.query(`
        INSERT INTO users (id, email, password_hash, display_name, avatar_color, status, is_owner, skills, interests) VALUES
          ('usr-len', 'len@example.com', $1, 'Len', '#0D9488', 'active', TRUE, '["Architecture", "Governance"]'::jsonb, '["Team Building", "Tooling"]'::jsonb),
          ('usr-alex', 'alex@example.com', $1, 'Alex Rivera', '#2563EB', 'active', FALSE, '["Flutter", "Fastify", "UI/UX"]'::jsonb, '["Open Source", "Design Systems"]'::jsonb),
          ('usr-sam', 'sam@example.com', $1, 'Sam Taylor', '#7C3AED', 'active', FALSE, '["Testing", "Playwright", "CI/CD"]'::jsonb, '["Automation", "Documentation"]'::jsonb),
          ('usr-jordan', 'jordan@example.com', $1, 'Jordan Lee', '#D97706', 'active', FALSE, '["DevOps", "Database", "Security"]'::jsonb, '["Architecture", "Mentoring"]'::jsonb),
          ('usr-inactive', 'inactive@example.com', $1, 'Inactive User', '#64748B', 'inactive', FALSE, '[]'::jsonb, '[]'::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name,
          is_owner = EXCLUDED.is_owner,
          status = EXCLUDED.status;
      `, [defaultPasswordHash]);

      // 3. Memberships
      await client.query(`
        INSERT INTO memberships (id, user_id, organization_id, role, status, notes) VALUES
          ('mem-len-1', 'usr-len', 'org-1', 'Lead', 'active', 'Founder and global owner.'),
          ('mem-len-2', 'usr-len', 'org-2', 'Lead', 'active', 'Founder and global owner.'),
          ('mem-alex-1', 'usr-alex', 'org-1', 'Lead', 'active', 'Lead developer on AqOne platform.'),
          ('mem-alex-2', 'usr-alex', 'org-2', 'Member', 'active', 'Participates in frontend guild.'),
          ('mem-sam-1', 'usr-sam', 'org-1', 'Member', 'active', 'Frontend contributor.'),
          ('mem-sam-2', 'usr-sam', 'org-2', 'Member', 'active', 'Guild member contributing to standards.'),
          ('mem-jordan-2', 'usr-jordan', 'org-2', 'Lead', 'active', 'Guild lead overseeing workshops.')
        ON CONFLICT (user_id, organization_id) DO UPDATE SET
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes;
      `);

      // 4. Tasks
      await client.query(`
        INSERT INTO tasks (id, organization_id, title, description, creator_id, assignee_id, status, priority, due_date, labels, version) VALUES
          ('tsk-101', 'org-1', 'Design responsive navigation rail', 'Implement responsive drawer behavior for screens under 768px with full keyboard access.', 'usr-len', 'usr-alex', 'In progress', 'High', '2026-09-25', '["frontend", "accessibility"]'::jsonb, 1),
          ('tsk-102', 'org-1', 'Audit color contrast ratios for light mode', 'Ensure WCAG AA compliance (4.5:1 for normal text, 3:1 for large text and controls).', 'usr-alex', 'usr-alex', 'Done', 'Medium', '2026-09-15', '["design", "wcag"]'::jsonb, 1),
          ('tsk-103', 'org-1', 'Review database indexes for membership queries', 'Add indexes on organization_id and user_id to ensure sub-50ms query latency.', 'usr-len', 'usr-sam', 'Backlog', 'Low', '2026-09-12', '["backend", "performance"]'::jsonb, 1),
          ('tsk-104', 'org-2', 'Setup automated linting and formatting pipeline', 'Configure ESLint, Prettier, and Flutter analyze scripts across both codebases.', 'usr-jordan', 'usr-sam', 'In progress', 'High', '2026-09-14', '["tooling", "dx"]'::jsonb, 1),
          ('tsk-105', 'org-2', 'Prepare workshop on Flutter widget architecture', 'Draft 45-minute interactive session on declarative state management and testing.', 'usr-jordan', 'usr-alex', 'Blocked', 'Medium', '2026-09-30', '["education", "flutter"]'::jsonb, 1)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          due_date = EXCLUDED.due_date;
      `);

      // 5. Task comments
      await client.query(`
        INSERT INTO task_comments (id, task_id, author_id, body) VALUES
          ('cmt-201', 'tsk-101', 'usr-len', 'Make sure 48px touch targets are preserved on mobile.')
        ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body;
      `);

      // 6. Announcements
      await client.query(`
        INSERT INTO announcements (id, author_id, title, body, publication_status, target_organizations, published_at) VALUES
          ('ann-301', 'usr-len', 'Welcome to the AqOne & Dev Guild unified management portal', 'We have launched the new consolidated management hub. Leads and members can view projects, track tasks, and stay aligned across organizations.', 'Published', '["org-1", "org-2"]'::jsonb, '2026-09-15T08:00:00Z'),
          ('ann-302', 'usr-alex', 'AqOne Q3 Sprint Kickoff', 'AqOne sprint goals have been updated. Please inspect your assigned tasks and update status accordingly.', 'Published', '["org-1"]'::jsonb, '2026-09-16T09:00:00Z'),
          ('ann-303', 'usr-jordan', 'Dev Guild tooling roadmap (Draft)', 'Draft proposal for upcoming tooling and shared code sharing initiatives across guild repositories.', 'Draft', '["org-2"]'::jsonb, NULL)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          publication_status = EXCLUDED.publication_status;
      `);
    }, pool);

    console.log('[seed] Database seeded successfully.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] Seed failed:', err);
      process.exit(1);
    });
}
