# 百家3.0

## 已定案
<!-- 日期為本次整理日期；只摘錄有使用者決定證據的內容。 -->


## 專案說明

本機百家樂牌靴分析工作台：設定訊號牌、生成牌靴、檢查違規、換牌／換局與 Excel 匯出（出處：PRODUCT.md）。

- 主體是 HTML／CSS／JavaScript 靜態頁面，可由瀏覽器開啟 `index.html`；無前端建置步驟（出處：原 CLAUDE.md）。
- `package.json` 另列 exceljs 4.4.0，原 CLAUDE.md 的「無 npm 依賴」不能代表目前全部工具；原說明保留供追溯。
- 主要邏輯：signals.js、signals_ui.js；前端修改先讀 DESIGN_SPEC.md。部署網址未從本次查閱文件確認。

## 規則


# 用繁體中文

## 前端修改必讀
- 修改任何頁面、CSS、字型、動畫、按鈕、提示或視窗前，必須先讀 [DESIGN_SPEC.md](DESIGN_SPEC.md)，再讀目標頁真正載入的樣式與最後覆寫。
- 先看完整目標頁及相關狀態，選定同用途的既有元件作對照；不能只看色碼或自己新增的局部截圖就宣稱一致。
- 操作面板的近黑金屬底與牌桌的深綠氈布不可混用；字型依標題、內文、品牌與數字角色沿用。
- 本次新增且遭使用者質疑的匯入提示、三張牌動畫、雲端匯入視窗不是風格基準；不得拿未認可的新設計替自己背書。
- 細節與來源只維護在 DESIGN_SPEC.md；使用者確認新決策時，同次更新規範及必要證據，不另建衝突版本。

## 回答原則
- **不知道就說不知道**，不要猜測或給出不確定的建議
- **避免列舉不可行方案**，不要為了顯示思考而羅列明顯困難或不可能的選項
- **深入思考後再回答**，確保建議具有實際可行性
- **承認限制**，如果問題超出能力範圍，直接說明而非強行給答案

## 禁止行為
- 列出一堆「可能的方案」但實際上都不可行
- 為了顯示全面思考而給出明顯錯誤的建議  
- 用冗長的分析掩蓋缺乏實質內容
- 不經深入思考就給出技術建議

## 期望行為
- 簡潔直接的回答
- 確實可行的建議
- 承認不知道的部分
- 避免浪費時間的無效分析





### 原 CLAUDE.md 內容（完整保留）

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言與風格

- 一律使用**繁體中文**回答
- 簡潔直接，不確定就說不確定，不猜測
- 不列舉明顯不可行的方案


## 專案架構

純前端專案，無建置步驟、無 npm 依賴、無測試框架。

| 檔案 | 職責 |
|------|------|
| `index.html` | 主頁面（含所有 CSS ~800 行） |
| `signals.js` | 核心邏輯：百家樂計算、牌靴生成、違規偵測、訊號牌分析 |
| `signals_ui.js` | UI 渲染、事件處理、敏感局挑選、表格顯示 |
| `auto_fix_plugin.js` | 一鍵修正外掛（違規自動修復） |
| `smart_reorder_dialog.js` | 智能重排對話框 |
| `swap_preview.js` | 對調預覽 |

## 關鍵術語

- **敏感局**：對調前兩張牌會改變勝負結果的牌局
- **S局**：含訊號牌的局 → 下一局必須開莊
- **T局**：含三條的局 → 下一局必須開和
- **B6局**：對調莊6局 → 對調第一二張後莊家 6 點贏的牌局（對應程式 `swapBankerSix`）
- **對調莊6**：同 B6局（舊稱，程式內仍沿用）
- **卡色** (`card.back_color`)：牌背顏色 R/B，與花色無關。前4張必須 RRRB 或 BBBR
- **訊號牌**：依設定的花色+點數組合判定（如 ♥♦ + 10JQK）

## 開發注意事項

- 每次修改牌局資料後必須呼叫 `refreshAnalysisAndRender({ mutate: false })`
- 完整違規檢查用 `checkViolationsBeforeExport()` 或 `calculateViolationStats(currentRounds)`
- 全域狀態：`currentRounds`（牌局陣列）、`swapBankerSixIndexes`（對調莊6索引）、`bankerSixIndexes`（莊6索引）
- `localStorage` 用 `at-settings` 儲存設定、`at-theme` 儲存主題
- 10 點牌 rank 存為 `"10"`，不是 `"T"`
- 殘牌局（result=null）遇到無法修復時直接重新生成

## 違規修復規範

詳見 @SKILL.md — 必須依序處理：無法對調 → 連續4張 → 連續莊閒 → 訊號牌 → 卡色

## 操作規範（必守，避免重複錯誤）

- **瀏覽器一律開在使用者本機 Chrome**（`claude-in-chrome`，isLocal），使用者要能看到畫面。**禁止**用 in-app / preview 內建瀏覽器——它的下載落在沙箱，使用者的「下載」資料夾看不到檔案。
- **導出一律點網頁上的「導出」按鈕**（`btnExportCombined`），**不要**用程式呼叫 `exportRoundsAsExcelWithDrive()` 或預查 `getNextExportFilename()`。程式繞過 UI 會造成檔名跳號、回報編號與雲端實際不符。
- **「卡背顏色混合」checkbox 不要打勾。**
- 不要自作主張用程式繞過 UI，照網頁正常操作流程做。
