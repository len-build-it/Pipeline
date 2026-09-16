import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');
const screenshotsDir = resolve(rootDir, 'docs/evidence/screenshots');

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

      // Capture desktop and phone screenshots as required by P1
      if (vp.name === 'desktop') {
        await page.screenshot({ path: `${screenshotsDir}/p1-desktop-overview-1440.png`, fullPage: true });
      } else if (vp.name === 'phone') {
        await page.screenshot({ path: `${screenshotsDir}/p1-phone-overview-375.png`, fullPage: true });
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
    await page.screenshot({ path: `${screenshotsDir}/p1-desktop-members-1280.png` });

    // 3. Tasks
    await page.click('#nav-btn-tasks');
    await expect(page.locator('h1')).toHaveText('Tasks');
    await expect(page.locator('table')).toBeVisible();
    await page.screenshot({ path: `${screenshotsDir}/p1-desktop-tasks-1280.png` });

    // 4. Announcements
    await page.click('#nav-btn-announcements');
    await expect(page.locator('h1')).toHaveText('Announcements');
    await expect(page.locator('.responsive-record-card').first()).toBeVisible();
    await page.screenshot({ path: `${screenshotsDir}/p1-desktop-announcements-1280.png` });
  });

  test('Organization scope switching updates dashboard metrics and records', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Initial "All Organizations"
    await expect(page.locator('[data-metric="members"] .stat-card-value')).toHaveText('4');
    await expect(page.locator('[data-metric="open-tasks"] .stat-card-value')).toHaveText('4');

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
    await newRow.locator('.btn-open-task-detail').click();
    const detailModal = page.locator('#task-detail-modal');
    await expect(detailModal).toBeVisible();

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
    await alexRow.locator('.btn-member-detail').click();
    const detailModal = page.locator('#member-detail-modal');
    await expect(detailModal).toBeVisible();

    // Private notes must NOT be in the DOM for Member persona
    await expect(detailModal.locator('#member-notes-input')).toHaveCount(0);
    await detailModal.locator('#btn-done-member-modal').click();
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
