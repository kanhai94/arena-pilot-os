import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const normalizeName = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizePhone = (value) => value.replace(/\D/g, '');

export const createStudentService = (repository, dependencies = {}) => {
  const { billingService, tenantMetricsService } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();

  const validateSchoolAssignment = async (tenantId, classId, rollNumber, excludeStudentId = null) => {
    const classDoc = await repository.findClassById(tenantId, classId);
    if (!classDoc) {
      throw new AppError('Class not found in tenant', StatusCodes.BAD_REQUEST);
    }

    const duplicateRoll = await repository.findStudentByRollNumberInClass(tenantId, classId, rollNumber, excludeStudentId);
    if (duplicateRoll) {
      throw new AppError('Roll number already exists in this class', StatusCodes.CONFLICT);
    }
  };

  return {
    async createStudent(userId, payload) {
      const tenantId = resolveTenantId();
      const organizationType = await repository.getTenantOrganizationType(tenantId);
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

      if (organizationType === 'SCHOOL' && payload.classId && payload.rollNumber) {
        await validateSchoolAssignment(tenantId, payload.classId, payload.rollNumber);
      }

      const student = await repository.createStudent({
        ...payload,
        tenantId,
        createdBy: userId,
        email: payload.email || null,
        batchId: payload.batchId || null,
        classId: payload.classId || null,
        rollNumber: payload.rollNumber || null,
        normalizedName,
        normalizedParentPhone
      });

      if (tenantMetricsService?.adjustTotalStudents) {
        await tenantMetricsService.adjustTotalStudents(String(tenantId), 1);
      }

      if (organizationType === 'SCHOOL' && student.classId) {
        await repository.syncClassStrength(tenantId, student.classId);
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
      const organizationType = await repository.getTenantOrganizationType(tenantId);
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

      const nextClassId = payload.classId !== undefined ? payload.classId : existing.classId;
      const nextRollNumber = payload.rollNumber !== undefined ? payload.rollNumber : existing.rollNumber;

      if (organizationType === 'SCHOOL' && nextClassId && nextRollNumber) {
        await validateSchoolAssignment(tenantId, nextClassId, nextRollNumber, studentId);
      }

      const updated = await repository.updateStudentById(tenantId, studentId, {
        ...payload,
        ...(payload.rollNumber !== undefined ? { rollNumber: payload.rollNumber || null } : {}),
        normalizedName,
        normalizedParentPhone
      });

      if (!updated) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      if (tenantMetricsService?.touchActivity) {
        await tenantMetricsService.touchActivity(String(tenantId));
      }

      if (organizationType === 'SCHOOL') {
        const affectedClasses = [existing.classId, updated.classId].filter(Boolean);
        await Promise.all(affectedClasses.map((classId) => repository.syncClassStrength(tenantId, classId)));
      }

      return updated;
    },

    async assignClass(studentId, payload) {
      const tenantId = resolveTenantId();
      const student = await repository.findStudentById(tenantId, studentId);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      await validateSchoolAssignment(tenantId, payload.classId, payload.rollNumber, studentId);

      const updated = await repository.updateStudentById(tenantId, studentId, {
        classId: payload.classId,
        rollNumber: payload.rollNumber.trim(),
        batchId: null
      });

      await Promise.all(
        [student.classId, payload.classId]
          .filter(Boolean)
          .map((classId) => repository.syncClassStrength(tenantId, classId))
      );

      return updated;
    },

    async deactivateStudent(studentId) {
      const tenantId = resolveTenantId();
      const organizationType = await repository.getTenantOrganizationType(tenantId);
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

      if (organizationType === 'SCHOOL' && deactivated.classId) {
        await repository.syncClassStrength(tenantId, deactivated.classId);
      }

      return deactivated;
    },

    async hardDeleteStudent(studentId) {
      const tenantId = resolveTenantId();
      const organizationType = await repository.getTenantOrganizationType(tenantId);
      const removed = await repository.hardDeleteStudentById(tenantId, studentId);
      if (!removed) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      if (tenantMetricsService?.adjustTotalStudents && removed.status === 'active') {
        await tenantMetricsService.adjustTotalStudents(String(tenantId), -1);
      }

      if (organizationType === 'SCHOOL' && removed.classId) {
        await repository.syncClassStrength(tenantId, removed.classId);
      }

      return removed;
    }
  };
};
