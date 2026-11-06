import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('health', () => {
  it('responds', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });
});
