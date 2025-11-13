// ════════════════════════════════════════════════════════════════
// 訊號牌系統 - 百家樂牌靴生成與分析工具  
// ════════════════════════════════════════════════════════════════
// 
// 【核心功能】
// 1. 自訂訊號牌配置（任意花色 + 數字組合）
// 2. 生成包含敏感局的牌靴
// 3. S 局：敏感局中包含訊號牌，自動調整為莊家勝
// 4. T 局：兩對牌局，下一局自動設為和局
//
// 【重要概念】
// - 訊號牌：使用者自訂的花色+數字組合（例如：紅心10,J,Q,K）
// - 敏感局：交換莊閒前兩張牌會改變結果的局
// - S 局：敏感局 + 包含訊號牌
// - T 局：包含兩對相同數字的牌
//
// ════════════════════════════════════════════════════════════════

const ENABLE_S_LOGS = false;
// 控制性日誌輸出，只在 ENABLE_S_LOGS 開啟時呼叫 log
function sLog(message, type = 'info') {
    if (ENABLE_S_LOGS) log(message, type);
}

const SIGNAL_STORAGE_KEY = 'signal_config';
const VALID_SUITS = ['♠', '♥', '♦', '♣'];
const VALID_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SIGNAL_DEFAULT_CONFIG = { suits: [], ranks: [] };
const SUIT_SYMBOL_TO_LETTER_MAP = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C', 'S': 'S', 'H': 'H', 'D': 'D', 'C': 'C' };
const SUIT_LETTER_TO_SYMBOL_MAP = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SIGNAL_RANKS_ORDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SIGNAL_SUITS_ORDER = ['S','H','D','C'];
const MULTI_PASS_MIN_CARDS = 6;

// 將設定值過濾為允許的內容
function sanitizeConfigArray(values, allowed) {
    if (!Array.isArray(values)) return [];
    const allowSet = new Set(allowed);
    return values.filter(value => allowSet.has(value));
}

// 將傳入設定整理為合法花色/數字
function sanitizeSignalConfig(config) {
    if (!config || typeof config !== 'object') return { suits: [], ranks: [] };
    const suits = sanitizeConfigArray(config.suits, VALID_SUITS);
    const ranks = sanitizeConfigArray(config.ranks, VALID_RANKS);
    return { suits, ranks };
}

// 從 localStorage 讀取先前儲存的訊號設定
function loadInitialSignalConfig() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { ...SIGNAL_DEFAULT_CONFIG };
    }
    try {
        const stored = window.localStorage.getItem(SIGNAL_STORAGE_KEY);
        if (!stored) return { ...SIGNAL_DEFAULT_CONFIG };
        const parsed = JSON.parse(stored);
        const sanitized = sanitizeSignalConfig(parsed);
        return {
            suits: sanitized.suits,
            ranks: sanitized.ranks
        };
    } catch (error) {
        console.warn('Failed to load saved signal config:', error);
        return { ...SIGNAL_DEFAULT_CONFIG };
    }
}

const initialSignalConfig = loadInitialSignalConfig();
let SIGNAL_CONFIG = {
    suits: Array.isArray(initialSignalConfig.suits) ? initialSignalConfig.suits.slice() : [],
    ranks: Array.isArray(initialSignalConfig.ranks) ? initialSignalConfig.ranks.slice() : []
};

// 儲存訊號設定到記憶體與 localStorage
function persistSignalConfig(config) {
    const sanitized = sanitizeSignalConfig(config);
    SIGNAL_CONFIG.suits = sanitized.suits.slice();
    SIGNAL_CONFIG.ranks = sanitized.ranks.slice();
    if (typeof window !== 'undefined') {
        window.__signalConfig = {
            suits: sanitized.suits.slice(),
            ranks: sanitized.ranks.slice()
        };
        try {
            if (window.localStorage) {
                window.localStorage.setItem(SIGNAL_STORAGE_KEY, JSON.stringify(window.__signalConfig));
            }
        } catch (error) {
            console.warn('Failed to persist signal config:', error);
        }
    }
    return {
        suits: SIGNAL_CONFIG.suits.slice(),
        ranks: SIGNAL_CONFIG.ranks.slice()
    };
}

persistSignalConfig(SIGNAL_CONFIG);
// === 標準化的 round 建構函式(來自主程式,保留敏感局資訊)
// 建立包含段別、敏感與卡片明細的 round 物件
function makeRoundInfo(start, cards, result, sensitive) {
    return {
        start_index: start,
        cards: cards,
        result: result,
        sensitive: sensitive,
        segment: null,
        // 提供即時計算花色統計的 getter
        get suit_counts() {
            const counts = new Map();
            for (const card of this.cards) {
                const key = card && card.suit ? card.suit : '未知';
                counts.set(key, (counts.get(key) || 0) + 1);
            }
            return counts;
        },
        // 方便取得本局總張數
        get card_count() {
            return Array.isArray(this.cards) ? this.cards.length : 0;
        }
    };
}


class Card {
    constructor(rank, suit, pos) {
        this.rank = rank;
        this.suit = suit;
        this.pos = pos;
    }
    
    point() {
        const values = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 0, 'J': 0, 'Q': 0, 'K': 0};
        return values[this.rank];
    }

    // 新增一個方法來取得路單顯示值 (T, J, Q, K 顯示為 0)
    roadRank() {
        if (['10', 'J', 'Q', 'K'].includes(this.rank)) {
            return '0';
        }
        return this.rank;
    }
    
    short() {
        const face = this.rank === '10' ? 'T' : this.rank;
        return `${face}${this.suit}`;
    }
    
    isZero() {
        return this.point() === 0;
    }
    
    isSignalCard() {
        const hasSuits = Array.isArray(SIGNAL_CONFIG.suits) && SIGNAL_CONFIG.suits.length > 0;
        const hasRanks = Array.isArray(SIGNAL_CONFIG.ranks) && SIGNAL_CONFIG.ranks.length > 0;
        if (!hasSuits || !hasRanks) return false;
        const suitMatch = SIGNAL_CONFIG.suits.includes(this.suit);
        const rankMatch = SIGNAL_CONFIG.ranks.includes(this.rank);
        return suitMatch && rankMatch;
    }

    clone(newPos = this.pos) {
        const copy = new Card(this.rank, this.suit, newPos);
        if (this.back_color) copy.back_color = this.back_color;
        if (this.color) copy.color = this.color;
        return copy;
    }
}

class Simulator {
    constructor(deck) {
        this.deck = deck;
    }
    
    simulate_round(start, options = {}) {
        const no_swap = options.no_swap || false;
        const d = this.deck;
        let idx = start;
        
        if (idx + 3 >= d.length) return null;
        
        // 前四張牌
        const p1 = d[idx++].point();
        const b1 = d[idx++].point();
        const p2 = d[idx++].point();
        const b2 = d[idx++].point();
        
        let p_tot = (p1 + p2) % 10;
        let b_tot = (b1 + b2) % 10;
        
        const natural = (p_tot >= 8 || b_tot >= 8);
        
        const draw = () => {
            if (idx >= d.length) return false;
            idx++;
            return true;
        };
        
        // 補牌邏輯
        if (!natural) {
            if (p_tot <= 5) {
                if (!draw()) return null;
                const pt = d[idx - 1].point();
                p_tot = (p_tot + pt) % 10;
                
                if (b_tot <= 2) {
                    if (!draw()) return null;
                } else if (b_tot === 3 && pt !== 8) {
                    if (!draw()) return null;
                } else if (b_tot === 4 && [2,3,4,5,6,7].includes(pt)) {
                    if (!draw()) return null;
                } else if (b_tot === 5 && [4,5,6,7].includes(pt)) {
                    if (!draw()) return null;
                } else if (b_tot === 6 && [6,7].includes(pt)) {
                    if (!draw()) return null;
                }
            } else if (b_tot <= 5) {
                if (!draw()) return null;
            }
        }
        
        const res = (p_tot === b_tot) ? '和' : ((p_tot > b_tot) ? '閒' : '莊');
        const used = d.slice(start, idx);
        
        if (no_swap) {
            return {
                start_index: start,
                cards: used,
                result: res,
                sensitive: false
            };
        }
        
        // 檢查敏感性
        const swapInfo = this._swap_result(start);
        const swap_res = swapInfo.result;
        const swap_len = Array.isArray(swapInfo.cards) ? swapInfo.cards.length : 0;
const invalid_swap = (res === '和' && swap_res === '莊');
        const sensitive = ((swap_res !== null) && (swap_res !== res) && (swap_res !== '和') && (swap_len === used.length) && !invalid_swap);
        
        return {
            start_index: start,
            cards: used,
            result: res,
            sensitive: sensitive,
            swap_info: swapInfo
        };
    }
    
    _swap_result(start) {
        let d2 = [...this.deck];
        if (start + 1 >= d2.length) return { result: null, cards: [] };
        
        // 交換第1、2張牌
        [d2[start], d2[start + 1]] = [d2[start + 1], d2[start]];
        
        const sim2 = new Simulator(d2);
        const r2 = sim2.simulate_round(start, { no_swap: true });
        if (!r2) return { result: null, cards: [] };
        
        return {
            result: r2.result,
            cards: Array.isArray(r2.cards) ? r2.cards.slice() : []
        };
    }
}

// 對陣列就地洗牌（Fisher–Yates）
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 建立 8 副牌組並隨機洗勻，包含顏色標記
function build_shuffled_deck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const baseR = [];
    const baseB = [];
    
    for (const s of suits) {
        for (const r of ranks) {
            baseR.push(new Card(r, s, -1));
            baseB.push(new Card(r, s, -1));
        }
    }
    
    let deck = [];
    for (let i = 0; i < 4; i++) {
        deck.push(...baseR.map(c => {
            const card = new Card(c.rank, c.suit, -1);
            card.back_color = 'R';
            return card;
        }));
        deck.push(...baseB.map(c => {
            const card = new Card(c.rank, c.suit, -1);
            card.back_color = 'B';
            return card;
        }));
    }
    
    shuffle(deck);
    deck.forEach((c, i) => c.pos = i);
    return deck;
}

// 模擬莊家補牌流程並回傳最終點數
function computeBankerFinalTotal(cards) {
    if (!Array.isArray(cards) || cards.length < 4) return null;
    let idx = 0;
    const cardPoint = (card) => (card && typeof card.point === 'function') ? card.point() : 0;
    const drawCard = () => (idx < cards.length ? cards[idx++] : null);

    const playerHand = [drawCard(), drawCard(), drawCard(), drawCard()].filter(Boolean);
    if (playerHand.length < 4) return null;

    const [p1, b1, p2, b2] = playerHand;
    let playerTotal = (cardPoint(p1) + cardPoint(p2)) % 10;
    let bankerTotal = (cardPoint(b1) + cardPoint(b2)) % 10;
    const natural = (playerTotal >= 8 || bankerTotal >= 8);

    if (!natural) {
        if (playerTotal <= 5) {
            const playerThird = drawCard();
            if (playerThird) {
                const p3Val = cardPoint(playerThird);
                playerTotal = (playerTotal + p3Val) % 10;
                let needBankerThird = false;
                if (bankerTotal <= 2) needBankerThird = true;
                else if (bankerTotal === 3 && p3Val !== 8) needBankerThird = true;
                else if (bankerTotal === 4 && [2, 3, 4, 5, 6, 7].includes(p3Val)) needBankerThird = true;
                else if (bankerTotal === 5 && [4, 5, 6, 7].includes(p3Val)) needBankerThird = true;
                else if (bankerTotal === 6 && [6, 7].includes(p3Val)) needBankerThird = true;
                if (needBankerThird) {
                    const bankerThird = drawCard();
                    if (bankerThird) {
                        bankerTotal = (bankerTotal + cardPoint(bankerThird)) % 10;
                    }
                }
            }
        } else if (bankerTotal <= 5) {
            const bankerThird = drawCard();
            if (bankerThird) {
                bankerTotal = (bankerTotal + cardPoint(bankerThird)) % 10;
            }
        }
    }

    return bankerTotal;
}

