// ============================================================
// 穿越掃描器 (Traverse Scanner)
// 掃描牌靴中所有符合穿越條件的區段
// ============================================================
//
// 穿越定義：
// - 一個區段（例如第 X 張到第 Y 張）
// - 不管從區段內的第幾張開始發牌（依照百家樂補牌規則）
// - 最後一局的最後一張都會剛好落在區段的最後一張
// - 豁免條件：剩餘 1, 2, 3, 7 張時不檢查
//   - 1, 2, 3 張：不足一局（至少需要4張）
//   - 7 張：足一局但不足兩局（一局最多6張）
//
// 使用方式：
// 1. 在網頁中生成牌靴後
// 2. 在瀏覽器 Console 執行: scanTraverse() 或 scanTraverse(6, 18)
// 3. 或點擊「穿越掃描」按鈕
// ============================================================

// 豁免規則：剩餘這些張數時不檢查
const TRAVERSE_ALLOWED_RESIDUE = new Set([1, 2, 3, 7]);

/**
 * 模擬單局百家樂，返回使用的牌數
 * @param {Array} deck - 牌組
 * @param {number} start - 起始位置
 * @returns {number|null} - 結束位置（包含），或 null 表示無法完成
 */
function traverseSimulateRound(deck, start) {
    if (start + 3 >= deck.length) return null;
    
    let idx = start;
    
    // 取得點數的輔助函數
    const getPoint = (card) => {
        if (!card) return 0;
        if (typeof card.point === 'function') return card.point();
        const values = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 0, 'J': 0, 'Q': 0, 'K': 0};
        return values[card.rank] || 0;
    };
    
    // 前四張牌
    const p1 = getPoint(deck[idx++]);
    const b1 = getPoint(deck[idx++]);
    const p2 = getPoint(deck[idx++]);
    const b2 = getPoint(deck[idx++]);
    
    let p_tot = (p1 + p2) % 10;
    let b_tot = (b1 + b2) % 10;
    
    // 天牌檢查
    const natural = (p_tot >= 8 || b_tot >= 8);
    
    if (!natural) {
        // 閒家補牌規則
        if (p_tot <= 5) {
            if (idx >= deck.length) return null;
            const p3 = getPoint(deck[idx++]);
            p_tot = (p_tot + p3) % 10;
            
            // 莊家補牌規則（根據閒家第三張）
            let bankerDraws = false;
            if (b_tot <= 2) {
                bankerDraws = true;
            } else if (b_tot === 3 && p3 !== 8) {
                bankerDraws = true;
            } else if (b_tot === 4 && [2,3,4,5,6,7].includes(p3)) {
                bankerDraws = true;
            } else if (b_tot === 5 && [4,5,6,7].includes(p3)) {
                bankerDraws = true;
            } else if (b_tot === 6 && [6,7].includes(p3)) {
                bankerDraws = true;
            }
            
            if (bankerDraws) {
                if (idx >= deck.length) return null;
                idx++;
            }
        } else if (b_tot <= 5) {
            // 閒家不補，莊家補
            if (idx >= deck.length) return null;
            idx++;
        }
    }
    
    return idx - 1; // 返回結束位置（包含）
}

/**
 * 檢查區段是否符合穿越條件
 * @param {Array} deck - 完整牌組
 * @param {number} segStart - 區段起始位置
 * @param {number} segEnd - 區段結束位置
 * @returns {boolean} - 是否符合穿越條件
 */
function checkTraverse(deck, segStart, segEnd) {
    // 從區段內的每個位置開始檢查
    for (let p = segStart; p <= segEnd; p++) {
        const remaining = segEnd - p + 1; // 剩餘張數
        
        // 豁免條件
        if (TRAVERSE_ALLOWED_RESIDUE.has(remaining)) {
            continue;
        }
        
        // 從位置 p 開始，模擬到區段結束
        let cur = p;
        let success = false;
        
        while (cur <= segEnd) {
            const roundEnd = traverseSimulateRound(deck, cur);
            
            if (roundEnd === null) {
                // 無法完成一局
                return false;
            }
            
            if (roundEnd > segEnd) {
                // 超出區段範圍
                return false;
            }
            
            cur = roundEnd + 1;
            
            if (cur === segEnd + 1) {
                // 剛好落在區段最後一張
                success = true;
                break;
            }
        }
        
        if (!success && cur <= segEnd) {
            return false;
        }
    }
    
    return true;
}

