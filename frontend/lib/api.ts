const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!rawApiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not set. Please configure frontend/.env');
}

const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '');

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
};

type RefreshTokenResponse = {
  accessToken: string;
  refreshToken: string;
  user?: {
    id: string;
    tenantId: string;
    fullName: string;
    email: string;
    role: string;
    permissions?: string[];
  };
};

let refreshInFlight: Promise<string | null> | null = null;

const parseErrorMessage = (payload: any): string => {
  if (!payload) {
    return 'Request failed';
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (Array.isArray(payload.details) && payload.details.length > 0) {
    const first = payload.details[0];
    if (first?.message) {
      return first.message;
    }
  }

  return 'Request failed';
};

const sendRequest = async <T>(path: string, method: string, body?: unknown, accessToken?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  const payload: ApiResponse<T> = await response.json().catch(() => ({ success: false, message: 'Invalid response' }));

  return { response, payload };
};

const clearClientSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
};

const assertPayload = <T>(response: Response, payload: ApiResponse<T>): T => {
  if (!response.ok || !payload.success) {
    throw new Error(parseErrorMessage(payload));
  }
  return payload.data as T;
};

const performRefreshToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    return null;
  }

  try {
    const { response, payload } = await sendRequest<RefreshTokenResponse>('/auth/refresh-token', 'POST', {
      refreshToken
    });

    if (!response.ok || !payload.success || !payload.data?.accessToken || !payload.data?.refreshToken) {
      return null;
    }

    localStorage.setItem('accessToken', payload.data.accessToken);
    localStorage.setItem('refreshToken', payload.data.refreshToken);

    if (payload.data.user) {
      localStorage.setItem('currentUser', JSON.stringify(payload.data.user));
    }

    return payload.data.accessToken;
  } catch {
    return null;
  }
};

const attemptRefreshToken = async (): Promise<string | null> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = performRefreshToken().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
};

const request = async <T>(
  path: string,
  method: string,
  body?: unknown,
  accessToken?: string,
  options: { withAuth?: boolean } = {}
): Promise<T> => {
  const { withAuth = false } = options;

  let token = accessToken;
  if (withAuth && typeof window !== 'undefined' && !token) {
    token = localStorage.getItem('accessToken') || undefined;
  }
  let result = await sendRequest<T>(path, method, body, token);

  if (withAuth && result.response.status === 401) {
    const refreshedAccessToken = await attemptRefreshToken();

    if (!refreshedAccessToken) {
      clearClientSession();
      throw new Error('Session expired. Please login again.');
    }

    token = refreshedAccessToken;
    result = await sendRequest<T>(path, method, body, token);
  }

  if (withAuth && result.response.status === 401) {
    clearClientSession();
    throw new Error('Session expired. Please login again.');
  }

  return assertPayload(result.response, result.payload);
};

export const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
  return request<T>(path, 'POST', body);
};

export const apiGetWithAuth = async <T>(path: string, accessToken: string): Promise<T> => {
  return request<T>(path, 'GET', undefined, accessToken, { withAuth: true });
};

export const apiPostWithAuth = async <T>(path: string, body: unknown, accessToken: string): Promise<T> => {
  return request<T>(path, 'POST', body, accessToken, { withAuth: true });
};

export const apiPutWithAuth = async <T>(path: string, body: unknown, accessToken: string): Promise<T> => {
  return request<T>(path, 'PUT', body, accessToken, { withAuth: true });
};

export const apiPatchWithAuth = async <T>(path: string, body: unknown, accessToken: string): Promise<T> => {
  return request<T>(path, 'PATCH', body, accessToken, { withAuth: true });
};

export const apiDeleteWithAuth = async <T>(path: string, accessToken: string): Promise<T> => {
  return request<T>(path, 'DELETE', undefined, accessToken, { withAuth: true });
};
