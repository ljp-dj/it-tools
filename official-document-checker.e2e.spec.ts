import { test, expect } from '@playwright/test';

test.describe('Tool - Official document checker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/official-document-checker');
  });

  test('Has correct title', async ({ page }) => {
  });

  test('', async ({ page }) => {

  });
});