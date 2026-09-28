import { useState } from 'react';
import { newRequestId, todayISO, ADJ_CATEGORIES, type AdjCategory, type Product } from '@hynish/domain';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryService } from '@/hooks/use-master-data';
import { mapCallableError, callableErrorCode } from '@/lib/errors';

export interface AdjustTarget {
  product: Product;
  variantId: string;
  locationId: string;
  currentQty: number;
}

export function AdjustDialog({ target, open, onOpenChange, onDone }: {
  target: AdjustTarget;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const service = useInventoryService();
  const canOverride = useAuthStore((s) => s.hasPermission('stock.overrideNegative'));
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState(1);
  const [reasonCategory, setReasonCategory] = useState<AdjCategory>('correction');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => newRequestId());

  async function submit(confirmNegative = false) {
    if (!(qty > 0)) { toast.error('Quantity must be greater than zero.'); return; }
    setBusy(true);
    try {
      await service.adjust({
        date: todayISO(), productId: target.product.id, variantId: target.variantId, locationId: target.locationId,
        direction, qty, reasonCategory, note, requestId,
        confirmations: confirmNegative ? ['NEGATIVE_STOCK'] : [],
      });
      toast.success('Stock adjusted');
      setRequestId(newRequestId());
      onOpenChange(false);
      onDone();
    } catch (e) {
      if (callableErrorCode(e) === 'NEGATIVE_STOCK') {
        if (!canOverride) { toast.error('This would take stock negative, which you are not allowed to override.'); return; }
        const ok = await confirm({ title: 'Allow negative stock?', description: 'This adjustment would take the balance below zero. Continue?', confirmLabel: 'Allow', danger: true });
        if (ok) { setBusy(false); return void submit(true); }
      } else {
        toast.error(mapCallableError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>{target.product.name} · current <span className="num">{target.currentQty}</span></DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Direction" htmlFor="adj-dir">
            <Select value={direction} onValueChange={(v) => setDirection(v as 'in' | 'out')}>
              <SelectTrigger id="adj-dir"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Add (in)</SelectItem>
                <SelectItem value="out">Remove (out)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="adj-qty">
            <Input id="adj-qty" type="number" inputMode="decimal" min={0} step="0.001" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
          </Field>
          <Field label="Reason" htmlFor="adj-reason">
            <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as AdjCategory)}>
              <SelectTrigger id="adj-reason"><SelectValue /></SelectTrigger>
              <SelectContent>{ADJ_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Note" htmlFor="adj-note" className="sm:col-span-2">
            <Textarea id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit(false)} loading={busy}>Apply adjustment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
