import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  createSubjectSchema,
  parseOrThrow,
  subjectIdParamSchema,
  updateSubjectSchema
} from '../../validators/subject.validators.js';

export const createSubjectController = (subjectService) => {
  return {
    createSubject: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createSubjectSchema, req.body);
        const data = await subjectService.createSubject(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    listSubjects: async (_req, res, next) => {
      try {
        const data = await subjectService.listSubjects();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateSubject: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(subjectIdParamSchema, req.params);
        const payload = parseOrThrow(updateSubjectSchema, req.body);
        const data = await subjectService.updateSubject(id, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    deleteSubject: async (req, res, next) => {
      try {
        const { id } = parseOrThrow(subjectIdParamSchema, req.params);
        const data = await subjectService.deleteSubject(id);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
