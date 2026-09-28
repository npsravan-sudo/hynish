/**
 * seedChartOfAccounts (§6, BR-ACC seed, TD §6.1.1). Server-authoritative, idempotent. Creates the
 * 14 default system accounts (Assets/Liabilities/Equity/Income/Expense) that journal postings have
 * referenced since Phase 5 by fixed id (`acc-cash`, `acc-sales`, …) — this is the first place those
 * ids become real `Account` documents so the Chart of Accounts, General Ledger and statements have
 * data to read. Safe to call repeatedly: each account is created only if it doesn't already exist
 * (per-doc existence check), so a retry or a second admin click never duplicates or overwrites one.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { DEFAULT_CHART_OF_ACCOUNTS, normalSide } from '@hynish/domain';
import { createAudit, logActivity } from '../masterdata/common.js';
import { seedChartOfAccountsRequest } from '../schemas/accounting.js';

export const seedChartOfAccounts = defineCallable(seedChartOfAccountsRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'accounts.manage');

  const b = input.businessId;
  const col = db.collection(`businesses/${b}/accounts`);

  let created = 0;
  for (const sys of DEFAULT_CHART_OF_ACCOUNTS) {
    const ref = col.doc(sys.id);
    const snap = await ref.get();
    if (snap.exists) continue;
    const batch = db.batch();
    batch.set(ref, {
      id: sys.id, businessId: b, code: sys.code, name: sys.name, nameLower: sys.name.toLowerCase(),
      type: sys.type, isSystem: true, expenseCategoryId: null, normalSide: normalSide(sys.type),
      ...createAudit(actor.uid),
    });
    logActivity(db, (r, d) => batch.set(r, d), actor, 'create', { type: 'account', id: sys.id, label: sys.name });
    await batch.commit();
    created++;
  }

  return { created, total: DEFAULT_CHART_OF_ACCOUNTS.length };
});
