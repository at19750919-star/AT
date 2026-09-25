import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAcceptedShoe } from '../scripts/lib/batch-engine.mjs';

const cleanStats = {
  signalViolations: 0,
  fourCardViolations: 0,
  streakViolations: 0,
  cardCountMismatchViolations: 0,
  cannotSwapViolations: 0,
  cardColorViolations: 0,
};

function shoe(stats) {
  return { rounds: [{ cards: [{ rank: 'A', suit: '♠', back_color: 'R' }] }], stats };
}

test('非卡色違規會捨棄並重新生成', async () => {
  const candidates = [
    shoe({ ...cleanStats, signalViolations: 1 }),
    shoe(cleanStats),
  ];
  const runtime = {
    async generateOne() { return candidates.shift(); },
  };

  const result = await generateAcceptedShoe(runtime, { maxAttempts: 2 });

  assert.equal(result.attempts, 2);
  assert.deepEqual(result.shoe.stats, cleanStats);
});

test('卡色超過三張先自動修復一次，降到三張內再做精準修復', async () => {
  let autoFixCalls = 0;
  let manualFixCalls = 0;
  const runtime = {
    async generateOne() { return shoe({ ...cleanStats, cardColorViolations: 8 }); },
    async applyAutoColorFix() {
      autoFixCalls++;
      return shoe({ ...cleanStats, cardColorViolations: 2 });
    },
    async applyManualColorFix() {
      manualFixCalls++;
      return shoe(cleanStats);
    },
  };

  const result = await generateAcceptedShoe(runtime, { maxAttempts: 1 });

  assert.equal(result.attempts, 1);
  assert.equal(autoFixCalls, 1);
  assert.equal(manualFixCalls, 1);
});

test('自動修復一次後卡色仍超過三張就重跑', async () => {
  let generated = 0;
  const runtime = {
    async generateOne() {
      generated++;
      return generated === 1
        ? shoe({ ...cleanStats, cardColorViolations: 9 })
        : shoe(cleanStats);
    },
    async applyAutoColorFix() {
      return shoe({ ...cleanStats, cardColorViolations: 4 });
    },
  };

  const result = await generateAcceptedShoe(runtime, { maxAttempts: 2 });

  assert.equal(result.attempts, 2);
});

test('超過最大重跑次數會停止', async () => {
  const runtime = {
    async generateOne() { return shoe({ ...cleanStats, cannotSwapViolations: 1 }); },
  };

  await assert.rejects(
    () => generateAcceptedShoe(runtime, { maxAttempts: 2 }),
    /已達最大生成次數 2/,
  );
});

test('末張9調整後才接受；調整後有違規則重新生成', async () => {
  let generated = 0;
  const runtime = {
    async generateOne() { generated++; return shoe(cleanStats); },
  };
  const result = await generateAcceptedShoe(runtime, {
    maxAttempts: 3,
    async finalize() {
      if (generated === 1) return null;
      if (generated === 2) return shoe({ ...cleanStats, streakViolations: 1 });
      return { ...shoe(cleanStats), lastCardNine: true };
    },
  });
  assert.equal(result.attempts, 3);
  assert.equal(result.shoe.lastCardNine, true);
});
