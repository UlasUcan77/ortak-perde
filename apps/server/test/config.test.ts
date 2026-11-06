import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, loadDotEnv } from '../src/config';

describe('loadConfig', () => {
  it('uses Render’s external URL and proxy when PUBLIC_URL is not set', () => {
    const cfg = loadConfig({ RENDER: 'true', RENDER_EXTERNAL_URL: 'https://perde.onrender.com' });
    expect(cfg.publicUrl).toBe('https://perde.onrender.com');
    expect(cfg.trustProxy).toBe(true);
  });

  it('prefers an explicit PUBLIC_URL and TRUST_PROXY', () => {
    const cfg = loadConfig({
      RENDER: 'true',
      RENDER_EXTERNAL_URL: 'https://perde.onrender.com',
      PUBLIC_URL: 'https://ortakperde.com',
      TRUST_PROXY: 'false',
    });
    expect(cfg.publicUrl).toBe('https://ortakperde.com');
    expect(cfg.trustProxy).toBe(false);
  });

  it('defaults to no public URL and no proxy trust', () => {
    const cfg = loadConfig({});
    expect(cfg.publicUrl).toBeNull();
    expect(cfg.trustProxy).toBe(false);
  });
});

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function repoWithEnv(content: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'op-env-'));
  dirs.push(root);
  fs.writeFileSync(path.join(root, '.env'), content);
  const nested = path.join(root, 'apps', 'server');
  fs.mkdirSync(nested, { recursive: true });
  return { root, nested };
}

describe('loadDotEnv', () => {
  it('finds the repo-root .env from a workspace directory', () => {
    const { root, nested } = repoWithEnv('TMDB_API_KEY=abc123\nPORT=4000\n');
    const env: NodeJS.ProcessEnv = {};
    expect(loadDotEnv(nested, env)).toBe(path.join(root, '.env'));
    expect(env).toMatchObject({ TMDB_API_KEY: 'abc123', PORT: '4000' });
  });

  it('fills empty inherited variables but keeps real ones', () => {
    const { nested } = repoWithEnv(
      String.fromCharCode(0xfeff) + '# comment\r\nTMDB_API_KEY=from-file\r\nPORT=4000\r\n',
    );
    const env: NodeJS.ProcessEnv = { TMDB_API_KEY: '', PORT: '5000' };
    loadDotEnv(nested, env);
    expect(env.TMDB_API_KEY).toBe('from-file');
    expect(env.PORT).toBe('5000');
  });
});
