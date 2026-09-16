/**
 * Tasks view module
 * Requirements: FEAT-003/REQ-001 through REQ-008; PROD-005/UI-REQ-001 through 007
 */

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
  let showArchived = false;
  let overdueOnly = false;

  const todayManila = '2026-09-16';

  function getFilteredTasks() {
    let list = state.tasks;

    if (showArchived) {
      list = list.filter(t => t.archived);
    } else {
      list = list.filter(t => !t.archived);
    }

    if (currentScope !== 'all') {
      list = list.filter(t => t.orgId === currentScope);
    } else if (!isOwner) {
      const allowed = currentUser.memberships.map(m => m.orgId);
      list = list.filter(t => allowed.includes(t.orgId));
    }

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

    if (overdueOnly) {
      list = list.filter(t => t.status !== 'Done' && t.dueDate && t.dueDate < todayManila);
    }

    return list;
  }

  function renderList() {
    const list = getFilteredTasks();
    const tableContainer = container.querySelector('#tasks-list-container');
    if (!tableContainer) return;

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
      tableContainer.querySelector('#btn-clear-task-filters')?.addEventListener('click', () => {
        searchQuery = '';
        statusFilter = 'all';
        priorityFilter = 'all';
        assigneeFilter = 'all';
        overdueOnly = false;
        container.querySelector('#task-search').value = '';
        container.querySelector('#task-status-filter').value = 'all';
        container.querySelector('#task-priority-filter').value = 'all';
        container.querySelector('#task-assignee-filter').value = 'all';
        container.querySelector('#task-overdue-checkbox').checked = false;
        renderList();
      });
      tableContainer.querySelector('#btn-empty-create-task')?.addEventListener('click', () => {
        actions.openTaskCreateModal();
      });
      return;
    }

    tableContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table" aria-label="Organization tasks list">
          <thead>
            <tr>
              <th scope="col">Task Title</th>
              <th scope="col">Organization</th>
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
                    <strong>${escapeHtml(t.title)}</strong>
                    ${t.archived ? `<span class="badge badge-archived" style="margin-left:4px;">Archived</span>` : ''}
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">${(t.comments || []).length} comments</div>
                  </td>
                  <td>${t.orgId === 'org-1' ? 'AqOne' : 'Dev Guild'}</td>
                  <td><span class="badge badge-${t.status.toLowerCase().replace(' ', '_')}">${t.status}</span></td>
                  <td><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
                  <td>${escapeHtml(t.assigneeName || 'Unassigned')}</td>
                  <td>
                    <span style="${isOverdue ? 'color: var(--color-danger); font-weight:700;' : ''}">
                      ${t.dueDate || 'No date'} ${isOverdue ? '(Overdue)' : ''}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:180px;">
                      ${(t.labels || []).map(l => `<span style="font-size:0.7rem; background:#E2E8F0; padding:1px 4px; border-radius:3px;">${escapeHtml(l)}</span>`).join('')}
                    </div>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-open-task-detail" data-task-id="${t.id}">View / Edit</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    tableContainer.querySelectorAll('.btn-open-task-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.currentTarget.getAttribute('data-task-id');
        openTaskDetailModal(taskId, state, actions);
      });
    });
  }

  // Populate assignee filter dropdown with active members
  const availableAssignees = state.members.filter(m => m.status === 'active');

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
      <section class="filter-bar" aria-label="Task filters">
        <input type="search" id="task-search" class="filter-input" placeholder="Search tasks by title..." aria-label="Search tasks" />
        <select id="task-status-filter" class="filter-select" aria-label="Filter by status">
          <option value="all">All Statuses</option>
          <option value="Backlog">Backlog</option>
          <option value="In progress">In progress</option>
          <option value="Blocked">Blocked</option>
          <option value="Done">Done</option>
        </select>
        <select id="task-priority-filter" class="filter-select" aria-label="Filter by priority">
          <option value="all">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <select id="task-assignee-filter" class="filter-select" aria-label="Filter by assignee">
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          ${availableAssignees.map(a => `<option value="${a.userId}">${escapeHtml(a.displayName)} (${a.orgId === 'org-1' ? 'AqOne' : 'Dev Guild'})</option>`).join('')}
        </select>
        <label style="display:flex; align-items:center; gap:var(--spacing-1); font-size:var(--font-size-sm); cursor:pointer;">
          <input type="checkbox" id="task-overdue-checkbox" />
          Overdue only
        </label>
        <label style="display:flex; align-items:center; gap:var(--spacing-1); font-size:var(--font-size-sm); cursor:pointer;">
          <input type="checkbox" id="task-archived-checkbox" />
          Show Archived
        </label>
      </section>

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
    renderList();
  });

  container.querySelector('#task-priority-filter')?.addEventListener('change', (e) => {
    priorityFilter = e.target.value;
    renderList();
  });

  container.querySelector('#task-assignee-filter')?.addEventListener('change', (e) => {
    assigneeFilter = e.target.value;
    renderList();
  });

  container.querySelector('#task-overdue-checkbox')?.addEventListener('change', (e) => {
    overdueOnly = e.target.checked;
    renderList();
  });

  container.querySelector('#task-archived-checkbox')?.addEventListener('change', (e) => {
    showArchived = e.target.checked;
    renderList();
  });

  if (isLead) {
    container.querySelector('#btn-create-task')?.addEventListener('click', () => {
      actions.openTaskCreateModal();
    });
  }

  renderList();
}

