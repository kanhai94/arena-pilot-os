import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { ROLES } from '../../constants/roles.js';
import { domainEvents, DOMAIN_EVENTS } from '../../events/domainEvents.js';

const normalizeToUTCDate = (value) => {
  const inputDate = new Date(value);
  if (Number.isNaN(inputDate.getTime())) {
    throw new AppError('Invalid date', StatusCodes.BAD_REQUEST);
  }
  return new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
};

export const createAttendanceService = (repository) => {
  return {
    async markAttendance(tenantId, auth, payload) {
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;
      const batch = await repository.findBatchById(tenantId, payload.batchId, coachScopedId);

      if (!batch) {
        throw new AppError('Batch not found or not accessible', StatusCodes.NOT_FOUND);
      }

      const uniqueRecords = Array.from(
        payload.records.reduce((map, record) => map.set(record.studentId, record), new Map()).values()
      );

      const studentIds = uniqueRecords.map((record) => record.studentId);
      const eligibleStudents = await repository.findStudentsInBatch(tenantId, payload.batchId, studentIds);
      const studentMap = new Map(eligibleStudents.map((student) => [String(student._id), student]));

      const unauthorizedStudents = studentIds.filter((studentId) => !studentMap.has(studentId));
      if (unauthorizedStudents.length > 0) {
        throw new AppError('Some students are not active members of this batch', StatusCodes.BAD_REQUEST, {
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
              batchId: payload.batchId,
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
          batchId: payload.batchId,
          date: normalizedDate.toISOString().slice(0, 10),
          absentStudents,
          markedBy: auth.userId
        });
      }

      return {
        date: normalizedDate,
        batchId: payload.batchId,
        attempted: uniqueRecords.length,
        upsertedCount: writeResult.upsertedCount || 0,
        modifiedCount: writeResult.modifiedCount || 0,
        matchedCount: writeResult.matchedCount || 0
      };
    },

    async getAttendanceByDate(tenantId, auth, query) {
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;
      const normalizedDate = normalizeToUTCDate(query.date);

      if (coachScopedId && query.batchId) {
        const batch = await repository.findBatchById(tenantId, query.batchId, coachScopedId);
        if (!batch) {
          throw new AppError('Batch not found or not accessible', StatusCodes.NOT_FOUND);
        }
      }

      const { items, total } = await repository.getAttendanceByDate({
        tenantId,
        date: normalizedDate,
        batchId: query.batchId,
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

    async getStudentAttendanceStats(tenantId, auth, query) {
      const coachScopedId = auth.role === ROLES.COACH ? auth.userId : null;

      return repository.getStudentAttendanceStats({
        tenantId,
        studentId: query.studentId,
        fromDate: query.fromDate ? normalizeToUTCDate(query.fromDate) : undefined,
        toDate: query.toDate ? normalizeToUTCDate(query.toDate) : undefined,
        coachId: coachScopedId
      });
    }
  };
};
