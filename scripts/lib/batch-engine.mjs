import { decideViolationAction } from './violation-policy.mjs';

function toPolicyStats(stats) {
  return {
    color: stats.cardColorViolations || 0,
    signal: stats.signalViolations || 0,
    consecutiveFour: stats.fourCardViolations || 0,
    consecutiveSide: stats.streakViolations || 0,
    unswappable: stats.cannotSwapViolations || 0,
    other: stats.cardCountMismatchViolations || 0,
  };
}

function isClean(shoe) {
  return decideViolationAction(toPolicyStats(shoe.stats)) === 'accept';
}

export async function generateAcceptedShoe(runtime, options = {}) {
  const maxAttempts = Number(options.maxAttempts || 500);
  const onAttempt = typeof options.onAttempt === 'function' ? options.onAttempt : () => {};
  const finalize = typeof options.finalize === 'function' ? options.finalize : null;

  const acceptCandidate = async (shoe, attempts) => {
    if (!finalize) return { shoe, attempts };
    const finalized = await finalize(shoe);
    if (!finalized) {
      await onAttempt({ attempts, stage: 'last-card-nine-missing', stats: shoe.stats });
      return null;
    }
    await onAttempt({ attempts, stage: 'last-card-nine', stats: finalized.stats });
    return isClean(finalized) ? { shoe: finalized, attempts } : null;
  };

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    let current = await runtime.generateOne();
    await onAttempt({ attempts, stage: 'generated', stats: current.stats });
    let action = decideViolationAction(toPolicyStats(current.stats));

    if (action === 'regenerate') continue;
    if (action === 'accept') {
      const accepted = await acceptCandidate(current, attempts);
      if (accepted) return accepted;
      continue;
    }

    if (action === 'auto-color-fix') {
      current = await runtime.applyAutoColorFix();
      await onAttempt({ attempts, stage: 'auto-color-fixed', stats: current.stats });
      action = decideViolationAction(toPolicyStats(current.stats), { autoColorFixUsed: true });
      if (action === 'regenerate') continue;
      if (action === 'accept') {
        const accepted = await acceptCandidate(current, attempts);
        if (accepted) return accepted;
        continue;
      }
    }

    if (action === 'manual-color-fix') {
      current = await runtime.applyManualColorFix();
      await onAttempt({ attempts, stage: 'manual-color-fixed', stats: current.stats });
      if (isClean(current)) {
        const accepted = await acceptCandidate(current, attempts);
        if (accepted) return accepted;
      }
    }
  }

  throw new Error(`已達最大生成次數 ${maxAttempts}，仍未取得無違規牌靴`);
}
