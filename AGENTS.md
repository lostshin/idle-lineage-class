# Repository Guidelines

## Project Structure & Module Organization

本專案是原生 JavaScript 天堂風格放置遊戲。`index.html` 定義畫面與 script 載入順序；`js/00-data.js` 至 `js/32-threat.js` 按功能拆分資料、戰鬥、存檔與遊戲系統，另有具名功能檔，例如 `account-transfer.js`。程式共用全域狀態，新增依賴須核對載入順序，不可只按檔名排序。

`css/` 存放樣式；`assets/` 存放美術、動畫及音訊；`public/assets/` 另有登入素材。`tests/` 存放 E2E，`tests/artifacts/` 保存報告與截圖；`docs/` 存放遊戲及存檔說明。

## Build, Test, and Development Commands

目前沒有 `package.json`、建置流程或設定好的 formatter／linter。從根目錄執行：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
node --check js/companion-commands.js
python3 tests/run-rwd.py --suite companion-commands --protocol http
python3 tests/run-rwd.py --suite account-gameplay --protocol file
```

依序為本機伺服器（開啟 `http://127.0.0.1:8000`）、單檔語法檢查、HTTP 指揮測試及直接開啟 HTML 的帳號測試。E2E 需要 Python 3、可用的 `ego-browser` CLI 與 Ego 瀏覽器；runner 自行啟動測試伺服器。

## Coding Style & Naming Conventions

沿用附近程式的排版；展開的 JavaScript 區塊通常使用四個空白。使用原生 JavaScript、camelCase 函式／變數、UPPER_SNAKE_CASE 常數；具名模組用 kebab-case。避免全面重排既有緊湊程式。修改前端資源時同步更新 `index.html` 對應的快取版本參數。保留天堂原版美術、配色及按鈕風格。

## Testing Guidelines

E2E 使用 Ego 的 Node.js 自動化介面，沒有 Jest／Playwright 或覆蓋率門檻。測試命名為 `*.e2e.js`。修 bug 先新增重現情境，再修程式。

開發時跑相關 suite；交付前逐一執行 `rwd`、`ui-scale`、`gameplay`、`account-gameplay`、`companion-commands`，各跑 `--protocol http` 與 `file`。畫面測試 `visual-account-gameplay` 須接續 `account-gameplay --keep-space`，用 `--space <id>` 指定隔離空間。交付附 `tests/artifacts/` 報告與介面截圖；桌面橋接替身不等於安裝版實測。

## Commit & Pull Request Guidelines

既有提交多為 `1`、`q`，尚無一致慣例。建議使用動作與範圍清楚的訊息，例如 `fix: correct companion guard targeting`。每次提交聚焦單一問題。

PR 說明玩家可觀察的改變、修改原因、實際測試指令與結果；有相關 issue 時連結。UI 改動附桌機、窄螢幕及 75%／100% 縮放截圖，列出未驗證平台。

## Save Safety

測試只使用合成角色與隔離儲存，不操作真實帳號或 iCloud 存檔。存檔改動須保留既有鍵名、未知欄位與網頁／桌面格式隔離，驗證寫入失敗及回復流程。不得提交玩家存檔、個資或憑證。
