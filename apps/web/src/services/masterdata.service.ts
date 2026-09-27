/**
 * Master-data write service (Phase 4 §4). The ONLY write path for products/customers/suppliers/
 * locations — thin, typed wrappers over the server-authoritative Cloud Functions. UI and hooks
 * call these; they never write Firestore/Storage directly. Errors are mapped to friendly text by
 * the caller via `mapCallableError`.
 */
import type {
  CreateProduct,
  CreateCustomer,
  CreateSupplier,
  LocationType,
} from '@hynish/domain';
import { callable } from '@/lib/firebase/functions';
import { uploadProductImage } from '@/infrastructure/storage/product-image';

type WithId<T> = T & { id?: string };

const saveProductFn = callable<CreateProduct & { businessId: string; id?: string }, { productId: string }>('saveProduct');
const setProductActiveFn = callable<{ businessId: string; id: string; active: boolean }, { ok: boolean }>('setProductActive');
const setProductImageFn = callable<{ businessId: string; id: string; imagePath: string | null }, { ok: boolean }>('setProductImage');
const saveCustomerFn = callable<CreateCustomer & { businessId: string; id?: string }, { customerId: string }>('saveCustomer');
const setCustomerActiveFn = callable<{ businessId: string; id: string; active: boolean }, { ok: boolean }>('setCustomerActive');
const saveSupplierFn = callable<CreateSupplier & { businessId: string; id?: string }, { supplierId: string }>('saveSupplier');
const setSupplierActiveFn = callable<{ businessId: string; id: string; active: boolean }, { ok: boolean }>('setSupplierActive');

export interface LocationInput {
  id?: string;
  name: string;
  type: LocationType;
  address: string;
  openingCashBalancePaise: number;
  isDefault: boolean;
  sortOrder: number;
}
const saveLocationFn = callable<LocationInput & { businessId: string }, { locationId: string }>('saveLocation');
const setLocationActiveFn = callable<{ businessId: string; id: string; active: boolean }, { ok: boolean }>('setLocationActive');

export function createMasterDataService(businessId: string) {
  return {
    products: {
      async save(input: WithId<CreateProduct>): Promise<string> {
        const { productId } = await saveProductFn({ businessId, ...input });
        return productId;
      },
      setActive: (id: string, active: boolean) => setProductActiveFn({ businessId, id, active }),
      /** Compress + upload a photo, then record it (server deletes the previous one). */
      async uploadImage(productId: string, file: File): Promise<string> {
        const { path } = await uploadProductImage(businessId, productId, file);
        await setProductImageFn({ businessId, id: productId, imagePath: path });
        return path;
      },
      clearImage: (productId: string) => setProductImageFn({ businessId, id: productId, imagePath: null }),
    },
    customers: {
      async save(input: WithId<CreateCustomer>): Promise<string> {
        const { customerId } = await saveCustomerFn({ businessId, ...input });
        return customerId;
      },
      setActive: (id: string, active: boolean) => setCustomerActiveFn({ businessId, id, active }),
    },
    suppliers: {
      async save(input: WithId<CreateSupplier>): Promise<string> {
        const { supplierId } = await saveSupplierFn({ businessId, ...input });
        return supplierId;
      },
      setActive: (id: string, active: boolean) => setSupplierActiveFn({ businessId, id, active }),
    },
    locations: {
      async save(input: LocationInput): Promise<string> {
        const { locationId } = await saveLocationFn({ businessId, ...input });
        return locationId;
      },
      setActive: (id: string, active: boolean) => setLocationActiveFn({ businessId, id, active }),
    },
  };
}
export type MasterDataService = ReturnType<typeof createMasterDataService>;
