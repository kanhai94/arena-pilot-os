import { Teacher } from '../../models/teacher.model.js';
import { User } from '../../models/user.model.js';
import { ROLES } from '../../constants/roles.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const teacherRepository = {
  createTeacher(payload) {
    return Teacher.create(payload);
  },

  async listTeachers(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const [teacherRows, accessTeacherRows] = await Promise.all([
      Teacher.find({ tenantId: scopedTenantId }).sort({ createdAt: -1 }).lean(),
      User.find({
        tenantId: scopedTenantId,
        role: ROLES.STAFF,
        isActive: true
      })
        .sort({ createdAt: -1 })
        .select('_id fullName email')
        .lean()
    ]);

    const mergedByEmail = new Map();

    for (const teacher of teacherRows) {
      mergedByEmail.set(String(teacher.email).toLowerCase(), {
        _id: String(teacher._id),
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone || ''
      });
    }

    for (const member of accessTeacherRows) {
      const key = String(member.email).toLowerCase();
      if (mergedByEmail.has(key)) {
        continue;
      }

      mergedByEmail.set(key, {
        _id: String(member._id),
        name: member.fullName,
        email: member.email,
        phone: ''
      });
    }

    return Array.from(mergedByEmail.values());
  }
};
