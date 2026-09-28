/**
 * Navigation configuration (ARCHITECTURE §3.3). Single source for the sidebar groups,
 * breadcrumbs and mobile navigation. Each item declares the permission it requires; the
 * shell filters through the session's permission resolver, and empty groups are dropped
 * (legacy parity, LC-50.7). Icons are Lucide (Phase 1 §10 — no emoji).
 */
import type { Permission } from '@hynish/domain';
import {
  LayoutDashboard,
  ReceiptIndianRupee,
  FilePlus2,
  FileText,
  FileSpreadsheet,
  Truck,
  FileMinus,
  FilePlus,
  Wallet,
  CircleDollarSign,
  Boxes,
  Package,
  Tags,
  Warehouse,
  ClipboardCheck,
  ArrowLeftRight,
  RefreshCw,
  ShoppingCart,
  Factory,
  MapPin,
  Users,
  Calculator,
  BookOpen,
  BookText,
  Scale,
  TrendingUp,
  Landmark,
  Banknote,
  Coins,
  FileCheck2,
  BadgeIndianRupee,
  BarChart3,
  ShieldCheck,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
  /** Show in the mobile "More" sheet; primary destinations use the bottom bar instead. */
  end?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true }],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ReceiptIndianRupee,
    items: [
      { label: 'New Invoice', to: '/sales/new', icon: FilePlus2, permission: 'sales.create' },
      { label: 'Invoices', to: '/sales/invoices', icon: FileText, permission: 'sales.view' },
      { label: 'Quotations', to: '/sales/quotations', icon: FileSpreadsheet, permission: 'quotations.view' },
      { label: 'Delivery Notes', to: '/sales/delivery-notes', icon: Truck, permission: 'deliveryNotes.view' },
      { label: 'Credit Notes', to: '/sales/credit-notes', icon: FileMinus, permission: 'creditNotes.manage' },
      { label: 'Debit Notes', to: '/sales/debit-notes', icon: FilePlus, permission: 'debitNotes.manage' },
      { label: 'Payments', to: '/sales/payments', icon: Wallet, permission: 'payments.record' },
      { label: 'Dues', to: '/sales/dues', icon: CircleDollarSign, permission: 'dues.view' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    items: [
      { label: 'Products', to: '/inventory/products', icon: Package, permission: 'products.view' },
      { label: 'Categories', to: '/inventory/categories', icon: Tags, permission: 'products.view' },
      { label: 'Stock', to: '/inventory/stock', icon: Warehouse, permission: 'stock.view' },
      { label: 'Movements', to: '/inventory/movements', icon: History, permission: 'stock.view' },
      { label: 'Stock Count', to: '/inventory/stock-count', icon: ClipboardCheck, permission: 'stock.count' },
      { label: 'Transfers', to: '/inventory/transfers', icon: ArrowLeftRight, permission: 'stock.transfer' },
      { label: 'Reorder', to: '/inventory/reorder', icon: RefreshCw, permission: 'reorder.view' },
      { label: 'Purchases', to: '/inventory/purchases', icon: ShoppingCart, permission: 'purchases.view' },
      { label: 'Suppliers', to: '/inventory/suppliers', icon: Factory, permission: 'suppliers.view' },
      { label: 'Locations', to: '/inventory/locations', icon: MapPin, permission: 'locations.manage' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    items: [{ label: 'Customers', to: '/customers', icon: Users, permission: 'customers.view', end: true }],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: Calculator,
    items: [
      { label: 'Chart of Accounts', to: '/accounting/chart-of-accounts', icon: BookOpen, permission: 'accounting.view' },
      { label: 'Journal', to: '/accounting/journal', icon: BookText, permission: 'accounting.view' },
      { label: 'General Ledger', to: '/accounting/general-ledger', icon: BookText, permission: 'accounting.view' },
      { label: 'Trial Balance', to: '/accounting/trial-balance', icon: Scale, permission: 'accounting.view' },
      { label: 'Profit & Loss', to: '/accounting/profit-loss', icon: TrendingUp, permission: 'accounting.view' },
      { label: 'Balance Sheet', to: '/accounting/balance-sheet', icon: Landmark, permission: 'accounting.view' },
      { label: 'Cash Book', to: '/accounting/cash-book', icon: Banknote, permission: 'cashbook.view' },
      { label: 'Expenses', to: '/accounting/expenses', icon: Coins, permission: 'expenses.view' },
      { label: 'GST Filing', to: '/accounting/gst', icon: FileCheck2, permission: 'gst.view' },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: BadgeIndianRupee,
    items: [{ label: 'Payroll', to: '/payroll', icon: BadgeIndianRupee, permission: 'payroll.view', end: true }],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    items: [{ label: 'Reports', to: '/reports', icon: BarChart3, permission: 'reports.view', end: true }],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      { label: 'Users', to: '/admin/users', icon: Users, permission: 'members.manage' },
      { label: 'Activity', to: '/admin/activity', icon: History, permission: 'activity.view' },
      { label: 'Settings', to: '/admin/settings', icon: Settings, permission: 'settings.manage' },
    ],
  },
];

/** All items flattened, for breadcrumbs and command-palette navigation. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Mobile bottom-navigation primary destinations (Phase 1 §14). "More" opens the drawer. */
export const BOTTOM_NAV: { label: string; to: string; icon: LucideIcon; permission: Permission }[] = [
  { label: 'Home', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Sales', to: '/sales/invoices', icon: ReceiptIndianRupee, permission: 'sales.view' },
  { label: 'Inventory', to: '/inventory/products', icon: Boxes, permission: 'products.view' },
  { label: 'Reports', to: '/reports', icon: BarChart3, permission: 'reports.view' },
];
