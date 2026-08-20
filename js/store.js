/**
 * CashFlow PWA — Store & Data Synchronization Layer
 * Seamlessly manages local state, IndexedDB/LocalStorage, and Google Sheets Apps Script API.
 */
class CashFlowStore {
  constructor() {
    // NOTE: demo data is NOT auto-seeded anymore. The app starts clean;
    // demo records are only added on-demand via "Load Demo Data".
  }

  // Pre-seed sample transactions (used by the "Load Demo Data" action)
  initDefaultData(force = false) {
    const today = new Date().toISOString().split('T')[0];
    const pastDate = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };
    const futureDate = (daysAhead) => {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      return d.toISOString().split('T')[0];
    };

    if (force || !localStorage.getItem(CONFIG.STORAGE_KEYS.INCOME)) {
      const sampleIncome = [
        { id: 'INC-101', date: pastDate(2), description: 'Tech Consulting Client A', category: 'Freelance', amount: 45000, payment_method: 'Bank Transfer', notes: 'Monthly retainer' },
        { id: 'INC-102', date: pastDate(12), description: 'Bi-Monthly Salary', category: 'Salary', amount: 35000, payment_method: 'Bank Transfer', notes: 'Direct deposit' },
        { id: 'INC-103', date: today, description: 'E-commerce Store Sales', category: 'Business / Sales', amount: 8500, payment_method: 'GCash', notes: 'Daily payout' }
      ];
      localStorage.setItem(CONFIG.STORAGE_KEYS.INCOME, JSON.stringify(sampleIncome));
    }

    if (force || !localStorage.getItem(CONFIG.STORAGE_KEYS.EXPENSES)) {
      const sampleExpenses = [
        { id: 'EXP-201', date: pastDate(1), description: 'Supermarket Grocery Run', category: 'Food & Dining', amount: 4250, payment_method: 'Credit Card', notes: 'Weekly pantry replenishment' },
        { id: 'EXP-202', date: pastDate(4), description: 'Electricity & Internet Bill', category: 'Utilities & Bills', amount: 5800, payment_method: 'Maya', notes: 'Fiber broadband & Meralco' },
        { id: 'EXP-203', date: pastDate(8), description: 'Car Fuel & Express toll', category: 'Transportation', amount: 2600, payment_method: 'Cash', notes: 'RFID reload' },
        { id: 'EXP-204', date: today, description: 'Team Lunch & Coffee', category: 'Food & Dining', amount: 1450, payment_method: 'GCash', notes: 'Client catchup' }
      ];
      localStorage.setItem(CONFIG.STORAGE_KEYS.EXPENSES, JSON.stringify(sampleExpenses));
    }

