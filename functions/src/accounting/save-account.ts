/**
 * saveAccount (BR-ACC-18, TD §6.1.8). Creates a CUSTOM (non-system) account. Legacy `addCustomAccount()`
 * rejects a duplicate name (case-insensitive) and auto-assigns a code (max existing code of the same
 * type + 10) when the user leaves it blank. Only creation is supported — the source has no "edit
 * account" flow, and system accounts are never created here (they come from seedChartOfAccounts).
 * accounts.manage only; idempotent by requestId.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { normalSide, lower } from '@hynish/domain';
import { createAudit, logActivity } from '../masterdata/common.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { saveAccountRequest } from '../schemas/accounting.js';

export const saveAccount = defineCallable(saveAccountRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'accounts.manage');

  const b = input.businessId;
  const col = db.collection(`businesses/${b}/accounts`);
  const nameLower = lower(input.name);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ accountId: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    // READ every account once (bounded — a Chart of Accounts is a handful of documents) to check
    // for a duplicate name and to compute the next code for this type (BR-ACC-18).
    const allSnap = await tx.get(col);
    const dup = allSnap.docs.find((d) => d.data().nameLower === nameLower && d.data().deletedAt == null);
    if (dup) throw appError('CONFLICT', 'An account with this name already exists.');

    let code = input.code;
    if (!code) {
      const maxOfType = allSnap.docs
        .filter((d) => d.data().type === input.type)
        .reduce((max, d) => Math.max(max, Number(d.data().code) || 0), 0);
      code = maxOfType + 10;
    }

    const ref = col.doc();
    tx.set(ref, {
      id: ref.id, businessId: b, code, name: input.name, nameLower, type: input.type,
      isSystem: false, expenseCategoryId: null, normalSide: normalSide(input.type),
      ...createAudit(actor.uid),
    });
    logActivity(db, (r, d) => tx.set(r, d), actor, 'create', { type: 'account', id: ref.id, label: input.name });

    const out = { accountId: ref.id };
    writeIdempotentResult(tx, db, b, input.requestId, 'saveAccount', out, actor.uid);
    return out;
  });

  return result;
});
