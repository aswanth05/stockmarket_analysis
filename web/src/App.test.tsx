import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

afterEach(() => vi.unstubAllGlobals());

describe('login gate (step 28)', () => {
  it('shows only the login form to a logged-out visitor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/auth/config') ? json(200, { signupAllowed: false, passwordRules: 'rules' }) : json(401, { error: 'Please log in.' }),
      ),
    );
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Stock Screener')).not.toBeInTheDocument();
  });

  it('sends the app header on every request so the server accepts it', async () => {
    const f = vi.fn((url: string) => (url.endsWith('/auth/config') ? json(200, { signupAllowed: true, passwordRules: 'r' }) : json(401, {})));
    vi.stubGlobal('fetch', f);
    render(<App />);
    await screen.findByRole('heading', { name: 'Log in' });
    for (const call of f.mock.calls as unknown as [string, RequestInit][]) {
      expect((call[1].headers as Record<string, string>)['X-Requested-With']).toBe('ust');
    }
  });
});
