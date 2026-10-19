# 進度與驗證歷史（更新至 2026-10-19）

由 `AGENTS.md` 移出；接手、發布或引用舊報告前讀。

## 2026-10-19：KEN 離線、分類與返回日誌（v3.9.7）

- 六個隱藏區的離線樣本與結算摘要改用 `HIDDEN_AREA_NAMES`，結算時重新解析地名，因此舊存檔已保存的英文代碼也會修正。
- 普通地圖離線頭目戰遵守 `set-teleport` 與每地圖指定清單；選擇透過 `AFK_BOSSAVOID.picked(map)` 讀取，並將原始頭目 ID 解析為最終變身名稱。維持完整遭遇池後略過迴避對象，不將機率轉給其他頭目；純頭目房維持原生不迴避例外。
- 主角防具維持 A 銀框、單列滑動與左右箭頭，保留全部／防具／飾品／腰帶，增加原生九部位：頭盔、盔甲、盾牌／副手、斗篷、手套、長靴、內衣、脛甲、寵物裝備。共用原篩選，搜尋、快速強化／廢品與分類位置記憶仍有效。
- 外掛設定新增 `keepview`「返回時保留日誌分頁」，預設關閉；啟用後 `focus`／`visibilitychange`／BFCache 返回保留原分頁。新建／載入角色與真正離線摘要維持原本系統日誌流程，偏好仍走既有草稿、取消、寫入確認與重載。
- `tmp/test-runs/ken-offline-settings/completion.json`：升版前本輪 HTTP／file 20 份、998/998，本地 13/13，69 個鏡像原檔 SHA 不變；原程式 25 項有 17 項預期失敗。基線使用 `git HEAD` 原始程式與現行 E2E 的暫存覆蓋層，來源 SHA 已核對；未回退髒工作樹。
- 實際 file 預覽在同目錄 `preview/`：Ego 直接截圖、1330×900、100%、右欄 300px；分類另外實測 1330／1920px、60／75／80／100%、220／300／460px。TaskSpace 已 finish，歷史 id 不重用。升版後發布驗收／commit／Pages 與公開資源證據另存 `tmp/test-runs/ken-offline-settings-release/`，不冒充 998 項在升版後重跑。
- 升版後另實跑 `comfort-release` HTTP／file 各 41/41、本地 13/13；登入顯示 v3.9.7、原版 v3.8.34，未重跑或合計成新的 998 項功能驗證。
- 本輪不改玩家存檔格式、鏡像、`sw.js` 或原版 `GAME_VERSION`；實體手機、安裝版與 iCloud 未實測。

## 2026-10-19：改名與 v3.9.6 歷史基準

