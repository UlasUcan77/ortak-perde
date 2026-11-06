import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDotEnv } from '../src/config';

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
