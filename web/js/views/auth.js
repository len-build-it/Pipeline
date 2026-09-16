/**
 * Authentication and Invitation views
 * Requirements: FEAT-001/REQ-001, REQ-002, REQ-007; PROD-005/UI-REQ-001 through 007
 */

import { FIXTURE_USERS } from '../fixtures.js';

export function renderSignIn(container, state, actions) {
  container.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-4); background-color: var(--color-background);">
      <div style="background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); width: 100%; max-width: 440px; padding: var(--spacing-8);">
        <div style="text-align: center; margin-bottom: var(--spacing-6);">
          <h1 style="color: var(--color-primary); font-size: var(--font-size-2xl); font-weight: 800; letter-spacing: -0.02em;">AqOne & Dev Guild</h1>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-top: 4px;">Sign in to your management dashboard</p>
        </div>

        <div id="auth-alert-container"></div>

        <form id="sign-in-form" novalidate style="display: flex; flex-direction: column; gap: var(--spacing-4);">
          <div class="form-group">
            <label for="signin-email" class="form-label">Email address</label>
            <input type="email" id="signin-email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
            <div class="form-error-text" id="signin-email-error" style="display:none;">Please enter a valid email.</div>
          </div>

          <div class="form-group">
            <label for="signin-password" class="form-label">Password</label>
            <input type="password" id="signin-password" class="form-input" placeholder="••••••••••••" required autocomplete="current-password" minlength="12" />
            <div class="form-error-text" id="signin-password-error" style="display:none;">Password must be at least 12 characters.</div>
          </div>

          <button type="submit" class="btn btn-primary" id="btn-submit-signin" style="width: 100%; margin-top: var(--spacing-2);">
            Sign in
          </button>
        </form>

        <!-- Demo Mode Quick-Switch Personas -->
        <div style="margin-top: var(--spacing-6); padding-top: var(--spacing-4); border-top: 1px solid var(--color-border);">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: var(--spacing-2); text-align: center;">
            Demo Mode Personas
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-2);">
            <button class="btn btn-secondary btn-sm btn-persona-select" data-persona="len">
              Len (Owner)
            </button>
            <button class="btn btn-secondary btn-sm btn-persona-select" data-persona="alex">
              Alex (Lead)
            </button>
            <button class="btn btn-secondary btn-sm btn-persona-select" data-persona="sam">
              Sam (Member)
            </button>
            <button class="btn btn-secondary btn-sm btn-persona-select" data-persona="jordan">
              Jordan (Lead)
            </button>
          </div>
        </div>

        <div style="margin-top: var(--spacing-6); text-align: center; font-size: var(--font-size-sm);">
          <a href="#invite" id="link-goto-invite" style="color: var(--color-primary); text-decoration: underline; font-weight: 600;">
            Have an invitation token? Accept invitation
          </a>
        </div>
      </div>
    </div>
  `;

  // Handle Form Submit
  const form = container.querySelector('#sign-in-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#signin-email').value.trim();
    const password = container.querySelector('#signin-password').value;

    let valid = true;
    if (!email || !email.includes('@')) {
      container.querySelector('#signin-email').classList.add('is-invalid');
      container.querySelector('#signin-email-error').style.display = 'block';
      valid = false;
    } else {
      container.querySelector('#signin-email').classList.remove('is-invalid');
      container.querySelector('#signin-email-error').style.display = 'none';
    }

    if (!password || password.length < 12) {
      container.querySelector('#signin-password').classList.add('is-invalid');
      container.querySelector('#signin-password-error').style.display = 'block';
      valid = false;
    } else {
      container.querySelector('#signin-password').classList.remove('is-invalid');
      container.querySelector('#signin-password-error').style.display = 'none';
    }

    if (!valid) return;

    // Try real API authentication first
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (actions?.signInRealUser) {
          actions.signInRealUser(data);
        } else if (actions?.signInUser) {
          actions.signInUser({
            id: data.user.id,
            name: data.user.displayName,
            email: data.user.email,
            role: data.user.isOwner ? 'Owner' : 'Member',
            isGlobalOwner: data.user.isOwner,
            avatarColor: data.user.avatarColor || '#0D9488',
            memberships: (data.organizations || []).map(o => ({ orgId: o.id, role: o.role, status: o.membership_status })),
          });
        }
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        container.querySelector('#auth-alert-container').innerHTML = `
          <div class="alert-banner alert-danger" role="alert">
            <span>${errData.message || 'Invalid email or password.'}</span>
          </div>
        `;
        return;
      }
    } catch {
      // API unreachable: fallback to matching synthetic demo persona
      const matchedPersona = Object.values(FIXTURE_USERS).find(u => u.email.toLowerCase() === email.toLowerCase());
      if (matchedPersona) {
        actions.signInUser(matchedPersona);
      } else {
        container.querySelector('#auth-alert-container').innerHTML = `
          <div class="alert-banner alert-danger" role="alert">
            <span>Invalid email or password. Use demo persona or correct credentials.</span>
          </div>
        `;
      }
    }
  });

  // Persona buttons
  container.querySelectorAll('.btn-persona-select').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const personaKey = e.currentTarget.getAttribute('data-persona');
      const persona = FIXTURE_USERS[personaKey];
      if (persona) {
        actions.signInUser(persona);
      }
    });
  });

  // Switch to invite
  container.querySelector('#link-goto-invite')?.addEventListener('click', (e) => {
    e.preventDefault();
    actions.renderInviteAcceptView();
  });
}

export function renderInviteAccept(container, state, actions) {
  container.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-4); background-color: var(--color-background);">
      <div style="background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); width: 100%; max-width: 460px; padding: var(--spacing-8);">
        <div style="text-align: center; margin-bottom: var(--spacing-6);">
          <h1 style="color: var(--color-primary); font-size: var(--font-size-2xl); font-weight: 800;">Accept Invitation</h1>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-top: 4px;">Join AqOne or Dev Guild</p>
        </div>

        <div id="invite-alert-container"></div>

        <form id="invite-accept-form" novalidate style="display: flex; flex-direction: column; gap: var(--spacing-4);">
          <div class="form-group">
            <label for="invite-token" class="form-label">Invitation Token</label>
            <input type="text" id="invite-token" class="form-input" value="inv-token-demo-8491" required />
          </div>

          <div class="form-group">
            <label for="invite-email" class="form-label">Invited Email Address</label>
            <input type="email" id="invite-email" class="form-input" value="pat@example.com" required />
          </div>

          <div class="form-group">
            <label for="invite-name" class="form-label">Your Full Name</label>
            <input type="text" id="invite-name" class="form-input" placeholder="Pat Morgan" required maxlength="100" />
            <div class="form-error-text" id="invite-name-error" style="display:none;">Name is required (1-100 characters).</div>
          </div>

          <div class="form-group">
            <label for="invite-password" class="form-label">Create Password (12+ characters)</label>
            <input type="password" id="invite-password" class="form-input" minlength="12" placeholder="••••••••••••" required />
            <div class="form-error-text" id="invite-password-error" style="display:none;">Password must be at least 12 characters.</div>
          </div>

          <div style="display: flex; gap: var(--spacing-2); margin-top: var(--spacing-2);">
            <button type="submit" class="btn btn-primary" id="btn-submit-invite" style="flex: 1;">
              Accept and join
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-simulate-expired">
              Test expired
            </button>
          </div>
        </form>

        <div style="margin-top: var(--spacing-6); text-align: center; font-size: var(--font-size-sm);">
          <a href="#signin" id="link-back-signin" style="color: var(--color-primary); text-decoration: underline; font-weight: 600;">
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#invite-accept-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = container.querySelector('#invite-token').value.trim();
    const email = container.querySelector('#invite-email').value.trim();
    const name = container.querySelector('#invite-name').value.trim();
    const password = container.querySelector('#invite-password').value;

    let valid = true;
    if (!name) {
      container.querySelector('#invite-name').classList.add('is-invalid');
      container.querySelector('#invite-name-error').style.display = 'block';
      valid = false;
    } else {
      container.querySelector('#invite-name').classList.remove('is-invalid');
      container.querySelector('#invite-name-error').style.display = 'none';
    }

    if (!password || password.length < 12) {
      container.querySelector('#invite-password').classList.add('is-invalid');
      container.querySelector('#invite-password-error').style.display = 'block';
      valid = false;
    } else {
      container.querySelector('#invite-password').classList.remove('is-invalid');
      container.querySelector('#invite-password-error').style.display = 'none';
    }

    if (!valid) return;

    // Try real API accept
    try {
      const res = await fetch('/api/auth/invitation/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password, displayName: name }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Welcome, ${name}! Invitation accepted.`);
        actions.renderSignInView();
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        container.querySelector('#invite-alert-container').innerHTML = `
          <div class="alert-banner alert-danger" role="alert">
            <span>${errData.message || 'Invitation expired or used.'}</span>
          </div>
        `;
        return;
      }
    } catch {
      // API unreachable: simulate successful acceptance in demo state
      const newUser = {
        id: 'usr-new-' + Date.now(),
        email,
        displayName: name,
        avatarColor: '#059669',
        status: 'active',
        isGlobalOwner: false,
        skills: [],
        interests: [],
        memberships: [
          { orgId: 'org-1', role: 'Member', status: 'active', notes: '' }
        ]
      };

      state.members.push({
        id: 'mem-' + Date.now(),
        userId: newUser.id,
        orgId: 'org-1',
        displayName: name,
        email,
        avatarColor: '#059669',
        role: 'Member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        skills: [],
        interests: [],
        notes: ''
      });

      alert(`Welcome, ${name}! Invitation accepted for AqOne.`);
      actions.signInUser(newUser);
    }
  });

  // Test expired
  container.querySelector('#btn-simulate-expired')?.addEventListener('click', () => {
    container.querySelector('#invite-alert-container').innerHTML = `
      <div class="alert-banner alert-danger" role="alert">
        <span><strong>Invitation expired or used:</strong> This invitation link is no longer valid. Please request a new invitation from your lead.</span>
      </div>
    `;
  });

  container.querySelector('#link-back-signin')?.addEventListener('click', (e) => {
    e.preventDefault();
    actions.renderSignInView();
  });
}
