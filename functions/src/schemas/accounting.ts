/**
 * Callable request schemas for the Accounting module (Phase 7). Every write is server-authoritative;
 * the client never supplies debit/credit totals or account balances — only the business inputs the
 * source actually exposes (TD §6.1: custom account add, Cash Book entries). There is no generic
 * "post arbitrary journal" endpoint — the legacy app never lets a user touch a debit/credit screen
 * except the Chart of Accounts itself (TD §6: "the business user never touches a debit/credit screen
 * directly except in the Chart of Accounts"), so none is built here either (§65 — do not invent).
 */
import { z } from 'zod';
import {
  createAccountSchema, createExpenseSchema, CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES, PAYMENT_MODES, isValidBusinessDate,
} from '@hynish/domain';

const businessId = z.string().min(1);
const requestId = z.string().min(1).max(200);

export const seedChartOfAccountsRequest = z.object({ businessId });
export type SeedChartOfAccountsRequest = z.infer<typeof seedChartOfAccountsRequest>;

export const saveAccountRequest = createAccountSchema.extend({ businessId, requestId });
export type SaveAccountRequest = z.infer<typeof saveAccountRequest>;

export const deleteAccountRequest = z.object({ businessId, id: z.string().min(1) });
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequest>;

/** Manual Cash Book entry (BR-CASH-01). Never posts to the journal (BR-CASH-02). */
export const logCashEntryRequest = z.object({
  businessId,
  date: z.string().refine(isValidBusinessDate, 'Invalid date'),
  locationId: z.string().min(1),
  type: z.enum(['in', 'out']),
  category: z.union([z.enum(CASH_IN_CATEGORIES), z.enum(CASH_OUT_CATEGORIES)]),
  amountPaise: z.number().int().positive(),
  mode: z.enum(PAYMENT_MODES),
  reference: z.string().default(''),
  notes: z.string().default(''),
  requestId,
});
export type LogCashEntryRequest = z.infer<typeof logCashEntryRequest>;

/** Save (create or edit) a Daily Expense (BR-EXP-01, TD §6.4). Edit always reverses the prior
 * journal entry and re-posts (TD §6.4) — never an in-place accounting adjustment. */
export const saveExpenseRequest = createExpenseSchema.extend({
  businessId,
  id: z.string().min(1).optional(),
  requestId,
});
export type SaveExpenseRequest = z.infer<typeof saveExpenseRequest>;

/** Delete = reverse its journal entry, then soft-delete (TD §6.4 "reverses then removes"). */
export const deleteExpenseRequest = z.object({ businessId, id: z.string().min(1), requestId });
export type DeleteExpenseRequest = z.infer<typeof deleteExpenseRequest>;