/**
 * Task Detail & Edit Modal
 */
export function openTaskDetailModal(taskId, state, actions) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

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
    <div class="modal-backdrop" id="task-detail-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
      <div class="modal-dialog">
        <header class="modal-header">
          <div>
            <div style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase; font-weight:700;">
              ${task.orgId === 'org-1' ? 'AqOne' : 'Dev Guild'} • ${task.id}
              ${task.archived ? `<span class="badge badge-archived" style="margin-left:4px;">Archived (Read-only)</span>` : ''}
            </div>
            <h2 id="task-modal-title" class="modal-title">${escapeHtml(task.title)}</h2>
          </div>
          <button class="modal-close-btn" id="btn-close-task-modal" aria-label="Close dialog">&times;</button>
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
            <h3 style="font-size:var(--font-size-base); font-weight:700; margin-bottom:var(--spacing-3);">Comments (${(task.comments || []).length})</h3>

            <div id="task-comments-list" style="display:flex; flex-direction:column; gap:var(--spacing-3); margin-bottom:var(--spacing-4);">
              ${(task.comments || []).length === 0 ? `
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

            ${canComment ? `
              <div class="form-group">
                <label for="task-new-comment" class="form-label">Add Comment</label>
                <textarea id="task-new-comment" class="form-textarea" maxlength="2000" rows="2" placeholder="Write a comment..."></textarea>
                <button class="btn btn-secondary btn-sm" id="btn-add-comment" style="align-self:flex-start; margin-top:4px;">Post comment</button>
              </div>
            ` : ''}
          </div>

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

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('task-detail-modal');

  function closeModal() {
    modal.remove();
  }

  modal.querySelector('#btn-close-task-modal').addEventListener('click', closeModal);
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

    task.title = title;
    task.description = modal.querySelector('#task-edit-desc').value.trim();
    task.status = modal.querySelector('#task-edit-status').value;
    task.priority = modal.querySelector('#task-edit-priority').value;
    const assigneeId = modal.querySelector('#task-edit-assignee').value;
    task.assignee = assigneeId || null;
    const assigneeObj = state.members.find(m => m.userId === assigneeId);
    task.assigneeName = assigneeObj ? assigneeObj.displayName : 'Unassigned';
    task.dueDate = modal.querySelector('#task-edit-duedate').value || null;
    const labelsRaw = modal.querySelector('#task-edit-labels').value;
    task.labels = labelsRaw.split(',').map(l => l.trim()).filter(Boolean);
    task.updatedAt = new Date().toISOString();

    alert('Task updated successfully.');
    closeModal();
    actions.refresh();
  });

  // Save status by assignee
  modal.querySelector('#btn-save-assignee-status')?.addEventListener('click', () => {
    task.status = modal.querySelector('#task-member-status').value;
    task.updatedAt = new Date().toISOString();
    alert('Task status updated successfully.');
    closeModal();
    actions.refresh();
  });

  // Add comment
  modal.querySelector('#btn-add-comment')?.addEventListener('click', () => {
    const body = modal.querySelector('#task-new-comment').value.trim();
    if (!body) return;

    if (!task.comments) task.comments = [];
    task.comments.push({
      id: 'cmt-' + Date.now(),
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      body,
      createdAt: new Date().toISOString()
    });

    closeModal();
    openTaskDetailModal(taskId, state, actions);
    actions.refresh();
  });

  // Comment edit / delete
  modal.querySelectorAll('.btn-delete-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cmtId = e.currentTarget.getAttribute('data-cmt-id');
      task.comments = task.comments.filter(c => c.id !== cmtId);
      closeModal();
      openTaskDetailModal(taskId, state, actions);
      actions.refresh();
    });
  });

  modal.querySelectorAll('.btn-edit-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cmtId = e.currentTarget.getAttribute('data-cmt-id');
      const comment = task.comments.find(c => c.id === cmtId);
      if (!comment) return;
      const newBody = prompt('Edit comment:', comment.body);
      if (newBody !== null && newBody.trim()) {
        comment.body = newBody.trim();
        closeModal();
        openTaskDetailModal(taskId, state, actions);
        actions.refresh();
      }
    });
  });

  // Archive task
  modal.querySelector('#btn-archive-task')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to archive this task? Archived tasks are read-only.')) {
      task.archived = true;
      task.archivedAt = new Date().toISOString();
      alert('Task archived.');
      closeModal();
      actions.refresh();
    }
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
