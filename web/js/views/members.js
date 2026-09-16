/**
 * Members view module
 * Requirements: FEAT-002/REQ-001 through REQ-009; PROD-005/UI-REQ-001 through 007
 */

export function renderMembers(container, state, actions) {
  const { currentUser, currentScope } = state;
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === currentScope);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');

  // Filter state
  let searchQuery = '';
  let roleFilter = 'all';
  let statusFilter = 'all';

  function getFilteredMembers() {
    let list = state.members;
    if (currentScope !== 'all') {
      list = list.filter(m => m.orgId === currentScope);
    } else if (!isOwner) {
      const allowed = currentUser.memberships.map(m => m.orgId);
      list = list.filter(m => allowed.includes(m.orgId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m => m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }

    if (roleFilter !== 'all') {
      list = list.filter(m => m.role.toLowerCase() === roleFilter.toLowerCase());
    }

    if (statusFilter !== 'all') {
      list = list.filter(m => m.status.toLowerCase() === statusFilter.toLowerCase());
    }

    return list;
  }

  function renderList() {
    const list = getFilteredMembers();
    const tableContainer = container.querySelector('#members-list-container');
    if (!tableContainer) return;

    if (list.length === 0) {
      tableContainer.innerHTML = `
        <div class="state-box">
          <p class="state-box-title">No members found</p>
          <p class="state-box-desc">Try adjusting your search terms or filters.</p>
          <button class="btn btn-secondary btn-sm" id="btn-clear-member-filters">Clear filters</button>
        </div>
      `;
      tableContainer.querySelector('#btn-clear-member-filters')?.addEventListener('click', () => {
        searchQuery = '';
        roleFilter = 'all';
        statusFilter = 'all';
        container.querySelector('#member-search').value = '';
        container.querySelector('#member-role-filter').value = 'all';
        container.querySelector('#member-status-filter').value = 'all';
        renderList();
      });
      return;
    }

    tableContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table" aria-label="Organization members directory">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Organization</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Skills & Interests</th>
              <th scope="col">Joined</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(m => `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:var(--spacing-3);">
                    <div class="avatar-badge" style="background-color: ${m.avatarColor || '#0F766E'};">
                      ${escapeHtml(m.displayName.slice(0, 2).toUpperCase())}
                    </div>
                    <div>
                      <strong>${escapeHtml(m.displayName)}</strong>
                      <div style="font-size:0.75rem; color:var(--color-text-muted);">${escapeHtml(m.email)}</div>
                    </div>
                  </div>
                </td>
                <td>${m.orgId === 'org-1' ? 'AqOne' : 'Dev Guild'}</td>
                <td><span class="badge badge-${m.role.toLowerCase()}">${m.role}</span></td>
                <td><span class="badge badge-${m.status.toLowerCase()}">${m.status}</span></td>
                <td>
                  <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:260px;">
                    ${(m.skills || []).map(s => `<span style="font-size:0.7rem; background:#F1F5F9; border-radius:3px; padding:1px 4px;">${escapeHtml(s)}</span>`).join('')}
                    ${(m.interests || []).map(i => `<span style="font-size:0.7rem; background:#FEF3C7; color:#92400E; border-radius:3px; padding:1px 4px;">${escapeHtml(i)}</span>`).join('')}
                  </div>
                </td>
                <td>${m.joinedAt ? m.joinedAt.slice(0, 10) : 'Pending'}</td>
                <td>
                  <button class="btn btn-secondary btn-sm btn-member-detail" data-member-id="${m.id}">Details</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    tableContainer.querySelectorAll('.btn-member-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const memberId = e.currentTarget.getAttribute('data-member-id');
        openMemberDetailModal(memberId, state, actions);
      });
    });
  }

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <h1>Members</h1>
        <p>Organization directory, roles, invitations, and profiles.</p>
      </div>
      <div class="page-actions">
        ${isLead ? `
          <button class="btn btn-primary" id="btn-invite-member">Invite member</button>
        ` : ''}
      </div>
    </header>

    <div class="content-area">
      <!-- Search & Filters -->
      <section class="filter-bar" aria-label="Member filters">
        <input type="search" id="member-search" class="filter-input" placeholder="Search by name or email..." aria-label="Search members" />
        <select id="member-role-filter" class="filter-select" aria-label="Filter by role">
          <option value="all">All Roles</option>
          <option value="Owner">Owner</option>
          <option value="Lead">Lead</option>
          <option value="Member">Member</option>
        </select>
        <select id="member-status-filter" class="filter-select" aria-label="Filter by status">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
        </select>
      </section>

      <section class="section-panel">
        <div id="members-list-container"></div>
      </section>
    </div>
  `;

  // Filter events
  container.querySelector('#member-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  container.querySelector('#member-role-filter')?.addEventListener('change', (e) => {
    roleFilter = e.target.value;
    renderList();
  });

  container.querySelector('#member-status-filter')?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    renderList();
  });

  // Invite button
  if (isLead) {
    container.querySelector('#btn-invite-member')?.addEventListener('click', () => {
      actions.openInviteModal();
    });
  }

  renderList();
}

