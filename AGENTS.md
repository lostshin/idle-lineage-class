# AGENTS.md — idle-lineage-class

## 工作原則

- 一律使用台灣繁體中文；程式識別字、指令與專有名詞保留英文。
- 開工先讀本檔、檢查 `git status`，保留其他人與前一輪的修改。
- 方向已確認就完成範圍內的工作；只有新資訊會改變目標或授權時才再詢問。
- 先用 `rg`、檔案讀取與既有測試查證；不要為本地可回答的問題上網。
- 修 bug 先寫可重現的 E2E，確認在原程式失敗後再修程式；之後改動該測試也要對原程式再確認一次失敗。禁止為了覆蓋率補表面測試。
- 每行修改須能對應需求，不順便重排、重寫或增加未要求的功能。
- 大段修改前：檔案若已追蹤且乾淨，以 git 為退路；否則先做同目錄 `.bak-時間戳` 備份。
- 同一方法失敗兩次，先查本檔與實際原因，再換方法；不可第三次原樣重試。
- 只有重複、可歸因且可用窄規則避免的問題才寫入本檔；保持 250 行內。
- 未經明確要求，不修改規則／其他文件、不新增代理派工、不自動 commit 或 push。
- 每輪完成時，已授權就按指定批次 commit；未授權則交接列出**全部**未提交檔案（多時可附完整清單）。不要讓多輪修改混在工作樹；既有授權延續，不重複詢問。
- 顯示類需求先給一個推薦方案並說明窄欄寬度取捨，不連丟多輪選單；與已確認決策（如右欄 300px）衝突時先確認。
- 審查／最佳化請求（`/simplify`、「給建議」）只交建議表（效益、風險、門檻），使用者說做才改；效能／UX 先量測與 profile 找根因，再依門檻決定做不做（見效能小節）。

## 接手其他 agent 的工作

- 使用者指定 Herdr 時，先讀 `herdr` 技能並確認 `HERDR_ENV=1`；以目前 pane 的實際鄰居、agent 狀態與 cwd 辨識目標，不依 UI 焦點或舊名稱猜測。
- 先讀 pane 的交接輸出；不足時依技能補讀，必要時只查對應的本機 session。核對最新需求、已選方案／授權、工作樹、進行中的 runner 與完成證據，再決定剩餘工作，不從頭重做。
- pane 名稱可能被沿用；關閉前重新確認目前 occupant。若舊美術 pane 已成為本次接手的工作 pane，保留並說明，不套用舊的關閉選擇把自己關掉。

## 結構、載入順序與加掛來源

- 原生 JavaScript，共用全域狀態，沒有 `package.json`、建置流程或 formatter／linter；`index.html` 是 script 載入順序的真相，不得按檔名排序。
- `js/00-data.js`～`js/32-threat.js` 與具名模組處理遊戲；`css/` 為樣式，`assets/` 為原版美術／音效，`public/assets/` 為登入素材；`tests/` 為 Ego E2E、`tests/artifacts/` 為驗收／合成預覽、`docs/` 為既有說明。
- 沿用附近排版，展開區塊通常為四個空白；變數／函式用 camelCase，常數用 UPPER_SNAKE_CASE。
- 前端資源修改後，執行 `python3 scripts/update-cache.py` 更新對應 URL 的 SHA 快取版本。
- 原版天堂美術、配色與按鈕風格是既定方向。已選設計須先找回原圖，比對比例、材質、圖示與控制列後再實作；功能測試通過不代表視覺還原。概念圖的圖示／數字不能當遊戲資料；選擇版型不等於授權更換原素材、部位或操作邏輯。
- 69 個鏡像檔取自 <https://pp771007.github.io/idle-lineage-class/>，固定 commit `5f00f4a86389aaa7309c24d7a7c1ab060c47b500`，62 個 `afk-*.js` 集中在 `js/vendor/afk/`；[來源清單](tests/addon-source.json) 的 `path` 保留上游位置，`localPath` 指本機路徑，SHA 不變；實際載入以 `index.html`／開關 catalog 為準。不修改鏡像或 `sw.js`，整合差異放本版模組並核對來源 SHA。
- 搬移鏡像只改路徑對照與載入引用，不改內容；核對完整 script 順序、逐檔 SHA、PWA 新路徑快取與實際離線重載，不能只驗 HTTP 首次開頁。
- 開發產物：已採用美術與 prompts 在 `output/design-source/imagegen/`，`output/imagegen` 為舊引用連結；歷史驗收在 `tests/artifacts/archive/2026-10-17/`，`tmp/` 全部忽略。清除前看 metadata 的選擇、最終報告引用與現用腳本輸入；不要只按日期、檔名第一字或尺寸判斷過時。保留必要來源，刪除記錄舊路徑／SHA／原因；只歸檔不等於已清理。
- 舊浮動開關面板已移除；`js/addon-switches.js` 明列固定基底與可選 catalog，不讀舊 `afk_toggle_*`；未知 ID 預設關閉。`statpts` 與主角點數來源面板維持移除。

