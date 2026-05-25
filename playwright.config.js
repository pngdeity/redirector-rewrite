import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const extensionPath = path.resolve(__dirname, 'src');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'xpinstall.signatures.required': false,
            'extensions.autoupdate.enabled': false
          }
        }
      },
    }
  ],
  webServer: {
    command: 'npx serve src -l 3000 --no-clipboard',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 10 * 1000
  }
});
