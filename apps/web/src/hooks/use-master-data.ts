/**
 * Master-data access hooks (Phase 4 §4). Bind repositories (reads) and the write service to the
 * current business. UI uses ONLY these — never Firestore directly.
 */
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { makeRepositories, type Repositories } from '@/infrastructure/repositories';
import { createMasterDataService, type MasterDataService } from '@/services/masterdata.service';
import { createSalesService, type SalesService } from '@/services/sales.service';

export function useRepositories(): Repositories {
  const businessId = useAuthStore((s) => s.businessId);
  return useMemo(() => makeRepositories(businessId), [businessId]);
}

export function useMasterDataService(): MasterDataService {
  const businessId = useAuthStore((s) => s.businessId);
  return useMemo(() => createMasterDataService(businessId), [businessId]);
}

export function useSalesService(): SalesService {
  const businessId = useAuthStore((s) => s.businessId);
  return useMemo(() => createSalesService(businessId), [businessId]);
}