## 已確認的產品決策（更新至 2026-10-19）

本檔下方為本次最新決策；其他細節見 [docs/agent-decisions.md](docs/agent-decisions.md)。**修改對應功能、樣式、素材或測試前，先讀該小節**（`rg -n '^### ' docs/agent-decisions.md` 取行號後只讀那段）。最新使用者指示優先，不恢復已否決／已移除的方案。

| 小節 | 涉及範圍 |
|---|---|
| 版面與隊伍 | 三欄寬度、隊伍名牌／技能卡／隊友裝備版型、倉庫系銀框、異常狀態、倒地／復活、整理背包 |
| 加掛選項與角色分頁 | 加掛開關與偏好套用、行動裝置版、存檔格數、角色分頁美術、背包角標、創角角色 ID |
| 裝置縮放 | UI 縮放 60～100%、遷移、座標換算 |
| 能力提示、隊友浮窗與技能條件 | 能力來源 tooltip、寵物能力、隊友浮窗、裝備提示、技能卡／喝水條件、`_hpSkillPct` |
| 召喚物圖片與地圖名稱 | `companionSpriteForm`、召喚物名稱、地圖懸浮、`AREA_1920`、hit mask |
| 裝備美術、負重與狀態圖示 | 裝備背景／槽位比例、主角背包 A 與單列分類、負重、狀態圖示、UI 素材 WebP 與換檔名 |
| DPS 與日誌 | DPS 快照與圖表、寵物 DPS、戰鬥／系統日誌與篩選 |
| 戰鬥、經驗與村莊增益 | 寵物／召喚物加速、隊友 EXP、村莊 buff |
| 離線掛機 | 離線結算條件、補跑呈現、歷史紀錄 |
| 傭兵公會 | `js/guild-window.js` 雙擊換裝、隊員能力比較、固定捲軸與控制欄比例 |
| 倉庫 | 倉庫外框、尺寸、雙欄捲動、數量交易 |
| 強化與金額記憶 | 強化視窗、`modalguard`、捐獻／倉庫金額 |
| 效能與線上人數 | 虛擬化、`renderTabs` 失效與 tick 內重建、能力預覽、`online-presence`、量測門檻與 CPU profile、延後載入、DOM 寫入、登入動畫 |

## 介面修正的範圍與驗收

- 「主角背包」（`js/10-ui-tabs.js`）、「公會的隊長背包」（`js/guild-window.js`）與唯讀隊友浮窗是三個不同介面；先依截圖／入口核對對象。改錯的介面只撤回誤改部分，保留另行要求的能力比較等功能。
- 主角背包沿用已選 A 美術；不恢復被刪除的內層「武器／防具／道具」列。細分類固定單列橫向滑動，武器 8／道具 7 項（含全部），不得再展開成每種武器一格的多排分類；完整名稱與窄欄可用性優先。
- 背包格須驗證大量物品下的相鄰座標與不重疊，不能只量單格寬高比。flex／grid 中的百分比子高度可能壓縮隱含列；沿用現有 `grid-auto-rows:max-content` 與絕對定位圖示層，不以固定高度掩蓋根因。
- 分類須與搜尋、快速強化／廢品共用篩選；批次操作時鎖住分類，避免操作隱藏物品。各頁獨立保存分類與橫向位置，重繪／切頁仍保留，換角色才重設。
- 公會捲軸與比較區須對照無選取／已選取／搜尋無結果三態；預留固定軌道，核對畫布與清單寬度不跳動。幾何量測取扣除捲軸的 `clientWidth` 再換算 UI 縮放，不拿外框寬度當內容寬度。

