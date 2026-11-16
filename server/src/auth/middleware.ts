import type { NextFunction, Request, Response } from 'express';
import type { SessionUser } from '@ust/shared';
import { config } from '../config';
import { SESSION_COOKIE, SESSION_DAYS, sessionUser } from './service';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
    sessionToken?: string;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: SESSION_DAYS * 86_400_000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProduction, path: '/' });
}

/** Attaches req.user when the session cookie is valid. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = readCookie(req, SESSION_COOKIE);
  const user = sessionUser(token);
  if (user) {
    req.user = user;
    req.sessionToken = token;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Please log in.' });
    return;
  }
  next();
}

/**
 * Cross-site request protection for state-changing calls: the app's own pages send a custom header
 * (which other sites cannot add without a CORS preflight we never allow), and any Origin must match this host.
 */
export function sameOriginWrites(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const originOk = !origin || new URL(origin).host === host;
  if (req.headers['x-requested-with'] !== 'ust' || !originOk) {
    res.status(403).json({ error: 'Request blocked: it did not come from this app.' });
    return;
  }
  next();
}