// 判斷敏感局是否因莊家6點違規而需要跳過
function shouldSkipSensitiveRound(round) {
    // 1. 檢查原始結果是否為「莊6點贏」
    const originalHandInfo = computeRoundHands(round.cards || []);
    if (originalHandInfo.bankerTotal === 6 && originalHandInfo.playerTotal <= 5) {
        return true; // 原始結果不合規，直接排除
    }

    // 2. 檢查交換後的結果是否會變成「莊6點贏」
    if (round.sensitive && round.cards && round.cards.length >= 2) {
        // 模擬交換過程
        const temp_cards = round.cards.map(c => c.clone());
        [temp_cards[0], temp_cards[1]] = [temp_cards[1], temp_cards[0]];
        
        // 模擬交換後的結果
        const temp_sim = new Simulator(temp_cards);
        const swapped_result_obj = temp_sim.simulate_round(0, { no_swap: true });
        
        // 如果交換後是莊贏，再進一步計算點數
        if (swapped_result_obj && swapped_result_obj.result === '莊') {
            const swappedHandInfo = computeRoundHands(temp_cards);
            if (swappedHandInfo.bankerTotal === 6 && swappedHandInfo.playerTotal <= 5) {
                return true; // 交換後的結果不合規，排除
            }
        }
    }

    // 3. 如果原始和交換後都沒問題，則不排除
    return false;
}


// 檢查交換後的模擬結果是否會造成莊家6點勝利
function swapProducesBankerSix(round) {
    if (!round || !round.swap_info) return false;
    const swapInfo = round.swap_info;
    if (swapInfo.result !== '莊') return false;
    const cards = Array.isArray(swapInfo.cards) ? swapInfo.cards : [];
    if (cards.length < 5 || cards.length > 6) return false;
    const handInfo = computeRoundHands(cards);
    if (!handInfo || typeof handInfo.playerTotal !== 'number' || typeof handInfo.bankerTotal !== 'number') {
        return false;
    }
    return handInfo.bankerTotal === 6 && handInfo.playerTotal <= 5;
}

// 強制完整驗證：若 A 段仍有違規局，直接丟錯重新洗牌
function ensureNoBannedBankerSixRound(rounds, segment) {
    if (!Array.isArray(rounds)) return;
    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        if (!round) continue;
        if (segment && round.segment !== segment) continue;
        if (shouldSkipSensitiveRound(round)) {
            const idx = (typeof round.display_index === 'number') ? round.display_index : (i + 1);
            const cardsLabel = Array.isArray(round.cards)
                ? round.cards.map(card => (card && typeof card.short === 'function') ? card.short() : '').join(', ')
                : '';
            throw new Error(`第 ${idx} 局為莊家6點且閒家 ≤5點（牌組: ${cardsLabel}），重新生成`);
        }
    }
}

// 掃描所有敏感局，會在這裡就先略過違規局
function scan_all_sensitive_rounds(sim) {
    const out = [];
    const last = sim.deck.length - 1;
    
    for (let i = 0; i < last; i++) {
        const r = sim.simulate_round(i);
        if (r && r.sensitive) {
            const handInfo = computeRoundHands(r.cards || []);
            if (r.result === '莊' && handInfo.bankerTotal === 6) {
                const totalUsed = (handInfo.playerCards?.length || 0) + (handInfo.bankerCards?.length || 0);
                log(`🔍 掃到敏感莊6點: 用牌數=${r.cards?.length ?? 0}, 實際共用=${totalUsed}`, 'info');
            }
            if (shouldSkipSensitiveRound(r)) continue;
            out.push(r);
        }
    }
    
    return out;
}

// 計算S局索引
// 計算每個段別中符合 S 局定義的索引
function compute_sidx_for_segment(rounds, segment = 'A') {
    const S = [];
    for (let i = 0; i < rounds.length - 1; i++) {
        if (rounds[i].segment === segment && rounds[i + 1].result === '莊') {
            S.push(i);
        }
    }
    // 額外檢查最後一局是否能成為S局(下一局是第一局)
    if (rounds.length > 1 && rounds[rounds.length - 1].segment === segment && rounds[0].result === '莊') {
        S.push(rounds.length - 1);
    }
    return S;
}

// 將所有局的牌攤平成單一陣列
function flattenDeckFromRounds(rounds) {
    const deck = [];
    if (!Array.isArray(rounds)) return deck;
    rounds.forEach(round => {
        if (round && Array.isArray(round.cards)) {
            deck.push(...round.cards);
        }
    });
    return deck;
}

// 把卡片轉為顯示用文字（例如: rank+suit 或 short）
function getCardLabel(card) {
    if (!card) return '';
    if (typeof card.short === 'function') return card.short();
    if (typeof card.label === 'string') return card.label;
    // 根據使用者要求，在原始數據中也使用 roadRank 點數，但保留花色
    const rank = card.roadRank(); 
    return `${rank}${card.suit}`;
    const suit = card.suit || '';
    return `${rank}${suit}`;
}

// 根據花色推斷卡片的顏色編碼（紅/藍）
function getCardColorCode(card) {
    if (!card) return '';
    if (card.back_color) return card.back_color;
    const suitLetter = suitLetterFromSymbol(card.suit);
    if (!suitLetter) return '';
    return (suitLetter === 'H' || suitLetter === 'D') ? 'R' : 'B';
}

// 依據牌卡資料決定格子要顯示哪些文字（A→1、10/J/Q/K→0）
function gridValueFromCard(card) {
    if (!card) return '';
    const rank = (card.rank || '').toString().toUpperCase();
    if (!rank) return '';
    if (rank === 'A') return '1';
    if (['10', 'J', 'Q', 'K'].includes(rank)) return '0';
    const parsed = parseInt(rank, 10);
    if (!Number.isNaN(parsed)) return String(parsed);
    return rank;
}

// 判斷手上的牌是否屬於目前設定的訊號牌
function isSignalConfiguredCard(card) {
    if (!card) return false;
    const suits = Array.isArray(SIGNAL_CONFIG?.suits) ? SIGNAL_CONFIG.suits : [];
    const ranks = Array.isArray(SIGNAL_CONFIG?.ranks) ? SIGNAL_CONFIG.ranks : [];
    if (!suits.length || !ranks.length) return false;
    return suits.includes(card.suit) && ranks.includes(card.rank);
}

    /**
     * 對外提供分析能力,供主頁面傳入牌局資料時使用
     * @param {Array} sourceRounds - 來自主頁面的牌局資料
     * @param {Object} [options] - 設定紅0訊號所使用的花色與數字
     * @param {Array<string>} [options.suits]
     * @param {Array<string>} [options.ranks]
     * @param {Function} [statusCallback] - 供主頁面顯示進度用
     * @returns {{ final_rounds: Array, analysis: Object }}
     */
    function analyze_external_rounds(sourceRounds, options = {}, statusCallback) {
        const suits = Array.isArray(options.suits) ? options.suits.slice() : SIGNAL_CONFIG.suits.slice();
        const ranks = Array.isArray(options.ranks) ? options.ranks.slice() : SIGNAL_CONFIG.ranks.slice();

        SIGNAL_CONFIG.suits = suits;
        SIGNAL_CONFIG.ranks = ranks;

        const rounds = Array.isArray(sourceRounds) ? sourceRounds.map((round, idx) => {
            const clonedRound = Object.assign({}, round);
            const startIndex = typeof round.start_index === 'number' ? round.start_index : idx * 4;

            clonedRound.cards = Array.isArray(round.cards)
                ? round.cards.map((card, cardIdx) => {
                    if (!card) return card;
                    if (card instanceof Card) {
                        return card.clone();
                    }
                    const pos = typeof card.pos === 'number' ? card.pos : startIndex + cardIdx;
                    const newCard = new Card(card.rank, card.suit, pos);
                    Object.keys(card).forEach((key) => {
                        if (key === 'rank' || key === 'suit' || key === 'pos') return;
                        newCard[key] = card[key];
                    });
                    return newCard;
                })
                : [];

            return clonedRound;
        }) : [];

        if (typeof statusCallback === 'function') {
            statusCallback(`紅0 模式:開始分析 ${rounds.length} 局資料...`);
        }

        const processedRounds = applyTSignalLogic(rounds);
        ensureNoBannedBankerSixRound(processedRounds, 'A');

        const analysis = analyze_signal_cards(processedRounds);

        if (typeof statusCallback === 'function') {
            statusCallback(`紅0 模式:完成分析,調整 ${analysis.adjustments_made} 局。`);
        }

        return {
            final_rounds: processedRounds,
            analysis
        };
    }

// 模擬交換前兩張牌的結果
function swapFirstTwoCards(round) {
    if (!round.cards || round.cards.length < 2) return null;
    
    // 創建副本進行模擬
    const temp_cards = round.cards.map(c => c.clone());
    [temp_cards[0], temp_cards[1]] = [temp_cards[1], temp_cards[0]];
    
    // 重新模擬這局
    const temp_sim = new Simulator(temp_cards);
    const temp_result = temp_sim.simulate_round(0, { no_swap: true });
    
    return temp_result ? temp_result.result : null;
}

// 執行實際的卡牌交換
function executeCardSwap(round) {
    if (!round.cards || round.cards.length < 2) return;
    [round.cards[0], round.cards[1]] = [round.cards[1], round.cards[0]];
}

// 檢查是否有兩對
function hasTwoPairs(round) {
    if (!round.cards || round.cards.length < 4) return false;
    
    // 統計每種數字的張數
    const rankCounts = {};
    for (const card of round.cards) {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }
    
    // 檢查是否有至少兩個「剛好」一對(避免 AAA22 被視為兩對)
    const pairs = Object.values(rankCounts).filter(count => count === 2);
    return pairs.length >= 2;
}


// 日誌系統
const LOG_ALLOW_PATTERNS = [
    /^訊號牌測試系統初始化完成/,
    /^訊號設定已更新/,
    /^\s*🔍 /,
    /^\[交換\]/,
    /^生成完成!?$/,
    /^S局訊號牌張數/,
    /^第\d+局\(非S\)：有/,
    /^卡色交換成功/
];

function shouldDisplayLogMessage(message, type = 'info') {
    if (type === 'error') return true;
    if (typeof message !== 'string') return false;
    return LOG_ALLOW_PATTERNS.some(pattern => pattern.test(message));
}

