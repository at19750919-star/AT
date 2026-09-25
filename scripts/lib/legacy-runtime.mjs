import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toggle: (name, force) => {
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    },
  };
}

function createElement(id = '') {
  const element = {
    id,
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    classList: createClassList(),
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter((item) => item !== child); },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    contains() { return false; },
    click() {},
    focus() {},
    setAttribute(name, value) { this[name] = String(value); },
    getAttribute(name) { return this[name] ?? null; },
  };
  return element;
}

function createDocument() {
  const elements = new Map();
  const initial = {
    generateBtn: '',
    stopGenerateBtn: '',
    btnAutoColor: '',
    btnExportCombined: '',
    floatingAssistant: '',
    logArea: '',
    roundsBody: '',
    generatingOverlay: '',
    generatingText: '',
    avgRecoveryLimit: '4',
    range16Limit: '',
    maxSideLimit: '5',
    maxTieLimit: '',
    maxFourCardRate: '39',
    max7PtReversal: '2',
    swapBanker6Target: '2',
    skipBanker6: '',
    lastCardNine: '',
  };
  for (const [id, value] of Object.entries(initial)) {
    const element = createElement(id);
    element.value = value;
    elements.set(id, element);
  }
  elements.get('skipBanker6').checked = false;
  elements.get('lastCardNine').checked = false;

  const selectedSuits = ['♠', '♥', '♦', '♣'].map((value) => {
    const element = createElement();
    element.dataset.value = value;
    element.value = value;
    return element;
  });
  const selectedRanks = ['A', '2'].map((value) => {
    const element = createElement();
    element.dataset.value = value;
    element.value = value;
    element.checked = true;
    return element;
  });

  const queryAll = (selector) => {
    if (selector === '.suit-button.selected' || selector === '.suit-checkbox:checked') return selectedSuits;
    if (selector === '.rank-button.selected' || selector === '.rank-checkbox:checked') return selectedRanks;
    return [];
  };

  const document = {
    readyState: 'loading',
    body: createElement('body'),
    head: createElement('head'),
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => createElement(tag),
    querySelector: () => null,
    querySelectorAll: queryAll,
    addEventListener() {},
    removeEventListener() {},
  };
  return { document, elements };
}

export function applyGenerationLimits(document, limits = {}) {
  if (!document || !limits || typeof limits !== 'object') return;
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  };
  if ('avgRecoveryLimit' in limits) setVal('avgRecoveryLimit', limits.avgRecoveryLimit);
  if ('maxTieLimit' in limits) setVal('maxTieLimit', limits.maxTieLimit);
  if ('maxFourCardRate' in limits) setVal('maxFourCardRate', limits.maxFourCardRate);
  if ('maxSideLimit' in limits) setVal('maxSideLimit', limits.maxSideLimit);
  if ('max7PtReversal' in limits) setVal('max7PtReversal', limits.max7PtReversal);
  if ('swapBanker6Target' in limits) setVal('swapBanker6Target', limits.swapBanker6Target);
  if ('skipBanker6' in limits) {
    const el = document.getElementById('skipBanker6');
    if (el) el.checked = Boolean(limits.skipBanker6);
  }
}

function resolveRoot(projectRoot) {
  if (projectRoot instanceof URL) return fileURLToPath(projectRoot);
  return path.resolve(String(projectRoot));
}

