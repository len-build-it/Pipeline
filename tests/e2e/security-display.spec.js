import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupTestDatabase, getTestPool, setupTestDatabase } from '../helpers/db-helper.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const payload = "</option></select><img id=stored-name-probe src=x onerror='window.xssProbe=1'><select><option>";

test.describe('Stored display-name rendering', () => {
  test.beforeAll(async () => {
    await setupTestDatabase();
  });

  test.afterAll(async () => {
    await cleanupTestDatabase();
  });

  test('A saved member name stays literal through profile and task creation for another member', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    if (!(await page.locator('#signin-email').isVisible())) {
      await page.locator('#btn-sign-out').click();
    }

    await page.locator('#signin-email').fill('sam@example.com');
    await page.locator('#signin-password').fill('password123456');
    await page.locator('#btn-submit-signin').click();
    await expect(page.locator('.user-name')).toHaveText('Sam Taylor');

    await page.locator('#btn-open-profile').click();
    await page.locator('#profile-name').fill(payload);
    await page.once('dialog', dialog => dialog.accept());
    await page.locator('#btn-save-profile').click();
    await expect(page.locator('.user-name')).toHaveText(payload);
    await expect(page.locator('#app-root #stored-name-probe')).toHaveCount(0);
    expect(await page.evaluate(() => window.xssProbe || 0)).toBe(0);

    await page.locator('#btn-open-profile').click();
    await expect(page.locator('#profile-name')).toHaveValue(payload);
    await expect(page.locator('#profile-modal #stored-name-probe')).toHaveCount(0);
    await page.locator('#btn-close-profile-modal').click();

    const pool = getTestPool();
    const storedName = await pool.query('SELECT display_name FROM users WHERE id = $1', ['usr-sam']);
    expect(storedName.rows[0].display_name).toBe(payload);

    await page.locator('#btn-sign-out').click();
    await page.locator('#signin-email').fill('alex@example.com');
    await page.locator('#signin-password').fill('password123456');
    await page.locator('#btn-submit-signin').click();
    await expect(page.locator('.user-name')).toHaveText('Alex Rivera');
    await page.locator('#nav-btn-tasks').click();
    await page.locator('#btn-create-task').click();

    const samOption = page.locator('#task-create-assignee option[value="usr-sam"]');
    await expect(samOption).toHaveText(payload);
    await expect(page.locator('#task-create-modal #stored-name-probe')).toHaveCount(0);
    expect(await page.evaluate(() => window.xssProbe || 0)).toBe(0);
    await page.locator('#task-create-assignee').selectOption('usr-sam');
    await page.screenshot({ path: resolve(rootDir, 'docs/evidence/screenshots/FEAT-007-stored-display-1440.png') });
  });
});
