import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  createStudentSchema,
  listStudentsQuerySchema,
  parseOrThrow,
  studentIdParamSchema,
  updateStudentSchema
} from '../../validators/student.validators.js';

export const createStudentController = (studentService) => {
  return {
    createStudent: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createStudentSchema, req.body);
        const data = await studentService.createStudent(req.auth.userId, payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    listStudents: async (req, res, next) => {
      try {
        const query = parseOrThrow(listStudentsQuerySchema, req.query);
        const data = await studentService.listStudents(query);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getStudentById: async (req, res, next) => {
      try {
        const { studentId } = parseOrThrow(studentIdParamSchema, req.params);
        const data = await studentService.getStudentById(studentId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateStudent: async (req, res, next) => {
      try {
        const { studentId } = parseOrThrow(studentIdParamSchema, req.params);
        const payload = parseOrThrow(updateStudentSchema, req.body);
        const data = await studentService.updateStudent(studentId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    deactivateStudent: async (req, res, next) => {
      try {
        const { studentId } = parseOrThrow(studentIdParamSchema, req.params);
        const data = await studentService.deactivateStudent(studentId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    deleteStudent: async (req, res, next) => {
      try {
        const { studentId } = parseOrThrow(studentIdParamSchema, req.params);
        const data = await studentService.hardDeleteStudent(studentId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
