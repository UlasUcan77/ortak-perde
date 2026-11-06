import { buildApp } from './app';

const app = buildApp();
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
console.info('Ortak Perde server listening');
