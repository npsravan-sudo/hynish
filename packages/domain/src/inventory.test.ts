import { describe, it, expect } from 'vitest';
import {
  lowStockThreshold, stockStatus, isLowStock, toBaseQty, checkAvailability, isOutbound,
} from './inventory.js';

describe('inventory — low stock default (BR-STK-04, §26)', () => {
  it('defaults to 5 when a product has no threshold', () => {
    expect(lowStockThreshold(null)).toBe(5);
    expect(lowStockThreshold(0)).toBe(5);
    expect(lowStockThreshold(undefined)).toBe(5);
  });
  it('uses a positive product override', () => {
    expect(lowStockThreshold(12)).toBe(12);
  });
  it('flags low stock at or below the threshold', () => {
    expect(isLowStock(5, null)).toBe(true);
    expect(isLowStock(6, null)).toBe(false);
    expect(isLowStock(3, 10)).toBe(true);
  });
  it('buckets stock status', () => {
    expect(stockStatus(0, null)).toBe('out');
    expect(stockStatus(-1, null)).toBe('out');
    expect(stockStatus(4, null)).toBe('low');
    expect(stockStatus(50, null)).toBe('healthy');
  });
});

describe('inventory — availability is a WARNING, not a block (BR-STK-06, §25)', () => {
  it('reports shortage without throwing', () => {
    const r = checkAvailability(10, 4);
    expect(r.hasShortage).toBe(true);
    expect(r.shortfallBaseQty).toBe(6);
  });
  it('reports no shortage when enough stock', () => {
    const r = checkAvailability(4, 10);
    expect(r.hasShortage).toBe(false);
    expect(r.shortfallBaseQty).toBe(0);
  });
});

describe('inventory — units & movement direction', () => {
  it('converts alt units to base', () => {
    expect(toBaseQty(2, 12)).toBe(24); // 2 dozen
    expect(toBaseQty(5, null)).toBe(5);
  });
  it('classifies outbound movements', () => {
    expect(isOutbound('sale')).toBe(true);
    expect(isOutbound('delivery_out')).toBe(true);
    expect(isOutbound('transfer_out')).toBe(true);
    expect(isOutbound('purchase')).toBe(false);
    expect(isOutbound('opening')).toBe(false);
  });
});