// 中央日誌輸出，會篩選後才寫入畫面
function log(message, type = 'info') {
    if (!shouldDisplayLogMessage(message, type)) return;
    
    const logArea = document.getElementById('logArea');
    const timestamp = new Date().toLocaleTimeString();
    if (logArea) {
        const logEntry = document.createElement('div');
        logEntry.className = type;
        logEntry.textContent = `[${timestamp}] ${message}`;
        logArea.appendChild(logEntry);
        logArea.scrollTop = logArea.scrollHeight;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 更新統計
// 更新統計指標顯示桿的值
function updateStats(data) {
    // 安全更新元素 - 只有元素存在時才更新
    const totalRoundsEl = document.getElementById('totalRounds');
    if (totalRoundsEl) totalRoundsEl.textContent = data.totalRounds || 0;
    
    const bankerCountEl = document.getElementById('bankerCount');
    if (bankerCountEl) bankerCountEl.textContent = data.bankerCount || 0;
    
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl) playerCountEl.textContent = data.playerCount || 0;
    
    const tieCountEl = document.getElementById('tieCount');
    if (tieCountEl) tieCountEl.textContent = data.tieCount || 0;
    
    const sSignalCardsEl = document.getElementById('sSignalCards');
    if (sSignalCardsEl) sSignalCardsEl.textContent = data.sSignalCards || 0;
    
    const nonSSignals = data.nonSSignalCards ?? data.tSignalCards ?? 0;
    const tSignalCardsEl = document.getElementById('tSignalCards');
    if (tSignalCardsEl) tSignalCardsEl.textContent = nonSSignals;
    
    const twoPairsCountEl = document.getElementById('twoPairsCount');
    if (twoPairsCountEl) twoPairsCountEl.textContent = data.twoPairsCount || 0;

    updateResultCircle({
        totalRounds: data.totalRounds || 0,
        bankerCount: data.bankerCount || 0,
        playerCount: data.playerCount || 0,
        tieCount: data.tieCount || 0
    });
}

function updateResultCircle({ totalRounds, bankerCount, playerCount, tieCount }) {
    const circle = document.getElementById('resultCircle');
    const circleBanker = document.getElementById('circleBankerCount');
    const circlePlayer = document.getElementById('circlePlayerCount');
    const circleTie = document.getElementById('circleTieCount');
    const circleBankerLabel = document.getElementById('circleBankerLabel');
    const circlePlayerLabel = document.getElementById('circlePlayerLabel');
    const circleTieLabel = document.getElementById('circleTieLabel');
    const circleTotal = document.getElementById('circleTotal');

    if (circleTotal) {
        circleTotal.textContent = totalRounds > 0 ? totalRounds : '';
    }
    if (circleBanker) {
        circleBanker.textContent = bankerCount;
    }
    if (circlePlayer) {
        circlePlayer.textContent = playerCount;
    }
    if (circleTie) {
        circleTie.textContent = tieCount;
    }
    if (circleBankerLabel) {
        circleBankerLabel.textContent = bankerCount;
    }
    if (circlePlayerLabel) {
        circlePlayerLabel.textContent = playerCount;
    }
    if (circleTieLabel) {
        circleTieLabel.textContent = tieCount;
    }

    if (!circle) return;
    const total = bankerCount + playerCount + tieCount;
    const showCircleCenter = Boolean(totalRounds);
    circle.classList.toggle('result-circle--empty', !showCircleCenter);
    if (!total) {
        circle.style.backgroundImage = 'linear-gradient(180deg,#0e1420,#0e1420)';
        return;
    }

    const segments = [
        { value: bankerCount, color: '#fdecea' },
        { value: playerCount, color: '#e3f2fd' },
        { value: tieCount, color: '#e8f5e9' }
    ];
    let start = 0;
    const stops = [];
    const positions = [];
    segments.forEach(seg => {
        if (!seg.value) return;
        const span = (seg.value / total) * 360;
        const end = start + span;
        const middle = start + span / 2; // 計算區段中間角度
        stops.push(`${seg.color} ${start}deg ${end}deg`);
        positions.push(middle);
        start = end;
    });
    circle.style.backgroundImage = `conic-gradient(${stops.join(', ')})`;
    
    // 動態調整標籤位置到各區段中間
    const radius = 32; // 標籤距離圓心的距離（百分比）- 調小讓數字更靠近圓心
    
    if (circleBankerLabel && positions[0] !== undefined) {
        const angle = (positions[0] - 90) * Math.PI / 180; // 轉換為弧度，-90度讓0度從上方開始
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        circleBankerLabel.style.left = `${x}%`;
        circleBankerLabel.style.top = `${y}%`;
        circleBankerLabel.style.transform = 'translate(-50%, -50%)';
    }
    
    if (circlePlayerLabel && positions[1] !== undefined) {
        const angle = (positions[1] - 90) * Math.PI / 180;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        circlePlayerLabel.style.left = `${x}%`;
        circlePlayerLabel.style.top = `${y}%`;
        circlePlayerLabel.style.transform = 'translate(-50%, -50%)';
    }
    
    if (circleTieLabel && positions[2] !== undefined) {
        const angle = (positions[2] - 90) * Math.PI / 180;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        circleTieLabel.style.left = `${x}%`;
        circleTieLabel.style.top = `${y}%`;
        circleTieLabel.style.transform = 'translate(-50%, -50%)';
    }
}

// 將一局的卡片轉成「A♠ ...」的字串備用
function formatHandDisplay(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return '<span class="card-label card-label-empty non-s-signal-card">--</span>';
    }

    return cards.map(card => {
        const cardText = (card && typeof card.short === 'function') ? card.short() : '--';

        const classes = ['card-label'];

        if (card && typeof card.isSignalCard === 'function' && card.isSignalCard()) {
            classes.push('s-signal-card');
        } else {
            classes.push('non-s-signal-card');
        }

        if (card && card.back_color === 'R') {
            classes.push('card-back-red');
        } else if (card && card.back_color === 'B') {
            classes.push('card-back-blue');
        } else {
            classes.push('card-back-unknown');
        }

        return `<span class="${classes.join(' ')}">${cardText}</span>`;
    }).join('');
}

// 計算一輪牌的總點數與站點視窗信息
function computeRoundHands(cards) {
    const playerCards = [];
    const bankerCards = [];
    const getPoint = (card) => (card && typeof card.point === 'function') ? card.point() : 0;
    if (!Array.isArray(cards) || cards.length < 4) {
        return { playerCards, bankerCards, playerTotal: null, bankerTotal: null };
    }

    const seq = cards.slice();
    let idx = 0;
    const draw = () => {
        if (idx >= seq.length) return null;
        return seq[idx++];
    };

    const assign = (target, card) => {
        if (card) target.push(card);
        return card;
    };

    const p1 = assign(playerCards, draw());
    const b1 = assign(bankerCards, draw());
    const p2 = assign(playerCards, draw());
    const b2 = assign(bankerCards, draw());

    let p_tot = (getPoint(p1) + getPoint(p2)) % 10;
    let b_tot = (getPoint(b1) + getPoint(b2)) % 10;
    const natural = (p_tot >= 8 || b_tot >= 8);

    if (!natural) {
        if (p_tot <= 5) {
            const p3 = assign(playerCards, draw());
            const pt = getPoint(p3);
            if (p3) {
                p_tot = (p_tot + pt) % 10;
                let bankerDraw = false;
                if (b_tot <= 2) bankerDraw = true;
                else if (b_tot === 3 && pt !== 8) bankerDraw = true;
                else if (b_tot === 4 && [2,3,4,5,6,7].includes(pt)) bankerDraw = true;
                else if (b_tot === 5 && [4,5,6,7].includes(pt)) bankerDraw = true;
                else if (b_tot === 6 && [6,7].includes(pt)) bankerDraw = true;
                if (bankerDraw) {
                    const b3 = assign(bankerCards, draw());
                    if (b3) {
                        b_tot = (b_tot + getPoint(b3)) % 10;
                    }
                }
            }
        } else if (b_tot <= 5) {
            const b3 = assign(bankerCards, draw());
            if (b3) {
                b_tot = (b_tot + getPoint(b3)) % 10;
            }
        }
    }

    return {
        playerCards,
        bankerCards,
        playerTotal: playerCards.length ? p_tot : null,
        bankerTotal: bankerCards.length ? b_tot : null
    };
}

// 重新依據實際牌組決定這局的結果文字與註記
function recomputeRoundOutcome(round) {
    if (!round || !Array.isArray(round.cards)) return;
    const handInfo = computeRoundHands(round.cards);
    const p = handInfo.playerTotal;
    const b = handInfo.bankerTotal;
    if (typeof p !== 'number' || typeof b !== 'number') return;
    if (p === b) {
        round.result = '和';
    } else if (p > b) {
        round.result = '閒';
    } else {
        round.result = '莊';
    }
}

// ==================================================================
// === 請用這個新版本,替換掉您 signals.js 裡的舊版本 ===
// ==================================================================
const ROUNDS_TABLE_COLUMNS = [
    { key: 'index', label: '局', cellClass: 'minor-column' },
    { key: 'segment', label: '段', cellClass: 'minor-column' },
    { key: 'cards', label: '卡牌', headerClass: 'cards-column', cellClass: 'cards-column' },
    { key: 'colors', label: '卡色', headerClass: 'color-column', cellClass: 'color-column' },
    { key: 'result', label: '結果', cellClass: 'result-cell' },
    { key: 'playerCards', label: '閒家牌', cellClass: 'hand-card-cell' },
    { key: 'bankerCards', label: '莊家牌', cellClass: 'hand-card-cell' },
    { key: 'playerPoints', label: '閒', cellClass: 'hand-point-cell minor-column' },
    { key: 'bankerPoints', label: '莊', cellClass: 'hand-point-cell minor-column' },
    { key: 'swapPreview', label: '前後', cellClass: 'compare-cell' }
];

// 將結果文字統一為標準的「莊/閒/和」
function normalizeOutcome(value) {
    if (value === undefined || value === null) return null;
    const txt = String(value).trim();
    if (!txt) return null;
    if (['莊', 'B', 'Banker'].includes(txt)) return 'banker';
    if (['閒', 'P', 'Player'].includes(txt)) return 'player';
    if (['和', 'T', 'Tie'].includes(txt)) return 'tie';
    return null;
}

// 根據結果回傳對應的 CSS class
function outcomeClass(value) {
    const type = normalizeOutcome(value);
    return type ? `outcome-${type}` : '';
}

// 產生 rounds table 的表頭 DOM
function renderRoundsTableHeader() {
    const head = document.getElementById('roundsHead');
    if (!head) return;
    const headerHtml = ROUNDS_TABLE_COLUMNS.map(col => {
        const headerClass = col.headerClass ? ` class="${col.headerClass}"` : '';
        return `<th${headerClass}>${col.label}</th>`;
    }).join('');
    head.innerHTML = `<tr>${headerHtml}</tr>`;
}

// 根據上一輪分析渲染 table 的身體
function renderRoundsTable(rounds, analysis) {
    const table = document.getElementById('roundsTable');
    const tbody = document.getElementById('roundsBody');
    
    renderRoundsTableHeader();
    tbody.innerHTML = '';
    
    if (!rounds || rounds.length === 0) {
        table.style.display = 'none';
        return;
    }
    
    const tieIndices = new Set();
    rounds.forEach((round, index) => {
        if (round.result === '和') {
            tieIndices.add(index);
        }
    });

    rounds.forEach((round, index) => {
        const row = document.createElement('tr');
        
        const isTwoPairsRound = hasTwoPairs(round);
        if (isTwoPairsRound) {
            row.classList.add('two-pairs-round');
        }
        
        const segmentLabel = round.segment || '';
        const segmentMap = { A: 'A', B: 'B', C: 'C' };
        let typeDisplay = segmentMap[segmentLabel] || segmentLabel || '一般';
        const nextIndex = (index + 1) % rounds.length;
        if (tieIndices.has(nextIndex)) {
            typeDisplay = segmentLabel ? segmentMap[segmentLabel] || segmentLabel : 'T段';
        } else if (segmentLabel) {
            typeDisplay = segmentMap[segmentLabel] || segmentLabel;
        }

        const cards_html = (round.cards || []).map((card, cardIdx) => {
            if (!card) {
                return `<span class="card-label non-s-signal-card" data-action="card" data-r="${index}" data-c="${cardIdx}">--</span>`;
            }
            const classes = ['card-label'];
            
            if (card.back_color === 'B') {
                classes.push('card-back-blue');
            } else if (card.back_color === 'R') {
                classes.push('card-back-red');
            } else {
                classes.push('card-back-unknown');
            }

            const isSignalCard = typeof card.isSignalCard === 'function' && card.isSignalCard();
            if (isSignalCard) {
                classes.push('s-signal-card');
            } else {
                classes.push('non-s-signal-card');
            }

            return `<span class="${classes.join(' ')}" data-action="card" data-r="${index}" data-c="${cardIdx}">${card.short()}</span>`;
        }).join('');
        const cardsCell = `<span class="card-strip">${cards_html}</span>`;
        
        const swapped_result = swapFirstTwoCards(round);
        const swapped_display = swapped_result || '無法對調';
        
        const chipCount = 6;
        const colorChips = Array.from({ length: chipCount }, (_, chipIndex) => {
            const card = round.cards && round.cards[chipIndex] ? round.cards[chipIndex] : null;
            if (!card) {
                return `<span class="color-chip unknown"></span>`;
            }
            const color = card.back_color === 'R' ? 'red' : card.back_color === 'B' ? 'blue' : 'unknown';
            const label = card.back_color === 'R' ? 'X' : card.back_color === 'B' ? 'O' : '';
            return `<span class="color-chip ${color}">${label}</span>`;
        }).join('');
        const colorCell = `<span class="color-chips">${colorChips}</span>`;

        const handInfo = computeRoundHands(round.cards || []);
        const playerHandText = `<span class="hand-chip-strip">${formatHandDisplay(handInfo.playerCards)}</span>`;
        const bankerHandText = `<span class="hand-chip-strip">${formatHandDisplay(handInfo.bankerCards)}</span>`;
        const playerPoints = typeof handInfo.playerTotal === 'number' ? handInfo.playerTotal : '';
        const bankerPoints = typeof handInfo.bankerTotal === 'number' ? handInfo.bankerTotal : '';
        
        const resultDisplay = round.result || '';
        const resultClass = outcomeClass(resultDisplay);
        const swapOutcomeClass = outcomeClass(swapped_display);
        
        const hasSignalCard = round.cards && round.cards.some(card => typeof card.isSignalCard === 'function' && card.isSignalCard());
        if (hasSignalCard) {
            row.classList.add('s-signal-round');
        }
        if (round.isT) {
            row.classList.add('two-pairs-round');
        }
        
        const columnContent = {
            index: index + 1,
            segment: typeDisplay,
            cards: cardsCell,
            colors: colorCell,
            result: resultDisplay,
            playerCards: playerHandText,
            bankerCards: bankerHandText,
            playerPoints,
            bankerPoints,
            swapPreview: swapped_display
        };
        const rowHtml = ROUNDS_TABLE_COLUMNS.map(col => {
            const classes = [];
            if (col.cellClass) classes.push(col.cellClass);
            if (col.key === 'result' && resultClass) classes.push(resultClass);
            if (col.key === 'swapPreview' && swapOutcomeClass) classes.push(swapOutcomeClass);
            const content = columnContent[col.key];
            const cellContent = (content === undefined || content === null) ? '' : content;
            const isBankerSixCell = col.key === 'bankerPoints' && Number(cellContent) === 6;
            if (isBankerSixCell) {
                classes.push('banker-six-point');
            }
            const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
            return `<td${classAttr}>${cellContent}</td>`;
        }).join('');
        row.innerHTML = rowHtml;
        row.dataset.r = index;
        row.classList.add('round-row');

        tbody.appendChild(row);
    });
    
    table.style.display = 'table';
    updateSelectionHighlights();
    updateEditUI();
}


