import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../signals_ui.js', import.meta.url), 'utf8');
const cutSource = source.slice(0, source.indexOf('// 以下是原本的 signals_ui.js 內容'));
class Card {
  constructor(rank, suit, pos) { Object.assign(this, { rank, suit, pos, back_color: 'R' }); }
  point() { return this.rank >= 10 ? 0 : this.rank; }
  clone() { return Object.assign(new Card(this.rank, this.suit, this.pos), this); }
}
const cards = ranks => ranks.map((rank, i) => new Card(rank, 'S', i));
function harness(rounds = []) {
  return runInNewContext(`${cutSource}\n({
    simulate: simulateRoundsFromDeckPure, cut: performCut, save: saveOriginalDeckOrder,
    rounds: () => currentRounds
  })`, { currentRounds: rounds, Card, log() {}, document: { getElementById() { return null; } }, console });
}

test('尾端不足一局或缺補牌時，仍保留所有牌並標為殘牌', () => {
  const { simulate } = harness();
  const cases = [[1], [1, 2], [1, 2, 3], [1, 1, 1, 1], [1, 1, 1, 1, 1], [3, 1, 3, 1]];
  for (const tail of cases) {
    const deck = cards([4, 4, 4, 4, ...tail]);
    const rounds = simulate(deck);
    assert.equal(rounds.flatMap(r => r.cards).length, deck.length, `尾牌 ${tail}`);
    assert.equal(rounds[0].result, '和');
    assert.equal(rounds.at(-1).result, '殘牌');
    assert.equal(rounds.at(-1).start_index, 4);
    assert.deepEqual(Array.from(rounds.flatMap(r => r.cards)), deck);
    assert.equal(simulate(cards(tail)).at(-1).result, '殘牌');
  }
  assert.equal(simulate(cards([4, 4, 4, 4])).length, 1);
  assert.equal(simulate([]).length, 0);
});

test('416 個切牌位置均保留全部牌、正確順序和顏色，重新套用與恢復也不丟牌', () => {
  const deck = cards(Array.from({ length: 416 }, (_, i) => i % 13 + 1));
  deck.forEach((c, i) => { c.back_color = i % 2 ? 'B' : 'R'; });
  const original = Array.from({ length: 104 }, (_, i) => ({ cards: deck.slice(i * 4, i * 4 + 4), result: '和', start_index: i * 4 }));
  const api = harness(original);
  const key = c => `${c.rank}/${c.suit}/${c.back_color}`;
  assert.equal(api.save(), true);
  for (let cut = 1; cut < 416; cut++) {
    assert.equal(api.cut(cut), true);
    const actual = Array.from(api.rounds().flatMap(r => r.cards));
    const expected = deck.slice(cut).concat(deck.slice(0, cut));
    assert.equal(actual.length, 416, `切 ${cut} 張`);
    assert.deepEqual(actual.map(key), expected.map(key));
    assert.deepEqual(actual.map(c => c.pos), Array.from({ length: 416 }, (_, i) => i));
  }
  assert.equal(api.cut(0), true);
  assert.deepEqual(Array.from(api.rounds().flatMap(r => r.cards), key), deck.map(key));
  assert.equal(api.cut(1), true);
  assert.equal(api.save(), true);
  assert.equal(api.cut(1), true);
  assert.deepEqual(Array.from(api.rounds().flatMap(r => r.cards), key), deck.slice(2).concat(deck.slice(0, 2)).map(key));
});
