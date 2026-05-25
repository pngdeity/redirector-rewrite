import { test, expect } from '@playwright/test';

const dashboardPath = 'http://localhost:3000/ui/dashboard/dashboard.html';

test.describe('Redirector Rewrite Multi-Browser E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the options dashboard page context
    console.log(`Navigating to options page: ${dashboardPath}`);
    await page.goto(dashboardPath);
  });

  test('should load the dashboard brand header correctly', async ({ page }) => {
    // Verify brand logo exists and contains correct title
    const logo = page.locator('.logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveText('REDIRECTOR');
    
    // Verify rules count starts at 0
    const countBadge = page.locator('#rules-count');
    await expect(countBadge).toHaveText('0 rules');
    
    // Verify empty state is visible
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeVisible();
  });

  test('should open the create rule dialog and execute live matching validation', async ({ page }) => {
    // 1. Click create rule trigger
    const btnCreate = page.locator('#btn-create-rule');
    await btnCreate.click();

    // 2. Verify dialog opens
    const dialog = page.locator('#rule-dialog');
    await expect(dialog).toBeVisible();

    // 3. Fill in form values
    await page.fill('#rule-description', 'Test Wikipedia Redirect');
    await page.fill('#rule-example-url', 'https://en.wikipedia.org/wiki/Main_Page');
    await page.fill('#rule-include-pattern', '*://en.wikipedia.org/wiki/*');
    await page.fill('#rule-target-url', 'https://en.m.wikipedia.org/wiki/$2');

    // 4. Fill in live test url input
    await page.fill('#test-url', 'https://en.wikipedia.org/wiki/Main_Page');

    // 5. Verify live tester catches the match and displays the resulting URL in real-time!
    const testStatus = page.locator('#test-status');
    await expect(testStatus).toHaveText('Matches');

    const testResult = page.locator('#test-result');
    await expect(testResult).toHaveText('https://en.m.wikipedia.org/wiki/Main_Page');

    // 6. Click cancel rule to close dialog
    const btnCancel = page.locator('#btn-cancel-rule');
    await btnCancel.click();
    await expect(dialog).not.toBeVisible();
  });

  test('should successfully detect circular loops in the live tester', async ({ page }) => {
    // 1. Click create rule
    await page.locator('#btn-create-rule').click();

    // 2. Setup a circular looping rule pattern (redirects to itself)
    await page.fill('#rule-include-pattern', '*://example.com/*');
    await page.fill('#rule-target-url', 'http://example.com/$1');
    await page.fill('#test-url', 'http://example.com/start');

    // 3. Verify the live engine catches the loop and displays the red Loop badge and error!
    const testStatus = page.locator('#test-status');
    await expect(testStatus).toHaveText('Loop');

    const testResult = page.locator('#test-result');
    await expect(testResult).toContainText('Infinite loop:');
  });

  test('should support HistoryState redirects and visual rule grouping', async ({ page }) => {
    // 1. Click create rule
    await page.locator('#btn-create-rule').click();
    await expect(page.locator('#rule-dialog')).toBeVisible();

    // 2. Fill standard form values
    await page.fill('#rule-description', 'SPA History Redirect');
    await page.fill('#rule-include-pattern', '*://example.com/spa/*');
    await page.fill('#rule-target-url', 'https://new-spa.com/$1');

    // 3. Open advanced options
    await page.click('.advanced-details summary');
    
    // 4. Check Visual Grouping checkbox and HistoryState checkbox
    await page.check('#rule-grouped');
    await page.check('#apply-to-checkboxes input[value="history"]');

    // 5. Save the rule
    await page.click('#btn-save-rule');
    await expect(page.locator('#rule-dialog')).not.toBeVisible();

    // 6. Verify that the rule card rendered with the correct visual class and badges!
    const ruleCard = page.locator('.rule-card');
    await expect(ruleCard).toHaveClass(/grouped/);
    
    const historyBadge = ruleCard.locator('.badge-history');
    await expect(historyBadge).toBeVisible();
    await expect(historyBadge).toHaveText('HistoryState');
  });
});
