import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const normalizeName = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizePhone = (value) => value.replace(/\D/g, '');

export const createStudentService = (repository, dependencies = {}) => {
  const { billingService, tenantMetricsService } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();

  return {
    async createStudent(userId, payload) {
      const tenantId = resolveTenantId();
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

      if (tenantMetricsService?.adjustTotalStudents) {
        await tenantMetricsService.adjustTotalStudents(String(tenantId), 1);
      }

      return student;
    },

    async listStudents(query) {
      const tenantId = resolveTenantId();
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

    async getStudentById(studentId) {
      const tenantId = resolveTenantId();
      const student = await repository.findStudentById(tenantId, studentId);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      return student;
    },

    async updateStudent(studentId, payload) {
      const tenantId = resolveTenantId();
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

      if (tenantMetricsService?.touchActivity) {
        await tenantMetricsService.touchActivity(String(tenantId));
      }

      return updated;
    },

    async deactivateStudent(studentId) {
      const tenantId = resolveTenantId();
      const deactivated = await repository.deactivateStudentById(tenantId, studentId);

      if (!deactivated) {
        const existing = await repository.findStudentById(tenantId, studentId);
        if (!existing) {
          throw new AppError('Student not found', StatusCodes.NOT_FOUND);
        }
        return existing;
      }

      if (tenantMetricsService?.adjustTotalStudents) {
        await tenantMetricsService.adjustTotalStudents(String(tenantId), -1);
      }

      return deactivated;
    },

    async hardDeleteStudent(studentId) {
      const tenantId = resolveTenantId();
      const removed = await repository.hardDeleteStudentById(tenantId, studentId);
      if (!removed) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      if (tenantMetricsService?.adjustTotalStudents && removed.status === 'active') {
        await tenantMetricsService.adjustTotalStudents(String(tenantId), -1);
      }

      return removed;
    }
  };
};
