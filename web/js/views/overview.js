/**
 * Overview dashboard view module
 * Requirements: FEAT-001/REQ-004, REQ-008; PROD-005/UI-REQ-001, UI-REQ-002, UI-REQ-003, UI-REQ-004
 */

export function renderOverview(container, state, actions) {
  const { currentUser, currentScope } = state;

  // Determine user permission in current scope
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === currentScope);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');

  // Filter scoped data
  let scopedMembers = state.members;
  let scopedTasks = state.tasks.filter(t => !t.archived);
  let scopedAnnouncements = state.announcements.filter(a => !a.archived && a.status === 'published');

  if (currentScope !== 'all') {
    scopedMembers = scopedMembers.filter(m => m.orgId === currentScope);
    scopedTasks = scopedTasks.filter(t => t.orgId === currentScope);
    scopedAnnouncements = scopedAnnouncements.filter(a => a.targetOrgs.includes(currentScope));
  } else {
    // For Member or Lead viewing, if not owner, only show permitted
    if (!isOwner) {
      const allowedOrgIds = currentUser.memberships.map(m => m.orgId);
      scopedMembers = scopedMembers.filter(m => allowedOrgIds.includes(m.orgId));
      scopedTasks = scopedTasks.filter(t => allowedOrgIds.includes(t.orgId));
      scopedAnnouncements = scopedAnnouncements.filter(a => a.targetOrgs.some(o => allowedOrgIds.includes(o)));
    }
  }

  // Metrics calculation per PROD-003:
  // Active members count (distinct user IDs if combined)
  const activeMembersCount = currentScope === 'all'
    ? new Set(scopedMembers.filter(m => m.status === 'active').map(m => m.userId)).size
    : scopedMembers.filter(m => m.status === 'active').length;

  // Open tasks: not archived and not Done
  const openTasks = scopedTasks.filter(t => t.status !== 'Done');
  const openTasksCount = openTasks.length;

  // Overdue: open with dueDate < today Manila date ('2026-09-16')
  const todayManila = '2026-09-16';
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < todayManila);
  const overdueTasksCount = overdueTasks.length;

  // Recent announcements: published within last 7 Manila days (>= '2026-09-10')
  const recentAnnouncements = scopedAnnouncements.filter(a => a.publishedAt && a.publishedAt.slice(0, 10) >= '2026-09-10');
  const recentAnnouncementsCount = recentAnnouncements.length;

  // Actionable tasks: overdue first, then In progress or high priority
  const actionableTasks = [...openTasks].sort((a, b) => {
    const aOverdue = a.dueDate && a.dueDate < todayManila ? 1 : 0;
    const bOverdue = b.dueDate && b.dueDate < todayManila ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    const priorityOrder = { High: 3, Medium: 2, Low: 1 };
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  }).slice(0, 5);

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <h1>Overview</h1>
        <p>Current Scope: <strong>${currentScope === 'all' ? 'All Organizations' : (state.organizations.find(o => o.id === currentScope)?.name || currentScope)}</strong></p>
      </div>
      <div class="page-actions">
        ${isLead ? `
          <button class="btn btn-secondary btn-sm" id="btn-quick-invite">Invite member</button>
          <button class="btn btn-secondary btn-sm" id="btn-quick-task">New task</button>
          <button class="btn btn-primary btn-sm" id="btn-quick-announcement">New announcement</button>
        ` : ''}
      </div>
    </header>

    <div class="content-area">
      <!-- 4 Summary Metrics Cards -->
      <section aria-label="Organization Metrics" class="grid-cards">
        <article class="stat-card" data-metric="members">
          <div class="stat-card-title">Active Members</div>
          <div class="stat-card-value">${activeMembersCount}</div>
          <div class="stat-card-sub">${currentScope === 'all' ? 'Deduplicated across organizations' : 'In this organization'}</div>
        </article>

        <article class="stat-card" data-metric="open-tasks">
          <div class="stat-card-title">Open Tasks</div>
          <div class="stat-card-value">${openTasksCount}</div>
          <div class="stat-card-sub">In backlog, progress, or blocked</div>
        </article>

        <article class="stat-card" data-metric="overdue-tasks">
          <div class="stat-card-title">Overdue Tasks</div>
          <div class="stat-card-value" style="color: var(--color-danger);">${overdueTasksCount}</div>
          <div class="stat-card-sub">Due before Manila today (${todayManila})</div>
        </article>

        <article class="stat-card" data-metric="announcements">
          <div class="stat-card-title">Recent Announcements</div>
          <div class="stat-card-value">${recentAnnouncementsCount}</div>
          <div class="stat-card-sub">Published in the last 7 days</div>
        </article>
      </section>

      <!-- Actionable Tasks Section -->
      <section class="section-panel" aria-labelledby="actionable-tasks-title">
        <div class="section-panel-header">
          <h2 id="actionable-tasks-title" class="section-panel-title">Actionable Tasks</h2>
          <button class="btn btn-secondary btn-sm" id="btn-view-all-tasks">View all tasks</button>
        </div>

        ${actionableTasks.length === 0 ? `
          <div class="state-box">
            <p class="state-box-title">No urgent tasks pending</p>
            <p class="state-box-desc">All tasks are up to date or completed.</p>
            ${isLead ? `<button class="btn btn-primary btn-sm" id="btn-empty-task">Create a task</button>` : ''}
          </div>
        ` : `
          <div class="table-responsive">
            <table class="data-table" aria-label="Actionable tasks list">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${actionableTasks.map(t => {
                  const isOverdue = t.dueDate && t.dueDate < todayManila;
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHtml(t.title)}</strong>
                        ${t.orgId ? `<div style="font-size:0.75rem; color:var(--color-text-muted);">${t.orgId === 'org-1' ? 'AqOne' : 'Dev Guild'}</div>` : ''}
                      </td>
                      <td><span class="badge badge-${t.status.toLowerCase().replace(' ', '_')}">${t.status}</span></td>
                      <td><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
                      <td>${escapeHtml(t.assigneeName || 'Unassigned')}</td>
                      <td>
                        <span style="${isOverdue ? 'color: var(--color-danger); font-weight: 700;' : ''}">
                          ${t.dueDate || 'No date'} ${isOverdue ? '(Overdue)' : ''}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-secondary btn-sm btn-open-task" data-task-id="${t.id}">View</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>

      <!-- Recent Announcements Section -->
      <section class="section-panel" aria-labelledby="recent-announcements-title">
        <div class="section-panel-header">
          <h2 id="recent-announcements-title" class="section-panel-title">Recent Announcements</h2>
          <button class="btn btn-secondary btn-sm" id="btn-view-all-announcements">View all announcements</button>
        </div>

        ${recentAnnouncements.length === 0 ? `
          <div class="state-box">
            <p class="state-box-title">No recent announcements</p>
            <p class="state-box-desc">No messages published in the last 7 days.</p>
            ${isLead ? `<button class="btn btn-primary btn-sm" id="btn-empty-announcement">Create announcement</button>` : ''}
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: var(--spacing-4);">
            ${recentAnnouncements.map(a => `
              <article class="responsive-record-card" style="border-left: 4px solid var(--color-primary);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--spacing-2);">
                  <h3 style="font-size: var(--font-size-base); font-weight:700;">${escapeHtml(a.title)}</h3>
                  <span class="badge badge-published">Published</span>
                </div>
                <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin: var(--spacing-1) 0;">
                  By ${escapeHtml(a.authorName)} • ${a.publishedAt?.slice(0, 10)} • Target: ${a.targetOrgs.map(o => o === 'org-1' ? 'AqOne' : 'Dev Guild').join(', ')}
                </p>
                <p style="font-size: var(--font-size-sm);">${escapeHtml(a.body)}</p>
              </article>
            `).join('')}
          </div>
        `}
      </section>
    </div>
  `;

  // Attach quick action listeners
  if (isLead) {
    container.querySelector('#btn-quick-invite')?.addEventListener('click', () => actions.openInviteModal());
    container.querySelector('#btn-quick-task')?.addEventListener('click', () => actions.openTaskCreateModal());
    container.querySelector('#btn-quick-announcement')?.addEventListener('click', () => actions.openAnnouncementComposeModal());
    container.querySelector('#btn-empty-task')?.addEventListener('click', () => actions.openTaskCreateModal());
    container.querySelector('#btn-empty-announcement')?.addEventListener('click', () => actions.openAnnouncementComposeModal());
  }

  container.querySelector('#btn-view-all-tasks')?.addEventListener('click', () => actions.navigateTo('tasks'));
  container.querySelector('#btn-view-all-announcements')?.addEventListener('click', () => actions.navigateTo('announcements'));

  container.querySelectorAll('.btn-open-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-task-id');
      actions.openTaskDetailModal(taskId);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
