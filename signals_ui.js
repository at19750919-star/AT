
function runAutoColorSwapFromUI() {
    if (!currentRounds || currentRounds.length === 0) {
        log('請先生成牌靴', 'error');
        return;
    }
    log('開始執行卡色邏輯...', 'info');
    try {
        currentRounds = runAutoColorSwap_Signal(currentRounds);
        refreshAnalysisAndRender();
        resetEditState();
        log('卡色邏輯執行完成', 'success');
    } catch (err) {
        log(`卡色失敗: ${err && err.message ? err.message : err}`, 'error');
    }
}

// 更新訊號牌張數顯示
function updateSignalCardCount() {
    // 收集花色選擇
    // 先讀圓形按鈕
let suits = Array.from(document.querySelectorAll('.suit-button.selected'))
  .map(btn => btn.dataset.value);

// 若沒有圓形按鈕(或沒選),才退回舊的 checkbox
if (suits.length === 0) {
  suits = Array.from(document.querySelectorAll('.suit-checkbox:checked'))
    .map(cb => cb.value);
}

    
    // 收集數字選擇
    // 優先從數字按鈕(.rank-button.selected)讀取，如有則使用；
    // 若按鈕沒有選中項目，再退回讀取隱藏的 .rank-checkbox。
    let ranks = Array.from(document.querySelectorAll('.rank-button.selected'))
        .map(btn => btn.dataset.value);
    if (ranks.length === 0) {
        ranks = [];
        document.querySelectorAll('.rank-checkbox:checked').forEach(cb => {
            ranks.push(cb.value);
        });
    }
    
    // 計算總張數 (花色數量 × 數字數量 × 8副牌)
    const totalCards = suits.length * ranks.length * 8;
    
    // 更新顯示
    const countElement = document.getElementById('signalCardCount');
    if (countElement) {
        countElement.textContent = totalCards;
        countElement.style.color = '#28a745';
    }
}

// 應用訊號設定
function applySignalConfig() {
    // 先讀圓形按鈕
let suits = Array.from(document.querySelectorAll('.suit-button.selected'))
  .map(btn => btn.dataset.value);

// 若沒有圓形按鈕(或沒選),才退回舊的 checkbox
if (suits.length === 0) {
  suits = Array.from(document.querySelectorAll('.suit-checkbox:checked'))
    .map(cb => cb.value);
}

    
    // 收集數字選擇
    const ranks = [];
    document.querySelectorAll('.rank-checkbox:checked').forEach(cb => {
        ranks.push(cb.value);
    });
    
    const updated = persistSignalConfig({ suits, ranks });
    const expectedTotal = updated.suits.length * updated.ranks.length * 8;
    
    log(`訊號設定已更新:花色[${updated.suits.join(',')}] 數字[${updated.ranks.join(',')}] (預計訊號牌總數:${expectedTotal}張)`, 'success');
}

// 根據傳入設定或 UI 直接更新訊號配置
function updateSignalConfig(newConfig) {
    const hasExternalConfig = newConfig && typeof newConfig === 'object' &&
        (Array.isArray(newConfig.suits) || Array.isArray(newConfig.ranks));

    if (hasExternalConfig) {
        const suits = Array.isArray(newConfig.suits) ? newConfig.suits : SIGNAL_CONFIG.suits;
        const ranks = Array.isArray(newConfig.ranks) ? newConfig.ranks : SIGNAL_CONFIG.ranks;
        persistSignalConfig({ suits, ranks });
        syncUiFromSignalConfig();
        return;
    }

    applySignalConfig();
}

// 搭配主程式的封裝函式，轉發至核心生成器
function generateShoe_Signal(...args) {
    return generateShoe(...args);
}





// 取得所有花色圓形按鈕（供其他邏輯重用）
function getSuitButtons() {
    return Array.from(document.querySelectorAll('.suit-button'));
}

// 清除花色與數字選擇，並更新顯示
function clearSignalSelections() {
    // 清空花色按鈕與對應 checkbox
    getSuitButtons().forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.suit-checkbox').forEach(cb => {
        cb.checked = false;
    });

    // 清空數字 checkbox 與圓形按鈕
    document.querySelectorAll('.rank-checkbox').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('.rank-button').forEach(btn => {
        btn.classList.remove('selected');
    });

    updateSignalCardCount();
}


