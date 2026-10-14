# idle-lineage-class

以原生 JavaScript 製作的《天堂》放置同人遊戲整合版。可透過靜態網站或直接開啟 HTML 遊玩，不需要 npm、建置流程或後端伺服器。

| 來源 | 內容 |
| --- | --- |
| [秋玥 shines871 原版](https://shines871.github.io/idle-lineage-class/) | 原版遊戲 |
| [pp771007 加掛版](https://pp771007.github.io/idle-lineage-class/) | 加掛模組來源 |
| [lostshin 整合版](https://github.com/lostshin/idle-lineage-class) | 本儲存庫，整合修改與本地驗證工具 |

## 啟動遊戲

需要 Python 3。在專案根目錄執行：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

開啟 [本機遊戲入口](http://127.0.0.1:8000/index.html)，按「開始遊戲」。按 `Ctrl+C` 關閉伺服器。

也可以直接用瀏覽器開啟 `index.html`。本機網址與 `file://` 的瀏覽器儲存各自獨立；固定使用同一網址、連接埠與瀏覽器，才能讀到同一份進度。遊戲的資料保存方式見 [遊玩與存檔說明](docs/gameplay-and-saves.md)。

## 修改與本地檢查

本地檢查需要 Python 3、Node.js 與 Git，不需要 Ego。從專案根目錄執行：

```bash
python3 scripts/check-local.py
```

工具依序檢查載入中的 JavaScript 與測試檔案語法、git 差異空白、資源快取 SHA、46 個鏡像加掛檔 SHA，以及四支本地整合測試。全部通過時顯示 `8/8 passed`；任一失敗會回傳非零結束碼。整合測試使用合成資料與 Node VM，未涵蓋瀏覽器排版、原生互動或桌面安裝版。

修改前端 JS／CSS 後，更新 `index.html` 中的資源快取版本，再執行本地檢查：

```bash
python3 scripts/update-cache.py
python3 scripts/check-local.py
```

`index.html` 決定 script 載入順序；請沿用現有順序。鏡像加掛檔與 `sw.js` 保留來源內容，整合修改放在 `js/` 中的專案模組。來源版本與逐檔 SHA 見 [加掛來源清單](tests/addon-source.json)。

## 執行瀏覽器 E2E

需要 `ego-browser` CLI 與可連線的 Ego。沒有 Ego 時仍可完成前一節的本地檢查，瀏覽器 E2E 與畫面驗收則需另行執行。

查看可用的 suite 與參數：

```bash
python3 tests/run-rwd.py --help
```

首次執行單一 suite，保留其測試空間：

```bash
python3 tests/run-rwd.py --suite rwd --protocol http --keep-space
```

從輸出讀取 `spaceId`，後續一律使用同一個 ID 與預設頁面 `p1`。以下命令中的 `SPACE_ID` 要換成該整數：

```bash
python3 tests/run-rwd.py --space SPACE_ID --suite required --protocol both
```

`required` 依序執行 `rwd`、`ui-scale`、`gameplay`、`account-gameplay`、`companion-commands`，先跑 HTTP，再跑 file，共十輪。批次執行需指定 `--space`，自動保留空間並在失敗時停止。

也可在 `--suite` 後依序列出多個 suite。`visual-*` 須接在對應的行為 fixture 後面；獨立執行 visual 時，指定剛完成對應 fixture 的空間。例如 `visual-account-gameplay` 要接 `account-gameplay`，中間不可插入其他 suite。

| 參數 | 行為 |
| --- | --- |
| 預設輸出 | 報告／截圖寫到 `tmp/test-runs/`，不進 git |
| `--record` | 明確將報告寫到受追蹤的 `tests/artifacts/`；四支 `*.integration.js` 也支援此參數 |
| `--artifacts PATH` | runner 改寫到指定目錄；相對路徑以專案根目錄為基準，與 `--record` 互斥 |
| `--skip-screenshots` | 圖片擷取不可用時執行行為檢查，畫面須另行驗收 |
| `--keep-space` | 單輪結束後保留空間；批次執行自動啟用 |

測試只使用合成角色與隔離儲存。不要用真實角色或 iCloud 存檔做 fixture。保留空間的全部驗收完成後，在 Ego 腳本中對同一個 TaskSpace 呼叫一次 `await task.finish({keep:[]})` 並等待完成；一般單輪未指定 `--keep-space` 時，行為 suite 自行完成空間清理。

## 目錄導覽

| 路徑 | 用途 |
| --- | --- |
| [index.html](index.html) | 入口、script 載入順序與資源快取版本 |
| [js/](js/) | 遊戲資料、戰鬥、存檔、UI 與整合模組 |
| 根目錄 `afk-*.js` | 鏡像加掛模組，以來源清單核對 SHA |
| [css/](css/) | 介面樣式 |
| [assets/](assets/)／[public/assets/](public/assets/) | 遊戲美術、音效與登入素材 |
| [scripts/](scripts/) | 本地檢查、快取版本及素材資料更新工具 |
| [tests/](tests/) | Ego E2E、Node 整合測試與既有驗收資料 |
| [docs/](docs/) | 既有遊玩與存檔說明 |
| [AGENTS.md](AGENTS.md) | 給程式代理的工作規則 |

[.ignore](.ignore) 讓 `rg` 略過 `assets/anim/`、`assets/classanim/`、`assets/morphanim/` 的逐格圖。需要查這些目錄時加上 `--no-ignore`；此設定不影響 git 追蹤或遊戲載入。

本儲存庫包含網頁端的桌面儲存介面，但未包含安裝版 Host／preload、封裝專案與 SIG2 金鑰，無法單靠本儲存庫建置桌面安裝版。產圖使用的 imagegen 服務也未隨附；執行期已使用產出的素材。

## 授權現況

本儲存庫未附 `LICENSE`；目前納入的原版與加掛來源也未附授權檔。本 README 只說明來源與現況，不授予程式或素材的使用、再散布權利。需要再散布或大量使用程式碼時，應自行聯繫各原作者確認授權。

依登入頁現有聲明：本遊戲為非官方免費同人作品，絕無營利意圖；遊戲內圖片與音樂版權歸 NCSOFT 所有，嚴禁商業販售。
