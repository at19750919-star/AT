import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';

const HEADERS = [
  '局號', '段標', '色序', '卡片1', '卡片2', '卡片3', '卡片4', '卡片5', '卡片6',
  '結果', '莊', '閒', '訊號', '對調莊', '對調閒',
];
const SHEET_NAMES = ['預覽', '原始數據', '直立式牌靴', '回復分析統計'];
const PREVIEW_COLS = 21;
const PREVIEW_ROWS = 31;
const PREVIEW_GROUP = 7;

function point(card) {
  if (!card) return 0;
  if (card.rank === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
  return Number.parseInt(card.rank, 10) || 0;
}

function computeRoundHands(cards) {
  if (!Array.isArray(cards) || cards.length < 4) return { bankerTotal: '', playerTotal: '' };
  let index = 0;
  const draw = () => cards[index++] || null;
  const player = [draw()];
  const banker = [draw()];
  player.push(draw());
  banker.push(draw());
  let playerTotal = (point(player[0]) + point(player[1])) % 10;
  let bankerTotal = (point(banker[0]) + point(banker[1])) % 10;
  if (playerTotal < 8 && bankerTotal < 8) {
    if (playerTotal <= 5) {
      const playerThird = draw();
      if (playerThird) {
        const thirdPoint = point(playerThird);
        playerTotal = (playerTotal + thirdPoint) % 10;
        const bankerDraws = bankerTotal <= 2
          || (bankerTotal === 3 && thirdPoint !== 8)
          || (bankerTotal === 4 && [2, 3, 4, 5, 6, 7].includes(thirdPoint))
          || (bankerTotal === 5 && [4, 5, 6, 7].includes(thirdPoint))
          || (bankerTotal === 6 && [6, 7].includes(thirdPoint));
        if (bankerDraws) {
          const bankerThird = draw();
          if (bankerThird) bankerTotal = (bankerTotal + point(bankerThird)) % 10;
        }
      }
    } else if (bankerTotal <= 5) {
      const bankerThird = draw();
      if (bankerThird) bankerTotal = (bankerTotal + point(bankerThird)) % 10;
    }
  }
  return { bankerTotal, playerTotal };
}

function cardLabel(card) {
  if (!card) return '';
  return `${card.rank === '10' ? 'T' : card.rank}${card.suit}`;
}

function roundRow(round, index) {
  const cards = Array.isArray(round.cards) ? round.cards : [];
  const normal = computeRoundHands(cards);
  const swappedCards = cards.map((card) => ({ ...card }));
  if (swappedCards.length >= 2) [swappedCards[0], swappedCards[1]] = [swappedCards[1], swappedCards[0]];
  const swapped = computeRoundHands(swappedCards);
  return [
    index + 1,
    round.segment || '',
    cards.map((card) => card.back_color || '').join(''),
    ...Array.from({ length: 6 }, (_, cardIndex) => cardLabel(cards[cardIndex])),
    round.result || '',
    normal.bankerTotal,
    normal.playerTotal,
    round.signal || (round.isT ? 'T' : ''),
    swapped.bankerTotal,
    swapped.playerTotal,
  ];
}

function fallbackPreviewGrid(rounds) {
  const grid = Array.from({ length: PREVIEW_COLS * PREVIEW_ROWS }, () => ({ className: 'cell', value: '' }));
  rounds.slice(0, PREVIEW_ROWS * 3).forEach((round, roundIndex) => {
    const base = Math.floor(roundIndex / 3) * PREVIEW_COLS + (roundIndex % 3) * PREVIEW_GROUP;
    const result = round.result === '莊' ? ['O', 'result-banker']
      : round.result === '閒' ? ['X', 'result-player']
        : round.result === '和' ? ['和', 'result-tie'] : ['', ''];
    grid[base] = { className: `cell result-cell ${result[1]}`.trim(), value: result[0] };
    (round.cards || []).slice(0, 6).forEach((card, cardIndex) => {
      const classes = ['cell', card.back_color === 'R' ? 'card-red' : 'card-blue'];
      if (['A', '2'].includes(card.rank)) classes.push('signal-match');
      if (round.segment) classes.push(`segment-${round.segment.toLowerCase()}`);
      grid[base + cardIndex + 1] = { className: classes.join(' '), value: point(card) };
    });
  });
  return grid;
}

function addPreviewSheet(workbook, shoe) {
  const sheet = workbook.addWorksheet('預覽');
  sheet.properties.defaultRowHeight = 56;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
    margins: { left: 0.15, right: 0.15, top: 0.15, bottom: 0.15, header: 0, footer: 0 },
    printArea: 'A1:W31',
  };
  for (let column = 0; column < PREVIEW_COLS; column++) {
    sheet.getColumn(column + 1 + Math.floor(column / PREVIEW_GROUP)).width = 9;
    if ((column + 1) % PREVIEW_GROUP === 0 && column < PREVIEW_COLS - 1) {
      sheet.getColumn(column + 2 + Math.floor(column / PREVIEW_GROUP)).width = 1.5;
    }
  }

  const grid = (shoe.previewGrid?.length ? shoe.previewGrid : fallbackPreviewGrid(shoe.rounds)).slice(0, PREVIEW_COLS * PREVIEW_ROWS);
  while (grid.length < PREVIEW_COLS * PREVIEW_ROWS) grid.push({ className: 'cell', value: '' });
  const thin = { style: 'thin', color: { argb: 'FF333333' } };
  const bold = { style: 'medium', color: { argb: 'FFFF4D4F' } };
  for (let row = 0; row < PREVIEW_ROWS; row++) {
    for (let column = 0; column < PREVIEW_COLS; column++) {
      const sheetColumn = column + 1 + Math.floor(column / PREVIEW_GROUP);
      const data = grid[row * PREVIEW_COLS + column];
      const cell = sheet.getCell(row + 1, sheetColumn);
      const classes = data.className || '';
      cell.value = data.value || '';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Microsoft JhengHei', size: 36, bold: true, color: { argb: 'FF000000' } };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      if (classes.includes('result-')) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      else if (classes.includes('card-red')) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      else if (classes.includes('card-blue')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00CFCF' } };
        cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
      }
      if (classes.includes('signal-match')) cell.font = { ...cell.font, color: { argb: 'FFDC3545' } };
      if (classes.includes('result-banker')) cell.font = { ...cell.font, color: { argb: 'FFCC0000' } };
      else if (classes.includes('result-player')) cell.font = { ...cell.font, color: { argb: 'FF0033AA' } };
      else if (classes.includes('result-tie')) cell.font = { ...cell.font, color: { argb: 'FF006633' } };
      if (classes.includes('tbox-left')) cell.border.left = bold;
      if (classes.includes('tbox-right')) cell.border.right = bold;
      if (classes.includes('tbox-top')) cell.border.top = bold;
      if (classes.includes('tbox-bottom')) cell.border.bottom = bold;
    }
  }
}

