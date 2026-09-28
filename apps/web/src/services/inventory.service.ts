/**
 * Inventory write service (Phase 6 §4, §34). The ONLY write path for stock — thin, typed wrappers
 * over the server-authoritative Cloud Functions. UI/hooks call these; they never write Firestore.
 * The server records immutable movements and updates derived levels atomically.
 */
import type { AdjCategory } from '@hynish/domain';
import { callable } from '@/lib/firebase/functions';

type Req = { requestId: string };
type Conf = { confirmations?: ('NEGATIVE_STOCK')[] };

const adjustFn = callable<{
  businessId: string; date: string; productId: string; variantId: string; locationId: string;
  direction: 'in' | 'out'; qty: number; reasonCategory: AdjCategory; note: string;
} & Req & Conf, { movementId: string; qtyAfter: number }>('recordStockAdjustment');

const transferFn = callable<{
  businessId: string; date: string; fromLocationId: string; toLocationId: string;
  items: { productId: string; variantId: string; qty: number; nameSnapshot: string }[]; notes: string;
} & Req & Conf, { transferId: string }>('transferStock');

const countFn = callable<{
  businessId: string; date: string; locationId: string; notes: string;
  lines: { productId: string; variantId: string; countedQty: number }[];
} & Req, { stockCountId: string; changedCount: number }>('finalizeStockCount');

const openingFn = callable<{
  businessId: string; date: string; locationId: string; notes: string;
  items: { productId: string; variantId: string; qty: number }[];
} & Req, { count: number }>('postOpeningStock');

export function createInventoryService(businessId: string) {
  return {
    adjust: (input: Omit<Parameters<typeof adjustFn>[0], 'businessId'>) => adjustFn({ businessId, ...input }),
    transfer: (input: Omit<Parameters<typeof transferFn>[0], 'businessId'>) => transferFn({ businessId, ...input }),
    finalizeCount: (input: Omit<Parameters<typeof countFn>[0], 'businessId'>) => countFn({ businessId, ...input }),
    postOpening: (input: Omit<Parameters<typeof openingFn>[0], 'businessId'>) => openingFn({ businessId, ...input }),
  };
}
export type InventoryService = ReturnType<typeof createInventoryService>;
