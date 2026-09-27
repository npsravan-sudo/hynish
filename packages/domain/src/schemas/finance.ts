/** Finance schemas: Purchase, Payment, Account, JournalEntry, Expense, CashEntry (DATA-MODEL §6.15, §6.20–6.24). */
import { z } from 'zod';
import { PAYMENT_MODES, PAYMENT_STATUSES, CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES } from '../constants.js';
import { ACCOUNT_TYPES, JOURNAL_REF_TYPES } from '../accounting.js';
import { entity, softDelete, nonNegPaise, qty, businessDate, epochMs } from './common.js';

const paymentMode = z.enum(PAYMENT_MODES);

export const purchaseLineSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  nameSnapshot: z.string(),
  enteredUnit: z.string(),
  enteredQty: qty,
  baseQty: z.number().positive(),
  ratePaise: nonNegPaise, // per entered unit
  amountPaise: nonNegPaise,
});
export const purchaseSchema = entity.merge(softDelete).extend({
  date: businessDate,
  locationId: z.string().min(1),
  supplierId: z.string().min(1),
  supplierSnapshot: z.object({ name: z.string(), gstin: z.string() }),
  supplierBillNo: z.string().default(''),
  lines: z.array(purchaseLineSchema).min(1).max(500),
  totalPaise: nonNegPaise,
  initialPaidPaise: nonNegPaise,
  paidPaise: nonNegPaise,
  outstandingPaise: nonNegPaise,
  paymentStatus: z.enum(PAYMENT_STATUSES),
  dueDate: businessDate.nullable(),
  notes: z.string().default(''),
});
export type Purchase = z.infer<typeof purchaseSchema>;

export const paymentSchema = entity.merge(softDelete).extend({
  direction: z.enum(['in', 'out']),
  targetType: z.enum(['invoice', 'purchase']),
  targetId: z.string().min(1),
  targetNumber: z.string(),
  partyId: z.string().nullable(),
  date: businessDate,
  amountPaise: nonNegPaise.refine((v) => v > 0, 'Amount must be positive'), // BR-PAY-01
  mode: paymentMode,
  reference: z.string().default(''),
  notes: z.string().default(''),
  locationId: z.string().min(1),
  cashEntryId: z.string().nullable(),
  journalEntryId: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentSchema = z.object({
  direction: z.enum(['in', 'out']),
  targetType: z.enum(['invoice', 'purchase']),
  targetId: z.string().min(1),
  date: businessDate,
  amountPaise: nonNegPaise.refine((v) => v > 0),
  mode: paymentMode,
  reference: z.string().default(''),
  notes: z.string().default(''),
  alsoLogCashBook: z.boolean().default(false),
  confirmations: z.array(z.enum(['OVER_PAYMENT'])).default([]),
});
export type CreatePayment = z.infer<typeof createPaymentSchema>;

export const accountSchema = entity.merge(softDelete).extend({
  code: z.number().int(),
  name: z.string().min(1),
  nameLower: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  isSystem: z.boolean(),
  expenseCategoryId: z.string().nullable(),
  normalSide: z.enum(['debit', 'credit']),
});
export type Account = z.infer<typeof accountSchema>;

export const journalLineSchema = z
  .object({
    accountId: z.string().min(1),
    debitPaise: nonNegPaise,
    creditPaise: nonNegPaise,
  })
  .refine((l) => !(l.debitPaise > 0 && l.creditPaise > 0), 'A line has either a debit or a credit');
export const journalEntrySchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  date: businessDate,
  locationId: z.string().min(1),
  refType: z.enum(JOURNAL_REF_TYPES),
  refId: z.string(),
  refLabel: z.string(),
  lines: z.array(journalLineSchema).min(1),
  totalPaise: nonNegPaise,
  status: z.enum(['posted', 'voided']),
  voidedAt: epochMs.nullable(),
  voidedBy: z.string().nullable(),
  voidReason: z.enum(['edit', 'delete', 'restore']).nullable(),
  createdAt: epochMs,
  createdBy: z.string(),
  schemaVersion: z.number().int().positive(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const expenseCategorySchema = entity.merge(softDelete).extend({
  name: z.string().min(1),
  slug: z.string(),
  accountId: z.string().min(1),
  isDefault: z.boolean(),
});
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

export const expenseSchema = entity.merge(softDelete).extend({
  date: businessDate,
  locationId: z.string().min(1),
  categoryId: z.string().min(1),
  categoryNameSnapshot: z.string(),
  amountPaise: nonNegPaise.refine((v) => v > 0), // BR-EXP-01
  mode: paymentMode,
  notes: z.string().default(''),
  journalEntryId: z.string(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const cashEntrySchema = entity.merge(softDelete).extend({
  date: businessDate,
  locationId: z.string().min(1),
  type: z.enum(['in', 'out']),
  category: z.union([z.enum(CASH_IN_CATEGORIES), z.enum(CASH_OUT_CATEGORIES)]),
  amountPaise: nonNegPaise.refine((v) => v > 0), // BR-CASH-01
  mode: paymentMode,
  reference: z.string().default(''),
  notes: z.string().default(''),
  source: z.object({ type: z.enum(['payment', 'payroll', 'staff_payment', 'manual']), id: z.string().nullable() }),
});
export type CashEntry = z.infer<typeof cashEntrySchema>;
