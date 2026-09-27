/** People & audit schemas: Staff, PayrollEntry, StaffPayment, ActivityLog (DATA-MODEL §6.25–6.27). */
import { z } from 'zod';
import { PAYMENT_MODES } from '../constants.js';
import { entity, softDelete, nonNegPaise, businessDate, epochMs } from './common.js';

const paymentMode = z.enum(PAYMENT_MODES);
/** Payroll type values are NOT VERIFIED from the source (OQ-11); 'commission'|'salary' assumed. */
const payrollType = z.enum(['commission', 'salary']);

/** Shop payroll keyed by LOCATION (legacy field `userId` held a location id — BR-PRL-01). */
export const payrollEntrySchema = entity.merge(softDelete).extend({
  date: businessDate,
  locationId: z.string().min(1),
  type: payrollType,
  periodFrom: businessDate.nullable(),
  periodTo: businessDate.nullable(),
  amountPaise: nonNegPaise.refine((v) => v > 0),
  mode: paymentMode,
  notes: z.string().default(''),
  journalEntryId: z.string(),
  cashEntryId: z.string().nullable(),
});
export type PayrollEntry = z.infer<typeof payrollEntrySchema>;

export const staffSchema = entity.merge(softDelete).extend({
  name: z.string().min(1),
  phone: z.string().default(''),
  locationId: z.string().nullable(),
  defaultPaymentType: payrollType,
  defaultMode: paymentMode,
  status: z.enum(['active', 'inactive']),
});
export type Staff = z.infer<typeof staffSchema>;

export const staffPaymentSchema = entity.merge(softDelete).extend({
  staffId: z.string().min(1),
  staffNameSnapshot: z.string(),
  date: businessDate,
  locationId: z.string().nullable(),
  type: payrollType,
  amountPaise: nonNegPaise.refine((v) => v > 0),
  mode: paymentMode,
  notes: z.string().default(''),
  journalEntryId: z.string(),
  cashEntryId: z.string().nullable(),
});
export type StaffPayment = z.infer<typeof staffPaymentSchema>;

/** Immutable, server-written audit trail (BR-ADM-04). */
export const activityLogSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  at: epochMs,
  actorUid: z.string().min(1),
  actorName: z.string(),
  locationId: z.string().nullable(),
  action: z.string().min(1),
  target: z.object({ type: z.string(), id: z.string(), label: z.string() }).nullable(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  requestId: z.string().nullable(),
});
export type ActivityLog = z.infer<typeof activityLogSchema>;
