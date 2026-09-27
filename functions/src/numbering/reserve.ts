/**
 * `reserveDocumentNumber` callable (§16, §44). Server-authoritative, transaction-safe numbering.
 * Auth + permission enforced; the per-series create permission is required so a user can only
 * reserve numbers for documents they may create.
 */
import { z } from 'zod';
import { SERIES_KEYS, isValidBusinessDate, type SeriesKey, type Permission } from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { reserveNumber } from './reserve-core.js';

const reserveSchema = z.object({
  businessId: z.string().min(1),
  seriesKey: z.enum(SERIES_KEYS),
  dateISO: z.string().refine(isValidBusinessDate, 'Invalid date'),
});

/** Which create permission a series requires. */
const SERIES_PERMISSION: Record<SeriesKey, Permission> = {
  invoice_gst: 'sales.create',
  invoice_nogst: 'sales.create',
  quotation: 'quotations.manage',
  delivery_note: 'deliveryNotes.manage',
  credit_note: 'creditNotes.manage',
  debit_note: 'debitNotes.manage',
};

export const reserveDocumentNumber = defineCallable(reserveSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, SERIES_PERMISSION[input.seriesKey]);
  try {
    return await reserveNumber(db, { ...input, actorUid: actor.uid });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NUMBER_TAKEN')) {
      throw appError('CONFLICT', 'That number is already in use. Please retry.');
    }
    throw err;
  }
});
