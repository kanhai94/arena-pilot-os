import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';

export const createClassService = (repository) => {
  const resolveTenantId = () => TenantContext.requireTenantId();

  return {
    async createClass(payload) {
      const tenantId = resolveTenantId();
      const normalizedName = payload.name.trim();
      const normalizedSection = payload.section?.trim() || '';
      const duplicate = await repository.findClassByNameAndSection(tenantId, normalizedName, normalizedSection);
      if (duplicate) {
        throw new AppError('Class with same name and section already exists', StatusCodes.CONFLICT);
      }

      const created = await repository.createClass({
        tenantId,
        name: normalizedName,
        section: normalizedSection,
        classTeacherId: null,
        strength: 0,
        scheduleDays: payload.scheduleDays || [],
        startTime: payload.startTime || '',
        endTime: payload.endTime || ''
      });

      return repository.findClassById(tenantId, created._id);
    },

    async listClasses() {
      const tenantId = resolveTenantId();
      return repository.listClasses(tenantId);
    },

    async assignTeacher(id, payload) {
      const tenantId = resolveTenantId();
      const [classDoc, teacherDoc] = await Promise.all([
        repository.findClassById(tenantId, id),
        repository.findTeacherById(tenantId, payload.teacherId)
      ]);

      if (!classDoc) {
        throw new AppError('Class not found', StatusCodes.NOT_FOUND);
      }

      if (!teacherDoc) {
        throw new AppError('Teacher not found in tenant', StatusCodes.BAD_REQUEST);
      }

      return repository.assignTeacherToClass(tenantId, id, payload.teacherId);
    },

    async updateClass(id, payload) {
      const tenantId = resolveTenantId();
      const classDoc = await repository.findClassById(tenantId, id);

      if (!classDoc) {
        throw new AppError('Class not found', StatusCodes.NOT_FOUND);
      }

      const normalizedName = payload.name.trim();
      const normalizedSection = payload.section?.trim() || '';
      const duplicate = await repository.findClassByNameAndSection(tenantId, normalizedName, normalizedSection, id);
      if (duplicate) {
        throw new AppError('Class with same name and section already exists', StatusCodes.CONFLICT);
      }

      return repository.updateClass(tenantId, id, {
        name: normalizedName,
        section: normalizedSection,
        scheduleDays: payload.scheduleDays || [],
        startTime: payload.startTime || '',
        endTime: payload.endTime || ''
      });
    },

    async deleteClass(id) {
      const tenantId = resolveTenantId();
      const classDoc = await repository.findClassById(tenantId, id);
      if (!classDoc) {
        throw new AppError('Class not found', StatusCodes.NOT_FOUND);
      }

      const linkedStudents = await repository.countStudentsLinkedToClass(tenantId, id);
      if (linkedStudents > 0) {
        throw new AppError('Cannot delete class with assigned students', StatusCodes.CONFLICT);
      }

      return repository.deleteClassById(tenantId, id);
    },

    async getClassDetails(id) {
      const tenantId = resolveTenantId();
      const classDoc = await repository.findClassById(tenantId, id);
      if (!classDoc) {
        throw new AppError('Class not found', StatusCodes.NOT_FOUND);
      }

      const [students, attendanceStats] = await Promise.all([
        repository.listStudentsByClass(tenantId, id),
        repository.getAttendanceStatsForStudents(tenantId, id)
      ]);

      const linkedStudents = students.map((student) => {
        const stats = attendanceStats.get(String(student._id)) || { present: 0, absent: 0 };
        const total = stats.present + stats.absent;
        return {
          ...student,
          attendancePercentage: total === 0 ? 0 : Number(((stats.present / total) * 100).toFixed(2))
        };
      });

      await repository.syncClassStrength(tenantId, id);

      return {
        _id: String(classDoc._id),
        className: classDoc.name,
        name: classDoc.name,
        section: classDoc.section,
        teacher: classDoc.classTeacherId || null,
        totalStudents: linkedStudents.length,
        strength: linkedStudents.length,
        scheduleDays: classDoc.scheduleDays || [],
        startTime: classDoc.startTime || '',
        endTime: classDoc.endTime || '',
        students: linkedStudents
      };
    }
  };
};
