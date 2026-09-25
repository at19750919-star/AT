import test from 'node:test';
import assert from 'node:assert/strict';

import { limitsFromOptions, nextExportFilename, parseCliOptions } from '../scripts/lib/cli-options.mjs';
import { applyGenerationLimits } from '../scripts/lib/legacy-runtime.mjs';

test('parseCliOptions 可收生成條件，none 代表不檢查', () => {
  const options = parseCliOptions([
    '--count', '3',
    '--avg-recovery', '4',
    '--max-tie', 'none',
    '--four-card-rate', '39',
    '--max-side', '5',
    '--seven-pt', '2',
    '--swap-banker6', 'none',
    '--skip-banker6',
    '--last-card-nine',
  ]);
  assert.equal(options.count, 3);
  assert.equal(options.avgRecoveryLimit, '4');
  assert.equal(options.maxTieLimit, '');
  assert.equal(options.maxFourCardRate, '39');
  assert.equal(options.maxSideLimit, '5');
  assert.equal(options.max7PtReversal, '2');
  assert.equal(options.swapBanker6Target, '');
  assert.equal(options.skipBanker6, true);
  assert.equal(options.lastCardNine, true);
  assert.equal(parseCliOptions([]).lastCardNine, false);
  assert.deepEqual(limitsFromOptions(options), {
    avgRecoveryLimit: '4',
    maxTieLimit: '',
    maxFourCardRate: '39',
    maxSideLimit: '5',
    max7PtReversal: '2',
    swapBanker6Target: '',
    skipBanker6: true,
  });
});

test('applyGenerationLimits 會把對調莊6留空', () => {
  const values = {
    avgRecoveryLimit: '4',
    maxTieLimit: '',
    maxFourCardRate: '39',
    maxSideLimit: '5',
    max7PtReversal: '2',
    swapBanker6Target: '2',
    skipBanker6: { value: '', checked: false },
  };
  const document = {
    getElementById(id) {
      if (id === 'skipBanker6') return values.skipBanker6;
      return {
        get value() { return values[id]; },
        set value(next) { values[id] = next; },
      };
    },
  };
  applyGenerationLimits(document, {
    swapBanker6Target: '',
    skipBanker6: true,
    avgRecoveryLimit: '4.5',
  });
  assert.equal(values.swapBanker6Target, '');
  assert.equal(values.skipBanker6.checked, true);
  assert.equal(values.avgRecoveryLimit, '4.5');
});

test('Excel 匯出檔名從 F501 起並避開已存在的編號', () => {
  assert.equal(nextExportFilename([]), 'F501.xlsx');
  assert.equal(nextExportFilename(['F301.xlsx']), 'F501.xlsx');
  assert.equal(nextExportFilename(['F501.xlsx']), 'F502.xlsx');
  assert.equal(nextExportFilename(['F550.xlsx', 'notes.txt']), 'F551.xlsx');
});
