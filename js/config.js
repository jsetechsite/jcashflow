/**
 * CashFlow PWA — Global Configuration & Constants
 */
const CONFIG = {
  // Replace this with your deployed Google Apps Script Web App URL:
  // Example: "https://script.google.com/macros/s/AKfycbx.../exec"
  GOOGLE_APPS_SCRIPT_URL: localStorage.getItem('cashflow_gas_url') || '',

  CURRENCY_SYMBOL: '₱',
  CURRENCY_CODE: 'PHP',
  APP_VERSION: '1.5.0',

  CATEGORIES: {
    income: [
      'Salary',
      'Freelance',
      'Business / Sales',
      'Investments',
      'Rental Income',
      'Gifts / Bonus',
      'Other Income'
    ],
    savings: [
      'Emergency Fund',
      'Future Goals',
      'Investments',
      'Sinking Fund',
      'Other Savings'
    ],
    expenses: [
      'Food & Dining',
      'Transportation',
      'Utilities & Bills',
      'Housing & Rent',
      'Shopping & Supplies',
      'Health & Medical',
      'Entertainment',
      'Education',
      'Personal Care',
      'Other Expense'
    ],
    payables: [
      'Credit Card',
      'Bank Loan',
      'Personal Loan',
      'Supplier / Vendor',
      'Tax Payable',
      'Rent / Lease',
      'Other Payable'
    ],
    receivables: [
      'Client Invoice',
      'Personal Lending',
      'Project Milestone',
      'Sales Credit',
      'Security Deposit Refund',
      'Other Receivable'
    ]
  },

  PAYMENT_METHODS: [
    'Cash',
    'Bank Transfer',
    'GCash',
    'Maya',
    'Credit Card',
    'Debit Card',
    'Check'
  ],

  STORAGE_KEYS: {
    INCOME: 'cashflow_income_v1',
    EXPENSES: 'cashflow_expenses_v1',
    PAYABLES: 'cashflow_payables_v1',
    RECEIVABLES: 'cashflow_receivables_v1',
    SAVINGS: 'cashflow_savings_v1',
    SETTINGS: 'cashflow_settings_v1',
    SESSION: 'cashflow_session_v1'
  }
};

window.CONFIG = CONFIG;
