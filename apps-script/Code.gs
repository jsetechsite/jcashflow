/**
 * ============================================================================
 * CashFlow PWA — Google Apps Script Backend
 * ============================================================================
 * Instructions:
 * 1. Create a new Google Spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Replace all contents in Code.gs with this script.
 * 4. Run `setupSheets()` once to auto-create all tabs & header rows!
 * 5. Click Deploy > New deployment > Select type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL and paste it into your CashFlow PWA Settings!
 */

// Tab Names
const SHEET_INCOME = 'Income';
const SHEET_EXPENSES = 'Expenses';
const SHEET_PAYABLES = 'Payables';
const SHEET_RECEIVABLES = 'Receivables';
const SHEET_SAVINGS = 'Savings';
const SHEET_USERS = 'Users';

/**
 * Auto-initialize Google Spreadsheet Structure & Headers
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const schemas = [
    {
      name: SHEET_INCOME,
      headers: ['id', 'date', 'description', 'category', 'amount', 'payment_method', 'notes', 'created_at']
    },
    {
      name: SHEET_EXPENSES,
      headers: ['id', 'date', 'description', 'category', 'amount', 'payment_method', 'notes', 'created_at']
    },
    {
      name: SHEET_PAYABLES,
      headers: ['id', 'date_incurred', 'due_date', 'description', 'creditor', 'amount', 'amount_paid', 'status', 'notes', 'created_at', 'updated_at']
    },
    {
      name: SHEET_RECEIVABLES,
      headers: ['id', 'date_incurred', 'due_date', 'description', 'debtor', 'amount', 'amount_received', 'status', 'notes', 'created_at', 'updated_at']
    },
    {
      name: SHEET_SAVINGS,
      headers: ['id', 'date', 'description', 'type', 'amount', 'category', 'notes', 'created_at']
    },
    {
      name: SHEET_USERS,
      headers: ['username', 'password_hash', 'created_at']
    }
  ];

  schemas.forEach(schema => {
    let sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(schema.headers);
      sheet.getRange(1, 1, 1, schema.headers.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });

  Logger.log('✅ CashFlow Sheets initialized successfully!');
}

/**
 * Add a login user (run this from the Apps Script editor, NOT via the API).
 * Passwords are stored as a salted SHA-256 hash — never plaintext.
 * Example: addUser('admin', 's3cretpass')
 */
function addUser(username, password) {
  if (!username || !password) throw new Error('Username and password are required.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) throw new Error(`Sheet "${SHEET_USERS}" not found. Run setupSheets() first.`);

  const usernames = sheet.getDataRange().getValues().map(row => String(row[0]).toLowerCase()).slice(1);
  if (usernames.includes(String(username).toLowerCase())) {
    throw new Error(`User "${username}" already exists.`);
  }

  sheet.appendRow([username, hashPassword(username, password), new Date()]);
  Logger.log(`✅ User "${username}" created.`);
}

/**
 * Remove a login user (run from the Apps Script editor).
 */
function removeUser(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      sheet.deleteRow(i + 1);
      Logger.log(`✅ User "${username}" removed.`);
      return;
    }
  }
  throw new Error(`User "${username}" not found.`);
}

/**
 * SHA-256 hash of username + '|' + password (username doubles as the salt).
 */
function hashPassword(username, password) {
  const raw = String(username) + '|' + String(password);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(byte => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
}

/**
 * Verify credentials against the Users sheet.
 */
function verifyCredentials(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet || sheet.getLastRow() <= 1) return false;

  const values = sheet.getDataRange().getValues();
  const targetHash = hashPassword(username, password);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(username).toLowerCase() &&
        String(values[i][1]) === targetHash) {
      return true;
    }
  }
  return false;
}

/**
 * Handle HTTP GET Requests (Read data, fetch summaries)
 */
