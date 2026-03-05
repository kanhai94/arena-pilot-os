import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../constants/permissions.js';
import { hashPassword } from '../../utils/password.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const uniquePermissions = (permissions) => [...new Set(permissions)];

export const createTeamService = (repository) => {
  const resolveTenantId = () => TenantContext.requireTenantId();
  return {
    async createTeamMember(payload) {
      const tenantId = resolveTenantId();
      const existing = await repository.findActiveUserByEmail(tenantId, payload.email);
      if (existing) {
        throw new AppError('User with this email already exists', StatusCodes.CONFLICT);
      }

      const passwordHash = await hashPassword(payload.password);
      const roleDefaults = ROLE_DEFAULT_PERMISSIONS[payload.role] || [];
      const selectedPermissions = uniquePermissions(payload.permissions || roleDefaults);

      let member;
      try {
        member = await repository.createTeamMember({
          tenantId,
          fullName: payload.fullName,
          title: payload.title || '',
          designation: payload.designation || '',
          email: payload.email.toLowerCase(),
          passwordHash,
          role: payload.role,
          permissions: selectedPermissions,
          isActive: true
        });
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('User with this email already exists', StatusCodes.CONFLICT);
        }
        throw error;
      }

      return {
        userId: String(member._id),
        id: String(member._id),
        tenantId: String(member.tenantId),
        fullName: member.fullName,
        title: member.title || '',
        designation: member.designation || '',
        email: member.email,
        role: member.role,
        permissions: member.permissions || [],
        isActive: member.isActive,
        createdAt: member.createdAt
      };
    },

    async listTeamMembers() {
      const tenantId = resolveTenantId();
      const members = await repository.findTeamMembers(tenantId);

      return {
        items: members.map((member) => ({
          userId: String(member._id),
          id: String(member._id),
          tenantId: String(member.tenantId),
          fullName: member.fullName,
          title: member.title || '',
          designation: member.designation || '',
          email: member.email,
          role: member.role,
          permissions: member.permissions || [],
          isActive: member.isActive,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt
        })),
        total: members.length
      };
    },

    async updateTeamMemberAccess(userId, payload) {
      const tenantId = resolveTenantId();
      const existing = await repository.findTeamMemberById(tenantId, userId);
      if (!existing) {
        throw new AppError('Team member not found', StatusCodes.NOT_FOUND);
      }

      const nextRole = payload.role || existing.role;
      const roleDefaults = ROLE_DEFAULT_PERMISSIONS[nextRole] || [];
      const selectedPermissions = payload.permissions
        ? uniquePermissions(payload.permissions)
        : existing.permissions?.length
          ? existing.permissions
          : roleDefaults;

      const hasInvalidPermission = selectedPermissions.some((permission) => !roleDefaults.includes(permission));
      if (hasInvalidPermission) {
        throw new AppError('Permissions are not allowed for selected role', StatusCodes.BAD_REQUEST);
      }

      const updated = await repository.updateTeamMemberById(tenantId, userId, {
        ...(payload.role ? { role: payload.role } : {}),
        ...(payload.permissions ? { permissions: selectedPermissions } : {}),
        ...(typeof payload.isActive === 'boolean' ? { isActive: payload.isActive } : {})
      });

      return {
        userId: String(updated._id),
        id: String(updated._id),
        tenantId: String(updated.tenantId),
        fullName: updated.fullName,
        title: updated.title || '',
        designation: updated.designation || '',
        email: updated.email,
        role: updated.role,
        permissions: updated.permissions || [],
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      };
    },

    async deactivateTeamMember(userId) {
      const tenantId = resolveTenantId();
      const updated = await repository.updateTeamMemberById(tenantId, userId, { isActive: false });

      if (!updated) {
        throw new AppError('Team member not found', StatusCodes.NOT_FOUND);
      }

      return {
        userId: String(updated._id),
        id: String(updated._id),
        tenantId: String(updated.tenantId),
        fullName: updated.fullName,
        title: updated.title || '',
        designation: updated.designation || '',
        email: updated.email,
        role: updated.role,
        permissions: updated.permissions || [],
        isActive: updated.isActive
      };
    },

    async deleteTeamMember(userId, actorUserId) {
      const tenantId = resolveTenantId();
      if (String(userId) === String(actorUserId)) {
        throw new AppError('You cannot delete your own admin access', StatusCodes.BAD_REQUEST);
      }

      const deleted = await repository.deleteTeamMemberById(tenantId, userId);
      if (!deleted) {
        throw new AppError('Team member not found', StatusCodes.NOT_FOUND);
      }

      return {
        userId: String(deleted._id),
        id: String(deleted._id),
        tenantId: String(deleted.tenantId),
        fullName: deleted.fullName,
        email: deleted.email,
        role: deleted.role
      };
    }
  };
};