// 全域變數
let currentRounds = null;
let currentAnalysis = null;
const EDIT_STATE = { mode: 'none', first: null, second: null };
let editEnabled = false;

// 控制編輯相關按鈕的可用狀態
function setEditButtonsAvailability(enabled) {
    editEnabled = Boolean(enabled);
    if (!editEnabled) {
        EDIT_STATE.mode = 'none';
        EDIT_STATE.first = null;
        EDIT_STATE.second = null;
    }
    updateEditUI();
    updateSelectionHighlights();
}

// 更新右側編輯工具的按鈕狀態與提示
function updateEditUI() {
    const canModify = editEnabled && Array.isArray(currentRounds) && currentRounds.length > 0;
    const btnEdit = document.getElementById('btnEdit');
    const btnRound = document.getElementById('btnRound');
    const btnSwap = document.getElementById('btnSwap');
    const btnCancel = document.getElementById('btnCancelEdit');
    const btnApply = document.getElementById('btnApplyChanges');
    if (btnEdit) {
        btnEdit.disabled = !canModify;
        btnEdit.classList.toggle('active', canModify && EDIT_STATE.mode === 'card');
    }
    if (btnRound) {
        btnRound.disabled = !canModify;
        btnRound.classList.toggle('active', canModify && EDIT_STATE.mode === 'round');
    }
    const hasFirst = Boolean(EDIT_STATE.first);
    const hasSecond = Boolean(EDIT_STATE.second);
    if (btnSwap) {
        const swapReady = canModify && EDIT_STATE.mode !== 'none' && hasFirst && hasSecond;
        btnSwap.disabled = !swapReady;
    }
    if (btnCancel) {
        const canCancel = canModify && (EDIT_STATE.mode !== 'none' || hasFirst || hasSecond);
        btnCancel.disabled = !canCancel;
    }
    if (btnApply) {
        btnApply.disabled = !canModify;
    }
    if (typeof document !== 'undefined' && document.body) {
        const zoomEnabled = canModify && EDIT_STATE.mode !== 'none';
        document.body.classList.toggle('table-zoom', zoomEnabled);
    }
}

// 同步表格選取的高亮樣式
function updateSelectionHighlights() {
    const cardEls = document.querySelectorAll('#roundsBody span[data-action="card"]');
    cardEls.forEach(el => {
        el.classList.remove('selected-first', 'selected-second');
    });
    const rowEls = document.querySelectorAll('#roundsBody tr[data-r]');
    rowEls.forEach(row => {
        row.classList.remove('selected-first', 'selected-second');
    });
    if (!editEnabled) return;
    if (EDIT_STATE.mode === 'card') {
        if (EDIT_STATE.first) {
            const el = document.querySelector(`#roundsBody span[data-action="card"][data-r="${EDIT_STATE.first.r}"][data-c="${EDIT_STATE.first.c}"]`);
            if (el) el.classList.add('selected-first');
        }
        if (EDIT_STATE.second) {
            const el = document.querySelector(`#roundsBody span[data-action="card"][data-r="${EDIT_STATE.second.r}"][data-c="${EDIT_STATE.second.c}"]`);
            if (el) el.classList.add('selected-second');
        }
    } else if (EDIT_STATE.mode === 'round') {
        if (EDIT_STATE.first) {
            const row = document.querySelector(`#roundsBody tr[data-r="${EDIT_STATE.first.r}"]`);
            if (row) row.classList.add('selected-first');
        }
        if (EDIT_STATE.second) {
            const row = document.querySelector(`#roundsBody tr[data-r="${EDIT_STATE.second.r}"]`);
            if (row) row.classList.add('selected-second');
        }
    }
}

// 將花色符號轉成信號用的單字母
function suitLetterFromSymbol(symbol) {
    if (!symbol) return null;
    return SUIT_SYMBOL_TO_LETTER_MAP[symbol] || SUIT_SYMBOL_TO_LETTER_MAP[symbol.toUpperCase()] || null;
}

// 統計符合條件的訊號牌在所有局中的數量
function countSignalCardsInRounds(rounds, predicate) {
    if (!Array.isArray(rounds) || rounds.length === 0) return 0;
    let total = 0;
    rounds.forEach((round, idx) => {
        if (!round || !Array.isArray(round.cards)) return;
        if (typeof predicate === 'function' && !predicate(round, idx)) return;
        for (const card of round.cards) {
            if (!card) continue;
            const fallbackSignal = SIGNAL_CONFIG.suits.includes(card.suit) && SIGNAL_CONFIG.ranks.includes(card.rank);
            const isSignal = typeof card.isSignalCard === 'function'
                ? card.isSignalCard()
                : fallbackSignal;
            if (isSignal) total++;
        }
    });
    return total;
}

// 建立牌靴整體統計（勝率、段落、訊號牌數）
function computeDeckSummary(rounds) {
    if (!Array.isArray(rounds) || rounds.length === 0) return null;
    const seenUnique = new Set(); // 避免重複計算同一張實體卡牌
    const uniqueCards = [];
    const pushCard = (card) => {
        if (!card) return;
        const pos = card.pos;
        if (pos !== undefined && pos !== null) {
            if (seenUnique.has(pos)) return;
            seenUnique.add(pos);
        } else {
            const fallbackKey = `${card.suit || ''}_${card.rank || ''}_${card.label || ''}_${card.short ? card.short() : ''}`;
            if (seenUnique.has(fallbackKey)) return;
            seenUnique.add(fallbackKey);
        }
        uniqueCards.push(card);
    };
    rounds.forEach(round => {
        (round.cards || []).forEach(pushCard);
    });
    const byRankSuit = {}; // 花色 + 點數 -> 張數
    const cardsByRankSuit = {}; // 花色 + 點數 -> 實際卡牌陣列,用來計算紅背/藍背
    const suitTotals = {}; // 每個花色的總張數
    uniqueCards.forEach(card => {
        const suitLetter = suitLetterFromSymbol(card.suit);
        const rank = card.rank || null;
        if (!suitLetter || !rank) return;
        const key = `${suitLetter}_${rank}`;
        byRankSuit[key] = (byRankSuit[key] || 0) + 1;
        if (!cardsByRankSuit[key]) cardsByRankSuit[key] = [];
        cardsByRankSuit[key].push(card);
        suitTotals[suitLetter] = (suitTotals[suitLetter] || 0) + 1;
    });
    return {
        by_rank_suit: byRankSuit,
        suit_totals: suitTotals,
        cards_by_rank_suit: cardsByRankSuit,
        total_cards: uniqueCards.length
    };
}

// 在右側摘要卡片填入計算後的統計數據
function renderDeckSummary(summary) {
    const container = document.getElementById('signalSummary');
    if (!container) return;
    if (!summary || !summary.by_rank_suit) {
        container.innerHTML = '';
        return;
    }
    const ranks = SIGNAL_RANKS_ORDER; // 牌面順序
    const suits = SIGNAL_SUITS_ORDER; // 花色順序
    const byRankSuit = summary.by_rank_suit;
    const cardsByRankSuit = summary.cards_by_rank_suit || {};
    const suitTotals = summary.suit_totals || {};
    let html = '<div class="summary-title">牌靴分布</div>';
    html += '<table class="stats-table signal-table"><thead><tr><th></th>';
    html += ranks.map(r => `<th>${r}</th>`).join('');
    html += '<th>合計</th></tr></thead><tbody>';
    for (const suit of suits) { // 逐花色列出
        const symbol = SUIT_LETTER_TO_SYMBOL_MAP[suit] || suit;
        html += `<tr><td>${symbol}</td>`;
        let rowTotal = 0;
        for (const rank of ranks) {
            const key = `${suit}_${rank}`;
            const val = byRankSuit[key] || 0; // 此花色 + 點數的張數
            rowTotal += val;
            let black = 0, red = 0;
            if (val && cardsByRankSuit[key]) {
                for (const card of cardsByRankSuit[key]) { // 計算紅背 / 藍背張數
                    if (card.color === 'B' || card.back_color === 'B') black++;
                    else if (card.color === 'R' || card.back_color === 'R') red++;
                }
            }
            html += `<td>${black}/${red}</td>`;
        }
        html += `<td>${rowTotal}</td></tr>`;
    }
    const columnTotals = {};
    for (const rank of ranks) {
        columnTotals[rank] = 0;
        for (const suit of suits) {
            columnTotals[rank] += byRankSuit[`${suit}_${rank}`] || 0;
        }
    }
    html += '<tr><td>合計</td>';
    for (const rank of ranks) {
        html += `<td>${columnTotals[rank] || 0}</td>`;
    }
    const totalCards = summary.total_cards || 0; // 全部統計到的實體卡張數
    html += `<td>${totalCards}</td></tr>`;
    html += '</tbody></table>';
    html += `<div class="stats-total">牌靴總張數:<strong>${totalCards}/416</strong></div>`;
    container.innerHTML = html;
}

// 重設編輯狀態與按鈕
function resetEditState() {
    EDIT_STATE.mode = 'none';
    EDIT_STATE.first = null;
    EDIT_STATE.second = null;
    updateEditUI();
    updateSelectionHighlights();
}

// 啟動某種編輯模式（交換/拖移等）
function activateEditMode(mode) {
    if (!editEnabled || !Array.isArray(currentRounds) || currentRounds.length === 0) {
        log('請先生成牌靴,再進行編輯。', 'error');
        return;
    }
    if (EDIT_STATE.mode === mode) {
        resetEditState();
        return;
    }
    EDIT_STATE.mode = mode;
    EDIT_STATE.first = null;
    EDIT_STATE.second = null;
    updateEditUI();
    updateSelectionHighlights();
    if (mode === 'card') {
        log('編輯模式:請點選第一張牌。', 'info');
    } else if (mode === 'round') {
        log('局交換模式:請點選第一局。', 'info');
    }
}

// 處理表格中某個卡片的選取事件
function handleCardSelection(r, c) {
    if (EDIT_STATE.mode !== 'card' || !editEnabled) return;
    if (!EDIT_STATE.first || (EDIT_STATE.first && EDIT_STATE.second)) {
        EDIT_STATE.first = { r, c };
        EDIT_STATE.second = null;
    } else if (EDIT_STATE.first && EDIT_STATE.first.r === r && EDIT_STATE.first.c === c) {
        EDIT_STATE.first = null;
    } else if (!EDIT_STATE.second) {
        EDIT_STATE.second = { r, c };
    } else {
        EDIT_STATE.first = { r, c };
        EDIT_STATE.second = null;
    }
    updateEditUI();
    updateSelectionHighlights();
}

// 處理整行的選取（標示與高亮）
function handleRowSelection(r) {
    if (EDIT_STATE.mode !== 'round' || !editEnabled) return;
    if (!EDIT_STATE.first || (EDIT_STATE.first && EDIT_STATE.second)) {
        EDIT_STATE.first = { r };
        EDIT_STATE.second = null;
    } else if (EDIT_STATE.first && EDIT_STATE.first.r === r) {
        EDIT_STATE.first = null;
    } else if (!EDIT_STATE.second) {
        EDIT_STATE.second = { r };
    } else {
        EDIT_STATE.first = { r };
        EDIT_STATE.second = null;
    }
    updateEditUI();
    updateSelectionHighlights();
}

// 錨點表格的各種 click 行為
function handleTableClick(event) {
    if (!editEnabled) return;
    const cardSpan = event.target.closest('span[data-action="card"]');
    if (cardSpan) {
        const r = Number(cardSpan.dataset.r);
        const c = Number(cardSpan.dataset.c);
        handleCardSelection(r, c);
        return;
    }
    const row = event.target.closest('tr[data-r]');
    if (row) {
        const r = Number(row.dataset.r);
        handleRowSelection(r);
    }
}

