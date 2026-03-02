import crypto from 'node:crypto';

export const hashToken = (value) => {
  return crypto.createHash('sha256').update(value).digest('hex');
};
