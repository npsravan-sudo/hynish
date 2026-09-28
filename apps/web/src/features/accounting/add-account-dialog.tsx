import { useState } from 'react';
import { ACCOUNT_TYPES, newRequestId, type AccountType } from '@hynish/domain';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { useAccountingService } from '@/hooks/use-master-data';
import { mapCallableError } from '@/lib/errors';

const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Asset', liability: 'Liability', equity: 'Equity', income: 'Income', expense: 'Expense',
};

/** Add a custom account to the Chart of Accounts (BR-ACC-18). The only account-creation path the
 * source supports — code auto-assigns to (max existing code of that type + 10) when left blank. */
export function AddAccountDialog({ open, onOpenChange, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const service = useAccountingService();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('expense');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => newRequestId());

  async function submit() {
    if (!name.trim()) { toast.error('Enter an account name.'); return; }
    setBusy(true);
    try {
      await service.accounts.save({
        name: name.trim(), type, code: code.trim() ? Number(code) : null, requestId,
      });
      toast.success('Account created');
      setRequestId(newRequestId());
      setName('');
      setCode('');
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
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>Custom accounts extend the Chart of Accounts. Leave the code blank to auto-assign one.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="acc-name" required className="sm:col-span-2">
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="acc-type">
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger id="acc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Code" htmlFor="acc-code" hint="Optional — auto-assigned if blank">
            <Input id="acc-code" type="number" inputMode="numeric" className="num" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} loading={busy}>Create account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
