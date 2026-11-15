import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The only module that reads secrets. Values come from server/.env (git-ignored)
 * or the host's secret settings. Never send these to the browser or write them to logs.
 */
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

export const config = {
  port: Number(process.env.PORT ?? 3001),
  isTest: process.env.NODE_ENV === 'test',
} as const;

/** Read a secret when a provider service needs it. Throws a clear error if it is missing. */
export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to server/.env (see .env.example).`);
  return value;
}
