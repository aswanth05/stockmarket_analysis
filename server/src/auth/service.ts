import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { SessionUser } from '@ust/shared';
import { getDb, nowIso } from '../db';

export const SESSION_COOKIE = 'ust_session';
export const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 12;

export const PASSWORD_RULES = 'At least 10 characters, with at least one letter and one number.';

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string') return 'Password is required.';
  if (pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
  return null;
}

export function emailProblem(email: unknown): string | null {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return 'Enter a valid email address.';
  return null;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

const view = (u: UserRow): SessionUser => ({ id: u.id, email: u.email, createdAt: u.created_at });

export const userCount = () => (getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;

/** Sign-up is open when ALLOW_SIGNUP=true, or when no account exists yet (so the owner can create the first one). */
export const signupAllowed = () => process.env.ALLOW_SIGNUP === 'true' || userCount() === 0;

export async function createUser(email: string, password: string): Promise<SessionUser | 'exists'> {
  const db = getDb();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const at = nowIso();
    const r = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(email.trim(), hash, at);
    return { id: Number(r.lastInsertRowid), email: email.trim(), createdAt: at };
  } catch (e) {
    if (String(e).includes('UNIQUE')) return 'exists';
    throw e;
  }
}

// A real hash to compare against when the email is unknown, so timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-0', BCRYPT_ROUNDS);

export async function verifyLogin(email: string, password: string): Promise<SessionUser | null> {
  const u = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.trim()) as UserRow | undefined;
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
  return u && ok ? view(u) : null;
}

export function createSession(userId: number): { token: string; expires: Date } {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  getDb()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, nowIso(), expires.toISOString());
  return { token, expires };
}

export function sessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const u = getDb()
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(hashToken(token), nowIso()) as UserRow | undefined;
  return u ? view(u) : null;
}

export function deleteSession(token: string | undefined) {
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export async function changePassword(userId: number, current: string, next: string, keepToken?: string): Promise<'ok' | 'wrong-password'> {
  const db = getDb();
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!u || !(await bcrypt.compare(current, u.password_hash))) return 'wrong-password';
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(next, BCRYPT_ROUNDS), userId);
  // Sign out every other session.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, keepToken ? hashToken(keepToken) : '');
  return 'ok';
}

/* ---------- Login rate limiting (in memory; resets on restart) ---------- */

const WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, number[]>();

/** Returns seconds to wait, or 0 when allowed. Limits: 5 failures per email+IP, 20 attempts per IP, per 15 minutes. */
export function rateLimited(ip: string, email: string): number {
  const now = Date.now();
  const check = (key: string, max: number) => {
    const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    attempts.set(key, list);
    return list.length >= max ? Math.ceil((list[0]! + WINDOW_MS - now) / 1000) : 0;
  };
  return Math.max(check(`fail:${ip}:${email.toLowerCase()}`, 5), check(`ip:${ip}`, 20));
}

export function recordAttempt(ip: string, email: string, failed: boolean) {
  const now = Date.now();
  attempts.set(`ip:${ip}`, [...(attempts.get(`ip:${ip}`) ?? []), now]);
  if (failed) {
    const k = `fail:${ip}:${email.toLowerCase()}`;
    attempts.set(k, [...(attempts.get(k) ?? []), now]);
  }
}

export const resetRateLimitsForTests = () => attempts.clear();
