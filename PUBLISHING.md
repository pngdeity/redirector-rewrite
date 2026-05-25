# Publishing Guide

## Prerequisites

### Accounts

| Account | Cost | Required For |
|---------|------|-------------|
| [Chrome Web Store Developer](https://chrome.google.com/webstore/devconsole) | $5 one-time | Publishing to Chrome Web Store |
| [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/) | Free | Publishing to Firefox AMO |
| GitHub repository with Actions enabled | Free | CI/CD pipeline |

### Chrome Web Store API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or use an existing one
3. Enable the **Chrome Web Store API**
4. Create OAuth 2.0 credentials (Desktop application type)
5. Generate a refresh token using the OAuth playground

**GitHub secrets to set:**

| Secret | Description |
|--------|-------------|
| `CHROME_CLIENT_ID` | OAuth 2.0 client ID |
| `CHROME_CLIENT_SECRET` | OAuth 2.0 client secret |
| `CHROME_REFRESH_TOKEN` | OAuth 2.0 refresh token |
| `CHROME_APP_ID` | Chrome Web Store extension ID (from the store listing URL) |

### Firefox AMO API Credentials

1. Go to [AMO Developer Hub](https://addons.mozilla.org/developers/addon/api/key/)
2. Generate JWT issuer and secret

**GitHub secrets to set:**

| Secret | Description |
|--------|-------------|
| `AMO_JWT_ISSUER` | API key (JWT issuer) |
| `AMO_JWT_SECRET` | API secret (JWT secret) |

### Store Listing Assets

Run the screenshot capture script:
```bash
npm run screenshots
```

This generates 5 screenshots in `screenshots/`:
1. `01-dashboard.png` — Dashboard with demo rules
2. `02-live-test.png` — Create/edit dialog with live test
3. `03-organize-mode.png` — Organize mode with grouping
4. `04-popup.png` — Browser action popup
5. `05-help.png` — Help page

Descriptions for both stores are in `store-listing.md`.

### Privacy Policy

Host `privacy.md` at an accessible URL. GitHub Pages is recommended:
- Enable Pages on the repo: Settings → Pages → Source: main branch
- URL will be `https://pngdeity.github.io/redirector-rewrite/privacy`
- Paste this URL into both store listing forms

### Firefox AMO Specific

The `browser_specific_settings.gecko.id` in `manifest.json` is:
```
redirector-rewrite@pngdeity.ru
```

AMO will auto-generate a UUID on first upload if the ID is unreserved. If you want to keep this ID, register it on AMO before first upload.

`data_collection_permissions: ["none"]` is declared — AMO requires this for extensions that don't collect data.

---

## Publishing Workflow

### Step 1: Create and push a release tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

The version must be a valid semver string (e.g., `v1.0.0`). The `v` prefix is stripped and stamped into `manifest.json` and `package.json` during the CI build.

### Step 2: Run "Verify and Package" workflow

1. Go to GitHub → Actions → **Verify and Package**
2. Click **Run workflow**
3. Set `ref` to the tag name (e.g., `v1.0.0`)
4. Click **Run workflow**

Wait for completion. The workflow:
- Stamps the version into manifest.json and package.json
- Runs npm audit
- Runs ESLint
- Runs unit tests (14)
- Runs E2E tests (8, Chromium + Firefox)
- Runs addons-linter
- Packages extension as ZIP
- Uploads artifact named `extension-package`

### Step 3: Verify the artifact

1. Download `extension-package` from the workflow run's Artifacts section
2. Unzip and inspect `manifest.json` — verify version and permissions
3. Optionally load as unpacked extension in Chrome/Firefox for a final smoke test

### Step 4: Run "Release and Deploy" workflow

1. Go to GitHub → Actions → **Release and Deploy**
2. Click **Run workflow**
3. Set `ci-run-id` to the run ID from Step 2 (found in the URL: `.../actions/runs/<run-id>`)
4. Click **Run workflow**

The `production` environment requires manual approval. Once approved:
- Downloads the artifact from the CI run
- Signs the ZIP with Cosign (keyless OIDC)
- Creates a GitHub Release with the ZIP and signature bundle
- Uploads to Chrome Web Store
- Signs and uploads to Firefox AMO (source code included)

---

## CI/CD Summary

| Workflow | Trigger | Inputs | Output |
|----------|---------|--------|--------|
| Verify and Package | Manual dispatch | `ref` (tag/branch), `version` (optional) | `extension-package` artifact |
| Release and Deploy | Manual dispatch | `ci-run-id` (from verify) | GitHub Release + store publish |

Both workflows are `workflow_dispatch` only — no automatic triggers.

---

## Verification Checklist Before Publishing

- [ ] `gecko.id` registered or accepted by AMO
- [ ] Privacy policy URL accessible
- [ ] Store descriptions reviewed (`store-listing.md`)
- [ ] Screenshots generated (`npm run screenshots`)
- [ ] All GitHub secrets configured
- [ ] `production` environment approval rules set
- [ ] `manifest.json` permissions match store listing claims
- [ ] `0.0.0` placeholder version replaced by CI stamp
- [ ] Release tag pushed
- [ ] CI pipeline passed all checks
