import { z } from 'zod';
import { PERMISSIONS, ROLES } from '@hynish/domain';

/** Server-side request schemas (Phase 2 §54, §55). Server validation is independent of the client. */

const roleSchema = z.enum(ROLES);
const permissionSchema = z.enum(PERMISSIONS);
const permissionOverrides = z.record(permissionSchema, z.boolean());

export const createMemberSchema = z.object({
  businessId: z.string().min(1),
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  role: roleSchema,
  locationIds: z.array(z.string().min(1)).nullable(),
  permissionOverrides: permissionOverrides.nullable().optional(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  businessId: z.string().min(1),
  uid: z.string().min(1),
  role: roleSchema.optional(),
  locationIds: z.array(z.string().min(1)).nullable().optional(),
  permissionOverrides: permissionOverrides.nullable().optional(),
  displayName: z.string().min(1).max(120).optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const setMemberActiveSchema = z.object({
  businessId: z.string().min(1),
  uid: z.string().min(1),
  active: z.boolean(),
});
export type SetMemberActiveInput = z.infer<typeof setMemberActiveSchema>;
