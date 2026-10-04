/**
 * Tasks view module
 * Requirements: FEAT-003/REQ-001 through REQ-008; PROD-005/UI-REQ-001 through 007
 */

import { escapeHtml, orgLabel } from '../format.js';

export function renderTasks(container, state, actions) {
  const { currentUser, currentScope } = state;
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === currentScope);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');

  // Filter state
  let searchQuery = '';
  let statusFilter = 'all';
  let priorityFilter = 'all';
  let assigneeFilter = 'all';
  let labelFilter = 'all';
  let showArchived = false;
  let overdueOnly = false;

  const todayManila = '2026-09-16';

  function getScopedTasks() {
    let list = state.tasks;

    if (currentScope !== 'all') {
      list = list.filter(t => t.orgId === currentScope);
    } else if (!isOwner) {
      const allowed = currentUser.memberships.map(m => m.orgId);
      list = list.filter(t => allowed.includes(t.orgId));
    }

    return list;
  }

  function getFilteredTasks() {
    let list = getScopedTasks().filter(t => showArchived ? t.archived : !t.archived);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      list = list.filter(t => t.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (priorityFilter !== 'all') {
      list = list.filter(t => t.priority.toLowerCase() === priorityFilter.toLowerCase());
    }

    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        list = list.filter(t => !t.assignee);
      } else {
        list = list.filter(t => t.assignee === assigneeFilter);
      }
    }

    if (labelFilter !== 'all') {
      list = list.filter(t => (t.labels || []).includes(labelFilter));
    }

    if (overdueOnly) {
      list = list.filter(t => t.status !== 'Done' && t.dueDate && t.dueDate < todayManila);
    }

    return list;
  }

  function getActiveFilters() {
    const filters = [];
    if (statusFilter !== 'all') filters.push(['status', `Status: ${statusFilter}`]);
    if (priorityFilter !== 'all') filters.push(['priority', `Priority: ${priorityFilter}`]);
    if (assigneeFilter !== 'all') {
      const assignee = assigneeFilter === 'unassigned'
        ? 'Unassigned'
        : availableAssignees.find(m => m.userId === assigneeFilter)?.displayName || 'Selected member';
      filters.push(['assignee', `Assignee: ${assignee}`]);
    }
    if (labelFilter !== 'all') filters.push(['label', `Label: ${labelFilter}`]);
    if (overdueOnly) filters.push(['overdue', 'Overdue only']);
    if (showArchived) filters.push(['archived', 'Archived tasks']);
    return filters;
  }

  function updateFilterCount() {
    const count = getActiveFilters().length;
    container.querySelector('#task-filter-count').textContent = count ? `${count}` : '';
  }

  function renderActiveFilters() {
    container.querySelector('#task-active-filters').innerHTML = getActiveFilters().map(([key, label]) => `
      <span class="active-filter-chip">${escapeHtml(label)}<button type="button" data-clear-task-filter="${key}" aria-label="Remove ${escapeHtml(label)} filter">&times;</button></span>
    `).join('');
  }

  function resetFilters() {
    searchQuery = '';
    statusFilter = 'all';
    priorityFilter = 'all';
    assigneeFilter = 'all';
    labelFilter = 'all';
    overdueOnly = false;
    showArchived = false;
    container.querySelector('#task-search').value = '';
    container.querySelector('#task-status-filter').value = 'all';
    container.querySelector('#task-priority-filter').value = 'all';
    container.querySelector('#task-assignee-filter').value = 'all';
    container.querySelector('#task-label-filter').value = 'all';
    container.querySelector('#task-overdue-checkbox').checked = false;
    container.querySelector('#task-archived-checkbox').checked = false;
    container.querySelector('#task-filter-disclosure').open = false;
    updateFilterCount();
    renderList();
  }

  function renderList() {
    const list = getFilteredTasks();
    const tableContainer = container.querySelector('#tasks-list-container');
    if (!tableContainer) return;

    renderActiveFilters();

    if (list.length === 0) {
      tableContainer.innerHTML = `
        <div class="state-box">
          <p class="state-box-title">No tasks found</p>
          <p class="state-box-desc">No tasks match your active filters or criteria.</p>
          <div style="display:flex; justify-content:center; gap:var(--spacing-2);">
            <button class="btn btn-secondary btn-sm" id="btn-clear-task-filters">Clear filters</button>
            ${isLead && !showArchived ? `<button class="btn btn-primary btn-sm" id="btn-empty-create-task">New task</button>` : ''}
          </div>
        </div>
      `;
      tableContainer.querySelector('#btn-clear-task-filters')?.addEventListener('click', resetFilters);
      tableContainer.querySelector('#btn-empty-create-task')?.addEventListener('click', () => {
        actions.openTaskCreateModal();
      });
      return;
    }

    tableContainer.innerHTML = `
      <p class="page-result-count" aria-live="polite">${list.length} ${list.length === 1 ? 'task' : 'tasks'} shown</p>
      <div class="table-responsive record-table-view">
        <table class="data-table" aria-label="Organization tasks list">
          <thead>
            <tr>
              <th scope="col">Task Title</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Assignee</th>
              <th scope="col">Due Date</th>
              <th scope="col">Labels</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(t => {
              const isOverdue = !t.archived && t.status !== 'Done' && t.dueDate && t.dueDate < todayManila;
              return `
                <tr ${t.archived ? 'style="opacity:0.75;"' : ''}>
                  <td>
                    <button type="button" class="record-title-link btn-open-task-detail" data-task-id="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button>
                    ${t.archived ? `<span class="badge badge-archived" style="margin-left:4px;">Archived</span>` : ''}
                    <div class="record-card-subline">${escapeHtml(orgLabel(state, t.orgId))}</div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">${t.commentCount ?? (t.comments || []).length} comments</div>
                  </td>
                  <td><span class="badge badge-${t.status.toLowerCase().replace(' ', '_')}">${escapeHtml(t.status)}</span></td>
                  <td><span class="badge badge-${t.priority.toLowerCase()}">${escapeHtml(t.priority)}</span></td>
                  <td>${escapeHtml(t.assigneeName || 'Unassigned')}</td>
                  <td>
                    <span style="${isOverdue ? 'color: var(--color-danger); font-weight:700;' : ''}">
                      ${t.dueDate || 'No date'} ${isOverdue ? '(Overdue)' : ''}
                    </span>
                  </td>
                  <td>
                    <div class="member-skill-list" style="max-width:180px;">
                      ${(t.labels || []).map(l => `<span class="badge">${escapeHtml(l)}</span>`).join('')}
                    </div>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-open-task-detail" data-task-id="${escapeHtml(t.id)}">Details</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="mobile-record-list" aria-label="Organization task records">
        ${list.map(t => {
          const isOverdue = !t.archived && t.status !== 'Done' && t.dueDate && t.dueDate < todayManila;
          return `
            <article class="responsive-record-card" id="task-card-${escapeHtml(t.id)}">
              <div class="record-card-chips">
                <span class="badge badge-${t.status.toLowerCase().replace(' ', '_')}">${escapeHtml(t.status)}</span>
                <span class="badge badge-${t.priority.toLowerCase()}">${escapeHtml(t.priority)} priority</span>
                ${t.archived ? '<span class="badge badge-archived">Archived</span>' : ''}
                ${isOverdue ? '<span class="badge badge-blocked">Overdue</span>' : ''}
              </div>
              <button type="button" class="record-title-link btn-open-task-detail" data-task-id="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button>
              <p class="record-card-subline">${escapeHtml(orgLabel(state, t.orgId))}</p>
              <div class="record-card-meta">
                <span>${escapeHtml(t.assigneeName || 'Unassigned')}</span>
                <span>${escapeHtml(t.dueDate || 'No date')}${isOverdue ? ' (Overdue)' : ''}</span>
                <span>${t.commentCount ?? (t.comments || []).length} comments</span>
              </div>
              ${(t.labels || []).length ? `
                <div class="member-skill-list" aria-label="Task labels">
                  ${(t.labels || []).map(l => `<span class="badge">${escapeHtml(l)}</span>`).join('')}
                </div>
              ` : ''}
              <button class="btn btn-secondary btn-sm btn-open-task-detail" data-task-id="${escapeHtml(t.id)}">View / Edit</button>
            </article>
          `;
        }).join('')}
      </div>
    `;

    tableContainer.querySelectorAll('.btn-open-task-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.currentTarget.getAttribute('data-task-id');
        openTaskDetailModal(taskId, state, actions, e.currentTarget);
      });
    });
  }

  // Populate assignee filter dropdown with active members
  const availableAssignees = state.members.filter(m => m.status === 'active');
  const availableLabels = [...new Set(getScopedTasks().flatMap(t => t.labels || []))].sort((a, b) => a.localeCompare(b));

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <h1>Tasks</h1>
        <p>Assignment, tracking, due dates, and discussion.</p>
      </div>
      <div class="page-actions">
        ${isLead ? `
          <button class="btn btn-primary" id="btn-create-task">New task</button>
        ` : ''}
      </div>
    </header>

    <div class="content-area">
      <section class="page-tools" aria-label="Task search and filters">
        <div class="search-field">
          <label for="task-search" class="form-label">Search tasks</label>
          <input type="search" id="task-search" class="filter-input" placeholder="Task title or description" />
        </div>
        <details class="filter-disclosure" id="task-filter-disclosure">
          <summary>Filters<span class="filter-count" id="task-filter-count"></span></summary>
          <div class="filter-disclosure-content">
            <div class="filter-select-wrap">
              <label for="task-status-filter" class="form-label">Status</label>
              <select id="task-status-filter" class="filter-select">
                <option value="all">All statuses</option>
                <option value="Backlog">Backlog</option>
                <option value="In progress">In progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div class="filter-select-wrap">
              <label for="task-priority-filter" class="form-label">Priority</label>
              <select id="task-priority-filter" class="filter-select">
                <option value="all">All priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div class="filter-select-wrap">
              <label for="task-assignee-filter" class="form-label">Assignee</label>
              <select id="task-assignee-filter" class="filter-select">
                <option value="all">All assignees</option>
                <option value="unassigned">Unassigned</option>
                ${availableAssignees.map(a => `<option value="${escapeHtml(a.userId)}">${escapeHtml(a.displayName)} (${escapeHtml(orgLabel(state, a.orgId))})</option>`).join('')}
              </select>
            </div>
            <div class="filter-select-wrap">
              <label for="task-label-filter" class="form-label">Label</label>
              <select id="task-label-filter" class="filter-select">
                <option value="all">All labels</option>
                ${availableLabels.map(label => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join('')}
              </select>
            </div>
            <label class="filter-checkbox"><input type="checkbox" id="task-overdue-checkbox" /> Overdue only</label>
            <label class="filter-checkbox"><input type="checkbox" id="task-archived-checkbox" /> Show archived</label>
          </div>
        </details>
      </section>

      <div id="task-active-filters" class="active-filter-chips" aria-label="Active task filters" aria-live="polite"></div>

      <section class="section-panel">
        <div id="tasks-list-container"></div>
      </section>
    </div>
  `;

  // Filter events
  container.querySelector('#task-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  container.querySelector('#task-status-filter')?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#task-priority-filter')?.addEventListener('change', (e) => {
    priorityFilter = e.target.value;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#task-assignee-filter')?.addEventListener('change', (e) => {
    assigneeFilter = e.target.value;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#task-label-filter')?.addEventListener('change', (e) => {
    labelFilter = e.target.value;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#task-overdue-checkbox')?.addEventListener('change', (e) => {
    overdueOnly = e.target.checked;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#task-archived-checkbox')?.addEventListener('change', (e) => {
    showArchived = e.target.checked;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#task-active-filters')?.addEventListener('click', (e) => {
    const filter = e.target.closest('[data-clear-task-filter]')?.dataset.clearTaskFilter;
    if (!filter) return;
    if (filter === 'status') statusFilter = 'all';
    if (filter === 'priority') priorityFilter = 'all';
    if (filter === 'assignee') assigneeFilter = 'all';
    if (filter === 'label') labelFilter = 'all';
    if (filter === 'overdue') overdueOnly = false;
    if (filter === 'archived') showArchived = false;
    container.querySelector('#task-status-filter').value = statusFilter;
    container.querySelector('#task-priority-filter').value = priorityFilter;
    container.querySelector('#task-assignee-filter').value = assigneeFilter;
    container.querySelector('#task-label-filter').value = labelFilter;
    container.querySelector('#task-overdue-checkbox').checked = overdueOnly;
    container.querySelector('#task-archived-checkbox').checked = showArchived;
    updateFilterCount();
    renderList();
  });

  if (isLead) {
    container.querySelector('#btn-create-task')?.addEventListener('click', () => {
      actions.openTaskCreateModal();
    });
  }

  updateFilterCount();
  renderList();
}

