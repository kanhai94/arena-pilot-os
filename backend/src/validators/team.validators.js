import { z } from 'zod';
import { TEAM_MEMBER_ROLES } from '../constants/roles.js';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../constants/permissions.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const passwordRule = z.string().min(8).max(72);

const teamRoleEnum = z.enum(TEAM_MEMBER_ROLES);
const permissionEnum = z.enum(ALL_PERMISSIONS);

const uniquePermissions = (permissions) => [...new Set(permissions)];

export const createTeamMemberSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    title: z.string().min(2).max(120).optional(),
    designation: z.string().min(2).max(120).optional(),
    email: z.string().email(),
    password: passwordRule,
    role: teamRoleEnum,
    permissions: z.array(permissionEnum).optional()
  })
  .superRefine((value, ctx) => {
    const allowed = ROLE_DEFAULT_PERMISSIONS[value.role] || [];
    const selected = uniquePermissions(value.permissions || allowed);
    const hasInvalid = selected.some((permission) => !allowed.includes(permission));

    if (hasInvalid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Permissions must be a subset of role defaults for ${value.role}`,
        path: ['permissions']
      });
    }
  });

export const updateTeamMemberAccessSchema = z
  .object({
    role: teamRoleEnum.optional(),
    permissions: z.array(permissionEnum).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')
  .superRefine((value, ctx) => {
    if (!value.permissions) {
      return;
    }

    const selectedRole = value.role;
    if (!selectedRole) {
      return;
    }

    const allowed = ROLE_DEFAULT_PERMISSIONS[selectedRole] || [];
    const hasInvalid = uniquePermissions(value.permissions).some((permission) => !allowed.includes(permission));

    if (hasInvalid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Permissions must be a subset of role defaults for ${selectedRole}`,
        path: ['permissions']
      });
    }
  });

export const teamMemberIdParamSchema = z.object({
  userId: z.string().regex(objectIdRegex, 'Invalid team member id')
});

export const parseOrThrow = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(', ');
    const error = new Error(message || 'Validation failed');
    error.statusCode = 400;
    throw error;
  }
  return parsed.data;
};
