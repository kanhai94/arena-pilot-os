import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';

const normalizeName = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizePhone = (value) => value.replace(/\D/g, '');

export const createStudentService = (repository, dependencies = {}) => {
  const { billingService } = dependencies;

  return {
    async createStudent(tenantId, userId, payload) {
      if (billingService?.checkPlanLimit) {
        await billingService.checkPlanLimit(tenantId, 'student', { throwOnLimitReached: true });
      }

      const normalizedName = normalizeName(payload.name);
      const normalizedParentPhone = normalizePhone(payload.parentPhone);

      const duplicate = await repository.findActiveDuplicateByIdentity(
        tenantId,
        normalizedName,
        normalizedParentPhone,
        payload.name.trim(),
        payload.parentPhone.trim()
      );

      if (duplicate) {
        throw new AppError('Student with same name and parent phone already exists', StatusCodes.CONFLICT);
      }

      const student = await repository.createStudent({
        ...payload,
        tenantId,
        createdBy: userId,
        email: payload.email || null,
        batchId: payload.batchId || null,
        normalizedName,
        normalizedParentPhone
      });

      return student;
    },

    async listStudents(tenantId, query) {
      const { page, limit, search, status } = query;
      const { items, total } = await repository.findStudents({
        tenantId,
        page,
        limit,
        search,
        status
      });

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    },

    async getStudentById(tenantId, studentId) {
      const student = await repository.findStudentById(tenantId, studentId);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      return student;
    },

    async updateStudent(tenantId, studentId, payload) {
      const existing = await repository.findStudentById(tenantId, studentId);
      if (!existing) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      const candidateName = (payload.name ?? existing.name).trim();
      const candidatePhone = (payload.parentPhone ?? existing.parentPhone).trim();
      const normalizedName = normalizeName(candidateName);
      const normalizedParentPhone = normalizePhone(candidatePhone);

      const duplicate = await repository.findActiveDuplicateByIdentity(
        tenantId,
        normalizedName,
        normalizedParentPhone,
        candidateName,
        candidatePhone,
        studentId
      );

      if (duplicate) {
        throw new AppError('Student with same name and parent phone already exists', StatusCodes.CONFLICT);
      }

      const updated = await repository.updateStudentById(tenantId, studentId, {
        ...payload,
        normalizedName,
        normalizedParentPhone
      });

      if (!updated) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      return updated;
    },

    async deactivateStudent(tenantId, studentId) {
      const deactivated = await repository.deactivateStudentById(tenantId, studentId);

      if (!deactivated) {
        const existing = await repository.findStudentById(tenantId, studentId);
        if (!existing) {
          throw new AppError('Student not found', StatusCodes.NOT_FOUND);
        }
        return existing;
      }

      return deactivated;
    }
  };
};
