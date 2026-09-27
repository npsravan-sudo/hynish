import { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Wand2 } from 'lucide-react';
import { UNITS, GST_RATES_BP, suggestGstRateBp, newId } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { MoneyInput } from '@/components/forms/money-input';
import { ProductImageField } from './product-image-field';
import { useRepositories, useMasterDataService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { useCategoryOptions } from './use-categories';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';

const gstRateSet = new Set<number>(GST_RATES_BP as readonly number[]);
const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    category: z.string().trim().max(60).default(''),
    hsn: z.string().trim().max(12).default(''),
    unit: z.enum(UNITS),
    gstRateBp: z.number().refine((v) => gstRateSet.has(v), 'Choose a GST rate'),
    wholesalePricePaise: z.number().int().nonnegative(),
    purchasePricePaise: z.number().int().nonnegative(),
    lowStockThreshold: z.string().default(''), // parsed to number|null on submit
    barcode: z.string().trim().max(40).refine((v) => !v.includes('/'), 'Barcode cannot contain "/"').default(''),
    hasVariants: z.boolean(),
    variants: z.array(z.object({ id: z.string().default(''), size: z.string().trim().default(''), color: z.string().trim().default('') })),
    altUnits: z.array(z.object({ name: z.string().trim().default(''), factor: z.number().positive().or(z.nan()) })),
  })
  .refine((v) => !v.hasVariants || v.variants.length >= 1, { path: ['variants'], message: 'Add at least one variant' });
type FormValues = z.infer<typeof formSchema>;

