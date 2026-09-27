import { useState } from 'react';
import {
  formatINR, newRequestId, todayISO, PAYMENT_MODES, outstandingOf,
  type Invoice, type PaymentMode,
} from '@hynish/domain';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useSalesService } from '@/hooks/use-master-data';
import { mapCallableError, callableErrorCode } from '@/lib/errors';

export function RecordPaymentDialog({
  invoice, open, onOpenChange, onDone,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const service = useSalesService();
  const outstanding = outstandingOf(invoice.grandTotalPaise, invoice.paidPaise);
  const [amountPaise, setAmountPaise] = useState(outstanding);
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [alsoLogCashBook, setAlsoLogCashBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => newRequestId());

  async function submit(confirmOver = false) {
    if (!(amountPaise > 0)) { toast.error('Enter an amount greater than zero.'); return; }
    setBusy(true);
    try {
      await service.payments.record({
        direction: 'in', targetType: 'invoice', targetId: invoice.id,
        date, amountPaise, mode, reference, notes, alsoLogCashBook,
        confirmations: confirmOver ? ['OVER_PAYMENT'] : [],
        requestId,
      });
      toast.success('Payment recorded');
      setRequestId(newRequestId());
      onOpenChange(false);
      onDone();
    } catch (e) {
      if (callableErrorCode(e) === 'OVER_PAYMENT') {
        const ok = await confirm({
          title: 'Payment exceeds balance',
          description: `The outstanding balance is ${formatINR(outstanding)}. Record this larger amount anyway?`,
          confirmLabel: 'Record anyway',
        });
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
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoice.number} · outstanding <span className="num">{formatINR(outstanding)}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="pay-amt">
            <MoneyInput id="pay-amt" valuePaise={amountPaise} onChangePaise={setAmountPaise} />
          </Field>
          <Field label="Date" htmlFor="pay-date">
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode" htmlFor="pay-mode">
            <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
              <SelectTrigger id="pay-mode"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Reference" htmlFor="pay-ref" hint="Cheque / UPI ref (optional)">
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="pay-notes" className="sm:col-span-2">
            <Textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={alsoLogCashBook} onCheckedChange={(v) => setAlsoLogCashBook(v === true)} />
            Also add to the Cash Book
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit(false)} loading={busy}>Record payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