// 執行目前選取的交換動作
function executeSwapAction() {
    if (!editEnabled || !Array.isArray(currentRounds) || currentRounds.length === 0) {
        log('請先生成牌靴,再進行編輯。', 'error');
        return;
    }
    if (EDIT_STATE.mode === 'card') {
        if (!EDIT_STATE.first || !EDIT_STATE.second) {
            log('請先選擇兩張要交換的牌。', 'warn');
            return;
        }
        const { r: r1, c: c1 } = EDIT_STATE.first;
        const { r: r2, c: c2 } = EDIT_STATE.second;
        const cardA = currentRounds?.[r1]?.cards?.[c1];
        const cardB = currentRounds?.[r2]?.cards?.[c2];
        if (!cardA || !cardB) {
            log('卡交換失敗:選取的牌不存在。', 'error');
            return;
        }
        [currentRounds[r1].cards[c1], currentRounds[r2].cards[c2]] = [cardB, cardA];
        recomputeRoundOutcome(currentRounds[r1]);
        recomputeRoundOutcome(currentRounds[r2]);
        log(`已交換第 ${r1 + 1} 局第 ${c1 + 1} 張與第 ${r2 + 1} 局第 ${c2 + 1} 張。`, 'success');
        EDIT_STATE.first = null;
        EDIT_STATE.second = null;
        refreshAnalysisAndRender();
        updateEditUI();
        updateSelectionHighlights();
    } else if (EDIT_STATE.mode === 'round') {
        if (!EDIT_STATE.first || !EDIT_STATE.second) {
            log('請先選擇兩個要交換的局。', 'warn');
            return;
        }
        const r1 = EDIT_STATE.first.r;
        const r2 = EDIT_STATE.second.r;
        if (r1 === r2) {
            log('同一局不需要交換。', 'info');
            return;
        }
        const roundA = currentRounds?.[r1];
        const roundB = currentRounds?.[r2];
        if (!roundA || !roundB) {
            log('局交換失敗:找不到指定的局。', 'error');
            return;
        }
        [currentRounds[r1], currentRounds[r2]] = [roundB, roundA];
        log(`已交換第 ${r1 + 1} 局與第 ${r2 + 1} 局。`, 'success');
        EDIT_STATE.first = null;
        EDIT_STATE.second = null;
        refreshAnalysisAndRender();
        updateEditUI();
        updateSelectionHighlights();
    } else {
        log('請先選擇編輯或局交換模式。', 'info');
    }
}

// 簡化版紅色0點牌訊號邏輯
// 分析每局訊號牌位置、T局與 S 局統計資料
function analyze_signal_cards(rounds, options = {}) {
    const mutate = options.mutate !== false;
    sLog('使用簡化版邏輯:有紅色0點牌的局 → 下一局變莊家');
    
    let adjustments = 0;
    let signal_rounds = 0;
    
    for (let i = 0; i < rounds.length - 1; i++) {
        const current_round = rounds[i];
        const next_round = rounds[i + 1];
        if (!current_round.cards) continue;
        if (current_round.isT) {
            sLog(`第${i + 1}局是T局,跳過S局訊號處理`);
            continue;
        }
        const has_signal = current_round.cards.some(card => card.isSignalCard());
        if (has_signal) {
            signal_rounds++;
            if (next_round.result !== '莊') {
                const swapped_result = swapFirstTwoCards(next_round);
                if (swapped_result === '莊') {
                    adjustments++;
                    if (mutate) {
                        executeCardSwap(next_round);
                        const original_result = next_round.result;
                        next_round.result = '莊';
                        next_round.swapped = true;
                        sLog(`第${i+1}局有紅色0點牌 → 第${i+2}局:${original_result} → 莊`);
                    }
                } else {
                    sLog(`第${i+1}局有紅色0點牌,但第${i+2}局無法調整為莊家`, 'warn');
                }
            }
        } else if (next_round.result === '莊') {
            const swapped_result = swapFirstTwoCards(next_round);
            if (swapped_result !== '莊' && swapped_result !== '和') {
                adjustments++;
                if (mutate) {
                    executeCardSwap(next_round);
                    next_round.result = swapped_result;
                    next_round.swapped = true;
                    sLog(`第${i+1}局無紅色0點牌 → 第${i+2}局:莊 → ${swapped_result}`);
                }
            }
        }
    }
    
    if (rounds.length > 1) {
        const last_round = rounds[rounds.length - 1];
        const first_round = rounds[0];
        if (!last_round.isT && last_round.cards) {
            const has_signal_in_last = last_round.cards.some(card => card.isSignalCard());
            if (has_signal_in_last) {
                signal_rounds++;
                if (first_round.result !== '莊') {
                    const swapped_result = swapFirstTwoCards(first_round);
                    if (swapped_result === '莊') {
                        adjustments++;
                        if (mutate) {
                            executeCardSwap(first_round);
                            const original_result = first_round.result;
                            first_round.result = '莊';
                            first_round.swapped = true;
                            sLog(`第${rounds.length}局有紅色0點牌 → 第1局:${original_result} → 莊`);
                        }
                    }
                }
            } else if (first_round.result === '莊') {
                const swapped_result = swapFirstTwoCards(first_round);
                if (swapped_result !== '莊') {
                    adjustments++;
                    if (mutate) {
                        executeCardSwap(first_round);
                        first_round.result = swapped_result;
                        first_round.swapped = true;
                        sLog(`第${rounds.length}局無紅色0點牌 → 第1局:莊 → ${swapped_result}`);
                    }
                }
            }
        }
    }
    
    sLog(`完成調整:${adjustments} 局被修改`, 'success');
    sLog(`包含紅色0點牌的局數:${signal_rounds}`);
    
    const s_indices = compute_sidx_for_segment(rounds, 'A');
    const t_indices = [];
    for (let i = 0; i < rounds.length; i++) {
        if (rounds[i].isT) t_indices.push(i);
    }
    
    const analysis = {
        total_s_rounds: s_indices.length,
        total_t_rounds: t_indices.length,
        s_rounds_data: [],
        t_rounds_data: [],
        total_zero_in_s: 0,
        total_signal_in_s: 0,
        total_signal_in_t: 0,
        signal_rounds_total: signal_rounds,
        target_banker_count: signal_rounds,
        actual_banker_count: rounds.filter(r => r.result === '莊').length,
        adjustments_made: adjustments
    };
    
    s_indices.forEach(idx => {
        const round = rounds[idx];
        if (!round) return;
        const zero_cards = round.cards.filter(card => card.isZero());
        const signal_cards = round.cards.filter(card => card.isSignalCard());
        analysis.s_rounds_data.push({
            round_index: idx,
            round,
            zero_count: zero_cards.length,
            signal_count: signal_cards.length,
            zero_cards,
            signal_cards,
            signal_value: signal_cards.length > 0 ? 1 : 0
        });
        analysis.total_zero_in_s += zero_cards.length;
        analysis.total_signal_in_s += signal_cards.length;
    });
    
    t_indices.forEach(idx => {
        const round = rounds[idx];
        if (!round) return;
        const signal_cards = round.cards.filter(card => card.isSignalCard());
        analysis.t_rounds_data.push({
            round_index: idx,
            round,
            signal_count: signal_cards.length,
            signal_cards,
            signal_value: signal_cards.length > 0 ? 1 : 0
        });
        analysis.total_signal_in_t += signal_cards.length;
    });
    
    return analysis;
}

// 整合分析結果以提供統計與摘要用途
function buildStatsFromRounds() {
    const totalRounds = Array.isArray(currentRounds) ? currentRounds.length : 0;
    const bankerCount = currentRounds ? currentRounds.filter(r => r.result === '莊').length : 0;
    const playerCount = currentRounds ? currentRounds.filter(r => r.result === '閒').length : 0;
    const tieCount = currentRounds ? currentRounds.filter(r => r.result === '和').length : 0;
    const twoPairsCount = currentRounds ? currentRounds.filter(hasTwoPairs).length : 0;
    const deckSummary = computeDeckSummary(currentRounds || []);
    const sIndices = Array.isArray(currentRounds) ? new Set(compute_sidx_for_segment(currentRounds, 'A')) : new Set();
    const sSignalCards = countSignalCardsInRounds(currentRounds, (_, idx) => sIndices.has(idx));
    const nonSSignalCards = countSignalCardsInRounds(currentRounds, (_, idx) => !sIndices.has(idx));
    const tSignalCards = countSignalCardsInRounds(currentRounds, (round) => Boolean(round && round.isT));
    return {
        totalRounds,
        bankerCount,
        playerCount,
        tieCount,
        sSignalCards,
        tSignalCards,
        nonSSignalCards,
        twoPairsCount,
        deckSummary
    };
}

// 重新分析牌靴並更新畫面與統計
function refreshAnalysisAndRender(options = {}) {
    if (!Array.isArray(currentRounds)) return;
    const mutate = Object.prototype.hasOwnProperty.call(options, 'mutate')
        ? Boolean(options.mutate)
        : false;
    try {
        currentAnalysis = analyze_signal_cards(currentRounds, { mutate });
    } catch (error) {
        log(`重新分析失敗:${error && error.message ? error.message : error}`, 'error');
        currentAnalysis = null;
    }
    const stats = buildStatsFromRounds();
    updateStats(stats);
    renderRoundsTable(currentRounds, currentAnalysis);
    renderDeckSummary(stats.deckSummary);
    renderStatsGridPreview(currentRounds);
}

// 主要生成函數 - 使用完整的ABC段排列並自動分析
// 生成整副牌靴並進行分析
async function generateShoe() {
    const btn = document.getElementById('generateBtn');
    const autoColorBtn = document.getElementById('btnAutoColor');
    
    btn.disabled = true;
    if (autoColorBtn) autoColorBtn.disabled = true;
    
    try {
        log('開始生成牌靴...', 'info');

        // 確保使用目前 UI 選擇的花色與數字
        applySignalConfig();
        
        let result = null;
        let attempt = 0;
        
        // 重試直到成功為止
        while (!result) {
            attempt++;
            log(`嘗試生成第 ${attempt} 次...`, 'info');
            
            // 1. 建立牌組
            const deck = build_shuffled_deck();
            log(`建立了 ${deck.length} 張牌的牌組`, 'info');
            
            // 2. 使用完整的ABC段排列邏輯
            try {
                result = pack_all_sensitive_and_segment(deck);
            } catch (e) {
                log(`第 ${attempt} 次嘗試失敗,重新生成... (${e && e.message ? e.message : e})`, 'warn');
                result = null;
                continue;
            }
            
            if (!result || !result.final_rounds || result.final_rounds.length === 0) {
                log(`第 ${attempt} 次嘗試失敗,重新生成...`, 'warn');
                result = null; // 確保繼續重試
                continue;
            }
        }
        
        log(`生成成功!總共嘗試 ${attempt} 次`, 'success');
        currentRounds = result.final_rounds;
        
        // 3. 統計各段數量
        const a_count = result.a_rounds.length;
        const b_count = Array.isArray(result.b_rounds) ? result.b_rounds.length : 0;
        const c_count = result.c_cards.length > 0 ? 1 : 0;
        const total_count = currentRounds.length;
        
        log(`A段: ${a_count}局 (敏感局)`, 'info');
        log(`B段: ${b_count}局 (一般局)`, b_count === 0 ? 'info' : 'warn');
        log(`C段: ${c_count}局 (殘牌)`, 'info');
        log(`總計: ${total_count}局`, 'info');
        
        // 4. 進行S局訊號分析和調整（T局已於生成流程內處理完畢）
        sLog('開始分析S局訊號並調整莊閒...');
        refreshAnalysisAndRender({ mutate: true });
        const stats = buildStatsFromRounds();
        
        log(`生成完成!`, 'success');
        if (currentAnalysis) {
            log(`包含訊號牌的局數: ${currentAnalysis.signal_rounds_total}`, 'info');
            log(`調整局數: ${currentAnalysis.adjustments_made}`, 'info');
            log(`實際莊家局數: ${currentAnalysis.actual_banker_count}`, 'info');
            sLog(`S局數量: ${currentAnalysis.total_s_rounds}`);
            log(`T局數量: ${currentAnalysis.total_t_rounds}`, 'info');
            sLog(`S局中紅色0點牌: ${currentAnalysis.total_signal_in_s}`);
            log(`T局中紅色0點牌: ${currentAnalysis.total_signal_in_t}`, 'info');
        }
        log(`莊家局數: ${stats.bankerCount}、閒家局數: ${stats.playerCount}、和局數: ${stats.tieCount}`, 'info');
        log(`兩對局數: ${stats.twoPairsCount}`, 'info');
        log(`S局訊號牌張數: ${stats.sSignalCards} (非S局訊號牌張數: ${stats.nonSSignalCards})`, 'info');
        log(`T局訊號牌張數: ${stats.tSignalCards}`, 'info');
        if (stats.deckSummary) {
            log(`牌靴已統計張數: ${stats.deckSummary.total_cards}/416`, 'info');
        }
        setEditButtonsAvailability(true);
        resetEditState();
        const sIndicesForLog = new Set(compute_sidx_for_segment(currentRounds, 'A'));
        log('=== 非 S 局訊號牌檢查 ===', 'info');
        let manualNonSSignalCount = 0;
        currentRounds.forEach((round, idx) => {
            if (!round || sIndicesForLog.has(idx)) return;
            const signalCards = round.cards.filter(card => card && card.isSignalCard());
            if (signalCards.length > 0) {
                log(`第${idx + 1}局(非S)：有 ${signalCards.length} 張訊號牌 - ${signalCards.map(c => c.short()).join(', ')}`, 'info');
                manualNonSSignalCount += signalCards.length;
            }
        });
        log(`手動統計非 S 局訊號牌總數：${manualNonSSignalCount}`, 'info');
        let totalSignalInDeck = 0;
        const seenSignalCardKeys = new Set();
        currentRounds.forEach(round => {
            if (!round || !Array.isArray(round.cards)) return;
            round.cards.forEach(card => {
                if (!card || !card.isSignalCard()) return;
                const key = (card.pos !== undefined && card.pos !== null)
                    ? `pos:${card.pos}`
                    : `fallback:${card.suit || ''}_${card.rank || ''}_${card.label || ''}_${typeof card.short === 'function' ? card.short() : ''}`;
                if (seenSignalCardKeys.has(key)) return;
                seenSignalCardKeys.add(key);
                totalSignalInDeck++;
            });
        });
       
        // 顯示詳細訊號資訊
        if (currentAnalysis && Array.isArray(currentAnalysis.s_rounds_data)) {
            currentAnalysis.s_rounds_data.forEach(sr => {
                if (sr.signal_value > 0) {
                    sLog(`第${sr.round_index + 1}局(S局): 訊號值=${sr.signal_value}, 紅色0點牌=${sr.signal_cards.map(c => c.short()).join(',')}`);
                }
            });
        }
        
    } catch (error) {
        log(`生成失敗: ${error.message}`, 'error');
        setEditButtonsAvailability(false);
    } finally {
        btn.disabled = false;
        if (autoColorBtn && currentRounds && currentRounds.length) autoColorBtn.disabled = false;
    }
}

