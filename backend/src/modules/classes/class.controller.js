import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  assignTeacherSchema,
  classIdParamSchema,
  createClassSchema,
  updateClassSchema,
  parseOrThrow
} from '../../validators/class.validators.js';

export const createClassController = (classService) => {
  return {
    createClass: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createClassSchema, req.body);
        const data = await classService.createClass(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    listClasses: async (_req, res, next) => {
      try {
        const data = await classService.listClasses();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateClass: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(classIdParamSchema, req.params);
        const payload = parseOrThrow(updateClassSchema, req.body);
        const data = await classService.updateClass(id, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    deleteClass: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(classIdParamSchema, req.params);
        const data = await classService.deleteClass(id);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    assignTeacher: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(classIdParamSchema, req.params);
        const payload = parseOrThrow(assignTeacherSchema, req.body);
        const data = await classService.assignTeacher(id, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    getClassDetails: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(classIdParamSchema, req.params);
        const data = await classService.getClassDetails(id);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
