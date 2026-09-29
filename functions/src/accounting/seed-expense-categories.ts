/**
 * seedExpenseCategories (BR-EXP-04, TD §6.1.2). Server-authoritative, idempotent. Seeds the 12
 * default expense categories (Rent, Electricity, … Other) with deterministic ids (`exp-cat-<slug>`,
 * TD §6.1.2 — not random, so two never-synced devices/first-runs converge on the same records) and
 * auto-generates each category's own expense account (`acc-<slug>`, code starting at 5100 stepping
 * by 10, BR-ACC-19) linked via `expenseCategoryId`. Mirrors `seedChartOfAccounts` exactly: creates
 * only what's missing, so a retry or repeated admin click never duplicates or overwrites a category
 * or its account.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { DEFAULT_EXPENSE_CATEGORIES, EXPENSE_ACCOUNT_CODE_START, EXPENSE_ACCOUNT_CODE_STEP, slugId } from '@hynish/domain';
import { createAudit, logActivity } from '../masterdata/common.js';
import { seedChartOfAccountsRequest } from '../schemas/accounting.js';

export const seedExpenseCategories = defineCallable(seedChartOfAccountsRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'expenses.manage');

  const b = input.businessId;
  const catCol = db.collection(`businesses/${b}/expenseCategories`);
  const accCol = db.collection(`businesses/${b}/accounts`);

  // Existing expense-type accounts decide the next auto-assigned code (BR-ACC-19), read once up front.
  const existingAccSnap = await accCol.where('type', '==', 'expense').get();
  let nextCode = existingAccSnap.docs.reduce(
    (max, d) => Math.max(max, Number(d.data().code) || 0),
    EXPENSE_ACCOUNT_CODE_START - EXPENSE_ACCOUNT_CODE_STEP,
  );

  let created = 0;
  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const catId = slugId('exp-cat-', name);
    const accId = slugId('acc-', name);
    const catRef = catCol.doc(catId);
    const accRef = accCol.doc(accId);
    const [catSnap, accSnap] = await Promise.all([catRef.get(), accRef.get()]);
    if (catSnap.exists && accSnap.exists) continue;

    nextCode += EXPENSE_ACCOUNT_CODE_STEP;
    const batch = db.batch();
    if (!accSnap.exists) {
      batch.set(accRef, {
        id: accId, businessId: b, code: nextCode, name, nameLower: name.toLowerCase(),
        type: 'expense', isSystem: false, expenseCategoryId: catId, normalSide: 'debit',
        ...createAudit(actor.uid),
      });
    }
    if (!catSnap.exists) {
      batch.set(catRef, {
        id: catId, businessId: b, name, slug: catId, accountId: accId, isDefault: true,
        ...createAudit(actor.uid),
      });
    }
    logActivity(db, (r, d) => batch.set(r, d), actor, 'create', { type: 'expense_category', id: catId, label: name });
    await batch.commit();
    created++;
  }

  return { created, total: DEFAULT_EXPENSE_CATEGORIES.length };
});
