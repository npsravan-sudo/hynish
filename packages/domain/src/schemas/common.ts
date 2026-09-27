/**
 * Reusable Zod primitives for persisted-entity schemas (§39). All money is integer paise; all
 * instants are epoch ms; business dates are strict 'YYYY-MM-DD'. These schemas validate the
 * DOMAIN shape (post-conversion) — Firestore converters translate Timestamp <-> epoch ms.
 */
import { z } from 'zod';
import { GST_RATES_BP } from '../constants.js';
import { isValidBusinessDate } from '../fy.js';

/** Integer paise (can be negative, e.g. roundOff / signed movements). */
export const paise = z.number().int();
/** Non-negative integer paise. */
export const nonNegPaise = z.number().int().nonnegative();

/** Basis points 0–10000 for discounts. */
export const basisPoints = z.number().int().min(0).max(10000);

/** GST rate in basis points, constrained to the allowed set (BR-GST-08). */
export const gstRateBp = z
  .number()
  .int()
  .refine((v) => (GST_RATES_BP as readonly number[]).includes(v), { message: 'Unsupported GST rate' });

/** Quantity: positive, at most 3 decimal places. */
export const qty = z
  .number()
  .positive()
  .refine((v) => Number.isInteger(Math.round(v * 1000)), { message: 'At most 3 decimal places' });

/** Business date 'YYYY-MM-DD' within 1990–2200 (BR-DAT-02). */
export const businessDate = z.string().refine(isValidBusinessDate, { message: 'Invalid business date' });

/** Epoch milliseconds. */
export const epochMs = z.number().int().nonnegative();

/** GSTIN: 15 chars, uppercased. Blank allowed (B2C). */
export const gstin = z.string().trim().toUpperCase().max(15);

/** Standard audit metadata (§35). */
export const auditFields = z.object({
  createdAt: epochMs,
  createdBy: z.string().min(1),
  updatedAt: epochMs,
  updatedBy: z.string().min(1),
  schemaVersion: z.number().int().positive(),
});

/** Soft-delete tombstone (§36). deletedAt === null means live. */
export const softDelete = z.object({
  deletedAt: epochMs.nullable(),
  deletedBy: z.string().nullable(),
});

/** Business-scoped identity present on every business document (business isolation). */
export const businessScoped = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
});

/** Compose an entity schema: business identity + fields + audit. */
export const entity = businessScoped.merge(auditFields);
