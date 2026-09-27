import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { Permission } from '@hynish/domain';
import { AppShell } from '@/components/layout/app-shell';
import { RouteGuard } from './route-guard';

/** Lazy-load a named page export, code-splitting per feature module (Phase 1 §54). */
function page<M, K extends keyof M>(loader: () => Promise<M>, key: K) {
  return lazy(() =>
    loader().then((m) => ({ default: m[key] as ComponentType })),
  );
}

const DashboardPage = page(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage');
const CustomersPage = page(() => import('@/features/customers/customers-page'), 'CustomersPage');
const PayrollPage = page(() => import('@/features/payroll/payroll-page'), 'PayrollPage');
const ReportsPage = page(() => import('@/features/reports/reports-page'), 'ReportsPage');

const sales = () => import('@/features/sales/sales-pages');
const inv = () => import('@/features/inventory/inventory-pages');
const acc = () => import('@/features/accounting/accounting-pages');
const admin = () => import('@/features/admin/admin-pages');

const LoginPage = page(() => import('@/features/auth/login-page'), 'LoginPage');
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
      { path: 'new', element: guarded(page(sales, 'NewInvoicePage'), 'sales.create') },
      { path: 'invoices', element: guarded(page(sales, 'InvoicesPage'), 'sales.view') },
      { path: 'quotations', element: guarded(page(sales, 'QuotationsPage'), 'quotations.view') },
      { path: 'delivery-notes', element: guarded(page(sales, 'DeliveryNotesPage'), 'deliveryNotes.view') },
      { path: 'credit-notes', element: guarded(page(sales, 'CreditNotesPage'), 'creditNotes.manage') },
      { path: 'debit-notes', element: guarded(page(sales, 'DebitNotesPage'), 'debitNotes.manage') },
      { path: 'payments', element: guarded(page(sales, 'PaymentsPage'), 'payments.record') },
      { path: 'dues', element: guarded(page(sales, 'DuesPage'), 'dues.view') },
    ],
  },

  {
    path: 'inventory',
    children: [
      { index: true, element: <Navigate to="/inventory/products" replace /> },
      { path: 'products', element: guarded(page(inv, 'ProductsPage'), 'products.view') },
      { path: 'stock', element: guarded(page(inv, 'StockPage'), 'stock.view') },
      { path: 'stock-count', element: guarded(page(inv, 'StockCountPage'), 'stock.count') },
      { path: 'transfers', element: guarded(page(inv, 'TransfersPage'), 'stock.transfer') },
      { path: 'reorder', element: guarded(page(inv, 'ReorderPage'), 'reorder.view') },
      { path: 'purchases', element: guarded(page(inv, 'PurchasesPage'), 'purchases.view') },
      { path: 'suppliers', element: guarded(page(inv, 'SuppliersPage'), 'suppliers.view') },
      { path: 'locations', element: guarded(page(inv, 'LocationsPage'), 'locations.manage') },
    ],
  },

  { path: 'customers', element: guarded(CustomersPage, 'customers.view') },

  {
    path: 'accounting',
    children: [
      { index: true, element: <Navigate to="/accounting/chart-of-accounts" replace /> },
      { path: 'chart-of-accounts', element: guarded(page(acc, 'ChartOfAccountsPage'), 'accounting.view') },
      { path: 'journal', element: guarded(page(acc, 'JournalPage'), 'accounting.view') },
      { path: 'general-ledger', element: guarded(page(acc, 'GeneralLedgerPage'), 'accounting.view') },
      { path: 'trial-balance', element: guarded(page(acc, 'TrialBalancePage'), 'accounting.view') },
      { path: 'profit-loss', element: guarded(page(acc, 'ProfitLossPage'), 'accounting.view') },
      { path: 'balance-sheet', element: guarded(page(acc, 'BalanceSheetPage'), 'accounting.view') },
      { path: 'cash-book', element: guarded(page(acc, 'CashBookPage'), 'cashbook.view') },
      { path: 'expenses', element: guarded(page(acc, 'ExpensesPage'), 'expenses.view') },
      { path: 'gst', element: guarded(page(acc, 'GstFilingPage'), 'gst.view') },
    ],
  },

  { path: 'payroll', element: guarded(PayrollPage, 'payroll.view') },
  { path: 'reports', element: guarded(ReportsPage, 'reports.view') },

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
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <AppShell />, children: shellChildren },
]);