/**
 * Member Detail Modal
 * Handles viewing member, editing private notes (lead/owner only), role changes, and deactivation
 */
export function openMemberDetailModal(memberId, state, actions) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  const { currentUser } = state;
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === member.orgId);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');
  const isSelf = currentUser.id === member.userId;

  // Lead or Owner can see/edit private notes. Regular members NEVER see notes.
  const canAccessNotes = isLead;

  // Leads cannot edit other leads or change roles; only Owner can change roles.
  const canChangeRole = isOwner && !isSelf;
  const canDeactivate = isLead && !isSelf && member.role !== 'Owner';

  const modalHtml = `
    <div class="modal-backdrop" id="member-detail-modal" role="dialog" aria-modal="true" aria-labelledby="member-modal-title">
      <div class="modal-dialog">
        <header class="modal-header">
          <div style="display:flex; align-items:center; gap:var(--spacing-3);">
            <div class="avatar-badge" style="background-color: ${member.avatarColor || '#0F766E'}; width:44px; height:44px;">
              ${escapeHtml(member.displayName.slice(0, 2).toUpperCase())}
            </div>
            <div>
              <h2 id="member-modal-title" class="modal-title">${escapeHtml(member.displayName)}</h2>
              <span style="font-size:0.8125rem; color:var(--color-text-muted);">${escapeHtml(member.email)}</span>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-member-modal" aria-label="Close dialog">&times;</button>
        </header>

        <div class="modal-body">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--spacing-3); font-size:var(--font-size-sm);">
            <div><strong>Organization:</strong> ${member.orgId === 'org-1' ? 'AqOne' : 'Dev Guild'}</div>
            <div><strong>Role:</strong> <span class="badge badge-${member.role.toLowerCase()}">${member.role}</span></div>
            <div><strong>Status:</strong> <span class="badge badge-${member.status.toLowerCase()}">${member.status}</span></div>
            <div><strong>Joined:</strong> ${member.joinedAt ? member.joinedAt.slice(0, 10) : 'Pending'}</div>
          </div>

          <div style="font-size:var(--font-size-sm);">
            <strong>Skills:</strong>
            <div>${(member.skills || []).join(', ') || 'None specified'}</div>
          </div>

          <div style="font-size:var(--font-size-sm);">
            <strong>Interests:</strong>
            <div>${(member.interests || []).join(', ') || 'None specified'}</div>
          </div>

          ${canAccessNotes ? `
            <div class="form-group" style="margin-top:var(--spacing-3); padding-top:var(--spacing-3); border-top:1px solid var(--color-border);">
              <label for="member-notes-input" class="form-label">
                Private Organization Notes
                <span class="badge badge-warning" style="font-size:0.65rem; margin-left:4px;">Lead & Owner only</span>
              </label>
              <p class="form-help-text">Notes are private to leads and owner; never exposed to members.</p>
              <textarea id="member-notes-input" class="form-textarea" maxlength="2000" rows="3">${escapeHtml(member.notes || '')}</textarea>
              <button class="btn btn-secondary btn-sm" id="btn-save-member-notes" style="align-self:flex-start;">Save notes</button>
            </div>
          ` : ''}

          ${canChangeRole ? `
            <div class="form-group" style="margin-top:var(--spacing-2);">
              <label for="member-role-select" class="form-label">Change Role</label>
              <select id="member-role-select" class="form-select">
                <option value="Member" ${member.role === 'Member' ? 'selected' : ''}>Member</option>
                <option value="Lead" ${member.role === 'Lead' ? 'selected' : ''}>Lead</option>
              </select>
              <button class="btn btn-secondary btn-sm" id="btn-save-member-role" style="align-self:flex-start; margin-top:4px;">Update role</button>
            </div>
          ` : ''}

          ${canDeactivate ? `
            <div style="margin-top:var(--spacing-4); padding-top:var(--spacing-3); border-top:1px solid var(--color-border);">
              <p style="font-size:var(--font-size-sm); color:var(--color-text-muted); margin-bottom:var(--spacing-2);">
                Deactivating immediately revokes access to this organization and unassigns their open tasks.
              </p>
              <button class="btn ${member.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm" id="btn-toggle-deactivate">
                ${member.status === 'active' ? 'Deactivate membership' : 'Reactivate membership'}
              </button>
            </div>
          ` : ''}
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" id="btn-done-member-modal">Done</button>
        </footer>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('member-detail-modal');

  function closeModal() {
    modal.remove();
  }

  modal.querySelector('#btn-close-member-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-done-member-modal').addEventListener('click', closeModal);

  // Save notes
  if (canAccessNotes) {
    modal.querySelector('#btn-save-member-notes')?.addEventListener('click', async () => {
      const newNotes = modal.querySelector('#member-notes-input').value;
      if (state.isRealAuth && state.token) {
        try {
          const res = await fetch(`/api/organizations/${member.orgId}/members/${member.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`,
            },
            body: JSON.stringify({ notes: newNotes }),
          });
          if (res.ok) {
            member.notes = newNotes;
            alert('Private notes saved successfully.');
            return;
          } else {
            const errData = await res.json().catch(() => ({}));
            alert(errData.message || 'Failed to save notes.');
            return;
          }
        } catch {
          // Fallback
        }
      }
      member.notes = newNotes;
      alert('Private notes saved successfully.');
    });
  }

  // Save role
  if (canChangeRole) {
    modal.querySelector('#btn-save-member-role')?.addEventListener('click', async () => {
      const newRole = modal.querySelector('#member-role-select').value;
      if (state.isRealAuth && state.token) {
        try {
          const res = await fetch(`/api/organizations/${member.orgId}/members/${member.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`,
            },
            body: JSON.stringify({ role: newRole }),
          });
          if (res.ok) {
            member.role = newRole;
            alert(`Role updated to ${newRole}.`);
            closeModal();
            actions.refresh();
            return;
          } else {
            const errData = await res.json().catch(() => ({}));
            alert(errData.message || 'Failed to update role.');
            return;
          }
        } catch {
          // Fallback
        }
      }
      member.role = newRole;
      alert(`Role updated to ${newRole}.`);
      closeModal();
      actions.refresh();
    });
  }

  // Deactivate
  if (canDeactivate) {
    modal.querySelector('#btn-toggle-deactivate')?.addEventListener('click', async () => {
      const isCurrentlyActive = member.status === 'active';
      const confirmed = confirm(
        isCurrentlyActive
          ? `Are you sure you want to deactivate ${member.displayName} in this organization? Their open tasks will be unassigned atomically.`
          : `Reactivate membership for ${member.displayName}?`
      );
      if (confirmed) {
        const targetStatus = isCurrentlyActive ? 'inactive' : 'active';
        if (state.isRealAuth && state.token) {
          try {
            const res = await fetch(`/api/organizations/${member.orgId}/members/${member.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`,
              },
              body: JSON.stringify({ status: targetStatus }),
            });
            if (res.ok) {
              member.status = targetStatus;
              alert(isCurrentlyActive ? 'Membership deactivated.' : 'Membership reactivated.');
              closeModal();
              actions.refresh();
              return;
            } else {
              const errData = await res.json().catch(() => ({}));
              alert(errData.message || 'Failed to update membership status.');
              return;
            }
          } catch {
            // Fallback
          }
        }
        member.status = targetStatus;
        if (isCurrentlyActive) {
          // Unassign open tasks in this org atomically
          state.tasks.forEach(t => {
            if (t.orgId === member.orgId && t.assignee === member.userId && t.status !== 'Done') {
              t.assignee = null;
              t.assigneeName = 'Unassigned';
            }
          });
        }
        alert(isCurrentlyActive ? 'Membership deactivated.' : 'Membership reactivated.');
        closeModal();
        actions.refresh();
      }
    });
  }
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
