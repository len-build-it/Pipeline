/**
 * Announcements view module
 * Requirements: FEAT-004/REQ-001 through REQ-008; PROD-005/UI-REQ-001 through 007
 */

export function renderAnnouncements(container, state, actions) {
  const { currentUser, currentScope } = state;
  const isOwner = currentUser.isGlobalOwner;
  const userMembership = currentUser.memberships.find(m => m.orgId === currentScope);
  const isLead = isOwner || (userMembership && userMembership.role === 'Lead');

  let searchQuery = '';
  let showArchived = false;

  function getFilteredAnnouncements() {
    let list = state.announcements;

    if (showArchived) {
      list = list.filter(a => a.archived);
    } else {
      list = list.filter(a => !a.archived);
    }

    // Draft privacy: regular members NEVER see drafts!
    if (!isOwner) {
      list = list.filter(a => {
        if (a.status === 'draft') {
          // Can only see draft if lead in ALL target orgs of the draft
          return a.targetOrgs.every(t => {
            const m = currentUser.memberships.find(mem => mem.orgId === t);
            return m && m.role === 'Lead';
          });
        }
        return true;
      });
    }

    if (currentScope !== 'all') {
      list = list.filter(a => a.targetOrgs.includes(currentScope));
    } else if (!isOwner) {
      const allowed = currentUser.memberships.map(m => m.orgId);
      list = list.filter(a => a.targetOrgs.some(t => allowed.includes(t)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));
    }

    // Sort: published newest first, drafts at top if visible
    return [...list].sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (b.status === 'draft' && a.status !== 'draft') return 1;
      const dateA = a.publishedAt || a.id;
      const dateB = b.publishedAt || b.id;
      return dateB.localeCompare(dateA);
    });
  }

  function renderList() {
    const list = getFilteredAnnouncements();
    const listContainer = container.querySelector('#announcements-list-container');
    if (!listContainer) return;

    if (list.length === 0) {
      listContainer.innerHTML = `
        <div class="state-box">
          <p class="state-box-title">No announcements found</p>
          <p class="state-box-desc">No messages matching your current filter.</p>
          ${isLead && !showArchived ? `<button class="btn btn-primary btn-sm" id="btn-empty-create-announcement">New announcement</button>` : ''}
        </div>
      `;
      listContainer.querySelector('#btn-empty-create-announcement')?.addEventListener('click', () => {
        actions.openAnnouncementComposeModal();
      });
      return;
    }

    listContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:var(--spacing-4);">
        ${list.map(a => `
          <article class="responsive-record-card" style="border-left: 4px solid ${a.status === 'published' ? 'var(--color-primary)' : 'var(--color-warning)'};" id="announcement-card-${a.id}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--spacing-2);">
              <div>
                <div style="display:flex; align-items:center; gap:var(--spacing-2); margin-bottom:4px;">
                  <span class="badge badge-${a.status}">${a.status}</span>
                  <span style="font-size:0.75rem; color:var(--color-text-muted);">
                    Audience: ${a.targetOrgs.map(o => o === 'org-1' ? 'AqOne' : 'Dev Guild').join(', ')}
                  </span>
                  ${a.archived ? `<span class="badge badge-archived">Archived</span>` : ''}
                </div>
                <h2 style="font-size:var(--font-size-lg); font-weight:700;">${escapeHtml(a.title)}</h2>
              </div>
              <div>
                <button class="btn btn-secondary btn-sm btn-view-announcement" data-ann-id="${a.id}">Read more</button>
              </div>
            </div>
            <p style="font-size:0.8125rem; color:var(--color-text-muted); margin:var(--spacing-1) 0;">
              By <strong>${escapeHtml(a.authorName)}</strong> ${a.publishedAt ? `• Published on ${a.publishedAt.slice(0, 10)}` : '• Draft (Unpublished)'}
            </p>
            <div style="font-size:var(--font-size-sm); line-height:1.6; margin-top:var(--spacing-2);">
              ${escapeHtml(a.body)}
            </div>
          </article>
        `).join('')}
      </div>
    `;

    listContainer.querySelectorAll('.btn-view-announcement').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const annId = e.currentTarget.getAttribute('data-ann-id');
        openAnnouncementDetailModal(annId, state, actions);
      });
    });
  }

  container.innerHTML = `
    <header class="page-header">
      <div class="page-title-group">
        <h1>Announcements</h1>
        <p>Targeted broadcasts, publications, and updates across organizations.</p>
      </div>
      <div class="page-actions">
        ${isLead ? `
          <button class="btn btn-primary" id="btn-create-announcement">New announcement</button>
        ` : ''}
      </div>
    </header>

    <div class="content-area">
      <section class="filter-bar" aria-label="Announcement filters">
        <input type="search" id="announcement-search" class="filter-input" placeholder="Search announcements by title or content..." aria-label="Search announcements" />
        <label style="display:flex; align-items:center; gap:var(--spacing-1); font-size:var(--font-size-sm); cursor:pointer;">
          <input type="checkbox" id="announcement-archived-checkbox" />
          Show Archived
        </label>
      </section>

      <section class="section-panel">
        <div id="announcements-list-container"></div>
      </section>
    </div>
  `;

  container.querySelector('#announcement-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  container.querySelector('#announcement-archived-checkbox')?.addEventListener('change', (e) => {
    showArchived = e.target.checked;
    renderList();
  });

  if (isLead) {
    container.querySelector('#btn-create-announcement')?.addEventListener('click', () => {
      actions.openAnnouncementComposeModal();
    });
  }

  renderList();
}

/**
 * Announcement Detail / View Modal
 */
export function openAnnouncementDetailModal(annId, state, actions) {
  const ann = state.announcements.find(a => a.id === annId);
  if (!ann) return;

  const { currentUser } = state;
  const isOwner = currentUser.isGlobalOwner;
  const canManage = isOwner || ann.targetOrgs.every(t => {
    const m = currentUser.memberships.find(mem => mem.orgId === t);
    return m && m.role === 'Lead';
  });

  const modalHtml = `
    <div class="modal-backdrop" id="ann-detail-modal" role="dialog" aria-modal="true" aria-labelledby="ann-modal-title">
      <div class="modal-dialog">
        <header class="modal-header">
          <div>
            <div style="display:flex; align-items:center; gap:var(--spacing-2); margin-bottom:4px;">
              <span class="badge badge-${ann.status}">${ann.status}</span>
              ${ann.archived ? `<span class="badge badge-archived">Archived</span>` : ''}
              <span style="font-size:0.75rem; color:var(--color-text-muted);">
                Audience: ${ann.targetOrgs.map(o => o === 'org-1' ? 'AqOne' : 'Dev Guild').join(', ')}
              </span>
            </div>
            <h2 id="ann-modal-title" class="modal-title">${escapeHtml(ann.title)}</h2>
          </div>
          <button class="modal-close-btn" id="btn-close-ann-modal" aria-label="Close dialog">&times;</button>
        </header>

        <div class="modal-body">
          <div style="font-size:0.8125rem; color:var(--color-text-muted); border-bottom:1px solid var(--color-border); padding-bottom:var(--spacing-3);">
            Author: <strong>${escapeHtml(ann.authorName)}</strong> ${ann.publishedAt ? `• Published on ${ann.publishedAt}` : '• Draft'}
          </div>

          <div style="font-size:var(--font-size-base); line-height:1.7; padding:var(--spacing-3) 0; white-space:pre-wrap;">
            ${escapeHtml(ann.body)}
          </div>

          ${ann.status === 'published' ? `
            <div class="alert-banner alert-warning" style="font-size:0.75rem;">
              <span><strong>Immutability Notice:</strong> Per specification, published announcements cannot have their body or audience altered.</span>
            </div>
          ` : ''}

          ${canManage && ann.status === 'draft' ? `
            <div style="display:flex; gap:var(--spacing-2); margin-top:var(--spacing-4);">
              <button class="btn btn-primary btn-sm" id="btn-publish-draft">Publish Now</button>
            </div>
          ` : ''}

          ${canManage && ann.status === 'published' && !ann.archived ? `
            <div style="margin-top:var(--spacing-4); border-top:1px solid var(--color-border); padding-top:var(--spacing-3); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--color-text-muted);">Remove from primary feeds</span>
              <button class="btn btn-danger btn-sm" id="btn-archive-announcement">Archive Announcement</button>
            </div>
          ` : ''}
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" id="btn-close-ann-bottom">Close</button>
        </footer>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('ann-detail-modal');

  function closeModal() {
    modal.remove();
  }

  modal.querySelector('#btn-close-ann-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-close-ann-bottom').addEventListener('click', closeModal);

  // Publish draft
  modal.querySelector('#btn-publish-draft')?.addEventListener('click', () => {
    if (state.isRealAuth && state.token) {
      fetch(`/api/announcements/${ann.id}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${state.token}` },
      }).then(async res => {
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.message || 'Failed to publish draft.'}`);
          return;
        }
        const updated = await res.json();
        ann.status = updated.publicationStatus.toLowerCase();
        ann.publishedAt = updated.publishedAt;
        alert('Announcement published successfully.');
        closeModal();
        actions.refresh();
      }).catch(err => {
        alert(`Network error: ${err.message}`);
      });
      return;
    }

    ann.status = 'published';
    ann.publishedAt = new Date().toISOString();
    alert('Announcement published successfully.');
    closeModal();
    actions.refresh();
  });

  // Archive announcement
  modal.querySelector('#btn-archive-announcement')?.addEventListener('click', () => {
    if (confirm('Archive this announcement? It will be removed from default feeds.')) {
      if (state.isRealAuth && state.token) {
        fetch(`/api/announcements/${ann.id}/archive`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.token}` },
        }).then(async res => {
          if (!res.ok) {
            const err = await res.json();
            alert(`Error: ${err.message || 'Failed to archive announcement.'}`);
            return;
          }
          ann.archived = true;
          alert('Announcement archived.');
          closeModal();
          actions.refresh();
        }).catch(err => {
          alert(`Network error: ${err.message}`);
        });
        return;
      }

      ann.archived = true;
      alert('Announcement archived.');
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
