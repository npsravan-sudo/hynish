/**
 * logCashEntry (BR-CASH-01, TD §6.3). A manual Cash Book entry — a **separate, informal ledger**
 * that never posts to the journal and never touches `accounts`/`journalEntries` (BR-CASH-02). This
 * is the standalone entry point for categories no other flow auto-generates (Capital Introduced,
 * Loan/Advance Received, Bank Deposit, Loan Repayment, …); `recordPayment` (Phase 5) and payroll can
 * also opt to write a matching entry, but that is separate from this callable. cashbook.manage only;
 * idempotent by requestId; server-authoritative (client never writes `cashEntries` directly).
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES } from '@hynish/domain';
import { createAudit, logActivity } from '../masterdata/common.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { logCashEntryRequest } from '../schemas/accounting.js';

const IN_SET = new Set<string>(CASH_IN_CATEGORIES);
const OUT_SET = new Set<string>(CASH_OUT_CATEGORIES);

export const logCashEntry = defineCallable(logCashEntryRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'cashbook.manage');
  assertLocationAccess(actor.member, input.locationId);

  const validSet = input.type === 'in' ? IN_SET : OUT_SET;
  if (!validSet.has(input.category)) {
    throw appError('VALIDATION_FAILED', `"${input.category}" is not a valid ${input.type} category.`);
  }

  const b = input.businessId;

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ cashEntryId: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const ref = db.collection(`businesses/${b}/cashEntries`).doc();
    tx.set(ref, {
      id: ref.id, businessId: b, date: input.date, locationId: input.locationId,
      type: input.type, category: input.category, amountPaise: input.amountPaise, mode: input.mode,
      reference: input.reference, notes: input.notes,
      source: { type: 'manual', id: null },
      ...createAudit(actor.uid),
    });
    logActivity(db, (r, d) => tx.set(r, d), actor, 'create', { type: 'cash_entry', id: ref.id, label: `${input.type} ${input.category}` }, input.locationId);

    const out = { cashEntryId: ref.id };
    writeIdempotentResult(tx, db, b, input.requestId, 'logCashEntry', out, actor.uid);
    return out;
  });

  return result;
});
