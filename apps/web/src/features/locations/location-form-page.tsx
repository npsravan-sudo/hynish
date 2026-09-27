import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LOCATION_TYPES } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { useRepositories, useMasterDataService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  type: z.enum(LOCATION_TYPES),
  address: z.string().trim().max(300).default(''),
  openingCashBalancePaise: z.number().int().nonnegative().default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
type FormValues = z.infer<typeof formSchema>;

export function LocationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const { data, loading, error, notFound } = useEntity(repos.locations, id);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', type: 'shop', address: '', openingCashBalancePaise: 0, isDefault: false, sortOrder: 0 },
  });
  const { register, handleSubmit, control, reset, formState } = form;

  useEffect(() => {
    if (data) {
      reset({ name: data.name, type: data.type, address: data.address, openingCashBalancePaise: data.openingCashBalancePaise, isDefault: data.isDefault, sortOrder: data.sortOrder });
    }
  }, [data, reset]);

  async function onSubmit(values: FormValues) {
    try {
      const savedId = await service.locations.save({ ...(id ? { id } : {}), ...values });
      toast.success(isEdit ? 'Location updated' : 'Location created');
      navigate(`/inventory/locations/${savedId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  if (isEdit && loading) return <PageSkeleton />;
  if (isEdit && (error || notFound)) return <ErrorState title="Location not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={isEdit ? 'Edit Location' : 'New Location'}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <SectionCard title="Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input id="name" aria-invalid={!!formState.errors.name} {...register('name')} />
            </Field>
            <Field label="Type" htmlFor="type">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shop">Shop</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Opening cash balance" htmlFor="openingCash" hint="Used by the Cash Book">
              <Controller
                control={control}
                name="openingCashBalancePaise"
                render={({ field }) => <MoneyInput id="openingCash" valuePaise={field.value} onChangePaise={field.onChange} />}
              />
            </Field>
            <Field label="Address" htmlFor="address" className="sm:col-span-2">
              <Textarea id="address" {...register('address')} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Default location</span>
                <span className="text-xs text-muted-foreground">New sessions start here when unrestricted.</span>
              </div>
              <Controller
                control={control}
                name="isDefault"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Default location" />}
              />
            </div>
          </div>
        </SectionCard>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting}>{isEdit ? 'Save changes' : 'Create location'}</Button>
        </div>
      </form>
    </div>
  );
}