// 將 UI 的選單狀態同步為目前儲存的訊號設定
function syncUiFromSignalConfig() {
    if (typeof document === 'undefined') return;
    const suits = Array.isArray(SIGNAL_CONFIG.suits) ? SIGNAL_CONFIG.suits : [];
    const ranks = Array.isArray(SIGNAL_CONFIG.ranks) ? SIGNAL_CONFIG.ranks : [];
    const suitSet = new Set(suits);
    const rankSet = new Set(ranks);

    const suitButtons = document.querySelectorAll('.suit-button');
    suitButtons.forEach(btn => {
        const value = btn.dataset ? btn.dataset.value : btn.value;
        if (value && suitSet.has(value)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    document.querySelectorAll('.rank-checkbox').forEach(cb => {
        cb.checked = rankSet.has(cb.value);
    });

    if (typeof updateSignalCardCount === 'function') {
        updateSignalCardCount();
    }
}

//
// -------------------------------------------------------------------------
// Expose core UI functions on the window object
//
// When this project was refactored into separate core and UI scripts, the
// `updateSignalCardCount`, `applySignalConfig` and
// `syncSignalUiFromConfig` functions were no longer automatically placed
// on the global `window` object. The inline helper code in `signals.html`
// relies on these functions existing on `window` in order to update the
// signal card count and apply the current suit/rank selections. Without
// exposing them, clicking the suit and rank buttons would not trigger
// updates and the signal card count would remain at zero. To fix this,
// assign these functions to `window` if they are not already defined.
if (typeof window !== 'undefined') {
    // Avoid overwriting existing implementations, but ensure the global
    // functions are set when absent.
    if (typeof window.updateSignalCardCount !== 'function') {
        window.updateSignalCardCount = updateSignalCardCount;
    }
    if (typeof window.applySignalConfig !== 'function') {
        window.applySignalConfig = applySignalConfig;
    }
    if (typeof window.syncSignalUiFromConfig !== 'function') {
        window.syncSignalUiFromConfig = syncUiFromSignalConfig;
    }
    if (typeof window.clearSignalSelections !== 'function') {
        window.clearSignalSelections = clearSignalSelections;
    }
}

// 更新訊號牌張數顯示
// 完整複製多重洗牌邏輯
function multi_pass_candidates_from_cards_simple(card_pool) {
    if (card_pool.length < 2) return []; // 改為至少需要2張牌
    
    // 複製一份牌池並隨機洗牌    
    let shuffled = [...card_pool];
    shuffle(shuffled);   
    
    const temp_cards = shuffled.map((c, i) => c.clone(i));
    const idx2orig = new Map(shuffled.map((c, i) => [i, c]));
    const temp_sim = new Simulator(temp_cards);
    
    const out = []; 
    const used_idx = new Set();
    let i = 0;
    
    while (i < temp_cards.length - 1) { // 改為至少保留1張牌      
        if (used_idx.has(i)) { i++; continue; }
        
        const r = temp_sim.simulate_round(i); 
        if (!r) { i++; continue; }
        
        const temp_indices = r.cards.map(c => c.pos);
        if (temp_indices.some(ti => used_idx.has(ti))) { i++; continue; }
        
        if (!r.sensitive) { i += r.cards.length; continue; } 
        if (typeof shouldSkipSensitiveRound === 'function' && shouldSkipSensitiveRound(r)) {
            i += r.cards.length;
            continue;
        }
        
        // 準備把臨時卡牌對照回原始卡牌     
        const ordered = [];
        const seen = new Set();
        let valid = true;
        
        for (const ti of temp_indices) {
            const oc = idx2orig.get(ti);
            if (seen.has(oc.pos)) { valid = false; break; }
            ordered.push(oc); 
            seen.add(oc.pos);
        }
        
        if (!valid) { i++; continue; }
        
        const start_pos = ordered[0].pos;
        out.push({
            start_index: start_pos,
            cards: ordered,
            result: r.result,
            sensitive: true
        });
        
        temp_indices.forEach(ti => used_idx.add(ti));
        i = Math.max(...temp_indices) + 1;
    }
   
    return out;
}


// 完整複製原系統的AC段排列邏輯
function pack_all_sensitive_and_segment(deck) {
    log(`🔍 開始處理：總共 ${deck.length} 張牌`, 'info');
    
    const sim = new Simulator(deck);
    // 掃描所有敏感局
    const scanSensitive = (typeof scan_all_sensitive_rounds === 'function')
        ? scan_all_sensitive_rounds
        : (window.SignalLogic && window.SignalLogic.helpers && window.SignalLogic.helpers.scan_all_sensitive_rounds);
    if (typeof scanSensitive !== 'function') {
        throw new Error('scan_all_sensitive_rounds 未定義');
    }
    const all_sensitive = scanSensitive(sim);
    log(`🔍 自然掃描敏感局：找到 ${all_sensitive.length} 局`, 'info');
    // 記錄已用過的牌位置
    const used_pos = new Set();
    // 儲存 A 段敏感局
    const a_rounds = [];
    
    // 先把所有敏感局加入 A 段
    for (const r of all_sensitive) {
        if (typeof shouldSkipSensitiveRound === 'function' && shouldSkipSensitiveRound(r)) continue;
        // 如果這局有用過的牌就跳過
        if (r.cards.some(c => used_pos.has(c.pos))) continue;
        r.segment = 'A';
        a_rounds.push(r);
        r.cards.forEach(c => used_pos.add(c.pos));
    }
    log(`🔍 自然敏感局加入完成：A段 ${a_rounds.length} 局，已用牌 ${used_pos.size} 張`, 'info');
    
    // 持續多重洗牌挑選敏感局
    const MAX_MULTI_PASS_ATTEMPTS = 200;
    let multi_pass_attempts = 0;
    
    const harvestAdditionalSensitiveRounds = (label = '多重洗牌') => {
        let attempts = 0;
        let added = 0;
        while (attempts < MAX_MULTI_PASS_ATTEMPTS) {
        const remaining = deck.filter(c => !used_pos.has(c.pos));
        if (remaining.length <= MULTI_PASS_MIN_CARDS) {
            // 剩餘牌數 ≤ 6:只要能湊出敏感局,就把它當成一個正常回合附加進結果
            if (remaining.length >= 4 && canFormSensitiveRound(remaining)) {
                const tempCards = remaining.map((c, i) => c.clone(i));
                const tempSim = new Simulator(tempCards);
                const last = tempSim.simulate_round(0);
                if (last && last.sensitive) {
                    if (typeof shouldSkipSensitiveRound === 'function' && shouldSkipSensitiveRound(last)) {
                        return null;
                    }
                    // 將排列結果映射回原始卡牌(保持正確的 pos / 引用)
                    const orderedOriginalCards = last.cards.map(cloneCard => {
                        const original = remaining[cloneCard.pos];
                        return original;
                    });
                    const startPos = orderedOriginalCards.length ? orderedOriginalCards[0].pos : 0;
                    const finalRound = makeRoundInfo(startPos, orderedOriginalCards, last.result, true);
                    finalRound.segment = 'A';
                    a_rounds.push(finalRound);
                    orderedOriginalCards.forEach(card => used_pos.add(card.pos));
                    break;
                }
            }
            return null;
        }
        
        const cands = multi_pass_candidates_from_cards_simple(remaining);
        const picked = Array.isArray(cands)
            ? cands.find(r => Array.isArray(r.cards) && r.cards.length > 0 && !r.cards.some(c => used_pos.has(c.pos)))
            : cands;
            
        // 檢查挑出來的敏感局是否合法
        if (!picked || !Array.isArray(picked.cards) || picked.cards.length === 0) {
             multi_pass_attempts++;
            if (multi_pass_attempts >= MAX_MULTI_PASS_ATTEMPTS) break;
            continue;
        }
        if (typeof shouldSkipSensitiveRound === 'function' && shouldSkipSensitiveRound(picked)) {
            multi_pass_attempts++;
            if (multi_pass_attempts >= MAX_MULTI_PASS_ATTEMPTS) break;
            continue;
        }
        if (picked.cards.some(c => used_pos.has(c.pos))) break;
        
        picked.segment = 'A';
        a_rounds.push(picked);
        picked.cards.forEach(c => used_pos.add(c.pos));
            added++;
    }
        if (added > 0) {
            log(`🔍 ${label}：加入 ${added} 局，已使用 ${used_pos.size} 張牌`, 'info');
        }
        return added;
    };
    log('🔍 開始多重洗牌挑選敏感局', 'info');
    harvestAdditionalSensitiveRounds();
    log(`🔍 多重洗牌結束：A段 ${a_rounds.length} 局，已用牌 ${used_pos.size} 張`, 'info');
      
    a_rounds.sort((a, b) => a.start_index - b.start_index);
    
    
    
    const tail_cards = deck.filter(c => !used_pos.has(c.pos));
    log(`🔍 多重挑選結束後剩餘 ${tail_cards.length} 張牌`, 'info');
    log(`🔍 準備建立殘牌：剩餘 ${tail_cards.length} 張牌`, 'info');
    log(`🔍 驗證：${used_pos.size} + ${tail_cards.length} = ${used_pos.size + tail_cards.length} (應為 416)`, 'info');
    
    if (used_pos.size + tail_cards.length !== 416) {
        log(`❌ 錯誤：A 段處理後就少牌了！`, 'error');
        const all_pos_in_deck = new Set(deck.map(c => c.pos));
        const accounted_pos = new Set([...used_pos, ...tail_cards.map(c => c.pos)]);
        const missing_pos = [...all_pos_in_deck].filter(pos => !accounted_pos.has(pos));
        log(`❌ 消失的 pos: ${missing_pos.join(', ')}`, 'error');
    }
    
    let c_cards = tail_cards.slice();
    let c_round = null;
    if (c_cards.length > 0) {
        const c_start = Math.min(...c_cards.map(c => c.pos));
        c_round = makeRoundInfo(c_start, c_cards, '殘牌', false);
        c_round.segment = 'C';
    }
    
    let final_rounds = [...a_rounds, ...(c_round ? [c_round] : [])];

    // 於生成流程內就完成 T 局訊號處理，避免後續再跑一次
    if (typeof applyTSignalLogic === 'function') {
        try {
            const processed = applyTSignalLogic(final_rounds.slice(), a_rounds, used_pos, c_cards);
            if (Array.isArray(processed) && processed.length > 0) {
                final_rounds = processed;
                const tailRound = [...final_rounds].reverse().find(r => r && r.segment === 'C');
                c_cards = tailRound && Array.isArray(tailRound.cards) ? tailRound.cards : [];
                log('🔍 生成流程內已完成 T 局訊號處理。', 'info');
            } else {
                log('⚠️ 生成流程內的 T 局處理未回傳有效結果，沿用原順序。', 'warn');
            }
        } catch (error) {
            log(`⚠️ 生成流程內處理 T 局失敗: ${error && error.message ? error.message : error}`, 'error');
            throw error;
        }
    } else {
        log('⚠️ 找不到 applyTSignalLogic，無法在生成階段處理 T 局。', 'warn');
    }

    // 生成完畢後再做一次安全檢查，確保 A 段沒有違規局
    if (typeof ensureNoBannedBankerSixRound === 'function') {
        ensureNoBannedBankerSixRound(final_rounds, 'A');
    }

    // 取得所有卡牌
    const final_card_deck = final_rounds.flatMap(r => r.cards);
    log(`A段: ${a_rounds.length}局, C段: ${c_cards.length > 0 ? 1 : 0}局`, 'info');
    
    return {
        a_rounds,
        c_cards,
        final_rounds,
        final_card_deck
    };
}

// T局訊號處理:兩對局→下一局和局
function applyTSignalLogic(rounds, a_rounds, used_pos, tail_cards) {
    if (!Array.isArray(a_rounds) || !(used_pos instanceof Set)) {
        return applyTSignalLogicSimple(rounds);
    }
    log('開始T局訊號處理:兩對局 → 下一局和局', 'info');

    // 先清掉舊的 T 標記,避免上一輪留下來
    rounds.forEach(round => {
        if (round.isT) {
            round.isT = false;
        }
    });

    const originalTailCards = Array.isArray(tail_cards)
        ? tail_cards.filter(card => card && typeof card.pos === 'number')
        : [];

    const removedRounds = [];
    const removeRoundByIndex = (idx) => {
        if (idx < 0 || idx >= a_rounds.length) return null;
        const [spliced] = a_rounds.splice(idx, 1);
        if (!spliced) return null;
        removedRounds.push(spliced);
        if (Array.isArray(spliced.cards)) {
            spliced.cards.forEach(card => used_pos.delete(card.pos));
        }
        return spliced;
    };
    
    // ===== 階段 1：先拆「兩對+和局」=====
    log('🔍 開始和局平衡處理', 'info');
    let twoPairsTieRemoved = 0;
    for (let i = a_rounds.length - 1; i >= 0; i--) {
        const round = a_rounds[i];
        if (hasTwoPairs(round) && round.result === '和') {
            removeRoundByIndex(i);
            twoPairsTieRemoved++;
        }
    }
    
    if (twoPairsTieRemoved > 0) {
        log(`🔍 拆掉 ${twoPairsTieRemoved} 局「兩對+和局」`, 'warn');
    }
    
    // ===== 階段 2：掃描並拆除違規的莊 6 點 / 5 或 6 張牌局 =====
    const isBankerSixWin = (round) => {
        if (!round) return false;
        if (typeof computeRoundHands !== 'function') return false;
        const handInfo = computeRoundHands(round.cards || []);
        if (!handInfo) return false;
        const playerTotal = handInfo.playerTotal;
        return handInfo.bankerTotal === 6 && typeof playerTotal === 'number' && playerTotal <= 5;
    };

    const describeRoundLocation = (round, idx) => {
        const displayIdx = (round && typeof round.display_index === 'number')
            ? round.display_index
            : (idx + 1);
        return `第${displayIdx}局`;
    };

    const scanBankerSixMatches = () => {
        const matches = [];
        for (let i = 0; i < a_rounds.length; i++) {
            const round = a_rounds[i];
            if (isBankerSixWin(round)) {
                matches.push({ index: i, round, label: describeRoundLocation(round, i) });
            }
        }
        return matches;
    };

    const removeBankerSixMatches = (matches) => {
        const sorted = matches.slice().sort((a, b) => b.index - a.index);
        const removed = [];
        for (const match of sorted) {
            const removedRound = removeRoundByIndex(match.index);
            if (removedRound) {
                removed.push({ match, removedRound });
            }
        }
        return removed;
    };

    const handleBankerSixPass = (label) => {
        const matches = scanBankerSixMatches();
        const locationList = matches.map(m => m.label).join('、') || '無';
        log(`${label} 掃描莊家6點${matches.length ? `：共 ${matches.length} 局 (${locationList})` : '：無符合條件'}`, 'info');
        if (!matches.length) return [];
        const removed = removeBankerSixMatches(matches);
        const removedList = removed.map(item => item.match.label).join('、') || '無';
        log(`${label} 拆掉 ${removed.length} 局莊家6點${removed.length ? ` (${removedList})` : ''}`, removed.length ? 'warn' : 'info');
        return removed;
    };

    handleBankerSixPass('🔍');
    
    // ===== 階段 3：重新統計，拆多餘的純和局或純兩對局 =====
    let twoPairsCount = a_rounds.filter(hasTwoPairs).length;
    let tieCount = a_rounds.filter(round => round.result === '和').length;
    
    log(`🔍 重新統計：兩對局 ${twoPairsCount}，和局 ${tieCount}`, 'info');
    
    let pureTieRemoved = 0;
    let pureTwoPairsRemoved = 0;

    if (tieCount > twoPairsCount) {
        const excess = tieCount - twoPairsCount;
        log(`🔍 和局 ${tieCount} > 兩對 ${twoPairsCount}，需再拆出 ${excess} 局和局`, 'warn');
        
        for (let i = a_rounds.length - 1; i >= 0 && pureTieRemoved < excess; i--) {
            const round = a_rounds[i];
            if (round.result === '和') {
                removeRoundByIndex(i);
                pureTieRemoved++;
            }
        }
        
        log(`🔍 總共拆掉：兩對+和局 ${twoPairsTieRemoved} 局，純和局 ${pureTieRemoved} 局`, 'info');
    } else if (twoPairsCount > tieCount) {
        const excess = twoPairsCount - tieCount;
        log(`🔍 兩對 ${twoPairsCount} > 和局 ${tieCount}，需再拆出 ${excess} 局兩對局`, 'warn');
        
        for (let i = a_rounds.length - 1; i >= 0 && pureTwoPairsRemoved < excess; i--) {
            const round = a_rounds[i];
            if (hasTwoPairs(round) && round.result !== '和') {
                removeRoundByIndex(i);
                pureTwoPairsRemoved++;
            }
        }
        
        log(`🔍 總共拆掉：兩對+和局 ${twoPairsTieRemoved} 局，純兩對 ${pureTwoPairsRemoved} 局`, 'info');
    } else {
        log('🔍 兩對與和局數量一致，無需額外調整', 'info');
    }

    const recycleAndCollect = (label) => {
        const { leftoverCards } = recycleRemovedRounds(
            removedRounds,
            originalTailCards,
            a_rounds,
            used_pos,
            label
        );
        return Array.isArray(leftoverCards) ? leftoverCards.slice() : [];
    };

    let tailCards = recycleAndCollect('和局平衡重洗');
    
    const extraBankerSixRemoved = handleBankerSixPass('🔍 再次重洗');
    if (extraBankerSixRemoved.length > 0) {
        tailCards = recycleAndCollect('和局平衡重洗（再補）');
        const finalBankerSixRemoved = handleBankerSixPass('🔍 最終檢查');
        if (finalBankerSixRemoved.length > 0) {
            log(`⚠️ 最終仍拆掉 ${finalBankerSixRemoved.length} 局莊家6點，暫不再重洗`, 'warn');
        }
    }
    let tailRound = null;
    if (tailCards.length > 0) {
        const sortedTail = tailCards.slice().sort((a, b) => a.pos - b.pos);
        const startPos = sortedTail[0]?.pos ?? 0;
        tailRound = makeRoundInfo(startPos, sortedTail, '殘牌', false);
        tailRound.segment = 'C';
    }
    
    rounds = a_rounds.slice();
    if (tailRound) {
        rounds.push(tailRound);
    }
    
    // 1. 統計兩對局和和局（重新統計，因為可能被拆除了）
    const twoPairsIndices = [];
    const tieIndices = [];
    
    rounds.forEach((round, index) => {
        if (hasTwoPairs(round)) {
            twoPairsIndices.push(index);
        }
        if (round.result === '和') {
            tieIndices.push(index);
        }
    });
    
    log(`最終統計 - 兩對局數:${twoPairsIndices.length},和局數:${tieIndices.length}`, 'info');
    
    // 2. 數量匹配檢查
    twoPairsCount = twoPairsIndices.length;
    tieCount = tieIndices.length;
    
    if (twoPairsCount !== tieCount) {
        log(`⚠️ 警告：兩對局 ${twoPairsCount} 與和局 ${tieCount} 數量不匹配`, 'warn');
        return rounds;
    }

    // 3. 調整 C 段位置
    const cRounds = rounds.filter(r => r.segment === 'C');
    const nonCRounds = rounds.filter(r => r.segment !== 'C');
    rounds = [...nonCRounds, ...cRounds];
    
    // 4. 重新統計索引（因為順序改變了）
    twoPairsIndices.length = 0;
    tieIndices.length = 0;
    
    rounds.forEach((round, index) => {
        if (hasTwoPairs(round)) {
            twoPairsIndices.push(index);
        }
        if (round.result === '和') {
            tieIndices.push(index);
        }
    });
    
    return adjustTSignalPositions(rounds, twoPairsIndices, tieIndices);
}

// 從拆除的敏感局與剩餘牌重洗，補回新的敏感局
function recycleRemovedRounds(removedRounds, initialTailCards, targetRounds, used_pos, label = '拆除牌重洗') {
    const removedCards = Array.isArray(removedRounds)
        ? removedRounds.flatMap(round => Array.isArray(round?.cards) ? round.cards : [])
        : [];
    const baseTail = Array.isArray(initialTailCards) ? initialTailCards : [];
    const allPool = removedCards.concat(baseTail);

    const seenPos = new Set();
    let poolCards = allPool.filter(card => {
        if (!card || typeof card.pos !== 'number') return false;
        if (used_pos.has(card.pos)) return false;
        if (seenPos.has(card.pos)) return false;
        seenPos.add(card.pos);
        return true;
    });

    if (poolCards.length < 4) {
        return { added: 0, leftoverCards: poolCards };
    }

    const MAX_RECYCLE_ATTEMPTS = 200;
    let idleAttempts = 0;
    let added = 0;

    while (poolCards.length >= MULTI_PASS_MIN_CARDS && idleAttempts < MAX_RECYCLE_ATTEMPTS) {
        idleAttempts++;
        const candidates = multi_pass_candidates_from_cards_simple(poolCards);
        const picked = Array.isArray(candidates)
            ? candidates.find(r =>
                Array.isArray(r.cards) &&
                r.cards.length > 0 &&
                r.result !== '和' &&
                !r.cards.some(c => used_pos.has(c.pos)))
            : (candidates && candidates.result === '和' ? null : candidates);
        if (!picked || !Array.isArray(picked.cards) || picked.cards.length === 0) {
            continue;
        }
        picked.segment = 'A';
        targetRounds.push(picked);
        picked.cards.forEach(card => used_pos.add(card.pos));
        added++;
        poolCards = poolCards.filter(card => !used_pos.has(card.pos));
        idleAttempts = 0;
    }

    if (added > 0) {
        log(`🔁 ${label}：從拆除牌重新洗出 ${added} 局`, 'info');
    }
    if (poolCards.length >= MULTI_PASS_MIN_CARDS) {
        log(`⚠️ ${label}：剩餘 ${poolCards.length} 張牌仍無法組成敏感局，將直接作為殘牌`, 'warn');
    } else if (poolCards.length > 0) {
        log(`🔍 ${label}：僅餘 ${poolCards.length} 張牌，將作為殘牌`, 'info');
    }

    return {
        added,
        leftoverCards: poolCards
    };
}

// 用於沒有 a_rounds/used_pos 的情況下的簡化 T 局處理
function applyTSignalLogicSimple(rounds) {
    if (!Array.isArray(rounds) || rounds.length === 0) return rounds;
    log('開始T局訊號處理:兩對局 → 下一局和局', 'info');
    rounds.forEach(round => {
        if (round && round.isT) round.isT = false;
    });

    const twoPairsIndices = [];
    const tieIndices = [];
    rounds.forEach((round, index) => {
        if (hasTwoPairs(round)) {
            twoPairsIndices.push(index);
        }
        if (round && round.result === '和') {
            tieIndices.push(index);
        }
    });

    if (twoPairsIndices.length !== tieIndices.length) {
        log(`⚠️ 警告：兩對局 ${twoPairsIndices.length} 與和局 ${tieIndices.length} 數量不匹配`, 'warn');
        return rounds;
    }

    const cRounds = rounds.filter(r => r && r.segment === 'C');
    const nonCRounds = rounds.filter(r => !r || r.segment !== 'C');
    rounds = [...nonCRounds, ...cRounds];

    const finalTwoPairs = [];
    const finalTies = [];
    rounds.forEach((round, idx) => {
        if (hasTwoPairs(round)) finalTwoPairs.push(idx);
        if (round && round.result === '和') finalTies.push(idx);
    });

    return adjustTSignalPositions(rounds, finalTwoPairs, finalTies);
}

// 調整T局訊號位置 (已更新為"往下找不到再從頭找"的規則)
function adjustTSignalPositions(rounds, twoPairsIndices, tieIndices) {
    
    const availableTies = new Set(tieIndices);

    for (let i = 0; i < twoPairsIndices.length; i++) {
        const twoPairsIndex = twoPairsIndices[i];
        const nextIndex = (twoPairsIndex + 1) % rounds.length;

        if (rounds[nextIndex].result === '和') {
            if (availableTies.has(nextIndex)) {
                availableTies.delete(nextIndex);
            }
            rounds[twoPairsIndex].isT = true; // 標記 isT
            continue;
        }

        // --- 開始尋找可交換的和局 ---
        let closestTieIndex = -1;

        // 1. 優先從當前位置之後,往下尋找
        for (const tieIdx of availableTies) {
            if (tieIdx > twoPairsIndex) {
                closestTieIndex = tieIdx;
                break; // 找到第一個就停止
            }
        }

        // 2. 如果往下找不到,再從第一局開始往下尋找
        if (closestTieIndex === -1) {
            for (const tieIdx of availableTies) {
                // 這裡不需要 tieIdx > twoPairsIndex 的判斷
                closestTieIndex = tieIdx;
                break; // 找到第一個就停止
            }
        }

        // 如果找到了可用的和局
        if (closestTieIndex !== -1) {
            swapRounds(rounds, nextIndex, closestTieIndex);
            rounds[twoPairsIndex].isT = true; // 標記 isT
            availableTies.delete(closestTieIndex);
        } else {
            // 只有在遍歷了兩次都找不到任何一個可用的和局時,才會報錯
            log(`[警告] 牌靴中已無任何可用的和局來滿足第 ${twoPairsIndex + 1} 局。`, 'error');
        }
    }
    
    // 重新掃描一次實際的兩對局位置後標記 isT
    rounds.forEach(r => {
        if (r) r.isT = false;
    });
    rounds.forEach((round, idx) => {
        if (!round) return;
        if (!hasTwoPairs(round)) {
            round.isT = false;
            return;
        }
        const nextIdx = (idx + 1) % rounds.length;
        const nextRound = rounds[nextIdx];
        round.isT = Boolean(nextRound && ['和', 'Tie', 'T'].includes(String(nextRound.result)));
    });
    
    return rounds;
}



// 交換兩局的位置 (已加入詳細日誌記錄)
function swapRounds(rounds, index1, index2) {
    // 確保索引有效且不相同
    if (index1 !== index2 && index1 < rounds.length && index2 < rounds.length) {
        
        // 獲取交換前的兩局牌局物件
        const round1_before = rounds[index1];
        const round2_before = rounds[index2];

        // 如果沒有牌,則顯示 '無牌'
        const cards1_str = (round1_before.cards && round1_before.cards.length > 0)
            ? round1_before.cards.map(c => c.short()).join(' ') 
            : '無牌';
            
        const cards2_str = (round2_before.cards && round2_before.cards.length > 0)
            ? round2_before.cards.map(c => c.short()).join(' ') 
            : '無牌';

        // 產生詳細的日誌訊息
        log(
            `[交換] 第 ${index1 + 1} 局 {${cards1_str}} ↔️ 第 ${index2 + 1} 局 {${cards2_str}}`, 
            'warn'
        );

        // 執行交換
        [rounds[index1], rounds[index2]] = [rounds[index2], rounds[index1]];
    }
}


// 檢查剩餘牌是否能組成敏感局(排列組合測試)
function canFormSensitiveRound(cards) {
    // 至少需要4張牌才能進行一局百家樂
    if (!cards || cards.length < 4) return false;
    
    // 生成所有可能的排列(例如6張牌 = 6! = 720種排列)
    const permutations = generatePermutations(cards);
    
    // 逐一測試每種排列是否能構成敏感局
    for (const perm of permutations) {
        // 為每個排列建立臨時模擬器
        const tempCards = perm.map((c, i) => c.clone(i));
        const sim = new Simulator(tempCards);
        
        // 測試第一局是否為敏感局
        const result = sim.simulate_round(0);
        if (result && result.sensitive) {
            return true; // 找到可行的排列,表示這些牌可以組成敏感局
        }
    }
    
    return false; // 所有排列都無法構成敏感局
}

// 生成陣列的所有排列(遞迴方式)
function generatePermutations(arr) {
    // 基礎情況:1張或0張牌直接返回
    if (arr.length <= 1) return [arr];
    
    const result = [];
    // 取出每一張牌作為第一張
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        // 剩餘的牌
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        // 對剩餘牌進行排列
        const permutations = generatePermutations(remaining);
        
        // 將當前牌與剩餘牌的所有排列組合
        for (const perm of permutations) {
            result.push([current, ...perm]);
        }
    }
    
    return result;
}



const exported = {
    generateShoe_Signal: generateShoe_Signal,
    runAutoColorSwap_Signal: runAutoColorSwap_Signal,
    analyzeRounds: analyze_external_rounds,
    updateSignalConfig: updateSignalConfig,
    syncSignalUiFromConfig: syncUiFromSignalConfig,
    log: log,
    helpers: {
        hasTwoPairs: hasTwoPairs,
        swapFirstTwoCards: swapFirstTwoCards,
        scan_all_sensitive_rounds: scan_all_sensitive_rounds
    },
    Simulator: Simulator,
    ui: {
        generateShoe: generateShoe,
        analyzeSignals: analyzeSignals,
        clearAll: clearAll,
        applySignalConfig: applySignalConfig,
        updateSignalCardCount: updateSignalCardCount,
        clearSignalSelections: clearSignalSelections,
        runAutoColorSwap: runAutoColorSwapFromUI,
        syncUiFromSignalConfig: syncUiFromSignalConfig
    }
};

if (typeof window !== 'undefined') {
    if (!window.Simulator) {
        window.Simulator = Simulator;
    }
    if (!window.SignalSystem) {
        window.SignalSystem = {
            analyze(rounds, _Simulator, config, statusCallback) {
                return analyze_external_rounds(rounds, _Simulator, config || {}, statusCallback);
            }
        };
    }
    const ui = exported.ui;


    if (typeof document !== 'undefined') {
        // Wrap all initialisation logic into a named function so that it can be
        // invoked either on DOMContentLoaded or immediately if the event
        // has already fired. Without this, loading this script after
        // DOMContentLoaded prevents any of these handlers from attaching.
        const __signalUIInit = function() {
            const genBtn = document.getElementById('generateBtn');
            if (genBtn) genBtn.addEventListener('click', ui.generateShoe);
            const clearBtn = document.getElementById('clearBtn');
            if (clearBtn) clearBtn.addEventListener('click', ui.clearAll);
            const applyConfigBtn = document.getElementById('applyConfigBtn');
            if (applyConfigBtn) applyConfigBtn.addEventListener('click', ui.applySignalConfig);
            const autoBtn = document.getElementById('btnAutoColor');
            if (autoBtn) autoBtn.addEventListener('click', ui.runAutoColorSwap);
            const editBtn = document.getElementById('btnEdit');
            if (editBtn) editBtn.addEventListener('click', () => activateEditMode('card'));
            const swapBtn = document.getElementById('btnSwap');
            if (swapBtn) swapBtn.addEventListener('click', executeSwapAction);
            const roundBtn = document.getElementById('btnRound');
            if (roundBtn) roundBtn.addEventListener('click', () => activateEditMode('round'));
            const cutBtn = document.getElementById('btnCut');
            if (cutBtn) cutBtn.addEventListener('click', () => log('切牌功能目前尚未在紅0工具中實作。', 'info'));
            const exportCombinedBtn = document.getElementById('btnExportCombined');
            if (exportCombinedBtn) exportCombinedBtn.addEventListener('click', exportRoundsAsExcel);
            const previewBtn = document.getElementById('btnPreview');
            if (previewBtn) previewBtn.addEventListener('click', previewRoundsInWindow);
            const speechBtn = document.getElementById('btnSpeech');
            if (speechBtn) speechBtn.addEventListener('click', openSpeechAssistant);
            const calcBtn = document.getElementById('btnApplyTools');
            if (calcBtn) calcBtn.addEventListener('click', showCalcTool);
            ensureFloatingWidget();
            const cancelBtn = document.getElementById('btnCancelEdit');
            if (cancelBtn) cancelBtn.addEventListener('click', () => {
                if (!editEnabled) return;
                const hadSelection = EDIT_STATE.mode !== 'none' || EDIT_STATE.first || EDIT_STATE.second;
                resetEditState();
                if (hadSelection) log('已取消編輯。', 'info');
            });
            const applyChangesBtn = document.getElementById('btnApplyChanges');
            if (applyChangesBtn) applyChangesBtn.addEventListener('click', () => {
                if (!editEnabled) {
                    log('請先生成牌靴。', 'error');
                    return;
                }
                refreshAnalysisAndRender();
                resetEditState();
                log('已重新套用並更新統計。', 'success');
            });
            const tableBody = document.getElementById('roundsBody');
            if (tableBody) tableBody.addEventListener('click', handleTableClick);

            document.addEventListener('keydown', (event) => {
                const activeTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
                if (activeTag === 'input' || activeTag === 'textarea' || event.target?.isContentEditable) return;
                if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                if (event.key === 'z' || event.key === 'Z') {
                    if (editBtn && !editBtn.disabled) {
                        event.preventDefault();
                        editBtn.click();
                    }
                } else if (event.key === 'x' || event.key === 'X') {
                    if (swapBtn && !swapBtn.disabled) {
                        event.preventDefault();
                        swapBtn.click();
                    }
                }
            });

            const checkboxes = document.querySelectorAll('.suit-checkbox, .rank-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', ui.updateSignalCardCount);
            });

            // Some UI interactions (especially the rank and suit buttons) are handled
            // by inline bridge code in signals.html. That code toggles CSS
            // classes and synchronises hidden checkboxes, but it doesn't always
            // call updateSignalCardCount directly. To ensure the signal card
            // count stays in sync when a user clicks on a rank or suit button,
            // also attach click listeners to those elements here. These
            // listeners simply call the existing update function after the
            // bridge script finishes its own handling.
            const suitButtonsForUpdate = document.querySelectorAll('.suit-button');
            suitButtonsForUpdate.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Use the globally exposed function if available; fall back to
                    // the ui version. This avoids scoping issues where `ui`
                    // might not yet be initialised when this handler runs.
                    if (typeof window !== 'undefined' && typeof window.updateSignalCardCount === 'function') {
                        window.updateSignalCardCount();
                    } else if (ui && typeof ui.updateSignalCardCount === 'function') {
                        ui.updateSignalCardCount();
                    }
                });
            });
            const rankButtonsForUpdate = document.querySelectorAll('.rank-button');
            rankButtonsForUpdate.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (typeof window !== 'undefined' && typeof window.updateSignalCardCount === 'function') {
                        window.updateSignalCardCount();
                    } else if (ui && typeof ui.updateSignalCardCount === 'function') {
                        ui.updateSignalCardCount();
                    }
                });
            });

            syncUiFromSignalConfig();
            ui.updateSignalCardCount();

            setEditButtonsAvailability(false);
            renderDeckSummary(null);
            log('訊號牌測試系統初始化完成', 'success');
        };
        // Immediately initialise the UI. The script tag is placed at the end of
        // the HTML body, so DOM elements are available at this point. Calling
        // the init function here ensures event handlers are attached even if
        // DOMContentLoaded has already fired. We no longer rely on
        // DOMContentLoaded because this script may be loaded after that event.
        __signalUIInit();
    }
}

// We previously wrapped the entire UI module in an IIFE.  Removing that
// wrapper eliminates the need for a trailing `})();`.  The closing braces
// above terminate the nested `if` blocks.  No additional parentheses are
// required here.
