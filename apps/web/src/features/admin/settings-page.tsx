/**
 * Business Settings page (Phase 10, TD §3.2). Sections: Business Profile, Document Numbering,
 * Bank Details, WhatsApp (Coming Soon), Theme / Appearance, Backup & Restore.
 *
 * All writes go through the saveBusinessSettings / saveIntegrationSettings callables. No direct
 * Firestore writes. GSTIN is uppercased server-side (BR-SET-01) and stateCode is derived from
 * GSTIN via stateCodeFromGstin (BR-GST-16). Theme is LocalStorage/Zustand only (theme-store.ts).
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HardDriveDownload, HardDriveUpload, Sun, Moon, Monitor,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  SERIES_KEYS, DEFAULT_PREFIXES, SYNC_INTERVAL_OPTIONS, THEME_MODES,
  stateCodeFromGstin, isValidGstin,
  type SeriesKey, type BusinessSettings,
} from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useRepositories, useAdminService } from '@/hooks/use-master-data';
import { useThemeStore } from '@/stores/theme-store';
import { useAuthStore } from '@/stores/auth-store';
import { mapCallableError } from '@/lib/errors';

// ─── Form schema ──────────────────────────────────────────────────────────────

const profileSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200),
  gstin: z.string().max(15).default(''),
  address: z.string().max(500).default(''),
  city: z.string().max(100).default(''),
  stateCode: z.string().max(2).default(''),
  pincode: z.string().max(10).default(''),
  phone: z.string().max(20).default(''),
  email: z.string().email('Must be a valid email').or(z.literal('')).default(''),
  licenseKey: z.string().max(100).default(''),
});
type ProfileValues = z.infer<typeof profileSchema>;

const bankSchema = z.object({
  bankName: z.string().max(200).default(''),
  accountNumber: z.string().max(30).default(''),
  ifsc: z.string().max(11).default(''),
});
type BankValues = z.infer<typeof bankSchema>;

const numberingSchema = z.object(
  Object.fromEntries(SERIES_KEYS.map((k) => [k, z.string().min(1, 'Required').max(10).regex(/^[A-Z0-9-]+$/i, 'Letters, numbers and hyphens only')])) as Record<SeriesKey, z.ZodString>,
);
type NumberingValues = z.infer<typeof numberingSchema>;

const syncSchema = z.object({
  syncIntervalMinutes: z.coerce.number(),
});
type SyncValues = z.infer<typeof syncSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDefaults(s: BusinessSettings | null): { profile: ProfileValues; bank: BankValues; numbering: NumberingValues } {
  return {
    profile: {
      businessName: s?.businessName ?? '',
      gstin: s?.gstin ?? '',
      address: s?.address ?? '',
      city: s?.city ?? '',
      stateCode: s?.stateCode ?? '',
      pincode: s?.pincode ?? '',
      phone: s?.phone ?? '',
      email: s?.email ?? '',
      licenseKey: s?.licenseKey ?? '',
    },
    bank: {
      bankName: s?.bank?.bankName ?? '',
      accountNumber: s?.bank?.accountNumber ?? '',
      ifsc: s?.bank?.ifsc ?? '',
    },
    numbering: Object.fromEntries(SERIES_KEYS.map((k) => [k, s?.prefixes?.[k] ?? DEFAULT_PREFIXES[k]])) as NumberingValues,
  };
}

const SERIES_LABELS: Record<SeriesKey, string> = {
  invoice_gst: 'GST Invoice',
  invoice_nogst: 'Non-GST Invoice',
  quotation: 'Quotation',
  delivery_note: 'Delivery Note',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const repos = useRepositories();
  const service = useAdminService();
  const can = useAuthStore((s) => s.hasPermission);
  const businessId = useAuthStore((s) => s.businessId);
  const canManage = can('settings.manage');

  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return repos.businessSettings.watch(
      (s) => { setSettings(s); setLoading(false); },
      (e) => { setLoadError(e.message); setLoading(false); },
    );
  }, [repos.businessSettings]);

  if (loading) return <PageSkeleton />;
  if (loadError) return <ErrorState title="Could not load settings" message={loadError} />;

  const defaults = toDefaults(settings);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-16">
      <PageHeader title="Business Settings" />

      <ProfileSection defaults={defaults.profile} service={service} canManage={canManage} />
      <NumberingSection defaults={defaults.numbering} service={service} settings={settings} canManage={canManage} />
      <BankSection defaults={defaults.bank} service={service} canManage={canManage} />
      <SyncSection service={service} settings={settings} canManage={canManage} />
      <AppearanceSection />
      <WhatsAppSection canManage={canManage} />
      <BackupSection repos={repos} businessId={businessId} service={service} canManage={can('backup.create')} />
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection({ defaults, service, canManage }: { defaults: ProfileValues; service: ReturnType<typeof useAdminService>; canManage: boolean }) {
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const { register, handleSubmit, setValue, watch, formState, reset } = form;
  const [busy, setBusy] = useState(false);

  useEffect(() => { reset(defaults); }, [defaults, reset]);

  const gstinValue = watch('gstin');
  useEffect(() => {
    const upper = gstinValue.toUpperCase();
    if (upper !== gstinValue) setValue('gstin', upper);
    const code = stateCodeFromGstin(upper);
    if (code) setValue('stateCode', code);
  }, [gstinValue, setValue]);

  async function onSubmit(values: ProfileValues) {
    setBusy(true);
    try {
      await service.settings.saveBusiness({
        businessName: values.businessName,
        gstin: values.gstin,
        address: values.address,
        city: values.city,
        stateCode: values.stateCode,
        pincode: values.pincode,
        phone: values.phone,
        email: values.email,
        logoPath: null,
        licenseKey: values.licenseKey,
        bank: { bankName: '', accountNumber: '', ifsc: '' },
      });
      toast.success('Business profile saved');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  const gstinValid = !gstinValue || isValidGstin(gstinValue);

  return (
    <SectionCard title="Business Profile" >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business Name" htmlFor="businessName" required error={formState.errors.businessName?.message} className="sm:col-span-2">
            <Input id="businessName" disabled={!canManage} {...register('businessName')} />
          </Field>
          <Field label="GSTIN" htmlFor="gstin" hint="Auto-uppercased; state is auto-filled from GSTIN" error={!gstinValid ? 'Invalid GSTIN format' : undefined}>
            <div className="relative">
              <Input id="gstin" disabled={!canManage} maxLength={15} {...register('gstin')} className="uppercase" />
              {gstinValue && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  {gstinValid ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                </span>
              )}
            </div>
          </Field>
          <Field label="State Code" htmlFor="stateCode" hint="Auto-filled from GSTIN">
            <Input id="stateCode" disabled={!canManage} maxLength={2} {...register('stateCode')} />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Input id="address" disabled={!canManage} {...register('address')} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" disabled={!canManage} {...register('city')} />
          </Field>
          <Field label="Pincode" htmlFor="pincode">
            <Input id="pincode" disabled={!canManage} maxLength={6} {...register('pincode')} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" type="tel" disabled={!canManage} {...register('phone')} />
          </Field>
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" disabled={!canManage} {...register('email')} />
          </Field>
          <Field label="License Key" htmlFor="licenseKey" hint="Optional. Contact support for your key." className="sm:col-span-2">
            <Input id="licenseKey" disabled={!canManage} {...register('licenseKey')} />
          </Field>
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !formState.isDirty}>{busy ? 'Saving…' : 'Save Profile'}</Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

// ─── Document Numbering ───────────────────────────────────────────────────────

function NumberingSection({
  defaults, service, settings, canManage,
}: {
  defaults: NumberingValues;
  service: ReturnType<typeof useAdminService>;
  settings: BusinessSettings | null;
  canManage: boolean;
}) {
  const form = useForm<NumberingValues>({ resolver: zodResolver(numberingSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset } = form;
  const [busy, setBusy] = useState(false);

  useEffect(() => { reset(defaults); }, [defaults, reset]);

  async function onSubmit(values: NumberingValues) {
    setBusy(true);
    try {
      await service.settings.saveBusiness({
        businessName: settings?.businessName ?? '',
        gstin: settings?.gstin ?? '',
        address: settings?.address ?? '',
        city: settings?.city ?? '',
        stateCode: settings?.stateCode ?? '',
        pincode: settings?.pincode ?? '',
        phone: settings?.phone ?? '',
        email: settings?.email ?? '',
        logoPath: settings?.logoPath ?? null,
        licenseKey: settings?.licenseKey ?? '',
        bank: settings?.bank ?? { bankName: '', accountNumber: '', ifsc: '' },
        prefixes: values,
      });
      toast.success('Document numbering saved');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Document Numbering" description="Prefix for each document series. The sequence number is managed by the server." >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SERIES_KEYS.map((key) => (
            <Field key={key} label={SERIES_LABELS[key]} htmlFor={key} error={(formState.errors as Record<string, { message?: string }>)[key]?.message}>
              <Input
                id={key}
                disabled={!canManage}
                placeholder={DEFAULT_PREFIXES[key]}
                className="uppercase font-mono"
                {...register(key)}
              />
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Numbers are formatted as <code className="font-mono">PREFIX/FY/0001</code>. Changing a prefix only affects new documents.
        </p>
        {canManage && (
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !formState.isDirty}>{busy ? 'Saving…' : 'Save Numbering'}</Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

// ─── Bank Details ─────────────────────────────────────────────────────────────

function BankSection({ defaults, service, canManage }: { defaults: BankValues; service: ReturnType<typeof useAdminService>; canManage: boolean }) {
  const form = useForm<BankValues>({ resolver: zodResolver(bankSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset } = form;
  const [busy, setBusy] = useState(false);

  useEffect(() => { reset(defaults); }, [defaults, reset]);

  async function onSubmit(values: BankValues) {
    setBusy(true);
    try {
      await service.settings.saveBusiness({
        businessName: '',
        gstin: '',
        address: '',
        city: '',
        stateCode: '',
        pincode: '',
        phone: '',
        email: '',
        logoPath: null,
        licenseKey: '',
        bank: values,
      });
      toast.success('Bank details saved');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Bank Details" description="Printed on invoices and payment receipts." >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bank Name" htmlFor="bankName" className="sm:col-span-2">
            <Input id="bankName" disabled={!canManage} {...register('bankName')} />
          </Field>
          <Field label="Account Number" htmlFor="accountNumber">
            <Input id="accountNumber" disabled={!canManage} {...register('accountNumber')} />
          </Field>
          <Field label="IFSC Code" htmlFor="ifsc">
            <Input id="ifsc" disabled={!canManage} maxLength={11} className="uppercase" {...register('ifsc')} />
          </Field>
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !formState.isDirty}>{busy ? 'Saving…' : 'Save Bank Details'}</Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

// ─── Sync Settings ────────────────────────────────────────────────────────────

function SyncSection({ service, settings, canManage }: { service: ReturnType<typeof useAdminService>; settings: BusinessSettings | null; canManage: boolean }) {
  const currentInterval = (settings as (BusinessSettings & { syncIntervalMinutes?: number }) | null)?.syncIntervalMinutes ?? 2;
  const form = useForm<SyncValues>({ resolver: zodResolver(syncSchema), defaultValues: { syncIntervalMinutes: currentInterval } });
  const { handleSubmit, formState, reset, watch, setValue } = form;
  const [busy, setBusy] = useState(false);

  useEffect(() => { reset({ syncIntervalMinutes: currentInterval }); }, [currentInterval, reset]);

  async function onSubmit(values: SyncValues) {
    if (!settings) return;
    setBusy(true);
    try {
      await service.settings.saveBusiness({
        businessName: settings.businessName,
        gstin: settings.gstin,
        address: settings.address,
        city: settings.city,
        stateCode: settings.stateCode,
        pincode: settings.pincode,
        phone: settings.phone,
        email: settings.email,
        logoPath: settings.logoPath,
        licenseKey: settings.licenseKey,
        bank: settings.bank,
        syncIntervalMinutes: values.syncIntervalMinutes,
      });
      toast.success('Sync interval saved');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  const selected = watch('syncIntervalMinutes');

  return (
    <SectionCard title="Cloud Sync" description="How often data is pulled from the server in the background." >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Sync Interval" htmlFor="syncInterval">
          <Select
            disabled={!canManage}
            value={String(selected)}
            onValueChange={(v) => setValue('syncIntervalMinutes', Number(v), { shouldDirty: true })}
          >
            <SelectTrigger id="syncInterval" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYNC_INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt === 0 ? 'Manual only' : opt === 1 ? '1 minute' : `${opt} minutes`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {canManage && (
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !formState.isDirty}>{busy ? 'Saving…' : 'Save Sync Settings'}</Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

// ─── Theme / Appearance ───────────────────────────────────────────────────────

function AppearanceSection() {
  const { mode, setMode } = useThemeStore();

  return (
    <SectionCard title="Appearance" description="Applies immediately and persists on this device." >
      <div className="flex flex-wrap gap-3">
        {THEME_MODES.map((m) => {
          const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : Monitor;
          const label = m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'System';
          return (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              onClick={() => setMode(m)}
              className="gap-2"
            >
              <Icon className="size-4" />
              {label}
            </Button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">System follows your OS light/dark preference.</p>
    </SectionCard>
  );
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

function WhatsAppSection({ canManage }: { canManage: boolean }) {
  void canManage;
  return (
    <SectionCard
      title="WhatsApp Integration"
      description="Send invoices and payment reminders via WhatsApp Business API."
      
    >
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Coming Soon</Badge>
        <p className="text-sm text-muted-foreground">WhatsApp integration is not yet available. Configuration fields will appear here when enabled.</p>
      </div>
    </SectionCard>
  );
}

// ─── Backup & Restore ─────────────────────────────────────────────────────────

function BackupSection({
  repos, businessId, service, canManage,
}: {
  repos: ReturnType<typeof useRepositories>;
  businessId: string;
  service: ReturnType<typeof useAdminService>;
  canManage: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      // Collect data in bounded fetches — each repo uses LEDGER_FETCH_CAP (≤5000).
      const [
        settings,
        members,
        locations,
        products,
        customers,
        suppliers,
        invoices,
        purchases,
        quotations,
        deliveryNotes,
        creditNotes,
        debitNotes,
        expenses,
        cashEntries,
        stockMovements,
        journalEntries,
        accounts,
      ] = await Promise.all([
        repos.businessSettings.get(),
        repos.members.list({ orderByField: 'email', direction: 'asc', limit: 5000, filters: [] }),
        repos.locations.list({ orderByField: 'name', direction: 'asc', limit: 500, filters: [] }),
        repos.products.list({ orderByField: 'name', direction: 'asc', limit: 5000, filters: [] }),
        repos.customers.list({ orderByField: 'name', direction: 'asc', limit: 5000, filters: [] }),
        repos.suppliers.list({ orderByField: 'name', direction: 'asc', limit: 5000, filters: [] }),
        repos.invoices.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.purchases.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.quotations.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.deliveryNotes.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.creditNotes.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.debitNotes.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.expenses.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.cashEntries.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.stockMovements.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.journalEntries.list({ orderByField: 'date', direction: 'desc', limit: 5000, filters: [] }),
        repos.accounts.list({ orderByField: 'code', direction: 'asc', limit: 500, filters: [] }),
      ]);

      const envelope = {
        schemaVersion: 1,
        applicationVersion: '10.0.0',
        exportedAt: new Date().toISOString(),
        businessId,
        businessName: settings?.businessName ?? '',
        settings: { business: settings, integrations: null },
        members: members.items, locations: locations.items, products: products.items,
        customers: customers.items, suppliers: suppliers.items,
        invoices: invoices.items, purchases: purchases.items, quotations: quotations.items,
        deliveryNotes: deliveryNotes.items, creditNotes: creditNotes.items, debitNotes: debitNotes.items,
        expenses: expenses.items, cashEntries: cashEntries.items, stockMovements: stockMovements.items,
        journalEntries: journalEntries.items, accounts: accounts.items,
      };

      const json = JSON.stringify(envelope, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hynish-backup-${businessId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const entityCounts: Record<string, number> = {
        members: members.items.length, locations: locations.items.length, products: products.items.length,
        customers: customers.items.length, suppliers: suppliers.items.length, invoices: invoices.items.length,
        purchases: purchases.items.length, quotations: quotations.items.length, deliveryNotes: deliveryNotes.items.length,
        creditNotes: creditNotes.items.length, debitNotes: debitNotes.items.length, expenses: expenses.items.length,
        cashEntries: cashEntries.items.length, stockMovements: stockMovements.items.length,
        journalEntries: journalEntries.items.length, accounts: accounts.items.length,
      };
      await service.backup.recordMetadata({
        sizeEstimateBytes: json.length,
        entityCounts,
        applicationVersion: '10.0.0',
      });
      toast.success('Backup downloaded');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setExporting(false);
    }
  }

  function handleRestore() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setRestoring(true);
      try {
        const text = await file.text();
        const raw = JSON.parse(text) as unknown;
        const { validateBackupEnvelope, backupRestorePreview } = await import('@hynish/domain');
        const envelope = validateBackupEnvelope(raw);
        const preview = backupRestorePreview(envelope);

        if (preview.businessId !== businessId) {
          toast.error(`This backup is for business "${preview.businessName}" — it cannot be restored here.`);
          return;
        }

        const lines = Object.entries(preview.entityCounts)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${n} ${k}`)
          .join(', ');
        toast.warning(
          `Restore preview: ${lines}. Exported ${preview.exportedAt.slice(0, 10)}. Full restore is not yet supported — use this file with the Hynish migration tool or contact support.`,
          { duration: 8000 },
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not read backup file');
      } finally {
        setRestoring(false);
      }
    };
    input.click();
  }

  return (
    <SectionCard
      title="Backup & Restore"
      description="Export all business data as a versioned JSON file. Imports are validated before any changes are applied."
      
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {canManage && (
            <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
              <HardDriveDownload className="size-4" />
              {exporting ? 'Exporting…' : 'Export Backup'}
            </Button>
          )}
          <Button onClick={handleRestore} disabled={restoring} variant="outline" className="gap-2">
            <HardDriveUpload className="size-4" />
            {restoring ? 'Reading…' : 'Validate Backup File'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Backup files never contain API keys or Firebase credentials. Full data restore requires the Hynish migration tool.
        </p>
      </div>
    </SectionCard>
  );
}
