import { buildApp } from './app';
import { loadConfig, loadDotEnv } from './config';

loadDotEnv();
const config = loadConfig();
const app = buildApp({ config, logger: true });
const log = app.fastify.log;

if (app.catalog.mode === 'tmdb') {
  log.info('Katalog modu: TMDB API (bölge %s)', config.region);
} else {
  log.warn(
    'Katalog modu: ÖRNEK VERİ — TMDB_API_KEY tanımlı değil, 74 filmlik örnek set kullanılıyor.',
  );
}
log.info(
  config.webDist
    ? `Web arayüzü sunuluyor: ${config.webDist}`
    : 'Web arayüzü build edilmemiş (geliştirmede Vite kullanılır).',
);

await app.fastify.listen({ port: config.port, host: config.host });

if (config.publicUrl) {
  log.info(`QR adresi (PUBLIC_URL): ${config.publicUrl}`);
} else if (app.lanIp) {
  log.info(`Yerel ağ IP adresi: ${app.lanIp} — telefonlar aynı Wi-Fi ağında olmalı.`);
  if (config.webDist) {
    console.info(`
  📱 Telefonla bağlanmak için: http://${app.lanIp}:${config.port}
`);
  }
} else {
  log.warn('Yerel ağ IP adresi bulunamadı. Telefonların bağlanabilmesi için PUBLIC_URL ayarlayın.');
}

const shutdown = async (signal: string) => {
  log.info(`${signal} alındı, kapanıyor…`);
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
