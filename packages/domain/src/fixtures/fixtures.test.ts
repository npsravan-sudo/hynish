import { describe, it, expect } from 'vitest';
import {
  businessSchema, memberSchema, locationSchema, productSchema, customerSchema, supplierSchema,
  invoiceSchema, paymentSchema, journalEntrySchema, stockMovementSchema, businessSettingsSchema,
  creditNoteSchema,
} from '../schemas/index.js';
import {
  businessFixture, memberFixture, locationFixture, productFixture, customerFixture, supplierFixture,
  invoiceFixture, paymentFixture, journalEntryFixture, stockMovementFixture, settingsFixture,
  creditNoteFixture,
} from './index.js';

describe('fixtures validate against their schemas (§57)', () => {
  it('every fixture parses cleanly', () => {
    expect(businessSchema.safeParse(businessFixture()).success).toBe(true);
    expect(memberSchema.safeParse(memberFixture()).success).toBe(true);
    expect(locationSchema.safeParse(locationFixture()).success).toBe(true);
    expect(productSchema.safeParse(productFixture()).success).toBe(true);
    expect(customerSchema.safeParse(customerFixture()).success).toBe(true);
    expect(supplierSchema.safeParse(supplierFixture()).success).toBe(true);
    expect(invoiceSchema.safeParse(invoiceFixture()).success).toBe(true);
    expect(paymentSchema.safeParse(paymentFixture()).success).toBe(true);
    expect(journalEntrySchema.safeParse(journalEntryFixture()).success).toBe(true);
    expect(stockMovementSchema.safeParse(stockMovementFixture()).success).toBe(true);
    expect(businessSettingsSchema.safeParse(settingsFixture()).success).toBe(true);
    expect(creditNoteSchema.safeParse(creditNoteFixture()).success).toBe(true);
  });

  it('the invoice fixture is internally consistent (a balanced sale)', () => {
    const inv = invoiceFixture();
    const lineTax = inv.lines.reduce((s, l) => s + l.cgstPaise + l.sgstPaise + l.igstPaise, 0);
    expect(lineTax).toBe(inv.taxPaise);
    expect(inv.subtotalPaise + inv.taxPaise + inv.roundOffPaise).toBe(inv.grandTotalPaise);
  });

  it('the journal fixture balances (debits === credits)', () => {
    const je = journalEntryFixture();
    const dr = je.lines.reduce((s, l) => s + l.debitPaise, 0);
    const cr = je.lines.reduce((s, l) => s + l.creditPaise, 0);
    expect(dr).toBe(cr);
  });
});
