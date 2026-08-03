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
