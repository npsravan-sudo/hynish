/**
 * Sales write service (Phase 5 §4). The ONLY write path for invoices, quotations and payments —
 * thin, typed wrappers over the server-authoritative Cloud Functions. UI/hooks call these; they
 * never write Firestore directly. Every critical financial value is (re)computed by the server; the
 * client only submits business inputs plus an idempotency requestId (§23, §27).
 */
import type { CreateInvoice, CreateQuotation, CreatePayment } from '@hynish/domain';
import { callable } from '@/lib/firebase/functions';

type Confirmable = { requestId: string };

const finalizeInvoiceFn = callable<
  CreateInvoice & { businessId: string; id?: string; acknowledgePastMonth?: boolean } & Confirmable,
  { invoiceId: string; number: string }
>('finalizeInvoice');
const deleteInvoiceFn = callable<{ businessId: string; id: string } & Confirmable, { ok: boolean }>('deleteInvoice');
const recordPaymentFn = callable<CreatePayment & { businessId: string } & Confirmable, { paymentId: string }>('recordPayment');
const saveQuotationFn = callable<
  CreateQuotation & { businessId: string; id?: string } & Confirmable,
  { quotationId: string; number: string }
>('saveQuotation');

export function createSalesService(businessId: string) {
  return {
    invoices: {
      finalize: (input: CreateInvoice & { id?: string; acknowledgePastMonth?: boolean } & Confirmable) =>
        finalizeInvoiceFn({ businessId, ...input }),
      remove: (id: string, requestId: string) => deleteInvoiceFn({ businessId, id, requestId }),
    },
    payments: {
      record: (input: CreatePayment & Confirmable) => recordPaymentFn({ businessId, ...input }),
    },
    quotations: {
      save: (input: CreateQuotation & { id?: string } & Confirmable) => saveQuotationFn({ businessId, ...input }),
    },
  };
}
export type SalesService = ReturnType<typeof createSalesService>;
