/**
 * CashFlow — Minimal static file server for end-to-end tests.
 * Serves the project root over HTTP so the PWA, service worker, and
 * localStorage behave like a real deployment. No dependencies.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

// Mock Google Apps Script backend for end-to-end tests.
// Mirrors the login/register contract in apps-script/Code.gs (SHA-256 of username|password)
// and the collection routing (savings -> Savings, etc.).
const MOCK_USERS = [
  { username: 'demo', passwordHash: hashSha256('demo|demo123') },
  { username: 'admin', passwordHash: hashSha256('admin|cashflow') }
];

// In-memory "sheets" keyed by collection, mirroring Code.gs routing.
const MOCK_SHEETS = {
  income: [],
  expenses: [],
  payables: [],
  receivables: [],
  savings: []
};

function hashSha256(text) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function sendJSON(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function handleMockGas(req, res) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let postData = {};
    try { postData = JSON.parse(body); } catch (e) { /* leave empty */ }
    const action = postData.action || '';

    // GET calls (e.g. ?action=testConnection, ?action=fetchAll)
    if (!action) {
      const qs = new URL(req.url, 'http://localhost').searchParams;
      const getAction = qs.get('action') || '';
      if (getAction === 'testConnection') {
        return sendJSON(res, { success: true, message: 'CashFlow Google Apps Script is online!' });
      }
      if (getAction === 'fetchAll') {
        return sendJSON(res, {
          success: true,
          income: MOCK_SHEETS.income,
          expenses: MOCK_SHEETS.expenses,
          payables: MOCK_SHEETS.payables,
          receivables: MOCK_SHEETS.receivables,
          savings: MOCK_SHEETS.savings
        });
      }
      return sendJSON(res, { success: false, error: 'Unknown GET action' });
    }

    if (action === 'login') {
      const username = String(postData.username || '');
      const password = String(postData.password || '');
      const user = MOCK_USERS.find((u) => u.username === username && u.passwordHash === hashSha256(`${username}|${password}`));
      if (user) return sendJSON(res, { success: true, username });
      return sendJSON(res, { success: false, error: 'Invalid username or password.' });
    }

    if (action === 'register') {
      const username = String(postData.username || '').trim();
      const password = String(postData.password || '');
      if (!username || !password) return sendJSON(res, { success: false, error: 'Username and password are required.' });
      if (username.length < 3) return sendJSON(res, { success: false, error: 'Username must be at least 3 characters.' });
      if (MOCK_USERS.some((u) => u.username === username)) {
        return sendJSON(res, { success: false, error: `User "${username}" already exists.` });
      }
      MOCK_USERS.push({ username, passwordHash: hashSha256(`${username}|${password}`) });
      return sendJSON(res, { success: true, username });
    }

    // Collection routing mirrors fixed Code.gs: the savings record's own
    // "type" field must never clobber the collection selector.
    const collection = postData.collection || postData.type || 'income';
    if (!Object.prototype.hasOwnProperty.call(MOCK_SHEETS, collection)) {
      return sendJSON(res, { success: false, error: `Unknown data type "${collection}"` });
    }

    if (action === 'add') {
      const record = { ...postData };
      delete record.action;
      delete record.collection;
      MOCK_SHEETS[collection].unshift(record);
      return sendJSON(res, { success: true, action: 'add', record });
    }

    if (action === 'update') {
      const index = MOCK_SHEETS[collection].findIndex((r) => r.id === postData.id);
      if (index === -1) return sendJSON(res, { success: false, error: 'Record not found for update' });
      MOCK_SHEETS[collection][index] = { ...MOCK_SHEETS[collection][index], ...postData };
      return sendJSON(res, { success: true, action: 'update', id: postData.id });
    }

    if (action === 'delete') {
      MOCK_SHEETS[collection] = MOCK_SHEETS[collection].filter((r) => r.id !== postData.id);
      return sendJSON(res, { success: true, action: 'delete', id: postData.id });
    }

    sendJSON(res, { success: false, error: 'Mock action not implemented' });
  });
}

const server = http.createServer((req, res) => {
  // Mock Google Apps Script endpoint for e2e tests (e.g. /mock-gas/exec)
  if (req.url.startsWith('/mock-gas/exec')) {
    return handleMockGas(req, res);
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`CashFlow static server running at http://127.0.0.1:${PORT}`);
});