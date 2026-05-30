if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === 'production') {
  console.warn(
    '[api] NEXT_PUBLIC_API_URL is not set — falling back to http://localhost:4000. ' +
      'Set this variable in your production environment.',
  );
}

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

// Singleton so concurrent 401s share one refresh call instead of racing
let refreshPromise: Promise<boolean> | null = null;

function callRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

const REQUEST_TIMEOUT_MS = 30_000;

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { body, headers, ...rest } = options;

  const hasBody = body !== undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(headers as Record<string, string>),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'Yêu cầu quá thời gian chờ (30s)');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && retry) {
    const ok = await callRefresh();
    if (ok) return request<T>(path, options, false);
    if (typeof window !== 'undefined') {
      // Persist the current URL so the login page can redirect back after
      // re-auth instead of always landing on /dashboard.
      // Store only pathname + search (not full href) to prevent open-redirect.
      const returnUrl = window.location.pathname + window.location.search;
      if (returnUrl !== '/login') {
        sessionStorage.setItem('returnUrl', returnUrl);
      }
      window.location.href = '/login';
      // Return a promise that never settles — the page is navigating away,
      // so we must not let TanStack Query transition to an error state first.
      return new Promise<T>(() => {});
    }
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn');
  }

  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* empty */
    }
    const raw = (data as { message?: unknown } | null)?.message;
    const message = Array.isArray(raw)
      ? (raw as string[]).join('\n')
      : (raw as string | undefined) ?? res.statusText;
    throw new ApiError(res.status, message, data);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
