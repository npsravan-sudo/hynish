import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GST_STATES, stateCodeFromGstin, isValidGstin } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { MoneyInput } from '@/components/forms/money-input';
import { useRepositories, useMasterDataService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  contactPerson: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(20).default(''),
  gstin: z.string().trim().toUpperCase().max(15).default('').refine((v) => v === '' || isValidGstin(v), 'Enter a valid 15-character GSTIN'),
  stateCode: z.string().default(''),
  city: z.string().trim().max(80).default(''),
  address: z.string().trim().max(300).default(''),
  creditLimitPaise: z.number().int().nonnegative().default(0),
});
type FormValues = z.infer<typeof formSchema>;

const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }));

export function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const { data, loading, error, notFound } = useEntity(repos.customers, id);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', contactPerson: '', phone: '', gstin: '', stateCode: '', city: '', address: '', creditLimitPaise: 0 },
  });
  const { register, handleSubmit, control, reset, setValue, getValues, watch, formState } = form;

  useEffect(() => {
    if (data) {
      reset({
        name: data.name, contactPerson: data.contactPerson, phone: data.phone, gstin: data.gstin,
        stateCode: data.stateCode ?? '', city: data.city, address: data.address, creditLimitPaise: data.creditLimitPaise,
      });
    }
  }, [data, reset]);

  const gstin = watch('gstin');
  // Auto-suggest state from GSTIN when the state is still blank (BR-GST-15, legacy autoSuggestState).
  useEffect(() => {
    const derived = stateCodeFromGstin(gstin);
    if (derived && !getValues('stateCode')) setValue('stateCode', derived, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gstin]);

  async function onSubmit(values: FormValues) {
    try {
      const savedId = await service.customers.save({
        ...(id ? { id } : {}),
        name: values.name,
        contactPerson: values.contactPerson,
        phone: values.phone,
        gstin: values.gstin,
        stateCode: values.stateCode || null,
        city: values.city,
        address: values.address,
        creditLimitPaise: values.creditLimitPaise,
      });
      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      navigate(`/customers/${savedId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  if (isEdit && loading) return <PageSkeleton />;
  if (isEdit && (error || notFound)) return <ErrorState title="Customer not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={isEdit ? 'Edit Customer' : 'New Customer'}
        description="Blank GSTIN means a B2C/cash buyer."
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft /> Back
          </Button>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <SectionCard title="Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input id="name" aria-invalid={!!formState.errors.name} {...register('name')} />
            </Field>
            <Field label="Contact person" htmlFor="contactPerson">
              <Input id="contactPerson" {...register('contactPerson')} />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" inputMode="tel" {...register('phone')} />
            </Field>
            <Field label="GSTIN" htmlFor="gstin" hint="Leave blank for a B2C customer" error={formState.errors.gstin?.message}>
              <Input id="gstin" className="num uppercase" aria-invalid={!!formState.errors.gstin} {...register('gstin')} />
            </Field>
            <Field label="State" htmlFor="stateCode" hint="Auto-filled from GSTIN; used for GST">
              <Controller
                control={control}
                name="stateCode"
                render={({ field }) => (
                  <Combobox
                    id="stateCode"
                    options={STATE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select state"
                    searchPlaceholder="Search state…"
                  />
                )}
              />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" {...register('city')} />
            </Field>
            <Field label="Credit limit" htmlFor="creditLimit" hint="0 = no limit (warns, never blocks)">
              <Controller
                control={control}
                name="creditLimitPaise"
                render={({ field }) => (
                  <MoneyInput id="creditLimit" valuePaise={field.value} onChangePaise={field.onChange} />
                )}
              />
            </Field>
            <Field label="Address" htmlFor="address" className="sm:col-span-2">
              <Textarea id="address" {...register('address')} />
            </Field>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
