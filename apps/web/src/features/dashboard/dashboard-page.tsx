import {
  ReceiptIndianRupee,
  TrendingUp,
  CircleDollarSign,
  Boxes,
  FilePlus2,
  Package,
  ShoppingCart,
  Users,
  ClipboardCheck,
  BarChart3,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard, ActionCard, SectionCard } from '@/components/premium';
import { EmptyState } from '@/components/feedback/empty-state';
import { useSessionStore } from '@/stores/session-store';

/**
 * Dashboard shell (Phase 1). Demonstrates the premium KPI + gradient system and quick
 * actions using the real responsive layout. Values are intentionally placeholders ("—")
 * with a clear note — NO fabricated business figures (Phase 1 §47). Live KPIs connect when
 * the data layer lands (BR-RPT-01..03), preserving legacy scoping (Dashboard §38 / LC-38.1).
 */
export function DashboardPage() {
  const businessName = useSessionStore((s) => s.businessName);

  const greeting = getGreeting();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting}${businessName ? `, ${businessName}` : ''}`}
        description="Your business at a glance. Live figures connect in a later phase."
      />

      <div className="flex items-center gap-2 rounded-lg border border-info/20 bg-info/5 px-4 py-3 text-sm text-info">
        <Info className="size-4 shrink-0" />
        <span className="text-foreground/80">
          Preview shell — metrics show placeholders until billing and reporting are implemented.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today's Sales"
          value="—"
          variant="sales"
          icon={ReceiptIndianRupee}
          hint="All locations"
        />
        <MetricCard
          title="This Month"
          value="—"
          variant="revenue"
          icon={TrendingUp}
          hint="vs last month"
        />
        <MetricCard
          title="Outstanding Dues"
          value="—"
          variant="customer"
          icon={CircleDollarSign}
          hint="All locations"
        />
        <MetricCard
          title="Low Stock"
          value="—"
          variant="inventory"
          icon={Boxes}
          hint="Current location"
        />
      </div>

      <SectionCard title="Quick actions" description="Jump straight into common tasks.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard title="New Bill" description="Create an invoice" icon={FilePlus2} to="/sales/new" />
          <ActionCard title="Products" description="Manage catalogue" icon={Package} to="/inventory/products" />
          <ActionCard title="New Purchase" description="Record stock in" icon={ShoppingCart} to="/inventory/purchases" />
          <ActionCard title="Customers" description="View customers" icon={Users} to="/customers" />
          <ActionCard title="Stock Count" description="Reconcile stock" icon={ClipboardCheck} to="/inventory/stock-count" />
          <ActionCard title="Reports" description="Sales & performance" icon={BarChart3} to="/reports" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Recent invoices">
          <EmptyState
            icon={ReceiptIndianRupee}
            title="No invoices yet"
            description="Recent bills will appear here once billing is live."
          />
        </SectionCard>
        <SectionCard title="Low stock">
          <EmptyState
            icon={Boxes}
            title="Nothing to reorder"
            description="Low-stock items at your current location will show here."
          />
        </SectionCard>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