- **目前已上線 commit `35addf157`**：現有專案改為「放置天堂 - 日出之國｜舒適版」，更新 GitHub 簡介、README 首行、網頁／登入標題與 PWA 名稱及實際連結；版號仍為 v3.9.6，原版基底仍為 v3.8.34。
- 最新驗證：`tmp/test-runs/project-name-correction/completion.json`，HTTP／file 的 `comfort-release`＋required 共 12 份、586/586，本地 13/13；公開資源 SHA256 4/4。Pages run [39166881023](https://github.com/lostshin/idle-lineage-class/actions/runs/39166881023) 對應上述 commit 且成功。TaskSpace 已 finish；手機與已安裝 PWA 的改名未實測。
- `lostshin/lineage-aquamarine` 儲存庫、Pages、Release、本機副本及暫存下載／ZIP 均已刪除；刪除後 GitHub API 與 Pages 都是 404，證據在 `tmp/test-runs/project-name-correction/deleted-remote.json`、`deleted-local.json`。外站鏡像的缺檔／遊玩報告不屬於本專案基準，不再引用已刪除的 `/tmp/` 產物。
- 五個歷史附註標籤與繁中 Releases 已建立，標題格式為「舒適版 vX.Y.Z」，只有 v3.9.6 是 Latest；內文取 README 各版本表格，缺 v3.9.2 時依 commit／diff 摘述，末行保留本專案遊玩網址及秋玥原版 3.8.34 歸屬。

| 標籤 | 固定目標 commit |
|---|---|
| v3.9.2 | `7e3c899` |
| v3.9.3 | `6d1b976` |
| v3.9.4 | `3f12eaf` |
| v3.9.5 | `4543ec4` |
| v3.9.6 | `b16514b` |

- 前階段功能 commit `b16514b40`：分類箭頭、主角安全能力比較、A 固定雙窗、原版三頁保留、雙擊創角、離線稀有色、即時職業 tooltip、Buff 提示穩定、強化操作及紅 X；隊員試煉保存失敗會還原原始存檔並保留隊友 runtime 參照。
- 物品功能報告：`tmp/test-runs/window-action-polish/completion.json` 908/908、本地 13/13，三張實際 file 預覽為 Ego screen-media PDF→pypdfium2 96dpi。前階段 `item-readability/completion.json` 為 878/878，含 Buff／tooltip／強化；其中 `visible-baseline/` 證明舊程式閱讀提示時 48 畫格有 45 格隱藏。
- 其他歷史報告：`tmp/test-runs/backpack-feedback/completion.json` 1064/1064、`item-window-fixed/completion.json` 720/720；v3.9.6 原發布驗收在 `tmp/test-runs/session-release-20261019/`（`comfort-release` HTTP／file 各 39/39）。各階段不可合計成獨立覆蓋或冒充最新版本重跑；上述 TaskSpace 均已 finish，歷史 id 不可重用。
- `tmp/` 報告只在本機，乾淨 clone 不保證存在。接手先核對報告與來源 SHA；更早進度見 [docs/agent-progress.md](docs/agent-progress.md)。

## 2026-10-18：背包、公會與玩家回報

- 發布版 `v3.9.5`，原版 `GAME_VERSION` 維持 `v3.8.34`。本次發布包含先前未推送的 `ec7cc70d1`（齒輪開關／精準射擊文案／KEN 回報），以及 `d33d3945e`（背包 A／橫向粗分類、公會雙擊／能力比較／穩定捲軸、隊員重複試煉、死亡與離線／副本顯示）。
- 主角與公會背包已分清：只有主角換 A 美術與分類；誤套在公會的分類／清單改版已撤回，保留要求的隊員比較。最新分類固定一列，武器 8／道具 7 項，不恢復多排 17 種細分類或內層主導航。
- 最終功能驗收 `tmp/test-runs/guild-inventory-filters/completion.json`：20 份 HTTP／file、1,042 項全過；本地 13/13。新專項各協定 70 項，含原生觸控／橫向滾輪、重繪保留位置、搜尋／批次操作與三態公會穩定尺寸。來源 SHA 已對應 `d33d3945e`，非升版後重跑；早期報告在 completion 標為 historical／superseded，不混算。
- 大背包驗證 372 格正方且不重疊；公會三態畫布 455.789px、候選 clientWidth 309px、比較 208.094px 均不變。7 張預覽在同報告的 `preview/`，方法為實際 HTTP Ego screen-media PDF → sips 72dpi，非直接截圖。
- TaskSpace 2 已單次 `finish({keep:[]})`、exit 0；預覽 HTTP 8123 已停止。實體手機、安裝版、iCloud 未實測，不得重用已完成空間或以 file 替代安裝版驗證。
- 本輪版本／文件變動另跑本地檢查及 `comfort-release` HTTP／file 各 39/39，登入顯示 `v3.9.5`／原版 `v3.8.34` 正確；發布 TaskSpace 3 已單次 finish、exit 0。push、Pages run、公開 HTTPS SHA 驗證分別保存於 `tmp/test-runs/session-release-20261018/`。報告為本機產物，乾淨 clone 需依測試入口重跑，不保證 `tmp/` 存在。

## 2026-10-17 歷史基準

- 版本 `v3.9.4`／原版 `v3.8.34`。公會 B、創角必填／順序、左下裝備控制列、倉庫直接數量交易與返回系統日誌已完成；先前 852 項與創角 550 項報告各有版本時序，見 `guild-art-20261017/completion.json`、`creation-name-layout/completion.json`，不可混算。
- `f63bb996b` 為線上人數，`d9c4f2eb9` 為效能修復。效能回歸 22 份／954 項；最後跨分類祝福卷補丁另跑 4 份／84 項（`tmp/test-runs/performance-fix/`），非全部在補丁後重跑。倉庫 5000 格約 565→10～11ms，能力冷重算約 22→7ms，僅本機操作耗時。
- 目錄整理 commit `aaf3076d0`：62 個 AFK 原樣搬移、69 個鏡像 SHA 不變、109 支 script 順序不變；清除 145 個過時產物約 157.5 MiB（不等於 Git 歷史縮減）。`tmp/test-runs/root-cleanup/`：HTTP／file 16 份／574 項、本地 13/13，含實際 PWA 離線重載；最後來源 SHA 已核對。
- `tmp/test-runs/performance-audit/` 保留 112 個情境／336 筆量測及實際 10.3 分鐘掛機；依使用者要求提早結束，未跑滿 30 分鐘，不能排除長時間／多地圖累積問題。前次發佈結果查 `tmp/test-runs/session-release-root-cleanup/`，commit／push／部署完成分開核對。
- 前次效能 `02b66869a`：重複 DOM 寫入／隱藏能力數值／登入動畫啟停與手機狀態鏡射已修；`session-performance-release/` 26 份／862 項、本地 13/13。長測依使用者指示實跑 5.09 分鐘，不是 30 分鐘；無界量測陣列的中止基線另存 `performance-p1/`，不可混算或宣稱整體 FPS。P2 背包：自動整理的 tick 內重建已於 `8a47c568e` 修正，局部數量更新未達門檻不做；浮窗與 P3 快取淘汰未實作，延後載入評估後不做（見決策檔效能小節）。
- 本次標題：依最新截圖改單層銀框、無獨立標題框及紋理分頁，保留原操作；`tmp/test-runs/party-header-reference/` 16 份／678 項、本地 13/13，屬四項修正之前的版本，不與後批報告混算。
- 本次程式 commit `981017d8b`（含標題）：安塔瑞斯四區使用現有背景；寵物專屬能力／tooltip；傭兵按角色身分篩選；離線完整戰利品。`tmp/test-runs/field-reports/` HTTP／file 20 份／854 項（專項 34 項）、本地 13/13；含原生寵物傷害對照、同名傭兵及 61 種離線物品／存檔數量核對。來源 SHA、歷史未提交清單及 96dpi PDF 轉圖隨報告保存；補版 `v3.9.3` 與 README 重整另做版本顯示／文件檢查，不重跑整套。
- 本輪效能／UX，以 `v3.9.4` 發佈（升版後 `comfort-release` HTTP／file 各 39/39；commit／push／部署與公開資源 SHA 證據在 `tmp/test-runs/session-perf-release/`）：`86862db87` 拆出決策／進度檔並擴充 `.ignore`；`8a47c568e` 自動整理改走 tick 節流，戰鬥 60 秒長任務 HTTP 5～8→1 次、file 6→2 次；`1000f400a` 四張 UI 皮改 WebP，8.55→0.75MB、登入頁冷載 13.8→11.7MB。報告在 `tmp/test-runs/perf-ux-20261017/`（`baseline`／`red`／`green`／`after-sort`／`after-assets`／`after`）：required、performance、ui-performance、素材相關與 visual 套件 HTTP／file 全過，`desktop-feedback` 為 `--skip-screenshots`；實跑 30.0 分鐘長測（訓練場↔村莊，無錯誤，每 tick 3.17→3.26ms）。
- TaskSpace id 會被重新編號；本輪 space 1 由長測 runner 以 exit 0 結束（另行列表確認時指令卡住，未二次確認）。實體手機、安裝版、iCloud 未驗證；前次 commit／push／部署與公開資源 SHA 證據查 `tmp/test-runs/session-field-release/`，不得拿先前報告冒充最終程式。