/**
 * Task Detail & Edit Modal
 */
export function openTaskDetailModal(taskId, state, actions, triggerElement = null) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!Array.isArray(task.comments)) task.comments = [];

  const { currentUser } = state;
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === task.orgId);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');
  const isAssignee = currentUser.id === task.assignee;

  // Permissions:
  // Owner/Lead can edit everything and archive
  // Assigned Member can ONLY edit Status
  // Other Members have read-only view
  const canEditFull = isLead && !task.archived;
  const canEditStatusOnly = !isLead && isAssignee && !task.archived;
  const canComment = !task.archived && (isLead || isAssignee || userMembership);

  // Available assignees in this task's organization
  const orgAssignees = state.members.filter(m => m.orgId === task.orgId && m.status === 'active');

  const modalHtml = `
    <div class="modal-backdrop detail-panel-backdrop" id="task-detail-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
      <div class="modal-dialog">
        <header class="modal-header">
          <div>
            <div style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase; font-weight:700;">
              ${escapeHtml(orgLabel(state, task.orgId))} • ${task.id}
              ${task.archived ? `<span class="badge badge-archived" style="margin-left:4px;">Archived (Read-only)</span>` : ''}
            </div>
            <h2 id="task-modal-title" class="modal-title">${escapeHtml(task.title)}</h2>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-close-task-modal" aria-label="Close dialog">Close</button>
        </header>

        <div class="modal-body">
          <div id="task-modal-alert"></div>

          ${canEditFull ? `
            <div class="form-group">
              <label for="task-edit-title" class="form-label">Title</label>
              <input type="text" id="task-edit-title" class="form-input" value="${escapeHtml(task.title)}" maxlength="160" required />
            </div>

            <div class="form-group">
              <label for="task-edit-desc" class="form-label">Description</label>
              <textarea id="task-edit-desc" class="form-textarea" maxlength="10000" rows="3">${escapeHtml(task.description || '')}</textarea>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--spacing-3);">
              <div class="form-group">
                <label for="task-edit-status" class="form-label">Status</label>
                <select id="task-edit-status" class="form-select">
                  <option value="Backlog" ${task.status === 'Backlog' ? 'selected' : ''}>Backlog</option>
                  <option value="In progress" ${task.status === 'In progress' ? 'selected' : ''}>In progress</option>
                  <option value="Blocked" ${task.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
                  <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Done</option>
                </select>
              </div>

              <div class="form-group">
                <label for="task-edit-priority" class="form-label">Priority</label>
                <select id="task-edit-priority" class="form-select">
                  <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
                  <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                  <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--spacing-3);">
              <div class="form-group">
                <label for="task-edit-assignee" class="form-label">Assignee</label>
                <select id="task-edit-assignee" class="form-select">
                  <option value="">Unassigned</option>
                  ${orgAssignees.map(a => `<option value="${a.userId}" ${task.assignee === a.userId ? 'selected' : ''}>${escapeHtml(a.displayName)}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label for="task-edit-duedate" class="form-label">Due Date (Manila)</label>
                <input type="date" id="task-edit-duedate" class="form-input" value="${task.dueDate || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label for="task-edit-labels" class="form-label">Labels (comma-separated)</label>
              <input type="text" id="task-edit-labels" class="form-input" value="${escapeHtml((task.labels || []).join(', '))}" />
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:var(--spacing-2);">
              <button class="btn btn-primary btn-sm" id="btn-save-task-changes">Save changes</button>
              <button class="btn btn-secondary btn-sm" id="btn-simulate-conflict" style="font-size:0.75rem;">Simulate edit conflict</button>
            </div>
          ` : canEditStatusOnly ? `
            <div style="background:var(--color-background); padding:var(--spacing-4); border-radius:var(--radius-md); margin-bottom:var(--spacing-3);">
              <p style="font-size:var(--font-size-sm); margin-bottom:var(--spacing-2);"><strong>Description:</strong> ${escapeHtml(task.description || 'None')}</p>
              <p style="font-size:var(--font-size-sm);"><strong>Priority:</strong> ${task.priority} • <strong>Due:</strong> ${task.dueDate || 'No date'}</p>
            </div>

            <div class="form-group">
              <label for="task-member-status" class="form-label">Your Status Update (Assignee)</label>
              <select id="task-member-status" class="form-select">
                <option value="Backlog" ${task.status === 'Backlog' ? 'selected' : ''}>Backlog</option>
                <option value="In progress" ${task.status === 'In progress' ? 'selected' : ''}>In progress</option>
                <option value="Blocked" ${task.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
                <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Done</option>
              </select>
              <button class="btn btn-primary btn-sm" id="btn-save-assignee-status" style="align-self:flex-start; margin-top:var(--spacing-2);">Update status</button>
            </div>
          ` : `
            <div style="background:var(--color-background); padding:var(--spacing-4); border-radius:var(--radius-md); margin-bottom:var(--spacing-3);">
              <p style="font-size:var(--font-size-sm); margin-bottom:var(--spacing-2);"><strong>Description:</strong> ${escapeHtml(task.description || 'None')}</p>
              <p style="font-size:var(--font-size-sm);"><strong>Status:</strong> ${task.status} • <strong>Priority:</strong> ${task.priority} • <strong>Assignee:</strong> ${escapeHtml(task.assigneeName || 'Unassigned')} • <strong>Due:</strong> ${task.dueDate || 'No date'}</p>
              <p style="font-size:0.75rem; color:var(--color-text-muted); margin-top:var(--spacing-2);">You have read-only access to this task.</p>
            </div>
          `}

          <!-- Comments Section -->
          <div style="margin-top:var(--spacing-6); padding-top:var(--spacing-4); border-top:1px solid var(--color-border);">
            <h3 id="task-comments-heading" style="font-size:var(--font-size-base); font-weight:700; margin-bottom:var(--spacing-3);">Comments (${state.isRealAuth ? (task.commentCount ?? 0) : (task.comments || []).length})</h3>

            <div id="task-comments-list" style="display:flex; flex-direction:column; gap:var(--spacing-3); margin-bottom:var(--spacing-4);">
              ${state.isRealAuth ? `
                <p class="history-loading" role="status">Loading comments...</p>
              ` : (task.comments || []).length === 0 ? `
                <p style="font-size:var(--font-size-sm); color:var(--color-text-muted);">No comments yet.</p>
              ` : (task.comments || []).map(c => {
                const canModerate = isLead || c.authorId === currentUser.id;
                return `
                  <div class="responsive-record-card" style="padding:var(--spacing-3); background:var(--color-background);" id="comment-${c.id}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <strong style="font-size:0.8125rem;">${escapeHtml(c.authorName)}</strong>
                      <span style="font-size:0.7rem; color:var(--color-text-muted);">${c.createdAt?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p style="font-size:var(--font-size-sm); margin: var(--spacing-1) 0;" id="comment-body-${c.id}">${escapeHtml(c.body)}</p>
                    ${canModerate && !task.archived ? `
                      <div style="display:flex; gap:var(--spacing-2); justify-content:flex-end;">
                        ${c.authorId === currentUser.id ? `<button class="btn btn-secondary btn-sm btn-edit-comment" data-cmt-id="${c.id}" style="font-size:0.7rem; min-height:28px; padding:2px 8px;">Edit</button>` : ''}
                        <button class="btn btn-danger btn-sm btn-delete-comment" data-cmt-id="${c.id}" style="font-size:0.7rem; min-height:28px; padding:2px 8px;">Remove</button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
            ${state.isRealAuth ? `
              <p id="task-comments-history-status" role="status" aria-live="polite"></p>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-load-older-comments" hidden>Load older comments</button>
            ` : ''}

            ${canComment ? `
              <div class="form-group">
                <label for="task-new-comment" class="form-label">Add Comment</label>
                <textarea id="task-new-comment" class="form-textarea" maxlength="2000" rows="2" placeholder="Write a comment..."></textarea>
                <button class="btn btn-secondary btn-sm" id="btn-add-comment" style="align-self:flex-start; margin-top:4px;">Post comment</button>
              </div>
            ` : ''}
          </div>

          ${state.isRealAuth ? `
            <section aria-labelledby="task-activity-heading" style="margin-top:var(--spacing-6); padding-top:var(--spacing-4); border-top:1px solid var(--color-border);">
              <h3 id="task-activity-heading" style="font-size:var(--font-size-base); font-weight:700; margin-bottom:var(--spacing-3);">Activity</h3>
              <div id="task-activity-list" style="display:flex; flex-direction:column; gap:var(--spacing-3); margin-bottom:var(--spacing-4);">
                <p role="status">Loading activity...</p>
              </div>
              <p id="task-activity-history-status" role="status" aria-live="polite"></p>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-load-older-activity" hidden>Load older activity</button>
            </section>
          ` : ''}

          <!-- Archive Action -->
          ${canEditFull && !task.archived ? `
            <div style="margin-top:var(--spacing-6); padding-top:var(--spacing-4); border-top:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>Archive Task</strong>
                <p style="font-size:0.75rem; color:var(--color-text-muted);">Archived tasks disappear from active views and become read-only.</p>
              </div>
              <button class="btn btn-danger btn-sm" id="btn-archive-task">Archive task</button>
            </div>
          ` : ''}
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" id="btn-close-task-bottom">Close</button>
        </footer>
      </div>
    </div>
  `;

  const invokingElement = triggerElement || document.activeElement;
  const selectedRecord = invokingElement?.closest('tr, .responsive-record-card');
  selectedRecord?.classList.add('is-selected');
  selectedRecord?.setAttribute('aria-current', 'true');
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('task-detail-modal');

  let commentsCursor = null;
  let activityCursor = null;
  let commentsLoading = false;
  let activityLoading = false;
  let activityItems = [];

  function historyHeaders() {
    return { 'Authorization': `Bearer ${state.token}` };
  }

  function renderCommentsHistory() {
    const list = modal.querySelector('#task-comments-list');
    const count = task.commentCount ?? task.comments.length;
    modal.querySelector('#task-comments-heading').textContent = `Comments (${count})`;
    list.innerHTML = task.comments.length === 0
      ? '<p style="font-size:var(--font-size-sm); color:var(--color-text-muted);">No comments yet.</p>'
      : task.comments.map(c => {
        const canModerate = isLead || c.authorId === currentUser.id;
        return `
          <div class="responsive-record-card" style="padding:var(--spacing-3); background:var(--color-background);" id="comment-${escapeHtml(c.id)}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:0.8125rem;">${escapeHtml(c.authorName || 'Team member')}</strong>
              <span style="font-size:0.7rem; color:var(--color-text-muted);">${escapeHtml(c.createdAt?.slice(0, 16).replace('T', ' ') || '')}</span>
            </div>
            <p style="font-size:var(--font-size-sm); margin: var(--spacing-1) 0;" id="comment-body-${escapeHtml(c.id)}">${escapeHtml(c.body)}</p>
            ${canModerate && !task.archived ? `
              <div style="display:flex; gap:var(--spacing-2); justify-content:flex-end;">
                ${c.authorId === currentUser.id ? `<button type="button" class="btn btn-secondary btn-sm btn-edit-comment" data-cmt-id="${escapeHtml(c.id)}" style="font-size:0.7rem; min-height:28px; padding:2px 8px;">Edit</button>` : ''}
                <button type="button" class="btn btn-danger btn-sm btn-delete-comment" data-cmt-id="${escapeHtml(c.id)}" style="font-size:0.7rem; min-height:28px; padding:2px 8px;">Remove</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

    const button = modal.querySelector('#btn-load-older-comments');
    button.hidden = !commentsCursor && !button.dataset.retry;
    button.disabled = commentsLoading;
    button.textContent = button.dataset.retry ? 'Retry loading comments' : 'Load older comments';
  }

  async function loadCommentsPage() {
    if (commentsLoading) return;
    commentsLoading = true;
    const status = modal.querySelector('#task-comments-history-status');
    const button = modal.querySelector('#btn-load-older-comments');
    if (button) button.disabled = true;
    status.setAttribute('role', 'status');
    status.textContent = commentsCursor ? 'Loading older comments...' : 'Loading comments...';
    const loadingOlder = Boolean(commentsCursor);
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (commentsCursor) query.set('cursor', commentsCursor);
      const response = await fetch(`/api/organizations/${encodeURIComponent(task.orgId)}/tasks/${encodeURIComponent(task.id)}/comments?${query}`, { headers: historyHeaders() });
      const page = await response.json();
      if (!response.ok) throw new Error(page.message || 'Could not load comments.');
      task.comments = commentsCursor ? [...task.comments, ...page.comments] : page.comments;
      task.commentCount ??= task.comments.length;
      commentsCursor = page.nextCursor;
      if (button) delete button.dataset.retry;
      status.textContent = `Loaded ${page.comments.length} ${loadingOlder ? 'older' : 'newest'} comments.`;
      renderCommentsHistory();
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = error.message || 'Could not load comments.';
      if (button) {
        button.dataset.retry = 'true';
        button.hidden = false;
        button.textContent = 'Retry loading comments';
      }
    } finally {
      commentsLoading = false;
      if (button) button.disabled = false;
    }
  }

  function renderActivityHistory() {
    const list = modal.querySelector('#task-activity-list');
    list.innerHTML = activityItems.length === 0
      ? '<p style="font-size:var(--font-size-sm); color:var(--color-text-muted);">No activity yet.</p>'
      : activityItems.map(item => `
        <article class="responsive-record-card" data-activity-id="${escapeHtml(item.id)}" style="padding:var(--spacing-3); background:var(--color-background);">
          <strong style="font-size:0.8125rem;">${escapeHtml(item.actorName || 'Team member')}</strong>
          <p style="font-size:var(--font-size-sm); margin:var(--spacing-1) 0;">${escapeHtml(String(item.action || '').replaceAll('_', ' '))}</p>
          <time style="font-size:0.7rem; color:var(--color-text-muted);">${escapeHtml(item.createdAt?.slice(0, 16).replace('T', ' ') || '')}</time>
        </article>
      `).join('');

    const button = modal.querySelector('#btn-load-older-activity');
    button.hidden = !activityCursor && !button.dataset.retry;
    button.disabled = activityLoading;
    button.textContent = button.dataset.retry ? 'Retry loading activity' : 'Load older activity';
  }

  async function loadActivityPage() {
    if (activityLoading) return;
    activityLoading = true;
    const status = modal.querySelector('#task-activity-history-status');
    const button = modal.querySelector('#btn-load-older-activity');
    if (button) button.disabled = true;
    status.setAttribute('role', 'status');
    status.textContent = activityCursor ? 'Loading older activity...' : 'Loading activity...';
    const loadingOlder = Boolean(activityCursor);
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (activityCursor) query.set('cursor', activityCursor);
      const response = await fetch(`/api/organizations/${encodeURIComponent(task.orgId)}/tasks/${encodeURIComponent(task.id)}/activity?${query}`, { headers: historyHeaders() });
      const page = await response.json();
      if (!response.ok) throw new Error(page.message || 'Could not load activity.');
      activityItems = activityCursor ? [...activityItems, ...page.activity] : page.activity;
      activityCursor = page.nextCursor;
      if (button) delete button.dataset.retry;
      status.textContent = `Loaded ${page.activity.length} ${loadingOlder ? 'older' : 'newest'} activity records.`;
      renderActivityHistory();
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = error.message || 'Could not load activity.';
      if (button) {
        button.dataset.retry = 'true';
        button.hidden = false;
        button.textContent = 'Retry loading activity';
      }
    } finally {
      activityLoading = false;
      if (button) button.disabled = false;
    }
  }

  if (state.isRealAuth && state.token) {
    modal.querySelector('#btn-load-older-comments').addEventListener('click', loadCommentsPage);
    modal.querySelector('#btn-load-older-activity').addEventListener('click', loadActivityPage);
    loadCommentsPage();
    loadActivityPage();
  }

  function closeModal() {
    modal.remove();
    selectedRecord?.classList.remove('is-selected');
    selectedRecord?.removeAttribute('aria-current');
    if (invokingElement?.isConnected) invokingElement.focus();
  }

  function refreshAndReopen() {
    closeModal();
    actions.refresh();
    const refreshedTrigger = Array.from(document.querySelectorAll('.btn-open-task-detail'))
      .find(button => button.dataset.taskId === taskId && button.getClientRects().length > 0);
    openTaskDetailModal(taskId, state, actions, refreshedTrigger);
  }

  modal.querySelector('#btn-close-task-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-close-task-modal').focus();
  modal.querySelector('#btn-close-task-bottom').addEventListener('click', closeModal);

  // Stale edit simulation
  let simulatedStale = false;
  modal.querySelector('#btn-simulate-conflict')?.addEventListener('click', () => {
    simulatedStale = true;
    modal.querySelector('#task-modal-alert').innerHTML = `
      <div class="alert-banner alert-warning">
        <span>Simulated: Another user just updated this task in the database.</span>
      </div>
    `;
  });

  // Save changes by Lead/Owner
  modal.querySelector('#btn-save-task-changes')?.addEventListener('click', () => {
    if (simulatedStale) {
      modal.querySelector('#task-modal-alert').innerHTML = `
        <div class="alert-banner alert-danger" role="alert">
          <div>
            <strong>Edit conflict!</strong> Another user updated this task. Your unsaved changes have been kept.
            Please <button class="btn btn-secondary btn-sm" id="btn-reload-task-conflict" style="margin-left:6px; min-height:30px;">Reload</button>
          </div>
        </div>
      `;
      modal.querySelector('#btn-reload-task-conflict')?.addEventListener('click', () => {
        closeModal();
        openTaskDetailModal(taskId, state, actions);
      });
      return;
    }

    const title = modal.querySelector('#task-edit-title').value.trim();
    if (!title) {
      alert('Task title cannot be empty.');
      return;
    }

    const description = modal.querySelector('#task-edit-desc').value.trim();
    const status = modal.querySelector('#task-edit-status').value;
    const priority = modal.querySelector('#task-edit-priority').value;
    const assigneeId = modal.querySelector('#task-edit-assignee').value;
    const dueDate = modal.querySelector('#task-edit-duedate').value || null;
    const labelsRaw = modal.querySelector('#task-edit-labels').value;
    const labels = labelsRaw.split(',').map(l => l.trim()).filter(Boolean);

    if (state.isRealAuth && state.token) {
      fetch(`/api/organizations/${task.orgId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          title,
          description,
          status,
          priority,
          assigneeId: assigneeId || null,
          dueDate,
          labels,
          version: task.version,
        }),
      }).then(async res => {
        if (res.status === 409) {
          modal.querySelector('#task-modal-alert').innerHTML = `
            <div class="alert-banner alert-danger" role="alert">
              <div>
                <strong>Edit conflict!</strong> Another user updated this task. Your unsaved changes have been kept.
                Please <button class="btn btn-secondary btn-sm" id="btn-reload-task-conflict" style="margin-left:6px; min-height:30px;">Reload</button>
              </div>
            </div>
          `;
          modal.querySelector('#btn-reload-task-conflict')?.addEventListener('click', () => {
            closeModal();
            actions.refresh();
          });
          return;
        }
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.message || 'Failed to update task.'}`);
          return;
        }
        const updated = await res.json();
        Object.assign(task, {
          title: updated.title,
          description: updated.description,
          status: updated.status,
          priority: updated.priority,
          assignee: updated.assigneeId,
          dueDate: updated.dueDate,
          labels: updated.labels,
          version: updated.version,
          updatedAt: updated.updatedAt,
        });
        alert('Task updated successfully.');
        closeModal();
        actions.refresh();
      }).catch(err => {
        alert(`Network error: ${err.message}`);
      });
      return;
    }

    task.title = title;
    task.description = description;
    task.status = status;
    task.priority = priority;
    task.assignee = assigneeId || null;
    const assigneeObj = state.members.find(m => m.userId === assigneeId);
    task.assigneeName = assigneeObj ? assigneeObj.displayName : 'Unassigned';
    task.dueDate = dueDate;
    task.labels = labels;
    task.updatedAt = new Date().toISOString();

    alert('Task updated successfully.');
    closeModal();
    actions.refresh();
  });

  // Save status by assignee
  modal.querySelector('#btn-save-assignee-status')?.addEventListener('click', () => {
    const status = modal.querySelector('#task-member-status').value;

    if (state.isRealAuth && state.token) {
      fetch(`/api/organizations/${task.orgId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({ status, version: task.version }),
      }).then(async res => {
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.message || 'Failed to update status.'}`);
          return;
        }
        const updated = await res.json();
        task.status = updated.status;
        task.version = updated.version;
        task.updatedAt = updated.updatedAt;
        alert('Task status updated successfully.');
        closeModal();
        actions.refresh();
      }).catch(err => {
        alert(`Network error: ${err.message}`);
      });
      return;
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    alert('Task status updated successfully.');
    closeModal();
    actions.refresh();
  });

  // Add comment
  modal.querySelector('#btn-add-comment')?.addEventListener('click', () => {
    const body = modal.querySelector('#task-new-comment').value.trim();
    if (!body) return;

    if (state.isRealAuth && state.token) {
      fetch(`/api/organizations/${task.orgId}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({ body }),
      }).then(async res => {
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.message || 'Failed to post comment.'}`);
          return;
        }
        const newCmt = await res.json();
        if (!task.comments) task.comments = [];
        task.commentCount = Number(task.commentCount || 0) + 1;
        task.comments.push({
          id: newCmt.id,
          authorId: newCmt.authorId,
          authorName: newCmt.authorName || currentUser.displayName,
          body: newCmt.body,
          createdAt: newCmt.createdAt,
        });
        refreshAndReopen();
      }).catch(err => {
        alert(`Network error: ${err.message}`);
      });
      return;
    }

    if (!task.comments) task.comments = [];
    task.comments.push({
      id: 'cmt-' + Date.now(),
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      body,
      createdAt: new Date().toISOString(),
    });

    refreshAndReopen();
  });

  // Delegate so comment actions continue to work on every loaded page.
  modal.querySelector('#task-comments-list').addEventListener('click', async (event) => {
    const button = event.target.closest('.btn-edit-comment, .btn-delete-comment');
    if (!button) return;
    const commentId = button.dataset.cmtId;
    const comment = task.comments.find(item => item.id === commentId);
    if (!comment) return;

    if (button.matches('.btn-delete-comment')) {
      if (state.isRealAuth && state.token) {
        try {
          const response = await fetch(`/api/organizations/${encodeURIComponent(task.orgId)}/tasks/${encodeURIComponent(task.id)}/comments/${encodeURIComponent(commentId)}`, {
            method: 'DELETE',
            headers: historyHeaders(),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Failed to delete comment.');
        } catch (error) {
          alert(`Error: ${error.message || 'Failed to delete comment.'}`);
          return;
        }
      }
      task.comments = task.comments.filter(item => item.id !== commentId);
      if (task.commentCount !== undefined) task.commentCount = Math.max(0, Number(task.commentCount) - 1);
      refreshAndReopen();
      return;
    }

    const newBody = prompt('Edit comment:', comment.body);
    if (newBody === null || !newBody.trim()) return;
    if (state.isRealAuth && state.token) {
      try {
        const response = await fetch(`/api/organizations/${encodeURIComponent(task.orgId)}/tasks/${encodeURIComponent(task.id)}/comments/${encodeURIComponent(commentId)}`, {
          method: 'PATCH',
          headers: { ...historyHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: newBody.trim() }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update comment.');
        comment.body = result.body;
      } catch (error) {
        alert(`Error: ${error.message || 'Failed to update comment.'}`);
        return;
      }
    } else {
      comment.body = newBody.trim();
    }
    refreshAndReopen();
  });

  // Archive task
  modal.querySelector('#btn-archive-task')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to archive this task? Archived tasks are read-only.')) {
      if (state.isRealAuth && state.token) {
        fetch(`/api/organizations/${task.orgId}/tasks/${task.id}/archive`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.token}` },
        }).then(async res => {
          if (!res.ok) {
            const err = await res.json();
            alert(`Error: ${err.message || 'Failed to archive task.'}`);
            return;
          }
          task.archived = true;
          task.archivedAt = new Date().toISOString();
          alert('Task archived.');
          closeModal();
          actions.refresh();
        }).catch(err => {
          alert(`Network error: ${err.message}`);
        });
        return;
      }

      task.archived = true;
      task.archivedAt = new Date().toISOString();
      alert('Task archived.');
      closeModal();
      actions.refresh();
    }
  });
}
