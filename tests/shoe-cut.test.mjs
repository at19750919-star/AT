import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../shoe_cut.js', import.meta.url), 'utf8');
const rotateShoeAfterEndingNine = runInNewContext(`${source}\nrotateShoeAfterEndingNine`);
const round = (cards, result = '莊') => ({ cards, result });
const card = (rank, pos) => ({ rank, pos, back_color: 'R', clone() { return { rank: this.rank, pos: this.pos }; } });

test('從末張 9 的下一局開始，全部 416 張保留且末張為 9', () => {
    const ranks = Array.from({ length: 416 }, (_, i) => String(i % 13 + 1));
    ranks[20] = '9';
    ranks[415] = 'K';
    const cards = ranks.map((rank, pos) => card(rank, pos));
    const original = [round(cards.slice(0, 21), '閒'), round(cards.slice(21), '和')];
    const result = rotateShoeAfterEndingNine(original);

    assert.equal(result.sourceRound, 1);
    assert.equal(result.rounds[0].cards[0].rank, cards[21].rank);
    assert.equal(result.rounds[0].result, '和');
    const rotated = result.rounds.flatMap(r => r.cards);
    assert.equal(rotated.length, 416);
    assert.equal(rotated[415].rank, '9');
    assert.deepEqual(rotated.map(c => c.pos), Array.from({ length: 416 }, (_, i) => i));
    assert.notEqual(rotated[0], cards[21]);
    assert.equal(cards[21].pos, 21);
    assert.equal(rotated[0].back_color, 'R');
});

test('沒有末張 9 或牌數不完整時不調整', () => {
    const cards = Array.from({ length: 416 }, (_, pos) => card('A', pos));
    assert.equal(rotateShoeAfterEndingNine([round(cards)]), null);
    cards[415].rank = '9';
    assert.equal(rotateShoeAfterEndingNine([round(cards.slice(0, 415))]), null);
});