### 物品雙窗與角色選擇（2026-10-19 最終決策）

- 能力／裝備／技能三頁保留原版 UI；武器／防具／道具保留 A 銀框、單列分類與左右箭頭，背景沿用倉庫灰黑材質。
- 主角單擊背包裝備開啟兩個**固定**浮窗：左為目前裝備與能力比較，右為物品資訊／操作；不拖曳、不手動縮放，短畫面在各自內容區捲動。不在武器／防具清單下方增加比較說明。
- 比較窗保留目前裝備圖示、說明及角色名稱；只有差值區採小字緊湊單行 `能力｜原值 → 新值（差值）`，有利綠、不利紅，AC／間隔反向。參考圖只改指定區塊，不據此刪掉整窗既有內容。
- 物品雙窗以透明銀框 `item-modal-frame-v1.webp` 疊倉庫皮革，背景限制在 padding-box、無外陰影；閱讀區用單純不透明深色。已選素材與 prompts 留在 `output/design-source/imagegen/item-modal-proposals-20261019/`。
- 右上 C 款紅色 X 用 `item-modal-close-v1.webp`；無底部關閉按鈕。關閉物品資訊須連比較窗一起關閉，左 X 只關比較窗。倉庫、公會名冊／任務共用此 X；公會裝備頁仍是「返回名冊」。
- 操作順序為廢品標記→裝備→強化→一鍵弱化→販賣。裝備底色填滿內框；祝福卷軸強化發光黃，弱化／詛咒卷暗紅，保留 disabled、消耗、機率與原生 handler。
- 主角與公會共用 `renderEquipmentComparison`，只對角色副本跑原生換裝／能力公式；不改 live、RNG 或存檔。飾品只列已解鎖部位，預覽選位必須傳給實際裝備操作。
- 職業圖示用共用 tooltip 立即顯示名稱，移除延遲的原生 title，保留 alt／aria 與鍵盤提示；勿誤觸整件物品提示或取消普通物品的 notip 偏好。
- 空角色格單擊只選取，必須左鍵雙擊才進創角；原創角按鈕、鍵盤與已存角色雙擊載入保留。取消不寫檔、不留下草稿。
- 離線收益名稱用 `getItemColor`，不只讀基底色；系統日誌不可用後代萬用選擇器蓋掉傳說、遺物、祝福、詛咒及萬能藥的原生色。

### 本次反覆問題的窄規則

- 改錯區塊／需回退時，先比對指定輪次快照及 SHA，只撤回誤改；髒工作樹不能直接還原 HEAD，也不能憑記憶重建已選版型。
- 按鈕「不滿版」先分辨外框幾何與實際填色；檢查 computed style、偽元素 inset、border-image 的 fill 與選擇器優先序。加掛可能在核心返回後才插入按鈕，須核對載入／DOMContentLoaded 掛鉤順序；文案放本版整合層，不改 vendor 或加整頁 observer。
- Buff 說明閃爍須測「游標移入提示閱讀＋另一個效果加入／到期」，逐幀驗可見性；只確認 DOM 身分不變不算重現。狀態種類變動時保留未變的圖示節點，仍驗離開、到期與換角色能正確隱藏。
- 透明框要檢查 alpha、原圖黑底與實際合成畫面；PNG／WebP 保留透明度，不能靠裁切或加固定高度遮住突出背景。外框與文字底色分開處理。

## 開發與驗證

