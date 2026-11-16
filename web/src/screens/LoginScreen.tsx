import { useEffect, useState, type FormEvent } from 'react';
import { apiGet } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<{ signupAllowed: boolean; passwordRules: string } | null>(null);

  useEffect(() => {
    apiGet<{ signupAllowed: boolean; passwordRules: string }>('/auth/config')
      .then(setCfg)
      .catch((e: Error) => setError(e.message));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (mode === 'login' ? login(email, password) : signup(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <main className="card auth-card">
        <div className="logo" style={{ justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <span className="logo-mark" aria-hidden="true">◆</span> US Stock Terminal
        </div>
        <h1 className="auth-title">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
        <p className="muted auth-sub">Research tool for NYSE and Nasdaq stocks. No trading.</p>
        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === 'signup' ? 'pw-rules' : undefined}
            />
          </label>
          {mode === 'signup' && cfg && (
            <p id="pw-rules" className="muted field-hint">
              {cfg.passwordRules}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        {cfg?.signupAllowed && (
          <p className="muted auth-switch">
            {mode === 'login' ? 'No account yet? ' : 'Already have an account? '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? 'Create one' : 'Log in'}
            </button>
          </p>
        )}
        {cfg && !cfg.signupAllowed && <p className="muted auth-switch">Sign-up is closed. Ask the owner for an account.</p>}
      </main>
    </div>
  );
}
