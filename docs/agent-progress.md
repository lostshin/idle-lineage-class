# 最新進度與驗證基準（2026-10-17）

由 `AGENTS.md` 移出；接手、發布或引用舊報告前讀。

- 版本 `v3.9.4`／原版 `v3.8.34`。公會 B、創角必填／順序、左下裝備控制列、倉庫直接數量交易與返回系統日誌已完成；先前 852 項與創角 550 項報告各有版本時序，見 `guild-art-20261017/completion.json`、`creation-name-layout/completion.json`，不可混算。
- `f63bb996b` 為線上人數，`d9c4f2eb9` 為效能修復。效能回歸 22 份／954 項；最後跨分類祝福卷補丁另跑 4 份／84 項（`tmp/test-runs/performance-fix/`），非全部在補丁後重跑。倉庫 5000 格約 565→10～11ms，能力冷重算約 22→7ms，僅本機操作耗時。
- 目錄整理 commit `aaf3076d0`：62 個 AFK 原樣搬移、69 個鏡像 SHA 不變、109 支 script 順序不變；清除 145 個過時產物約 157.5 MiB（不等於 Git 歷史縮減）。`tmp/test-runs/root-cleanup/`：HTTP／file 16 份／574 項、本地 13/13，含實際 PWA 離線重載；最後來源 SHA 已核對。
- `tmp/test-runs/performance-audit/` 保留 112 個情境／336 筆量測及實際 10.3 分鐘掛機；依使用者要求提早結束，未跑滿 30 分鐘，不能排除長時間／多地圖累積問題。前次發佈結果查 `tmp/test-runs/session-release-root-cleanup/`，commit／push／部署完成分開核對。
- 前次效能 `02b66869a`：重複 DOM 寫入／隱藏能力數值／登入動畫啟停與手機狀態鏡射已修；`session-performance-release/` 26 份／862 項、本地 13/13。長測依使用者指示實跑 5.09 分鐘，不是 30 分鐘；無界量測陣列的中止基線另存 `performance-p1/`，不可混算或宣稱整體 FPS。P2 背包：自動整理的 tick 內重建已於 `8a47c568e` 修正，局部數量更新未達門檻不做；浮窗與 P3 快取淘汰未實作，延後載入評估後不做（見決策檔效能小節）。
- 本次標題：依最新截圖改單層銀框、無獨立標題框及紋理分頁，保留原操作；`tmp/test-runs/party-header-reference/` 16 份／678 項、本地 13/13，屬四項修正之前的版本，不與後批報告混算。
- 本次程式 commit `981017d8b`（含標題）：安塔瑞斯四區使用現有背景；寵物專屬能力／tooltip；傭兵按角色身分篩選；離線完整戰利品。`tmp/test-runs/field-reports/` HTTP／file 20 份／854 項（專項 34 項）、本地 13/13；含原生寵物傷害對照、同名傭兵及 61 種離線物品／存檔數量核對。來源 SHA、歷史未提交清單及 96dpi PDF 轉圖隨報告保存；補版 `v3.9.3` 與 README 重整另做版本顯示／文件檢查，不重跑整套。
- 本輪效能／UX，以 `v3.9.4` 發佈（升版後 `comfort-release` HTTP／file 各 39/39；commit／push／部署與公開資源 SHA 證據在 `tmp/test-runs/session-perf-release/`）：`86862db87` 拆出決策／進度檔並擴充 `.ignore`；`8a47c568e` 自動整理改走 tick 節流，戰鬥 60 秒長任務 HTTP 5～8→1 次、file 6→2 次；`1000f400a` 四張 UI 皮改 WebP，8.55→0.75MB、登入頁冷載 13.8→11.7MB。報告在 `tmp/test-runs/perf-ux-20261017/`（`baseline`／`red`／`green`／`after-sort`／`after-assets`／`after`）：required、performance、ui-performance、素材相關與 visual 套件 HTTP／file 全過，`desktop-feedback` 為 `--skip-screenshots`；實跑 30.0 分鐘長測（訓練場↔村莊，無錯誤，每 tick 3.17→3.26ms）。
- TaskSpace id 會被重新編號；本輪 space 1 由長測 runner 以 exit 0 結束（另行列表確認時指令卡住，未二次確認）。實體手機、安裝版、iCloud 未驗證；前次 commit／push／部署與公開資源 SHA 證據查 `tmp/test-runs/session-field-release/`，不得拿先前報告冒充最終程式。
