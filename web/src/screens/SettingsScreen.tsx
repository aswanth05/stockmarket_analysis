import { useState, type FormEvent } from 'react';
import type { AiUsageView, MethodologyResponse, ProvidersStatus, SessionUser } from '@ust/shared';
import { apiPost } from '../api/client';
import { useApi } from '../api/useApi';
import { ProviderNotice } from '../components/ProviderNotice';
import { ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatDate } from '../format';
import { SourcesTable } from './MethodologyScreen';

interface SettingsResponse {
  user: SessionUser;
  providers: ProvidersStatus;
  aiUsage: AiUsageView;
  sources: MethodologyResponse['sources'];
}

export function SettingsScreen() {
  const { data, error, loading, reload } = useApi<SettingsResponse>('/settings');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (loading && !data) return <LoadingSkeleton lines={6} label="Loading settings" />;
  if (!data) return <ErrorState what="Settings could not be loaded." next={error ?? ''} onRetry={reload} />;

  const change = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await apiPost<{ message: string }>('/auth/password', { current, next });
      setMsg({ ok: true, text: r.message });
      setCurrent('');
      setNext('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const u = data.aiUsage;
  return (
    <div className="stack">
      <section className="card">
        <h2 className="section-title">Account</h2>
        <dl className="review-meta">
          <div><dt>Email</dt><dd>{data.user.email}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(data.user.createdAt)}</dd></div>
        </dl>
      </section>

      <section className="card">
        <h2 className="section-title">Change password</h2>
        <form onSubmit={change} style={{ maxWidth: 380 }}>
          <label className="field">
            <span>Current password</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-hint" />
          </label>
          <p id="pw-hint" className="muted field-hint">At least 10 characters, with at least one letter and one number. Other sessions are signed out.</p>
          {msg && <p className={msg.ok ? 'form-ok' : 'form-error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          <button className="btn" type="submit">Change password</button>
        </form>
      </section>

      <section className="card">
        <h2 className="section-title">Data sources</h2>
        <ProviderNotice providers={data.providers} need={['alpaca', 'eodhd', 'edgar', 'anthropic']} />
        <SourcesTable sources={data.sources} />
        <p className="data-time">Keys are read only by the server from server/.env. They are never sent to the browser.</p>
      </section>

      <section className="card">
        <h2 className="section-title">AI review spending (this month)</h2>
        <p>
          <span className="num">${u.monthSpendUsd.toFixed(2)}</span> used
          {u.monthlyBudgetUsd != null ? (
            <> of a <span className="num">${u.monthlyBudgetUsd.toFixed(2)}</span> cap. New reviews stop when the cap is reached.</>
          ) : (
            <> · no cap set, so AI reviews are off.</>
          )}
        </p>
      </section>
    </div>
  );
}