/**
 * 取得區段內從起點開始的各局資訊
 * @param {Array} deck - 完整牌組
 * @param {number} segStart - 區段起始位置
 * @param {number} segEnd - 區段結束位置
 * @returns {Array} - 各局的 [起始, 結束] 陣列
 */
function getTraverseRounds(deck, segStart, segEnd) {
    const rounds = [];
    let cur = segStart;
    
    while (cur <= segEnd) {
        const roundEnd = traverseSimulateRound(deck, cur);
        if (roundEnd === null || roundEnd > segEnd) break;
        rounds.push([cur, roundEnd]);
        cur = roundEnd + 1;
    }
    
    return rounds;
}

/**
 * 從 currentRounds 提取完整牌組
 * @returns {Array} - 牌組陣列
 */
function extractDeckForTraverse() {
    if (typeof currentRounds === 'undefined' || !Array.isArray(currentRounds)) {
        console.error('currentRounds 不存在，請先生成牌靴');
        return [];
    }
    
    const deck = [];
    currentRounds.forEach(round => {
        if (round && Array.isArray(round.cards)) {
            round.cards.forEach(card => {
                if (card) deck.push(card);
            });
        }
    });
    
    return deck;
}

/**
 * 掃描牌靴中所有符合穿越條件的區段
 * @param {number} minLength - 最小區段長度（預設 6）
 * @param {number} maxLength - 最大區段長度（預設 18）
 * @returns {Array} - 符合條件的區段列表
 */
function scanTraverse(minLength = 6, maxLength = 18) {
    const deck = extractDeckForTraverse();
    
    if (deck.length === 0) {
        log('請先生成牌靴再進行穿越掃描', 'error');
        return [];
    }
    
    const deckSize = deck.length;
    const results = [];
    let checkedCount = 0;
    
    console.log(`開始穿越掃描：牌靴共 ${deckSize} 張，掃描長度 ${minLength}-${maxLength}`);
    
    for (let start = 0; start < deckSize; start++) {
        for (let end = start + minLength - 1; end < Math.min(start + maxLength, deckSize); end++) {
            checkedCount++;
            
            if (checkTraverse(deck, start, end)) {
                const length = end - start + 1;
                const rounds = getTraverseRounds(deck, start, end);
                
                // 取得牌面字串
                const cardStr = deck.slice(start, end + 1).map(c => {
                    if (typeof c.short === 'function') return c.short();
                    return `${c.rank}${c.suit}`;
                }).join(' ');
                
                results.push({
                    start: start,           // 0-indexed
                    end: end,               // 0-indexed
                    startPos: start + 1,    // 1-indexed（顯示用）
                    endPos: end + 1,        // 1-indexed（顯示用）
                    length: length,
                    rounds: rounds,
                    roundCount: rounds.length,
                    cards: cardStr
                });
            }
        }
    }
    
    console.log(`掃描完成：共檢查 ${checkedCount} 個區段組合，找到 ${results.length} 個符合穿越條件`);
    
    // 過濾重複區段：移除子集，只保留最長的區段
    const filteredResults = [];
    for (let i = 0; i < results.length; i++) {
        const current = results[i];
        let isSubset = false;
        
        // 檢查是否為其他區段的子集
        for (let j = 0; j < results.length; j++) {
            if (i === j) continue;
            const other = results[j];
            
            // 如果 current 的範圍完全包含在 other 中，則是子集
            if (current.start >= other.start && current.end <= other.end && 
                (current.start !== other.start || current.end !== other.end)) {
                isSubset = true;
                break;
            }
        }
        
        if (!isSubset) {
            filteredResults.push(current);
        }
    }
    
    console.log(`過濾後剩餘 ${filteredResults.length} 個獨立區段（已移除子集）`);
    
    // 輸出結果到 console 和 log
    if (filteredResults.length > 0) {
        log(`穿越掃描完成：找到 ${filteredResults.length} 個符合條件的區段`, 'success');
        
        // 依長度統計
        const lengthStats = {};
        filteredResults.forEach(seg => {
            lengthStats[seg.length] = (lengthStats[seg.length] || 0) + 1;
        });
        
        console.log('=== 依長度統計 ===');
        Object.keys(lengthStats).sort((a, b) => a - b).forEach(len => {
            console.log(`  ${len} 張: ${lengthStats[len]} 個`);
        });
        
        // 顯示前5個區段詳細資訊
        console.log('\n=== 前 5 個區段詳細資訊 ===');
        filteredResults.slice(0, 5).forEach((seg, i) => {
            console.log(`\n[${i + 1}] 位置: 第 ${seg.startPos} ~ ${seg.endPos} 張 (長度: ${seg.length})`);
            console.log(`    牌面: ${seg.cards}`);
            console.log(`    可打 ${seg.roundCount} 局`);
            seg.rounds.forEach((r, j) => {
                console.log(`      第${j + 1}局: 位置 ${r[0] + 1}-${r[1] + 1} (${r[1] - r[0] + 1}張)`);
            });
        });
        
        if (filteredResults.length > 5) {
            console.log(`\n... 還有 ${filteredResults.length - 5} 個區段`);
        }
    } else {
        log('穿越掃描完成：沒有找到符合條件的區段', 'warn');
    }
    
    // 儲存結果供後續使用
    window.traverseResults = filteredResults;
    
    return filteredResults;
}

