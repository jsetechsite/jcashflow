/**
 * CashFlow PWA — Main Application Controller
 * Handles SPA navigation, modal forms, HTMX triggers, filtering, and UI reactivity.
 */

class CashFlowApp {
  constructor() {
    this.currentView = 'dashboard';
    this.filters = {
      search: '',
      category: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: ''
    };
    this.session = store.getSession();
    this._setupConnected = false;
    this.init();
  }

  init() {
    // Navigation listeners
    this.bindNavigation();

    // Quick Actions / FAB
    this.bindFAB();

    // Data Change listener
    window.addEventListener('cashflow:data-changed', (e) => {
      this.refreshCurrentView();
    });

    // Login gate: a session is required on first load (even before a cloud
    // backend is configured) so new users register via the login screen.
    if (!this.session) {
      this.showLoginScreen();
      this.updateCloudStatus();
      return;
    }

    // Initial render
    this.navigateTo('dashboard');
    this.updateCloudStatus();
  }

  // Login is enforced only when a Google Apps Script (cloud) URL is configured
  isLoginRequired() {
    return !!CONFIG.GOOGLE_APPS_SCRIPT_URL;
  }

  // Full-screen login gate (mode: 'login' or 'register')
  showLoginScreen(mode = 'login') {
    const login = document.getElementById('loginScreen');
    if (!login) return;
    const savedUrl = CONFIG.GOOGLE_APPS_SCRIPT_URL || '';
    login.innerHTML = `
      <div class="login-card login-card-wide">
        <div class="login-brand">
          <div class="app-logo-badge">💎</div>
          <div class="app-brand-title">CashFlow</div>
          <div class="app-brand-subtitle">${mode === 'register' ? 'Set up your private cloud & create your account' : 'Sign in to continue'}</div>
        </div>

        <div class="login-tabs">
          <button type="button" class="login-tab ${mode !== 'register' ? 'active' : ''}" data-tab="login" onclick="app.switchLoginTab('login')">Login</button>
          <button type="button" class="login-tab ${mode === 'register' ? 'active' : ''}" data-tab="register" onclick="app.switchLoginTab('register')">Register</button>
        </div>

        <!-- Sign In Pane -->
        <div id="loginPane" class="${mode === 'register' ? 'hidden' : ''}">
          <form onsubmit="app.handleLogin(event)">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" name="username" class="form-control" placeholder="Your username" required autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" name="password" class="form-control" placeholder="••••••••" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Sign In</button>
          </form>
          ${CONFIG.GOOGLE_APPS_SCRIPT_URL ? '' : `
            <div class="setup-intro" style="margin-top: 14px; margin-bottom: 0;">
              No backend connected yet — use the <strong>Register</strong> tab to set up your free Google backend.
            </div>`}
          <p class="text-muted" style="font-size: 0.78rem; text-align: center; margin-top: 14px;">
            Credentials are verified against your Google Sheet.
          </p>
        </div>

        <!-- Register / Setup Pane -->
        <div id="registerPane" class="${mode === 'register' ? '' : 'hidden'}">
          <div class="setup-intro">
            <strong>New here?</strong> CashFlow stores your data in your own private Google Sheet. Set up your free backend, then create your login — about 5 minutes.
          </div>

          <ol class="setup-steps">
            <li>
              <div>Download your <code>Code.gs</code> file (it already contains everything you need):</div>
              <button type="button" class="btn btn-sm btn-secondary" onclick="app.downloadAppScript()">⬇️ Download Code.gs</button>
            </li>
            <li>Create a <strong>Google Sheet</strong>, open <strong>Extensions → Apps Script</strong>, replace the editor contents with the downloaded <code>Code.gs</code>, save, then run the <strong>setupSheets</strong> function (authorize when prompted).</li>
            <li>Click <strong>Deploy → New deployment → Web app</strong> — Execute as <em>Me</em>, Who has access <em>Anyone</em>. Copy the <code>/exec</code> URL.</li>
            <li>Paste the URL below and click <strong>Test Connection</strong>. Once it passes, create your account.</li>
          </ol>

          <form id="setupForm" onsubmit="app.testSetupConnection(event)">
            <div class="form-group">
              <label class="form-label">Google Apps Script Web App URL</label>
              <input type="url" id="setupGasUrlInput" class="form-control font-mono" placeholder="https://script.google.com/macros/s/AKfy.../exec" value="${this.escapeHTML(savedUrl)}" required>
            </div>
            <button type="submit" class="btn btn-secondary btn-block" id="setupTestBtn">Test Connection</button>
            <div id="setupStatus" class="setup-status"></div>
          </form>

          <div id="registerLockHint" class="setup-lock-hint">🔒 Registration unlocks after a successful connection test above.</div>
          <form id="registerForm" class="setup-locked" onsubmit="app.handleRegister(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" name="reg_username" class="form-control" placeholder="at least 3 characters" minlength="3" required autocomplete="username">
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" name="reg_password" class="form-control" placeholder="at least 4 characters" minlength="4" required autocomplete="new-password">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input type="password" name="reg_confirm" class="form-control" placeholder="retype password" required autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="registerSubmitBtn">Create Account & Sign In</button>
            <p class="text-muted" style="font-size: 0.75rem; text-align: center; margin-top: 10px;">
              Passwords are stored as salted SHA-256 hashes on your own sheet — never plaintext.
            </p>
          </form>
        </div>
      </div>
    `;
    login.classList.remove('hidden');
    document.body.classList.add('login-active');
    const first = login.querySelector(mode === 'register' ? '#setupGasUrlInput' : 'input');
    if (first) setTimeout(() => first.focus(), 50);
  }

  switchLoginTab(tab) {
    const login = document.getElementById('loginScreen');
    if (!login) return;
    login.querySelectorAll('.login-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    const loginPane = document.getElementById('loginPane');
    const registerPane = document.getElementById('registerPane');
    if (loginPane) loginPane.classList.toggle('hidden', tab !== 'login');
    if (registerPane) registerPane.classList.toggle('hidden', tab !== 'register');
  }

  // Download the Apps Script backend file for the user's own deployment
  async downloadAppScript() {
    try {
      const res = await fetch('./apps-script/Code.gs');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Code.gs';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Code.gs downloaded — paste it into Apps Script.', 'success', '⬇️');
    } catch (err) {
      console.warn('Failed to fetch Code.gs:', err);
      this.showToast('Could not download Code.gs. Check your connection.', 'error');
    }
  }

