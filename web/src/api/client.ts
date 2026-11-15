/**
 * All browser requests go to our own /api. Provider keys live only on the server.
 * `credentials: 'same-origin'` sends the httpOnly session cookie once login exists (step 28).
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', signal });
  if (!res.ok) throw new Error(`Request to ${path} failed with status ${res.status}`);
  return (await res.json()) as T;
}
