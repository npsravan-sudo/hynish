import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { newRequestId, todayISO, PAYMENT_MODES, type PaymentMode, type ExpenseCategory } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useAccountingService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { mapCallableError } from '@/lib/errors';

/** Create/edit a Daily Expense (BR-EXP-01, TD §6.4). Editing always reverses the prior journal entry
 * and re-posts fresh — never an in-place accounting adjustment (server-enforced, not client). */
export function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useAccountingService();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const { data: existing, loading: loadingExisting, error: loadError, notFound } = useEntity(repos.expenses, id);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void repos.expenseCategories.list({ orderByField: 'name', direction: 'asc', limit: 200, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => { if (!cancelled) { setCategories(p.items); setCategoriesLoading(false); } })
      .catch(() => !cancelled && setCategoriesLoading(false));
    return () => { cancelled = true; };
  }, [repos]);

  const [locationId, setLocationId] = useState(currentLocationId ?? locations[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amountPaise, setAmountPaise] = useState(0);
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newRequestId());

  useEffect(() => {
    if (existing) {
      setLocationId(existing.locationId);
      setCategoryId(existing.categoryId);
      setDate(existing.date);
      setAmountPaise(existing.amountPaise);
      setMode(existing.mode);
      setNotes(existing.notes);
    }
  }, [existing]);
  useEffect(() => {
    if (!isEdit && !categoryId && categories.length > 0) setCategoryId(categories[0]!.id);
  }, [isEdit, categoryId, categories]);

  if (isEdit && loadingExisting) return <PageSkeleton />;
  if (isEdit && (loadError || notFound)) return <ErrorState title="Expense not found" message={loadError ?? 'It may have been removed.'} />;

  async function submit() {
    if (!locationId) { toast.error('Choose a location.'); return; }
    if (!categoryId) { toast.error('Choose a category.'); return; }
    if (!(amountPaise > 0)) { toast.error('Amount must be greater than zero.'); return; }
    setBusy(true);
    try {
      const res = await service.expenses.save({
        date, locationId, categoryId, amountPaise, mode, notes,
        ...(isEdit ? { id: id! } : {}),
        requestId: requestId.current,
      });
      toast.success(isEdit ? 'Expense updated' : 'Expense logged');
      requestId.current = newRequestId();
      navigate(`/accounting/expenses/${res.expenseId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <PageHeader
        title={isEdit ? 'Edit Expense' : 'New Expense'}
        description="Posts Dr the category's expense account / Cr Cash-or-Bank (BR-EXP-01)."
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <SectionCard title="Details" {...(categories.length === 0 && !categoriesLoading ? { description: 'No expense categories yet — seed the defaults from Chart of Accounts.' } : {})}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="cat" className="sm:col-span-2">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="cat"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Location" htmlFor="loc">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="loc"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date" htmlFor="date"><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Amount" htmlFor="amt"><MoneyInput id="amt" valuePaise={amountPaise} onChangePaise={setAmountPaise} /></Field>
          <Field label="Payment mode" htmlFor="mode">
            <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
              <SelectTrigger id="mode"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </SectionCard>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={() => void submit()} loading={busy}>{isEdit ? 'Save changes' : 'Log expense'}</Button>
      </div>
    </div>
  );
}