- 預覽：`python3 -m http.server 8000 --bind 127.0.0.1`；E2E 選項：`python3 tests/run-rwd.py --help`。人類入門看 `README.md`，本檔只留代理規則。`.ignore` 讓 `rg` 略過 `assets/anim`、`classanim`、`morphanim` 的 20 萬張逐格圖、單行巨大的自動產生檔 `js/anim-manifest.js`／`anim-manifest.json` 與 `tests/artifacts/archive/`；要搜那裡時用 `rg --no-ignore`。
- E2E 使用 Python 3、`ego-browser` CLI 與 Ego；runner 自行啟動 HTTP 伺服器。操作前讀 `ego-browser` 技能，只用記載的 API，不猜 Playwright 方法。
- 每個任務只建一個 TaskSpace，所有 runner **逐批共用同一 space／p1**、不並行，失敗在原空間恢復。首輪可用 `--suite rwd --protocol http --desktop-only --keep-space` 取得 `spaceId`，後續帶 `--space`；多 suite／`--protocol both` 依序執行、自動 keep-space、遇錯即停，未帶 `--space` 會直接報錯。TaskSpace id 會被重新編號，跨 session 不以舊 id 判斷可否操作。
- 測試報告預設寫入 `tmp/test-runs/`（不進 git）；要更新受追蹤的 `tests/artifacts/` 才加 `--record`（runner 與 `*.integration.js` 相同）；runner 可用 `--artifacts <目錄>` 指定其他輸出位置，與 `--record` 互斥。
- 成功後只呼叫一次 `finish({keep:[]})` 並等待完成；耗時時用背景程序讀回結果，不用短 timeout 中止再反覆重送。有 `finished <id>` 與成功結束碼後，不再操作該空間。
- 必跑 `rwd`、`ui-scale`、`gameplay`、`account-gameplay`、`companion-commands` 的 HTTP／file：`--space <id> --suite required --protocol both --desktop-only`。
- 相關 E2E：`compact-layout`、`party-refinements`、`party-equipment`、`village-clan-warehouse`、`skill-cards`、`ally-skill-stop`、`town-buffs-enhance`、`summon-display`、`desktop-feedback`、`desktop-acceptance`、`tooltip-stability`、`effect-details`、`guild-settlement`、`offline-rewards`、`creation-id`、`comfort-release`、`backpack-feedback`、`item-window-controls`、`mobile-status`、`party-header`、`field-reports`、`backpack-a`、`main-backpack`、`guild-inventory-filters`、`equipment-trials`、`player-feedback`；同樣帶 `--desktop-only`。
- TaskSpace 消失不能自行重建；使用者暫緩重建時，先完成本地工作並記錄待跑的瀏覽器檢查，後續不得把 Node VM／幾何替身說成瀏覽器 E2E 通過。
- 所有 `visual-*` 必須緊接同一 space 的對應行為 fixture，例如 `account-gameplay visual-account-gameplay`；中間不可插入其他 suite，各 fixture 的全域儲存不可互換。runner 會拒絕順序錯誤的組合。
- 狀態節點／控制項測試依 `data-*`／欄位語意定位，不假設職業為名稱的 `nextElementSibling`。創角 fixture 須明填合成 ID；舊未命名存檔另建 fixture，不繞過必填限制。需求已變就改舊斷言，不恢復已移除功能；找長單行斷言用 `rg --no-ignore -o '.{60}舊字串.{60}' tests`，不用 `grep -n | cut`。相同物品（同 id／強化）簽章不含 uid，互換位置不會重建；斷言比可見內容，不比 uid。
- 每個 suite 明確設定起始視窗；靜態 fixture 停計時器也設 `state.running=false`；離線讀檔須先等原生非同步結算回呼完成才停止 running，否則會誤擋結算。縮放／切尺寸後等版面穩定；原生滾輪每輪先以目前目標 rect 的中心執行 `page.mouse.move()`，再 `wheel()`；不能假設 `hover()` 已把游標留在捲動區。scrollTop／scrollLeft 連續畫格穩定後再比對，避免把慣性誤判為兩側連動。原生命中須選目前可視控制項，不能固定取已捲出視窗的第一格；比例／不重疊仍檢查全體。原生選擇器點擊若因自動捲動被 sticky 欄擋住，先觀察命中元素，再聚焦、核對 `elementFromPoint`、用原生滑鼠點擊；不盲目重試或強制穿透。
- 懸浮測試先等 resize／scroll 與版面穩定；選不被其他 sprite 遮住、離透明邊緣足夠遠的像素，避免取點到送入滑鼠事件間角色已移動。可短暫固定合成場景的原生畫格，完成後還原；不冒充完整戰鬥驗證。
- 不直接改寵物記憶體陣列充當已儲存名冊；用原生 dirty／save 流程，避免下一次查詢把測試寵物清掉。
- 擷取圖片不可用／`Page.captureScreenshot` 逾時時，從失敗 suite 接續 `--skip-screenshots`，不重跑已通過的；用 Ego screen-media PDF 轉 PNG。PDF 放 `tmp/pdfs/`、驗收後刪除；標示協定、轉圖工具與實際 dpi（依實際工具記錄，如 pypdfium2 96dpi；舊 sips 預覽為 72dpi），不宣稱直接截圖。
- 實際檢查桌機 1330／1920px、60／75／80／100% 與 220／300／460px 側欄；倒地傭兵及寵物的所有控制項、標籤文字均須在邊界內，不能只量卡片高度。
- 倉庫另跑 `warehouse-list` 與 `village-clan-warehouse`（HTTP／file）。驗證預設尺寸要清除測試調整並以 100% 量測；預設圖與已拖曳縮放圖分開命名。命中區留在外框內，實測縮放時 border 取整，不能假設 CSS 宣告值等於實際邊界。
- 本地檢查一律跑 `python3 scripts/check-local.py`：JS 語法、`git diff --check`、`?v=` 資源 SHA、69 個鏡像檔 SHA 與全部 `tests/*.integration.js`。integration 只驗原生流程／幾何邊界，不等於瀏覽器 E2E；原生新增全域依賴時更新合成 fixture，不為缺少的測試替身增加正式環境 fallback。
- 保留可重跑的 JSON 報告、來源雜湊及代表性預覽；完整驗證須對應實際程式 commit 與報告。交接要區分「本輪實跑」與「核對前人報告」；事後擷取的來源 SHA 不得冒充 runner 當時記錄的 SHA。
- 報告檔名依 runner 實際輸出；引用前核對存在、方法、版本與結果，不用歷史報告／早期預覽充作後續驗證。HTTP／file 共用圖檔會被覆寫，須標明最終圖的協定與方法，不能當兩次獨立擷取。
- 桌面橋接替身與 file 協定不等於安裝版實測；本機 iCloud 複製／雜湊相符不等於遠端同步完成。
- 測試保持精簡：先選可重現需求的最小專項，完成後只跑必要核心；通過即停，不因增加信心而追加套件、長測或重複預覽。接手先核對來源 SHA 與報告；未變就沿用，失敗僅接續受影響套件，測試前置錯誤先修 fixture。僅改本檔不重跑遊戲 E2E；使用者縮短時長就依其指示收尾。
- 背景 E2E 執行中不改程式；要改就先停 runner，改完 `update-cache.py` 後重跑，避免同一份報告混到兩版程式。使用者要求「做完再測」時，所有修改完成後只跑一次。等待長 runner 用背景程序與完成通知，不輪詢；期間只在 `tmp/` 準備素材或腳本。
- 自寫量測腳本與報告放 `tmp/test-runs/<任務>/`，需要伺服器時自起 `python3 -m http.server <port> --bind 127.0.0.1`，結束後關閉；先定門檻與改善前基準，改善後以同腳本、同情境放 `after/` 比較。
- 合成測試物品要帶原生欄位預設值（`bless/anc/attr/seteff:false` 等）；`?.` 擋不住 `false`，存檔欄位一律先判斷真值再呼叫方法。實機錯誤重現不出時，請使用者提供主控台堆疊，不要盲猜。
- 找回未提交的舊版本：從 `~/.codex/sessions/<日期>/rollout-*.jsonl` 取出寫檔指令，在 `git worktree` 重放（瀏覽器／runner 指令改為 stub），再以該輪 `sources-under-test.json` 的 SHA256 逐檔驗證；不可手改內容湊雜湊。

