import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './client';

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Time of the last successful load (ISO). */
  loadedAt: string | null;
}

/**
 * Loads `path`, optionally re-polling every `pollMs` (live updates, PROJECT_STEPS 41).
 * On a failed poll the last data stays on screen and `error` explains what failed.
 */
export function useApi<T>(path: string | null, pollMs?: number) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: Boolean(path), loadedAt: null });
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ ...s, loading: s.data == null }));
    try {
      const data = await apiGet<T>(path, c.signal);
      setState({ data, error: null, loading: false, loadedAt: new Date().toISOString() });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [path]);

  useEffect(() => {
    void load();
    if (!pollMs || !path) return () => ctrl.current?.abort();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, pollMs);
    return () => {
      clearInterval(id);
      ctrl.current?.abort();
    };
  }, [load, pollMs, path]);

  return { ...state, reload: load, setData: (data: T) => setState((s) => ({ ...s, data })) };
}