// 分析S局訊號
// 根據目前訊號設定分析牌靴並顯示結果
async function analyzeSignals() {
    if (!currentRounds) {
        log('請先生成牌靴', 'error');
        return;
    }
    
    sLog('開始分析S局訊號...');
    
    try {
        // 分析紅色0點牌訊號並調整莊家局數量
        currentAnalysis = analyze_signal_cards(currentRounds);
        
        const totalSensitiveEl = document.getElementById('totalSensitive');
        const stats = {
            totalSensitive: totalSensitiveEl ? totalSensitiveEl.textContent : '0',
            sRoundsCount: currentAnalysis.total_s_rounds,
            zeroInS: currentAnalysis.total_zero_in_s,
            signalInS: currentAnalysis.total_signal_in_s,
            bankerCount: currentRounds.filter(r => r.result === '莊').length,
            playerCount: currentRounds.filter(r => r.result === '閒').length,
            tieCount: currentRounds.filter(r => r.result === '和').length,
            signalRounds: currentAnalysis.signal_rounds_total
        };
        
        updateStats(stats);
        renderRoundsTable(currentRounds, currentAnalysis);
        
        log(`分析完成!`, 'success');
        log(`包含紅色0點牌的局數: ${currentAnalysis.signal_rounds_total}`, 'info');
        log(`調整局數: ${currentAnalysis.adjustments_made}`, 'info');
        log(`實際莊家局數: ${currentAnalysis.actual_banker_count}`, 'info');
        sLog(`S局數量: ${currentAnalysis.total_s_rounds}`);
        sLog(`S局中紅色0點牌: ${currentAnalysis.total_signal_in_s}`);
        
        // 顯示詳細訊號資訊
        currentAnalysis.s_rounds_data.forEach(sr => {
            if (sr.signal_value > 0) {
                sLog(`第${sr.round_index + 1}局(S局): 訊號值=${sr.signal_value}, 紅色0點牌=${sr.signal_cards.map(c => c.short()).join(',')}`);
            }
        });
        
    } catch (error) {
        log(`分析失敗: ${error.message}`, 'error');
    }
}

// 清空
// 重設整個模擬器狀態與面板
function clearAll() {
    currentRounds = null;
    currentAnalysis = null;
    
    updateStats({
        totalRounds: 0,
        bankerCount: 0,
        playerCount: 0,
        tieCount: 0,
        sSignalCards: 0,
        nonSSignalCards: 0,
        tSignalCards: 0,
        twoPairsCount: 0,
        deckSummary: null
    });
    renderDeckSummary(null);
    renderStatsGridPreview(null);
    
    document.getElementById('roundsTable').style.display = 'none';
    document.getElementById('logArea').innerHTML = '';
    const autoColorBtn = document.getElementById('btnAutoColor');
    if (autoColorBtn) autoColorBtn.disabled = true;
    setEditButtonsAvailability(false);
    log('已清空所有資料', 'info');
}

// === 通用檢查:確保有牌靴資料可供後續功能使用 ===
// 確認牌靴已生成再執行其他功能
function ensureRoundsReady(featureName) {
    if (!currentRounds || currentRounds.length === 0) {
        log(`請先生成牌靴,再使用「${featureName}」功能。`, 'error');
        return false;
    }
    return true;
}

const PREVIEW_GRID_COLS = 21;
const PREVIEW_GRID_ROWS = 31;
const PREVIEW_GRID_GROUP = 7;

// 將牌靴資料轉為每個格子所需的 class/value，包含 T 框與段別
function buildPreviewGrid(deckCards, rounds) {
    const COLS = PREVIEW_GRID_COLS;
    const ROWS = PREVIEW_GRID_ROWS;
    const ROUND_COLS = 7;
    const ROUNDS_PER_ROW = COLS / ROUND_COLS;
    const MAX_ROUNDS = ROWS * ROUNDS_PER_ROW;
    const gridSize = COLS * ROWS;
    const grid = Array.from({ length: gridSize }, () => ({ classes: ['cell'], value: '', deckIndex: null }));
    const segmentByIndex = new Map();
    const tPositions = new Set();
    if (Array.isArray(rounds)) {
        let cursor = 0;
        rounds.forEach(round => {
            const cards = Array.isArray(round?.cards) ? round.cards : [];
            const len = cards.length;
            for (let i = 0; i < len; i++) {
                segmentByIndex.set(cursor + i, round.segment || '');
            }
            if (round && round.isT) {
                for (let i = 0; i < len; i++) {
                    tPositions.add(cursor + i);
                }
            }
            cursor += len;
        });
    }

    const totalRounds = Math.min(Array.isArray(rounds) ? rounds.length : 0, MAX_ROUNDS);
    let cardCursor = 0;
    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
        const round = rounds[roundIndex];
        const row = Math.floor(roundIndex / ROUNDS_PER_ROW);
        const slot = roundIndex % ROUNDS_PER_ROW;
        const baseIndex = row * COLS + slot * ROUND_COLS;
        const resultClasses = ['cell', 'result-cell'];
        let resultValue = '';
        if (round.result === '莊') {
            resultClasses.push('result-banker');
            resultValue = 'X';
        } else if (round.result === '閒') {
            resultClasses.push('result-player');
            resultValue = 'O';
        } else if (round.result === '和') {
            resultClasses.push('result-tie');
            resultValue = '和';
        }
        grid[baseIndex] = { classes: resultClasses, value: resultValue, deckIndex: null };
        const cards = Array.isArray(round?.cards) ? round.cards : [];
        for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
            const card = cards[cardIdx];
            const deckIndex = cardCursor;
            cardCursor += 1;
            if (cardIdx >= ROUND_COLS - 1) continue;
            const gridIndex = baseIndex + 1 + cardIdx;
            if (gridIndex >= gridSize) continue;
            const classes = ['cell'];
            const color = getCardColorCode(card);
            if (color === 'R') classes.push('card-red');
            else if (color === 'B') classes.push('card-blue');
            const isSignal = typeof card?.isSignalCard === 'function'
                ? card.isSignalCard()
                : isSignalConfiguredCard(card);
            if (isSignal) classes.push('signal-match');
            const seg = segmentByIndex.get(deckIndex);
            if (seg === 'A') classes.push('segment-a');
            else if (seg === 'B') classes.push('segment-b');
            else if (seg === 'C') classes.push('segment-c');
            grid[gridIndex] = {
                classes,
                value: gridValueFromCard(card),
                deckIndex
            };
        }
    }

    for (let idx = 0; idx < grid.length; idx++) {
        const cell = grid[idx];
        if (cell.deckIndex == null || !tPositions.has(cell.deckIndex)) continue;
        const classes = cell.classes;
        if (!classes.includes('tbox')) classes.push('tbox');
        const col = idx % COLS;
        const checkNeighbor = (neighborIdx) => {
            if (neighborIdx < 0 || neighborIdx >= grid.length) return false;
            const neighbor = grid[neighborIdx];
            return neighbor.deckIndex != null && tPositions.has(neighbor.deckIndex);
        };
        const hasLeft = col > 0 && checkNeighbor(idx - 1);
        const hasRight = col < COLS - 1 && checkNeighbor(idx + 1);
        const hasTop = idx - COLS >= 0 && checkNeighbor(idx - COLS);
        const hasBottom = idx + COLS < grid.length && checkNeighbor(idx + COLS);
        if (!hasLeft) classes.push('tbox-left');
        if (!hasRight) classes.push('tbox-right');
        if (!hasTop) classes.push('tbox-top');
        if (!hasBottom) classes.push('tbox-bottom');
    }

    return grid.map(cell => ({
        className: (cell.classes && cell.classes.length) ? cell.classes.join(' ') : 'cell',
        value: cell.value || ''
    }));
}

// 在右側小格中渲染目前牌靴的預覽圖
function renderStatsGridPreview(rounds) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('statsGridPreview');
    if (!container) return;
    const deckCards = flattenDeckFromRounds(rounds);
    if (!deckCards.length) {
        container.innerHTML = '<div class="grid-placeholder">尚無牌靴資料</div>';
        return;
    }
    const COLS = 21; // 根據使用者要求，固定為 21 欄
    const ROWS = PREVIEW_GRID_ROWS;
    const MAX = COLS * ROWS;
    const gridData = buildPreviewGrid(deckCards, rounds);
    const padded = gridData.slice(0, MAX);
    while (padded.length < MAX) {
        padded.push({ className: 'cell', value: '' });
    }
    container.innerHTML = padded
        .map(cell => `<div class="${cell.className}">${cell.value || ''}</div>`)
        .join('');
}

