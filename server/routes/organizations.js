import { query } from '../../db/client.js';

export async function organizationRoutes(fastify, options) {
  const pool = options.pool || null;
  const q = pool ? (t, p) => pool.query(t, p) : query;

  // GET /api/organizations
  fastify.get('/organizations', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = request.user;
    if (user.isOwner) {
      const res = await q(
        `SELECT id, name, status, 'Lead' AS role, 'active' AS membership_status
         FROM organizations WHERE status = 'active' ORDER BY name ASC`
      );
      return { organizations: res.rows };
    }

    const res = await q(
      `SELECT o.id, o.name, o.status, m.role, m.status AS membership_status
       FROM memberships m
       JOIN organizations o ON m.organization_id = o.id
       WHERE m.user_id = $1 AND m.status = 'active' AND o.status = 'active'
       ORDER BY o.name ASC`,
      [user.id]
    );
    return { organizations: res.rows };
  });

  // GET /api/overview
  fastify.get('/overview', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const scope = request.query.scope || 'all';

    // 1. Verify access to requested scope
    if (scope === 'all') {
      if (!user.isOwner) {
        reply.code(403);
        return { statusCode: 403, error: 'Forbidden', message: 'Combined overview requires Owner role.' };
      }
    } else {
      if (!user.isOwner) {
        const memCheck = await q(
          `SELECT role FROM memberships WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
          [user.id, scope]
        );
        if (memCheck.rows.length === 0) {
          reply.code(403);
          return { statusCode: 403, error: 'Forbidden', message: 'Inaccessible organization scope.' };
        }
      }
    }

    // 2. Fetch scoped metrics
    let activeMembersCount = 0;
    let openTasksCount = 0;
    let overdueTasksCount = 0;
    let announcementsCount = 0;
    let actionableTasks = [];
    let recentAnnouncements = [];

    if (scope === 'all') {
      // Deduplicated active members
      const memRes = await q(
        `SELECT COUNT(DISTINCT user_id)::int AS count FROM memberships WHERE status = 'active'`
      );
      activeMembersCount = memRes.rows[0].count;

      // Open tasks
      const openRes = await q(
        `SELECT COUNT(*)::int AS count FROM tasks WHERE status != 'Done' AND archived_at IS NULL`
      );
      openTasksCount = openRes.rows[0].count;

      // Overdue tasks (due date < current Manila date)
      const overdueRes = await q(
        `SELECT COUNT(*)::int AS count FROM tasks
         WHERE status != 'Done' AND archived_at IS NULL AND due_date IS NOT NULL AND due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date`
      );
      overdueTasksCount = overdueRes.rows[0].count;

      // Recent published announcements
      const annRes = await q(
        `SELECT COUNT(*)::int AS count FROM announcements
         WHERE publication_status = 'Published' AND archived_at IS NULL
           AND published_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' - INTERVAL '7 days')`
      );
      announcementsCount = annRes.rows[0].count;

      // Actionable tasks
      const tasksRes = await q(
        `SELECT t.id, t.organization_id, t.title, t.status, t.priority, t.due_date,
                u.display_name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON t.assignee_id = u.id
         WHERE t.status != 'Done' AND t.archived_at IS NULL
         ORDER BY
           (t.due_date IS NOT NULL AND t.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date) DESC,
           CASE t.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC,
           t.created_at DESC
         LIMIT 6`
      );
      actionableTasks = tasksRes.rows.map(r => ({
        id: r.id,
        orgId: r.organization_id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date ? r.due_date.toISOString().split('T')[0] : null,
        assigneeName: r.assignee_name || 'Unassigned',
      }));

      // Recent announcements
      const recentAnnRes = await q(
        `SELECT a.id, a.title, a.body, a.published_at, u.display_name AS author_name, a.target_organizations
         FROM announcements a
         JOIN users u ON a.author_id = u.id
         WHERE a.publication_status = 'Published' AND a.archived_at IS NULL
           AND a.published_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' - INTERVAL '7 days')
         ORDER BY a.published_at DESC
         LIMIT 4`
      );
      recentAnnouncements = recentAnnRes.rows.map(r => ({
        id: r.id,
        title: r.title,
        body: r.body,
        publishedAt: r.published_at ? r.published_at.toISOString().split('T')[0] : null,
        authorName: r.author_name,
        targetOrgs: r.target_organizations,
      }));
    } else {
      // Organization-specific scope
      const memRes = await q(
        `SELECT COUNT(*)::int AS count FROM memberships WHERE organization_id = $1 AND status = 'active'`,
        [scope]
      );
      activeMembersCount = memRes.rows[0].count;

      const openRes = await q(
        `SELECT COUNT(*)::int AS count FROM tasks WHERE organization_id = $1 AND status != 'Done' AND archived_at IS NULL`,
        [scope]
      );
      openTasksCount = openRes.rows[0].count;

      const overdueRes = await q(
        `SELECT COUNT(*)::int AS count FROM tasks
         WHERE organization_id = $1 AND status != 'Done' AND archived_at IS NULL AND due_date IS NOT NULL
           AND due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date`,
        [scope]
      );
      overdueTasksCount = overdueRes.rows[0].count;

      const annRes = await q(
        `SELECT COUNT(*)::int AS count FROM announcements
         WHERE publication_status = 'Published' AND archived_at IS NULL
           AND target_organizations ? $1
           AND published_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' - INTERVAL '7 days')`,
        [scope]
      );
      announcementsCount = annRes.rows[0].count;

      const tasksRes = await q(
        `SELECT t.id, t.organization_id, t.title, t.status, t.priority, t.due_date,
                u.display_name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON t.assignee_id = u.id
         WHERE t.organization_id = $1 AND t.status != 'Done' AND t.archived_at IS NULL
         ORDER BY
           (t.due_date IS NOT NULL AND t.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date) DESC,
           CASE t.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC,
           t.created_at DESC
         LIMIT 6`,
        [scope]
      );
      actionableTasks = tasksRes.rows.map(r => ({
        id: r.id,
        orgId: r.organization_id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date ? r.due_date.toISOString().split('T')[0] : null,
        assigneeName: r.assignee_name || 'Unassigned',
      }));

      const recentAnnRes = await q(
        `SELECT a.id, a.title, a.body, a.published_at, u.display_name AS author_name, a.target_organizations
         FROM announcements a
         JOIN users u ON a.author_id = u.id
         WHERE a.publication_status = 'Published' AND a.archived_at IS NULL
           AND a.target_organizations ? $1
           AND a.published_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' - INTERVAL '7 days')
         ORDER BY a.published_at DESC
         LIMIT 4`,
        [scope]
      );
      recentAnnouncements = recentAnnRes.rows.map(r => ({
        id: r.id,
        title: r.title,
        body: r.body,
        publishedAt: r.published_at ? r.published_at.toISOString().split('T')[0] : null,
        authorName: r.author_name,
        targetOrgs: r.target_organizations,
      }));
    }

    return {
      scope,
      metrics: {
        activeMembers: activeMembersCount,
        openTasks: openTasksCount,
        overdueTasks: overdueTasksCount,
        announcements: announcementsCount,
      },
      actionableTasks,
      recentAnnouncements,
    };
  });
}
