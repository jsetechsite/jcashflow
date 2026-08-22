# 📊 Google Sheets Backend Setup Guide for CashFlow PWA

Follow these simple steps to link your CashFlow PWA with your private Google Spreadsheet as the cloud database.

---

### Step 1: Create a Google Spreadsheet
1. Open [Google Sheets](https://sheets.new) in your browser.
2. Title the spreadsheet `CashFlow Database`.

---

### Step 2: Open Apps Script
1. In the top menu, click **Extensions** > **Apps Script**.
2. Erase any existing code in the editor and copy-paste the entire contents of [`Code.gs`](./Code.gs).

---

### Step 3: Initialize the Sheets
1. In the toolbar drop-down, select the function `setupSheets`.
2. Click **Run**.
3. Authorize Google permissions if prompted.
4. Go back to your Google Sheet — you will now see 4 tabs created:
   - `Income`
   - `Expenses`
   - `Payables`
   - `Receivables`

---

### Step 4: Deploy as Web App
1. At the top right of Apps Script, click **Deploy** > **New deployment**.
2. Click the gear icon ⚙️ next to *Select type* and choose **Web app**.
3. Fill in the fields:
   - **Description**: `CashFlow API v1`
   - **Execute as**: `Me (<your-email>)`
   - **Who has access**: `Anyone` *(Crucial so your PWA can send transactions)*
4. Click **Deploy**.
5. Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).

https://script.google.com/macros/s/AKfycbyyuGmoIjBJlXvPBYjUioRv_GXlbxSBSjfBn-0Qhj3xX-Hb164dT0bcYgsmkbjuuk3A/exec
---

### Step 5: Connect to your PWA
1. Open your CashFlow PWA in your browser.
2. Go to **Settings & Cloud** (or click the ⚙️ icon in the top header).
3. Paste the URL into the **Google Apps Script Web App URL** input.
4. Click **Save Settings** and then **Test Connection**!

🎉 **You're all set!** All new transactions, edits, settlements, and deletions will synchronize directly to your Google Sheets spreadsheet in real time.
