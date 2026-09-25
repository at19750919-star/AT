function positiveInteger(name, value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} 必須是正整數`);
  }
  return parsed;
}

function takeValue(name, value) {
  if (value === undefined) throw new Error(`${name} 缺少值`);
  return value;
}

function optionalLimit(name, value) {
  const raw = takeValue(name, value);
  if (raw === 'none' || raw === '-') return '';
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} 必須是 >= 0 的數字或 none`);
  }
  return String(raw);
}

export function limitsFromOptions(options) {
  const limits = {};
  if (options.avgRecoveryLimit !== undefined) limits.avgRecoveryLimit = options.avgRecoveryLimit;
  if (options.maxTieLimit !== undefined) limits.maxTieLimit = options.maxTieLimit;
  if (options.maxFourCardRate !== undefined) limits.maxFourCardRate = options.maxFourCardRate;
  if (options.maxSideLimit !== undefined) limits.maxSideLimit = options.maxSideLimit;
  if (options.max7PtReversal !== undefined) limits.max7PtReversal = options.max7PtReversal;
  if (options.swapBanker6Target !== undefined) limits.swapBanker6Target = options.swapBanker6Target;
  if (options.skipBanker6 !== undefined) limits.skipBanker6 = options.skipBanker6;
  return limits;
}

export function parseCliOptions(args) {
  const options = {
    count: 1,
    output: undefined,
    maxAttempts: 500,
    seed: undefined,
    help: false,
    lastCardNine: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--count') options.count = positiveInteger('count', args[++index]);
    else if (arg === '--output') options.output = args[++index];
    else if (arg === '--max-attempts') options.maxAttempts = positiveInteger('max-attempts', args[++index]);
    else if (arg === '--seed') options.seed = Number.parseInt(args[++index], 10);
    else if (arg === '--avg-recovery') {
      const value = optionalLimit('avg-recovery', args[++index]);
      options.avgRecoveryLimit = value === '' ? '0' : value;
    } else if (arg === '--max-tie') options.maxTieLimit = optionalLimit('max-tie', args[++index]);
    else if (arg === '--four-card-rate') options.maxFourCardRate = optionalLimit('four-card-rate', args[++index]);
    else if (arg === '--max-side') options.maxSideLimit = optionalLimit('max-side', args[++index]);
    else if (arg === '--seven-pt') options.max7PtReversal = optionalLimit('seven-pt', args[++index]);
    else if (arg === '--swap-banker6') options.swapBanker6Target = optionalLimit('swap-banker6', args[++index]);
    else if (arg === '--skip-banker6') options.skipBanker6 = true;
    else if (arg === '--last-card-nine') options.lastCardNine = true;
    else throw new Error(`未知參數：${arg}`);
  }

  if (options.output === '') throw new Error('output 不可空白');
  if (options.seed !== undefined && !Number.isInteger(options.seed)) throw new Error('seed 必須是整數');
  return options;
}

export function defaultOutputDirectory(env = process.env) {
  return path.join(env.USERPROFILE || os.homedir(), 'Downloads');
}

export function nextExportFilename(existingNames) {
  let maximum = 500;
  for (const name of existingNames) {
    const match = String(name).match(/^F(\d+)\.xlsx$/i);
    if (!match) continue;
    maximum = Math.max(maximum, Number.parseInt(match[1], 10));
  }
  return `F${maximum + 1}.xlsx`;
}
import os from 'node:os';
import path from 'node:path';
