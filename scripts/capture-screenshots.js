import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const screenshotDir = resolve(projectRoot, 'screenshots');

if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true });
}

const SERVER = 'http://localhost:3000';
const DASHBOARD = `${SERVER}/ui/dashboard/dashboard.html`;
const POPUP = `${SERVER}/ui/popup/popup.html`;
const HELP = `${SERVER}/ui/help/help.html`;

async function screenshot(browser, page, name, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
  const path = resolve(screenshotDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  ✓ ${name}.png`);
  return path;
}

async function createRule(page, { description, exampleUrl, includePattern, targetUrl, save = true }) {
  await page.click('#btn-create-rule');
  await page.waitForSelector('#rule-dialog[open]');
  await page.fill('#rule-description', description);
  if (exampleUrl) await page.fill('#rule-example-url', exampleUrl);
  await page.fill('#rule-include-pattern', includePattern);
  await page.fill('#rule-target-url', targetUrl);
  if (save) {
    await page.click('#btn-save-rule');
    await page.waitForSelector('#rule-dialog:not([open])', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function main() {
  console.log('\nRedirector Rewrite — Screenshot Capture\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // --- 1. Dashboard with demo rules ---
  console.log('[1/5] Dashboard with demo rules');
  await page.goto(DASHBOARD);
  await page.waitForSelector('.logo');

  await createRule(page, {
    description: 'Wikipedia Mobile Redirect',
    exampleUrl: 'https://en.wikipedia.org/wiki/Main_Page',
    includePattern: '*://en.wikipedia.org/wiki/*',
    targetUrl: 'https://en.m.wikipedia.org/wiki/$2'
  });

  await createRule(page, {
    description: 'YouTube Shorts → Regular',
    exampleUrl: 'https://www.youtube.com/shorts/abc123',
    includePattern: '^(https?://)(www.)?youtube.com/shorts/(.*)',
    targetUrl: '$1www.youtube.com/watch?v=$3'
  });

  await createRule(page, {
    description: 'Strip DoubleClick Tracking',
    exampleUrl: 'https://ad.doubleclick.net/ddm/trackclk/foo?https://www.example.com',
    includePattern: '^(?:https?://)ad.doubleclick.net/.*\\?(.*)',
    targetUrl: '$1'
  });

  await screenshot(browser, page, '01-dashboard');

  // --- 2. Live test in edit dialog ---
  console.log('[2/5] Live test dialog');
  await page.click('#btn-create-rule');
  await page.waitForSelector('#rule-dialog[open]');
  await page.fill('#rule-description', 'Test Rule');
  await page.fill('#rule-include-pattern', '*://example.com/*');
  await page.fill('#rule-target-url', 'https://example.org/$1');
  await page.fill('#test-url', 'https://example.com/test/page');

  await page.waitForFunction(() => {
    const badge = document.getElementById('test-status');
    return badge && badge.textContent === 'Matches';
  }, { timeout: 3000 }).catch(() => {});

  await page.waitForTimeout(200);
  const dialog = page.locator('#rule-dialog');
  await dialog.screenshot({ path: resolve(screenshotDir, '02-live-test.png') });
  console.log('  ✓ 02-live-test.png');
  await page.click('#btn-cancel-rule');

  // --- 3. Organize mode ---
  console.log('[3/5] Organize mode');
  await page.locator('#rules-count').waitFor();
  await page.click('#btn-organize');
  await page.waitForTimeout(300);
  await screenshot(browser, page, '03-organize-mode');

  // --- 4. Popup ---
  console.log('[4/5] Popup');
  const popupPage = await browser.newPage();
  await popupPage.goto(POPUP);
  await popupPage.waitForSelector('.logo');
  await screenshot(browser, popupPage, '04-popup', { width: 320, height: 400 });
  await popupPage.close();

  // --- 5. Help page ---
  console.log('[5/5] Help page');
  const helpPage = await browser.newPage();
  await helpPage.goto(HELP);
  await helpPage.waitForSelector('.logo');
  await screenshot(browser, helpPage, '05-help');

  await helpPage.close();
  await page.close();
  await browser.close();

  console.log(`\nAll 5 screenshots saved to screenshots/\n`);
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
