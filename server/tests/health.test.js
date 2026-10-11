import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Server health & baseline middleware', () => {
  const app = createApp();

  it('GET /health returns 200 and expected contract shape', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('bankism');
    expect(['online', 'degraded', 'disabled']).toContain(res.body.llm);
    expect(res.body.policy_version).toBe('1.0.0');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('handles unknown routes with JSON 404', async () => {
    const res = await request(app).get('/unknown-route-12345');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Not Found'
    });
  });

  it('handles malformed JSON body with HTTP 400 JSON error', async () => {
    const res = await request(app)
      .post('/api/some-endpoint')
      .set('Content-Type', 'application/json')
      .send('{ "broken": json }');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Malformed JSON payload');
  });
});
