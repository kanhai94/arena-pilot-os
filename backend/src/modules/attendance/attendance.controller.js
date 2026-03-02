import { apiSuccess } from '../../utils/apiResponse.js';
import {
  attendanceByDateQuerySchema,
  attendanceStatsQuerySchema,
  markAttendanceSchema,
  parseOrThrow
} from '../../validators/attendance.validators.js';

export const createAttendanceController = (attendanceService) => {
  return {
    markAttendance: async (req, res, next) => {
      try {
        const payload = parseOrThrow(markAttendanceSchema, req.body);
        const data = await attendanceService.markAttendance(req.tenantId, req.auth, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getAttendanceByDate: async (req, res, next) => {
      try {
        const query = parseOrThrow(attendanceByDateQuerySchema, req.query);
        const data = await attendanceService.getAttendanceByDate(req.tenantId, req.auth, query);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getStudentAttendanceStats: async (req, res, next) => {
      try {
        const query = parseOrThrow(attendanceStatsQuerySchema, req.query);
        const data = await attendanceService.getStudentAttendanceStats(req.tenantId, req.auth, query);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
