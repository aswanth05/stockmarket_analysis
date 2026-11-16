import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('reports ok with the server time', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(res.body.serverTime))).toBe(false);
  });

  it('does not reveal the framework', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('asks for login before revealing whether an API route exists', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Please log in.' });
  });
});
