import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { Permission } from '@hynish/domain';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from './auth-gate';
import { RouteGuard } from './route-guard';

/** Lazy-load a named page export, code-splitting per feature module (Phase 1 §54). */
function page<M, K extends keyof M>(loader: () => Promise<M>, key: K) {
  return lazy(() =>
    loader().then((m) => ({ default: m[key] as ComponentType })),
  );
}

const DashboardPage = page(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage');
const PayrollPage = page(() => import('@/features/payroll/payroll-page'), 'PayrollPage');
const ReportsPage = page(() => import('@/features/reports/reports-page'), 'ReportsPage');

// Master data (Phase 4). Each entity: list / new / :id / :id/edit.
const ProductListPage = page(() => import('@/features/products/product-list-page'), 'ProductListPage');
const ProductFormPage = page(() => import('@/features/products/product-form-page'), 'ProductFormPage');
const ProductDetailPage = page(() => import('@/features/products/product-detail-page'), 'ProductDetailPage');
const CategoryListPage = page(() => import('@/features/products/category-list-page'), 'CategoryListPage');
const CustomerListPage = page(() => import('@/features/customers/customer-list-page'), 'CustomerListPage');
const CustomerFormPage = page(() => import('@/features/customers/customer-form-page'), 'CustomerFormPage');
const CustomerDetailPage = page(() => import('@/features/customers/customer-detail-page'), 'CustomerDetailPage');
const SupplierListPage = page(() => import('@/features/suppliers/supplier-list-page'), 'SupplierListPage');
const SupplierFormPage = page(() => import('@/features/suppliers/supplier-form-page'), 'SupplierFormPage');
const SupplierDetailPage = page(() => import('@/features/suppliers/supplier-detail-page'), 'SupplierDetailPage');
const LocationListPage = page(() => import('@/features/locations/location-list-page'), 'LocationListPage');
const LocationFormPage = page(() => import('@/features/locations/location-form-page'), 'LocationFormPage');
const LocationDetailPage = page(() => import('@/features/locations/location-detail-page'), 'LocationDetailPage');

// Sales (Phase 5).
const InvoiceListPage = page(() => import('@/features/sales/invoice-list-page'), 'InvoiceListPage');
const InvoiceFormPage = page(() => import('@/features/sales/invoice-form-page'), 'InvoiceFormPage');
const InvoiceDetailPage = page(() => import('@/features/sales/invoice-detail-page'), 'InvoiceDetailPage');
const InvoicePrintPage = page(() => import('@/features/sales/invoice-print-page'), 'InvoicePrintPage');
const QuotationListPage = page(() => import('@/features/sales/quotation-list-page'), 'QuotationListPage');
const QuotationFormPage = page(() => import('@/features/sales/quotation-form-page'), 'QuotationFormPage');
const QuotationDetailPage = page(() => import('@/features/sales/quotation-detail-page'), 'QuotationDetailPage');
const PaymentsPage = page(() => import('@/features/sales/payments-page'), 'PaymentsPage');
const DuesPage = page(() => import('@/features/sales/dues-page'), 'DuesPage');

// Inventory & Purchases (Phase 6).
const StockListPage = page(() => import('@/features/inventory/stock-list-page'), 'StockListPage');
const StockDetailPage = page(() => import('@/features/inventory/stock-detail-page'), 'StockDetailPage');
const MovementHistoryPage = page(() => import('@/features/inventory/movement-history-page'), 'MovementHistoryPage');
const TransferPage = page(() => import('@/features/inventory/transfer-page'), 'TransferPage');
const StockCountPage = page(() => import('@/features/inventory/stock-count-page'), 'StockCountPage');
const PurchaseListPage = page(() => import('@/features/purchases/purchase-list-page'), 'PurchaseListPage');
const PurchaseFormPage = page(() => import('@/features/purchases/purchase-form-page'), 'PurchaseFormPage');
const PurchaseDetailPage = page(() => import('@/features/purchases/purchase-detail-page'), 'PurchaseDetailPage');

// Accounting (Phase 7).
const ChartOfAccountsPage = page(() => import('@/features/accounting/chart-of-accounts-page'), 'ChartOfAccountsPage');
const JournalListPage = page(() => import('@/features/accounting/journal-list-page'), 'JournalListPage');
const JournalDetailPage = page(() => import('@/features/accounting/journal-detail-page'), 'JournalDetailPage');
const GeneralLedgerPage = page(() => import('@/features/accounting/general-ledger-page'), 'GeneralLedgerPage');
const TrialBalancePage = page(() => import('@/features/accounting/trial-balance-page'), 'TrialBalancePage');
const ProfitLossPage = page(() => import('@/features/accounting/profit-loss-page'), 'ProfitLossPage');
const BalanceSheetPage = page(() => import('@/features/accounting/balance-sheet-page'), 'BalanceSheetPage');
const PayablesPage = page(() => import('@/features/accounting/payables-page'), 'PayablesPage');
const CashBookPage = page(() => import('@/features/accounting/cash-book-page'), 'CashBookPage');
const ExpenseListPage = page(() => import('@/features/accounting/expense-list-page'), 'ExpenseListPage');
const ExpenseFormPage = page(() => import('@/features/accounting/expense-form-page'), 'ExpenseFormPage');
const ExpenseDetailPage = page(() => import('@/features/accounting/expense-detail-page'), 'ExpenseDetailPage');
const GstFilingPage = page(() => import('@/features/accounting/gst-filing-page'), 'GstFilingPage');

// Reports & Analytics (Phase 9).
const ShopComparisonPage = page(() => import('@/features/reports/shop-comparison-page'), 'ShopComparisonPage');

// Business Operations (Phase 8): Delivery Notes, Credit Notes (sales-return equivalent), Debit
// Notes (purchase-return equivalent). There is no separate "Sales Return"/"Purchase Return"
// document in the source — Credit/Debit Notes ARE that mechanism (docs/PHASE-8-COMPLETION.md).
const DeliveryNoteListPage = page(() => import('@/features/sales/delivery-note-list-page'), 'DeliveryNoteListPage');
const DeliveryNoteFormPage = page(() => import('@/features/sales/delivery-note-form-page'), 'DeliveryNoteFormPage');
const DeliveryNoteDetailPage = page(() => import('@/features/sales/delivery-note-detail-page'), 'DeliveryNoteDetailPage');
const CreditNoteListPage = page(() => import('@/features/sales/credit-note-list-page'), 'CreditNoteListPage');
const CreditNoteFormPage = page(() => import('@/features/sales/credit-note-form-page'), 'CreditNoteFormPage');
const CreditNoteDetailPage = page(() => import('@/features/sales/credit-note-detail-page'), 'CreditNoteDetailPage');
const DebitNoteListPage = page(() => import('@/features/purchases/debit-note-list-page'), 'DebitNoteListPage');
const DebitNoteFormPage = page(() => import('@/features/purchases/debit-note-form-page'), 'DebitNoteFormPage');
const DebitNoteDetailPage = page(() => import('@/features/purchases/debit-note-detail-page'), 'DebitNoteDetailPage');

const inv = () => import('@/features/inventory/inventory-pages');
const admin = () => import('@/features/admin/admin-pages');

const NotFoundPage = page(() => import('@/features/_shared/not-found-page'), 'NotFoundPage');
const DesignSystemPage = page(() => import('@/features/dev/design-system-page'), 'DesignSystemPage');

/** Wrap a lazily-loaded page in its permission guard. */
function guarded(Component: ComponentType, permission?: Permission) {
  return (
    <RouteGuard permission={permission}>
      <Component />
    </RouteGuard>
  );
}

const shellChildren: RouteObject[] = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: 'dashboard', element: guarded(DashboardPage, 'dashboard.view') },

  {
    path: 'sales',
    children: [
      { index: true, element: <Navigate to="/sales/invoices" replace /> },
      { path: 'new', element: guarded(InvoiceFormPage, 'sales.create') },
      { path: 'invoices', element: guarded(InvoiceListPage, 'sales.view') },
      { path: 'invoices/:id', element: guarded(InvoiceDetailPage, 'sales.view') },
      { path: 'invoices/:id/edit', element: guarded(InvoiceFormPage, 'sales.edit') },
      { path: 'invoices/:id/print', element: guarded(InvoicePrintPage, 'sales.view') },
      { path: 'quotations', element: guarded(QuotationListPage, 'quotations.view') },
      { path: 'quotations/new', element: guarded(QuotationFormPage, 'quotations.manage') },
      { path: 'quotations/:id', element: guarded(QuotationDetailPage, 'quotations.view') },
      { path: 'quotations/:id/edit', element: guarded(QuotationFormPage, 'quotations.manage') },
      { path: 'delivery-notes', element: guarded(DeliveryNoteListPage, 'deliveryNotes.view') },
      { path: 'delivery-notes/new', element: guarded(DeliveryNoteFormPage, 'deliveryNotes.manage') },
      { path: 'delivery-notes/:id', element: guarded(DeliveryNoteDetailPage, 'deliveryNotes.view') },
      { path: 'delivery-notes/:id/edit', element: guarded(DeliveryNoteFormPage, 'deliveryNotes.manage') },
      { path: 'credit-notes', element: guarded(CreditNoteListPage, 'sales.view') },
      { path: 'credit-notes/new', element: guarded(CreditNoteFormPage, 'creditNotes.manage') },
      { path: 'credit-notes/:id', element: guarded(CreditNoteDetailPage, 'sales.view') },
      { path: 'payments', element: guarded(PaymentsPage, 'payments.record') },
      { path: 'dues', element: guarded(DuesPage, 'dues.view') },
    ],
  },

  {
    path: 'inventory',
    children: [
      { index: true, element: <Navigate to="/inventory/products" replace /> },
      { path: 'products', element: guarded(ProductListPage, 'products.view') },
      { path: 'products/new', element: guarded(ProductFormPage, 'products.manage') },
      { path: 'products/:id', element: guarded(ProductDetailPage, 'products.view') },
      { path: 'products/:id/edit', element: guarded(ProductFormPage, 'products.manage') },
      { path: 'categories', element: guarded(CategoryListPage, 'products.view') },
      { path: 'stock', element: guarded(StockListPage, 'stock.view') },
      { path: 'stock/:productId', element: guarded(StockDetailPage, 'stock.view') },
      { path: 'movements', element: guarded(MovementHistoryPage, 'stock.view') },
      { path: 'stock-count', element: guarded(StockCountPage, 'stock.count') },
      { path: 'transfers', element: guarded(TransferPage, 'stock.transfer') },
      { path: 'reorder', element: guarded(page(inv, 'ReorderPage'), 'reorder.view') },
      { path: 'purchases', element: guarded(PurchaseListPage, 'purchases.view') },
      { path: 'purchases/new', element: guarded(PurchaseFormPage, 'purchases.manage') },
      { path: 'purchases/:id', element: guarded(PurchaseDetailPage, 'purchases.view') },
      { path: 'debit-notes', element: guarded(DebitNoteListPage, 'purchases.view') },
      { path: 'debit-notes/new', element: guarded(DebitNoteFormPage, 'debitNotes.manage') },
      { path: 'debit-notes/:id', element: guarded(DebitNoteDetailPage, 'purchases.view') },
      { path: 'suppliers', element: guarded(SupplierListPage, 'suppliers.view') },
      { path: 'suppliers/new', element: guarded(SupplierFormPage, 'suppliers.manage') },
      { path: 'suppliers/:id', element: guarded(SupplierDetailPage, 'suppliers.view') },
      { path: 'suppliers/:id/edit', element: guarded(SupplierFormPage, 'suppliers.manage') },
      { path: 'locations', element: guarded(LocationListPage, 'locations.manage') },
      { path: 'locations/new', element: guarded(LocationFormPage, 'locations.manage') },
      { path: 'locations/:id', element: guarded(LocationDetailPage, 'locations.manage') },
      { path: 'locations/:id/edit', element: guarded(LocationFormPage, 'locations.manage') },
    ],
  },

  {
    path: 'customers',
    children: [
      { index: true, element: guarded(CustomerListPage, 'customers.view') },
      { path: 'new', element: guarded(CustomerFormPage, 'customers.manage') },
      { path: ':id', element: guarded(CustomerDetailPage, 'customers.view') },
      { path: ':id/edit', element: guarded(CustomerFormPage, 'customers.manage') },
    ],
  },

  {
    path: 'accounting',
    children: [
      { index: true, element: <Navigate to="/accounting/chart-of-accounts" replace /> },
      { path: 'chart-of-accounts', element: guarded(ChartOfAccountsPage, 'accounting.view') },
      { path: 'journal', element: guarded(JournalListPage, 'accounting.view') },
      { path: 'journal/:id', element: guarded(JournalDetailPage, 'accounting.view') },
      { path: 'general-ledger', element: guarded(GeneralLedgerPage, 'accounting.view') },
      { path: 'trial-balance', element: guarded(TrialBalancePage, 'accounting.view') },
      { path: 'profit-loss', element: guarded(ProfitLossPage, 'accounting.view') },
      { path: 'balance-sheet', element: guarded(BalanceSheetPage, 'accounting.view') },
      { path: 'payables', element: guarded(PayablesPage, 'purchases.view') },
      { path: 'cash-book', element: guarded(CashBookPage, 'cashbook.view') },
      { path: 'expenses', element: guarded(ExpenseListPage, 'expenses.view') },
      { path: 'expenses/new', element: guarded(ExpenseFormPage, 'expenses.manage') },
      { path: 'expenses/:id', element: guarded(ExpenseDetailPage, 'expenses.view') },
      { path: 'expenses/:id/edit', element: guarded(ExpenseFormPage, 'expenses.manage') },
      { path: 'gst', element: guarded(GstFilingPage, 'gst.view') },
    ],
  },

  { path: 'payroll', element: guarded(PayrollPage, 'payroll.view') },
  {
    path: 'reports',
    children: [
      { index: true, element: guarded(ReportsPage, 'reports.view') },
      { path: 'shop-comparison', element: guarded(ShopComparisonPage, 'shopComparison.view') },
    ],
  },

  {
    path: 'admin',
    children: [
      { index: true, element: <Navigate to="/admin/settings" replace /> },
      { path: 'users', element: guarded(page(admin, 'UsersPage'), 'members.manage') },
      { path: 'activity', element: guarded(page(admin, 'ActivityPage'), 'activity.view') },
      { path: 'settings', element: guarded(page(admin, 'SettingsPage'), 'settings.manage') },
    ],
  },

  // Internal design-system reference (Phase 1 §48). Not linked in production navigation.
  { path: 'dev/design-system', element: <DesignSystemPage /> },

  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter([
  {
    // AuthGate resolves auth status and renders login / unauthorized / inactive / config
    // screens itself; the shell + pages render only when authorized (§44, §48).
    element: <AuthGate />,
    children: [{ path: '/', element: <AppShell />, children: shellChildren }],
  },
]);
