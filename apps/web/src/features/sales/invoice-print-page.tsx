import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatINR } from '@hynish/domain';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useRepositories } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { useBusinessSettings } from './use-sales-refs';

/**
 * Printable tax invoice (§42). Browser/PWA `window.print()` — never Electron. A print-only stylesheet
 * hides the app chrome; the layout preserves business identity, GST info, lines, tax breakdown and
 * totals as documented in the source.
 */
export function InvoicePrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const settings = useBusinessSettings();
  const { data: inv, loading, error, notFound } = useEntity(repos.invoices, id);

  useEffect(() => {
    if (inv) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [inv]);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !inv) return <ErrorState title="Invoice not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <div className="no-print mb-4 flex justify-between">
        <Button variant="ghost" onClick={() => navigate(`/sales/invoices/${inv.id}`)}>Back</Button>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-sm">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold">{settings?.businessName || inv.sellerSnapshot.businessName || 'Tax Invoice'}</h1>
            {settings?.address && <p className="text-muted-foreground">{settings.address}</p>}
            {inv.sellerSnapshot.gstin && <p className="num">GSTIN: {inv.sellerSnapshot.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{inv.gstApplicable ? 'Tax Invoice' : 'Invoice'}</p>
            <p className="num">{inv.number}</p>
            <p className="text-muted-foreground">{inv.date}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div>
            <p className="font-medium">Bill to</p>
            <p>{inv.customerSnapshot?.name || 'Cash sale'}</p>
            {inv.customerSnapshot?.gstin && <p className="num">GSTIN: {inv.customerSnapshot.gstin}</p>}
            {inv.customerSnapshot?.address && <p className="text-muted-foreground">{inv.customerSnapshot.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{inv.gstApplicable ? (inv.taxType === 'intra' ? 'Intra-state supply' : 'Inter-state supply') : 'Without GST'}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-border">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">GST</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.lineId} className="border-b border-border/60">
                <td className="py-2">{l.nameSnapshot}{l.hsnSnapshot ? ` · HSN ${l.hsnSnapshot}` : ''}</td>
                <td className="num py-2 text-right">{l.qty} {l.unit}</td>
                <td className="num py-2 text-right">{formatINR(l.ratePaise)}</td>
                <td className="num py-2 text-right">{l.gstRateBp / 100}%</td>
                <td className="num py-2 text-right">{formatINR(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{formatINR(inv.subtotalPaise)}</span></div>
            {inv.gstApplicable && inv.taxType === 'intra' && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="num">{formatINR(inv.cgstPaise)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="num">{formatINR(inv.sgstPaise)}</span></div>
              </>
            )}
            {inv.gstApplicable && inv.taxType === 'inter' && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="num">{formatINR(inv.igstPaise)}</span></div>}
            {inv.roundOffPaise !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round off</span><span className="num">{formatINR(inv.roundOffPaise)}</span></div>}
            <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Grand total</span><span className="num">{formatINR(inv.grandTotalPaise)}</span></div>
          </div>
        </div>

        {settings?.bank?.accountNumber && (
          <div className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Bank details</p>
            <p>{settings.bank.bankName} · A/C {settings.bank.accountNumber} · IFSC {settings.bank.ifsc}</p>
          </div>
        )}
      </div>
    </div>
  );
}