    if (force || !localStorage.getItem(CONFIG.STORAGE_KEYS.PAYABLES)) {
      const samplePayables = [
        { id: 'PAY-301', date_incurred: pastDate(15), due_date: futureDate(5), description: 'BDO Platinum Credit Card', creditor: 'BDO Unibank', amount: 18500, amount_paid: 5000, status: 'Partial', notes: 'Statement balance' },
        { id: 'PAY-302', date_incurred: pastDate(5), due_date: futureDate(10), description: 'Office Studio Rent', creditor: 'Greenfield Realty', amount: 20000, amount_paid: 0, status: 'Pending', notes: 'August lease' }
      ];
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAYABLES, JSON.stringify(samplePayables));
    }

    if (force || !localStorage.getItem(CONFIG.STORAGE_KEYS.RECEIVABLES)) {
      const sampleReceivables = [
        { id: 'REC-401', date_incurred: pastDate(10), due_date: futureDate(7), description: 'Mobile App UI/UX Design Sprint', debtor: 'Nexus Studio', amount: 35000, amount_received: 15000, status: 'Partial', notes: 'Milestone 2 pending collection' },
        { id: 'REC-402', date_incurred: pastDate(20), due_date: futureDate(14), description: 'Brand Identity Package', debtor: 'Starlight Cafe', amount: 18000, amount_received: 0, status: 'Pending', notes: 'Final sign-off invoice' }
      ];
      localStorage.setItem(CONFIG.STORAGE_KEYS.RECEIVABLES, JSON.stringify(sampleReceivables));
    }

    if (force || !localStorage.getItem(CONFIG.STORAGE_KEYS.SAVINGS)) {
      const sampleSavings = [
        { id: 'SAV-501', date: pastDate(20), description: 'Monthly Auto-Save', type: 'deposit', amount: 10000, category: 'Emergency Fund', notes: 'Automatic transfer from payroll' },
        { id: 'SAV-502', date: pastDate(9), description: 'Freelance Windfall Set Aside', type: 'deposit', amount: 15000, category: 'Future Goals', notes: '50% of consulting fee' },
        { id: 'SAV-503', date: pastDate(3), description: 'Emergency Vet Bill', type: 'withdrawal', amount: 4500, category: 'Emergency Fund', notes: 'Unexpected pet care' }
      ];
      localStorage.setItem(CONFIG.STORAGE_KEYS.SAVINGS, JSON.stringify(sampleSavings));
    }
  }

  // Get items by collection type
  getItems(type) {
    const key = CONFIG.STORAGE_KEYS[type.toUpperCase()];
    if (!key) return [];
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      console.error(`Error parsing ${type}:`, e);
      return [];
    }
  }

  // Save items
  saveItems(type, items) {
    const key = CONFIG.STORAGE_KEYS[type.toUpperCase()];
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cashflow:data-changed', { detail: { type } }));
  }

  // Add Item
  async addItem(type, item) {
    item.id = item.id || `${type.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    item.created_at = new Date().toISOString();
    
    // Convert numeric amounts
    if (item.amount) item.amount = parseFloat(item.amount) || 0;
    if (item.amount_paid) item.amount_paid = parseFloat(item.amount_paid) || 0;
    if (item.amount_received) item.amount_received = parseFloat(item.amount_received) || 0;

    const items = this.getItems(type);
    items.unshift(item);
    this.saveItems(type, items);

    // If Google Apps Script endpoint is configured, post to cloud asynchronously
    if (CONFIG.GOOGLE_APPS_SCRIPT_URL) {
      this.syncToCloud('add', type, item).catch(err => console.warn('Cloud sync offline/failed:', err));
    }

    return item;
  }

  // Update Item
  async updateItem(type, id, updatedFields) {
    const items = this.getItems(type);
    const index = items.findIndex(x => x.id === id);
    if (index !== -1) {
      if (updatedFields.amount) updatedFields.amount = parseFloat(updatedFields.amount) || 0;
      if (updatedFields.amount_paid !== undefined) updatedFields.amount_paid = parseFloat(updatedFields.amount_paid) || 0;
      if (updatedFields.amount_received !== undefined) updatedFields.amount_received = parseFloat(updatedFields.amount_received) || 0;

      items[index] = { ...items[index], ...updatedFields, updated_at: new Date().toISOString() };
      this.saveItems(type, items);

      if (CONFIG.GOOGLE_APPS_SCRIPT_URL) {
        this.syncToCloud('update', type, items[index]).catch(err => console.warn('Cloud sync error:', err));
      }
      return items[index];
    }
    return null;
  }

  // Delete Item
  async deleteItem(type, id) {
    let items = this.getItems(type);
    items = items.filter(x => x.id !== id);
    this.saveItems(type, items);

    if (CONFIG.GOOGLE_APPS_SCRIPT_URL) {
      this.syncToCloud('delete', type, { id }).catch(err => console.warn('Cloud sync error:', err));
    }
    return true;
  }

  // Calculate Metrics & Financial KPIs
  getFinancialSummary() {
    const incomeList = this.getItems('income');
    const expenseList = this.getItems('expenses');
    const payableList = this.getItems('payables');
    const receivableList = this.getItems('receivables');
    const savingsList = this.getItems('savings');

    const totalIncome = incomeList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpenses = expenseList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const netCashflow = totalIncome - totalExpenses;

    const totalPayables = payableList.reduce((acc, curr) => {
      const remaining = (Number(curr.amount) || 0) - (Number(curr.amount_paid) || 0);
      return acc + (remaining > 0 ? remaining : 0);
    }, 0);

    const totalReceivables = receivableList.reduce((acc, curr) => {
      const remaining = (Number(curr.amount) || 0) - (Number(curr.amount_received) || 0);
      return acc + (remaining > 0 ? remaining : 0);
    }, 0);

    const totalDeposits = savingsList.reduce((acc, curr) =>
      acc + (curr.type === 'withdrawal' ? 0 : (Number(curr.amount) || 0)), 0);
    const totalWithdrawals = savingsList.reduce((acc, curr) =>
      acc + (curr.type === 'withdrawal' ? (Number(curr.amount) || 0) : 0), 0);

    return {
      totalIncome,
      totalExpenses,
      netCashflow,
      totalPayables,
      totalReceivables,
      totalSavings: totalDeposits - totalWithdrawals,
      totalDeposits,
      totalWithdrawals,
      incomeCount: incomeList.length,
      expenseCount: expenseList.length,
      payableCount: payableList.length,
      receivableCount: receivableList.length,
      savingsCount: savingsList.length
    };
  }

  // -------------------------------------------------------------------------
  // Login & Session (cloud-only login gate; credentials are verified server-side)
  // -------------------------------------------------------------------------

  // POST { action: 'login', username, password } to the Apps Script backend
  async login(username, password) {
    if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) return { success: false, error: 'Cloud sync is not configured.' };
    try {
      const response = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', username, password })
      });
      return await response.json();
    } catch (err) {
      console.warn('Login request failed:', err);
      return { success: false, error: 'Could not reach the login server.' };
    }
  }

  // POST { action: 'register', username, password } to the Apps Script backend
  // Creates the account on the caller's own Users sheet.
  async register(username, password) {
    if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) return { success: false, error: 'Cloud sync is not configured.' };
    try {
      const response = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', username, password })
      });
      return await response.json();
    } catch (err) {
      console.warn('Registration request failed:', err);
      return { success: false, error: 'Could not reach the registration server.' };
    }
  }

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION)) || null;
    } catch (e) {
      return null;
    }
  }

  saveSession(username) {
    const session = { username, logged_in_at: new Date().toISOString() };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(session));
    return session;
  }

  clearSession() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
  }

  // Sync to Google Apps Script Web App
  async syncToCloud(action, type, payload) {
    if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) return;
    try {
      const response = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, collection: type, ...payload })
      });
      return await response.json();
    } catch (err) {
      console.warn('Sync to Google Sheets encountered an issue:', err);
      throw err;
    }
  }

  // Fetch full data from Google Sheets Cloud
  async pullFromCloud() {
    if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) return false;
    try {
      const response = await fetch(`${CONFIG.GOOGLE_APPS_SCRIPT_URL}?action=fetchAll`);
      const data = await response.json();
      if (data && data.success) {
        if (data.income) this.saveItems('income', data.income);
        if (data.expenses) this.saveItems('expenses', data.expenses);
        if (data.payables) this.saveItems('payables', data.payables);
        if (data.receivables) this.saveItems('receivables', data.receivables);
        if (data.savings) this.saveItems('savings', data.savings);
        return true;
      }
    } catch (err) {
      console.error('Failed to pull from Google Sheets:', err);
    }
    return false;
  }
}

window.store = new CashFlowStore();
