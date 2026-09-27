import { useState } from 'react';
import { Boxes, Package, ShoppingCart, Trash2, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MetricCard, GradientCard, SectionCard, StatusBadge, ActionCard, GRADIENT_VARIANTS } from '@/components/premium';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { CardSkeleton, TableSkeleton } from '@/components/feedback/skeletons';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { formatINR } from '@hynish/domain';

const TOKENS = [
  'background', 'foreground', 'card', 'primary', 'secondary', 'muted', 'accent',
  'border', 'success', 'warning', 'danger', 'info',
];

/** Internal design-system reference (Phase 1 §48). Not linked in production navigation. */
export function DesignSystemPage() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Design System"
        description="Internal reference for tokens, components and patterns. Not shown in production navigation."
      />

      <Section title="Color tokens (light & dark aware)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TOKENS.map((t) => (
            <div key={t} className="overflow-hidden rounded-lg border border-border">
              <div className="h-12" style={{ backgroundColor: `hsl(var(--${t}))` }} />
              <div className="px-2 py-1.5 text-xs font-medium">{t}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-2">
          <p className="text-3xl font-extrabold tracking-tight">Display / KPI value {formatINR(8425000)}</p>
          <h1 className="text-2xl font-extrabold">Heading 1</h1>
          <h2 className="text-xl font-bold">Heading 2</h2>
          <p className="text-sm">Body — the quick brown fox jumps over the lazy dog.</p>
          <p className="text-sm text-muted-foreground">Muted secondary text.</p>
          <p className="num text-sm">Tabular numerals: 1,23,456.78</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="success">Success</Button>
          <Button variant="premium">Premium</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-name">Text input</Label>
            <Input id="ds-name" placeholder="Customer name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-select">Select</Label>
            <Select>
              <SelectTrigger id="ds-select">
                <SelectValue placeholder="Choose unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pcs">Pcs</SelectItem>
                <SelectItem value="box">Box</SelectItem>
                <SelectItem value="dozen">Dozen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ds-notes">Textarea</Label>
            <Textarea id="ds-notes" placeholder="Notes…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} /> Checkbox
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={on} onCheckedChange={setOn} /> Switch
          </label>
        </div>
      </Section>

      <Section title="Premium metric & gradient cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Today's Sales" value={formatINR(8425000)} variant="sales" icon={TrendingUp} delta={{ value: '12%', direction: 'up' }} hint="vs yesterday" />
          <MetricCard title="Customers" value="342" variant="customer" icon={Users} />
          <MetricCard title="Low Stock" value="7" variant="inventory" icon={Boxes} />
          <MetricCard title="Neutral metric" value="128" icon={Package} delta={{ value: '3%', direction: 'down' }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GRADIENT_VARIANTS.map((v) => (
            <GradientCard key={v} variant={v} className="p-4">
              <p className="text-xs font-medium capitalize text-white/80">{v}</p>
              <p className="text-lg font-bold">Gradient</p>
            </GradientCard>
          ))}
        </div>
      </Section>

      <Section title="Action cards">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard title="New Bill" description="Create an invoice" icon={ShoppingCart} to="/sales/new" />
          <ActionCard title="Products" description="Manage catalogue" icon={Package} to="/inventory/products" />
          <ActionCard title="Customers" description="View customers" icon={Users} to="/customers" />
        </div>
      </Section>

      <Section title="Badges & statuses">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status="paid" />
          <StatusBadge status="partial" />
          <StatusBadge status="unpaid" />
          <StatusBadge status="overdue" />
          <StatusBadge status="without-gst" />
          <StatusBadge status="gst" />
          <StatusBadge status="pending" />
        </div>
      </Section>

      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ['INV/2627/0001', 'Acme Traders', 1250000, 'paid'],
              ['INV/2627/0002', 'Bright Retail', 845000, 'partial'],
              ['NGST/2627/0001', 'Cash Sale', 320000, 'without-gst'],
            ].map(([no, cust, amt, st]) => (
              <TableRow key={no as string}>
                <TableCell className="font-medium">{no}</TableCell>
                <TableCell>{cust}</TableCell>
                <TableCell className="num text-right">{formatINR(amt as number)}</TableCell>
                <TableCell>
                  <StatusBadge status={st as 'paid'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Overlays, toasts & confirm">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>Desktop dialogs center; on mobile prefer a sheet.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Sheet title</SheetTitle>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Button variant="outline" onClick={() => toast.success('Saved successfully')}>
            Toast success
          </Button>
          <Button variant="outline" onClick={() => toast.error('Something failed')}>
            Toast error
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete this invoice?',
                description: 'This cannot be undone.',
                danger: true,
                confirmLabel: 'Delete',
              });
              toast[ok ? 'success' : 'info'](ok ? 'Confirmed' : 'Cancelled');
            }}
          >
            <Trash2 /> Confirm dialog
          </Button>
        </div>
      </Section>

      <Section title="Loading, empty & error states">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CardSkeleton />
          <EmptyState title="No data yet" description="This is the empty state." />
          <ErrorState onRetry={() => toast.info('Retrying…')} />
        </div>
        <div className="mt-4">
          <TableSkeleton rows={3} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title}>
      <div className="pt-2">{children}</div>
    </SectionCard>
  );
}