const GST_RATE_OPTIONS = (GST_RATES_BP as readonly number[]).map((bp) => ({ value: String(bp), label: `${bp / 100}%` }));

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const categoryOptions = useCategoryOptions();
  const { data, loading, error, notFound } = useEntity(repos.products, id);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCleared, setImageCleared] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', category: '', hsn: '', unit: 'Pcs', gstRateBp: 500, wholesalePricePaise: 0,
      purchasePricePaise: 0, lowStockThreshold: '', barcode: '', hasVariants: false,
      variants: [{ id: '', size: '', color: '' }], altUnits: [],
    },
  });
  const { register, handleSubmit, control, reset, watch, setValue, getValues, formState } = form;
  const variants = useFieldArray({ control, name: 'variants' });
  const altUnits = useFieldArray({ control, name: 'altUnits' });
  const hasVariants = watch('hasVariants');

  useEffect(() => {
    if (data) {
      reset({
        name: data.name, category: data.category, hsn: data.hsn, unit: data.unit, gstRateBp: data.gstRateBp,
        wholesalePricePaise: data.wholesalePricePaise, purchasePricePaise: data.purchasePricePaise,
        lowStockThreshold: data.lowStockThreshold ? String(data.lowStockThreshold) : '',
        barcode: data.barcode, hasVariants: data.hasVariants,
        variants: data.hasVariants ? data.variants.map((v) => ({ id: v.id, size: v.size, color: v.color })) : [{ id: 'default', size: '', color: '' }],
        altUnits: data.altUnits.map((a) => ({ name: a.name, factor: a.factor })),
      });
    }
  }, [data, reset]);

  function suggest() {
    setValue('gstRateBp', suggestGstRateBp(getValues('wholesalePricePaise')), { shouldValidate: true });
  }

  async function onSubmit(values: FormValues) {
    const builtVariants = values.hasVariants
      ? values.variants.map((v, i) => ({ id: v.id || `v-${newId().slice(0, 6)}-${i}`, size: v.size, color: v.color, barcodeOverride: null, active: true }))
      : [{ id: 'default', size: '', color: '', barcodeOverride: null, active: true }];
    const cleanAlt = values.altUnits.filter((a) => a.name.trim() && Number.isFinite(a.factor)).map((a) => ({ name: a.name.trim(), factor: a.factor }));
    const lowStock = values.lowStockThreshold.trim() === '' ? null : Math.max(0, Math.trunc(Number(values.lowStockThreshold) || 0));

    try {
      const savedId = await service.products.save({
        ...(id ? { id } : {}),
        name: values.name, category: values.category, hsn: values.hsn, unit: values.unit, gstRateBp: values.gstRateBp,
        wholesalePricePaise: values.wholesalePricePaise, purchasePricePaise: values.purchasePricePaise,
        lowStockThreshold: lowStock, barcode: values.barcode, hasVariants: values.hasVariants,
        variants: builtVariants, altUnits: cleanAlt, imagePath: null,
      });
      if (imageFile) await service.products.uploadImage(savedId, imageFile);
      else if (imageCleared && isEdit && data?.imagePath) await service.products.clearImage(savedId);
      toast.success(isEdit ? 'Product updated' : 'Product created');
      navigate(`/inventory/products/${savedId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  if (isEdit && loading) return <PageSkeleton />;
  if (isEdit && (error || notFound)) return <ErrorState title="Product not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={isEdit ? 'Edit Product' : 'New Product'}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <SectionCard title="Basics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input id="name" aria-invalid={!!formState.errors.name} {...register('name')} />
            </Field>
            <Field label="Category" htmlFor="category" hint="Type a new category or pick an existing one">
              <Controller control={control} name="category" render={({ field }) => (
                <Combobox id="category" options={categoryOptions} value={field.value} onChange={field.onChange} placeholder="Category" allowCustom emptyText="Type to add a category" />
              )} />
            </Field>
            <Field label="HSN code" htmlFor="hsn">
              <Input id="hsn" className="num" {...register('hsn')} />
            </Field>
            <Field label="Unit" htmlFor="unit">
              <Controller control={control} name="unit" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Barcode" htmlFor="barcode" error={formState.errors.barcode?.message} hint="Optional; must be unique">
              <Input id="barcode" className="num uppercase" aria-invalid={!!formState.errors.barcode} {...register('barcode')} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Pricing & GST">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Wholesale price" htmlFor="wholesale">
              <Controller control={control} name="wholesalePricePaise" render={({ field }) => <MoneyInput id="wholesale" valuePaise={field.value} onChangePaise={field.onChange} />} />
            </Field>
            <Field label="Purchase price" htmlFor="purchase">
              <Controller control={control} name="purchasePricePaise" render={({ field }) => <MoneyInput id="purchase" valuePaise={field.value} onChangePaise={field.onChange} />} />
            </Field>
            <Field label="GST rate" htmlFor="gst" error={formState.errors.gstRateBp?.message}>
              <div className="flex gap-2">
                <Controller control={control} name="gstRateBp" render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="gst" className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{GST_RATE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                <Button type="button" variant="outline" size="icon" onClick={suggest} aria-label="Suggest GST rate">
                  <Wand2 className="size-4" />
                </Button>
              </div>
            </Field>
            <Field label="Low-stock threshold" htmlFor="lowstock" hint="Blank uses the default of 5">
              <Input id="lowstock" type="number" inputMode="numeric" min={0} {...register('lowStockThreshold')} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Photo">
          <ProductImageField
            existingPath={imageCleared ? null : data?.imagePath ?? null}
            onFileSelected={(f) => { setImageFile(f); setImageCleared(false); }}
            onCleared={() => { setImageFile(null); setImageCleared(true); }}
            file={imageFile}
          />
        </SectionCard>

        <SectionCard
          title="Variants"
          description="Turn on to track size/colour variants; off keeps a single variant."
          action={<Controller control={control} name="hasVariants" render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={(v) => { field.onChange(v); if (v && variants.fields.length === 0) variants.append({ id: '', size: '', color: '' }); }} aria-label="Has variants" />
          )} />}
        >
          {hasVariants ? (
            <div className="flex flex-col gap-2">
              {variants.fields.map((f, i) => (
                <div key={f.id} className="flex items-end gap-2">
                  <Field label={i === 0 ? 'Size' : ''} htmlFor={`v-size-${i}`} className="flex-1">
                    <Input id={`v-size-${i}`} placeholder="e.g. M" {...register(`variants.${i}.size`)} />
                  </Field>
                  <Field label={i === 0 ? 'Colour' : ''} htmlFor={`v-color-${i}`} className="flex-1">
                    <Input id={`v-color-${i}`} placeholder="e.g. Blue" {...register(`variants.${i}.color`)} />
                  </Field>
                  <Button type="button" variant="ghost" size="icon" onClick={() => variants.remove(i)} disabled={variants.fields.length <= 1} aria-label="Remove variant">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {formState.errors.variants?.message && <p className="text-xs text-danger">{formState.errors.variants.message}</p>}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => variants.append({ id: '', size: '', color: '' })}>
                <Plus /> Add variant
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This product has a single variant.</p>
          )}
        </SectionCard>

        <SectionCard title="Alternate units" description="Optional: e.g. 1 Dozen = 12 Pcs.">
          <div className="flex flex-col gap-2">
            {altUnits.fields.map((f, i) => (
              <div key={f.id} className="flex items-end gap-2">
                <Field label={i === 0 ? 'Unit name' : ''} htmlFor={`au-name-${i}`} className="flex-1">
                  <Input id={`au-name-${i}`} placeholder="e.g. Dozen" {...register(`altUnits.${i}.name`)} />
                </Field>
                <Field label={i === 0 ? 'Base units per' : ''} htmlFor={`au-factor-${i}`} className="flex-1">
                  <Input id={`au-factor-${i}`} type="number" inputMode="decimal" step="0.001" min={0} {...register(`altUnits.${i}.factor`, { valueAsNumber: true })} />
                </Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => altUnits.remove(i)} aria-label="Remove alt unit">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => altUnits.append({ name: '', factor: Number.NaN })}>
              <Plus /> Add alternate unit
            </Button>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2 pb-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting}>{isEdit ? 'Save changes' : 'Create product'}</Button>
        </div>
      </form>
    </div>
  );
}