export async function createLegacyRuntime({ projectRoot, silent = false, randomSeed, limits } = {}) {
  const root = resolveRoot(projectRoot);
  const { document } = createDocument();
  const logs = [];
  const consoleProxy = silent
    ? { log() {}, info() {}, warn() {}, error() {} }
    : console;

  const localValues = new Map([
    ['card_color_mixed_mode', '0'],
    ['signal_config', JSON.stringify({ suits: ['♠', '♥', '♦', '♣'], ranks: ['A', '2'] })],
  ]);
  const seededRandom = randomSeed === undefined
    ? Math.random
    : (() => {
        let state = Number(randomSeed) >>> 0;
        return () => {
          state = (state * 1664525 + 1013904223) >>> 0;
          return state / 0x100000000;
        };
      })();
  const math = Object.create(Math);
  math.random = seededRandom;

  const context = vm.createContext({
    console: consoleProxy,
    document,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    Blob,
    URL,
    Math: math,
    Date,
    JSON,
    Promise,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Set,
    Map,
    Error,
    TypeError,
    parseInt,
    parseFloat,
    isNaN,
    localStorage: {
      getItem(key) { return localValues.get(key) ?? null; },
      setItem(key, value) { localValues.set(key, String(value)); },
      removeItem(key) { localValues.delete(key); },
    },
    alert() {},
    confirm() { return false; },
    navigator: {},
    location: { href: '' },
    __cliLogs: logs,
  });
  context.window = context;
  context.globalThis = context;

  for (const filename of ['signals.js', 'shoe_cut.js', 'signals_ui.js']) {
    const source = await fs.readFile(path.join(root, filename), 'utf8');
    vm.runInContext(source, context, { filename });
  }

  vm.runInContext(`
    function cliManualColorFix(rounds) {
      const maxEditableIndex = 84;
      const patterns = [['B', 'B', 'B', 'R'], ['R', 'R', 'R', 'B']];
      const point = (card) => {
        if (!card) return -1;
        if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
        if (card.rank === 'A') return 1;
        return Number.parseInt(card.rank, 10);
      };
      const signal = (card) => Boolean(card && (card.rank === 'A' || card.rank === '2'));
      const violating = collectCardColorViolationRounds(rounds).map((roundNo) => roundNo - 1);

      for (const targetRoundIndex of violating) {
        if (targetRoundIndex > maxEditableIndex) continue;
        const targetRound = rounds[targetRoundIndex];
        if (!targetRound || targetRound.cards.length < 4) continue;

        const rankedPatterns = patterns
          .map((pattern) => ({
            pattern,
            mismatches: pattern.reduce(
              (count, color, index) => count + (targetRound.cards[index].back_color === color ? 0 : 1),
              0,
            ),
          }))
          .sort((a, b) => a.mismatches - b.mismatches);

        for (const { pattern } of rankedPatterns) {
          const plan = [];
          const reserved = new Set();
          let possible = true;

          for (let cardIndex = 0; cardIndex < 4; cardIndex++) {
            const targetCard = targetRound.cards[cardIndex];
            const neededColor = pattern[cardIndex];
            if (targetCard.back_color === neededColor) continue;

            let donor = null;
            for (let roundIndex = 0; roundIndex <= Math.min(maxEditableIndex, rounds.length - 1); roundIndex++) {
              const donorRound = rounds[roundIndex];
              if (!donorRound || !Array.isArray(donorRound.cards)) continue;
              for (const donorIndex of [4, 5]) {
                const key = roundIndex + ':' + donorIndex;
                if (reserved.has(key)) continue;
                const donorCard = donorRound.cards[donorIndex];
                if (!donorCard || donorCard.back_color !== neededColor) continue;
                if (point(donorCard) !== point(targetCard)) continue;
                if (signal(donorCard) !== signal(targetCard)) continue;
                donor = { r: roundIndex, c: donorIndex };
                reserved.add(key);
                break;
              }
              if (donor) break;
            }

            if (!donor) {
              possible = false;
              break;
            }
            plan.push({ target: { r: targetRoundIndex, c: cardIndex }, donor });
          }

          if (!possible) continue;
          for (const swap of plan) swapCards_Internal(rounds, swap.target, swap.donor);
          break;
        }
      }
      return rounds;
    }
  `, context);

  applyGenerationLimits(document, limits);

  const snapshot = (includeExportData = false) => {
    const exportFields = includeExportData
      ? `,
      previewGrid: buildPreviewGrid(flattenDeckFromRounds(currentRounds), currentRounds),
      recovery: analyzeShoeRecovery(currentRounds)`
      : '';
    const json = vm.runInContext(`JSON.stringify((() => {
      const sIndexes = new Set(compute_sidx_for_segment(currentRounds, 'A'));
      return {
      rounds: currentRounds.map((round, index) => ({
        segment: round.segment || '',
        result: round.result || '',
        sensitive: Boolean(round.sensitive),
        isT: Boolean(round.isT),
        signal: round.isT ? 'T' : (sIndexes.has(index) ? 'S' : ''),
        cards: round.cards.map((card) => ({
          rank: card.rank,
          suit: card.suit,
          pos: card.pos,
          back_color: card.back_color,
        })),
      })),
      stats: checkViolationsBeforeExport().stats
      ${exportFields}
      };
    })())`, context);
    return JSON.parse(json);
  };

  return {
    async getDeckSize() {
      return vm.runInContext('build_shuffled_deck().length', context);
    },
    async generateOne() {
      await vm.runInContext('generateShoe()', context);
      return snapshot();
    },
    async applyAutoColorFix() {
      vm.runInContext('currentRounds = runAutoColorSwap_Signal(currentRounds)', context);
      return snapshot();
    },
    async applyManualColorFix() {
      vm.runInContext('currentRounds = cliManualColorFix(currentRounds)', context);
      return snapshot();
    },
    async applyLastCardNine() {
      const adjusted = vm.runInContext(`(() => {
        const result = rotateShoeAfterEndingNine(currentRounds);
        if (!result) return false;
        currentRounds = result.rounds;
        currentAnalysis = analyze_signal_cards(currentRounds, { mutate: false });
        return true;
      })()`, context);
      return adjusted ? snapshot() : null;
    },
    async getExportData() {
      return snapshot(true);
    },
  };
}
