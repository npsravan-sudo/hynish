import { useMemo, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatINR, gstFilingSummary, gstFilingReadiness } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useRepositories } from '@/hooks/use-master-data';
import { useBusinessSettings } from '@/features/sales/use-sales-refs';
import { useLedgerAggregate } from './use-ledger-aggregate';
import { downloadCSV } from '@/lib/csv';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthBounds(mk: string): { from: string; to: string } {
  const [y, m] = mk.split('-').map(Number);
  const from = `${mk}-01`;
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from, to: `${mk}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * GST Filing (BR-RPT-05/06/07, TD §6.5). A monthly summary computed purely from stored,
 * already-posted per-invoice tax fields (§37) — this page never recalculates GST. Without-GST
 * invoices are excluded from every taxable/tax total and shown separately. All locations combined
 * (BR-ACC-21, legacy parity). Explicitly not a substitute for review by a CA.
 */
export function GstFilingPage() {
  const repos = useRepositories();
  const settings = useBusinessSettings();
  const [mk, setMk] = useState(currentMonthKey());
  const { from, to } = useMemo(() => monthBounds(mk), [mk]);

  const invParams = useMemo(() => ({
    filters: [{ field: 'deletedAt', op: '==' as const, value: null }, { field: 'date', op: '>=' as const, value: from }, { field: 'date', op: '<=' as const, value: to }],
    orderByField: 'date' as const, limit: 2000,
  }), [from, to]);
  const { items: invoices, loading: invLoading, error: invError, truncated, refresh } = useLedgerAggregate(repos.invoices, invParams);

  const cnParams = useMemo(() => ({
    filters: [{ field: 'deletedAt', op: '==' as const, value: null }, { field: 'date', op: '>=' as const, value: from }, { field: 'date', op: '<=' as const, value: to }],
    orderByField: 'date' as const, limit: 500,
  }), [from, to]);
  const { items: creditNotes, loading: cnLoading } = useLedgerAggregate(repos.creditNotes, cnParams);

  const summary = useMemo(() => gstFilingSummary(invoices, creditNotes, mk), [invoices, creditNotes, mk]);
  const readiness = useMemo(() => gstFilingReadiness(invoices, settings?.gstin ?? '', mk), [invoices, settings, mk]);
  const loading = invLoading || cnLoading;
  const ready = readiness.businessGstinSet && readiness.invalidB2BGstins.length === 0 && readiness.missingHsnInvoices.length === 0;

  function exportCsv(kind: 'b2b' | 'b2c' | 'hsn') {
    if (kind === 'hsn') {
      downloadCSV(`gst-hsn-${mk}.csv`, ['HSN', 'GST Rate %', 'Qty', 'Taxable', 'Tax'],
        summary.hsn.map((h) => [h.hsn, h.gstRateBp / 100, h.qty, h.taxablePaise / 100, h.taxPaise / 100]));
      return;
    }
    const rows = kind === 'b2b' ? summary.b2b : summary.b2c;
    downloadCSV(`gst-${kind}-${mk}.csv`, ['Invoice', 'Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
      rows.map((r) => [r.number, r.date, r.customerName, r.customerGstin, r.taxablePaise / 100, r.cgstPaise / 100, r.sgstPaise / 100, r.igstPaise / 100, r.grandTotalPaise / 100]));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="GST Filing" description="Monthly summary for GSTR-1 style filing. Not a substitute for review by a CA (BR-RPT-07)." />

      <SectionCard title="Period">
        <Field label="Month" htmlFor="gst-month" className="max-w-xs">
          <Input id="gst-month" type="month" value={mk} onChange={(e) => setMk(e.target.value || currentMonthKey())} />
        </Field>
      </SectionCard>

      {loading ? <TableSkeleton rows={6} cols={5} /> : invError ? <ErrorState message={invError} onRetry={refresh} /> : (
        <>
          <SectionCard title="Filing readiness" description="Data-quality checks only — always confirm with a CA before filing.">
            <div className="flex flex-col gap-2 text-sm">
              <ReadinessRow ok={readiness.businessGstinSet} label={readiness.businessGstinSet ? 'Business GSTIN is set' : 'Business GSTIN is missing — set it in Settings'} />
              <ReadinessRow ok={readiness.invalidB2BGstins.length === 0} label={readiness.invalidB2BGstins.length === 0 ? 'All B2B customer GSTINs are well-formed' : `${readiness.invalidB2BGstins.length} B2B invoice(s) have a malformed customer GSTIN`} />
              <ReadinessRow ok={readiness.missingHsnInvoices.length === 0} label={readiness.missingHsnInvoices.length === 0 ? 'Every taxable line has an HSN code' : `${readiness.missingHsnInvoices.length} invoice(s) have a line missing an HSN code`} />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Taxable (this month)" value={formatINR(summary.totalTaxablePaise)} />
            <Stat label="Tax (this month)" value={formatINR(summary.totalTaxPaise)} />
            <Stat label="Net taxable (after CNs)" value={formatINR(summary.netTaxablePaise)} />
            <Stat label="Net tax (after CNs)" value={formatINR(summary.netTaxPaise)} strong />
          </div>

          <SectionCard
            title="B2B"
            description={truncated ? 'Results may be incomplete — this month has a large number of invoices.' : 'Taxable invoices to a customer with a GSTIN.'}
            action={summary.b2b.length > 0 ? <Button variant="outline" size="sm" onClick={() => exportCsv('b2b')}><Download /> CSV</Button> : undefined}
          >
            <GstTable rows={summary.b2b} showGstin />
          </SectionCard>

          <SectionCard
            title="B2C"
            description="Taxable invoices with no customer GSTIN."
            action={summary.b2c.length > 0 ? <Button variant="outline" size="sm" onClick={() => exportCsv('b2c')}><Download /> CSV</Button> : undefined}
          >
            <GstTable rows={summary.b2c} showGstin={false} />
          </SectionCard>

          <SectionCard title="Without GST" description="Excluded from every taxable/tax total above (BR-RPT-05).">
            {summary.withoutGst.length === 0 ? (
              <EmptyState title="No Without-GST invoices this month" />
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summary.withoutGst.map((r) => (
                    <TableRow key={r.invoiceId}><TableCell className="num">{r.number}</TableCell><TableCell>{r.date}</TableCell><TableCell>{r.customerName}</TableCell><TableCell className="num text-right">{formatINR(r.grandTotalPaise)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard
            title="HSN summary"
            description="Every taxable line grouped by HSN + GST rate."
            action={summary.hsn.length > 0 ? <Button variant="outline" size="sm" onClick={() => exportCsv('hsn')}><Download /> CSV</Button> : undefined}
          >
            {summary.hsn.length === 0 ? (
              <EmptyState title="No taxable lines this month" />
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>HSN</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summary.hsn.map((h) => (
                    <TableRow key={`${h.hsn}_${h.gstRateBp}`}>
                      <TableCell className="num">{h.hsn || '—'}</TableCell>
                      <TableCell className="num text-right">{h.gstRateBp / 100}%</TableCell>
                      <TableCell className="num text-right">{h.qty}</TableCell>
                      <TableCell className="num text-right">{formatINR(h.taxablePaise)}</TableCell>
                      <TableCell className="num text-right">{formatINR(h.taxPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          {!ready && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              <span className="text-foreground/80">Resolve the readiness items above before filing. This report is not a substitute for review by a CA.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReadinessRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}
      <span className={ok ? 'text-foreground' : 'text-warning'}>{label}</span>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 ${strong ? 'text-xl font-bold' : 'text-lg font-semibold'}`}>{value}</p>
    </div>
  );
}

function GstTable({ rows, showGstin }: { rows: { invoiceId: string; number: string; date: string; customerName: string; customerGstin: string; taxablePaise: number; taxPaise: number; grandTotalPaise: number }[]; showGstin: boolean }) {
  if (rows.length === 0) return <EmptyState title="No invoices this month" />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead>
          {showGstin && <TableHead>GSTIN</TableHead>}
          <TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.invoiceId}>
              <TableCell className="num">{r.number}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.customerName}</TableCell>
              {showGstin && <TableCell className="num">{r.customerGstin}</TableCell>}
              <TableCell className="num text-right">{formatINR(r.taxablePaise)}</TableCell>
              <TableCell className="num text-right">{formatINR(r.taxPaise)}</TableCell>
              <TableCell className="num text-right">{formatINR(r.grandTotalPaise)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
