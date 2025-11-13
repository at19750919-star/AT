# CSS 概覽（以 `signals.html` 內嵌 `<style>` 為準）

這份說明整理了內文裡的主要樣式區塊，讓你只要看標題就能瞭解哪段 CSS 控制哪個卡片，方便以後直接跳進去調整。

## 1. 懸浮小工具與基本輔助（`<style>` 開頭）
- 這段控制遮罩浮動小視窗與輸入欄，包含 `.floating-widget`、`.widget-content`、`.widget-actions`、`.card-input` 等看起來很像浮動小卡片的區塊。
- 若要調整功能區在主畫面前的行為、輸入格排版或結果列樣式，就在這裡修改。
- **對應行數：約 1–120。**

## 2. 全局背景與控制區框架
- 定義 `body` / `.container` 的寬度、左側控制列按鈕（`.controls`、`.controls button`、`.control-inline` 之類），以及右上角的小 mini grid。
- 想調整整體內距、按鈕間距或響應式規則，就改這個區塊。
- **對應行數：約 130–240。**

## 3. 創建區：花色／數字／快捷動作
- 對應「創建區」外框 `.selection-container`，以及花色 `.suit-selector`、數字 `.rank-selector`、快速 GO/清除群組 `.quick-actions`、`.primary-actions` 等。
- 這裡也是你調整 `.signal-count-card` 圖片、按鈕間距、數字顯示的地方。
- **對應行數：約 520–740。**

## 4. 工具列排版（快捷卡 + 編輯 + 切牌 + 圓餅）
- 控制工具列 `.signal-toolbar-row`、各種 `.signal-toolbar.*`、`.edit-toolbar`、`.edit-buttons`、`.tool-actions`、`.cut-controls` 等。
- 想改知道卡片間距、icon 尺寸（`--icon-size`）、按鈕群分組或 đặt  cut/circle 對齊時，在這裡調整。
- **對應行數：約 400–510，HTML 裡的編輯卡段落大約 930–1010。**

## 5. 結果區（表格、日誌、摘要）
- 包括 `.results-split`、`.rounds-table`、`.log`、`.grid-preview`、`.signal-summary`、`.left-pane`、`.right-pane` 以及相關的響應式規則。
- 想改表格字體、chip 顏色、日誌高度、左右欄比例都在這裡下手。
- **對應行數：約 860–1050。**

## 6. 小工具與輔助規則
- 剩下的輔助樣式（`.input-inline`、`.selectors-row`、動畫 keyframes 等），主要支援上述卡片。
- **對應行數：約 450–540 與 820–860。**

> **提示**： 每次調整前先看這份列表，確認自己要改的是哪一區。「如果發現某段沒在用，就把它記在這裡（加上區段號）」，這樣 README 也會跟著更新，未來就更容易看懂。
