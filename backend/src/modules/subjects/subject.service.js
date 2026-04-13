import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';

export const createSubjectService = (repository) => {
  const resolveTenantId = () => TenantContext.requireTenantId();

  const ensureLinkedEntities = async (tenantId, payload) => {
    const [classDoc, teacherDoc] = await Promise.all([
      payload.classId ? repository.findClassById(tenantId, payload.classId) : Promise.resolve(null),
      payload.teacherId ? repository.findTeacherById(tenantId, payload.teacherId) : Promise.resolve(null)
    ]);

    if (payload.classId && !classDoc) {
      throw new AppError('Class not found in tenant', StatusCodes.BAD_REQUEST);
    }

    if (payload.teacherId && !teacherDoc) {
      throw new AppError('Teacher not found in tenant', StatusCodes.BAD_REQUEST);
    }
  };

  return {
    async createSubject(payload) {
      const tenantId = resolveTenantId();
      await ensureLinkedEntities(tenantId, payload);

      return repository.createSubject({
        tenantId,
        name: payload.name.trim(),
        classId: payload.classId,
        teacherId: payload.teacherId || null,
        status: payload.status || 'active'
      });
    },

    async listSubjects() {
      const tenantId = resolveTenantId();
      return repository.listSubjects(tenantId);
    },

    async updateSubject(id, payload) {
      const tenantId = resolveTenantId();
      const existing = await repository.findSubjectById(tenantId, id);
      if (!existing) {
        throw new AppError('Subject not found', StatusCodes.NOT_FOUND);
      }

      await ensureLinkedEntities(tenantId, {
        classId: payload.classId || existing.classId?._id || existing.classId,
        teacherId: payload.teacherId === undefined ? existing.teacherId?._id || existing.teacherId || null : payload.teacherId
      });

      return repository.updateSubjectById(tenantId, id, {
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.classId !== undefined ? { classId: payload.classId } : {}),
        ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId || null } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {})
      });
    },

    async deleteSubject(id) {
      const tenantId = resolveTenantId();
      const deleted = await repository.deleteSubjectById(tenantId, id);
      if (!deleted) {
        throw new AppError('Subject not found', StatusCodes.NOT_FOUND);
      }

      return {
        id: String(deleted._id),
        deleted: true
      };
    }
  };
};