## 存檔、隱私與提交

- 測試只用合成角色與隔離儲存；不得讀寫真實帳號或 iCloud 存檔。
- 保留既有鍵名、未知欄位及網頁／桌面格式隔離；測試寫入失敗與回復流程。帳號匯入先以本版原生匯出→按鈕選檔→預覽→確認→重載驗證；SIG1／SIG2、舊角色檔、完整備份、衝突選擇與寫入回復均沿用原格式，重現解析失敗才修解析器。
- 測試未知欄位時，在匯出快照建立前注入同一份來源資料；不要稍後又還原較早快照，再誤判欄位被匯入流程刪除。
- 不提交玩家存檔、憑證、個資、`.DS_Store`、備份、快取或合成帳號匯出檔。發佈報告先移除本機／iCloud 的絕對路徑，改用專案相對路徑或中性標記。
- 圖像生成概念與合成角色預覽是驗收素材，不得用概念圖的文字／數字替換遊戲資料。
- 分批 commit 須處理全域依賴：定義、script 載入與呼叫端須在同一批可用；共用檔案按功能分段暫存，每批 `index.html` 快取版本須對應該批索引的資源內容，不能提前帶入下一批的 SHA。
- commit 以單一功能範圍命名，例如 `fix: preserve village buffs across ally refresh`；不只寫 `1`／`q`。
- push 前核對遠端／分支與差異，不 force push；未授權不推到 upstream 或改動別人的歷史。
- PR／交付列出玩家可見變化、修改原因、modified files、實跑檢查與結果、預覽及未驗證平台。

