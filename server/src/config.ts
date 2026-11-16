import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * The only module that reads secrets. Values come from server/.env (git-ignored)
 * or the host's secret settings. Never send these to the browser or write them to logs.
 */
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const envPath = resolve(serverDir, '.env');
if (process.env.NODE_ENV !== 'test' && existsSync(envPath)) process.loadEnvFile(envPath);

const env = (name: string) => process.env[name]?.trim() || undefined;

export const config = {
  port: Number(env('PORT') ?? 3001),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  databasePath: process.env.NODE_ENV === 'test' ? ':memory:' : resolve(serverDir, env('DATABASE_PATH') ?? './data/terminal.db'),
  serverDir,
  /** Where the built frontend lives, served by Express in production. */
  webDist: resolve(serverDir, '../web/dist'),
};

/** Secrets are read on demand so tests can set them per case. */
export const secrets = {
  alpacaKeyId: () => env('ALPACA_API_KEY_ID'),
  alpacaSecret: () => env('ALPACA_API_SECRET_KEY'),
  eodhdToken: () => env('EODHD_API_TOKEN'),
  secUserAgent: () => env('SEC_EDGAR_USER_AGENT'),
  anthropicKey: () => env('ANTHROPIC_API_KEY'),
  anthropicBudgetUsd: () => {
    const v = Number(env('ANTHROPIC_MONTHLY_BUDGET_USD'));
    return Number.isFinite(v) && v > 0 ? v : null;
  },
};

export const providersConfigured = () => ({
  alpaca: Boolean(secrets.alpacaKeyId() && secrets.alpacaSecret()),
  eodhd: Boolean(secrets.eodhdToken()),
  // SEC asks for a contact (name + email) in the User-Agent.
  edgar: Boolean(secrets.secUserAgent()?.includes('@')),
  // AI reviews need both a key and a spending cap.
  anthropic: Boolean(secrets.anthropicKey() && secrets.anthropicBudgetUsd()),
});
