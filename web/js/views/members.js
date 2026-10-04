/**
 * Members view module
 * Requirements: FEAT-002/REQ-001 through REQ-009; PROD-005/UI-REQ-001 through 007
 */

import { escapeHtml, orgLabel } from '../format.js';

export function renderMembers(container, state, actions) {
  const { currentUser, currentScope } = state;
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === currentScope);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');

  // Filter state
  let searchQuery = '';
  let roleFilter = 'all';
  let statusFilter = 'all';

  function getScopedMembers() {
    let list = state.members;
    if (currentScope !== 'all') {
      list = list.filter(m => m.orgId === currentScope);
    } else if (!isOwner) {
      const allowed = currentUser.memberships.map(m => m.orgId);
      list = list.filter(m => allowed.includes(m.orgId));
    }

    return list;
  }

  function getFilteredMembers() {
    let list = getScopedMembers();

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

  function renderActiveFilters() {
    const chips = [];
    if (roleFilter !== 'all') {
      chips.push(`<span class="active-filter-chip">Role: ${escapeHtml(roleFilter)}<button type="button" data-clear-filter="role" aria-label="Remove role filter">&times;</button></span>`);
    }
    if (statusFilter !== 'all') {
      const label = statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
      chips.push(`<span class="active-filter-chip">Status: ${escapeHtml(label)}<button type="button" data-clear-filter="status" aria-label="Remove status filter">&times;</button></span>`);
    }
    container.querySelector('#member-active-filters').innerHTML = chips.join('');
  }

  function resetFilters() {
    searchQuery = '';
    roleFilter = 'all';
    statusFilter = 'all';
    container.querySelector('#member-search').value = '';
    container.querySelector('#member-role-filter').value = 'all';
    container.querySelector('#member-status-filter').value = 'all';
    container.querySelector('#member-filter-disclosure').open = false;
    updateFilterCount();
    renderList();
  }

  function renderList() {
    const list = getFilteredMembers();
    const tableContainer = container.querySelector('#members-list-container');
    if (!tableContainer) return;

    renderActiveFilters();

    if (list.length === 0) {
      tableContainer.innerHTML = `
        <div class="state-box">
          <p class="state-box-title">No members found</p>
          <p class="state-box-desc">Try adjusting your search terms or filters.</p>
          <button class="btn btn-secondary btn-sm" id="btn-clear-member-filters">Clear filters</button>
        </div>
      `;
      tableContainer.querySelector('#btn-clear-member-filters')?.addEventListener('click', resetFilters);
      return;
    }

    tableContainer.innerHTML = `
      <p class="page-result-count" id="member-results-count" aria-live="polite">${list.length} ${list.length === 1 ? 'membership' : 'memberships'}</p>
      <div class="table-responsive record-table-view">
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
                      <button type="button" class="record-title-link btn-member-detail" data-member-id="${escapeHtml(m.id)}">${escapeHtml(m.displayName)}</button>
                      <div style="font-size:0.75rem; color:var(--color-text-muted);">${escapeHtml(m.email)}</div>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(orgLabel(state, m.orgId))}</td>
                <td><span class="badge badge-${m.role.toLowerCase()}">${m.role}</span></td>
                <td><span class="badge badge-${m.status.toLowerCase()}">${m.status}</span></td>
                <td>
                  <div class="member-skill-list" style="max-width:260px;">
                    ${(m.skills || []).map(s => `<span class="badge">${escapeHtml(s)}</span>`).join('')}
                    ${(m.interests || []).map(i => `<span class="badge badge-medium">${escapeHtml(i)}</span>`).join('')}
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
      <div class="mobile-record-list" aria-label="Organization member records">
        ${list.map(m => `
          <article class="responsive-record-card" id="member-card-${escapeHtml(m.id)}">
            <div class="record-card-chips">
              <span class="badge badge-${escapeHtml(m.role.toLowerCase())}">${escapeHtml(m.role)}</span>
              <span class="badge badge-${escapeHtml(m.status.toLowerCase())}">${escapeHtml(m.status)}</span>
            </div>
            <button type="button" class="record-title-link btn-member-detail" data-member-id="${escapeHtml(m.id)}">${escapeHtml(m.displayName)}</button>
            <p class="record-card-subline">${escapeHtml(m.email)} · ${escapeHtml(orgLabel(state, m.orgId))}</p>
            <div class="record-card-meta">
              <span>Joined: ${m.joinedAt ? escapeHtml(m.joinedAt.slice(0, 10)) : 'Pending'}</span>
            </div>
            <div class="member-skill-list">
              ${(m.skills || []).map(s => `<span class="badge">${escapeHtml(s)}</span>`).join('')}
              ${(m.interests || []).map(i => `<span class="badge badge-medium">${escapeHtml(i)}</span>`).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-member-detail" data-member-id="${escapeHtml(m.id)}">Details</button>
          </article>
        `).join('')}
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
      <section class="grid-cards page-summary-grid" aria-label="Membership summary">
        <article class="stat-card stat-card-hero" data-member-metric="total">
          <div class="stat-card-title">Membership records</div>
          <div class="stat-card-value">${getScopedMembers().length}</div>
          <div class="stat-card-sub">In the selected organization scope</div>
        </article>
        <article class="stat-card stat-card-support stat-card-support-aqua" data-member-metric="active">
          <div class="stat-card-title">Active memberships</div>
          <div class="stat-card-value">${getScopedMembers().filter(m => m.status === 'active').length}</div>
        </article>
        <article class="stat-card stat-card-support stat-card-support-lime" data-member-metric="pending">
          <div class="stat-card-title">Pending invitations</div>
          <div class="stat-card-value">${getScopedMembers().filter(m => m.status === 'pending').length}</div>
        </article>
      </section>

      <section class="page-tools" aria-label="Member search and filters">
        <div class="search-field">
          <label for="member-search" class="form-label">Search members</label>
          <input type="search" id="member-search" class="filter-input" placeholder="Name or email" />
        </div>
        <details class="filter-disclosure" id="member-filter-disclosure">
          <summary>Filters<span class="filter-count" id="member-filter-count"></span></summary>
          <div class="filter-disclosure-content">
            <div class="filter-select-wrap">
              <label for="member-role-filter" class="form-label">Role</label>
              <select id="member-role-filter" class="filter-select">
                <option value="all">All roles</option>
                <option value="Owner">Owner</option>
                <option value="Lead">Lead</option>
                <option value="Member">Member</option>
              </select>
            </div>
            <div class="filter-select-wrap">
              <label for="member-status-filter" class="form-label">Status</label>
              <select id="member-status-filter" class="filter-select">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </details>
      </section>

      <div id="member-active-filters" class="active-filter-chips" aria-label="Active member filters" aria-live="polite"></div>

      <section class="section-panel">
        <div id="members-list-container"></div>
      </section>
    </div>
  `;

  function updateFilterCount() {
    const count = Number(roleFilter !== 'all') + Number(statusFilter !== 'all');
    container.querySelector('#member-filter-count').textContent = count ? `${count}` : '';
  }

  // Filter events
  container.querySelector('#member-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  container.querySelector('#member-role-filter')?.addEventListener('change', (e) => {
    roleFilter = e.target.value;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#member-status-filter')?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    updateFilterCount();
    renderList();
  });

  container.querySelector('#member-active-filters')?.addEventListener('click', (e) => {
    const filter = e.target.closest('[data-clear-filter]')?.dataset.clearFilter;
    if (!filter) return;
    if (filter === 'role') {
      roleFilter = 'all';
      container.querySelector('#member-role-filter').value = 'all';
    } else {
      statusFilter = 'all';
      container.querySelector('#member-status-filter').value = 'all';
    }
    updateFilterCount();
    renderList();
  });

  // Invite button
  if (isLead) {
    container.querySelector('#btn-invite-member')?.addEventListener('click', () => {
      actions.openInviteModal();
    });
  }

  updateFilterCount();
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
    <div class="modal-backdrop detail-panel-backdrop" id="member-detail-modal" role="dialog" aria-modal="true" aria-labelledby="member-modal-title">
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
          <button class="btn btn-secondary btn-sm" id="btn-close-member-modal" aria-label="Close dialog">Close</button>
        </header>

        <div class="modal-body">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--spacing-3); font-size:var(--font-size-sm);">
            <div><strong>Organization:</strong> ${escapeHtml(orgLabel(state, member.orgId))}</div>
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

  const invokingElement = document.activeElement;
  const selectedRecord = invokingElement?.closest('tr, .responsive-record-card');
  selectedRecord?.classList.add('is-selected');
  selectedRecord?.setAttribute('aria-current', 'true');
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('member-detail-modal');

  function closeModal() {
    modal.remove();
    selectedRecord?.classList.remove('is-selected');
    selectedRecord?.removeAttribute('aria-current');
    if (invokingElement?.isConnected) invokingElement.focus();
  }

  modal.querySelector('#btn-close-member-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-done-member-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-close-member-modal').focus();

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
