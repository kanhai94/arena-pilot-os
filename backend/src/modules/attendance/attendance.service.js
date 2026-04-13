import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { ROLES } from '../../constants/roles.js';
import { domainEvents, DOMAIN_EVENTS } from '../../events/domainEvents.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const normalizeToUTCDate = (value) => {
  const inputDate = new Date(value);
  if (Number.isNaN(inputDate.getTime())) {
    throw new AppError('Invalid date', StatusCodes.BAD_REQUEST);
  }
  return new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
};

export const createAttendanceService = (repository, dependencies = {}) => {
  const { tenantMetricsService } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();
  const normalizeOrganizationType = (value) => (value === 'SCHOOL' ? 'SCHOOL' : 'SPORTS');

  const resolveAttendanceScope = (organizationType, payload) => {
    if (organizationType === 'SCHOOL') {
      if (!payload.classId) {
        throw new AppError('classId is required for school attendance', StatusCodes.BAD_REQUEST);
      }

      return {
        scopeKey: 'classId',
        scopeLabel: 'Class',
        scopeValue: payload.classId
      };
    }

    if (!payload.batchId) {
      throw new AppError('batchId is required for sports attendance', StatusCodes.BAD_REQUEST);
    }

    return {
      scopeKey: 'batchId',
      scopeLabel: 'Batch',
      scopeValue: payload.batchId
    };
  };

  const validateAttendanceQueryScope = (organizationType, query) => {
    if (organizationType === 'SCHOOL' && query.batchId) {
      throw new AppError('batchId is not supported for school attendance queries', StatusCodes.BAD_REQUEST);
    }

    if (organizationType === 'SPORTS' && query.classId) {
      throw new AppError('classId is not supported for sports attendance queries', StatusCodes.BAD_REQUEST);
    }
  };

  return {
    async markAttendance(auth, payload) {
      const tenantId = resolveTenantId();
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;
      const organizationType = normalizeOrganizationType(await repository.getTenantOrganizationType(tenantId));
      const { scopeKey, scopeLabel, scopeValue } = resolveAttendanceScope(organizationType, payload);

      const attendanceGroup =
        scopeKey === 'classId'
          ? await repository.findClassById(tenantId, scopeValue)
          : await repository.findBatchById(tenantId, scopeValue, coachScopedId);

      if (!attendanceGroup) {
        throw new AppError(`${scopeLabel} not found or not accessible`, StatusCodes.NOT_FOUND);
      }

      const uniqueRecords = Array.from(
        payload.records.reduce((map, record) => map.set(record.studentId, record), new Map()).values()
      );

      const studentIds = uniqueRecords.map((record) => record.studentId);
      const eligibleStudents =
        scopeKey === 'classId'
          ? await repository.findStudentsInClass(tenantId, scopeValue, studentIds)
          : await repository.findStudentsInBatch(tenantId, scopeValue, studentIds);
      const studentMap = new Map(eligibleStudents.map((student) => [String(student._id), student]));

      const unauthorizedStudents = studentIds.filter((studentId) => !studentMap.has(studentId));
      if (unauthorizedStudents.length > 0) {
        throw new AppError(`Some students are not active members of this ${scopeLabel.toLowerCase()}`, StatusCodes.BAD_REQUEST, {
          invalidStudentIds: unauthorizedStudents
        });
      }

      const normalizedDate = normalizeToUTCDate(payload.date);

      const operations = uniqueRecords.map((record) => ({
        updateOne: {
          filter: {
            tenantId,
            studentId: record.studentId,
            date: normalizedDate
          },
          update: {
            $set: {
              batchId: scopeKey === 'batchId' ? scopeValue : null,
              classId: scopeKey === 'classId' ? scopeValue : null,
              status: record.status,
              markedBy: auth.userId
            },
            $setOnInsert: {
              tenantId,
              studentId: record.studentId,
              date: normalizedDate
            }
          },
          upsert: true
        }
      }));

      const writeResult = await repository.bulkUpsertAttendance(operations);

      if (tenantMetricsService?.incrementAttendanceCountThisMonth) {
        await tenantMetricsService.incrementAttendanceCountThisMonth(String(tenantId), uniqueRecords.length);
      }

      const absentStudents = uniqueRecords
        .filter((record) => record.status === 'absent')
        .map((record) => {
          const student = studentMap.get(record.studentId);
          return {
            studentId: record.studentId,
            name: student.name,
            phoneNumber: student.parentPhone
          };
        })
        .filter((record) => Boolean(record.phoneNumber));

      if (absentStudents.length > 0) {
        domainEvents.emit(DOMAIN_EVENTS.ATTENDANCE_ABSENT, {
          tenantId,
          batchId: scopeKey === 'batchId' ? scopeValue : null,
          classId: scopeKey === 'classId' ? scopeValue : null,
          organizationType,
          date: normalizedDate.toISOString().slice(0, 10),
          absentStudents,
          markedBy: auth.userId
        });
      }

      return {
        date: normalizedDate,
        organizationType,
        batchId: scopeKey === 'batchId' ? scopeValue : null,
        classId: scopeKey === 'classId' ? scopeValue : null,
        attempted: uniqueRecords.length,
        upsertedCount: writeResult.upsertedCount || 0,
        modifiedCount: writeResult.modifiedCount || 0,
        matchedCount: writeResult.matchedCount || 0
      };
    },

    async getAttendanceByDate(auth, query) {
      const tenantId = resolveTenantId();
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;
      const normalizedDate = normalizeToUTCDate(query.date);
      const organizationType = normalizeOrganizationType(await repository.getTenantOrganizationType(tenantId));
      validateAttendanceQueryScope(organizationType, query);

      if (organizationType === 'SPORTS' && coachScopedId && query.batchId) {
        const batch = await repository.findBatchById(tenantId, query.batchId, coachScopedId);
        if (!batch) {
          throw new AppError('Batch not found or not accessible', StatusCodes.NOT_FOUND);
        }
      }

      if (organizationType === 'SCHOOL' && query.classId) {
        const cls = await repository.findClassById(tenantId, query.classId);
        if (!cls) {
          throw new AppError('Class not found or not accessible', StatusCodes.NOT_FOUND);
        }
      }

      const { items, total } = await repository.getAttendanceByDate({
        tenantId,
        date: normalizedDate,
        organizationType,
        batchId: query.batchId,
        classId: query.classId,
        coachId: coachScopedId,
        page: query.page,
        limit: query.limit
      });

      return {
        items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit)
        }
      };
    },

    async getStudentAttendanceStats(auth, query) {
      const tenantId = resolveTenantId();
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;
      const organizationType = normalizeOrganizationType(await repository.getTenantOrganizationType(tenantId));

      return repository.getStudentAttendanceStats({
        tenantId,
        studentId: query.studentId,
        fromDate: query.fromDate ? normalizeToUTCDate(query.fromDate) : undefined,
        toDate: query.toDate ? normalizeToUTCDate(query.toDate) : undefined,
        coachId: coachScopedId,
        organizationType
      });
    }
  };
};
