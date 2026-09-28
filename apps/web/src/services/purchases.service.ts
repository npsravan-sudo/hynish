/**
 * Purchases write service (Phase 6 §4). Thin, typed wrappers over the server-authoritative purchase
 * callables. Purchases carry no GST and no document number; the server computes amounts/total/stock.
 */
import type { CreatePurchase } from '@hynish/domain';
import { callable } from '@/lib/firebase/functions';

type Req = { requestId: string };

const finalizeFn = callable<CreatePurchase & { businessId: string } & Req, { purchaseId: string }>('finalizePurchase');
const deleteFn = callable<{ businessId: string; id: string; confirmations?: ('NEGATIVE_STOCK')[] } & Req, { ok: boolean }>('deletePurchase');

export function createPurchasesService(businessId: string) {
  return {
    finalize: (input: CreatePurchase & Req) => finalizeFn({ businessId, ...input }),
    remove: (id: string, requestId: string, confirmations: ('NEGATIVE_STOCK')[] = []) => deleteFn({ businessId, id, requestId, confirmations }),
  };
}
export type PurchasesService = ReturnType<typeof createPurchasesService>;
