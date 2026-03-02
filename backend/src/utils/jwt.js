import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = ({ userId, tenantId, role, permissions = [] }) => {
  return jwt.sign(
    {
      sub: userId,
      tenantId,
      role,
      permissions,
      tokenType: 'access'
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      jwtid: randomUUID()
    }
  );
};

export const signRefreshToken = ({ userId, tenantId, role, permissions = [] }) => {
  return jwt.sign(
    {
      sub: userId,
      tenantId,
      role,
      permissions,
      tokenType: 'refresh'
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      jwtid: randomUUID()
    }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};
