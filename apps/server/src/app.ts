import Fastify from 'fastify';
import { APP_NAME } from '@ortak-perde/shared';

export function buildApp() {
  const app = Fastify({ logger: false });
  app.get('/api/health', async () => ({ ok: true, name: APP_NAME }));
  return app;
}