// === 導出:把目前牌局匯出為 Excel ===
// 把目前牌靴轉成 Excel，包含預覽與原始數據工作表並下載
async function exportRoundsAsExcel() {
    if (!ensureRoundsReady('導出')) return;
    if (typeof ExcelJS === 'undefined' || !ExcelJS.Workbook) {
        log('ExcelJS 載入失敗,無法導出Excel。', 'error');
        return;
    }

    const deckCards = flattenDeckFromRounds(currentRounds);
    if (!deckCards.length) {
        log('找不到牌靴資料,請先生成牌靴。', 'error');
        return;
    }

    try {
        const wb = new ExcelJS.Workbook();

        // === 工作表1:預覽 ===
        const ws1 = wb.addWorksheet('預覽');
        ws1.properties.defaultRowHeight = 36;
        ws1.pageSetup = {
            paperSize: 9,
            orientation: 'portrait',
            fitToPage: false,
            scale: 170,
            horizontalCentered: true,
            verticalCentered: true,
            margins: { left: 0.1, right: 0.1, top: 0.12, bottom: 0.12, header: 0.1, footer: 0.1 }
        };

        const COLS = 21; // 根據使用者要求，固定為 21 欄
        const ROWS = PREVIEW_GRID_ROWS;
        const GROUP = PREVIEW_GRID_GROUP;
        const columnWidths = [];
        for (let colIndex = 0; colIndex < COLS; colIndex++) {
            columnWidths.push(4);
            if ((colIndex + 1) % GROUP === 0 && colIndex < COLS - 1) {
                columnWidths.push(1);
            }
        }
        columnWidths.forEach((width, index) => {
            ws1.getColumn(index + 1).width = width;
        });

        const borderThin = { style: 'thin', color: { argb: 'FF333333' } }; // 單格細線框
        const borderBold = { style: 'medium', color: { argb: 'FFFF4D4F' } }; // T 框加粗邊
        const gridData = buildPreviewGrid(deckCards, currentRounds);
        const MAX = COLS * ROWS;
        const padded = gridData.slice(0, MAX);
        while (padded.length < MAX) padded.push({ className: 'cell', value: '' });

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const sheetCol = c + 1 + Math.floor(c / GROUP);
                const cellData = padded[r * COLS + c];
                const wsCell = ws1.getCell(r + 1, sheetCol);
                wsCell.value = cellData.value || '';
                wsCell.alignment = { vertical: 'middle', horizontal: 'center' };
                wsCell.font = { size: 22, bold: true, color: { argb: 'FF000000' } }; // 預設文字黑
                wsCell.border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin }; // 全格細框

                const classes = cellData.className || '';
                const isResultCell = classes.includes('result-banker') || classes.includes('result-player') || classes.includes('result-tie');
                if (classes.includes('card-red')) {
                    wsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // 莊局底色
                } else if (classes.includes('card-blue')) {
                    wsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' } }; // 閒局底色
                }
                if (isResultCell) {
                    wsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F0FF' } }; // 結果欄淺紫
                }
                if (classes.includes('signal-match')) {
                    wsCell.font = { ...wsCell.font, color: { argb: 'FFDC3545' } }; // 訊號字紅
                }
                if (classes.includes('tbox-left')) wsCell.border.left = borderBold; // T框左粗邊
                if (classes.includes('tbox-right')) wsCell.border.right = borderBold; // T框右粗邊
                if (classes.includes('tbox-top')) wsCell.border.top = borderBold; // T框上粗邊
                if (classes.includes('tbox-bottom')) wsCell.border.bottom = borderBold; // T框下粗邊
            }
        }

        // === 工作表2:原始數據 ===
        const ws2 = wb.addWorksheet('原始數據');
        const headers = ['局號', '段標', '色序', '卡片1', '卡片2', '卡片3', '卡片4', '卡片5', '卡片6', '結果', '訊號'];
        ws2.addRow(headers);
        const headerRow = ws2.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };

        const sIndexes = new Set(compute_sidx_for_segment(currentRounds, 'A'));
        const tIndexes = new Set();
        currentRounds.forEach((round, idx) => {
            if (round && round.isT) tIndexes.add(idx);
        });

        currentRounds.forEach((round, idx) => {
            const cards = Array.isArray(round?.cards) ? round.cards : [];
            const colorSeq = cards.map(getCardColorCode).join('');
            const row = [
                idx + 1,
                round?.segment || '',
                colorSeq
            ];
            for (let i = 0; i < 6; i++) {
                row.push(cards[i] ? getCardLabel(cards[i]) : '');
            }
            row.push(round?.result || '');
            let signalTag = '';
            if (sIndexes.has(idx)) signalTag = 'S';
            else if (tIndexes.has(idx)) signalTag = 'T';
            row.push(signalTag);
            ws2.addRow(row);
        });

        ws2.columns.forEach(column => {
            column.width = 12;
        });

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `signal-analysis-${Date.now()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        log('合併Excel檔案已導出成功!', 'success');
    } catch (error) {
        console.error('紅0 導出失敗:', error);
        const message = error && error.message ? error.message : error;
        log(`導出失敗:${message}`, 'error');
    }
}

// === 預覽:開新視窗把牌局列表顯示出來 ===
// 以新窗口顯示 Excel 預覽格
function previewRoundsInWindow() {
    if (!ensureRoundsReady('預覽')) return;

    const stats = buildStatsFromRounds();
    const deckCards = flattenDeckFromRounds(currentRounds);
        const COLS = 21; // 根據使用者要求，固定為 21 欄
    const ROWS = PREVIEW_GRID_ROWS;
    const MAX = COLS * ROWS;
    const gridData = buildPreviewGrid(deckCards, currentRounds);
    const padded = gridData.slice(0, MAX);
    while (padded.length < MAX) padded.push({ className: 'cell', value: '' });
    const gridHtml = padded
        .map(cell => {
            const classes = (cell.className || 'cell').trim();
            return `<div class="${classes}">${cell.value || ''}</div>`;
        })
        .join('');
    const win = window.open('', '_blank', 'width=1080,height=720');
    if (!win) {
        log('瀏覽器阻擋了預覽視窗,請允許快顯視窗。', 'error');
        return;
    }

    const html = `<!doctype html>
