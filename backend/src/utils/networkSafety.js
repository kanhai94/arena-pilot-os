import net from 'node:net';
import { URL } from 'node:url';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/appError.js';

const PRIVATE_HOST_SUFFIXES = ['.local', '.internal', '.localhost'];

const isPrivateIpv4 = (host) => {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isPrivateIpv6 = (host) => {
  const normalized = host.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
};

export const isSafeExternalUrl = (rawUrl) => {
  try {
    const url = new URL(String(rawUrl || '').trim());
    const protocol = url.protocol.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (protocol !== 'https:') {
      return false;
    }

    if (!hostname || hostname === 'localhost' || PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
      return false;
    }

    const ipKind = net.isIP(hostname);
    if (ipKind === 4) {
      return !isPrivateIpv4(hostname);
    }
    if (ipKind === 6) {
      return !isPrivateIpv6(hostname);
    }

    return true;
  } catch {
    return false;
  }
};

export const extractUrlFromCurlTemplate = (template) => {
  const match = String(template || '').match(/https?:\/\/[^\s'"]+/i);
  return match ? match[0] : null;
};

export const assertSafeExternalUrl = (rawUrl, label = 'External URL') => {
  if (!isSafeExternalUrl(rawUrl)) {
    throw new AppError(`${label} must be a public HTTPS endpoint`, StatusCodes.BAD_REQUEST);
  }
};
