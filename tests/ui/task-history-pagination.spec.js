import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Task history pages work by keyboard at common viewport widths', async ({ page }) => {
  const viewports = [
    { width: 375, height: 812, name: 'phone' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1024, height: 768, name: 'small desktop' },
    { width: 1440, height: 900, name: 'desktop' },
  ];

  await page.goto('/');
  await page.locator('#nav-btn-tasks').click();
  const task = await page.evaluate(() => {
    const app = window.__app;
    const record = app.state.tasks.find(item => item.title === 'Design responsive navigation rail');
    app.state.isRealAuth = true;
    app.state.token = 'ui-pagination-token';
    record.comments = [];
    record.commentCount = 101;
    return { id: record.id };
  });

  await page.route(/\/api\/organizations\/[^/]+\/tasks\/[^/]+\/(comments|activity)(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const kind = url.pathname.endsWith('/comments') ? 'comments' : 'activity';
    const cursor = url.searchParams.get('cursor');
    const pageNumber = cursor ? Number(cursor.split('-').at(-1)) : 1;
    const start = pageNumber === 1 ? 101 : 51;
    const length = 50;
    const items = Array.from({ length }, (_, index) => {
      const number = start - index;
      if (kind === 'comments') {
        return {
          id: `mock-comment-${String(number).padStart(3, '0')}`,
          authorId: 'usr-history-author',
          authorName: 'History Author',
          body: `Synthetic comment ${number}`,
          createdAt: '2026-10-01T12:00:00.000Z',
        };
      }
      return {
        id: `mock-activity-${String(number).padStart(3, '0')}`,
        actorName: 'History Actor',
        action: `synthetic_event_${number}`,
        createdAt: '2026-10-01T12:00:00.000Z',
      };
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        [kind]: items,
        nextCursor: pageNumber === 1 ? `${kind}-page-2` : `${kind}-page-3`,
      }),
    });
  });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    if (await page.locator('#task-detail-modal').count()) {
      await page.locator('#btn-close-task-modal').click();
    }
    const listView = viewport.width <= 1100 ? '.mobile-record-list' : '.record-table-view';
    const trigger = page.locator(`#tasks-list-container ${listView} .btn-open-task-detail[data-task-id="${task.id}"]`).first();
    await trigger.click();

    const modal = page.locator('#task-detail-modal');
    const loadComments = modal.locator('#btn-load-older-comments');
    const loadActivity = modal.locator('#btn-load-older-activity');
    await expect(modal.getByText('Synthetic comment 101')).toBeVisible();
    await expect(loadComments).toBeVisible();
    await expect(loadActivity).toBeVisible();

    for (const button of [loadComments, loadActivity]) {
      await button.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(button).toBeFocused();
      const hasVisibleFocus = await button.evaluate(element => element.matches(':focus-visible')
        && Number.parseFloat(getComputedStyle(element).outlineWidth) >= 3);
      expect(hasVisibleFocus).toBe(true);
      await page.keyboard.press('Enter');
    }
    await expect(modal.getByText('Synthetic comment 51')).toBeVisible();
    await expect(modal.getByText('synthetic event 51')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalScroll, `Task history overflows at ${viewport.width}px`).toBe(false);

    if (viewport.width === 375) {
      await modal.locator('.modal-dialog').evaluate(dialog => { dialog.scrollTop = 0; });
      await page.screenshot({ path: resolve(rootDir, 'docs/evidence/screenshots/FEAT-007-task-history-375.png') });
    }
  }

  await page.locator('#btn-close-task-modal').click();
  await expect(page.locator(`#tasks-list-container .record-table-view .btn-open-task-detail[data-task-id="${task.id}"]`).first()).toBeFocused();
});
