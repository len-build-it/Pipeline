import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupTestDatabase, getTestPool, setupTestDatabase } from '../helpers/db-helper.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let taskId;

test.describe('Task comment and activity history pagination', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
    const pool = getTestPool();
    taskId = `tsk-history-e2e-${Date.now()}`;
    await pool.query(
      `INSERT INTO tasks (id, organization_id, title, description, creator_id, status, priority)
       VALUES ($1, 'org-1', 'History pagination load test', 'Synthetic history verifies continuation.', 'usr-alex', 'In progress', 'Medium')`,
      [taskId],
    );
    await pool.query(
      `INSERT INTO task_comments (id, task_id, author_id, body, created_at)
       SELECT 'hist-e2e-cmt-' || lpad(n::text, 4, '0'), $1, 'usr-sam', 'Synthetic comment ' || n, NOW() + INTERVAL '1 day'
       FROM generate_series(1, 105) AS n`,
      [taskId],
    );
    await pool.query(
      `INSERT INTO activity_events (id, organization_id, actor_id, entity_type, entity_id, action, created_at)
       SELECT 'hist-e2e-act-' || lpad(n::text, 4, '0'), 'org-1', 'usr-alex', 'task', $1, 'history_page_' || n, NOW() + INTERVAL '1 day'
       FROM generate_series(1, 105) AS n`,
      [taskId],
    );
  });

  test.afterAll(async () => {
    await cleanupTestDatabase();
  });

  test('Loads more than 100 comments and activity rows without gaps or duplicates', async ({ page }) => {
    await page.goto('/');
    if (!(await page.locator('#signin-email').isVisible())) {
      await page.locator('#btn-sign-out').click();
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#signin-email').fill('alex@example.com');
    await page.locator('#signin-password').fill('password123456');
    await page.locator('#btn-submit-signin').click();
    await expect(page.locator('h1')).toHaveText('Overview');

    await page.locator('#mob-nav-tasks').click();
    await page.locator('#task-search').fill('History pagination load test');
    const openTask = page.locator(`#tasks-list-container .mobile-record-list .btn-open-task-detail[data-task-id="${taskId}"]`).first();
    await openTask.click();

    const modal = page.locator('#task-detail-modal');
    const commentList = modal.locator('#task-comments-list');
    const activityList = modal.locator('#task-activity-list');
    const moreComments = modal.locator('#btn-load-older-comments');
    const moreActivity = modal.locator('#btn-load-older-activity');
    await expect(modal.locator('#task-comments-heading')).toHaveText('Comments (105)');
    await expect(commentList.locator('.responsive-record-card')).toHaveCount(50);
    await expect(commentList).toContainText('Synthetic comment 105');
    await expect(activityList.locator('[data-activity-id]')).toHaveCount(50);
    await moreComments.scrollIntoViewIfNeeded();
    await expect(moreComments).toBeVisible();
    await page.screenshot({ path: resolve(rootDir, 'docs/evidence/screenshots/FEAT-007-task-history-375.png') });

    await moreComments.click();
    await expect(commentList.locator('.responsive-record-card')).toHaveCount(100);
    await expect(commentList).toContainText('Synthetic comment 55');
    await moreActivity.click();
    await expect(activityList.locator('[data-activity-id]')).toHaveCount(100);
    await expect(activityList).toContainText('history page 55');

    await moreComments.click();
    await expect(commentList.locator('.responsive-record-card')).toHaveCount(105);
    await expect(commentList).toContainText('Synthetic comment 1');
    await expect(moreComments).toBeHidden();
    await moreActivity.click();
    await expect(activityList.locator('[data-activity-id]')).toHaveCount(105);
    await expect(activityList).toContainText('history page 1');
    await expect(moreActivity).toBeHidden();

    const uniqueComments = await commentList.locator('.responsive-record-card').evaluateAll(elements => new Set(elements.map(element => element.id)).size);
    const uniqueActivity = await activityList.locator('[data-activity-id]').evaluateAll(elements => new Set(elements.map(element => element.dataset.activityId)).size);
    expect(uniqueComments).toBe(105);
    expect(uniqueActivity).toBe(105);
  });
});