<html lang="zh-TW">
<head>
    <meta charset="utf-8">
    <title>Excel 預覽</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            background: #030712;
            font-family: "Microsoft JhengHei", "Noto Sans", system-ui, sans-serif;
            color: #f9fafb;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 18px;
        }
        .grid-shell {
            width: min(90vw, 720px);
            background: #0f172a;
            padding: 20px;
            border-radius: 20px;
            box-shadow: 0 25px 60px rgba(15,23,42,.45);
        }
        .grid-title {
            margin: 0 0 12px;
            text-align: center;
            font-size: 20px;
            letter-spacing: .4px;
            color: #e0f2fe;
        }
        .grid-preview-window {
            display: grid;
            grid-template-columns: repeat(21, minmax(0, 1fr));
            gap: 0;
            border-radius: 14px;
            background: #94a3b8;
            padding: 3px;
        }
        .grid-preview-window .cell {
            min-height: 43px;
            border: 1px solid #94a3b8;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            color: #020617;
            background: #e2e8f0;
            transition: background .2s ease;
        }
        .grid-preview-window .cell.result-banker { color: #f56565; background: #f4f0ff; }
        .grid-preview-window .cell.result-player { color: #7dd3fc; background: #f4f0ff; }
        .grid-preview-window .cell.result-tie    { color: #22c55e; background: #f4f0ff; }
        .grid-preview-window .cell.card-red { background: #fff0d6; color: #9f1239; }
        .grid-preview-window .cell.card-blue { background: #dbeafe; color: #1d4ed8; }
        .grid-preview-window .cell.signal-match { color: #dc3545; text-shadow: 0 0 5px rgba(220,53,69,.7); }
        .grid-preview-window .cell.tbox-left   { border-left:   3px solid #f97316; }
        .grid-preview-window .cell.tbox-right  { border-right:  3px solid #f97316; }
        .grid-preview-window .cell.tbox-top    { border-top:    3px solid #f97316; }
        .grid-preview-window .cell.tbox-bottom { border-bottom: 3px solid #f97316; }
        .grid-preview-window .cell.group-divider-right { border-right: 4px solid #94a3b8; }
        .grid-preview-window .cell.group-divider-left  { border-left:  4px solid #94a3b8; }
    </style>
</head>
<body>
    <div class="grid-shell">
        <h2 class="grid-title">21 × 31 Excel 預覽 · 共 ${stats.totalRounds} 局</h2>
        <div class="grid-preview-window">
            ${gridHtml}
        </div>
    </div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
}

// === 語音:開啟主程式語音工具 (上傳 Excel 再朗讀) ===
// 打開語音助理頁面
function openSpeechAssistant() {
    const win = window.open('assistant.html', '_blank');
    if (!win) {
        log('瀏覽器阻擋了語音視窗，請允許快顯視窗。', 'error');
    } else {
        log('已開啟語音助手視窗，請在新視窗上傳 Excel 後朗讀。', 'info');
    }
}

// === 計算工具:顯示懸浮計算器 ===
// 顯示懸浮計算工具
function showCalcTool() {
    ensureFloatingWidget();
    const widget = document.getElementById('floatingAssistant');
    if (widget) widget.style.display = 'block';
}
// 確保懸浮工具 widget 已建立
function ensureFloatingWidget() {
    if (typeof document === 'undefined') return false;
    if (!document.getElementById('floatingAssistant')) {
        const widgetHTML = `
        <div class="floating-widget" id="floatingAssistant">
        <div class="widget-content">
            <div class="widget-actions">
                <button id="closeWidgetBtn" class="widget-action widget-close" type="button">關閉</button>
                <button id="sim_reset-btn" class="widget-action widget-reset" type="button">清空</button>
            </div>
            <div class="card-inputs">
                <input type="number" inputmode="numeric" class="card-input" id="sim_p1" min="0" max="9" placeholder="閒1">
                <input type="number" inputmode="numeric" class="card-input" id="sim_b1" min="0" max="9" placeholder="莊1">
                <input type="number" inputmode="numeric" class="card-input" id="sim_p2" min="0" max="9" placeholder="閒2">
                <input type="number" inputmode="numeric" class="card-input" id="sim_b2" min="0" max="9" placeholder="莊2">
                <input type="number" inputmode="numeric" class="card-input disabled" id="sim_p3" min="0" max="9" placeholder="閒3">
                <input type="number" inputmode="numeric" class="card-input disabled" id="sim_b3" min="0" max="9" placeholder="莊3">
            </div>
            <div class="results">
                <div class="result-strip">
                    <span class="result-value metric-value result-player" id="sim_normal-p-points">---</span>
                    <span class="result-value metric-value result-banker" id="sim_normal-b-points">---</span>
                    <span class="result-value metric-value result-outcome" id="sim_normal-tie-result">---</span>
                </div>
                <div class="result-strip">
                    <span class="result-value metric-value result-player" id="sim_swapped-p-points">---</span>
                    <span class="result-value metric-value result-banker" id="sim_swapped-b-points">---</span>
                    <span class="result-value metric-value result-outcome" id="sim_swapped-tie-result">---</span>
                </div>
            </div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        bindSimulatorLogic();
        const widget = document.getElementById('floatingAssistant');
        const closeBtn = document.getElementById('closeWidgetBtn');
        if (closeBtn) closeBtn.onclick = () => widget.style.display = 'none';
        let isDragging = false, offsetX = 0, offsetY = 0;
        const startDrag = (e) => {
            if (e.target.closest('.card-inputs') || e.target.closest('.result-strip') || e.target.closest('.widget-close') || e.target.id === 'sim_reset-btn') return;
            isDragging = true;
            offsetX = e.clientX - widget.offsetLeft;
            offsetY = e.clientY - widget.offsetTop;
            e.preventDefault();
        };
        const onDrag = (e) => {
            if (!isDragging) return;
            widget.style.left = `${e.clientX - offsetX}px`;
            widget.style.top = `${e.clientY - offsetY}px`;
        };
        const stopDrag = () => { isDragging = false; };
        widget.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    }
    return true;
}

// 綁定模擬器 UI 按鈕的事件
function bindSimulatorLogic() {
    const inputs = {
        p1: document.getElementById('sim_p1'),
        b1: document.getElementById('sim_b1'),
        p2: document.getElementById('sim_p2'),
        b2: document.getElementById('sim_b2'),
        p3: document.getElementById('sim_p3'),
        b3: document.getElementById('sim_b3')
    };
    const resetButton = document.getElementById('sim_reset-btn');
    const normalPPointsEl = document.getElementById('sim_normal-p-points');
    const normalBPointsEl = document.getElementById('sim_normal-b-points');
    const normalTieResultEl = document.getElementById('sim_normal-tie-result');
    const swappedPPointsEl = document.getElementById('sim_swapped-p-points');
    const swappedBPointsEl = document.getElementById('sim_swapped-b-points');
    const swappedTieResultEl = document.getElementById('sim_swapped-tie-result');

    // 模擬一局百家樂補牌後的結果，供模擬器使用
    function simulate(p1, b1, p2, b2, p3, b3) {
        let p_tot = (p1 + p2) % 10;
        let b_tot = (b1 + b2) % 10;
        const natural = (p_tot >= 8 || b_tot >= 8);
        let p3_val = null;
        let needs_p3 = false;
        let needs_b3 = false;
        let final_p_tot = p_tot;
        let final_b_tot = b_tot;

        if (!natural) {
            if (p_tot <= 5) {
                needs_p3 = true;
                if (p3 !== null) {
                    p3_val = p3;
                    final_p_tot = (p_tot + p3) % 10;
                }
            }
            if (p3_val === null) {
                if (b_tot <= 5) {
                    needs_b3 = true;
                    if (b3 !== null) final_b_tot = (b_tot + b3) % 10;
                }
            } else {
                const pt = p3_val;
                if (
                    b_tot <= 2 ||
                    (b_tot === 3 && pt !== 8) ||
                    (b_tot === 4 && [2, 3, 4, 5, 6, 7].includes(pt)) ||
                    (b_tot === 5 && [4, 5, 6, 7].includes(pt)) ||
                    (b_tot === 6 && [6, 7].includes(pt))
                ) {
                    needs_b3 = true;
                }
                if (needs_b3 && b3 !== null) final_b_tot = (b_tot + b3) % 10;
            }
        }

        const result = (final_p_tot > final_b_tot) ? '閒' : ((final_b_tot > final_p_tot) ? '莊' : '和');
        return { result, p_tot: final_p_tot, b_tot: final_b_tot, needs_p3, needs_b3 };
    }

    // 根據輸入欄位更新模擬結果與顯示
    function updateUI() {
        const values = {};
        let allFourFilled = true;
        Object.keys(inputs).forEach((key) => {
            const parsed = parseInt(inputs[key].value, 10);
            values[key] = Number.isNaN(parsed) ? null : parsed;
            if (['p1', 'b1', 'p2', 'b2'].includes(key) && values[key] === null) {
                allFourFilled = false;
            }
        });

        inputs.p3.classList.add('disabled');
        inputs.p3.classList.remove('highlight');
        inputs.b3.classList.add('disabled');
        inputs.b3.classList.remove('highlight');

        const resetOutput = (el, extraClass) => {
            el.textContent = '---';
            el.className = `metric-value result-value ${extraClass}`.trim();
        };

        resetOutput(normalPPointsEl, 'result-player');
        resetOutput(normalBPointsEl, 'result-banker');
        resetOutput(normalTieResultEl, 'result-outcome');
        resetOutput(swappedPPointsEl, 'result-player');
        resetOutput(swappedBPointsEl, 'result-banker');
        resetOutput(swappedTieResultEl, 'result-outcome');

        if (!allFourFilled) return;

        const { p1, b1, p2, b2, p3, b3 } = values;
        const normal = simulate(p1, b1, p2, b2, p3, b3);
        const swapped = simulate(b1, p1, b2, p2, p3, b3);

        const setOutput = (el, value, extraClass) => {
            el.textContent = value;
            el.className = `metric-value result-value ${extraClass}`.trim();
        };

        setOutput(normalPPointsEl, normal.p_tot, 'result-player');
        setOutput(normalBPointsEl, normal.b_tot, 'result-banker');
        setOutput(normalTieResultEl, normal.result, 'result-outcome');

        setOutput(swappedPPointsEl, swapped.p_tot, 'result-player');
        setOutput(swappedBPointsEl, swapped.b_tot, 'result-banker');
        setOutput(swappedTieResultEl, swapped.result, 'result-outcome');

        if (normal.needs_p3) {
            inputs.p3.classList.remove('disabled');
            inputs.p3.classList.add('highlight');
        }
        if (normal.needs_b3) {
            inputs.b3.classList.remove('disabled');
            inputs.b3.classList.add('highlight');
        }
    }

    Object.values(inputs).forEach(input => {
        if (!input) return;
        input.addEventListener('input', updateUI);
    });

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            Object.values(inputs).forEach(input => {
                if (input) input.value = '';
            });
            updateUI();
        });
    }

    updateUI();
}

// =============================================
    // === 【新增】卡色 (BBBR/RRRB) 邏輯 ===
    // =============================================
    
    // 全域變數,用來儲存當前牌局資料
    let $ROUNDS = []; 
    
    /**
     * 【新增】卡色邏輯的啟動函式
     */
    // 針對卡色邏輯抽換備援牌
    function runAutoColorSwap_Signal(rounds) {
        log('SIG: 啟動「紅0/兩對」專用的卡色邏輯...', 'info');
        $ROUNDS = rounds; // 儲存牌局資料
        
        // 1. 找出所有 T 局 (兩對局) 的索引
        const lockedFullRounds = new Set();
        const semiLockedRounds = new Set();
        const tRoundIndices = [];
        $ROUNDS.forEach((round, idx) => {
            if (round?.isT) {
                lockedFullRounds.add(idx);
                tRoundIndices.push(idx);
            }
        });
        
        log(`SIG: T局 (兩對局) 已鎖定,共 ${tRoundIndices.length} 局`, 'info');
        
        const sRoundSet = new Set(compute_sidx_for_segment($ROUNDS, 'A'));
        
        const processRound = (ridx, { force = false } = {}) => {
            if (ridx < 0 || ridx >= $ROUNDS.length) return false;
            const round = $ROUNDS[ridx];
            if (!round || round.segment === 'B') return false;
            if (!force && (lockedFullRounds.has(ridx) || semiLockedRounds.has(ridx))) return false;
            
            const pat1 = ['B', 'B', 'B', 'R'];
            const pat2 = ['R', 'R', 'R', 'B'];
            const s1 = scoreRound(round, pat1);
            const s2 = scoreRound(round, pat2);
            const first = (s1.match > s2.match || (s1.match === s2.match && s1.deficit < s2.deficit)) ? pat1 : s2.match > s1.match ? pat2 : pat1;
            const second = (first === pat1) ? pat2 : pat1;

            if (
                solvePattern(ridx, first, lockedFullRounds, semiLockedRounds, { rankStrict: force, sRoundSet }) ||
                solvePattern(ridx, second, lockedFullRounds, semiLockedRounds, { rankStrict: force, sRoundSet })
            ) {
                if (force) {
                    lockedFullRounds.add(ridx);
                } else {
                    semiLockedRounds.add(ridx);
                }
                return true;
            }
            return false;
        };
        
        // 2. 先處理所有 T 局
        tRoundIndices.forEach(idx => {
            lockedFullRounds.delete(idx);
            processRound(idx, { force: true });
            lockedFullRounds.add(idx);
        });

        // 3. 再處理其餘牌局
        for (let ridx = 0; ridx < $ROUNDS.length; ridx++) {
            processRound(ridx);
        }
        
        log('SIG: 卡色邏輯執行完畢。', 'success');
        return $ROUNDS; // 返回修改後的牌局
    }

    /**
     * 【新增】計分
     */
    function scoreRound(r, pattern) {
        if (!r || !r.cards) return { match: 0, deficit: 99 };
        const n = Math.min(4, r.cards.length);
        let match = 0, deficit = 0;
        for (let i = 0; i < n; i++) {
            if (r.cards[i] && r.cards[i].back_color === pattern[i]) match++;
            else deficit++;
        }
        return { match, deficit };
    }

    /**
     * 【新增】核心:解決一局的卡色
     */
function solvePattern(ridx, pattern, lockedFullRounds, semiLockedRounds, options = {}) {
        const round_to_solve = $ROUNDS[ridx];
        if (!round_to_solve || !round_to_solve.cards) return false;
        const { rankStrict = false, sRoundSet } = options;
        const srSet = sRoundSet instanceof Set ? sRoundSet : new Set();
        
        const n = Math.min(4, round_to_solve.cards.length); // 只處理前4張
        const sandbox_cards = round_to_solve.cards.map(c => c.clone()); // 建立沙盒
        
        for (let p = 0; p < n; p++) {
            if (sandbox_cards[p].back_color === pattern[p]) continue;

            const needColor = pattern[p];
            const currentCard = sandbox_cards[p];
            
            let best_swap_cand = null; // { r_idx, c_idx }
            
            for (const cand of sourceCandidates(needColor, ridx, p, lockedFullRounds, semiLockedRounds)) {
                const { r: cand_r, c: cand_c, sameRound } = cand;
                const candCard = $ROUNDS[cand_r].cards[cand_c];

                // === 【保護邏輯】 ===
                
                // 規則1:必須是相同「牌面」(Rank)
                const isExactRank = (currentCard.rank === candCard.rank);
                const isZeroFamily = ['10', 'J', 'Q', 'K'].includes(currentCard.rank) &&
                    ['10', 'J', 'Q', 'K'].includes(candCard.rank);
                const allowRank = rankStrict ? isExactRank : (isExactRank || isZeroFamily);
                if (!allowRank) {
                    continue; 
                }
                
                // 規則2:檢查 S 局訊號牌
                const isCurrentSignal = currentCard.isSignalCard();
                const isCandSignal = candCard.isSignalCard();
                
                if (isCurrentSignal !== isCandSignal) {
                    const currentIsSRound = srSet.has(ridx);
                    const candIsSRound = srSet.has(cand_r);
                    const allowSignalMismatch = currentIsSRound && candIsSRound;
                    if (!allowSignalMismatch) {
                        continue;
                    }
                    if (
                        !willRoundKeepSignal(ridx, p, candCard) ||
                        !willRoundKeepSignal(cand_r, cand_c, currentCard)
                    ) {
                        continue;
                    }
                }
                // === 保護邏輯結束 ===
                
                best_swap_cand = { r_idx: cand_r, c_idx: cand_c, sameRound: Boolean(sameRound) };
                break; 
            }

            if (best_swap_cand) {
                const { r_idx, c_idx } = best_swap_cand;
                const donorCard = $ROUNDS[r_idx].cards[c_idx];
                sandbox_cards[p] = donorCard; 
                
                swapCards_Internal($ROUNDS, 
                    { r: ridx, c: p },
                    { r: r_idx, c: c_idx }
                );
            } else {
                const colorLabel = needColor === 'R' ? '紅背' : needColor === 'B' ? '藍背' : needColor;
                const cardLabel = currentCard ? currentCard.short() : `位置${p + 1}`;
                log(`卡色交換失敗:第 ${ridx + 1} 局 位置 ${p + 1}(目標 ${colorLabel},牌 ${cardLabel})找不到安全可行的交換方案。`, 'error');
                return false; 
            }
        }
        
        return true; 
    }

    /**
     * 【新增】尋找候選牌
     */
    function willRoundKeepSignal(roundIndex, removedIdx, incomingCard) {
        const round = $ROUNDS[roundIndex];
        if (!round || !Array.isArray(round.cards)) return false;
        let hasSignal = false;
        for (let i = 0; i < round.cards.length; i++) {
            if (i === removedIdx) continue;
            const card = round.cards[i];
            if (card && typeof card.isSignalCard === 'function' && card.isSignalCard()) {
                hasSignal = true;
                break;
            }
        }
        if (!hasSignal && typeof incomingCard?.isSignalCard === 'function' && incomingCard.isSignalCard()) {
            hasSignal = true;
        }
        return hasSignal;
    }

function* sourceCandidates(needColor, current_ridx, current_pidx, lockedFullRounds, semiLockedRounds) {
        const current_round = $ROUNDS[current_ridx];
        if (!current_round || !current_round.cards) return;
        
        const extraIndices = [4, 5];
        for (const idx of extraIndices) {
            if (current_round.cards.length > idx && current_round.cards[idx] && current_round.cards[idx].back_color === needColor) {
                yield { r: current_ridx, c: idx, sameRound: true };
            }
        }
        
        const searchOrder = [];
        for (let i = current_ridx + 1; i < $ROUNDS.length; i++) {
            searchOrder.push(i);
        }
        for (let i = 0; i < current_ridx; i++) {
            searchOrder.push(i);
        }
        
        for (const i of searchOrder) {
            if (lockedFullRounds.has(i)) continue; 
            const round_to_search = $ROUNDS[i];
            if (!round_to_search || !round_to_search.cards) continue;

            const indices = (() => {
                if (semiLockedRounds.has(i)) {
                    const out = [];
                    for (let q = 4; q < round_to_search.cards.length; q++) out.push(q);
                    return out;
                }
                return (i < current_ridx) ? [4, 5] : [0, 1, 2, 3];
            })();
            if (!indices || indices.length === 0) continue;

            for (const q of indices) {
                if (q >= round_to_search.cards.length) continue;
                if (round_to_search.cards[q] && round_to_search.cards[q].back_color === needColor) {
                    yield { r: i, c: q, sameRound: false };
                }
            }
        }
    }

    /**
     * 【新增】在 $ROUNDS 陣列中實際交換兩張牌
     */
    function swapCards_Internal(rounds, a, b) {
        if (!a || !b) return;
        const A = rounds?.[a.r]?.cards?.[a.c];
        const B = rounds?.[b.r]?.cards?.[b.c];
        if (A === undefined || B === undefined) {
            log("SIG: 卡色交換失敗:找不到卡牌物件。", 'error');
            return;
        }
        const beforeA = rounds[a.r].cards[a.c];
        const beforeB = rounds[b.r].cards[b.c];
        [rounds[a.r].cards[a.c], rounds[b.r].cards[b.c]] = [B, A];
        const msg = `卡色交換成功:第 ${a.r + 1} 局 位置 ${a.c + 1}(${beforeA?.short() || '未知'}) ↔ 第 ${b.r + 1} 局 位置 ${b.c + 1}(${beforeB?.short() || '未知'})`;
        log(msg, 'success');
    }
