# 💰 CashFlow — PWA Deployment Guide

CashFlow is an offline-first Progressive Web App for tracking **Income**, **Expenses**, **Savings**, **Payables**, and **Receivables** (PHP currency). It works entirely in the browser with `localStorage`, and can optionally sync to a private **Google Spreadsheet** via a Google Apps Script backend.

> Current build: **v1.7.1** — starts on a **login screen** on first load; sign in or use the **Register** tab to set up your own Google backend and create an account. Once signed in, the app starts empty; use *Clear All Data* to wipe records and *Load Demo Data* for samples.

Deployment has **two independent parts**:

1. **Frontend** — the static PWA (14 files), hosted on **GitHub Pages** or **Cloudflare Pages** (or any static host).
2. **Backend (optional)** — Google Sheets + Apps Script, for cloud sync.

---

## 1. Files you need to upload

Deploy these **exact files** to the root of your static host. Keep the folder structure as-is:

```
index.html              # App shell (loads everything)
manifest.json           # PWA manifest
sw.js                   # Service worker (offline caching)
css/
  main.css
  components.css
  responsive.css
js/
  config.js             # Currency, categories, payment methods, GAS URL
  store.js              # localStorage + cloud sync
  charts.js             # Chart.js graphs
  app.js                # UI / navigation / forms
  pwa.js                # Service worker registration + install
icons/
  icon-192.png
  icon-512.png
apps-script/
  Code.gs              # Google Apps Script backend (downloaded from the app for setup)
```

### Files you should NOT upload

| Path | Why it's excluded |
|------|-------------------|
| `node_modules/`, `package.json`, `package-lock.json`, `playwright.config.js` | Development / test dependencies only — not needed at runtime |
| `test/`, `test-results/` | Test harness (`npm test`) — not part of the app |
| `apps-script/README.md` | Setup guide only — the backend `Code.gs` *is* uploaded (it's downloaded from the app for new users) |
| `pages/`, `partials/` | Unused placeholders from the original spec — the app renders views from `js/app.js` |
| `AGENTS.md`, `WORKFLOW.md`, `generate-icons.js`, `.gitignore`, `README.md` | Docs / dev utilities |

> 💡 **Tip:** if you copy the whole project folder, just drag only the files listed in §1 into your host, or use a `.gitignore`/build filter to keep dev files out of the published branch.

---

## 2. Deploy the frontend

Both GitHub Pages and Cloudflare Pages serve over HTTPS automatically, which the service worker **requires** (PWA install + offline mode). The app uses relative paths (`./`), so it also works on subpaths (e.g. `https://user.github.io/repo/`).

### Option A — GitHub Pages

1. Push the project to a GitHub repository (`main` branch).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, folder `/` (root)
4. Click **Save**. GitHub builds and publishes the site at:
   `https://<your-username>.github.io/<repository-name>/`
5. Visit the URL — the app should load and installable as a PWA.

### Option B — Cloudflare Pages

**Direct Upload (fastest):**
1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Upload assets**.
2. Drag-and-drop a folder containing **only the 14 files from §1**.
3. Cloudflare generates a URL like `https://<project>.pages.dev`.

**Connect Git repo:**
1. **Workers & Pages → Create → Pages → Connect to Git** and pick your repo.
2. Build settings:
   - **Framework preset**: `None`
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/`
3. Save — every push to the repo redeploys automatically.

---

## 3. Deploy the Google Sheets backend (optional, for cloud sync)

Full walkthrough in [`apps-script/README.md`](./apps-script/README.md). Condensed:

1. Create a Google Spreadsheet (e.g. `CashFlow Database`).
2. Open **Extensions → Apps Script**, delete the sample code, and paste the entire contents of `apps-script/Code.gs`.
3. In the toolbar, select the function **`setupSheets`** and click **Run** (authorize if prompted). This creates the `Income`, `Expenses`, `Savings`, `Payables`, `Receivables`, and `Users` tabs.
4. Click **Deploy → New deployment → Web app**:
   - **Execute as**: `Me (<your-email>)`
   - **Who has access**: `Anyone` *(required so the PWA can read/write)*
5. Copy the generated **Web App URL** (`https://script.google.com/macros/s/.../exec`).

### 3.1 Create login users

Two ways to create accounts (passwords are stored as **SHA-256 hashes**, never plaintext):

**A) From the app (recommended for new users):** Open the login screen → **Register** tab → download `Code.gs`, follow the guided setup steps, paste your URL, **Test Connection**, then create your username and password. The account is written to *your own* sheet's `Users` tab.

