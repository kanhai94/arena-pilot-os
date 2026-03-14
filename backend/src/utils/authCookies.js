import { env } from '../config/env.js';

export const ACCESS_COOKIE_NAME = 'ap_access';
export const REFRESH_COOKIE_NAME = 'ap_refresh';

const parseDurationToMs = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier =
    unit === 'ms' ? 1 : unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;

  return amount * multiplier;
};

const baseCookieOptions = () => {
  const secure = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/'
  };
};

export const getAccessCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN)
});

export const getRefreshCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)
});

export const getClearCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: 0
});

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, getClearCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
};

export const readCookie = (req, name) => {
  const raw = req.headers.cookie;
  if (!raw) return null;

  const parts = raw.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
};
