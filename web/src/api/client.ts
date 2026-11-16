/**
 * All browser requests go to our own /api. Provider keys live only on the server.
 * The session is an httpOnly cookie the browser sends automatically; scripts cannot read it.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        // Required by the server for any state-changing request (cross-site protection).
        'X-Requested-With': 'ust',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Could not reach the server. Check that it is running, then try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => call<T>('GET', path, undefined, signal);
export const apiPost = <T>(path: string, body: unknown = {}) => call<T>('POST', path, body);
export const apiDelete = <T>(path: string) => call<T>('DELETE', path);
