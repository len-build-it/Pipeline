import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');
const screenshotsDir = resolve(rootDir, 'docs/evidence/screenshots/ui-redesign');

test.describe('Responsive Dashboard & UI Navigation (P1)', () => {

  test('Responsive layouts at 375, 768, 1024, and 1440 widths with no overflow', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'phone' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'small-desktop' },
      { width: 1440, height: 900, name: 'desktop' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Wait for app root and overview
      await expect(page.locator('h1')).toContainText('Overview');

      // Verify no horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at ${vp.width}px`).toBe(false);

      // Verify organization scope switcher is visible
      if (vp.width <= 768) {
        await expect(page.locator('#mobile-scope-select')).toBeVisible();
      } else {
        await expect(page.locator('#desktop-scope-select')).toBeVisible();
      }

      // Capture the redesigned operational shell at each target viewport.
      if (vp.name === 'desktop') {
        await page.screenshot({ path: `${screenshotsDir}/p2-desktop-overview-1440.png`, fullPage: true });
      } else if (vp.name === 'phone') {
        await page.screenshot({ path: `${screenshotsDir}/p2-phone-overview-375.png` });
      } else if (vp.name === 'tablet') {
        await page.screenshot({ path: `${screenshotsDir}/p2-tablet-overview-768.png` });
      } else if (vp.name === 'small-desktop') {
        await page.screenshot({ path: `${screenshotsDir}/p2-small-desktop-overview-1024.png` });
      }
    }

    const operationalPages = [
      { name: 'members', nav: 'members', heading: 'Members', action: '#btn-invite-member', records: '#members-list-container' },
      { name: 'tasks', nav: 'tasks', heading: 'Tasks', action: '#btn-create-task', records: '#tasks-list-container' },
      { name: 'announcements', nav: 'announcements', heading: 'Announcements', action: '#btn-create-announcement' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const destination of operationalPages) {
        await page.goto('/');
        await page.locator(vp.width <= 768 ? `#mob-nav-${destination.nav}` : `#nav-btn-${destination.nav}`).click();
        await expect(page.locator('h1')).toHaveText(destination.heading);
        await expect(page.locator(destination.action)).toBeVisible();

        if (destination.records) {
          const recordList = page.locator(destination.records);
          if (vp.width <= 1100) {
            await expect(recordList.locator('.record-table-view')).toBeHidden();
            await expect(recordList.locator('.mobile-record-list')).toBeVisible();
          } else {
            await expect(recordList.locator('.record-table-view')).toBeVisible();
            await expect(recordList.locator('.mobile-record-list')).toBeHidden();
          }
        }

        const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(hasHorizontalScroll, `${destination.heading} has horizontal page overflow at ${vp.width}px`).toBe(false);

        await page.screenshot({
          path: `${screenshotsDir}/p2-${vp.name}-${destination.name}-${vp.width}.png`,
          fullPage: true
        });
      }
    }
  });

  test('Primary navigation across all four destinations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1. Overview
    await expect(page.locator('h1')).toHaveText('Overview');
    await expect(page.locator('.stat-card')).toHaveCount(4);

    // 2. Members
    await page.click('#nav-btn-members');
    await expect(page.locator('h1')).toHaveText('Members');
    await expect(page.locator('table')).toBeVisible();
    await page.screenshot({ path: `${screenshotsDir}/p2-desktop-members-1280.png` });

    // 3. Tasks
    await page.click('#nav-btn-tasks');
    await expect(page.locator('h1')).toHaveText('Tasks');
    await expect(page.locator('table')).toBeVisible();
    await page.screenshot({ path: `${screenshotsDir}/p2-desktop-tasks-1280.png` });

    // 4. Announcements
    await page.click('#nav-btn-announcements');
    await expect(page.locator('h1')).toHaveText('Announcements');
    await expect(page.locator('.responsive-record-card').first()).toBeVisible();
    await page.screenshot({ path: `${screenshotsDir}/p2-desktop-announcements-1280.png` });
  });

  test('Member and task filters stay usable with active chips and phone record cards', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await page.click('#mob-nav-members');
    await expect(page.locator('#members-list-container .record-table-view')).toBeHidden();
    await expect(page.locator('#members-list-container .mobile-record-list')).toBeVisible();
    const memberSearch = page.locator('#member-search');
    await expect(memberSearch).toBeVisible();
    await memberSearch.fill('Alex Rivera');
    await expect(page.locator('#members-list-container .mobile-record-list article')).toHaveCount(2);
    await memberSearch.clear();
    await page.locator('#member-filter-disclosure > summary').click();
    await page.selectOption('#member-role-filter', 'Lead');
    await page.selectOption('#member-status-filter', 'active');
    await expect(page.locator('#member-active-filters')).toContainText('Role: Lead');
    await expect(page.locator('#member-active-filters')).toContainText('Status: Active');
    await page.locator('[data-clear-filter="role"]').click();
    await expect(page.locator('#member-active-filters')).not.toContainText('Role: Lead');

    await page.locator('#members-list-container .mobile-record-list .btn-member-detail').last().click();
    const memberPanel = page.locator('#member-detail-modal');
    await expect(memberPanel).toBeVisible();
    await expect(memberPanel.locator('#btn-close-member-modal')).toHaveText('Close');
    await expect(page.locator('#members-list-container .mobile-record-list article').last()).toHaveAttribute('aria-current', 'true');
    await memberPanel.locator('#btn-close-member-modal').click();
    await expect(page.locator('#members-list-container .mobile-record-list .btn-member-detail').last()).toBeFocused();

    await page.click('#mob-nav-tasks');
    await expect(page.locator('#tasks-list-container .record-table-view')).toBeHidden();
    await expect(page.locator('#tasks-list-container .mobile-record-list')).toBeVisible();
    const taskSearch = page.locator('#task-search');
    await expect(taskSearch).toBeVisible();
    await taskSearch.fill('Design responsive navigation rail');
    await expect(page.locator('#tasks-list-container .mobile-record-list article')).toHaveCount(1);
    await taskSearch.clear();
    await page.locator('#task-filter-disclosure > summary').click();
    expect(await page.locator('#task-label-filter option').count()).toBeGreaterThan(1);
    await page.selectOption('#task-label-filter', { index: 1 });
    await expect(page.locator('#task-active-filters')).toContainText('Label:');

    const openTaskButton = page.locator('#tasks-list-container .mobile-record-list .btn-open-task-detail').first();
    await openTaskButton.click();
    const taskPanel = page.locator('#task-detail-modal');
    await expect(taskPanel).toBeVisible();
    await expect(taskPanel).toHaveClass(/detail-panel-backdrop/);
    await expect(taskPanel.locator('#btn-close-task-modal')).toHaveText('Close');
    await taskPanel.locator('#btn-close-task-modal').click();
    await expect(openTaskButton).toBeFocused();
  });

  test('Mobile menu opens primary navigation and restores focus on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const menuButton = page.locator('#mobile-menu-button');
    const primaryNav = page.locator('#primary-nav');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(primaryNav).toBeHidden();

    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(primaryNav).toBeVisible();
    await expect(page.locator('#nav-btn-overview')).toBeFocused();

    for (const id of [
      'nav-btn-members', 'nav-btn-tasks', 'nav-btn-announcements', 'nav-btn-finance',
      'btn-open-profile', 'btn-sign-out'
    ]) {
      await page.keyboard.press('Tab');
      const activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(id);
      const hasVisibleFocus = await page.evaluate(() => {
        const active = document.activeElement;
        return active.matches(':focus-visible') && Number.parseFloat(getComputedStyle(active).outlineWidth) >= 3;
      });
      expect(hasVisibleFocus).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(primaryNav).toBeHidden();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(menuButton).toBeFocused();

    await expect(page.locator('#mob-nav-overview')).toHaveAttribute('aria-current', 'page');
    await page.locator('#mob-nav-overview').focus();
    for (const id of ['mob-nav-members', 'mob-nav-tasks', 'mob-nav-announcements', 'mob-nav-finance']) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => ({
        id: document.activeElement?.id,
        visible: document.activeElement?.matches(':focus-visible'),
        outlineWidth: Number.parseFloat(getComputedStyle(document.activeElement).outlineWidth)
      }));
      expect(focus.id).toBe(id);
      expect(focus.visible).toBe(true);
      expect(focus.outlineWidth).toBeGreaterThanOrEqual(3);
    }
  });

  test('Keyboard traversal reaches every visible desktop shell control with a focus ring', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    const shellControls = new Set([
      'demo-persona-select', 'btn-reset-demo-data', 'desktop-scope-select',
      'nav-btn-overview', 'nav-btn-members', 'nav-btn-tasks', 'nav-btn-announcements',
      'nav-btn-finance', 'btn-open-profile', 'btn-sign-out'
    ]);
    const visited = new Set();

    for (let tab = 0; tab < 80 && visited.size < shellControls.size; tab += 1) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          id: active?.id,
          visible: active?.getClientRects().length > 0,
          focusVisible: active?.matches(':focus-visible'),
          outlineWidth: Number.parseFloat(getComputedStyle(active).outlineWidth)
        };
      });

      if (shellControls.has(focus.id)) {
        expect(focus.visible).toBe(true);
        expect(focus.focusVisible).toBe(true);
        expect(focus.outlineWidth).toBeGreaterThanOrEqual(3);
        visited.add(focus.id);
      }
    }

    expect([...visited].sort()).toEqual([...shellControls].sort());
  });

  test('Finance destination: demo mode explains that live sign-in is required, at every width', async ({ page }) => {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.click(width <= 768 ? '#mob-nav-finance' : '#nav-btn-finance');

      await expect(page.locator('h1')).toHaveText('Finance');
      await expect(page.locator('.state-box-title')).toHaveText('Sign in to use Finance');
      // No finance figures are invented for the demo.
      await expect(page.locator('#view-container table')).toHaveCount(0);

      const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(hasHorizontalScroll, `Horizontal scroll detected at ${width}px`).toBe(false);
    }

    // All five destinations fit the phone navigation bar.
    await page.setViewportSize({ width: 375, height: 667 });
    const buttons = page.locator('.mobile-bottom-nav-list button');
    await expect(buttons).toHaveCount(5);
    for (const box of await buttons.evaluateAll(list => list.map(b => b.getBoundingClientRect().toJSON()))) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(375);
    }

    await page.click('#btn-finance-sign-in');
    await expect(page.locator('#sign-in-form')).toBeVisible();
  });

  test('Organization scope switching updates dashboard metrics and records', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Initial "All Organizations"
    await expect(page.locator('[data-metric="members"] .stat-card-value')).toHaveText('4');
    await expect(page.locator('[data-metric="open-tasks"] .stat-card-value')).toHaveText('5');

    // Switch to AqOne
    await page.selectOption('#desktop-scope-select', 'org-1');
    await expect(page.locator('.page-title-group strong')).toHaveText('AqOne');
    await expect(page.locator('[data-metric="members"] .stat-card-value')).toHaveText('3');
    await expect(page.locator('[data-metric="open-tasks"] .stat-card-value')).toHaveText('2');

    // Switch to Dev Guild
    await page.selectOption('#desktop-scope-select', 'org-2');
    await expect(page.locator('.page-title-group strong')).toHaveText('Dev Guild');
    await expect(page.locator('[data-metric="members"] .stat-card-value')).toHaveText('4');
    await expect(page.locator('[data-metric="open-tasks"] .stat-card-value')).toHaveText('2');
  });

  test('Organization labels come from organization records for three or more teams', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Combined scope plus one option per configured organization
    await expect(page.locator('#desktop-scope-select option')).toHaveText([
      'All Organizations', 'AqOne', 'Dev Guild', 'Harbor Robotics Club'
    ]);

    // Third organization scope shows its own name and totals
    await page.selectOption('#desktop-scope-select', 'org-3');
    await expect(page.locator('.page-title-group strong')).toHaveText('Harbor Robotics Club');
    await expect(page.locator('[data-metric="members"] .stat-card-value')).toHaveText('2');
    await expect(page.locator('[data-metric="open-tasks"] .stat-card-value')).toHaveText('1');

    // Member and task rows carry the third organization's label
    await page.click('#nav-btn-members');
    await expect(page.locator('tbody tr').first()).toContainText('Harbor Robotics Club');
    await page.click('#nav-btn-tasks');
    await expect(page.locator('tr', { hasText: 'Calibrate drive motors' })).toContainText('Harbor Robotics Club');

    // An arbitrary added organization is labeled from its record and rendered as literal text
    await page.evaluate(() => {
      const app = window.__app;
      app.state.organizations.push({ id: 'org-zeta', name: 'Zeta <Lab> & Co', status: 'active' });
      app.state.tasks.push({
        id: 'tsk-zeta', orgId: 'org-zeta', title: 'Zeta onboarding', description: '', creator: 'usr-owner',
        creatorName: 'Len', assignee: null, assigneeName: 'Unassigned', status: 'Backlog', priority: 'Low',
        dueDate: null, labels: [], archived: false, updatedAt: new Date().toISOString(), comments: []
      });
      app.state.announcements.unshift({
        id: 'ann-zeta', title: 'Zeta kickoff', body: 'Welcome.', authorId: 'usr-owner', authorName: 'Len',
        targetOrgs: ['org-zeta', 'org-3'], status: 'published', publishedAt: new Date().toISOString(), archived: false
      });
      app.setScope('all');
    });
    await expect(page.locator('#desktop-scope-select option')).toHaveCount(5);
    await page.click('#nav-btn-tasks');
    await expect(page.locator('tr', { hasText: 'Zeta onboarding' })).toContainText('Zeta <Lab> & Co');
    await page.click('#nav-btn-announcements');
    await expect(page.locator('#announcements-list-container')).toContainText('Zeta <Lab> & Co, Harbor Robotics Club');
  });

  test('Invite member form: validation errors, summary, and submission', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open invite modal
    await page.click('#btn-quick-invite');
    const modal = page.locator('#invite-modal');
    await expect(modal).toBeVisible();

    // Submit empty to trigger error summary
    await modal.locator('#btn-send-invitation').click();
    const errorSummary = modal.locator('#invite-error-summary');
    await expect(errorSummary).toBeVisible();
    await expect(modal.locator('#invite-error-list')).toContainText('valid email address is required');

    // Fill valid email
    await modal.locator('#invite-member-email').fill('newrecruit@example.com');
    await modal.locator('#invite-org-select').selectOption('org-1');

    // Set dialog handler for alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Invitation sent');
      await dialog.accept();
    });

    await modal.locator('#btn-send-invitation').click();
    await expect(modal).not.toBeVisible();
  });

  test('Task creation, status update, comments, and conflict simulation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1. Create task
    await page.click('#btn-quick-task');
    const createModal = page.locator('#task-create-modal');
    await expect(createModal).toBeVisible();

    await createModal.locator('#task-create-title').fill('Test UI integration flow');
    await createModal.locator('#task-create-desc').fill('Testing task creation in Playwright suite.');
    await createModal.locator('#task-create-priority').selectOption('High');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Task created successfully');
      await dialog.accept();
    });

    await createModal.locator('#btn-save-new-task').click();
    await expect(createModal).not.toBeVisible();

    // Navigate to tasks and check new task
    await page.click('#nav-btn-tasks');
    await expect(page.locator('tbody')).toContainText('Test UI integration flow');

    // 2. Open task detail
    const newRow = page.locator('tr', { hasText: 'Test UI integration flow' });
    const taskTitleButton = newRow.locator('.btn-open-task-detail').first();
    await taskTitleButton.click();
    const detailModal = page.locator('#task-detail-modal');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toHaveClass(/detail-panel-backdrop/);
    await expect(newRow).toHaveAttribute('aria-current', 'true');
    await expect(detailModal.locator('#btn-close-task-modal')).toHaveText('Close');

    // 3. Post a comment
    await detailModal.locator('#task-new-comment').fill('This is an automated test comment.');
    await detailModal.locator('#btn-add-comment').click();
    await expect(detailModal.locator('#task-comments-list')).toContainText('This is an automated test comment.');

    // 4. Test stale edit conflict simulation
    await detailModal.locator('#btn-simulate-conflict').click();
    await detailModal.locator('#btn-save-task-changes').click();
    await expect(detailModal.locator('#task-modal-alert')).toContainText('Edit conflict!');

    // Close modal
    await detailModal.locator('#btn-close-task-modal').click();
    await expect(detailModal).not.toBeVisible();
    await expect(newRow).not.toHaveAttribute('aria-current', 'true');
    await expect(taskTitleButton).toBeFocused();
  });

  test('Announcements: compose, preview toggle, and publish', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.click('#btn-quick-announcement');
    const composeModal = page.locator('#ann-compose-modal');
    await expect(composeModal).toBeVisible();

    await composeModal.locator('#ann-compose-title').fill('Playwright Test Broadcast');
    await composeModal.locator('#ann-compose-body').fill('Broadcasting exciting news to all organizations.');

    // Test preview tab
    await composeModal.locator('#btn-tab-preview').click();
    await expect(composeModal.locator('#ann-preview-panel')).toBeVisible();
    await expect(composeModal.locator('#ann-preview-panel')).toContainText('Broadcasting exciting news');

    // Back to edit
    await composeModal.locator('#btn-tab-edit').click();
    await expect(composeModal.locator('#ann-edit-panel')).toBeVisible();

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('published successfully');
      await dialog.accept();
    });

    await composeModal.locator('#btn-publish-ann').click();
    await expect(composeModal).not.toBeVisible();

    // Verify in announcements list
    await page.click('#nav-btn-announcements');
    await expect(page.locator('#announcements-list-container')).toContainText('Playwright Test Broadcast');
  });

  test('Permission isolation: Member role cannot invite or see private notes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Switch to Sam Taylor (Member persona)
    await page.selectOption('#demo-persona-select', 'sam');

    // Quick action buttons should NOT be visible for Member
    await expect(page.locator('#btn-quick-invite')).not.toBeVisible();
    await expect(page.locator('#btn-quick-task')).not.toBeVisible();
    await expect(page.locator('#btn-quick-announcement')).not.toBeVisible();

    // Go to Members page
    await page.click('#nav-btn-members');
    await expect(page.locator('#btn-invite-member')).not.toBeVisible();

    // Open detail of Alex Rivera
    const alexRow = page.locator('tr', { hasText: 'Alex Rivera' }).first();
    await alexRow.locator('.btn-member-detail').first().click();
    const detailModal = page.locator('#member-detail-modal');
    await expect(detailModal).toBeVisible();
    await expect(alexRow).toHaveAttribute('aria-current', 'true');
    await expect(detailModal.locator('#btn-close-member-modal')).toHaveText('Close');

    // Private notes must NOT be in the DOM for Member persona
    await expect(detailModal.locator('#member-notes-input')).toHaveCount(0);
    await detailModal.locator('#btn-done-member-modal').click();
    await expect(alexRow.locator('.btn-member-detail').first()).toBeFocused();
  });

  test('Accessibility: skip link and dialog escape dismissal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Check skip link exists
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeAttached();
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    // Open invite modal and test Escape key closes dialog
    await page.click('#btn-quick-invite');
    const modal = page.locator('#invite-modal');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});
