/**
 * CashFlow — End-to-end tests for Clear All Data / Load Demo Data / login-first.
 *
 * Proves in a real browser that:
 *   - the app starts clean (no auto-seeded demo rows);
 *   - the app always lands on the login screen first when no session exists;
 *   - "Clear All Data" wipes every collection and stays empty after a reload;
 *   - "Load Demo Data" restores the exact demo datasets on demand;
 *   - the from/to date filter narrows the transaction list;
 *   - the login gate blocks the app until credentials are verified;
 *   - registration is reachable from the login page's Register tab.
 *
 * Uses a clean context per run (service workers blocked) so it tests the
 * served app code deterministically.
 */

'use strict';

const { test, expect } = require('@playwright/test');

const DEMO_IDS = {
  income: ['INC-101', 'INC-102', 'INC-103'],
  expenses: ['EXP-201', 'EXP-202', 'EXP-203', 'EXP-204'],
  payables: ['PAY-301', 'PAY-302'],
  receivables: ['REC-401', 'REC-402'],
  savings: ['SAV-501', 'SAV-502', 'SAV-503']
};

async function readStore(page, type) {
  return page.evaluate((t) => {
    const raw = localStorage.getItem(`cashflow_${t}_v1`);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }, type);
}

async function openSettings(page) {
  await page.locator('[data-nav="settings"]').first().click();
}

// Login-first mode: a session is required before the app renders. These
// helpers open the app as a signed-in user (pre-seeded session) so the
// data-focused tests exercise the app instead of the gate.
async function gotoWithSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('cashflow_session_v1', JSON.stringify({ username: 'demo', logged_in_at: new Date().toISOString() }));
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.app && window.store);
}

async function gotoWithoutSession(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => window.app && window.store);
}

test('first load without a session shows the login screen even with no cloud URL', async ({ page }) => {
  await gotoWithoutSession(page);
  const login = LOGIN_SCREEN(page);
  await expect(login).toBeVisible();
  await expect(login).toContainText('Sign in to continue');
  // No backend configured yet -> the hint steers first-timers to Register
  await expect(login).toContainText('No backend connected yet');
  // App views are not rendered behind the gate
  await expect(page.locator('.metrics-grid')).toHaveCount(0);
  const session = await page.evaluate(() => localStorage.getItem('cashflow_session_v1'));
  expect(session).toBeNull();
});

test('app starts with no demo data', async ({ page }) => {
  await gotoWithSession(page);
  for (const type of Object.keys(DEMO_IDS)) {
    const records = await readStore(page, type);
    expect(records, `${type} must start empty`).toEqual([]);
  }
});

test('Clear All Data wipes everything and stays empty after reload', async ({ page }) => {
  await gotoWithSession(page);

  // Seed user + demo data first so there is something to clear
  await page.evaluate(() => {
    window.store.addItem('income', { date: '2026-01-05', description: 'My custom income', category: 'Salary', amount: 500, payment_method: 'Cash' });
    window.store.initDefaultData(true);
  });
  expect((await readStore(page, 'income')).length).toBeGreaterThan(0);

  // Settings -> Clear All Data -> confirm
  await openSettings(page);
  await page.getByRole('button', { name: 'Clear All Data' }).click();
  const modal = page.locator('.modal-backdrop.open');
  await expect(modal).toBeVisible();
  await page.getByRole('button', { name: 'Clear Everything' }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator('.toast.toast-success')).toContainText('All data cleared');

  // Every collection is empty
  for (const type of Object.keys(DEMO_IDS)) {
    const records = await readStore(page, type);
    expect(records, `${type} must be empty after clear`).toEqual([]);
  }

  // Reload -> still empty (empty arrays persist; demo data must NOT come back)
  await page.reload();
  await page.waitForFunction(() => window.app && window.store);
  for (const type of Object.keys(DEMO_IDS)) {
    const records = await readStore(page, type);
    expect(records, `${type} must stay empty after reload`).toEqual([]);
  }
});

