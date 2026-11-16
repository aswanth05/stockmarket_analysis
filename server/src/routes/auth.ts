import { Router } from 'express';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../auth/middleware';
import {
  changePassword,
  createSession,
  createUser,
  deleteSession,
  emailProblem,
  PASSWORD_RULES,
  passwordProblem,
  rateLimited,
  recordAttempt,
  signupAllowed,
  verifyLogin,
} from '../auth/service';

export const authRouter = Router();

authRouter.get('/config', (_req, res) => {
  res.json({ signupAllowed: signupAllowed(), passwordRules: PASSWORD_RULES });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post('/signup', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!signupAllowed()) {
    res.status(403).json({ error: 'Sign-up is closed. Ask the owner for an account.' });
    return;
  }
  const problem = emailProblem(email) ?? passwordProblem(password);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const user = await createUser(email, password);
  if (user === 'exists') {
    res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
    return;
  }
  const { token } = createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ error: 'Enter your email and password.' });
    return;
  }
  const ip = req.ip ?? 'unknown';
  const wait = rateLimited(ip, email);
  if (wait > 0) {
    res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` });
    return;
  }
  const user = await verifyLogin(email, password);
  recordAttempt(ip, email, !user);
  if (!user) {
    res.status(401).json({ error: 'Email or password is incorrect.' });
    return;
  }
  const { token } = createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user });
});

authRouter.post('/logout', (req, res) => {
  deleteSession(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const { current, next } = req.body ?? {};
  const problem = typeof current !== 'string' || !current ? 'Enter your current password.' : passwordProblem(next);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const r = await changePassword(req.user!.id, current, next, req.sessionToken);
  if (r === 'wrong-password') {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  res.json({ ok: true, message: 'Password changed. Other sessions were signed out.' });
});
