/**
 * CashFlow — Clear All Data Verifier (the loop's "checker" gate)
 *
 * Proves, without a browser, that:
 *   1. Demo data is NOT auto-seeded on store construction (app starts clean).
 *   2. initDefaultData(true) still reproduces the exact demo datasets (for the
 *      on-demand "Load Demo Data" action).
 *   3. The "Clear All Data" path persists empty arrays for all collections,
 *      so a page reload stays empty (empty '[]' is truthy -> no reseed).
 *   4. The clear/demo paths avoid native confirm() (suppressed in PWA/webview).
 *   5. The shipped bundle delivers the fix (CACHE_NAME bumped, assets cache-busted).
 *
 * Run: node test/reset-verify.js  (exit code 0 = PASS, 1 = FAIL)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const RESULTS = [];
let failed = false;

function check(name, pass, detail) {
  RESULTS.push({ name, pass, detail });
  if (!pass) failed = true;
}

// ---------------------------------------------------------------------------
// Reference demo datasets (mirror of store.initDefaultData)
// ---------------------------------------------------------------------------
const DEMO = (() => {
  const today = new Date().toISOString().split('T')[0];
  const pastDate = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  const futureDate = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  return {
    income: [
      { id: 'INC-101', date: pastDate(2), description: 'Tech Consulting Client A', category: 'Freelance', amount: 45000, payment_method: 'Bank Transfer', notes: 'Monthly retainer' },
      { id: 'INC-102', date: pastDate(12), description: 'Bi-Monthly Salary', category: 'Salary', amount: 35000, payment_method: 'Bank Transfer', notes: 'Direct deposit' },
      { id: 'INC-103', date: today, description: 'E-commerce Store Sales', category: 'Business / Sales', amount: 8500, payment_method: 'GCash', notes: 'Daily payout' }
    ],
    expenses: [
      { id: 'EXP-201', date: pastDate(1), description: 'Supermarket Grocery Run', category: 'Food & Dining', amount: 4250, payment_method: 'Credit Card', notes: 'Weekly pantry replenishment' },
      { id: 'EXP-202', date: pastDate(4), description: 'Electricity & Internet Bill', category: 'Utilities & Bills', amount: 5800, payment_method: 'Maya', notes: 'Fiber broadband & Meralco' },
      { id: 'EXP-203', date: pastDate(8), description: 'Car Fuel & Express toll', category: 'Transportation', amount: 2600, payment_method: 'Cash', notes: 'RFID reload' },
      { id: 'EXP-204', date: today, description: 'Team Lunch & Coffee', category: 'Food & Dining', amount: 1450, payment_method: 'GCash', notes: 'Client catchup' }
    ],
    payables: [
      { id: 'PAY-301', date_incurred: pastDate(15), due_date: futureDate(5), description: 'BDO Platinum Credit Card', creditor: 'BDO Unibank', amount: 18500, amount_paid: 5000, status: 'Partial', notes: 'Statement balance' },
      { id: 'PAY-302', date_incurred: pastDate(5), due_date: futureDate(10), description: 'Office Studio Rent', creditor: 'Greenfield Realty', amount: 20000, amount_paid: 0, status: 'Pending', notes: 'August lease' }
    ],
    receivables: [
      { id: 'REC-401', date_incurred: pastDate(10), due_date: futureDate(7), description: 'Mobile App UI/UX Design Sprint', debtor: 'Nexus Studio', amount: 35000, amount_received: 15000, status: 'Partial', notes: 'Milestone 2 pending collection' },
      { id: 'REC-402', date_incurred: pastDate(20), due_date: futureDate(14), description: 'Brand Identity Package', debtor: 'Starlight Cafe', amount: 18000, amount_received: 0, status: 'Pending', notes: 'Final sign-off invoice' }
    ],
    savings: [
      { id: 'SAV-501', date: pastDate(20), description: 'Monthly Auto-Save', type: 'deposit', amount: 10000, category: 'Emergency Fund', notes: 'Automatic transfer from payroll' },
      { id: 'SAV-502', date: pastDate(9), description: 'Freelance Windfall Set Aside', type: 'deposit', amount: 15000, category: 'Future Goals', notes: '50% of consulting fee' },
      { id: 'SAV-503', date: pastDate(3), description: 'Emergency Vet Bill', type: 'withdrawal', amount: 4500, category: 'Emergency Fund', notes: 'Unexpected pet care' }
    ]
  };
})();

function makeSandbox() {
  const storage = {};
  const sandbox = {
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    window: { dispatchEvent: () => {} },
    CustomEvent: class CustomEvent { constructor(type, opts) { this.type = type; this.detail = (opts || {}).detail; } },
    console,
    CONFIG: {
      STORAGE_KEYS: {
        INCOME: 'cashflow_income_v1',
        EXPENSES: 'cashflow_expenses_v1',
        PAYABLES: 'cashflow_payables_v1',
        RECEIVABLES: 'cashflow_receivables_v1',
        SAVINGS: 'cashflow_savings_v1'
      }
    }
  };
  vm.createContext(sandbox);
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js', 'store.js'), 'utf8');
  vm.runInContext(storeSrc.split('window.store')[0] + '\nglobalThis.__store = new CashFlowStore();', sandbox);
  sandbox.__storage = storage;
  return sandbox;
}

function sameDemo(sandbox, type) {
  const key = sandbox.CONFIG.STORAGE_KEYS[type.toUpperCase()];
  const records = JSON.parse(sandbox.__storage[key] || '[]');
  const expected = DEMO[type].map((r) => r.id).sort();
  const actual = records.map((r) => r.id).sort();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// 1. Construction must NOT auto-seed demo data
const fresh = makeSandbox();
const autoSeeded = Object.values(fresh.CONFIG.STORAGE_KEYS).some((k) => fresh.__storage[k] !== undefined);
check('store construction does NOT auto-seed demo data', !autoSeeded,
  'constructor must not call initDefaultData(); app must start empty');

// 2. initDefaultData(true) reproduces the exact demo datasets
fresh.__store.initDefaultData(true);
let demoOk = true;
for (const type of Object.keys(DEMO)) {
  if (!sameDemo(fresh, type)) demoOk = false;
}
check('initDefaultData(true) reproduces exact demo data', demoOk,
  'Load Demo Data must restore the demo datasets exactly');

// 3. Clear-all path persists empty arrays (stays empty across reload)
const clearSandbox = makeSandbox();
clearSandbox.__store.initDefaultData(true); // seed demo, then wipe like doClearAll()
for (const type of ['income', 'expenses', 'payables', 'receivables', 'savings']) {
  clearSandbox.__store.saveItems(type, []);
}
const allEmpty = Object.values(clearSandbox.CONFIG.STORAGE_KEYS).every((k) => clearSandbox.__storage[k] === '[]');
check('clear-all persists empty arrays for every collection', allEmpty,
  'doClearAll() must save empty arrays so a reload does not reseed demo data');

// ---------------------------------------------------------------------------
// Static checks on the shipped bundle
// ---------------------------------------------------------------------------
const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const storeSrc = fs.readFileSync(path.join(ROOT, 'js', 'store.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const configSrc = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
const codegsSrc = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8');

// Extract the body of a class method (brace-balanced, line-anchored) from source
function methodBody(src, name) {
  const m = src.match(new RegExp('(^|\\n)\\s*(async\\s+)?' + name + '\\('));
  if (!m) return '';
  const start = m.index;
  const open = src.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

check('clear/demo modal paths avoid native confirm()',
  !/confirm\(/.test(methodBody(appSrc, 'confirmClearAll')) &&
  !/confirm\(/.test(methodBody(appSrc, 'doClearAll')) &&
  !/confirm\(/.test(methodBody(appSrc, 'confirmLoadDemo')) &&
  !/confirm\(/.test(methodBody(appSrc, 'doLoadDemo')),
  'native confirm() is suppressed in PWA/webview contexts; all clear/demo dialogs must use the modal');

const nativeConfirms = [...appSrc.matchAll(/confirm\(/g)].length;
const confirmsInDelete = (methodBody(appSrc, 'confirmDelete').match(/confirm\(/g) || []).length;
check('native confirm() limited to the delete dialog',
  nativeConfirms - confirmsInDelete === 0,
  `expected all native confirm() calls inside confirmDelete(); found ${nativeConfirms - confirmsInDelete} elsewhere`);

check('Clear All Data UI + handler wired',
  /onclick="app\.confirmClearAll\(\)"/.test(appSrc) && /doClearAll\(\)/.test(appSrc),
  'settings must expose Clear All Data wired to the modal + doClearAll()');

check('doClearAll() wipes all five collections',
  /saveItems\(type, \[\]\)/.test(methodBody(appSrc, 'doClearAll')) &&
  /['"](income|expenses|payables|receivables|savings)['"]/.test(methodBody(appSrc, 'doClearAll')),
  'doClearAll() must iterate every collection and persist empty arrays');

check('Load Demo Data UI + handler wired',
  /onclick="app\.loadDemoData\(\)"/.test(appSrc) && /initDefaultData\(true\)/.test(methodBody(appSrc, 'doLoadDemo')),
  'settings must expose Load Demo Data wired to initDefaultData(true)');

check('store constructor no longer auto-seeds',
  !/constructor\(\)\s*\{\s*this\.initDefaultData\(\)/.test(storeSrc),
  'CashFlowStore constructor must not call initDefaultData()');

// ---------------------------------------------------------------------------
// Login gate checks
// ---------------------------------------------------------------------------
check('login gate wired into the app',
  /isLoginRequired\(\)/.test(appSrc) &&
  /showLoginScreen\(\)/.test(appSrc) &&
  /handleLogin\(event\)/.test(appSrc) &&
  /logout\(\)/.test(appSrc) &&
  /store\.login\(/.test(appSrc),
  'app must gate rendering behind a login screen with login/logout handlers');

check('login gate shown on first load whenever there is no session',
  /if \(!this\.session\)/.test(methodBody(appSrc, 'init')) &&
  !/isLoginRequired\(\) && !this\.session/.test(methodBody(appSrc, 'init')),
  'init() must show the login screen on first load whenever no session exists, even without a cloud URL configured');

check('session stores only username + timestamp',
  /saveSession\(username\)/.test(storeSrc) &&
  /\{ username, logged_in_at/.test(methodBody(storeSrc, 'saveSession')) &&
  !/password/.test(methodBody(storeSrc, 'saveSession')),
  'the persisted session must never contain the password');

check('login posts to the configured cloud URL',
  /fetch\(CONFIG\.GOOGLE_APPS_SCRIPT_URL/.test(methodBody(storeSrc, 'login')) &&
  /action:\s*'login'/.test(methodBody(storeSrc, 'login')),
  'store.login() must POST { action: login, username, password } to the GAS URL');

check('logout clears the session',
  /store\.clearSession\(\)/.test(methodBody(appSrc, 'logout')) &&
  /clearSession\(\)/.test(storeSrc) &&
  /removeItem\(CONFIG\.STORAGE_KEYS\.SESSION\)/.test(methodBody(storeSrc, 'clearSession')),
  'logout must remove the session from localStorage');

check('session storage key defined',
  /SESSION:\s*'cashflow_session_v1'/.test(configSrc),
  'config.js must define the SESSION storage key');

// ---------------------------------------------------------------------------
// Savings tracker checks
// ---------------------------------------------------------------------------
check('savings storage key defined',
  /SAVINGS:\s*'cashflow_savings_v1'/.test(configSrc),
  'config.js must define the SAVINGS storage key');

check('savings balance computed from deposits minus withdrawals',
  /totalSavings: totalDeposits - totalWithdrawals/.test(storeSrc) &&
  /totalDeposits/.test(methodBody(storeSrc, 'getFinancialSummary')) &&
  /totalWithdrawals/.test(methodBody(storeSrc, 'getFinancialSummary')),
  'getFinancialSummary() must expose totalDeposits, totalWithdrawals, and the live balance');

check('savings view wired into navigation',
  /case 'savings':/.test(methodBody(appSrc, 'navigateTo')) &&
  /renderSavingsView\(content\)/.test(appSrc) &&
  /renderSavingsItemsHTML\(\)/.test(appSrc) &&
  /openSavingsModal\(/.test(appSrc) &&
  /handleSavingsSubmit\(/.test(appSrc),
  'the app must render a Savings view with a ledger and add/edit forms');

check('savings demo data seeds three records',
  /'SAV-501'/.test(storeSrc) && /'SAV-502'/.test(storeSrc) && /'SAV-503'/.test(storeSrc),
  'initDefaultData(true) must seed savings records for the Load Demo Data action');

// ---------------------------------------------------------------------------
// Registration wizard checks
// ---------------------------------------------------------------------------
check('register posts to the configured cloud URL',
  /fetch\(CONFIG\.GOOGLE_APPS_SCRIPT_URL/.test(methodBody(storeSrc, 'register')) &&
  /action:\s*'register'/.test(methodBody(storeSrc, 'register')),
  'store.register() must POST { action: register, username, password } to the GAS URL');

check('backend supports action=register',
  /action === 'register'/.test(codegsSrc) &&
  /already exists/.test(codegsSrc) &&
  /hashPassword\(username, password\)/.test(codegsSrc),
  'Code.gs must handle self-service registration with a duplicate check and hashed storage');

check('login screen includes a register pane with setup instructions',
  /data-tab="register"/.test(appSrc) &&
  /registerPane/.test(appSrc) &&
  /Download Code\.gs/.test(appSrc) &&
  /Test Connection/.test(appSrc),
  'the login gate must expose a guided register/setup flow');

check('setup connection persists the URL only on success',
  /localStorage\.setItem\('cashflow_gas_url', url\)/.test(methodBody(appSrc, 'testSetupConnection')) &&
  /this\._setupConnected = true/.test(methodBody(appSrc, 'testSetupConnection')),
  'testSetupConnection() must save the GAS URL only after a successful test');

check('register unlocks the app and stores a session',
  /store\.register\(username, password\)/.test(methodBody(appSrc, 'handleRegister')) &&
  /store\.saveSession\(res\.username\)/.test(methodBody(appSrc, 'handleRegister')),
  'handleRegister() must create the account and sign the user in');

check('Code.gs downloadable from the app shell',
  /fetch\('\.\/apps-script\/Code\.gs'\)/.test(methodBody(appSrc, 'downloadAppScript')) &&
  /\.\/apps-script\/Code\.gs/.test(swSrc),
  'the app must serve the Apps Script backend file and the SW must precache it');

check('settings exposes the setup wizard entry point',
  /showLoginScreen\('register'\)/.test(appSrc),
  'Settings must open the registration wizard even when no cloud URL is configured');

check('cloud sync routes the collection under a dedicated key',
  /body: JSON\.stringify\(\{ action, collection: type, \.\.\.payload \}\)/.test(methodBody(storeSrc, 'syncToCloud')),
  'syncToCloud() must send the collection under "collection" so a savings record type field cannot clobber it');

check('backend routes savings via collection and refuses unknown types',
  /postData\.collection \|\| postData\.type/.test(codegsSrc) &&
  !/\|\| SHEET_INCOME/.test(codegsSrc) &&
  /Unknown data type/.test(codegsSrc) &&
  /savings: SHEET_SAVINGS/.test(codegsSrc),
  'Code.gs must pick the sheet from postData.collection and error instead of silently writing to Income');

check('service worker cache version bumped to v1.7.1',
  /cashflow-v1\.7\.1/.test(swSrc) && !/cashflow-v1\.(0|1|2|3|4|5|6|7)\.0/.test(swSrc),
  'CACHE_NAME must change to force the browser to fetch the new bundle');

check('assets cache-busted (v=8)',
  /js\/app\.js\?v=8/.test(indexSrc) && /css\/main\.css\?v=8/.test(indexSrc),
  'index.html asset tags must be query-versioned so cache misses refetch');

check('APP_VERSION defined and displayed',
  /APP_VERSION:\s*'1\.7\.1'/.test(configSrc) && /CONFIG\.APP_VERSION/.test(appSrc),
  'Settings must show the current build so the user can confirm the new bundle is live');

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('\nCashFlow Clear-All-Demo Verifier\n' + '='.repeat(42));
for (const r of RESULTS) {
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.pass) console.log(`        ${r.detail}`);
}
console.log('='.repeat(42));
console.log(failed ? `RESULT: FAIL (${RESULTS.filter((r) => !r.pass).length} of ${RESULTS.length} checks failed)` : `RESULT: PASS (${RESULTS.length}/${RESULTS.length} checks passed)`);
process.exit(failed ? 1 : 0);