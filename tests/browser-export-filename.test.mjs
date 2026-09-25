import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../signals.js', import.meta.url), 'utf8');
const functionSource = source.match(/async function getNextExportFilename\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(functionSource, '找不到網頁匯出檔名函式');

async function getName({ cloudNames = [], local = '0' } = {}) {
  const storage = new Map([['at-export-counter', local]]);
  const context = {
    GOOGLE_APPS_SCRIPT_URL: 'https://example.test/files',
    fetch: async () => ({ json: async () => ({ success: true, files: cloudNames.map(name => ({ name })) }) }),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    console,
  };
  const name = await vm.runInNewContext(`${functionSource}\ngetNextExportFilename()`, context);
  return { name, counter: storage.get('at-export-counter') };
}

test('網頁匯出從 F501 起，並接續雲端或本機較大的編號', async () => {
  assert.deepEqual(await getName({ cloudNames: ['F414.xlsx'] }), { name: 'F501.xlsx', counter: '501' });
  assert.deepEqual(await getName({ cloudNames: ['F503.xlsx'] }), { name: 'F504.xlsx', counter: '504' });
  assert.deepEqual(await getName({ cloudNames: ['F414.xlsx'], local: '508' }), { name: 'F509.xlsx', counter: '509' });
});
