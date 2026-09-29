# Deployment Guide — Hynish ERP

**Last updated:** 2026-09-29  
**Stack:** Firebase Hosting + Cloud Functions v2 + Firestore + Storage + App Check

---

## Prerequisites

- Node.js 22 installed locally
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created (staging and production)
- GitHub repository secrets configured (see §3)
- Firebase CLI authenticated: `firebase login`

---

## §1  Environment Overview

| Environment | Purpose | Branch |
|-------------|---------|--------|
| Staging | Pre-production testing | Any feature branch |
| Production | Live business data | `main` |

Both environments use separate Firebase projects. The `FIREBASE_PROJECT_ID` secret selects the target project in CI.

---

## §2  GitHub Actions Workflows

### Continuous Integration (`ci.yml`)

Runs automatically on every push to `main` and on pull requests to `main`.

Jobs:
1. **lint-typecheck** — ESLint + TypeScript
2. **test** — Vitest unit tests
3. **build** — Production build of web app + functions
4. **security-audit** — `npm audit --audit-level=critical` + secret scan

CI must pass before merging to `main`.

### Deployment (`deploy.yml`)

Triggered manually from GitHub → Actions → Deploy → Run workflow.

Inputs:
- **environment:** `staging` or `production`
- **confirm_production:** must be exactly `DEPLOY` to allow production deployment

Steps executed:
1. Guard check (production requires confirmation)
2. Full build with real Firebase config from GitHub secrets
3. Deploy Firestore rules
4. Deploy Firestore indexes
5. Deploy Storage rules
6. Deploy Cloud Functions
7. Deploy Hosting

---

## §3  Required GitHub Secrets

Configure in GitHub → Repository → Settings → Secrets and variables → Actions.

For each environment (`staging`, `production`) create an **Environment** and add:

| Secret | Value |
|--------|-------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CI_TOKEN` | Firebase CI token (from `firebase login:ci`) |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `{project}.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `{project}.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key for App Check |
| `VITE_BUSINESS_ID` | Your business document ID in Firestore |

These are all **public Firebase SDK config values** — not service account keys. They are safe to include in the client bundle.

---

## §4  First Deployment (New Firebase Project)

### 4.1  Firebase Project Setup

```bash
firebase projects:list       # confirm project exists
firebase use {project-id}    # select project
```

### 4.2  Enable Firebase Services

In Firebase Console, enable:
- Authentication (Email/Password provider)
- Firestore (Native mode, region: asia-south1 or as appropriate)
- Cloud Storage
- Cloud Functions
- App Check (reCAPTCHA v3)
- Hosting

### 4.3  Deploy Rules and Indexes First

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4.4  Deploy Functions

```bash
npm run build --workspace functions
firebase deploy --only functions
```

### 4.5  Deploy Hosting

```bash
VITE_FIREBASE_API_KEY=... (set all VITE_ vars) npm run build --workspace apps/web
firebase deploy --only hosting
```

### 4.6  Seed Initial Data

After deploying functions, run these callables once from the Firebase console or your admin tool:

1. **`seedChartOfAccounts`** — creates the standard chart of accounts for the business
2. **`seedExpenseCategories`** — creates default expense categories

Both are idempotent; safe to run multiple times.

### 4.7  Create First Owner Member

Create the first user in Firebase Auth, then call **`createMember`** with `role: 'owner'` to provision their member document.

---

## §5  Subsequent Deployments

Use the GitHub Actions `deploy.yml` workflow. This is the recommended path for all deployments after initial setup.

**Manual deployment (emergency only):**

```bash
git pull origin main
npm ci
npm run build --workspace apps/web
npm run build --workspace functions
firebase deploy --project {project-id}
```

---

## §6  Rollback

### Hosting Rollback

Firebase Hosting keeps version history. To revert:

```bash
firebase hosting:rollback --project {project-id}
```

Or use Firebase Console → Hosting → Release history → Roll back.

### Functions Rollback

Re-deploy a previous build artifact:

```bash
# Checkout previous tag
git checkout {previous-tag}
npm ci && npm run build --workspace functions
firebase deploy --only functions --project {project-id}
```

### Rules Rollback

```bash
git revert {rules-commit}
firebase deploy --only firestore:rules --project {project-id}
```

---

## §7  Production Deployment Checklist

Before deploying to production:

- [ ] CI is green on `main`
- [ ] Staging deployment tested and smoke-checked
- [ ] Database backup created (`createBackupMetadata` called)
- [ ] If migrating: dry-run migration completed and report reviewed
- [ ] Team notified of maintenance window
- [ ] Rollback path confirmed

After deploying to production:

- [ ] Login works
- [ ] Dashboard loads
- [ ] New Invoice form opens (defaults to Without GST)
- [ ] Stock count shows correct levels
- [ ] Reports load (Trial Balance, P&L)
- [ ] Settings accessible for owner
- [ ] PWA manifest served at `/manifest.webmanifest`
- [ ] Service worker registered at `/sw.js`
- [ ] App Check telemetry shows passing requests in Firebase Console

---

## §8  App Check Configuration

App Check uses reCAPTCHA v3 in production. Debug tokens are supported for local development.

To add a debug token:
1. Set `VITE_APPCHECK_DEBUG_TOKEN=your-token` in `.env.local`
2. Add the token to Firebase Console → App Check → Apps → Manage debug tokens

Never commit debug tokens to source control.

---

## §9  Monitoring

- **Firebase Console → Functions → Logs** — function execution logs and errors
- **Firebase Console → Firestore → Usage** — read/write/delete metrics
- **Firebase Console → Hosting → Usage** — bandwidth and request counts
- **Error Reporter** — configured in `apps/web/src/lib/error-reporter.ts`; replace the no-op with a real provider (Sentry, Datadog) for production monitoring

---

## §10  Firestore Indexes

Composite indexes are defined in `firestore.indexes.json`. Deploy with:

```bash
firebase deploy --only firestore:indexes
```

New queries that require composite indexes will fail with a Firestore error that includes a link to create the required index. Add the index to `firestore.indexes.json` and redeploy.
