import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  decideViolationAction,
  normalizeViolationStats,
} from '../scripts/lib/violation-policy.mjs';
import { createLegacyRuntime } from '../scripts/lib/legacy-runtime.mjs';
import { verifyShoeWorkbook, writeShoeWorkbook } from '../scripts/lib/workbook-export.mjs';

const cleanNonColor = {
  signal: 0,
  consecutiveFour: 0,
  consecutiveSide: 0,
  unswappable: 0,
  other: 0,
};

test('任何非卡色違規都直接重新生成', () => {
  const action = decideViolationAction({
    ...cleanNonColor,
    signal: 1,
    color: 2,
  });

  assert.equal(action, 'regenerate');
});

test('卡色違規零張時接受牌靴', () => {
  const action = decideViolationAction({ ...cleanNonColor, color: 0 });

  assert.equal(action, 'accept');
});

test('卡色違規一到三張時進行手動卡色修復', () => {
  assert.equal(decideViolationAction({ ...cleanNonColor, color: 1 }), 'manual-color-fix');
  assert.equal(decideViolationAction({ ...cleanNonColor, color: 3 }), 'manual-color-fix');
});

test('卡色超過三張只允許自動修復一次', () => {
  assert.equal(
    decideViolationAction({ ...cleanNonColor, color: 4 }, { autoColorFixUsed: false }),
    'auto-color-fix',
  );
  assert.equal(
    decideViolationAction({ ...cleanNonColor, color: 4 }, { autoColorFixUsed: true }),
    'regenerate',
  );
});

test('頁面文字統計可正規化成數字', () => {
  assert.deepEqual(
    normalizeViolationStats({
      '卡色違規': '3 張',
      '訊號牌違規': '無',
      '連續5局4張': '0',
      '連續莊閒': '無',
      '無法對調': '0 局',
      '其他違規': '',
    }),
    { ...cleanNonColor, color: 3 },
  );
});

test('無 HTML 執行環境可載入現有牌靴核心並建立416張牌', async () => {
  const runtime = await createLegacyRuntime({
    projectRoot: new URL('..', import.meta.url),
    silent: true,
  });

  assert.equal(await runtime.getDeckSize(), 416);
});

test('無 HTML 執行環境可依標準設定生成完整牌靴', { timeout: 120_000 }, async () => {
  const runtime = await createLegacyRuntime({
    projectRoot: new URL('..', import.meta.url),
    silent: true,
    randomSeed: 19750919,
  });

  const generated = await runtime.generateOne();

  assert.ok(generated.rounds.length > 0);
  assert.equal(generated.rounds.reduce((sum, round) => sum + round.cards.length, 0), 416);
  assert.equal(typeof generated.stats.cardColorViolations, 'number');
  assert.equal(typeof generated.stats.signalViolations, 'number');
  assert.equal(generated.rounds.some((round) => round.signal === 'S'), true);

  const exportData = await runtime.getExportData();
  assert.equal(exportData.previewGrid.length, 21 * 31);
  assert.equal(exportData.recovery.recoveryDetails.length, 416);
});

test('批次執行環境可調整成第416張為9並同步導出資料', { timeout: 120_000 }, async () => {
  const runtime = await createLegacyRuntime({
    projectRoot: new URL('..', import.meta.url),
    silent: true,
    randomSeed: 19750919,
  });
  await runtime.generateOne();
  const adjusted = await runtime.applyLastCardNine();
  assert.ok(adjusted);
  const cards = adjusted.rounds.flatMap((round) => round.cards);
  assert.equal(cards.length, 416);
  assert.equal(cards[415].rank, '9');
  const exportData = await runtime.getExportData();
  assert.equal(exportData.rounds.flatMap((round) => round.cards)[415].rank, '9');
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baccarat-last-nine-'));
  const outputPath = path.join(outputDir, 'test.xlsx');
  try {
    await writeShoeWorkbook({ shoe: exportData, outputPath });
    const verified = await verifyShoeWorkbook({ shoe: exportData, outputPath, expectedLastRank: '9' });
    assert.equal(verified.cards, 416);
  } finally {
    await fs.unlink(outputPath).catch(() => {});
    await fs.rmdir(outputDir).catch(() => {});
  }
});

test('無 HTML 執行環境可執行一次卡色修復並重新統計', { timeout: 120_000 }, async () => {
  const runtime = await createLegacyRuntime({
    projectRoot: new URL('..', import.meta.url),
    silent: true,
    randomSeed: 19750919,
  });
  await runtime.generateOne();

  const repaired = await runtime.applyAutoColorFix();

  assert.equal(repaired.rounds.reduce((sum, round) => sum + round.cards.length, 0), 416);
  assert.equal(typeof repaired.stats.cardColorViolations, 'number');
});

test('剩餘三張內卡色違規可用第5或第6張精準修復', { timeout: 120_000 }, async () => {
  const runtime = await createLegacyRuntime({
    projectRoot: new URL('..', import.meta.url),
    silent: true,
    randomSeed: 19750919,
  });
  await runtime.generateOne();
  const autoRepaired = await runtime.applyAutoColorFix();
  assert.equal(autoRepaired.stats.cardColorViolations, 1);

  const repaired = await runtime.applyManualColorFix();

  assert.equal(repaired.stats.cardColorViolations, 0);
  assert.equal(repaired.rounds.reduce((sum, round) => sum + round.cards.length, 0), 416);
});
