#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateAcceptedShoe } from './lib/batch-engine.mjs';
import { defaultOutputDirectory, limitsFromOptions, nextExportFilename, parseCliOptions } from './lib/cli-options.mjs';
import { listDriveFiles, uploadWorkbookToDrive } from './lib/cloud-export.mjs';
import { createLegacyRuntime } from './lib/legacy-runtime.mjs';
import { verifyShoeWorkbook, writeShoeWorkbook } from './lib/workbook-export.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const HELP = `
百家3.0 無 HTML 批次牌靴生成器

不開啟 HTML，直接使用現有 signals.js 與 signals_ui.js 生成並導出 Excel。

使用方式：
  node scripts/batch-generate.mjs [選項]

選項：
  --count <數量>          要生成的牌靴副數，預設 1
  --output <目錄>         本機輸出目錄，預設 Windows Downloads
  --max-attempts <次數>   每副牌最多重跑次數，預設 500
  --seed <整數>           固定亂數種子，供重現與測試
  --avg-recovery <數>     平均回復上限，none 或 0 代表不檢查
  --max-tie <數>          和局上限，none 代表不檢查
  --four-card-rate <數>   4張局比例上限%，none 代表不檢查
  --max-side <數>         莊與閒+和局數差距上限，none 代表不檢查
  --seven-pt <數>         7點反轉上限，none 代表不檢查
  --swap-banker6 <數>     對調莊6目標局數，none 代表不檢查
  --skip-banker6          避開莊6點贏
  --last-card-nine        匯出前調整牌序，讓第 416 張是 9
  --help                  顯示本說明
`;

function shoeSignature(shoe) {
  return shoe.rounds
    .flatMap((round) => round.cards)
    .map((card) => `${card.rank}${card.suit}${card.back_color}`)
    .join('|');
}

function compactStats(stats) {
  return [
    `訊號=${stats.signalViolations || 0}`,
    `連4=${stats.fourCardViolations || 0}`,
    `連莊閒=${stats.streakViolations || 0}`,
    `張數=${stats.cardCountMismatchViolations || 0}`,
    `無法對調=${stats.cannotSwapViolations || 0}`,
    `卡色=${stats.cardColorViolations || 0}`,
  ].join('、');
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP.trimStart());
    return;
  }

  const outputDir = options.output
    ? path.resolve(projectRoot, options.output)
    : defaultOutputDirectory();
  await fs.mkdir(outputDir, { recursive: true });
  const runtime = await createLegacyRuntime({
    projectRoot,
    randomSeed: options.seed,
    silent: true,
    limits: limitsFromOptions(options),
  });
  const signatures = new Set();
  const written = [];

  for (let shoeNumber = 1; shoeNumber <= options.count; shoeNumber++) {
    let accepted;
    while (!accepted) {
      const result = await generateAcceptedShoe(runtime, {
        maxAttempts: options.maxAttempts,
        finalize: options.lastCardNine ? () => runtime.applyLastCardNine() : undefined,
        onAttempt({ attempts, stage, stats }) {
          const labels = {
            generated: '生成',
            'auto-color-fixed': '換色後',
            'manual-color-fixed': '精準修復後',
            'last-card-nine': '末張9調整後',
            'last-card-nine-missing': '沒有可用末張9切點',
          };
          const label = labels[stage] || stage;
          process.stdout.write(`[${shoeNumber}/${options.count}] 第 ${attempts} 次${label}：${compactStats(stats)}\n`);
        },
      });
      const signature = shoeSignature(result.shoe);
      if (signatures.has(signature)) {
        process.stdout.write(`[${shoeNumber}/${options.count}] 牌面內容重複，重新生成\n`);
        continue;
      }
      signatures.add(signature);
      accepted = result;
    }

    const exportShoe = await runtime.getExportData();
    if (options.lastCardNine) {
      const cards = exportShoe.rounds.flatMap((round) => round.cards);
      if (cards.length !== 416 || String(cards[415]?.rank) !== '9') {
        throw new Error('末張9驗證失敗：匯出前第 416 張不是 9');
      }
    }
    const before = await fs.readdir(outputDir);
    const cloudBefore = await listDriveFiles();
    const filename = nextExportFilename([...before, ...cloudBefore.map((file) => file.name)]);
    const outputPath = path.join(outputDir, filename);
    await writeShoeWorkbook({ shoe: exportShoe, outputPath });
    const after = await fs.readdir(outputDir);
    if (after.length !== before.length + 1 || !after.includes(filename)) {
      throw new Error(`導出後檔案數量不是恰好增加一個，已停止：${filename}`);
    }
    const verification = await verifyShoeWorkbook({
      shoe: exportShoe,
      outputPath,
      expectedLastRank: options.lastCardNine ? '9' : undefined,
    });
    if (verification.cards !== 416) {
      throw new Error(`導出驗證失敗：${filename} 只有 ${verification.cards}/416 張牌`);
    }
    const uploadResult = await uploadWorkbookToDrive({ filePath: outputPath, filename });
    const cloudAfter = await listDriveFiles();
    const beforeMatches = cloudBefore.filter((file) => file.name === filename).length;
    const afterMatches = cloudAfter.filter((file) => file.name === filename).length;
    if (afterMatches !== beforeMatches + 1) {
      throw new Error(`雲端驗證失敗：${filename} 上傳前後數量不是恰好增加一個`);
    }
    written.push(outputPath);
    process.stdout.write(`[${shoeNumber}/${options.count}] 已導出並驗證 ${outputPath}\n`);
    process.stdout.write(`[${shoeNumber}/${options.count}] 已上傳Google Drive ${uploadResult.fileUrl || filename}\n`);
  }

  process.stdout.write(`完成：共導出 ${written.length} 副牌靴\n`);
}

main().catch((error) => {
  process.stderr.write(`失敗：${error?.message || error}\n`);
  process.exitCode = 1;
});
