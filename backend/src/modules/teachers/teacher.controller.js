import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import { createTeacherSchema, parseOrThrow } from '../../validators/teacher.validators.js';

export const createTeacherController = (teacherService) => {
  return {
    createTeacher: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createTeacherSchema, req.body);
        const data = await teacherService.createTeacher(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    listTeachers: async (_req, res, next) => {
      try {
        const data = await teacherService.listTeachers();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