## GitHub Pages 部署

- GitHub CLI 查詢／操作明確加 `--repo lostshin/idle-lineage-class`，API 用完整 repo 路徑；fork 預設可能指向 upstream。部署以 HEAD SHA 與 run ID 核對，CLI `workflowName` 與 API `name` 不保證相同。
- 已確認入口：<https://lostshin.github.io/idle-lineage-class/>；`origin` 為 `lostshin/idle-lineage-class`，Pages 從 `main:/` 發布（`build_type:legacy`，GitHub 產生建置工作），不需新增本機建置或 workflow。
- 使用者授權部署後，先 `git fetch origin`，核對分支、遠端、落後／超前與**全部待推送 commit**；確認本地驗證與工作樹後，以 `git push origin main` 發布。`tmp/` 素材／報告不可加入，不能誤推 `upstream`。功能／修正發布須同步 `FORK_VERSION`、README 與版本斷言，核對登入顯示與快取 SHA；原版 `GAME_VERSION` 維持獨立，純文件修改不升版。
- push 成功不代表已上線；追蹤這次 HEAD 的 `pages build and deployment`，等 build／deploy 成功。長操作用背景程序並定期回報，不因正常等待重新推送或重建。
- 發布後以公開 HTTPS 比對線上 `index.html`、本次改動的 JS／CSS／素材與本機已提交內容 SHA256；保存 commit、run URL、結果與時間。這是資源驗證，不等於線上瀏覽器 E2E，也不讀寫玩家儲存。

## 最新進度與驗證基準（2026-10-19）

- 本次以 `4543ec4c2`（v3.9.5）為基底，完成分類箭頭、主角安全能力比較、A 固定雙窗、原版三頁保留、角色格雙擊創角、離線稀有色、職業即時 tooltip、Buff 閃爍、按鈕滿版／文案及倉庫公會紅 X；隊員試煉保存失敗也還原原始存檔並保留隊友 runtime 方法。
- 最終功能基準：`tmp/test-runs/window-action-polish/completion.json`，HTTP／file 18 份、908/908，本地 13/13；含 required、背包／固定雙窗與倉庫整合。來源 SHA 已核對，三張實際 file 預覽為 Ego screen-media PDF→pypdfium2 96dpi。
- 前階段 `tmp/test-runs/item-readability/completion.json` 為 878/878，含 Buff／tooltip／強化回歸；可見性失敗證據在 `visible-baseline/`（舊程式閱讀提示時 48 畫格有 45 格隱藏）。`backpack-feedback/completion.json` 1064/1064、`item-window-fixed/completion.json` 720/720 為各階段報告，不合計為獨立覆蓋或冒充最新版本重跑。
- 上述各任務 TaskSpace 均已 finish（id 會重新編號，不得據歷史 id 操作）。手機、安裝版未實測；測試僅合成角色與隔離儲存。
- 發布驗收 `comfort-release`：HTTP／file 各 39/39，本地 13/13；發布 TaskSpace 已 finish。功能測試沿用上列報告，未冒充整套重跑。
- 發布版 v3.9.6 同步 `FORK_VERSION`、README、版本斷言與資源 SHA；發布檢查、commit／Pages run／公開資源驗證記在 `tmp/test-runs/session-release-20261019/`。push 不等於部署成功；`tmp/` 只在本機，乾淨 clone 不保證存在。較早歷史見 [docs/agent-progress.md](docs/agent-progress.md)。
