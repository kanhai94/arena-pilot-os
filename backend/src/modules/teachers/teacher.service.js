import { TenantContext } from '../../core/context/tenantContext.js';

export const createTeacherService = (repository) => {
  const resolveTenantId = () => TenantContext.requireTenantId();

  return {
    async createTeacher(payload) {
      const tenantId = resolveTenantId();
      return repository.createTeacher({
        tenantId,
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim()
      });
    },

    async listTeachers() {
      const tenantId = resolveTenantId();
      return repository.listTeachers(tenantId);
    }
  };
};
