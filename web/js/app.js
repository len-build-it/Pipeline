/**
 * Main application coordinator
 * Connects router, shell layout, modals, and synthetic fixtures.
 */

import { createInitialState, FIXTURE_USERS } from './fixtures.js';
import { renderOverview } from './views/overview.js';
import { renderMembers } from './views/members.js';
import { renderTasks } from './views/tasks.js';
import { renderAnnouncements } from './views/announcements.js';
import { renderSignIn, renderInviteAccept } from './views/auth.js';

class App {
  constructor() {
    this.state = createInitialState();
    this.currentView = 'overview';
    this.appRoot = document.getElementById('app-root');
    this.lastFocusedElement = null;
  }

  init() {
    this.render();
  }

  navigateTo(viewName) {
    this.currentView = viewName;
    this.render();
  }

  getActions() {
    return {
      signInUser: (user) => this.signInUser(user),
      signInRealUser: (data) => this.signInRealUser(data),
      signOut: () => this.signOut(),
      renderSignInView: () => this.navigateTo('signin'),
      renderInviteAcceptView: () => this.navigateTo('invite'),
      setScope: (scope) => this.setScope(scope),
      navigateTo: (view) => this.navigateTo(view),
    };
  }

  async setScope(orgId) {
    this.state.currentScope = orgId;
    if (this.state.isRealAuth && this.state.token) {
      try {
        const res = await fetch(`/api/overview?scope=${encodeURIComponent(orgId)}`, {
          headers: { 'Authorization': `Bearer ${this.state.token}` },
        });
        if (res.status === 401) {
          this.signOut();
          return;
        }
        if (res.ok) {
          const overviewData = await res.json();
          this.state.realOverviewMetrics = overviewData.metrics;
        }

        if (orgId !== 'all') {
          const memRes = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/members?limit=100`, {
            headers: { 'Authorization': `Bearer ${this.state.token}` },
          });
          if (memRes.ok) {
            const memData = await memRes.json();
            const otherMembers = this.state.members.filter(m => m.orgId !== orgId);
            this.state.members = [...otherMembers, ...memData.members];
          }
        }
      } catch {
        // Fallback to local
      }
    }
    this.render();
  }

  signInUser(user) {
    this.state.currentUser = user;
    // Reset scope if current scope is not accessible
    if (!user.isGlobalOwner) {
      const allowedOrgs = user.memberships.map(m => m.orgId);
      if (this.state.currentScope === 'all' || !allowedOrgs.includes(this.state.currentScope)) {
        this.state.currentScope = allowedOrgs[0] || 'org-1';
      }
    }
    this.currentView = 'overview';
    this.render();
  }

  async signInRealUser(data) {
    this.state.isRealAuth = true;
    this.state.token = data.accessToken;
    this.state.currentUser = {
      id: data.user.id,
      name: data.user.displayName,
      email: data.user.email,
      role: data.user.isOwner ? 'Owner' : 'Member',
      isGlobalOwner: data.user.isOwner,
      avatarColor: data.user.avatarColor || '#0D9488',
      memberships: (data.organizations || []).map(o => ({
        orgId: o.id,
        role: o.role,
        status: o.membership_status,
      })),
    };
    if (data.organizations && data.organizations.length > 0) {
      this.state.organizations = data.organizations.map(o => ({
        id: o.id,
        name: o.name,
        status: o.status,
      }));
    }
    if (this.state.currentUser.isGlobalOwner) {
      this.state.currentScope = 'all';
    } else if (this.state.currentUser.memberships.length > 0) {
      this.state.currentScope = this.state.currentUser.memberships[0].orgId;
    }
    await this.setScope(this.state.currentScope);
  }

  async signOut() {
    if (this.state.isRealAuth) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // ignore
      }
      this.state.isRealAuth = false;
      this.state.token = null;
      this.state.realOverviewMetrics = null;
    }
    this.currentView = 'signin';
    this.render();
  }

  render() {
    if (this.currentView === 'signin') {
      renderSignIn(this.appRoot, this.state, this.getActions());
      return;
    }
    if (this.currentView === 'invite') {
      renderInviteAccept(this.appRoot, this.state, this.getActions());
      return;
    }

    const { currentUser, currentScope } = this.state;
    const isOwner = currentUser.isGlobalOwner;

    // Available scopes
    const availableScopes = isOwner
      ? [{ id: 'all', name: 'All Organizations' }, ...this.state.organizations]
      : this.state.organizations.filter(o => currentUser.memberships.some(m => m.orgId === o.id));

    this.appRoot.innerHTML = `
      <!-- Skip to main content for accessibility -->
      <a href="#main-content" class="skip-link">Skip to main content</a>

      <!-- Demo Mode Banner -->
      <aside class="demo-banner" role="region" aria-label="Demo mode status">
        <div>
          <span>DEMO MODE — Synthetic Data Only</span>
        </div>
        <div class="demo-banner-actions">
          <label for="demo-persona-select" style="font-size:0.75rem; color:#FFFFFF; font-weight:600;">Persona:</label>
          <select id="demo-persona-select" class="demo-persona-select" aria-label="Switch active demo persona">
            <option value="len" ${currentUser.id === 'usr-owner' ? 'selected' : ''}>Len (Owner)</option>
            <option value="alex" ${currentUser.id === 'usr-alex' ? 'selected' : ''}>Alex Rivera (Lead)</option>
            <option value="sam" ${currentUser.id === 'usr-sam' ? 'selected' : ''}>Sam Taylor (Member)</option>
            <option value="jordan" ${currentUser.id === 'usr-jordan' ? 'selected' : ''}>Jordan Lee (Lead)</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-reset-demo-data" style="font-size:0.75rem; padding:2px 8px; min-height:28px;">Reset data</button>
        </div>
      </aside>

      <!-- Mobile Top Bar -->
      <header class="mobile-top-bar">
        <div class="brand-wordmark" style="margin-bottom:0; font-size:1.1rem;">AqOne &amp; Dev Guild</div>
        <select id="mobile-scope-select" class="scope-select" style="width:auto; padding:4px 8px;" aria-label="Select organization scope">
          ${availableScopes.map(s => `
            <option value="${s.id}" ${currentScope === s.id ? 'selected' : ''}>${s.name}</option>
          `).join('')}
        </select>
      </header>

      <div class="app-container">
        <!-- Persistent Desktop Left Navigation Rail -->
        <nav class="nav-rail" aria-label="Primary Navigation">
          <div class="nav-header">
            <div class="brand-wordmark">AqOne &amp; Dev Guild</div>
            <div class="scope-container">
              <label for="desktop-scope-select" class="scope-label">Organization Scope</label>
              <select id="desktop-scope-select" class="scope-select" aria-label="Organization scope selection">
                ${availableScopes.map(s => `
                  <option value="${s.id}" ${currentScope === s.id ? 'selected' : ''}>${s.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <ul class="nav-destinations">
            <li class="nav-item">
              <button class="${this.currentView === 'overview' ? 'active' : ''}" id="nav-btn-overview">
                Overview
              </button>
            </li>
            <li class="nav-item">
              <button class="${this.currentView === 'members' ? 'active' : ''}" id="nav-btn-members">
                Members
              </button>
            </li>
            <li class="nav-item">
              <button class="${this.currentView === 'tasks' ? 'active' : ''}" id="nav-btn-tasks">
                Tasks
              </button>
            </li>
            <li class="nav-item">
              <button class="${this.currentView === 'announcements' ? 'active' : ''}" id="nav-btn-announcements">
                Announcements
              </button>
            </li>
          </ul>

          <div class="nav-footer">
            <div class="user-profile-badge">
              <div class="avatar-badge" style="background-color: ${currentUser.avatarColor || '#0F766E'};">
                ${currentUser.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div class="user-info">
                <span class="user-name">${currentUser.displayName}</span>
                <span class="user-role-tag">${isOwner ? 'Global Owner' : 'Member'}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-open-profile" style="padding:2px 8px; min-height:32px;" title="Edit profile">Profile</button>
            <button class="btn btn-secondary btn-sm" id="btn-sign-out" style="padding:2px 8px; min-height:32px;" title="Sign out">Exit</button>
          </div>
        </nav>

        <!-- Main Content Area -->
        <main id="main-content" class="main-wrapper" tabindex="-1">
          <div id="view-container"></div>
        </main>
      </div>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
        <ul class="mobile-bottom-nav-list">
          <li>
            <button class="${this.currentView === 'overview' ? 'active' : ''}" id="mob-nav-overview">
              Overview
            </button>
          </li>
          <li>
            <button class="${this.currentView === 'members' ? 'active' : ''}" id="mob-nav-members">
              Members
            </button>
          </li>
          <li>
            <button class="${this.currentView === 'tasks' ? 'active' : ''}" id="mob-nav-tasks">
              Tasks
            </button>
          </li>
          <li>
            <button class="${this.currentView === 'announcements' ? 'active' : ''}" id="mob-nav-announcements">
              Announcements
            </button>
          </li>
        </ul>
      </nav>
    `;

    // Bind shell events
    this.bindShellEvents();

    // Render active view into view-container
    const viewContainer = document.getElementById('view-container');
    const actions = this.getActions();

    switch (this.currentView) {
      case 'overview':
        renderOverview(viewContainer, this.state, actions);
        break;
      case 'members':
        renderMembers(viewContainer, this.state, actions);
        break;
      case 'tasks':
        renderTasks(viewContainer, this.state, actions);
        break;
      case 'announcements':
        renderAnnouncements(viewContainer, this.state, actions);
        break;
      default:
        renderOverview(viewContainer, this.state, actions);
    }
  }

  bindShellEvents() {
    // Navigation items
    document.getElementById('nav-btn-overview')?.addEventListener('click', () => this.navigateTo('overview'));
    document.getElementById('nav-btn-members')?.addEventListener('click', () => this.navigateTo('members'));
    document.getElementById('nav-btn-tasks')?.addEventListener('click', () => this.navigateTo('tasks'));
    document.getElementById('nav-btn-announcements')?.addEventListener('click', () => this.navigateTo('announcements'));

    document.getElementById('mob-nav-overview')?.addEventListener('click', () => this.navigateTo('overview'));
    document.getElementById('mob-nav-members')?.addEventListener('click', () => this.navigateTo('members'));
    document.getElementById('mob-nav-tasks')?.addEventListener('click', () => this.navigateTo('tasks'));
    document.getElementById('mob-nav-announcements')?.addEventListener('click', () => this.navigateTo('announcements'));

    // Scope selection
    document.getElementById('desktop-scope-select')?.addEventListener('change', (e) => this.setScope(e.target.value));
    document.getElementById('mobile-scope-select')?.addEventListener('change', (e) => this.setScope(e.target.value));

    // Persona switch in banner
    document.getElementById('demo-persona-select')?.addEventListener('change', (e) => {
      const personaKey = e.target.value;
      const persona = FIXTURE_USERS[personaKey];
      if (persona) this.signInUser(persona);
    });

    // Reset data button
    document.getElementById('btn-reset-demo-data')?.addEventListener('click', () => {
      if (confirm('Reset all synthetic fixture data to default initial state?')) {
        this.state = createInitialState();
        this.render();
      }
    });

    // Profile & Sign out
    document.getElementById('btn-open-profile')?.addEventListener('click', () => this.openProfileModal());
    document.getElementById('btn-sign-out')?.addEventListener('click', () => this.signOut());
  }

  getActions() {
    return {
      navigateTo: (view) => this.navigateTo(view),
      refresh: () => this.render(),
      renderSignInView: () => {
        this.currentView = 'signin';
        this.render();
      },
      renderInviteAcceptView: () => {
        this.currentView = 'invite';
        this.render();
      },
      signInUser: (user) => this.signInUser(user),
      openInviteModal: () => this.openInviteModal(),
      openTaskCreateModal: () => this.openTaskCreateModal(),
      openTaskDetailModal: (id) => this.openTaskDetailModal(id),
      openAnnouncementComposeModal: () => this.openAnnouncementComposeModal(),
      openProfileModal: () => this.openProfileModal()
    };
  }

  openInviteModal() {
    this.lastFocusedElement = document.activeElement;
    const { currentUser, currentScope } = this.state;
    const isOwner = currentUser.isGlobalOwner;

    const availableOrgs = isOwner
      ? this.state.organizations
      : this.state.organizations.filter(o => {
          const m = currentUser.memberships.find(mem => mem.orgId === o.id);
          return m && m.role === 'Lead';
        });

    const modalHtml = `
      <div class="modal-backdrop" id="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
        <div class="modal-dialog">
          <header class="modal-header">
            <h2 id="invite-modal-title" class="modal-title">Invite New Member</h2>
            <button class="modal-close-btn" id="btn-close-invite-modal" aria-label="Close dialog">&times;</button>
          </header>

          <form id="invite-member-form" novalidate>
            <div class="modal-body">
              <div id="invite-error-summary" class="form-error-summary" style="display:none;" tabindex="-1" role="alert">
                <div class="form-error-summary-title">Please correct the errors below:</div>
                <ul id="invite-error-list"></ul>
              </div>

              <div class="form-group">
                <label for="invite-member-email" class="form-label">Email address *</label>
                <input type="email" id="invite-member-email" class="form-input" placeholder="colleague@example.com" required maxlength="254" />
                <span class="form-error-text" id="invite-email-error" style="display:none;">A valid email address is required.</span>
              </div>

              <div class="form-group">
                <label for="invite-org-select" class="form-label">Target Organization *</label>
                <select id="invite-org-select" class="form-select">
                  ${availableOrgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label for="invite-role-select" class="form-label">Role *</label>
                <select id="invite-role-select" class="form-select">
                  <option value="Member">Member</option>
                  ${isOwner ? `<option value="Lead">Lead</option>` : ''}
                </select>
                ${!isOwner ? `<p class="form-help-text">Only the global Owner can invite or assign Leads.</p>` : ''}
              </div>

              <div style="margin-top:var(--spacing-2);">
                <label style="display:flex; align-items:center; gap:var(--spacing-2); font-size:var(--font-size-sm); cursor:pointer;">
                  <input type="checkbox" id="simulate-smtp-fail" />
                  Simulate SMTP delivery failure (REQ-009)
                </label>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-invite">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-send-invitation">Send invitation</button>
            </footer>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('invite-modal');
    const emailInput = modal.querySelector('#invite-member-email');
    emailInput.focus();

    const closeModal = () => {
      modal.remove();
      if (this.lastFocusedElement) this.lastFocusedElement.focus();
    };

    modal.querySelector('#btn-close-invite-modal').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-invite').addEventListener('click', closeModal);

    // Escape key
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', onKeyDown);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Form submit
    modal.querySelector('#invite-member-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const orgId = modal.querySelector('#invite-org-select').value;
      const role = modal.querySelector('#invite-role-select').value;
      const simulateFail = modal.querySelector('#simulate-smtp-fail').checked;

      // Validation
      const errors = [];
      if (!email || !email.includes('@') || email.length > 254) {
        errors.push({ field: 'invite-member-email', msg: 'A valid email address is required (up to 254 chars).' });
      }

      // Check existing active membership in that org
      const existingMember = this.state.members.find(m => m.orgId === orgId && m.email.toLowerCase() === email && m.status === 'active');
      if (existingMember) {
        errors.push({ field: 'invite-member-email', msg: `User ${email} is already an active member of this organization.` });
      }

      if (errors.length > 0) {
        const errorSummary = modal.querySelector('#invite-error-summary');
        const errorList = modal.querySelector('#invite-error-list');
        errorList.innerHTML = errors.map(err => `<li><a href="#${err.field}">${err.msg}</a></li>`).join('');
        errorSummary.style.display = 'block';
        errorSummary.focus();
        emailInput.classList.add('is-invalid');
        return;
      }

      if (this.state.isRealAuth && this.state.token) {
        const finalEmail = simulateFail ? (email.includes('fail') ? email : 'delivery_fail_' + email) : email;
        fetch(`/api/organizations/${orgId}/invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`,
          },
          body: JSON.stringify({ email: finalEmail, role }),
        }).then(async res => {
          if (res.ok) {
            const data = await res.json();
            if (data.emailSent) {
              alert(`Invitation sent to ${email} for ${role} role in ${orgId === 'org-1' ? 'AqOne' : 'Dev Guild'}.`);
            } else {
              alert(`SMTP Error: Invitation delivery failed. Status recorded as delivery_failed with feedback: ${data.deliveryError}`);
            }
            closeModal();
            this.setScope(this.state.currentScope);
          } else {
            const errData = await res.json().catch(() => ({}));
            const errorSummary = modal.querySelector('#invite-error-summary');
            const errorList = modal.querySelector('#invite-error-list');
            errorList.innerHTML = `<li><a href="#invite-member-email">${errData.message || 'Failed to send invitation.'}</a></li>`;
            errorSummary.style.display = 'block';
            errorSummary.focus();
            emailInput.classList.add('is-invalid');
          }
        }).catch(() => {
          // Fallback to local
        });
        return;
      }

      if (simulateFail) {
        // REQ-009: Simulated mail failure leaves pending invitation with delivery failure feedback
        this.state.invitations.push({
          id: 'inv-' + Date.now(),
          email,
          orgId,
          role,
          status: 'delivery_failed',
          expiresAt: '2026-09-19T23:59:59+08:00'
        });
        alert(`SMTP Error: Invitation delivery failed. One pending invitation was recorded with delivery failure feedback. You can retry sending from member management.`);
      } else {
        this.state.invitations.push({
          id: 'inv-' + Date.now(),
          email,
          orgId,
          role,
          status: 'pending',
          expiresAt: '2026-09-19T23:59:59+08:00'
        });
        alert(`Invitation sent to ${email} for ${role} role in ${orgId === 'org-1' ? 'AqOne' : 'Dev Guild'}.`);
      }

      closeModal();
      this.render();
    });
  }

  openTaskCreateModal() {
    this.lastFocusedElement = document.activeElement;
    const { currentUser, currentScope } = this.state;
    const isOwner = currentUser.isGlobalOwner;

    const availableOrgs = isOwner
      ? this.state.organizations
      : this.state.organizations.filter(o => {
          const m = currentUser.memberships.find(mem => mem.orgId === o.id);
          return m && m.role === 'Lead';
        });

    const defaultOrgId = currentScope !== 'all' ? currentScope : availableOrgs[0].id;
    const orgMembers = this.state.members.filter(m => m.orgId === defaultOrgId && m.status === 'active');

    const modalHtml = `
      <div class="modal-backdrop" id="task-create-modal" role="dialog" aria-modal="true" aria-labelledby="task-create-modal-title">
        <div class="modal-dialog">
          <header class="modal-header">
            <h2 id="task-create-modal-title" class="modal-title">Create New Task</h2>
            <button class="modal-close-btn" id="btn-close-task-create-modal" aria-label="Close dialog">&times;</button>
          </header>

          <form id="task-create-form" novalidate>
            <div class="modal-body">
              <div id="task-create-error-summary" class="form-error-summary" style="display:none;" tabindex="-1" role="alert">
                <div class="form-error-summary-title">Please correct the errors below:</div>
                <ul id="task-create-error-list"></ul>
              </div>

              <div class="form-group">
                <label for="task-create-title" class="form-label">Task Title *</label>
                <input type="text" id="task-create-title" class="form-input" placeholder="Short descriptive title" required maxlength="160" />
                <span class="form-help-text">1 to 160 characters.</span>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--spacing-3);">
                <div class="form-group">
                  <label for="task-create-org" class="form-label">Organization *</label>
                  <select id="task-create-org" class="form-select">
                    ${availableOrgs.map(o => `<option value="${o.id}" ${o.id === defaultOrgId ? 'selected' : ''}>${o.name}</option>`).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label for="task-create-priority" class="form-label">Priority</label>
                  <select id="task-create-priority" class="form-select">
                    <option value="Medium" selected>Medium (Default)</option>
                    <option value="Low">Low</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="task-create-desc" class="form-label">Description (Optional)</label>
                <textarea id="task-create-desc" class="form-textarea" maxlength="10000" rows="3" placeholder="Context, requirements, notes..."></textarea>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--spacing-3);">
                <div class="form-group">
                  <label for="task-create-assignee" class="form-label">Assignee (Optional)</label>
                  <select id="task-create-assignee" class="form-select">
                    <option value="">Unassigned</option>
                    ${orgMembers.map(m => `<option value="${m.userId}">${m.displayName}</option>`).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label for="task-create-duedate" class="form-label">Due Date (Optional, Manila)</label>
                  <input type="date" id="task-create-duedate" class="form-input" />
                </div>
              </div>

              <div class="form-group">
                <label for="task-create-labels" class="form-label">Labels (Optional, comma-separated)</label>
                <input type="text" id="task-create-labels" class="form-input" placeholder="frontend, a11y, urgent" />
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-task-create">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-save-new-task">Create task</button>
            </footer>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('task-create-modal');
    const titleInput = modal.querySelector('#task-create-title');
    titleInput.focus();

    let isDirty = false;
    modal.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => { isDirty = true; });
    });

    const closeModal = () => {
      if (isDirty) {
        if (!confirm('You have unsaved changes. Discard them?')) return;
      }
      modal.remove();
      if (this.lastFocusedElement) this.lastFocusedElement.focus();
    };

    modal.querySelector('#btn-close-task-create-modal').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-task-create').addEventListener('click', closeModal);

    modal.querySelector('#task-create-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const orgId = modal.querySelector('#task-create-org').value;
      const priority = modal.querySelector('#task-create-priority').value;
      const desc = modal.querySelector('#task-create-desc').value.trim();
      const assigneeId = modal.querySelector('#task-create-assignee').value;
      const dueDate = modal.querySelector('#task-create-duedate').value;
      const labels = modal.querySelector('#task-create-labels').value.split(',').map(l => l.trim()).filter(Boolean);

      if (!title || title.length > 160) {
        const errorSummary = modal.querySelector('#task-create-error-summary');
        const errorList = modal.querySelector('#task-create-error-list');
        errorList.innerHTML = `<li><a href="#task-create-title">Title is required and must be 1 to 160 characters.</a></li>`;
        errorSummary.style.display = 'block';
        errorSummary.focus();
        titleInput.classList.add('is-invalid');
        return;
      }

      const assigneeObj = this.state.members.find(m => m.userId === assigneeId && m.orgId === orgId);

      const newTask = {
        id: 'tsk-' + Date.now(),
        orgId,
        title,
        description: desc,
        creator: currentUser.id,
        creatorName: currentUser.displayName,
        assignee: assigneeId || null,
        assigneeName: assigneeObj ? assigneeObj.displayName : 'Unassigned',
        status: 'Backlog',
        priority,
        dueDate: dueDate || null,
        labels,
        archived: false,
        updatedAt: new Date().toISOString(),
        comments: []
      };

      this.state.tasks.unshift(newTask);
      isDirty = false;
      modal.remove();
      alert('Task created successfully in Backlog.');
      this.render();
    });
  }

  openAnnouncementComposeModal() {
    this.lastFocusedElement = document.activeElement;
    const { currentUser, currentScope } = this.state;
    const isOwner = currentUser.isGlobalOwner;

    // Available target orgs where user is lead/owner
    const availableOrgs = isOwner
      ? this.state.organizations
      : this.state.organizations.filter(o => {
          const m = currentUser.memberships.find(mem => mem.orgId === o.id);
          return m && m.role === 'Lead';
        });

    const modalHtml = `
      <div class="modal-backdrop" id="ann-compose-modal" role="dialog" aria-modal="true" aria-labelledby="ann-compose-modal-title">
        <div class="modal-dialog" style="max-width:680px;">
          <header class="modal-header">
            <h2 id="ann-compose-modal-title" class="modal-title">Compose Announcement</h2>
            <button class="modal-close-btn" id="btn-close-ann-compose" aria-label="Close dialog">&times;</button>
          </header>

          <form id="ann-compose-form" novalidate>
            <div class="modal-body">
              <div id="ann-compose-error-summary" class="form-error-summary" style="display:none;" tabindex="-1" role="alert">
                <div class="form-error-summary-title">Please correct the errors below:</div>
                <ul id="ann-compose-error-list"></ul>
              </div>

              <div class="form-group">
                <label for="ann-compose-title" class="form-label">Announcement Title *</label>
                <input type="text" id="ann-compose-title" class="form-input" placeholder="e.g. Q3 Roadmap Review" required maxlength="160" />
              </div>

              <div class="form-group">
                <label class="form-label">Target Audience *</label>
                <div style="display:flex; gap:var(--spacing-4); flex-wrap:wrap; margin-top:4px;">
                  ${availableOrgs.map(o => `
                    <label style="display:flex; align-items:center; gap:var(--spacing-2); font-size:var(--font-size-sm); cursor:pointer;">
                      <input type="checkbox" name="target-org" value="${o.id}" checked />
                      ${o.name}
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- Edit vs Preview Tabs -->
              <div style="display:flex; gap:var(--spacing-2); border-bottom:1px solid var(--color-border); padding-bottom:var(--spacing-2); margin-top:var(--spacing-2);">
                <button type="button" class="btn btn-primary btn-sm" id="btn-tab-edit">Edit content</button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-tab-preview">Preview</button>
              </div>

              <div id="ann-edit-panel" class="form-group">
                <label for="ann-compose-body" class="form-label">Message Body *</label>
                <textarea id="ann-compose-body" class="form-textarea" maxlength="10000" rows="6" placeholder="Write announcement details here..." required></textarea>
              </div>

              <div id="ann-preview-panel" style="display:none; background:var(--color-background); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--spacing-4); min-height:160px; line-height:1.6; font-size:var(--font-size-sm); white-space:pre-wrap;">
              </div>

              <div class="alert-banner alert-warning" style="font-size:0.75rem; margin-top:var(--spacing-2);">
                <span><strong>Notice:</strong> Once published, announcement content and target audiences are immutable.</span>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-ann-compose">Cancel</button>
              <button type="button" class="btn btn-secondary" id="btn-save-ann-draft">Save draft</button>
              <button type="submit" class="btn btn-primary" id="btn-publish-ann">Publish now</button>
            </footer>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('ann-compose-modal');
    const titleInput = modal.querySelector('#ann-compose-title');
    const bodyInput = modal.querySelector('#ann-compose-body');
    const editPanel = modal.querySelector('#ann-edit-panel');
    const previewPanel = modal.querySelector('#ann-preview-panel');
    const btnTabEdit = modal.querySelector('#btn-tab-edit');
    const btnTabPreview = modal.querySelector('#btn-tab-preview');

    titleInput.focus();

    // Tab toggle
    btnTabEdit.addEventListener('click', () => {
      editPanel.style.display = 'block';
      previewPanel.style.display = 'none';
      btnTabEdit.className = 'btn btn-primary btn-sm';
      btnTabPreview.className = 'btn btn-secondary btn-sm';
    });

    btnTabPreview.addEventListener('click', () => {
      editPanel.style.display = 'none';
      previewPanel.style.display = 'block';
      previewPanel.textContent = bodyInput.value || '(Empty message)';
      btnTabEdit.className = 'btn btn-secondary btn-sm';
      btnTabPreview.className = 'btn btn-primary btn-sm';
    });

    let isDirty = false;
    modal.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => { isDirty = true; });
    });

    const closeModal = () => {
      if (isDirty) {
        if (!confirm('Discard unsaved announcement draft?')) return;
      }
      modal.remove();
      if (this.lastFocusedElement) this.lastFocusedElement.focus();
    };

    modal.querySelector('#btn-close-ann-compose').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-ann-compose').addEventListener('click', closeModal);

    const saveAnnouncement = (status) => {
      const title = titleInput.value.trim();
      const body = bodyInput.value.trim();
      const targetOrgs = Array.from(modal.querySelectorAll('input[name="target-org"]:checked')).map(cb => cb.value);

      const errors = [];
      if (!title || title.length > 160) errors.push({ field: 'ann-compose-title', msg: 'Title is required (1-160 chars).' });
      if (!body) errors.push({ field: 'ann-compose-body', msg: 'Message body cannot be empty.' });
      if (targetOrgs.length === 0) errors.push({ field: 'ann-compose-title', msg: 'Select at least one target organization.' });

      if (errors.length > 0) {
        const errorSummary = modal.querySelector('#ann-compose-error-summary');
        const errorList = modal.querySelector('#ann-compose-error-list');
        errorList.innerHTML = errors.map(err => `<li><a href="#${err.field}">${err.msg}</a></li>`).join('');
        errorSummary.style.display = 'block';
        errorSummary.focus();
        return;
      }

      const newAnn = {
        id: 'ann-' + Date.now(),
        title,
        body,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        targetOrgs,
        status,
        publishedAt: status === 'published' ? new Date().toISOString() : null,
        archived: false
      };

      this.state.announcements.unshift(newAnn);
      isDirty = false;
      modal.remove();
      alert(status === 'published' ? 'Announcement published successfully!' : 'Draft saved.');
      this.render();
    };

    modal.querySelector('#btn-save-ann-draft').addEventListener('click', () => saveAnnouncement('draft'));
    modal.querySelector('#ann-compose-form').addEventListener('submit', (e) => {
      e.preventDefault();
      saveAnnouncement('published');
    });
  }

  openProfileModal() {
    this.lastFocusedElement = document.activeElement;
    const { currentUser } = this.state;
    const palette = ['#0F766E', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#059669'];

    const modalHtml = `
      <div class="modal-backdrop" id="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <div class="modal-dialog">
          <header class="modal-header">
            <h2 id="profile-modal-title" class="modal-title">Edit Your Profile</h2>
            <button class="modal-close-btn" id="btn-close-profile-modal" aria-label="Close dialog">&times;</button>
          </header>

          <form id="profile-edit-form">
            <div class="modal-body">
              <div class="form-group">
                <label for="profile-name" class="form-label">Display Name *</label>
                <input type="text" id="profile-name" class="form-input" value="${currentUser.displayName}" required maxlength="100" />
              </div>

              <div class="form-group">
                <label class="form-label">Avatar Initials Color</label>
                <div style="display:flex; gap:var(--spacing-3); margin-top:4px;">
                  ${palette.map(c => `
                    <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center;">
                      <input type="radio" name="avatar-color" value="${c}" ${currentUser.avatarColor === c ? 'checked' : ''} />
                      <span style="width:28px; height:28px; border-radius:50%; background-color:${c}; margin-top:4px; border:2px solid ${currentUser.avatarColor === c ? '#000' : 'transparent'};"></span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div class="form-group">
                <label for="profile-skills" class="form-label">Skills (comma-separated, max 10)</label>
                <input type="text" id="profile-skills" class="form-input" value="${(currentUser.skills || []).join(', ')}" />
              </div>

              <div class="form-group">
                <label for="profile-interests" class="form-label">Interests (comma-separated, max 10)</label>
                <input type="text" id="profile-interests" class="form-input" value="${(currentUser.interests || []).join(', ')}" />
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary" id="btn-cancel-profile">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-save-profile">Save profile</button>
            </footer>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('profile-modal');
    modal.querySelector('#profile-name').focus();

    const closeModal = () => {
      modal.remove();
      if (this.lastFocusedElement) this.lastFocusedElement.focus();
    };

    modal.querySelector('#btn-close-profile-modal').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-profile').addEventListener('click', closeModal);

    modal.querySelector('#profile-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modal.querySelector('#profile-name').value.trim();
      if (!name) return;

      const selectedColor = modal.querySelector('input[name="avatar-color"]:checked')?.value || currentUser.avatarColor;
      const skills = modal.querySelector('#profile-skills').value.split(',').map(s => s.trim()).filter(Boolean);
      const interests = modal.querySelector('#profile-interests').value.split(',').map(i => i.trim()).filter(Boolean);

      if (this.state.isRealAuth && this.state.token) {
        try {
          const res = await fetch('/api/users/profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.state.token}`,
            },
            body: JSON.stringify({
              displayName: name,
              avatarColor: selectedColor,
              skills,
              interests,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            currentUser.displayName = data.user.displayName;
            currentUser.avatarColor = data.user.avatarColor;
            currentUser.skills = data.user.skills;
            currentUser.interests = data.user.interests;
            modal.remove();
            alert('Profile updated successfully.');
            this.render();
            return;
          } else {
            const errData = await res.json().catch(() => ({}));
            alert(errData.message || 'Failed to update profile.');
            return;
          }
        } catch {
          // Fallback to local
        }
      }

      currentUser.displayName = name;
      currentUser.avatarColor = selectedColor;
      currentUser.skills = skills;
      currentUser.interests = interests;

      // Update associated membership display records
      this.state.members.forEach(m => {
        if (m.userId === currentUser.id) {
          m.displayName = name;
          m.avatarColor = selectedColor;
          m.skills = skills;
          m.interests = interests;
        }
      });

      modal.remove();
      alert('Profile updated successfully.');
      this.render();
    });
  }
}

// Instantiate and start app
window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App();
  window.__app.init();
});
