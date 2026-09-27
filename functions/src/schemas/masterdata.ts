import { z } from 'zod';
import {
  createProductSchema,
  createCustomerSchema,
  createSupplierSchema,
  LOCATION_TYPES,
} from '@hynish/domain';

/** Server request schemas for master-data callables (Phase 4). businessId is always required. */
const withBusiness = { businessId: z.string().min(1) };

export const saveProductRequest = createProductSchema.extend({
  ...withBusiness,
  id: z.string().min(1).optional(), // present = update
});
export type SaveProductRequest = z.infer<typeof saveProductRequest>;

export const setProductImageRequest = z.object({
  ...withBusiness,
  id: z.string().min(1),
  imagePath: z.string().nullable(), // null clears the image
});

export const saveCustomerRequest = createCustomerSchema.extend({
  ...withBusiness,
  id: z.string().min(1).optional(),
});
export type SaveCustomerRequest = z.infer<typeof saveCustomerRequest>;

export const saveSupplierRequest = createSupplierSchema.extend({
  ...withBusiness,
  id: z.string().min(1).optional(),
});
export type SaveSupplierRequest = z.infer<typeof saveSupplierRequest>;

export const saveLocationRequest = z.object({
  ...withBusiness,
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(80),
  type: z.enum(LOCATION_TYPES),
  address: z.string().max(300).default(''),
  openingCashBalancePaise: z.number().int().nonnegative().default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type SaveLocationRequest = z.infer<typeof saveLocationRequest>;

/** Generic activate/deactivate (archive/restore) request. */
export const setActiveRequest = z.object({
  ...withBusiness,
  id: z.string().min(1),
  active: z.boolean(),
});
export type SetActiveRequest = z.infer<typeof setActiveRequest>;