  // Test the setup URL; on success, persist it and unlock registration
  async testSetupConnection(event) {
    event.preventDefault();
    const url = document.getElementById('setupGasUrlInput').value.trim();
    if (!url) {
      this.showToast('Please enter your Web App URL first', 'error');
      return;
    }
    const btn = document.getElementById('setupTestBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Testing…'; }
    const status = document.getElementById('setupStatus');
    try {
      const res = await fetch(`${url}?action=testConnection`);
      const data = await res.json();
      if (data && data.success) {
        // Persist the URL only after a successful connection
        CONFIG.GOOGLE_APPS_SCRIPT_URL = url;
        localStorage.setItem('cashflow_gas_url', url);
        this._setupConnected = true;
        this._backendCapabilities = null;
        try {
          const capRes = await fetch(`${url}?action=checkCapabilities`);
          const capData = await capRes.json();
          if (capData && capData.success && capData.features) {
            this._backendCapabilities = capData;
          }
        } catch (_) { /* old backend — no capabilities */ }
        const form = document.getElementById('registerForm');
        if (form) form.classList.remove('setup-locked');
        const hint = document.getElementById('registerLockHint');
        if (!this._backendCapabilities) {
          if (hint) hint.innerHTML = '<span style="color: var(--warning);">⚠️ Backend is outdated — savings and other records may be misrouted to Income. Download the latest Code.gs from the Register tab, replace your Apps Script, and re-test.</span>';
          if (status) status.innerHTML = '<span style="color: var(--warning);">⚠️ Connected, but the backend is outdated.</span>';
          this.showToast('Backend is outdated — please redeploy the latest Code.gs.', 'warning', '⚠️');
        } else {
          if (hint) hint.innerHTML = '<span class="text-income">✅ Connection OK — you can now create your account.</span>';
          if (status) status.innerHTML = '<span class="text-income">✅ Connected successfully.</span>';
          this.showToast('Google Sheets Connected Successfully!', 'success', '🚀');
        }
      } else {
        this._setupConnected = false;
        if (status) status.innerHTML = '<span style="color: var(--expense);">⚠️ Connected, but the response was unexpected.</span>';
      }
    } catch (err) {
      this._setupConnected = false;
      if (status) status.innerHTML = '<span style="color: var(--expense);">⚠️ Could not reach your Apps Script. Check the URL and that it is deployed with access: Anyone.</span>';
      this.showToast('Could not reach Google Apps Script.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Test Connection'; }
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    if (!this._setupConnected) {
      this.showToast('Test the connection first to unlock registration.', 'error');
      return;
    }
    const formData = new FormData(event.target);
    const username = String(formData.get('reg_username') || '').trim();
    const password = String(formData.get('reg_password') || '');
    const confirm = String(formData.get('reg_confirm') || '');
    if (password !== confirm) {
      this.showToast('Passwords do not match.', 'error');
      return;
    }
    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }
    const res = await store.register(username, password);
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account & Sign In'; }
    if (res && res.success) {
      this.session = store.saveSession(res.username);
      this.hideLoginScreen();
      this.navigateTo('dashboard');
      this.updateCloudStatus();
      this.showToast(`Welcome, ${res.username}! Your account is ready.`, 'success', '👋');
    } else {
      const raw = (res && res.error) || 'Registration failed.';
      const msg = /unknown.*action/i.test(raw)
        ? 'Backend does not support registration. Redeploy the latest Code.gs from the Register tab, then try again.'
        : raw;
      this.showToast(msg, 'error');
    }
  }

  hideLoginScreen() {
    const login = document.getElementById('loginScreen');
    if (login) login.classList.add('hidden');
    document.body.classList.remove('login-active');
  }