test('Load Demo Data restores the demo datasets on demand', async ({ page }) => {
  await gotoWithSession(page);

  // User data present, then load demo (overwrites)
  await page.evaluate(() => window.store.addItem('income', { date: '2026-01-05', description: 'My custom income', category: 'Salary', amount: 500, payment_method: 'Cash' }));
  await openSettings(page);
  await page.getByRole('button', { name: 'Load Demo Data' }).click();
  const modal = page.locator('.modal-backdrop.open');
  await expect(modal).toBeVisible();
  await page.getByRole('button', { name: 'Load Demo', exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator('.toast.toast-success')).toContainText('Demo data loaded');

  for (const type of Object.keys(DEMO_IDS)) {
    const records = await readStore(page, type);
    expect(records.map((r) => r.id).sort(), `${type} must equal demo dataset`).toEqual([...DEMO_IDS[type]].sort());
    expect(records.some((r) => String(r.description || '').startsWith('My custom')), `${type} must not contain user data`).toBe(false);
  }
});

test('from/to date filter narrows the income list', async ({ page }) => {
  await gotoWithSession(page);

  // Demo income dates: INC-101 = 2 days ago, INC-102 = 12 days ago, INC-103 = today
  await page.evaluate(() => window.store.initDefaultData(true));
  await page.locator('[data-nav="income"]').first().click();
  await expect(page.locator('.tx-card')).toHaveCount(3);

  // From = today => only today's record (INC-103) remains
  const today = await page.evaluate(() => new Date().toISOString().split('T')[0]);
  await page.getByTitle('From date').fill(today);
  await expect(page.locator('.tx-card')).toHaveCount(1);

  // Widen: from 30 days ago, to today => all 3
  const past = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  await page.getByTitle('From date').fill(past);
  await page.getByTitle('To date').fill(today);
  await expect(page.locator('.tx-card')).toHaveCount(3);
});

test('savings deposit/withdrawal updates balance, persists, edits, and deletes', async ({ page }) => {
  await gotoWithSession(page);

  await page.locator('[data-nav="savings"]').first().click();
  await expect(page.locator('.stat-card.savings-card')).toContainText('₱0.00');
  const ledger = page.locator('.section-card').filter({ hasText: 'Savings Ledger' });

  // Deposit
  await ledger.getByRole('button', { name: 'Deposit' }).click();
  await page.locator('.modal-backdrop.open').locator('input[name="amount"]').fill('1000');
  await page.locator('.modal-backdrop.open').locator('input[name="description"]').fill('Deposit test');
  await page.locator('.modal-backdrop.open').getByRole('button', { name: 'Add Record' }).click();
  await expect(page.locator('.toast.toast-success').filter({ hasText: 'Deposit recorded' })).toBeVisible();
  await expect(page.locator('.stat-card.savings-card')).toContainText('₱1,000.00');

  // Withdrawal
  await ledger.getByRole('button', { name: 'Withdraw' }).click();
  await page.locator('.modal-backdrop.open').locator('input[name="amount"]').fill('300');
  await page.locator('.modal-backdrop.open').locator('input[name="description"]').fill('Withdraw test');
  await page.locator('.modal-backdrop.open').getByRole('button', { name: 'Add Record' }).click();
  await expect(page.locator('.toast.toast-success').filter({ hasText: 'Withdrawal recorded' })).toBeVisible();
  await expect(page.locator('.stat-card.savings-card')).toContainText('₱700.00');

  // Reload persists the balance
  await page.reload();
  await page.waitForFunction(() => window.app && window.store);
  await page.locator('[data-nav="savings"]').first().click();
  await expect(page.locator('.stat-card.savings-card')).toContainText('₱700.00');

  // Edit the deposit
  await page.locator('.tx-card').filter({ hasText: 'Deposit test' }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('.modal-backdrop.open').locator('input[name="description"]').fill('Edited deposit');
  await page.locator('.modal-backdrop.open').getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('.tx-card').filter({ hasText: 'Edited deposit' })).toBeVisible();

  // Delete the withdrawal
  page.once('dialog', (d) => d.accept());
  await page.locator('.tx-card').filter({ hasText: 'Withdraw test' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.tx-card').filter({ hasText: 'Withdraw test' })).toHaveCount(0);
  await expect(page.locator('.stat-card.savings-card')).toContainText('₱1,000.00');
});

// ---------------------------------------------------------------------------
// Login gate (cloud-configured mode; mock GAS backend serves /mock-gas/exec)
// ---------------------------------------------------------------------------
const MOCK_GAS_URL = 'http://127.0.0.1:4173/mock-gas/exec';
const LOGIN_SCREEN = page => page.locator('.login-screen');

async function gotoWithCloud(page) {
  await page.addInitScript((url) => {
    localStorage.setItem('cashflow_gas_url', url);
  }, MOCK_GAS_URL);
  await page.goto('/index.html');
  await page.waitForFunction(() => window.app && window.store);
}

test('cloud configured + no session -> login screen blocks the app', async ({ page }) => {
  await gotoWithCloud(page);
  const login = LOGIN_SCREEN(page);
  await expect(login).toBeVisible();
  await expect(login).toContainText('Sign in to continue');
  // App views are not rendered behind the gate
  await expect(page.locator('.metrics-grid')).toHaveCount(0);
  // Nothing stored yet
  const session = await page.evaluate(() => localStorage.getItem('cashflow_session_v1'));
  expect(session).toBeNull();
});

test('wrong password keeps the login gate locked', async ({ page }) => {
  await gotoWithCloud(page);
  const login = LOGIN_SCREEN(page);
  await login.locator('input[name="username"]').fill('demo');
  await login.locator('input[name="password"]').fill('wrongpass');
  await login.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('.toast.toast-error')).toContainText('Invalid username or password.');
  await expect(LOGIN_SCREEN(page)).toBeVisible();
  const session = await page.evaluate(() => localStorage.getItem('cashflow_session_v1'));
  expect(session).toBeNull();
});

test('correct credentials unlock the app and persist a session', async ({ page }) => {
  await gotoWithCloud(page);
  const login = LOGIN_SCREEN(page);
  await login.locator('input[name="username"]').fill('demo');
  await login.locator('input[name="password"]').fill('demo123');
  await login.getByRole('button', { name: 'Sign In', exact: true }).click();

  await expect(page.locator('.toast.toast-success')).toContainText('Welcome back, demo!');
  await expect(LOGIN_SCREEN(page)).toBeHidden();
  await expect(page.locator('.metrics-grid')).toBeVisible();

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('cashflow_session_v1')));
  expect(session.username).toBe('demo');
  expect(session.logged_in_at).toBeTruthy();
  expect(Object.keys(session).sort()).toEqual(['logged_in_at', 'username']);
});

