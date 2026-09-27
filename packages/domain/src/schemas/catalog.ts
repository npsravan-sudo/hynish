/** Catalog schemas: Product (+Variant), Customer, Supplier (DATA-MODEL §6.7, §6.12–6.13). */
import { z } from 'zod';
import { UNITS } from '../constants.js';
import { entity, softDelete, nonNegPaise, gstRateBp, gstin } from './common.js';

export const altUnitSchema = z.object({
  name: z.string().min(1),
  factor: z.number().positive(), // base units per alt unit
});

export const variantSchema = z.object({
  id: z.string().min(1), // 'default' for non-variant products
  size: z.string().default(''),
  color: z.string().default(''),
  barcodeOverride: z.string().nullable().default(null),
  active: z.boolean().default(true),
});
export type Variant = z.infer<typeof variantSchema>;

export const productSchema = entity.merge(softDelete).extend({
  name: z.string().min(1),
  nameLower: z.string(),
  category: z.string().default(''),
  hsn: z.string().default(''),
  wholesalePricePaise: nonNegPaise,
  purchasePricePaise: nonNegPaise,
  gstRateBp,
  unit: z.enum(UNITS),
  altUnits: z.array(altUnitSchema).default([]),
  barcode: z.string().default(''), // normalized upper-case; '' if none
  lowStockThreshold: z.number().int().nullable().default(null), // null/0 -> default 5
  hasVariants: z.boolean(),
  variants: z.array(variantSchema).min(1),
  imagePath: z.string().nullable().default(null),
  searchTokens: z.array(z.string()).default([]),
});
export type Product = z.infer<typeof productSchema>;

/** Create DTO: the client submits business inputs; server fills id/audit/derived fields. */
export const createProductSchema = productSchema
  .omit({
    id: true,
    businessId: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
    schemaVersion: true,
    deletedAt: true,
    deletedBy: true,
    nameLower: true,
    searchTokens: true,
  });
export type CreateProduct = z.infer<typeof createProductSchema>;
export const updateProductSchema = createProductSchema.partial();
export type UpdateProduct = z.infer<typeof updateProductSchema>;

const customerStats = z.object({
  outstandingPaise: nonNegPaise.default(0),
  overdueInvoiceCount: z.number().int().default(0),
  lastInvoiceDate: z.string().nullable().default(null),
});

export const customerSchema = entity.merge(softDelete).extend({
  name: z.string().min(1),
  nameLower: z.string(),
  contactPerson: z.string().default(''),
  gstin: gstin.default(''), // '' => B2C
  stateCode: z.string().nullable().default(null),
  city: z.string().default(''),
  phone: z.string().default(''),
  address: z.string().default(''),
  creditLimitPaise: nonNegPaise.default(0), // 0 => no limit
  stats: customerStats.default({ outstandingPaise: 0, overdueInvoiceCount: 0, lastInvoiceDate: null }),
  searchTokens: z.array(z.string()).default([]),
});
export type Customer = z.infer<typeof customerSchema>;

export const createCustomerSchema = customerSchema.pick({
  name: true,
  contactPerson: true,
  gstin: true,
  stateCode: true,
  city: true,
  phone: true,
  address: true,
  creditLimitPaise: true,
});
export type CreateCustomer = z.infer<typeof createCustomerSchema>;

export const supplierSchema = entity.merge(softDelete).extend({
  name: z.string().min(1),
  nameLower: z.string(),
  contactPerson: z.string().default(''),
  gstin: gstin.default(''),
  stateCode: z.string().nullable().default(null),
  city: z.string().default(''),
  phone: z.string().default(''),
  address: z.string().default(''),
  stats: z.object({ payablePaise: nonNegPaise.default(0) }).default({ payablePaise: 0 }),
  searchTokens: z.array(z.string()).default([]),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const createSupplierSchema = supplierSchema.pick({
  name: true,
  contactPerson: true,
  gstin: true,
  stateCode: true,
  city: true,
  phone: true,
  address: true,
});
export type CreateSupplier = z.infer<typeof createSupplierSchema>;
