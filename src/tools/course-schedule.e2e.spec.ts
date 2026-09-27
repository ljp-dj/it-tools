import { test, expect } from '@playwright/test';

test.describe('Tool - Course schedule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/course-schedule');
  });

  test('Has correct title', async ({ page }) => {
  });

  test('', async ({ page }) => {

  });
});