function addRawSheet(workbook, shoe) {
  const sheet = workbook.addWorksheet('原始數據');
  sheet.addRow(HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
  shoe.rounds.forEach((round, index) => sheet.addRow(roundRow(round, index)));
  sheet.columns.forEach((column) => { column.width = 12; });
  sheet.eachRow((row) => row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...(cell.font || {}), size: 14 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }));
}

function addVerticalSheet(workbook, shoe) {
  const sheet = workbook.addWorksheet('直立式牌靴');
  const cards = shoe.rounds.flatMap((round) => round.cards || []);
  cards.forEach((card, index) => {
    const row = sheet.addRow([index + 1, cardLabel(card)]);
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).font = { size: 11 };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).font = { size: 16, bold: true, color: { argb: ['A', '2'].includes(card.rank) ? 'FFDC3545' : 'FF000000' } };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.back_color === 'R' ? 'FFFFFF00' : 'FF00FFFF' } };
  });
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 10;
}

function addRecoverySheet(workbook, shoe) {
  const sheet = workbook.addWorksheet('回復分析統計');
  const counts = [4, 5, 6].map((length) => shoe.rounds.filter((round) => (round.cards || []).length === length).length);
  const total = shoe.rounds.length;
  sheet.addRow(['局數統計', '局數', '比例', '備註']);
  counts.forEach((count, index) => sheet.addRow([`${index + 4}張局`, count, `${(total ? count / total * 100 : 0).toFixed(1)}%`, `${count}/${total}`]));
  sheet.addRow([]);
  const detailHeader = sheet.addRow(['切牌點位置', '回復局數', '消耗牌數', '是否立即回復']);
  detailHeader.font = { bold: true };
  detailHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
  (shoe.recovery?.recoveryDetails || []).forEach((detail) => sheet.addRow([
    detail.cutPoint + 1,
    detail.roundsUsed,
    detail.cardsUsed,
    detail.immediate ? '是' : (detail.failed ? '失敗' : '否'),
  ]));
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 15;
}

export async function writeShoeWorkbook({ shoe, outputPath }) {
  const workbook = new ExcelJS.Workbook();
  addPreviewSheet(workbook, shoe);
  addRawSheet(workbook, shoe);
  addVerticalSheet(workbook, shoe);
  addRecoverySheet(workbook, shoe);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  return { workbook, outputPath };
}

export async function verifyShoeWorkbook({ shoe, outputPath, expectedLastRank }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outputPath);
  const names = workbook.worksheets.map((sheet) => sheet.name);
  if (names.join('|') !== SHEET_NAMES.join('|')) throw new Error('導出檔的四個工作表名稱或順序不正確');
  const sheet = workbook.getWorksheet('原始數據');
  const expected = [HEADERS, ...shoe.rounds.map(roundRow)];
  for (let row = 0; row < expected.length; row++) {
    for (let column = 0; column < HEADERS.length; column++) {
      const actualValue = sheet.getCell(row + 1, column + 1).value ?? '';
      if (String(actualValue) !== String(expected[row][column] ?? '')) {
        throw new Error(`導出內容不一致：第 ${row + 1} 列「${HEADERS[column]}」`);
      }
    }
  }
  const cards = shoe.rounds.reduce((total, round) => total + (round.cards || []).length, 0);
  if (expectedLastRank) {
    const lastCard = workbook.getWorksheet('直立式牌靴').getCell(cards, 2).value;
    if (cards !== 416 || !String(lastCard || '').startsWith(expectedLastRank)) {
      throw new Error(`導出驗證失敗：第 416 張不是 ${expectedLastRank}`);
    }
  }
  return { rounds: shoe.rounds.length, cards };
}
