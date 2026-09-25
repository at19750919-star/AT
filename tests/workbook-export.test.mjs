import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

import { verifyShoeWorkbook, writeShoeWorkbook } from '../scripts/lib/workbook-export.mjs';

test('直接導出的活頁簿完整重現原版四個分頁', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baccarat-export-'));
  const outputPath = path.join(outputDir, 'F001.xlsx');
  const shoe = {
    rounds: [{
      segment: 'A',
      result: '閒',
      signal: 'S',
      cards: [
        { rank: 'A', suit: '♠', back_color: 'R' },
        { rank: '2', suit: '♥', back_color: 'R' },
        { rank: '3', suit: '♦', back_color: 'R' },
        { rank: '4', suit: '♣', back_color: 'B' },
      ],
    }],
    previewGrid: [
      { className: 'cell result-cell result-player', value: 'X' },
      { className: 'cell card-red signal-match segment-a', value: 1 },
      { className: 'cell card-red signal-match segment-a', value: 2 },
      { className: 'cell card-red segment-a', value: 3 },
      { className: 'cell card-blue segment-a', value: 4 },
    ],
    recovery: {
      recoveryDetails: [
        { cutPoint: 0, roundsUsed: 0, cardsUsed: 0, immediate: true },
        { cutPoint: 1, roundsUsed: 2, cardsUsed: 8, immediate: false },
      ],
    },
  };

  const { workbook } = await writeShoeWorkbook({ shoe, outputPath });
  assert.deepEqual(
    workbook.worksheets.map((item) => item.name),
    ['預覽', '原始數據', '直立式牌靴', '回復分析統計'],
  );

  const preview = workbook.getWorksheet('預覽');
  assert.deepEqual(preview.getRow(1).values.slice(1, 6), ['X', 1, 2, 3, 4]);
  assert.equal(preview.getCell('A1').font.color.argb, 'FF0033AA');
  assert.equal(preview.getCell('B1').fill.fgColor.argb, 'FFFFFF00');
  assert.equal(preview.getCell('E1').fill.fgColor.argb, 'FF00CFCF');
  assert.equal(preview.pageSetup.printArea, 'A1:W31');

  const sheet = workbook.getWorksheet('原始數據');
  const values = [sheet.getRow(1).values.slice(1), sheet.getRow(2).values.slice(1)];

  assert.deepEqual(values[0], [
    '局號', '段標', '色序', '卡片1', '卡片2', '卡片3', '卡片4', '卡片5', '卡片6',
    '結果', '莊', '閒', '訊號', '對調莊', '對調閒',
  ]);
  assert.deepEqual(values[1].slice(0, 10), [
    1, 'A', 'RRRB', 'A♠', '2♥', '3♦', '4♣', '', '', '閒',
  ]);

  const vertical = workbook.getWorksheet('直立式牌靴');
  assert.deepEqual([1, 2, 3, 4].map((row) => vertical.getRow(row).values.slice(1)), [
    [1, 'A♠'], [2, '2♥'], [3, '3♦'], [4, '4♣'],
  ]);
  assert.equal(vertical.getCell('B1').fill.fgColor.argb, 'FFFFFF00');
  assert.equal(vertical.getCell('B4').fill.fgColor.argb, 'FF00FFFF');

  const recovery = workbook.getWorksheet('回復分析統計');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((row) => {
    const values = recovery.getRow(row).values.slice(1, 5);
    while (values.length < 4) values.push('');
    return values.map((value) => value ?? '');
  }), [
    ['局數統計', '局數', '比例', '備註'],
    ['4張局', 1, '100.0%', '1/1'],
    ['5張局', 0, '0.0%', '0/1'],
    ['6張局', 0, '0.0%', '0/1'],
    ['', '', '', ''],
    ['切牌點位置', '回復局數', '消耗牌數', '是否立即回復'],
    [1, 0, 0, '是'],
    [2, 2, 8, '否'],
  ]);
  assert.equal((await fs.stat(outputPath)).size > 0, true);
  assert.deepEqual(await fs.readdir(outputDir), ['F001.xlsx']);

  const excelJsWorkbook = new ExcelJS.Workbook();
  await excelJsWorkbook.xlsx.load(await fs.readFile(outputPath));
  assert.deepEqual(excelJsWorkbook.worksheets.map((item) => item.name), [
    '預覽', '原始數據', '直立式牌靴', '回復分析統計',
  ]);
  assert.equal(excelJsWorkbook.getWorksheet('原始數據').rowCount, 2);

  const verification = await verifyShoeWorkbook({ shoe, outputPath });
  assert.deepEqual(verification, { rounds: 1, cards: 4 });
});
