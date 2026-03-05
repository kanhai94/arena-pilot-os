import { User } from '../../models/user.model.js';
import { TEAM_MEMBER_ROLES } from '../../constants/roles.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const teamRepository = {
  createTeamMember(payload) {
    return User.create(payload);
  },

  findActiveUserByEmail(tenantId, email) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.findOne({ tenantId: scopedTenantId, email: email.toLowerCase(), isActive: true }).lean();
  },

  findTeamMembers(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.find({
      tenantId: scopedTenantId,
      role: { $in: TEAM_MEMBER_ROLES }
    })
      .sort({ createdAt: -1 })
      .lean();
  },

  findTeamMemberById(tenantId, userId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.findOne({
      _id: userId,
      tenantId: scopedTenantId,
      role: { $in: TEAM_MEMBER_ROLES }
    }).lean();
  },

  updateTeamMemberById(tenantId, userId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.findOneAndUpdate(
      {
        _id: userId,
        tenantId: scopedTenantId,
        role: { $in: TEAM_MEMBER_ROLES }
      },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  deleteTeamMemberById(tenantId, userId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return User.findOneAndDelete({
      _id: userId,
      tenantId: scopedTenantId,
      role: { $in: TEAM_MEMBER_ROLES }
    }).lean();
  }
};