function doGet(e) {
  try {
    const action = e?.parameter?.action || 'testConnection';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'checkCapabilities') {
      return respondJSON({ success: true, version: '1.7.3', features: ['collection-routing', 'register', 'savings'] });
    }

    if (action === 'testConnection') {
      return respondJSON({ success: true, message: 'CashFlow Google Apps Script is online!' });
    }

    if (action === 'fetchAll') {
      return respondJSON({
        success: true,
        income: getSheetData(ss, SHEET_INCOME),
        expenses: getSheetData(ss, SHEET_EXPENSES),
        payables: getSheetData(ss, SHEET_PAYABLES),
        receivables: getSheetData(ss, SHEET_RECEIVABLES),
        savings: getSheetData(ss, SHEET_SAVINGS)
      });
    }

    if (action === 'list') {
      const type = e.parameter.type || 'income';
      const sheetName = getSheetNameByType(type);
      if (!sheetName) {
        return respondJSON({ success: false, error: `Unknown type "${type}"` });
      }
      const data = getSheetData(ss, sheetName);
      return respondJSON({ success: true, type, data });
    }

    return respondJSON({ success: false, error: 'Unknown GET action' });
  } catch (err) {
    return respondJSON({ success: false, error: err.toString() });
  }
}

/**
 * Handle HTTP POST Requests (Create, Update, Delete)
 */
function doPost(e) {
  try {
    const postData = e.postData?.contents ? JSON.parse(e.postData.contents) : e.parameter;
    const action = postData.action || 'add';

    // Login does not require a data sheet
    if (action === 'login') {
      const username = String(postData.username || '');
      const password = String(postData.password || '');
      if (!username || !password) {
        return respondJSON({ success: false, error: 'Username and password are required.' });
      }
      if (verifyCredentials(username, password)) {
        return respondJSON({ success: true, username });
      }
      return respondJSON({ success: false, error: 'Invalid username or password.' });
    }

    // Self-service registration (writes to the caller's own Users sheet)
    if (action === 'register') {
      const username = String(postData.username || '').trim();
      const password = String(postData.password || '');
      if (!username || !password) {
        return respondJSON({ success: false, error: 'Username and password are required.' });
      }
      if (username.length < 3) {
        return respondJSON({ success: false, error: 'Username must be at least 3 characters.' });
      }
      if (password.length < 4) {
        return respondJSON({ success: false, error: 'Password must be at least 4 characters.' });
      }
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_USERS);
      if (!sheet) {
        return respondJSON({ success: false, error: 'Users sheet not found. Run setupSheets() in your Apps Script editor first.' });
      }
      const usernames = sheet.getDataRange().getValues().map(row => String(row[0]).toLowerCase()).slice(1);
      if (usernames.includes(username.toLowerCase())) {
        return respondJSON({ success: false, error: `User "${username}" already exists.` });
      }
      sheet.appendRow([username, hashPassword(username, password), new Date()]);
      return respondJSON({ success: true, username });
    }

    const type = postData.collection || postData.type || 'income';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getSheetNameByType(type);

    if (!sheetName) {
      return respondJSON({ success: false, error: `Unknown data type "${type}"` });
    }

    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return respondJSON({ success: false, error: `Sheet ${sheetName} not found` });
    }

    if (action === 'add') {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = headers.map(h => postData[h] !== undefined ? postData[h] : '');
      sheet.appendRow(newRow);
      return respondJSON({ success: true, action: 'add', record: postData });
    }

    if (action === 'update') {
      const id = postData.id;
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idColIdx = headers.indexOf('id');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idColIdx]) === String(id)) {
          headers.forEach((h, colIdx) => {
            if (postData[h] !== undefined) {
              sheet.getRange(i + 1, colIdx + 1).setValue(postData[h]);
            }
          });
          return respondJSON({ success: true, action: 'update', id });
        }
      }
      return respondJSON({ success: false, error: 'Record not found for update' });
    }

    if (action === 'delete') {
      const id = postData.id;
      const data = sheet.getDataRange().getValues();
      const idColIdx = data[0].indexOf('id');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idColIdx]) === String(id)) {
          sheet.deleteRow(i + 1);
          return respondJSON({ success: true, action: 'delete', id });
        }
      }
      return respondJSON({ success: false, error: 'Record not found for deletion' });
    }

    return respondJSON({ success: false, error: 'Unknown POST action' });
  } catch (err) {
    return respondJSON({ success: false, error: err.toString() });
  }
}

/**
 * Helpers
 */
function getSheetNameByType(type) {
  const map = {
    income: SHEET_INCOME,
    expenses: SHEET_EXPENSES,
    payables: SHEET_PAYABLES,
    receivables: SHEET_RECEIVABLES,
    savings: SHEET_SAVINGS
  };
  return map[String(type || '').toLowerCase()] || null;
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();

  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val;
    });
    return obj;
  });
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
