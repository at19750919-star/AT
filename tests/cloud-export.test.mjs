import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { listDriveFiles, uploadWorkbookToDrive } from '../scripts/lib/cloud-export.mjs';

test('讀取原版Google Drive端點的檔案清單', async () => {
  const calls = [];
  const files = await listDriveFiles(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, async json() { return { success: true, files: [{ name: 'F242.xlsx' }] }; } };
  });

  assert.deepEqual(files, [{ name: 'F242.xlsx' }]);
  assert.match(calls[0].url, /^https:\/\/script\.google\.com\/macros\/s\//);
  assert.equal(calls[0].options, undefined);
});

test('把本機xlsx用原版JSON格式上傳到同一個Google Drive端點', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baccarat-cloud-'));
  const filePath = path.join(dir, 'F301.xlsx');
  await fs.writeFile(filePath, Buffer.from('xlsx-test'));
  let request;
  const result = await uploadWorkbookToDrive({
    filePath,
    filename: 'F301.xlsx',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, async json() { return { success: true, fileName: 'F301.xlsx', fileUrl: 'drive-link' }; } };
    },
    wait: async () => {},
  });

  const payload = JSON.parse(request.options.body);
  assert.equal(request.options.method, 'POST');
  assert.equal(payload.filename, 'F301.xlsx');
  assert.equal(Buffer.from(payload.base64Data, 'base64').toString(), 'xlsx-test');
  assert.equal(result.fileName, 'F301.xlsx');
});