  async handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
    }

    const res = await store.login(username, password);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }

    if (res && res.success) {
      this.session = store.saveSession(res.username);
      this.hideLoginScreen();
      this.navigateTo('dashboard');
      this.updateCloudStatus();
      this.showToast(`Welcome back, ${res.username}!`, 'success', '👋');
    } else {
      const raw = (res && res.error) || 'Invalid username or password.';
      const msg = /unknown.*action/i.test(raw)
        ? 'Backend does not support login. Redeploy the latest Code.gs from the Register tab, then try again.'
        : raw;
      this.showToast(msg, 'error');
    }
  }

  logout() {
    store.clearSession();
    this.session = null;
    this.showLoginScreen();
    this.showToast('You have been signed out.', 'info', '🔒');
  }

  // Format money
  formatMoney(num) {
    return `${CONFIG.CURRENCY_SYMBOL}${Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Toast Notification
  showToast(message, type = 'info', icon = '💡') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span style="flex:1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Navigation Setup
  bindNavigation() {
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-nav');
        this.navigateTo(targetView);
        
        // Close mobile sidebar if open
        const sidebar = document.querySelector('.app-sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });

    // Mobile menu toggle
    const menuBtn = document.getElementById('mobileMenuToggle');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        const sidebar = document.querySelector('.app-sidebar');
        if (sidebar) sidebar.classList.toggle('mobile-open');
      });
    }
  }

  // Navigate to screen
  navigateTo(viewName) {
    this.currentView = viewName;
    this.filters = { search: '', category: 'all', status: 'all', dateFrom: '', dateTo: '' };

    // Update active nav links
    document.querySelectorAll('[data-nav]').forEach(el => {
      if (el.getAttribute('data-nav') === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update Page Header Title
    const titleMap = {
      dashboard: 'Financial Dashboard',
      income: 'Income Records',
      expenses: 'Expense Tracker',
      savings: 'Savings Tracker',
      payables: 'Accounts Payable',
      receivables: 'Accounts Receivable',
      settings: 'Settings & Cloud Sync'
    };
    const headline = document.getElementById('pageHeadline');
    if (headline) headline.textContent = titleMap[viewName] || 'CashFlow';

    // Render View
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    content.innerHTML = '';
    content.className = 'content-body animate-fade-in';

    switch (viewName) {
      case 'dashboard':
        this.renderDashboard(content);
        break;
      case 'income':
        this.renderTransactionView(content, 'income');
        break;
      case 'expenses':
        this.renderTransactionView(content, 'expenses');
        break;
      case 'savings':
        this.renderSavingsView(content);
        break;
      case 'payables':
        this.renderDebtView(content, 'payables');
        break;
      case 'receivables':
        this.renderDebtView(content, 'receivables');
        break;
      case 'settings':
        this.renderSettingsView(content);
        break;
    }
  }

  refreshCurrentView() {
    this.navigateTo(this.currentView);
  }

  // 1. Dashboard View
  renderDashboard(container) {
    const stats = store.getFinancialSummary();
    const isPositive = stats.netCashflow >= 0;

    container.innerHTML = `
      <!-- Metric Cards Grid -->
      <div class="metrics-grid">
        <div class="stat-card income-card">
          <div class="stat-header">
            <span class="stat-title">Total Income</span>
            <div class="stat-icon" style="color: var(--income);">📥</div>
          </div>
          <div class="stat-value text-income">${this.formatMoney(stats.totalIncome)}</div>
          <div class="stat-footer">${stats.incomeCount} transaction(s)</div>
        </div>

        <div class="stat-card expense-card">
          <div class="stat-header">
            <span class="stat-title">Total Expenses</span>
            <div class="stat-icon" style="color: var(--expense);">📤</div>
          </div>
          <div class="stat-value text-expense">${this.formatMoney(stats.totalExpenses)}</div>
          <div class="stat-footer">${stats.expenseCount} transaction(s)</div>
        </div>

        <div class="stat-card net-card">
          <div class="stat-header">
            <span class="stat-title">Net Cash Flow</span>
            <div class="stat-icon" style="color: var(--primary-light);">💼</div>
          </div>
          <div class="stat-value ${isPositive ? 'text-income' : 'text-expense'}">
            ${isPositive ? '+' : ''}${this.formatMoney(stats.netCashflow)}
          </div>
          <div class="stat-footer">${isPositive ? 'Healthy Cash Position' : 'Deficit Alert'}</div>
        </div>

        <div class="stat-card payable-card">
          <div class="stat-header">
            <span class="stat-title">Pending Payables</span>
            <div class="stat-icon" style="color: var(--payable);">⏳</div>
          </div>
          <div class="stat-value text-payable">${this.formatMoney(stats.totalPayables)}</div>
          <div class="stat-footer">${stats.payableCount} outstanding bill(s)</div>
        </div>

        <div class="stat-card receivable-card">
          <div class="stat-header">
            <span class="stat-title">Pending Receivables</span>
            <div class="stat-icon" style="color: var(--receivable);">🎯</div>
          </div>
          <div class="stat-value text-receivable">${this.formatMoney(stats.totalReceivables)}</div>
          <div class="stat-footer">${stats.receivableCount} incoming claim(s)</div>
        </div>

        <div class="stat-card savings-card">
          <div class="stat-header">
            <span class="stat-title">Total Savings</span>
            <div class="stat-icon" style="color: var(--savings);">💰</div>
          </div>
          <div class="stat-value text-savings">${this.formatMoney(stats.totalSavings)}</div>
          <div class="stat-footer">${stats.savingsCount} savings transaction(s)</div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Income vs Expenses (6-Month Trend)</h3>
          </div>
          <div class="chart-container">
            <canvas id="cashflowChartCanvas"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Expenses by Category</h3>
          </div>
          <div class="chart-container">
            <canvas id="expensePieCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Recent Transactions Section -->
      <div class="section-card">
        <div class="section-header">
          <h3>Recent Transactions</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-secondary" onclick="app.navigateTo('income')">+ Add Income</button>
            <button class="btn btn-sm btn-primary" onclick="app.navigateTo('expenses')">+ Add Expense</button>
          </div>
        </div>
        <div id="recentTransactionsList" class="transaction-list">
          ${this.renderRecentTransactionsHTML()}
        </div>
      </div>
    `;

    // Render Charts
    setTimeout(() => {
      charts.renderDashboardCharts();
    }, 50);
  }

  // Helper: Recent Combined Transactions HTML
  renderRecentTransactionsHTML() {
    const income = store.getItems('income').map(i => ({ ...i, type: 'income' }));
    const expenses = store.getItems('expenses').map(e => ({ ...e, type: 'expense' }));
    const combined = [...income, ...expenses].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);

    if (combined.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🪙</div>
          <div class="empty-title">No transactions recorded yet</div>
          <p class="empty-desc">Use the + button or shortcuts to record your first income or expense.</p>
        </div>
      `;
    }

    return combined.map(tx => {
      const isInc = tx.type === 'income';
      return `
        <div class="tx-card">
          <div class="tx-left">
            <div class="tx-icon-box ${isInc ? 'tx-icon-income' : 'tx-icon-expense'}">
              ${isInc ? '↓' : '↑'}
            </div>
            <div class="tx-info">
              <span class="tx-title">${this.escapeHTML(tx.description)}</span>
              <div class="tx-meta">
                <span>${tx.date || 'No Date'}</span>
                <span>•</span>
                <span class="badge ${isInc ? 'badge-income' : 'badge-expense'}">${tx.category || 'General'}</span>
                <span>•</span>
                <span>${tx.payment_method || 'Cash'}</span>
              </div>
            </div>
          </div>
          <div class="tx-right">
            <div class="tx-amount ${isInc ? 'text-income' : 'text-expense'}">
              ${isInc ? '+' : '-'}${this.formatMoney(tx.amount)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Transaction List View (Income / Expenses)
  renderTransactionView(container, type) {
    const isInc = type === 'income';
    const title = isInc ? 'Income' : 'Expense';
    const categories = CONFIG.CATEGORIES[type];

    container.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3>${title} Management</h3>
            <p class="text-muted" style="font-size: 0.82rem;">Record and monitor your ${type} flow</p>
          </div>
          <button class="btn btn-primary" onclick="app.openTransactionModal('${type}')">
            <span>+</span> Add ${title}
          </button>
        </div>

        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="txSearchInput" placeholder="Search description, notes..." oninput="app.handleSearch(this.value, '${type}')">
          </div>
          <select class="filter-select" id="txCategoryFilter" onchange="app.handleCategoryFilter(this.value, '${type}')">
            <option value="all">All Categories</option>
            ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
          <input type="date" class="filter-select filter-date" value="${this.filters.dateFrom}" onchange="app.handleDateFilter('from', this.value, '${type}')" title="From date">
          <input type="date" class="filter-select filter-date" value="${this.filters.dateTo}" onchange="app.handleDateFilter('to', this.value, '${type}')" title="To date">
        </div>

        <!-- List Container -->
        <div id="transactionListContainer" class="transaction-list">
          ${this.renderTransactionItemsHTML(type)}
        </div>
      </div>
    `;
  }

  renderTransactionItemsHTML(type) {
    const isInc = type === 'income';
    let items = store.getItems(type);

    // Apply active filters
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      items = items.filter(x => (x.description || '').toLowerCase().includes(q) || (x.notes || '').toLowerCase().includes(q));
    }
    if (this.filters.category !== 'all') {
      items = items.filter(x => x.category === this.filters.category);
    }
    if (this.filters.dateFrom) {
      items = items.filter(x => (x.date || '') >= this.filters.dateFrom);
    }
    if (this.filters.dateTo) {
      items = items.filter(x => (x.date || '') <= this.filters.dateTo);
    }

    if (items.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">${isInc ? '💵' : '💳'}</div>
          <div class="empty-title">No ${type} found</div>
          <p class="empty-desc">Click "Add ${isInc ? 'Income' : 'Expense'}" to start tracking.</p>
        </div>
      `;
    }

    return items.map(item => `
      <div class="tx-card" id="card-${item.id}">
        <div class="tx-left">
          <div class="tx-icon-box ${isInc ? 'tx-icon-income' : 'tx-icon-expense'}">
            ${isInc ? '📥' : '📤'}
          </div>
          <div class="tx-info">
            <span class="tx-title">${this.escapeHTML(item.description)}</span>
            <div class="tx-meta">
              <span>🗓️ ${item.date || 'N/A'}</span>
              <span>•</span>
              <span class="badge ${isInc ? 'badge-income' : 'badge-expense'}">${item.category}</span>
              <span>•</span>
              <span>💳 ${item.payment_method}</span>
              ${item.notes ? `<span>• 📝 ${this.escapeHTML(item.notes)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${isInc ? 'text-income' : 'text-expense'}">
            ${isInc ? '+' : '-'}${this.formatMoney(item.amount)}
          </div>
          <div class="tx-actions">
            <button class="tx-action-btn" onclick="app.openTransactionModal('${type}', '${item.id}')">Edit</button>
            <button class="tx-action-btn btn-delete" onclick="app.confirmDelete('${type}', '${item.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 3. Debts View (Payables / Receivables)
  renderDebtView(container, type) {
    const isPay = type === 'payables';
    const title = isPay ? 'Accounts Payable (Owed by You)' : 'Accounts Receivable (Owed to You)';
    const partyLabel = isPay ? 'Creditor' : 'Debtor';

    container.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3>${title}</h3>
            <p class="text-muted" style="font-size: 0.82rem;">Manage credit, loans, and scheduled dues</p>
          </div>
          <button class="btn btn-primary" onclick="app.openDebtModal('${type}')">
            <span>+</span> New ${isPay ? 'Payable' : 'Receivable'}
          </button>
        </div>

        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Search ${partyLabel.toLowerCase()}, description..." oninput="app.handleDebtSearch(this.value, '${type}')">
          </div>
          <select class="filter-select" onchange="app.handleStatusFilter(this.value, '${type}')">
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
            <option value="${isPay ? 'Paid' : 'Collected'}">${isPay ? 'Paid' : 'Collected'}</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        <!-- List Container -->
        <div id="debtListContainer" class="transaction-list">
          ${this.renderDebtItemsHTML(type)}
        </div>
      </div>
    `;
  }

  renderDebtItemsHTML(type) {
    const isPay = type === 'payables';
    let items = store.getItems(type);

    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      items = items.filter(x => 
        (x.description || '').toLowerCase().includes(q) || 
        (x.creditor || x.debtor || '').toLowerCase().includes(q)
      );
    }
    if (this.filters.status !== 'all') {
      items = items.filter(x => x.status === this.filters.status);
    }

    if (items.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">${isPay ? '📋' : '🎯'}</div>
          <div class="empty-title">No records found</div>
          <p class="empty-desc">Keep your financial obligations and claims organized.</p>
        </div>
      `;
    }

    return items.map(item => {
      const party = isPay ? item.creditor : item.debtor;
      const paidAmount = isPay ? item.amount_paid : item.amount_received;
      const remaining = (Number(item.amount) || 0) - (Number(paidAmount) || 0);

      let statusBadgeClass = 'badge-pending';
      if (item.status === 'Paid' || item.status === 'Collected') statusBadgeClass = 'badge-paid';
      if (item.status === 'Partial') statusBadgeClass = 'badge-partial';
      if (item.status === 'Overdue') statusBadgeClass = 'badge-overdue';

      return `
        <div class="tx-card" id="card-${item.id}">
          <div class="tx-left">
            <div class="tx-icon-box ${isPay ? 'tx-icon-payable' : 'tx-icon-receivable'}">
              ${isPay ? '⏳' : '🎯'}
            </div>
            <div class="tx-info">
              <span class="tx-title">${this.escapeHTML(item.description)}</span>
              <div class="tx-meta">
                <span>👤 <strong>${this.escapeHTML(party || 'Unknown')}</strong></span>
                <span>•</span>
                <span>Due: ${item.due_date || 'N/A'}</span>
                <span>•</span>
                <span class="badge ${statusBadgeClass}">${item.status}</span>
                ${item.notes ? `<span>• 📝 ${this.escapeHTML(item.notes)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="tx-right">
            <div class="tx-amount ${isPay ? 'text-payable' : 'text-receivable'}">
              Total: ${this.formatMoney(item.amount)}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">
              Balance: <strong>${this.formatMoney(remaining)}</strong>
            </div>
            <div class="tx-actions" style="margin-top: 4px;">
              <button class="tx-action-btn" onclick="app.openDebtModal('${type}', '${item.id}')">Edit / Settle</button>
              <button class="tx-action-btn btn-delete" onclick="app.confirmDelete('${type}', '${item.id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Savings View (deposits / withdrawals ledger)
  renderSavingsView(container) {
    const stats = store.getFinancialSummary();
    const positive = stats.totalSavings >= 0;

    container.innerHTML = `
      <div class="metrics-grid">
        <div class="stat-card savings-card">
          <div class="stat-header">
            <span class="stat-title">Current Savings</span>
            <div class="stat-icon" style="color: var(--savings);">💰</div>
          </div>
          <div class="stat-value text-savings">${this.formatMoney(stats.totalSavings)}</div>
          <div class="stat-footer">${positive ? 'On track to your goals' : 'Savings shortfall'}</div>
        </div>

        <div class="stat-card income-card">
          <div class="stat-header">
            <span class="stat-title">Total Deposited</span>
            <div class="stat-icon" style="color: var(--income);">📥</div>
          </div>
          <div class="stat-value text-income">${this.formatMoney(stats.totalDeposits)}</div>
          <div class="stat-footer">${stats.savingsCount} total transaction(s)</div>
        </div>

        <div class="stat-card expense-card">
          <div class="stat-header">
            <span class="stat-title">Total Withdrawn</span>
            <div class="stat-icon" style="color: var(--expense);">📤</div>
          </div>
          <div class="stat-value text-expense">${this.formatMoney(stats.totalWithdrawals)}</div>
          <div class="stat-footer">Money pulled out</div>
        </div>
      </div>

      <!-- Savings Balance Trend -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Savings Balance Trend (6-Month)</h3>
          </div>
          <div class="chart-container">
            <canvas id="savingsChartCanvas"></canvas>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <div>
            <h3>Savings Ledger</h3>
            <p class="text-muted" style="font-size: 0.82rem;">Track money set aside and withdrawn</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" onclick="app.openSavingsModal('deposit')">
              <span>+</span> Deposit
            </button>
            <button class="btn btn-primary" onclick="app.openSavingsModal('withdrawal')">
              <span>−</span> Withdraw
            </button>
          </div>
        </div>

        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="savingsSearchInput" placeholder="Search description, notes..." oninput="app.handleSavingsSearch(this.value)">
          </div>
          <input type="date" class="filter-select filter-date" value="${this.filters.dateFrom}" onchange="app.handleSavingsDateFilter('from', this.value)" title="From date">
          <input type="date" class="filter-select filter-date" value="${this.filters.dateTo}" onchange="app.handleSavingsDateFilter('to', this.value)" title="To date">
        </div>

        <!-- List Container -->
        <div id="savingsListContainer" class="transaction-list">
          ${this.renderSavingsItemsHTML()}
        </div>
      </div>
    `;

    setTimeout(() => {
      charts.renderSavingsChart();
    }, 50);
  }

  renderSavingsItemsHTML() {
    let items = store.getItems('savings');

    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      items = items.filter(x => (x.description || '').toLowerCase().includes(q) || (x.notes || '').toLowerCase().includes(q));
    }
    if (this.filters.dateFrom) {
      items = items.filter(x => (x.date || '') >= this.filters.dateFrom);
    }
    if (this.filters.dateTo) {
      items = items.filter(x => (x.date || '') <= this.filters.dateTo);
    }

    items = [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (items.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <div class="empty-title">No savings activity yet</div>
          <p class="empty-desc">Use "Deposit" or "Withdraw" to start building your savings ledger.</p>
        </div>
      `;
    }

    return items.map(item => {
      const isDeposit = item.type === 'deposit';
      return `
        <div class="tx-card" id="card-${item.id}">
          <div class="tx-left">
            <div class="tx-icon-box ${isDeposit ? 'tx-icon-savings' : 'tx-icon-expense'}">
              ${isDeposit ? '📥' : '📤'}
            </div>
            <div class="tx-info">
              <span class="tx-title">${this.escapeHTML(item.description)}</span>
              <div class="tx-meta">
                <span>🗓️ ${item.date || 'N/A'}</span>
                <span>•</span>
                <span class="badge ${isDeposit ? 'badge-savings' : 'badge-expense'}">${isDeposit ? 'Deposit' : 'Withdrawal'}</span>
                ${item.category ? `<span>• <span class="badge badge-payable">${this.escapeHTML(item.category)}</span></span>` : ''}
                ${item.notes ? `<span>• 📝 ${this.escapeHTML(item.notes)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="tx-right">
            <div class="tx-amount ${isDeposit ? 'text-income' : 'text-expense'}">
              ${isDeposit ? '+' : '-'}${this.formatMoney(item.amount)}
            </div>
            <div class="tx-actions">
              <button class="tx-action-btn" onclick="app.openSavingsModal('${item.type || 'deposit'}', '${item.id}')">Edit</button>
              <button class="tx-action-btn btn-delete" onclick="app.confirmDelete('savings', '${item.id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  handleSavingsSearch(val) {
    this.filters.search = val;
    const container = document.getElementById('savingsListContainer');
    if (container) container.innerHTML = this.renderSavingsItemsHTML();
  }

  handleSavingsDateFilter(edge, val) {
    if (edge === 'from') {
      this.filters.dateFrom = val;
    } else {
      this.filters.dateTo = val;
    }
    const container = document.getElementById('savingsListContainer');
    if (container) container.innerHTML = this.renderSavingsItemsHTML();
  }

  // 5. Settings & Google Sheets Web App Config View
  renderSettingsView(container) {
    const currentGasUrl = CONFIG.GOOGLE_APPS_SCRIPT_URL;

    container.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <h3>Google Sheets Cloud Integration</h3>
        </div>
        <p class="text-muted" style="margin-bottom: 20px; font-size: 0.88rem;">
          Connect your Google Spreadsheet by deploying the Google Apps Script included in the <code>apps-script/Code.gs</code> file.
        </p>

        <form id="settingsForm" onsubmit="app.saveSettings(event)">
          <div class="form-group">
            <label class="form-label">Google Apps Script Web App URL</label>
            <input type="url" id="gasUrlInput" class="form-control font-mono" 
                   placeholder="https://script.google.com/macros/s/AKfyc.../exec"
                   value="${this.escapeHTML(currentGasUrl)}">
            <small class="text-subtle" style="margin-top: 4px;">
              Deployed via: Google Sheet &gt; Extensions &gt; Apps Script &gt; Deploy &gt; Web App (Access: Anyone)
            </small>
          </div>

          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button type="submit" class="btn btn-primary">Save Settings</button>
            <button type="button" class="btn btn-secondary" onclick="app.testCloudConnection()">Test Connection</button>
            <button type="button" class="btn btn-secondary" onclick="app.syncFromCloudManual()">Fetch Cloud Data</button>
            <button type="button" class="btn btn-secondary" onclick="app.showLoginScreen('register')">Set Up Cloud & Register</button>
          </div>
        </form>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3>App Information & Backup</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem; color: var(--text-muted);">
          <div>• Storage Mode: <strong>${currentGasUrl ? 'Google Sheets & Local Hybrid' : 'Local Browser Cache (Offline-first)'}</strong></div>
          <div>• PWA Version: <strong>v${CONFIG.APP_VERSION || '1.4.0'} (Fast, Offline-ready)</strong></div>
          ${this.session ? `
            <div>• Signed in as: <strong>${this.escapeHTML(this.session.username || '—')}</strong>
              <button class="btn btn-sm btn-secondary" style="margin-left: 8px;" onclick="app.logout()">Logout</button>
            </div>` : ''}
          <div style="margin-top: 10px;">
            <button class="btn btn-sm btn-secondary" onclick="app.exportLocalBackup()">Download JSON Backup</button>
            <button class="btn btn-sm btn-secondary" onclick="app.loadDemoData()">Load Demo Data</button>
            <button class="btn btn-sm btn-secondary" style="color: var(--expense);" onclick="app.confirmClearAll()">Clear All Data</button>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Filters & Search handlers
  // -------------------------------------------------------------------------
  handleSearch(val, type) {
    this.filters.search = val;
    const container = document.getElementById('transactionListContainer');
    if (container) container.innerHTML = this.renderTransactionItemsHTML(type);
  }

  handleCategoryFilter(val, type) {
    this.filters.category = val;
    const container = document.getElementById('transactionListContainer');
    if (container) container.innerHTML = this.renderTransactionItemsHTML(type);
  }

  handleDateFilter(edge, val, type) {
    if (edge === 'from') {
      this.filters.dateFrom = val;
    } else {
      this.filters.dateTo = val;
    }
    const container = document.getElementById('transactionListContainer');
    if (container) container.innerHTML = this.renderTransactionItemsHTML(type);
  }

  handleDebtSearch(val, type) {
    this.filters.search = val;
    const container = document.getElementById('debtListContainer');
    if (container) container.innerHTML = this.renderDebtItemsHTML(type);
  }

  handleStatusFilter(val, type) {
    this.filters.status = val;
    const container = document.getElementById('debtListContainer');
    if (container) container.innerHTML = this.renderDebtItemsHTML(type);
  }

  // -------------------------------------------------------------------------
  // Modals & Form Dialogs
  // -------------------------------------------------------------------------
  openTransactionModal(type, itemId = null) {
    const isInc = type === 'income';
    const isEdit = !!itemId;
    const title = (isEdit ? 'Edit ' : 'New ') + (isInc ? 'Income' : 'Expense');
    const categories = CONFIG.CATEGORIES[type];
    const methods = CONFIG.PAYMENT_METHODS;
    
    let item = {
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: categories[0],
      amount: '',
      payment_method: methods[0],
      notes: ''
    };

    if (isEdit) {
      const found = store.getItems(type).find(x => x.id === itemId);
      if (found) item = { ...found };
    }

    const modalHTML = `
      <div class="modal-backdrop" id="appModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="btn-icon" onclick="app.closeModal()">✕</button>
          </div>
          <form onsubmit="app.handleTransactionSubmit(event, '${type}', '${itemId || ''}')">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date *</label>
                  <input type="date" name="date" class="form-control" value="${item.date}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Amount (${CONFIG.CURRENCY_SYMBOL}) *</label>
                  <input type="number" step="0.01" name="amount" class="form-control font-mono" placeholder="0.00" value="${item.amount}" required>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Description / Source *</label>
                <input type="text" name="description" class="form-control" placeholder="e.g. Consulting Fee, Groceries..." value="${this.escapeHTML(item.description)}" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select name="category" class="form-control">
                    ${categories.map(c => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Payment Method</label>
                  <select name="payment_method" class="form-control">
                    ${methods.map(m => `<option value="${m}" ${m === item.payment_method ? 'selected' : ''}>${m}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <textarea name="notes" class="form-control" rows="2" placeholder="Additional details...">${this.escapeHTML(item.notes || '')}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.renderModal(modalHTML);
  }

  openDebtModal(type, itemId = null) {
    const isPay = type === 'payables';
    const isEdit = !!itemId;
    const title = (isEdit ? 'Edit ' : 'New ') + (isPay ? 'Payable (I Owe)' : 'Receivable (Owed to Me)');
    const partyLabel = isPay ? 'Creditor / Person Owed' : 'Debtor / Client Name';

    let item = {
      date_incurred: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      description: '',
      party: '',
      amount: '',
      paid_or_received: '0',
      status: 'Pending',
      notes: ''
    };

    if (isEdit) {
      const found = store.getItems(type).find(x => x.id === itemId);
      if (found) {
        item = {
          ...found,
          party: isPay ? found.creditor : found.debtor,
          paid_or_received: isPay ? found.amount_paid : found.amount_received
        };
      }
    }

    const modalHTML = `
      <div class="modal-backdrop" id="appModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="btn-icon" onclick="app.closeModal()">✕</button>
          </div>
          <form onsubmit="app.handleDebtSubmit(event, '${type}', '${itemId || ''}')">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">${partyLabel} *</label>
                <input type="text" name="party" class="form-control" placeholder="Name or Company" value="${this.escapeHTML(item.party || '')}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Description / Purpose *</label>
                <input type="text" name="description" class="form-control" placeholder="e.g. Office Rent, Web Development..." value="${this.escapeHTML(item.description)}" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Total Amount (${CONFIG.CURRENCY_SYMBOL}) *</label>
                  <input type="number" step="0.01" name="amount" class="form-control font-mono" placeholder="0.00" value="${item.amount}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">${isPay ? 'Amount Paid' : 'Amount Collected'} (${CONFIG.CURRENCY_SYMBOL})</label>
                  <input type="number" step="0.01" name="paid_or_received" class="form-control font-mono" placeholder="0.00" value="${item.paid_or_received || 0}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date Incurred</label>
                  <input type="date" name="date_incurred" class="form-control" value="${item.date_incurred}">
                </div>
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" name="due_date" class="form-control" value="${item.due_date}">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Status</label>
                <select name="status" class="form-control">
                  <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="Partial" ${item.status === 'Partial' ? 'selected' : ''}>Partial</option>
                  <option value="${isPay ? 'Paid' : 'Collected'}" ${(item.status === 'Paid' || item.status === 'Collected') ? 'selected' : ''}>${isPay ? 'Paid in Full' : 'Collected in Full'}</option>
                  <option value="Overdue" ${item.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <textarea name="notes" class="form-control" rows="2">${this.escapeHTML(item.notes || '')}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Update Obligation' : 'Save Record'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.renderModal(modalHTML);
  }

  openSavingsModal(mode = 'deposit', itemId = null) {
    const isDeposit = mode === 'deposit';
    const isEdit = !!itemId;
    const title = (isEdit ? 'Edit ' : 'New ') + (isDeposit ? 'Deposit' : 'Withdrawal');
    const categories = CONFIG.CATEGORIES.savings;

    let item = {
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: categories[0],
      amount: '',
      notes: ''
    };

    if (isEdit) {
      const found = store.getItems('savings').find(x => x.id === itemId);
      if (found) item = { ...found };
    }

    const modalHTML = `
      <div class="modal-backdrop" id="appModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="btn-icon" onclick="app.closeModal()">✕</button>
          </div>
          <form onsubmit="app.handleSavingsSubmit(event, '${isDeposit ? 'deposit' : 'withdrawal'}', '${itemId || ''}')">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date *</label>
                  <input type="date" name="date" class="form-control" value="${item.date}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Amount (${CONFIG.CURRENCY_SYMBOL}) *</label>
                  <input type="number" step="0.01" min="0" name="amount" class="form-control font-mono" placeholder="0.00" value="${item.amount}" required>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Description *</label>
                <input type="text" name="description" class="form-control" placeholder="e.g. Monthly Auto-Save, Emergency Expense..." value="${this.escapeHTML(item.description)}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Savings Purpose</label>
                <select name="category" class="form-control">
                  ${categories.map(c => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <textarea name="notes" class="form-control" rows="2" placeholder="Additional details...">${this.escapeHTML(item.notes || '')}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.renderModal(modalHTML);
  }

  renderModal(html) {
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
    const container = document.getElementById('modalContainer');
    if (!container) return;
    container.innerHTML = html;
    setTimeout(() => {
      const modal = document.getElementById('appModal');
      if (modal) modal.classList.add('open');
    }, 10);
  }

  closeModal() {
    const modal = document.getElementById('appModal');
    if (modal) {
      modal.classList.remove('open');
      this._closeTimer = setTimeout(() => {
        const container = document.getElementById('modalContainer');
        if (container) container.innerHTML = '';
        this._closeTimer = null;
      }, 250);
    } else {
      const container = document.getElementById('modalContainer');
      if (container) container.innerHTML = '';
    }
  }

  // -------------------------------------------------------------------------
  // Form Submission Handlers
  // -------------------------------------------------------------------------
  async handleTransactionSubmit(event, type, itemId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      date: formData.get('date'),
      description: formData.get('description'),
      category: formData.get('category'),
      amount: formData.get('amount'),
      payment_method: formData.get('payment_method'),
      notes: formData.get('notes')
    };

    if (itemId) {
      await store.updateItem(type, itemId, payload);
      this.showToast(`${type === 'income' ? 'Income' : 'Expense'} updated successfully!`, 'success');
    } else {
      await store.addItem(type, payload);
      this.showToast(`${type === 'income' ? 'Income' : 'Expense'} added!`, 'success');
    }

    this.closeModal();
    this.refreshCurrentView();
  }

  async handleDebtSubmit(event, type, itemId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const isPay = type === 'payables';

    const payload = {
      date_incurred: formData.get('date_incurred'),
      due_date: formData.get('due_date'),
      description: formData.get('description'),
      amount: formData.get('amount'),
      status: formData.get('status'),
      notes: formData.get('notes')
    };

    if (isPay) {
      payload.creditor = formData.get('party');
      payload.amount_paid = formData.get('paid_or_received');
    } else {
      payload.debtor = formData.get('party');
      payload.amount_received = formData.get('paid_or_received');
    }

    if (itemId) {
      await store.updateItem(type, itemId, payload);
      this.showToast(`${isPay ? 'Payable' : 'Receivable'} updated!`, 'success');
    } else {
      await store.addItem(type, payload);
      this.showToast(`${isPay ? 'Payable' : 'Receivable'} saved!`, 'success');
    }

    this.closeModal();
    this.refreshCurrentView();
  }

  async handleSavingsSubmit(event, mode, itemId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      date: formData.get('date'),
      description: formData.get('description'),
      category: formData.get('category'),
      type: mode,
      amount: Math.abs(parseFloat(formData.get('amount')) || 0),
      notes: formData.get('notes')
    };

    if (itemId) {
      await store.updateItem('savings', itemId, payload);
      this.showToast('Savings record updated!', 'success');
    } else {
      await store.addItem('savings', payload);
      this.showToast(mode === 'deposit' ? 'Deposit recorded!' : 'Withdrawal recorded!', 'success');
    }

    this.closeModal();
    this.refreshCurrentView();
  }

  async confirmDelete(type, id) {
    if (confirm(`Are you sure you want to delete this ${type.slice(0, -1)} entry?`)) {
      await store.deleteItem(type, id);
      this.showToast('Item deleted.', 'info', '🗑️');
      this.refreshCurrentView();
    }
  }

  // Floating Action Button Quick Action Modal
  bindFAB() {
    const fab = document.getElementById('fabActionBtn');
    if (!fab) return;

    fab.addEventListener('click', () => {
      const modalHTML = `
        <div class="modal-backdrop" id="appModal">
          <div class="modal-container" style="max-width: 360px;">
            <div class="modal-header">
              <h3 class="modal-title">Quick Action</h3>
              <button class="btn-icon" onclick="app.closeModal()">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px;">
              <button class="btn btn-secondary" style="justify-content: flex-start; gap: 14px;" onclick="app.closeModal(); app.openTransactionModal('income')">
                <span style="font-size: 1.3rem;">📥</span>
                <div style="text-align: left;">
                  <div style="font-weight: 700; color: var(--income);">Record Income</div>
                  <small class="text-muted">Salary, sales, client payment</small>
                </div>
              </button>

              <button class="btn btn-secondary" style="justify-content: flex-start; gap: 14px;" onclick="app.closeModal(); app.openTransactionModal('expenses')">
                <span style="font-size: 1.3rem;">📤</span>
                <div style="text-align: left;">
                  <div style="font-weight: 700; color: var(--expense);">Record Expense</div>
                  <small class="text-muted">Food, bills, fuel, shopping</small>
                </div>
              </button>

              <button class="btn btn-secondary" style="justify-content: flex-start; gap: 14px;" onclick="app.closeModal(); app.openSavingsModal('deposit')">
                <span style="font-size: 1.3rem;">💰</span>
                <div style="text-align: left;">
                  <div style="font-weight: 700; color: var(--savings);">Add to Savings</div>
                  <small class="text-muted">Deposit into your savings</small>
                </div>
              </button>

              <button class="btn btn-secondary" style="justify-content: flex-start; gap: 14px;" onclick="app.closeModal(); app.openDebtModal('payables')">
                <span style="font-size: 1.3rem;">⏳</span>
                <div style="text-align: left;">
                  <div style="font-weight: 700; color: var(--payable);">Add Payable (I Owe)</div>
                  <small class="text-muted">Credit card, loans, rent dues</small>
                </div>
              </button>

              <button class="btn btn-secondary" style="justify-content: flex-start; gap: 14px;" onclick="app.closeModal(); app.openDebtModal('receivables')">
                <span style="font-size: 1.3rem;">🎯</span>
                <div style="text-align: left;">
                  <div style="font-weight: 700; color: var(--receivable);">Add Receivable (Owed)</div>
                  <small class="text-muted">Invoices, lending claims</small>
                </div>
              </button>
            </div>
          </div>
        </div>
      `;
      this.renderModal(modalHTML);
    });
  }

  // -------------------------------------------------------------------------
  // Settings & Cloud Sync
  // -------------------------------------------------------------------------
  saveSettings(event) {
    event.preventDefault();
    const url = document.getElementById('gasUrlInput').value.trim();
    CONFIG.GOOGLE_APPS_SCRIPT_URL = url;
    localStorage.setItem('cashflow_gas_url', url);
    this.updateCloudStatus();
    this.showToast('Settings saved successfully!', 'success');
    if (this.isLoginRequired() && !this.session) {
      this.showLoginScreen();
    }
  }

  async testCloudConnection() {
    const url = document.getElementById('gasUrlInput').value.trim();
    if (!url) {
      this.showToast('Please enter a Google Apps Script URL first', 'error');
      return;
    }
    this.showToast('Testing Google Sheets connection...', 'info');
    try {
      const res = await fetch(`${url}?action=testConnection`);
      const data = await res.json();
      if (data && data.success) {
        this.showToast('Google Sheets Connected Successfully!', 'success', '🚀');
      } else {
        this.showToast('Connection responded, but format unexpected.', 'info');
      }
    } catch (err) {
      this.showToast('Could not reach Google Apps Script. Check deployment permissions.', 'error');
    }
  }

  async syncFromCloudManual() {
    this.showToast('Syncing data from Google Sheets...', 'info');
    const ok = await store.pullFromCloud();
    if (ok) {
      this.showToast('Data refreshed from Google Sheets!', 'success');
      this.refreshCurrentView();
    } else {
      this.showToast('Cloud pull unsuccessful. Check network or script URL.', 'error');
    }
  }

  updateCloudStatus() {
    const statusText = document.getElementById('cloudStatusText');
    const dot = document.getElementById('cloudStatusDot');
    if (statusText && dot) {
      if (CONFIG.GOOGLE_APPS_SCRIPT_URL) {
        statusText.textContent = 'Google Cloud Active';
        dot.style.background = 'var(--income)';
      } else {
        statusText.textContent = 'Local Offline Mode';
        dot.style.background = 'var(--primary-light)';
      }
    }
  }

  exportLocalBackup() {
    const data = {
      income: store.getItems('income'),
      expenses: store.getItems('expenses'),
      payables: store.getItems('payables'),
      receivables: store.getItems('receivables'),
      savings: store.getItems('savings'),
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    this.showToast('Backup downloaded!', 'success');
  }

  confirmClearAll() {
    const modalHTML = `
      <div class="modal-backdrop" id="appModal">
        <div class="modal-container" style="max-width: 380px;">
          <div class="modal-header">
            <h3 class="modal-title">Clear All Data</h3>
            <button class="btn-icon" onclick="app.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 8px;">This will <strong>permanently delete all records</strong> (income, expenses, payables, receivables, savings).</p>
            <p class="text-muted" style="font-size: 0.85rem;">The app will start fresh and empty. This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
            <button class="btn btn-primary" style="background: var(--expense);" onclick="app.doClearAll()">Clear Everything</button>
          </div>
        </div>
      </div>
    `;
    this.renderModal(modalHTML);
  }

  doClearAll() {
    this.closeModal();
    const types = ['income', 'expenses', 'payables', 'receivables', 'savings'];
    types.forEach(type => store.saveItems(type, []));
    this.showToast('All data cleared.', 'success', '🧹');
    this.refreshCurrentView();
  }

  confirmLoadDemo() {
    const modalHTML = `
      <div class="modal-backdrop" id="appModal">
        <div class="modal-container" style="max-width: 380px;">
          <div class="modal-header">
            <h3 class="modal-title">Load Demo Data</h3>
            <button class="btn-icon" onclick="app.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 8px;">Replace current records with <strong>sample demo data</strong>?</p>
            <p class="text-muted" style="font-size: 0.85rem;">Your current records will be overwritten.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="app.doLoadDemo()">Load Demo</button>
          </div>
        </div>
      </div>
    `;
    this.renderModal(modalHTML);
  }

  loadDemoData() {
    this.confirmLoadDemo();
  }

  doLoadDemo() {
    this.closeModal();
    store.initDefaultData(true);
    this.showToast('Demo data loaded.', 'success');
    this.refreshCurrentView();
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Instantiate global app on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CashFlowApp();
});