test('reload keeps the user signed in', async ({ page }) => {
  await gotoWithCloud(page);
  const login = LOGIN_SCREEN(page);
  await login.locator('input[name="username"]').fill('admin');
  await login.locator('input[name="password"]').fill('cashflow');
  await login.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('.metrics-grid')).toBeVisible();

  await page.reload();
  await page.waitForFunction(() => window.app && window.store);
  await expect(LOGIN_SCREEN(page)).toBeHidden();
  await expect(page.locator('.metrics-grid')).toBeVisible();
});

test('Logout returns to the login screen and clears the session', async ({ page }) => {
  await gotoWithCloud(page);
  const login = LOGIN_SCREEN(page);
  await login.locator('input[name="username"]').fill('demo');
  await login.locator('input[name="password"]').fill('demo123');
  await login.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('.metrics-grid')).toBeVisible();

  // Settings shows the signed-in user + Logout
  await page.locator('[data-nav="settings"]').first().click();
  await expect(page.locator('.section-card').filter({ hasText: 'App Information & Backup' })).toContainText('Signed in as');
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(LOGIN_SCREEN(page)).toBeVisible();
  const session = await page.evaluate(() => localStorage.getItem('cashflow_session_v1'));
  expect(session).toBeNull();
});

test('savings deposits sync to the Savings collection, not Income', async ({ page }) => {
  await gotoWithCloud(page);
  const login = LOGIN_SCREEN(page);
  await login.locator('input[name="username"]').fill('demo');
  await login.locator('input[name="password"]').fill('demo123');
  await login.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('.metrics-grid')).toBeVisible();

  // Add a savings deposit through the UI
  await page.locator('[data-nav="savings"]').first().click();
  const ledger = page.locator('.section-card').filter({ hasText: 'Savings Ledger' });
  await ledger.getByRole('button', { name: 'Deposit' }).click();
  await page.locator('.modal-backdrop.open').locator('input[name="amount"]').fill('2500');
  await page.locator('.modal-backdrop.open').locator('input[name="description"]').fill('Cloud routed deposit');
  await page.locator('.modal-backdrop.open').getByRole('button', { name: 'Add Record' }).click();
  await expect(page.locator('.toast.toast-success').filter({ hasText: 'Deposit recorded' })).toBeVisible();

  // Wait for the fire-and-forget cloud POST to land in the mock "Savings" sheet
  await page.waitForFunction(async (url) => {
    const res = await fetch(`${url}?action=fetchAll`);
    const data = await res.json();
    return data.success && data.savings.some((r) => r.description === 'Cloud routed deposit');
  }, MOCK_GAS_URL);

  // Pull cloud data back down: the record must land in savings, NOT income
  const pulled = await page.evaluate(() => window.store.pullFromCloud());
  expect(pulled).toBe(true);
  const localSavings = await readStore(page, 'savings');
  expect(localSavings.some((r) => r.description === 'Cloud routed deposit')).toBe(true);
  const localIncome = await readStore(page, 'income');
  expect(localIncome.some((r) => r.description === 'Cloud routed deposit')).toBe(false);

  // The mock backend itself must have routed it to Savings, never Income
  const cloud = await page.evaluate(async (url) => (await (await fetch(`${url}?action=fetchAll`)).json()), MOCK_GAS_URL);
  expect(cloud.income.some((r) => r.description === 'Cloud routed deposit')).toBe(false);
});

