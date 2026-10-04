import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Python入口可顯示簡明使用說明', () => {
  const result = spawnSync('python', ['批次生成.py', '--help'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, PYTHONUTF8: '1' },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /生成副數/);
  assert.match(result.stdout, /python 批次生成\.py 10/);
});
