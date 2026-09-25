const NON_COLOR_KEYS = [
  'signal',
  'consecutiveFour',
  'consecutiveSide',
  'unswappable',
  'other',
];

function countFromText(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text || text === '無') return 0;
  const match = text.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

export function normalizeViolationStats(raw) {
  return {
    color: countFromText(raw['卡色違規']),
    signal: countFromText(raw['訊號牌違規']),
    consecutiveFour: countFromText(raw['連續5局4張']),
    consecutiveSide: countFromText(raw['連續莊閒']),
    unswappable: countFromText(raw['無法對調']),
    other: countFromText(raw['其他違規']),
  };
}

export function decideViolationAction(stats, options = {}) {
  if (NON_COLOR_KEYS.some((key) => Number(stats[key] || 0) > 0)) {
    return 'regenerate';
  }

  const colorCount = Number(stats.color || 0);
  if (colorCount === 0) return 'accept';
  if (colorCount <= 3) return 'manual-color-fix';
  return options.autoColorFixUsed ? 'regenerate' : 'auto-color-fix';
}
