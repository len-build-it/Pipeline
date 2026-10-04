import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Stored display names remain text in the shell, profile form, and task assignee selector', async ({ page }) => {
  const payload = "</option></select><img id=stored-name-probe src=x onerror='window.xssProbe=1'><select><option>";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#demo-persona-select').selectOption('sam');
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

  await page.locator('#demo-persona-select').selectOption('alex');
  await page.locator('#nav-btn-tasks').click();
  await page.locator('#btn-create-task').click();
  const samOption = page.locator('#task-create-assignee option[value="usr-sam"]');
  await expect(samOption).toHaveText(payload);
  await expect(page.locator('#task-create-modal #stored-name-probe')).toHaveCount(0);
  expect(await page.evaluate(() => window.xssProbe || 0)).toBe(0);
  await page.locator('#task-create-assignee').selectOption('usr-sam');
  await page.screenshot({ path: resolve(rootDir, 'docs/evidence/screenshots/FEAT-007-stored-display-1440.png') });
});
