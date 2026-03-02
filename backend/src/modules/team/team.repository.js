import { User } from '../../models/user.model.js';
import { TEAM_MEMBER_ROLES } from '../../constants/roles.js';

export const teamRepository = {
  createTeamMember(payload) {
    return User.create(payload);
  },

  findActiveUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase(), isActive: true }).lean();
  },

  findTeamMembers(tenantId) {
    return User.find({
      tenantId,
      role: { $in: TEAM_MEMBER_ROLES }
    })
      .sort({ createdAt: -1 })
      .lean();
  },

  findTeamMemberById(tenantId, userId) {
    return User.findOne({
      _id: userId,
      tenantId,
      role: { $in: TEAM_MEMBER_ROLES }
    }).lean();
  },

  updateTeamMemberById(tenantId, userId, updatePayload) {
    return User.findOneAndUpdate(
      {
        _id: userId,
        tenantId,
        role: { $in: TEAM_MEMBER_ROLES }
      },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  }
};