**B) In the Apps Script editor (admin / extra users):**
1. Select the function **`addUser`** in the toolbar.
2. Type the username and password in the **Arguments** box, e.g. `addUser("admin", "s3cretpass")` and click **Run**.
3. Repeat for each user. Remove a user later with `removeUser("username")`.
4. **Do not type passwords straight into the sheet** — always use `addUser()` so they get hashed.

> 🔐 **Security note:** the login page gates the UI, not the API. Anyone who obtains the Apps Script URL could still call the data endpoints directly — keep the URL private. The spreadsheet itself stays private (only the web app URL is shared).

---

## 4. Connect the app and verify

1. Open your deployed URL.
2. On first load the app opens on the **login screen** (login is always required) — sign in, or use the **Register** tab to set up your own backend and create an account.
3. Go to **Settings & Cloud** (or click ⚙️ in the header).
4. Paste the Web App URL into **Google Apps Script Web App URL** → **Save Settings**.
5. Verify the build label in Settings reads **`v1.7.1`** (confirms you're on the new bundle, not a stale cached one).
6. On mobile, use the browser menu → **Add to Home Screen** to install the PWA, then test it offline.

> The app starts **empty**. Use **Load Demo Data** (Settings) if you want sample transactions, and **Clear All Data** to wipe everything permanently.

---

## 5. Shipping updates later

The service worker caches aggressively (cache-first). On every release:

1. **Bump `CACHE_NAME`** in `sw.js` (e.g. `cashflow-v1.6.0` → `v1.7.0`).
2. **Bump the asset tags** in `index.html` (e.g. `?v=6` → `?v=7`).
3. Redeploy.
4. When users open the app, it installs the new service worker and auto-reloads onto the new build ("New version available — reloading…"). If it doesn't auto-reload, do one hard refresh (Ctrl/Cmd+F5).

---

## 6. Local development & testing (optional)

```bash
npm install          # installs Playwright test runner (dev only)
npm test             # runs the node verifier + Playwright end-to-end tests
node test/static-server.js   # serves the app locally at http://127.0.0.1:4173
```

`npm test` verifies the core guarantees (app starts empty, Clear All Data stays empty after reload, Load Demo Data restores samples, date filters work).

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| I still see old demo/transaction data | Settings → **Clear All Data** → confirm. (Demo data is never auto-seeded anymore.) |
| Login page keeps rejecting my credentials | Create the user via the **Register** tab on the login screen, or `addUser()` in Apps Script (§3.1) — don't type the password into the sheet; passwords are stored hashed. |
| Signed out unexpectedly | The session is stored locally and lasts until you hit **Logout**; logging in again requires network access to the Apps Script URL. |
| Changes don't appear after deploying an update | Hard refresh (Ctrl/Cmd+F5); if that fails, DevTools → **Application → Service Workers → Unregister**, then reload. |
| **Test Connection** fails / CORS error | Re-deploy the Apps Script with **Who has access: Anyone**; confirm the URL is `.../exec` (not `.../dev`). |
| `setupSheets` authorization error | Run it once from the Apps Script toolbar and approve the Google permissions. |
| Data (expenses, payables, savings, receivables) appears under Income after syncing | You're on an old backend. Re-deploy **v1.7.1**'s `Code.gs` (it routes each collection to its own sheet), then delete any misrouted rows (ids like `EXP-…`, `SAV-…`, `PAY-…`, `REC-…`) from the **Income** tab of your spreadsheet. |
| PWA "Install" button missing | Site must be served over **HTTPS** and loaded more than once; install is available on mobile via the browser menu. |