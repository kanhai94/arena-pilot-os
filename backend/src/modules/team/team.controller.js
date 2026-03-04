import { StatusCodes } from 'http-status-codes';
import { apiSuccess } from '../../utils/apiResponse.js';
import {
  createTeamMemberSchema,
  parseOrThrow,
  teamMemberIdParamSchema,
  updateTeamMemberAccessSchema
} from '../../validators/team.validators.js';

export const createTeamController = (teamService) => {
  return {
    createTeamMember: async (req, res, next) => {
      try {
        const payload = parseOrThrow(createTeamMemberSchema, req.body);
        const data = await teamService.createTeamMember(payload);
        return apiSuccess(res, data, StatusCodes.CREATED);
      } catch (error) {
        return next(error);
      }
    },

    listTeamMembers: async (req, res, next) => {
      try {
        const data = await teamService.listTeamMembers();
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    updateTeamMemberAccess: async (req, res, next) => {
      try {
        const { userId } = parseOrThrow(teamMemberIdParamSchema, req.params);
        const payload = parseOrThrow(updateTeamMemberAccessSchema, req.body);
        const data = await teamService.updateTeamMemberAccess(userId, payload);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    },

    deactivateTeamMember: async (req, res, next) => {
      try {
        const { userId } = parseOrThrow(teamMemberIdParamSchema, req.params);
        const data = await teamService.deactivateTeamMember(userId);
        return apiSuccess(res, data);
      } catch (error) {
        return next(error);
      }
    }
  };
};
