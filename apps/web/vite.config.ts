import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';

const SERVER_PORT = Number(process.env.SERVER_PORT ?? 3000);
const WEB_PORT = Number(process.env.WEB_PORT ?? process.env.PORT ?? 5173);

function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  return null;
}

/** Prints the LAN URL phones should open while developing. */
function printLanUrl(): Plugin {
  return {
    name: 'ortak-perde-lan-url',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const ip = lanAddress();
        const port = server.config.server.port ?? WEB_PORT;
        setTimeout(() => {
          if (ip) {
            console.info(`\n  📱 Telefonla bağlanmak için: http://${ip}:${port}\n`);
          } else {
            console.info('\n  📱 Yerel ağ IP adresi bulunamadı; telefonlar bağlanamayabilir.\n');
          }
        }, 50);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), printLanUrl()],
  server: {
    host: '0.0.0.0',
    port: WEB_PORT,
    proxy: {
      '/api': `http://127.0.0.1:${SERVER_PORT}`,
      '/socket.io': { target: `http://127.0.0.1:${SERVER_PORT}`, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
