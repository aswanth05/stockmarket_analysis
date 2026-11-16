import { getDb, nowIso } from '../db';

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}

interface Options {
  provider: string;
  /** Path recorded in the usage log. Must not contain secrets. */
  logPath: string;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
}

/** fetch + JSON with a timeout and a usage log row (CLAUDE.md: log provider usage and errors, never secrets). */
export async function fetchJson<T>(url: string, opts: Options): Promise<T> {
  const started = Date.now();
  let status: number | undefined;
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { Accept: 'application/json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    status = res.status;
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
      throw new ProviderError(opts.provider, `HTTP ${res.status}${text ? ` (${text})` : ''}`, res.status);
    }
    const data = (await res.json()) as T;
    log(opts, true, status, started);
    return data;
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError(opts.provider, e instanceof Error ? e.message : String(e), status);
    log(opts, false, status, started, err.message);
    throw err;
  }
}

function log(opts: Options, ok: boolean, status: number | undefined, started: number, error?: string) {
  try {
    getDb()
      .prepare('INSERT INTO provider_log (provider, endpoint, ok, status, ms, error, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(opts.provider, opts.logPath, ok ? 1 : 0, status ?? null, Date.now() - started, error?.slice(0, 300) ?? null, nowIso());
  } catch {
    // Logging must never break a data call.
  }
}

export function lastProviderEvents(provider: string): { lastSuccess: string | null; lastError: string | null } {
  const db = getDb();
  const ok = db.prepare('SELECT at FROM provider_log WHERE provider = ? AND ok = 1 ORDER BY id DESC LIMIT 1').get(provider) as { at: string } | undefined;
  const bad = db.prepare('SELECT at, error FROM provider_log WHERE provider = ? AND ok = 0 ORDER BY id DESC LIMIT 1').get(provider) as
    | { at: string; error: string }
    | undefined;
  const lastError = bad && (!ok || bad.at > ok.at) ? `${bad.at}: ${bad.error}` : null;
  return { lastSuccess: ok?.at ?? null, lastError };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
