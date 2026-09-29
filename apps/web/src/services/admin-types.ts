/** Shared input types for the admin service (Phase 10). Mirror the function schemas. */
import type { SeriesKey } from '@hynish/domain';

export interface SaveBusinessSettingsInput {
  businessId: string;
  businessName: string;
  gstin: string;
  address: string;
  city: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  logoPath: string | null;
  licenseKey: string;
  bank: { bankName: string; accountNumber: string; ifsc: string };
  prefixes?: Partial<Record<SeriesKey, string>>;
  syncIntervalMinutes?: number;
}

export interface SaveIntegrationSettingsInput {
  businessId: string;
  whatsapp: {
    provider: string;
    phoneNumberId: string;
    businessAccountId: string;
    notes: string;
  };
}