/**
 * 顯示穿越掃描結果的對話框
 */
function showTraverseDialog() {
    const results = window.traverseResults;
    
    if (!results || results.length === 0) {
        alert('請先執行穿越掃描 (在 Console 輸入 scanTraverse())');
        return;
    }
    
    // 建立對話框（固定在右側日誌上方）
    let dialog = document.getElementById('traverseDialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'traverseDialog';
        dialog.innerHTML = `
            <div class="traverse-dialog-content">
                <div class="traverse-dialog-header" style="cursor: move;">
                    <h3>穿越掃描結果 <span style="font-size: 12px; color: #999;">(可拖動)</span></h3>
                    <button class="traverse-dialog-close">&times;</button>
                </div>
                <div class="traverse-dialog-body">
                    <div class="traverse-stats"></div>
                    <div class="traverse-list"></div>
                </div>
            </div>
        `;
        
        // 加入樣式
        document.body.appendChild(dialog);
        
        // 關閉事件
        dialog.querySelector('.traverse-dialog-close').onclick = () => {
            dialog.classList.remove('active');
            clearTraverseHighlight();
        };
        
        // 拖動功能
        const header = dialog.querySelector('.traverse-dialog-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('traverse-dialog-close')) return;
            isDragging = true;
            initialX = e.clientX - (dialog.offsetLeft || 0);
            initialY = e.clientY - (dialog.offsetTop || 0);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            dialog.style.left = currentX + 'px';
            dialog.style.top = currentY + 'px';
            dialog.style.right = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    // 統計資料
    const lengthStats = {};
    results.forEach(seg => {
        lengthStats[seg.length] = (lengthStats[seg.length] || 0) + 1;
    });
    
    // 更新統計區
    const statsHtml = `
        <div><strong>總計找到 ${results.length} 個符合穿越條件的區段</strong></div>
        <div class="traverse-stats-grid">
            ${Object.keys(lengthStats).sort((a, b) => a - b).map(len => `
                <div class="traverse-stat-item">
                    <div class="traverse-stat-label">${len} 張</div>
                    <div class="traverse-stat-value">${lengthStats[len]}</div>
                </div>
            `).join('')}
        </div>
    `;
    dialog.querySelector('.traverse-stats').innerHTML = statsHtml;
    
    // 計算每個區段對應的起始局號
    const deck = extractDeckForTraverse();
    let cardPositionToRound = [];
    let cardIdx = 0;
    if (typeof currentRounds !== 'undefined' && Array.isArray(currentRounds)) {
        currentRounds.forEach((round, roundIdx) => {
            if (round && Array.isArray(round.cards)) {
                round.cards.forEach(() => {
                    cardPositionToRound[cardIdx] = roundIdx + 1;
                    cardIdx++;
                });
            }
        });
    }
    
    // 更新列表（添加點擊高亮功能和局號）
    const listHtml = results.map((seg, i) => {
        const startRound = cardPositionToRound[seg.start] || '?';
        return `
        <div class="traverse-item" data-start="${seg.start}" data-end="${seg.end}">
            <div class="traverse-item-header">
                <span class="traverse-item-pos">#${i + 1} 位置: 第 ${seg.startPos} ~ ${seg.endPos} 張 (第${startRound}局起)</span>
                <span class="traverse-item-length">${seg.length} 張 / ${seg.roundCount} 局</span>
            </div>
            <div class="traverse-item-cards">${seg.cards}</div>
            <div class="traverse-item-rounds">
                ${seg.rounds.map((r, j) => `第${j + 1}局: ${r[0] + 1}-${r[1] + 1}`).join(' → ')}
            </div>
        </div>
    `;
    }).join('');
    dialog.querySelector('.traverse-list').innerHTML = listHtml;
    
    // 綁定點擊事件以高亮顯示
    dialog.querySelectorAll('.traverse-item').forEach(item => {
        item.onclick = () => {
            const start = parseInt(item.dataset.start);
            const end = parseInt(item.dataset.end);
            highlightTraverseSegment(start, end);
            
            // 視覺反饋
            dialog.querySelectorAll('.traverse-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        };
    });
    
    dialog.classList.add('active');
    
    // 直接高亮顯示所有區段
    highlightAllTraverseSegments(results);
}

/**
 * 高亮顯示所有穿越區段的牌
 */
function highlightAllTraverseSegments(results) {
    // 先清除之前的高亮
    clearTraverseHighlight();
    
    if (!results || results.length === 0) return;
    
    // 取得主表格
    const mainTable = document.querySelector('#roundsTable tbody');
    if (!mainTable) {
        console.warn('找不到主表格');
        return;
    }
    
    // 收集所有需要高亮的卡片索引
    const highlightIndices = new Set();
    results.forEach(seg => {
        for (let i = seg.start; i <= seg.end; i++) {
            highlightIndices.add(i);
        }
    });
    
    // 只計算「卡牌」欄位中的卡片（.card-strip .card-label）
    const allCardLabels = mainTable.querySelectorAll('.card-strip .card-label');
    let highlightCount = 0;
    
    allCardLabels.forEach((cardLabel, cardIndex) => {
        if (highlightIndices.has(cardIndex)) {
            cardLabel.classList.add('traverse-highlight');
            highlightCount++;
        }
    });
    
    console.log(`高亮顯示 ${results.length} 個區段，共 ${highlightCount} 張牌`);
}

/**
 * 高亮顯示穿越區段的牌
 */
function highlightTraverseSegment(startIdx, endIdx) {
    // 先清除之前的高亮
    clearTraverseHighlight();
    
    // 取得主表格
    const mainTable = document.querySelector('#roundsTable tbody');
    if (!mainTable) {
        console.warn('找不到主表格');
        return;
    }
    
    // 只計算「卡牌」欄位中的卡片（.card-strip .card-label）
    // 排除閒家牌、莊家牌欄位（.hand-chip-strip）
    const allCardLabels = mainTable.querySelectorAll('.card-strip .card-label');
    let highlightCount = 0;
    
    allCardLabels.forEach((cardLabel, cardIndex) => {
        // 檢查是否在高亮範圍內
        if (cardIndex >= startIdx && cardIndex <= endIdx) {
            cardLabel.classList.add('traverse-highlight');
            highlightCount++;
        }
    });
    
    console.log(`高亮顯示第 ${startIdx + 1} ~ ${endIdx + 1} 張 (共 ${highlightCount} 張牌)`);
}

/**
 * 清除穿越高亮
 */
function clearTraverseHighlight() {
    const cells = document.querySelectorAll('.traverse-highlight');
    cells.forEach(cell => cell.classList.remove('traverse-highlight'));
}

/**
 * 顯示掃描參數設定對話框
 */
function showTraverseScanDialog() {
    // 檢查是否有牌靴
    const deck = extractDeckForTraverse();
    if (deck.length === 0) {
        log('請先生成牌靴再進行穿越掃描', 'error');
        return;
    }
    
    // 建立設定對話框
    let settingsDialog = document.getElementById('traverseSettingsDialog');
    if (!settingsDialog) {
        settingsDialog = document.createElement('div');
        settingsDialog.id = 'traverseSettingsDialog';
        settingsDialog.innerHTML = `
            <div class="traverse-settings-overlay">
                <div class="traverse-settings-content">
                    <div class="traverse-settings-header">
                        <h3>穿越掃描設定</h3>
                        <button class="traverse-settings-close">&times;</button>
                    </div>
                    <div class="traverse-settings-body">
                        <div class="traverse-settings-info">
                            <p>牌靴共 <strong id="traverseDeckSize">0</strong> 張牌</p>
                            <p style="font-size: 12px; color: #666;">
                                穿越：不管從區段內第幾張開始發牌，最後一張都會落在區段末尾<br>
                                豁免：剩餘 1, 2, 3, 7 張時不檢查
                            </p>
                        </div>
                        
                        <div class="traverse-settings-row">
                            <label>掃描模式：</label>
                            <div class="traverse-mode-buttons">
                                <button class="traverse-mode-btn active" data-mode="range">指定長度範圍</button>
                                <button class="traverse-mode-btn" data-mode="position">指定位置範圍</button>
                                <button class="traverse-mode-btn" data-mode="full">全牌靴掃描</button>
                            </div>
                        </div>
                        
                        <div class="traverse-settings-inputs" id="traverseRangeInputs">
                            <div class="traverse-input-group">
                                <label>最小長度：</label>
                                <input type="number" id="traverseMinLength" value="6" min="4" max="50">
                                <span class="traverse-input-hint">張</span>
                            </div>
                            <div class="traverse-input-group">
                                <label>最大長度：</label>
                                <input type="number" id="traverseMaxLength" value="18" min="4" max="50">
                                <span class="traverse-input-hint">張</span>
                            </div>
                        </div>
                        
                        <div class="traverse-settings-inputs" id="traversePositionInputs" style="display: none;">
                            <div class="traverse-input-group">
                                <label>起始位置：</label>
                                <input type="number" id="traverseStartPos" value="1" min="1">
                                <span class="traverse-input-hint">第幾張</span>
                            </div>
                            <div class="traverse-input-group">
                                <label>結束位置：</label>
                                <input type="number" id="traverseEndPos" value="416" min="1">
                                <span class="traverse-input-hint">第幾張</span>
                            </div>
                            <div class="traverse-input-group">
                                <label>區段長度：</label>
                                <input type="number" id="traverseSegLength" value="6" min="4" max="50">
                                <span class="traverse-input-hint">張（固定）</span>
                            </div>
                        </div>
                        
                        <div class="traverse-settings-actions">
                            <button class="traverse-scan-btn" id="btnStartTraverseScan">開始掃描</button>
                            <button class="traverse-cancel-btn" id="btnCancelTraverseScan">取消</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 加入樣式
        document.body.appendChild(settingsDialog);
        
        // 綁定事件
        const closeDialog = () => {
            settingsDialog.style.display = 'none';
        };
        
        settingsDialog.querySelector('.traverse-settings-close').onclick = closeDialog;
        settingsDialog.querySelector('#btnCancelTraverseScan').onclick = closeDialog;
        settingsDialog.querySelector('.traverse-settings-overlay').onclick = (e) => {
            if (e.target === e.currentTarget) closeDialog();
        };
        
        // 模式切換
        const modeButtons = settingsDialog.querySelectorAll('.traverse-mode-btn');
        const rangeInputs = settingsDialog.querySelector('#traverseRangeInputs');
        const positionInputs = settingsDialog.querySelector('#traversePositionInputs');
        
        modeButtons.forEach(btn => {
            btn.onclick = () => {
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const mode = btn.dataset.mode;
                if (mode === 'range') {
                    rangeInputs.style.display = 'block';
                    positionInputs.style.display = 'none';
                } else if (mode === 'position') {
                    rangeInputs.style.display = 'none';
                    positionInputs.style.display = 'block';
                } else {
                    rangeInputs.style.display = 'none';
                    positionInputs.style.display = 'none';
                }
            };
        });
        
        // 開始掃描
        settingsDialog.querySelector('#btnStartTraverseScan').onclick = () => {
            const activeMode = settingsDialog.querySelector('.traverse-mode-btn.active').dataset.mode;
            
            let results;
            if (activeMode === 'range') {
                const minLen = parseInt(settingsDialog.querySelector('#traverseMinLength').value) || 6;
                const maxLen = parseInt(settingsDialog.querySelector('#traverseMaxLength').value) || 18;
                results = scanTraverse(minLen, maxLen);
            } else if (activeMode === 'position') {
                const startPos = parseInt(settingsDialog.querySelector('#traverseStartPos').value) || 1;
                const endPos = parseInt(settingsDialog.querySelector('#traverseEndPos').value) || deck.length;
                const segLen = parseInt(settingsDialog.querySelector('#traverseSegLength').value) || 6;
                results = scanTraverseByPosition(startPos - 1, endPos - 1, segLen);
            } else {
                // 全牌靴：長度 4 到 50
                results = scanTraverse(4, 50);
            }
            
            closeDialog();
            
            if (results.length > 0) {
                showTraverseDialog();
            }
        };
    }
    
    // 更新牌靴張數
    settingsDialog.querySelector('#traverseDeckSize').textContent = deck.length;
    settingsDialog.querySelector('#traverseEndPos').value = deck.length;
    settingsDialog.querySelector('#traverseEndPos').max = deck.length;
    settingsDialog.querySelector('#traverseStartPos').max = deck.length;
    
    settingsDialog.style.display = 'block';
}

/**
 * 依指定位置範圍掃描（固定區段長度）
 */
function scanTraverseByPosition(startIdx, endIdx, segLength) {
    const deck = extractDeckForTraverse();
    
    if (deck.length === 0) {
        log('請先生成牌靴再進行穿越掃描', 'error');
        return [];
    }
    
    const results = [];
    let checkedCount = 0;
    
    console.log(`開始穿越掃描：位置 ${startIdx + 1} ~ ${endIdx + 1}，區段長度 ${segLength}`);
    
    for (let start = startIdx; start <= endIdx - segLength + 1; start++) {
        const end = start + segLength - 1;
        if (end > endIdx) break;
        
        checkedCount++;
        
        if (checkTraverse(deck, start, end)) {
            const rounds = getTraverseRounds(deck, start, end);
            const cardStr = deck.slice(start, end + 1).map(c => {
                if (typeof c.short === 'function') return c.short();
                return `${c.rank}${c.suit}`;
            }).join(' ');
            
            results.push({
                start: start,
                end: end,
                startPos: start + 1,
                endPos: end + 1,
                length: segLength,
                rounds: rounds,
                roundCount: rounds.length,
                cards: cardStr
            });
        }
    }
    
    console.log(`掃描完成：共檢查 ${checkedCount} 個區段，找到 ${results.length} 個符合穿越條件`);
    
    if (results.length > 0) {
        log(`穿越掃描完成：找到 ${results.length} 個符合條件的區段`, 'success');
    } else {
        log('穿越掃描完成：沒有找到符合條件的區段', 'warn');
    }
    
    window.traverseResults = results;
    return results;
}

/**
 * 在工具列加入穿越掃描按鈕
 */
function addTraverseButton() {
    const toolbar = document.querySelector('.tool-sidebar');
    if (!toolbar) {
        console.warn('找不到工具列，無法新增穿越掃描按鈕');
        return;
    }
    
    // 檢查是否已存在
    if (document.getElementById('btnTraverseScan')) {
        return;
    }
    
    const btn = document.createElement('button');
    btn.id = 'btnTraverseScan';
    btn.className = 'tool-btn';
    btn.textContent = '穿越掃描';
    btn.onclick = showTraverseScanDialog;
    
    toolbar.appendChild(btn);
    console.log('已新增「穿越掃描」按鈕');
}

// 頁面載入完成後自動新增按鈕
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addTraverseButton);
    } else {
        addTraverseButton();
    }
}

// 匯出供外部使用
if (typeof window !== 'undefined') {
    window.scanTraverse = scanTraverse;
    window.showTraverseDialog = showTraverseDialog;
    window.checkTraverse = checkTraverse;
}

console.log('穿越掃描器已載入。使用方式：scanTraverse() 或點擊「穿越掃描」按鈕');
