import { useState } from 'react';
import {
  newRequestId, todayISO, PAYMENT_MODES, CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES,
  type PaymentMode,
} from '@hynish/domain';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { toast } from '@/components/ui/sonner';
import { useAccountingService } from '@/hooks/use-master-data';
import { mapCallableError } from '@/lib/errors';

/** Manual Cash Book entry (BR-CASH-01). A separate, informal ledger — never posts to the journal
 * (BR-CASH-02, TD §6.3). Categories are locked to the documented in/out lists per type. */
export function LogCashEntryDialog({ locationId, open, onOpenChange, onDone }: {
  locationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const service = useAccountingService();
  const [type, setType] = useState<'in' | 'out'>('in');
  const [category, setCategory] = useState<string>(CASH_IN_CATEGORIES[0]);
  const [date, setDate] = useState(todayISO());
  const [amountPaise, setAmountPaise] = useState(0);
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => newRequestId());

  const categories: readonly string[] = type === 'in' ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;

  function onTypeChange(v: 'in' | 'out') {
    setType(v);
    setCategory(v === 'in' ? CASH_IN_CATEGORIES[0] : CASH_OUT_CATEGORIES[0]);
  }

  async function submit() {
    if (!(amountPaise > 0)) { toast.error('Enter an amount greater than zero.'); return; }
    setBusy(true);
    try {
      await service.cashBook.log({
        date, locationId, type, category, amountPaise, mode, reference, notes, requestId,
      });
      toast.success('Cash Book entry logged');
      setRequestId(newRequestId());
      setAmountPaise(0);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Cash Book entry</DialogTitle>
          <DialogDescription>A separate, informal record — this never posts to the journal (BR-CASH-02).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="cb-type">
            <Select value={type} onValueChange={(v) => onTypeChange(v as 'in' | 'out')}>
              <SelectTrigger id="cb-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">In</SelectItem>
                <SelectItem value="out">Out</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category" htmlFor="cb-cat">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="cb-cat"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date" htmlFor="cb-date"><Input id="cb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Amount" htmlFor="cb-amt"><MoneyInput id="cb-amt" valuePaise={amountPaise} onChangePaise={setAmountPaise} /></Field>
          <Field label="Mode" htmlFor="cb-mode">
            <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
              <SelectTrigger id="cb-mode"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Reference" htmlFor="cb-ref" hint="Optional"><Input id="cb-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Notes" htmlFor="cb-notes" className="sm:col-span-2"><Textarea id="cb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} loading={busy}>Log entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
