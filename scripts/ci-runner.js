import { execSync } from 'child_process';
import path from 'path';

// Resolve project directories
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');

console.log('==================================================');
console.log('       REDIRECTOR REWRITE PORTABLE CI RUNNER      ');
console.log('==================================================');

function runCommand(command, description) {
  console.log(`\n[CI Task] Starting: ${description}...`);
  console.log(`Running: ${command}`);
  try {
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    console.log(`[CI Task] Success: ${description} completed successfully.`);
  } catch (err) {
    console.error(`\n[CI FAILURE] Task failed: ${description}`);
    console.error(`Error details: ${err.message}`);
    process.exit(1);
  }
}

// Step 1: Run Dependency Security Scan (npm audit)
runCommand('npm audit --audit-level=high', 'Dependency Security Audit');

// Step 2: Run ESLint static analysis
runCommand('npx eslint src/ scripts/ tests/', 'ESLint Static Analysis');

// Step 3: Run core unit tests
runCommand('node tests/core/engine.test.js && node tests/core/rules.test.js', 'Core Matching Unit Tests');

// Step 4: Run Playwright Headless Multi-Browser E2E Tests (Chromium & Firefox)
runCommand('npx playwright test', 'Playwright Headless Browser E2E Tests');

// Step 5: Run extension structure and policy linter
runCommand('npx addons-linter src', 'Extension Manifest & Security Audits');

// Step 6: Run zip compilation packager
runCommand('npm run package', 'ZIP Bundle Compilation');

console.log('\n==================================================');
console.log('        ALL CI/CD TASKS COMPLETED SUCCESSFULLY!   ');
console.log('==================================================');
