import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ExcelJS from 'exceljs';

const source = readFileSync(new URL('../signals.js', import.meta.url), 'utf8');
const fn = source.match(/async function importRoundsFromExcel\([^]*?^\}/m)[0];
async function file(sheet = '原始數據', populated = true) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheet);
    ws.addRow(['局', '段標', '色序', '卡片1', '卡片2', '卡片3', '卡片4', '卡片5', '卡片6', '結果']);
    if (populated) ws.addRow([1, 'A', 'RRBB', '4♥', '4♣', '4♦', '4♠', '', '', '和']);
    const buffer = await wb.xlsx.writeBuffer();
    return { name: '測試.xlsx', arrayBuffer: async () => buffer };
}
function setup({ busy = false, recoveryFails = false, excel = ExcelJS } = {}) {
    const events = [];
    const original = [{ cards: ['old'] }];
    const context = {
        ExcelJS: excel, currentRounds: original, window: {}, console: { error() {}, warn() {} }, log() {},
        importFeedback: {
            begin() { if (busy) return false; busy = true; return true; },
            async stage(title) { events.push(title); },
            finish(...args) { busy = false; events.push(args); }
        },
        parseCardLabel(label, pos) { return { label, pos }; },
        computeRoundResult() { return { result: '和' }; },
        refreshAnalysisAndRender() { events.push('rendered'); },
        setEditButtonsAvailability() {}, resetEditState() {},
        buildStatsFromRounds() { return { bankerCount: 0, playerCount: 0, tieCount: 1 }; },
        analyzeShoeRecovery() { if (recoveryFails) throw Error('test'); return {}; },
        updateRecoveryDisplay() {}
    };
    const run = runInNewContext(`${fn}\nimportRoundsFromExcel`, context);
    return { run, events, context, original, isBusy: () => busy };
}
test('完成提示出現在主表格渲染之後，包含局數與張數', async () => {
    const api = setup();
    assert.equal(await api.run(await file()), true);
    assert.equal(api.events.at(-1)[0], 'success');
    assert.match(api.events.at(-1)[2], /1 局、4 張牌/);
    assert.ok(api.events.indexOf('rendered') < api.events.indexOf('牌局已顯示，正在計算回復統計…'));
    assert.equal(api.isBusy(), false);
});
test('缺工作表、空檔、壞檔、元件未載入均顯示失敗並允許重試', async () => {
    for (const [input, opts] of [
        [await file('錯誤工作表'), {}], [await file('原始數據', false), {}],
        [{ name: '壞檔.xlsx', arrayBuffer: async () => Buffer.from('broken') }, {}],
        [await file(), { excel: undefined }]
    ]) {
        const api = setup(opts);
        // setup 預設參數會補 ExcelJS，明確移除以測試元件載入失敗。
        if ('excel' in opts) api.context.ExcelJS = undefined;
        assert.equal(await api.run(input), false);
        assert.equal(api.events.at(-1)[0], 'error');
        assert.equal(api.context.currentRounds, api.original);
        assert.equal(api.isBusy(), false);
    }
});
test('統計失敗不假裝整個匯入失敗，忙碌中不重複匯入', async () => {
    const warning = setup({ recoveryFails: true });
    assert.equal(await warning.run(await file()), true);
    assert.equal(warning.events.at(-1)[0], 'warning');
    const busy = setup({ busy: true });
    assert.equal(await busy.run(await file()), false);
    assert.equal(busy.context.currentRounds, busy.original);
    assert.equal(busy.events.length, 0);
});
