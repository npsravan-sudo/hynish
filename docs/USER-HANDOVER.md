# User Handover — Hynish ERP v1.0.0

**For:** Business Owner / Administrator  
**Date:** 2026-09-29

---

## What Is This System?

Hynish ERP is the rebuilt version of your Hynish Clothing Wholesale Ledger (v2.86.1). It runs in your web browser and works offline when your internet is down. All your business data is stored securely in Google Firebase.

---

## Getting Started

### Accessing the App

Open the URL provided by your IT team in Chrome, Edge, or Safari. The app works best on desktop but is usable on mobile too.

To install it as an app on your phone or computer:
- **Chrome/Edge:** Click the install icon in the address bar (or "Add to Home Screen" on mobile)
- **Safari (iOS):** Share → Add to Home Screen

### First Login

Your administrator will create your account. You will receive your email and temporary password. Log in and change your password on first use.

---

## Key Features

### Sales — Invoices & Quotations

- **New Invoice:** Tap New Invoice from the Sales menu. By default it opens as a **Non-GST invoice**. Switch to GST if needed — the invoice series is separate.
- **GST vs Non-GST:** Invoice number series are separate (INV-001 for Non-GST; INV-GST-001 for GST). This matches legacy behavior.
- **Payments:** Record a payment against any outstanding invoice from the invoice detail page.
- **Quotations:** Create quotations from the Sales → Quotations menu. Convert to invoice when confirmed.

### Purchases

- **New Purchase:** Raises a purchase bill. Stock is automatically updated when the purchase is finalized.
- **Debit Notes:** For purchase returns. Creates a debit note and reverses stock if required.

### Inventory

- **Stock Adjustment:** Correct stock levels (wastage, found stock, etc.) from Inventory → Adjustments.
- **Stock Transfer:** Move stock between locations from Inventory → Transfers.
- **Stock Count:** Conduct a physical count and reconcile from Inventory → Counts.
- **Opening Stock:** Post opening stock balances for a new location or period.

### Accounting

- **Chart of Accounts:** View and manage your accounts under Accounting → Accounts.
- **Cash Book:** Record cash receipts and payments from Accounting → Cash Book.
- **Journal Entries:** View auto-posted journals from all transactions. Manual journal entry is not available (by design — all entries come from business transactions).
- **Reports:** Trial Balance, Profit & Loss, Balance Sheet available from Accounting menu.
- **Expenses:** Record business expenses (rent, utilities, etc.) from Operations → Expenses.

### Operations

- **Delivery Notes:** Attach delivery information to invoices from Operations → Delivery Notes.
- **Credit Notes:** Process sales returns from Operations → Credit Notes.

### Reports

- **Dashboard:** Sales KPIs, recent activity, stock alerts.
- **Sales Report:** Period-wise sales summary with GST breakdown.
- **GST Filing:** Monthly GSTR-1/3B summary for filing.
- **Shop Comparison:** Compare performance across locations.
- **Expense Report / Cash Report:** Period-wise expense and cash summaries.

---

## User Roles

| Role | What They Can Do |
|------|-----------------|
| Owner | Everything, including settings, members, migration |
| Manager | Sales, purchases, inventory, accounting, reports |
| Staff | Sales entry, purchase entry, basic inventory |
| Viewer | Read-only access to all data |

The owner can add/remove team members and change their roles from Settings → Team.

---

## Settings

- **Business Settings:** Company name, address, GST number, bank details, tax rates — from Settings → Business.
- **Integrations:** WhatsApp/SMS settings — from Settings → Integrations.
- **Backup:** Download a backup of all your data from Settings → Backup.

---

## Offline Mode

The app works offline. You can view any page you have previously loaded. New entries (invoices, purchases, etc.) require an internet connection to submit — the app will show an error if you try while offline.

Your data syncs automatically when you come back online.

---

## Data Migration from Legacy System

If you are migrating from the old Hynish ERP (v2.86.1):

1. Contact your IT team to run the migration tool.
2. The migration tool has a **dry-run mode** — it reads your old data and produces a report without changing anything. Review the report first.
3. Once the dry-run report looks correct, run the migration in live mode. This copies all historical invoices, purchases, customers, suppliers, products, stock, journals, and payments.
4. After migration, verify the financial totals in the migration report against your legacy system reports.
5. The migration can only run once (a safety lock prevents accidental re-run).

---

## Getting Help

- For technical issues, contact your IT administrator.
- For business queries about behavior differences from the old system, consult `docs/LEGACY-COMPATIBILITY.md` (for your IT team).
- For feature requests or bugs, file them in the GitHub repository.

---

## Important Notes

- **Money values** are always in Indian Rupees (₹). The system stores paise internally for accuracy — you always see rupees.
- **Document numbers** are auto-assigned by the server and cannot be changed. This ensures audit integrity.
- **Deleted invoices / purchases** are soft-deleted and their journals are reversed. They remain in the system for audit purposes.
- **GST** calculations follow the rates configured in your product and business settings.
