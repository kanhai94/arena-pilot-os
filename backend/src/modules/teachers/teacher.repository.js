import { Teacher } from '../../models/teacher.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const teacherRepository = {
  createTeacher(payload) {
    return Teacher.create(payload);
  },

  listTeachers(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Teacher.find({ tenantId: scopedTenantId }).sort({ createdAt: -1 }).lean();
  }
};
