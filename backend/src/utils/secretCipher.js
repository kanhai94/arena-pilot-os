import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

const getKey = () => {
  const material = `${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`;
  return crypto.createHash('sha256').update(material).digest();
};

export const encryptSecret = (plainText) => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const decryptSecret = (encoded) => {
  const [ivB64, tagB64, encryptedB64] = String(encoded || '').split(':');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encoded secret payload');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
};