// ---------------------------------------------------------------------------
// Registration / setup wizard (works even with no cloud URL configured)
// ---------------------------------------------------------------------------
// Registration lives on the login screen's Register tab. First load always
// lands on login (login-first), so the wizard is one tab click away.
async function openSetupWizard(page) {
  await gotoWithoutSession(page);
  const login = LOGIN_SCREEN(page);
  await expect(login).toBeVisible();
  await login.locator('[data-tab="register"]').click();
  await expect(login.locator('#registerPane')).toBeVisible();
  return login;
}

test('register flow: connection test then create account unlocks the app', async ({ page }) => {
  const login = await openSetupWizard(page);

  // Registration is locked until the connection test passes
  await expect(login.locator('#registerForm')).toHaveClass(/setup-locked/);

  // Paste mock URL + Test Connection
  await login.locator('#setupGasUrlInput').fill(MOCK_GAS_URL);
  await login.locator('#setupTestBtn').click();
  await expect(page.locator('.toast.toast-success')).toContainText('Connected Successfully');
  await expect(login.locator('#registerForm')).not.toHaveClass(/setup-locked/);

  // Register a unique user
  const username = `reg_${Date.now()}`;
  await login.locator('input[name="reg_username"]').fill(username);
  await login.locator('input[name="reg_password"]').fill('secret123');
  await login.locator('input[name="reg_confirm"]').fill('secret123');
  await login.getByRole('button', { name: 'Create Account & Sign In' }).click();

  await expect(page.locator('.toast.toast-success').filter({ hasText: `Welcome, ${username}!` })).toBeVisible();
  await expect(LOGIN_SCREEN(page)).toBeHidden();
  await expect(page.locator('.metrics-grid')).toBeVisible();

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('cashflow_session_v1')));
  expect(session.username).toBe(username);
  const savedUrl = await page.evaluate(() => localStorage.getItem('cashflow_gas_url'));
  expect(savedUrl).toBe(MOCK_GAS_URL);
});

test('register rejects an existing username', async ({ page }) => {
  const login = await openSetupWizard(page);
  await login.locator('#setupGasUrlInput').fill(MOCK_GAS_URL);
  await login.locator('#setupTestBtn').click();
  await expect(login.locator('#registerForm')).not.toHaveClass(/setup-locked/);

  await login.locator('input[name="reg_username"]').fill('demo');
  await login.locator('input[name="reg_password"]').fill('whatever1');
  await login.locator('input[name="reg_confirm"]').fill('whatever1');
  await login.getByRole('button', { name: 'Create Account & Sign In' }).click();

  await expect(page.locator('.toast.toast-error')).toContainText('already exists');
  await expect(LOGIN_SCREEN(page)).toBeVisible();
  const session = await page.evaluate(() => localStorage.getItem('cashflow_session_v1'));
  expect(session).toBeNull();
});

test('Download Code.gs triggers a file download', async ({ page }) => {
  const login = await openSetupWizard(page);
  const downloadPromise = page.waitForEvent('download');
  await login.getByRole('button', { name: 'Download Code.gs' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Code.gs');
});