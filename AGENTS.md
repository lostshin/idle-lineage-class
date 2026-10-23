# AGENTS.md — idle-lineage-class

## 專案識別與目前範圍

- 對外名稱統一為 **放置天堂 - 日出之國｜舒適版**；現行儲存庫仍是 `lostshin/idle-lineage-class`，本機沿用本專案目錄，網址仍為 <https://lostshin.github.io/idle-lineage-class/>。
- 「日出之國」是現有專案的名稱，不代表切換程式基底、匯入外站內容、重抓素材或另建儲存庫。`lostshin/lineage-aquamarine` 的鏡像任務已取消且刪除，不得依歷史指示恢復；後續明確的新指示另行處理。
- 需求可能同時涉及改名、鏡像或新站時，先列清楚**操作哪個專案、改哪些內容、發到哪個網址**；只有實質歧義才釐清。方向已明確就執行，不因例行實作細節反覆確認。

## 工作原則

- 一律使用台灣繁體中文；程式識別字、指令與專有名詞保留英文。
- 開工先讀本檔、檢查 `git status`，保留其他人與前一輪的修改。
- 先用 `rg`、檔案讀取與既有測試查證；不要為本地可回答的問題上網。
- 修 bug 先寫可重現的 E2E，確認在原程式失敗後再修程式；之後改動該測試也要對原程式再確認一次失敗。禁止為了覆蓋率補表面測試。
- 每行修改須能對應需求，不順便重排、重寫或增加未要求的功能。
- 大段修改前：檔案若已追蹤且乾淨，以 git 為退路；否則先做同目錄 `.bak-時間戳` 備份。
- 同一方法失敗兩次，先查本檔與實際原因，再換方法；不可第三次原樣重試。
- 只有重複、可歸因且可用窄規則避免的問題才寫入本檔；保持 250 行內。
- 未經明確要求，不修改規則／其他文件、不新增代理派工、不自動 commit 或 push。
- 每輪完成時，已授權就按指定批次 commit；未授權則交接列出**全部**未提交檔案（多時可附完整清單）。不要讓多輪修改混在工作樹；既有授權延續，不重複詢問。
- 顯示類需求先給一個推薦方案並說明窄欄寬度取捨，不連丟多輪選單；與已確認決策（如右欄 300px）衝突時先確認。
- 「先討論／給建議」及 `/simplify` 只分析、列效益／風險／門檻，不把補充說明或可行性詢問當實作授權；明確要求實作才改。效能／UX 先量測與 profile 找根因，再依門檻決定做不做（見效能小節）。

## 接手其他 agent 的工作

- 使用者指定 Herdr 時，先讀 `herdr` 技能並確認 `HERDR_ENV=1`；以目前 pane 的實際鄰居、agent 狀態與 cwd 辨識目標，不依 UI 焦點或舊名稱猜測。
- 先讀 pane 的交接輸出；不足時依技能補讀，必要時只查對應的本機 session。核對最新需求、已選方案／授權、工作樹、進行中的 runner 與完成證據，再決定剩餘工作，不從頭重做。若終端輸出不足，依 session ID 或最新需求定位本機 session，核對 `request_user_input` 的實際回答；session 所在日期可能是開始日期，不以目前日期猜測。
- pane 名稱可能被沿用；關閉前重新確認目前 occupant。若舊美術 pane 已成為本次接手的工作 pane，保留並說明，不套用舊的關閉選擇把自己關掉。

## 結構、載入順序與加掛來源

- 前端為原生 JavaScript、共用全域狀態，無 npm 建置流程；`index.html` 是 script 載入順序的真相，不得按檔名排序。大廳後端獨立在 `backend/lobby/`（Workers／D1，有自己的 `package.json`），不把前端改成 Astro 或搬移單機存檔。
- `js/00-data.js`～`js/32-threat.js` 與具名模組處理遊戲；`css/` 為樣式，`assets/` 為原版美術／音效，`public/assets/` 為登入素材；`tests/` 為 Ego E2E、`tests/artifacts/` 為驗收／合成預覽、`docs/` 為既有說明。
- 沿用附近排版，展開區塊通常為四個空白；變數／函式用 camelCase，常數用 UPPER_SNAKE_CASE。
- 前端資源修改後，執行 `python3 scripts/update-cache.py` 更新對應 URL 的 SHA 快取版本。
- 原版天堂美術、配色與按鈕風格是既定方向。已選設計須先找回原圖，比對比例、材質、圖示與控制列後再實作；功能測試通過不代表視覺還原。概念圖的圖示／數字不能當遊戲資料；選擇版型不等於授權更換原素材、部位或操作邏輯。
- 69 個鏡像檔取自 <https://pp771007.github.io/idle-lineage-class/>，固定 commit `5f00f4a86389aaa7309c24d7a7c1ab060c47b500`，62 個 `afk-*.js` 集中在 `js/vendor/afk/`；[來源清單](tests/addon-source.json) 的 `path` 保留上游位置，`localPath` 指本機路徑，SHA 不變；實際載入以 `index.html`／開關 catalog 為準。不修改鏡像或 `sw.js`，整合差異放本版模組並核對來源 SHA。
- 搬移鏡像只改路徑對照與載入引用，不改內容；核對完整 script 順序、逐檔 SHA、PWA 新路徑快取與實際離線重載，不能只驗 HTTP 首次開頁。
- 開發產物：已採用美術與 prompts 在 `output/design-source/imagegen/`，`output/imagegen` 為舊引用連結；歷史驗收在 `tests/artifacts/archive/2026-10-17/`，`tmp/` 全部忽略。清除前看 metadata 的選擇、最終報告引用與現用腳本輸入；不要只按日期、檔名第一字或尺寸判斷過時。保留必要來源，刪除記錄舊路徑／SHA／原因；只歸檔不等於已清理。
- 舊浮動開關面板已移除；`js/addon-switches.js` 明列固定基底與可選 catalog，不讀舊 `afk_toggle_*`；未知 ID 預設關閉。`statpts` 與主角點數來源面板維持移除。

## 已確認的產品決策（更新至 2026-10-23）

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
| 傭兵公會 | `js/guild-window.js` 單擊比較、獨立強化入口、雙擊換裝、固定捲軸 |
| 倉庫 | 倉庫外框、尺寸、雙欄捲動、數量交易 |
| 強化與金額記憶 | 單件／同款批次強化、`modalguard`、捐獻／倉庫金額 |
| 效能與線上人數 | 虛擬化、`renderTabs` 失效與 tick 內重建、能力預覽、`online-presence`、量測門檻與 CPU profile、延後載入、DOM 寫入、登入動畫 |

## 介面修正的範圍與驗收

- 「主角背包」（`js/10-ui-tabs.js`）、「公會的隊長背包」（`js/guild-window.js`）與唯讀隊友浮窗是三個不同介面；先依截圖／入口核對對象。改錯的介面只撤回誤改部分，保留另行要求的能力比較等功能。
- 主角背包沿用已選 A 美術；不恢復被刪除的內層「武器／防具／道具」列。細分類固定單列橫向滑動，武器 8／防具 13／道具 7 項（含全部），不得再展開成每種武器一格的多排分類；完整名稱與窄欄可用性優先。
- 背包格須驗證大量物品下的相鄰座標與不重疊，不能只量單格寬高比。flex／grid 中的百分比子高度可能壓縮隱含列；沿用現有 `grid-auto-rows:max-content` 與絕對定位圖示層，不以固定高度掩蓋根因。
- 武器／防具／道具格以**螢幕實際至少 55×55px**為基準，正方形、每列均分填滿；沿用 `auto-fill/minmax` 與 `--ui-scale-inverse`。不可只看未縮放的 CSS 55px；驗證縮放後的 rect、相鄰間距與右側留白，不改回固定三欄。
- 分類須與搜尋、快速強化／廢品共用篩選；批次操作時鎖住分類，避免操作隱藏物品。各頁獨立保存分類與橫向位置，重繪／切頁仍保留，換角色才重設。防具新增部位沿用原生 `slot`（內衣 `tshirt`、脛甲 `shin`、寵物裝備 `petarm`），不另造裝備種類。
- 公會捲軸與比較區須對照無選取／已選取／搜尋無結果三態；預留固定軌道，核對畫布與清單寬度不跳動。幾何量測取扣除捲軸的 `clientWidth` 再換算 UI 縮放，不拿外框寬度當內容寬度。

### 物品雙窗與角色選擇（2026-10-19 最終決策）

- 能力／裝備／技能三頁保留原版 UI；武器／防具／道具保留 A 銀框、單列分類與左右箭頭，背景沿用倉庫灰黑材質。
- 主角單擊背包裝備開啟兩個**固定**浮窗：左為目前裝備與能力比較，右為物品資訊／操作；不拖曳、不手動縮放，短畫面在各自內容區捲動。不在武器／防具清單下方增加比較說明。
- 比較窗保留目前裝備圖示、說明及角色名稱；只有差值區採小字緊湊單行 `能力｜原值 → 新值（差值）`，有利綠、不利紅，AC／間隔反向。參考圖只改指定區塊，不據此刪掉整窗既有內容。
- 物品雙窗以透明銀框 `item-modal-frame-v1.webp` 疊倉庫皮革，背景限制在 padding-box、無外陰影；閱讀區用單純不透明深色。已選素材與 prompts 留在 `output/design-source/imagegen/item-modal-proposals-20261019/`。
- 右上 C 款紅色 X 用 `item-modal-close-v1.webp`；無底部關閉按鈕。關閉物品資訊須連比較窗一起關閉，左 X 只關比較窗。倉庫、公會名冊／任務共用此 X；公會裝備頁仍是「返回名冊」。
- 操作順序為廢品標記→裝備→強化→一鍵弱化→販賣。裝備底色填滿內框；強化入口、普通卷與一鍵強化為藍色，祝福卷發光黃，弱化／詛咒卷暗紅。配色在共用 `#modal-actions` 修正，核對 `border-image` 的 fill；一鍵弱化入口、面板 `AFK_CURSEBATCH.run()` 與缺卷軸 disabled 三態都須覆蓋，返回按鈕維持中性色。保留原生確認、消耗、機率與 handler。
- 主角與公會共用 `renderEquipmentComparison`，只對角色副本跑原生換裝／能力公式；不改 live、RNG 或存檔。飾品只列已解鎖部位，預覽選位必須傳給實際裝備操作。
- 職業圖示用共用 tooltip 立即顯示名稱，移除延遲的原生 title，保留 alt／aria 與鍵盤提示；勿誤觸整件物品提示或取消普通物品的 notip 偏好。
- 空角色格單擊只選取，必須左鍵雙擊才進創角；原創角按鈕、鍵盤與已存角色雙擊載入保留。取消不寫檔、不留下草稿。
- 離線收益名稱用 `getItemColor`，不只讀基底色；系統日誌不可用後代萬用選擇器蓋掉傳說、遺物、祝福、詛咒及萬能藥的原生色。

### 物品發光與動畫（2026-10-23，v3.9.26 加固定光暈）

- 原生 `getGlowClass` 判定的特殊物品在下列介面顯示**固定光暈**：三個物品頁、`#tab-equip`、所有 `.equipment-visual-slot`（主角／夥伴／公會紙娃娃）、物品資訊與比較窗。漸層直接畫成圖示 `<img>` 自身背景，不加 `::after`／包裝層／filter／動畫／`will-change`；範圍用 `:where()` 歸零特異度，顏色由後列 `img:is(...)` 覆寫同元素 `--inventory-glow`。新入口沿用此選擇器，不另做光暈元件。
- 呼吸光疊在固定光暈上，仍只在武器／防具／道具頁、最多8個可見物品、6秒一輪、只動畫獨立圖層 opacity；不是「指向／選取才亮」，也不恢復無條件常駐的 filter／文字閃爍、遺物星芒或套裝掃光。不可裝備／廢品的固定光暈隨圖示原生灰階／透明變暗；商店、潘朵拉、收集冊、倉庫與公會候選清單未加。
- `js/10-ui-tabs.js` 的 `syncInventoryGlow` 接在原生切頁／重繪及捲動位置還原後；用單一 `IntersectionObserver` 處理畫面與內層捲動裁切。切頁、文件隱藏、視窗失焦或減少動態效果時移除動畫並斷開觀察，返回再接目前清單；不加逐幀JS、輪詢計時器或永久 `will-change`，不改 vendor。
- 保留原色、完整詞綴／名稱、傳說標籤、強化／數量／鎖定標記、套裝生效邊框、未知剪影與無法裝備的灰階／透明度；一般圖示的 `filter:none` 不加 `!important`，避免蓋過 inline 功能濾鏡。舊條文的傳說／遺物亮點以本節為準；怪物恩賜／狂暴、戰鬥 VFX、角色動作與 Buff 到期提示保留。
- `item-breathing` 驗三頁／可見上限／捲出／重繪／焦點與可見性事件／減少動態效果／窄欄／存讀；`item-effects` 驗背包、原生掉落、資訊、強化耗卷、裝備、收集冊、倉庫及存讀；`feedback-1023` 驗固定光暈範圍／顏色／無動畫。套裝／星芒的 pseudo-element probes 與原生流程分列，不把探針當完整介面驗收。
- Ego多頁可能仍回報p1可見；合成 `document.hidden`／`window blur` 事件只驗啟停邏輯，不能宣稱已實測OS最小化或真實背景分頁。先等縮放／重排及可見集合穩定，再核對動畫；舊觀察與新清單不能混算。
- 量測固定背包／可見範圍／UI縮放，區分登錄動畫與主執行緒指標；短時間 CDP `TaskDuration` 不含完整 GPU／合成器／整機耗電，不能換算遊戲、補跑或省電百分比，也不能因雜訊宣稱動畫比靜態更省。關頁後只要求物品動畫歸零，不把遊戲其他工作算成物品特效。

### 資訊窗點空白關閉（2026-10-23）

- 只對物品資訊＋能力比較、夥伴資訊（傭兵／寵物／召喚物／護衛）生效；強化、同款批次、一鍵弱化、確認框與公會強化保留返回／X，不因外點丟設定。倉庫、公會、強化窗未納入。
- 外點關閉用 document **capture** `pointerdown` 記錄是否在窗外按下，capture `click` 確認放開也在窗外才關；窗內拖到窗外不關。capture 先於開窗者，點另一件物品／夥伴直接切換。`feedback-1023` 掃描 `elementFromPoint` 取無行為元素當空白點並記錄，用真實 `page.mouse.click`，不以 `closeModal()` 冒充。
- 物品窗以 `#item-modal[data-item-info]` 區分資訊頁：`openModal` 設定，`renderEnhanceOptions`／`renderSameBatchEnhance` 及整合層包裝的 `AFK_CURSEBATCH.open` 移除；新增會改寫 `#item-modal` 的畫面須同步移除。
- 排除 `#afk-confirm-modal`、`#afk-alert-modal`：afk-ui 把 `window.alert` 接管成全螢幕疊層，核心有數十處 `alert()`，不排除會在按「確定」時連帶關窗。新增疊層先查 `rg -n "document.body.appendChild" js/vendor/afk/afk-ui.js`。
- 夥伴資訊外點用 `close(false)`，不還原焦點以免搶走剛點的輸入框；X／Escape 照舊還原。窄版夥伴資訊為內嵌區塊，外點同樣關閉，未實機驗證。

### 同款批次強化與傭兵公會物品窗（2026-10-22）

- 主角強化頁「一鍵強化到指定值」下方進入同款批次；飾品另有一般物品頁直達入口，不能經過會立即耗卷的 `showEnhanceOptions`。入口、返回與取消均驗不耗卷／不擲骰；不能只用 `renderEnhanceOptions` fixture 跳過真正入口。
- 同款沿用 `sameItemSig`、只忽略強化值與 UID；排除鎖定、已裝備、不可強化與達上限者。群組文字用原生完整裝備名（含強化／詞綴）×可用數量，長名稱換行；數量預設全組、切組重設。普通／祝福卷與兩種模式用互斥選項；飾品無祝福卷，不加入詛咒批次。
- 「每件各用一張」固定本輪原件、各嘗試一次；「衝到指定值」逐件至達標／爆裝／缺卷，目標高於原值且不超過原生上限。重用 `_quickEnhanceUnit`／祝福跳級，不追衝新堆疊；存活件保留未知欄位，願望等獨立資料不誤併。
- 同窗採選批設定→精簡確認→本輪結果；確認頁集中裝備／數量／卷軸庫存／風險，缺卷不承諾完成件數，零卷禁確認。確認時重驗資格及庫存，變更須再次確認；取消、預覽連點／Enter 不得執行強化。
- 結果按強化值、爆裝、無變化、未處理與耗卷分列，與含原庫存的「背包可選批次」分區；只留最近一輪，完整摘要寫日誌。每輪清選取、保留卷軸／模式，不自動連衝；全爆仍留結果，存檔失敗不重跑擲骰。
- 重繪保留群組／radio／欄位焦點，預覽聚焦摘要、完成聚焦結果，勿自動聚焦執行鈕。返回恢復編輯捲動，再以 `nearest` 最小捲動讓焦點完整可見；驗短畫面風險及確認鈕同時可見，不只測外框無溢出。
- 公會單擊只選取／比較，不自動開資訊窗；目前／候選摘要右側只有一個「強化」按鈕，優先操作選定候選，否則操作目前選取部位裝備，title／aria 標明目標。按下才進原強化頁，返回關閉強化窗回公會；原分類、比較、雙擊／Enter 穿戴卸下保留。切角色／頁面／分類／搜尋／關閉清理脈絡；公會浮窗用 `data-guild-item-modal` 限定圖層。
- 公會強化窗標示裝備所有人：候選是隊長背包；已裝備是該隊員來源存檔。強化均扣隊長卷軸，單次／祝福／一鍵／詛咒沿用原生規則及藍／金／暗紅，操作後更新來源與 live 隊員，不改隊長裝備或扣隊員背包卷軸。來源／隊長寫入失敗要還原，保留未知欄位與原安全區／來源角色驗證；浮窗須蓋公會並實測命中。候選拆分／合併後追蹤原生結果 UID，不能回指原堆疊；驗三件 +0 連按兩次只產生一件 +2、另兩件仍 +0。

### 離線結算與返回日誌（2026-10-22）

- 地名解析先查 `HIDDEN_AREA_NAMES`，再查一般地圖；結算結果重新解析來源地圖，涵蓋舊樣本／快照的英文代碼，摘要與歷史共用中文結果。
- 普通地圖離線頭目戰讀 `set-teleport` 與 `AFK_BOSSAVOID.picked(map)`：空清單全部迴避，指定清單只略過對象；原 ID 解析到最終變身名稱。保留完整遭遇池及原本其他頭目機率，純頭目房維持線上不迴避例外，不修改 vendor。
- 使用者已選擇只將離線取樣回復 **v3.9.18**（`eda3c8f79`），保留大廳／5% 加成、雙效率摘要與死亡提示。`js/27-offline-rewards.js` 相對該 commit 只保留三處摘要／死亡文案差異；不回退整站、不重寫歷史。保留該版 15 秒／3 隻、最近擊殺檢查、最多 5 張地圖及原倍速／補跑閘門。
- 取樣以目前實戰視窗累計，重新合格後取代舊視窗；不再使用 `profile.condition`、`_offlineConditionsMatch` 或五分鐘加權合併，換裝／換隊伍／改設定不立即清樣本，估算沿用舊版特性。不得依歷史規則恢復已撤回的機制。未來改取樣，先驗原生召喚到期／重召及完整關頁存讀；不能只測升級或靜態能力快照，不能靠降低門檻掩蓋樣本失效。
- 離線 ≥10 分鐘時顯示「整段離線平均」；若死亡且實際狩獵時間 >0，再顯示「死亡前狩獵效率」與存活時間，兩者用同一份實得經驗／金幣，只換分母；0 時間不除、仍採 12 小時可結算上限。離線與批次補跑死亡均寫「不列入死亡經驗買回」，不新增扣經驗或買回紀錄。
- 加掛選項共 19 個、預設全關。`keepview`「返回時保留日誌分頁」啟用後才停止返回時自動切 `sys`；涵蓋 focus／visibility／BFCache。新建／載入及真正離線摘要仍走原系統日誌流程；沿用既有草稿、取消、保存與重載，不另存偏好鍵。

### 補跑進度與加速器（2026-10-22）

- `js/03-combat-core.js` 的剩餘量是 `_tickDebt` 模擬毫秒，不是實際等待 ETA；畫面寫「尚待處理的遊戲時間」，說明本機運算、電腦負載、背景節流及高倍速累積。百分比依已跑／待跑 tick；不加假進度、固定倒數或未量測 ETA，短同步工作不強制顯示進度。
- 64 倍速每 10 秒產生 640 秒遊戲進度；若尚未處理，切回 1 倍仍須跑完 6,400 tick；改顯示不得丟棄債務、改收益或離線取樣。效能先分清模擬時間／牆鐘／排程等待，短測記錄原生完成時間，不能把 `waitForFunction` 輪詢延遲算成運算成本。村莊合成短測／CPU 限速只證明負載影響，不代表實戰 ETA 或已重現玩家五小時卡住；未重現須明說。

- 補跑最佳化保留逐 tick、原 RNG 順序、64 倍速、80ms／8ms 排程、掉落／消耗／離線及存檔格式。`_dpsSnap` 沒有敵人時可不配置；有敵人時仍保留原物件身分，不能只比 UID／目前槽位，須驗換怪、重排、移除、溢殺與新生怪不誤記。
- 隊友本體無可行動時只省 DPS／暫態光環準備，仍處理異常、冷卻、回血回魔與召喚。判斷須涵蓋治癒、轉換、立方、持續傷害、副手及非有限冷卻值；不能以「普攻未到」跳過整個回合。無實際傷害可略過仇恨倍率／重複掃描，不清除既有仇恨或改選敵公式。
- `teamIlluAura` 每次查詢一輪掃齊來源，不跨 tick 快取；保留受益者自己排除、倒地、同技能不重複加成與 Buff 到期／加入的即時效果，玩家、傭兵、寵物、召喚物、護衛及 readonly 預覽均須一致。
- 效能改善以同情境暖機、交錯配對多次的原生補跑吞吐中位數為準，包含收益整理／儲存／重繪；純迴圈、跨輪60秒profile與單次最快成績分列。速度提升46.1%約等於耗時少31.5%，不能寫成耗時少46.1%或已達50%；多種函式的inclusive成本不可直接相加。無穩定收益的改寫撤回，不為達門檻改玩法或增加阻塞。

### 傭兵設定與夥伴能力（2026-10-23）

- 主角勾選既有 `set-poly`，自動續用在 `useItem(...,true)` 保留相容武器的 `player.poly`，不要求變戒；優先耗背包卷軸，缺貨沿用 `autoActions` 的 `shopPrice` 購買，缺金幣不免費續用。手動無戒重抽、有戒選擇及換武器改相容形態不變，不加偏好鍵／計時器。`player-poly` 以原生物品入口、勾選、`tick()` 到期及存讀驗證，不只直接呼叫 helper。
- 主角與傭兵「立方：和諧」均在增益勾選列，傭兵轉換下拉只列 `type:convert`。舊 `_convertSkill` 遷移到 `_autoBuff` 後清掉舊選項；明確 true／false 優先，未選者不自動啟用。沿用傭兵偏好保存／刷新，HP 消耗週期、自訂停止門檻、至少 25% 安全線及村莊停用不變。
- 每位傭兵獨立勾「使用變形卷軸」：無控制資格時開啟立即依自身等級／武器隨機付費變身；持續勾選到期續用原形態，取消立即清 `poly`／倒數，再勾重新抽（可能同形態）。沿用 `_mercPolyAuto`／`allyMaintainPoly`／`MERC_PREF_FIELDS`，費用扣隊長金幣，金幣不足不免費變身；保存／重建與明確 false 不被來源舊效果覆蓋。
- 控制資格依傭兵自己的 `hasPolyRing()`：裝備／背包中的變戒或已裝備浣熊葉，不共用隊長戒指。有資格時勾選先開原版清單，另有「選擇變身」按鈕供改選；沿用 `renderPolySelect` 的等級／武器／特殊形態與說明，選定才依原價購買，取消不扣款。非同步回呼重新核對 owner、傭兵實體、戒指、等級、武器與金幣，不能依賴已還原的 `_withAllyEquipmentContext`。原生換武器會重抽不相容形態，存讀 fixture 須用同一份原生來源裝備，不把該行為誤判存檔遺失。
- 法師傭兵召喚術／造屍術最多勾一種，可全關；勾另一種清掉原偏好，保留其他技能。舊雙勾保留現行有效造屍召喚，否則保留召喚術；明確 false 優先，保存／重建／實際維持施法都須一致，不強制刪除現有召喚。
- 召喚物、傭兵召喚、死靈骷髏、城堡護衛沿用寵物精簡能力清單，只列實際支援的骰值、加值、命中、間隔、倍率、防禦與技能；不用主角六屬性、爆擊或「—」填滿。V2／舊式傭兵／屬性精靈依各自原生攻擊路徑顯示，間隔 ticks ÷10；不套寵物魅力／裝備公式，保留唯讀裝備、增益／異常及來源 tooltip，預覽只算副本。
- 夥伴能力總值與括號加成同列靠右；`party-inspector` 重用節點須核對 `tagName`，不能把傭兵 artwork 的 span／strong 搬入寵物／護衛 dd 清單。驗「先看傭兵→再切每種夥伴」與效果刷新，量可見文字右緣；只測首次開窗或 dd 外框會漏掉置中問題。

### 同怪掉落與分類列（2026-10-19）

- 同次擊殺的非 silent 掉落先依原生 `sameItemSig` 彙整副本，再以「完整物品名 ×數量、…」寫一則系統日誌；名稱仍走 `getItemFullName`，傳入 `cnt:1` 避免括號數量與 ×數量重複。保留原生詞綴色、傳說／遺物亮點及未讀點；分次擊殺不合併、空掉落不寫，異常先清上下文再輸出已發放物品，不改 RNG／實得量或商店製作等獨立訊息。
- 切分類用 `renderTabs()` 的分頁簽章更新，保留 `.backpack-category-nav` 原節點連續相連，不移入物品格或重建；同步更新 `aria-pressed`／disabled，保留搜尋、批次鎖定與橫向位置。手動點分類立即解除 wheel-idle 延後，不能把清單捲動保護變成點擊後 180ms 才換內容。

### 冒險者大廳（2026-10-21）

- 黑市旁獨立「冒險者大廳」按鈕，同頁開啟／再按返回，維護 `aria-pressed`；左上角以「經驗 +5%／經驗加成未啟用」取代原「肝膽相照」可見標題，底部只留本機隊伍所在地；不恢復地圖分類／子選單入口。黑市／瞬移／回城與兩個真實地圖選單保留；場景仍為 `min(800px,100%)`／16:9，無永久資訊面板或上下捲軸。
- `#social-lobby` 用 `isolation:isolate` 限制角色、營火、輪播及控制列的內部圖層；物品資訊／比較窗須蓋住整個大廳。不要全面提高浮窗 z-index 或改姿勢比例；同時驗實際重疊、命中與預覽。
- 大廳是社交視圖：保留 `mapState.current`、狩獵設定及兩個選單的真實地圖值；底部提示自己的冒險團所在地，不因此公開位置。戰鬥繼續，隱藏場景停止特效；只有實際換圖／換角色才退出，不因選單同步或被暈眩擋住的回城取消。
- 點角色才開場景內的非 modal `<dialog>` 名片；編輯／預覽／收藏／留言在同一彈窗，不另佔場景。Escape／外點只關彈窗、保留大廳並恢復角色焦點；自訂地圖選單不被誤判為外點。編輯／預覽維持分頁，留言例外見下條，均驗窄欄。
- 大廳用 `/v1/players?view=recent` 顯示正式站近 24 小時旅人，不必發布名片。最後正式站回報 10 分鐘內標在線，其後離線但角色保留，滿 24 小時才移出；不刪名片／留言／收藏。心跳僅目前角色 `name/cls/avatar/pose` 與同意分享的地圖；職業／性別與姿勢由後端驗證。5 分鐘回報，創角／換角色／恢復連線立即回報。
- 旅人與公開名片分開：未發布名片也有基本資料與留言板，收藏仍限公開名片；不自動建立／發布名片。留言收件者為使用者，`0006_comments_users.sql` 保留原留言 ID／去重／流水號，刪卡不刪留言、刪帳號才級聯清除。換角色用目前外觀，不用舊名片快照覆蓋。
- 名片 `shareMap` 預設不公開，須在「展示」勾選目前地圖、預覽後發布。心跳送目前實際狩獵地名（隱藏區先查 `HIDDEN_AREA_NAMES`，一般圖用 `mapEntryOf().t`），不送整份角色；後端也核對公開與同意狀態，取消分享不回傳位置；30 分鐘內回報的共享位置標「最近回報地圖」與時間，不把它或攻略快照當即時地圖。
- 留言依時間向下排列、最新在底部，一次呈現多則；只有 `#lobby-comments` 可上下捲動，外層場景／dialog 不捲。載入較早留言接到上方並維持閱讀位置，保留刪除權限／重試去重／安全文字；不要恢復「上一則／下一則」的單則分頁。
- 站姿／待機使用原版 `assets/classanim`，依目前八職業男女選外觀；坐姿／跪坐／大字型趴地是以原版為參考的透明生成素材 `assets/ui/lobby-poses-v2/`。坐／跪來源、prompts、裁切與 SHA 留在 `output/design-source/imagegen/lobby-original-poses-20261021/`，16 張趴姿在 `lobby-prone-20261021/`（同層）；不再使用舊隨機姿勢 atlas，勿誤刪原生成來源。
- 玩家點自己名片可選站立／坐下／跪坐／大字型趴地，`player.lobbyPose` 隨角色儲存；不需發布名片，本機也能編輯。`actor.pose` 僅允許 `standing/seated/kneeling/prone`，缺值預設站立；沿用 `presence_actor` JSON，無新 migration。心跳共享姿勢，切換後立即回報，其他人下次更新看到，不加輪詢。
- 人物按訪客 ID 穩定取樣散布，保留座位、避開營火與控制列及碰撞，不圍圈、不耗遊戲 RNG。只載入可見角色動畫，關閉／背景／名片開啟時停止裝飾動畫；營火只換火焰格，石圈／木柴固定。
- 姿勢比例先比同角色的頭部輪廓、肩寬、軀幹與視角，再驗接地及裁切；不能用「坐姿總高接近站姿」當標準，否則會放大成大頭／寬身。現行站姿本體 82%；坐姿 tile 130%、left -15%、top -24%；跪坐 tile 90%、left 5%、top 9%。這些是有透明留白的圖片縮放，不是人物總高；微調單一姿勢，不連帶改其他姿勢／點擊區。趴姿為 128px tile、底線 115px、本體上限 112×80px、CSS 100%；裁切邊界用 alpha≥16 排除微透明雜點，保留原 alpha 與長寬比。像素量測只能輔助，仍須檢查實際營地預覽。
- 打招呼／點頭／歡呼各為獨立按鈕，窄畫面可換行，無動作下拉選單；沿用 `perform/doAction`、斷線 disabled、失敗重試 request ID 去重與未讀補播。動作結束恢復所選姿勢；營火文字純文字、字形由下往上燒毀，總下移 30 個螢幕像素、在火焰前方。
- 出發狩獵後進大廳，全隊（主角／傭兵／寵物）經驗 ×1.05，不要求公共 API 成功；村莊內不預領。組隊／娃娃乘算、倒地／滿等規則保留，金幣／掉落不加成。手動返回、回村或實際換圖（含換層）取消，重進才恢復；開名片／切瀏覽分頁不取消。
- 關頁不等於手動離開：大廳關頁快照的 `offlineHunt.lobbyExpMap` 僅對原圖該次合資格離線區間生效，舊檔缺值為無加成；載入先結算再沿用回村，不把加成帶到下次出征。取樣／頭目證明存未加成基準，結算只乘一次；主角、寵物、傭兵、統計與普通怪／純頭目房都須涵蓋。保留 70%／12 小時、存檔失敗與去重；切換加成前先等補跑完成，避免追溯加成。
- 無註冊登入，匿名身分綁定瀏覽器隨機 device key 與 bearer token，不用角色名認證。角色名／職業／性別是在線外觀，介紹／裝備／地圖等仍須勾選、預覽、確認發布；角色存檔留本機，不把自報能力用於排名／交易。清除網站資料或換裝置不會自動恢復身分。
- 公共 API 為 `https://idle-lineage-lobby.lostshinanalytics.workers.dev`；Cloudflare 帳號為 `lostshinanalytics`。依最新決策 `ALLOW_LOCAL_CLIENTS:false`：本機 HTTP／file 不自動認證、回報或參與正式大廳，顯示正式站連結、停用社交控制項。僅顯式設定 loopback 測試 API 的隔離 fixture 可連本機 workerd；正式站仍用 bearer，不開任意 Origin。
- 大廳無五秒輪詢；進入／手動刷新／返回前景且資料超過 10 分鐘才取列表。以伺服器時間＋`performance.now()`更新在線／24 小時到期，停止畫面時取消計時，保留未到期角色座位。`siteRecentCount` 為正式站 30 分鐘去重總數，與座位／分頁無關；顯示最多每 10 分鐘更新，斷線保留數字並註記，不能固定補成 18 或重啟 tracker。
- 前端新增 `actor.pose` 須先部署相容新舊 payload 的 Worker，再 push Pages；否則舊 Worker 會回 400。姿勢只用既有 JSON，勿重跑 migration。後端驗證用 `npm test --prefix backend/lobby`；真實前後端串接用 `python3 tests/run-social-lobby.py --space <id> --keep-space --skip-screenshots`，runner 建隔離本機 D1，不碰正式玩家資料。後端來源未變不因前端發布重複部署。

### 齒輪加速器黑市搜尋（2026-10-20）

- `js/gear-accelerator.js` 是本版整合層；指定資格沿用原生 `gachaWeight > 0`，不為寒冰長靴／耳環等擴張商品池，不混用收購單的資格規則。
- 輸入旁即時顯示提示與可點候選（最多 8 件）；完全同名優先，同名但不合資格不能退選較長名稱。部分相符多筆須選候選或補全，選取只填入、按刷新才換貨；**非空無效輸入不換貨，只有留空才隨機刷新**。
- 候選名稱用 `textContent`，保留鍵盤操作與 `aria-describedby`／錯誤狀態；中文組字中的 Enter 不刷新。成功指定沿用原生價格、商品格數、公告與存檔流程，保留收購單／未知欄位，儲存失敗也就地提示。

### 避免重複繞路的規則

- 改名先核對 GitHub Description、README 首行、HTML title／登入 h1、PWA name／short_name／description 與**實際 manifest 連結**，不只搜尋顯示字串。較長標題須驗 1330／1920px 的邊界與副標題間距。
- 本版 PWA 使用 `comfort.webmanifest`；`addon-integration.js` 在原加掛注入後改指向它，不改鏡像 `manifest.webmanifest`／vendor。E2E 同時驗 HTTP 的 DOM 連結與 manifest 名稱，不能只讀未被使用的 JSON；file 協定保持不注入 manifest，避免 CORS。
- 改錯區塊／需回退時，先比對指定輪次快照及 SHA，只撤回誤改；髒工作樹不能直接還原 HEAD，也不能憑記憶重建已選版型。
- 按鈕「不滿版」先分辨外框幾何與實際填色；檢查 computed style、偽元素 inset、border-image 的 fill 與選擇器優先序。加掛可能在核心返回後才插入按鈕，須核對載入／DOMContentLoaded 掛鉤順序；文案放本版整合層，不改 vendor 或加整頁 observer。
- Buff 說明閃爍須測「游標移入提示閱讀＋另一個效果加入／到期」，逐幀驗可見性；只確認 DOM 身分不變不算重現。狀態種類變動時保留未變的圖示節點，仍驗離開、到期與換角色能正確隱藏。
- 透明框要檢查 alpha、原圖黑底與實際合成畫面；PNG／WebP 保留透明度，不能靠裁切或加固定高度遮住突出背景。外框與文字底色分開處理。

## 開發與驗證

- 預覽：`python3 -m http.server 8000 --bind 127.0.0.1`；E2E 選項：`python3 tests/run-rwd.py --help`。人類入門看 `README.md`，本檔只留代理規則。`.ignore` 讓 `rg` 略過 `assets/anim`、`classanim`、`morphanim` 的 20 萬張逐格圖、單行巨大的自動產生檔 `js/anim-manifest.js`／`anim-manifest.json` 與 `tests/artifacts/archive/`；要搜那裡時用 `rg --no-ignore`。
- E2E 使用 Python 3、`ego-browser` CLI 與 Ego；runner 自行啟動 HTTP 伺服器。操作前讀 `ego-browser` 技能，只用記載的 API，不猜 Playwright 方法。
- 每個任務只建一個 TaskSpace，所有 runner **逐批共用同一 space／p1**、不並行，失敗在原空間恢復。首輪可用 `--suite rwd --protocol http --desktop-only --keep-space` 取得 `spaceId`，後續帶 `--space`；多 suite／`--protocol both` 依序執行、自動 keep-space、遇錯即停，未帶 `--space` 會直接報錯。TaskSpace id 會被重新編號，跨 session 不以舊 id 判斷可否操作。
- 測試報告預設寫入 `tmp/test-runs/`（不進 git）；要更新受追蹤的 `tests/artifacts/` 才加 `--record`（runner 與 `*.integration.js` 相同）；runner 可用 `--artifacts <目錄>` 指定其他輸出位置，與 `--record` 互斥。
- 成功後只呼叫一次 `finish({keep:[]})` 並等待完成；耗時時用背景程序讀回結果，不用短 timeout 中止再反覆重送。有 `finished <id>` 與成功結束碼後，不再操作該空間；輸出遺失時用 `listTaskSpaces()` 唯讀確認，不重送 finish。
- 必跑 `rwd`、`ui-scale`、`gameplay`、`account-gameplay`、`companion-commands` 的 HTTP／file：`--space <id> --suite required --protocol both --desktop-only`。
- 專項見 `tests/run-rwd.py`：批次用 `same-batch-enhance`／`same-batch-ux`，夥伴對齊／法師互斥用 `feedback-1022`，公會強化／變身用 `guild-poly`，補跑文案／時間債務用 `catchup-progress`，運算等價對照用 `catchup-equivalence`，物品效果用 `item-effects`／`item-breathing`，固定光暈／點空白關閉用 `feedback-1023`，主角變身續用用 `player-poly`；背包用 `backpack-a`／`main-backpack`／`backpack-feedback`，強化搜尋用 `ken-market`／`gear-accelerator`，大廳用 `social-lobby`／`lobby-*`，離線／和諧／夥伴能力用 `feedback-reliability`；同樣帶 `--desktop-only`，只選相關專項加必要核心。
- 創角／載入會自動連線大廳；合成回歸及預覽每次導覽前均用同一 p1 的 `Page.addScriptToEvaluateOnNewDocument` 注入隔離儲存並隔離預設公共 API；創角前核對掛鉤，不能依賴前一 suite 已移除的 fixture，保留明確指定的合成 API／本機 workerd 連線。不可讓核心測試大量建立公共訪客，也不可改正式碼來停用測試中的功能；報告標明隔離方式。在線名冊可含自己，點指定訪客用其 ID，不假設第一筆就是別人。
- TaskSpace 消失不能自行重建；使用者暫緩重建時，先完成本地工作並記錄待跑的瀏覽器檢查，後續不得把 Node VM／幾何替身說成瀏覽器 E2E 通過。
- 所有 `visual-*` 必須緊接同一 space 的對應行為 fixture，例如 `account-gameplay visual-account-gameplay`；中間不可插入其他 suite，各 fixture 的全域儲存不可互換。runner 會拒絕順序錯誤的組合。
- 狀態節點／控制項測試依 `data-*`／欄位語意定位，不假設職業為名稱的 `nextElementSibling`。創角 fixture 須明填合成 ID；舊未命名存檔另建 fixture，不繞過必填限制。需求已變就改舊斷言，不恢復已移除功能；找長單行斷言用 `rg --no-ignore -o '.{60}舊字串.{60}' tests`，不用 `grep -n | cut`。同簽章不含uid，換位不重建、強化可能換uid；存讀可能依完整簽章合併堆疊，須比欄位與簽章總件數，不要求原陣列／逐件uid不變。
- 每個 suite 明確設定起始視窗；baseline 中原程式不會復原的狀態（如未關的窗）由下一步驟先重設，讓全部檢查都有結果。靜態 fixture 停計時器也設 `state.running=false`；離線讀檔須先等原生非同步結算回呼完成才停止 running，否則會誤擋結算；`loadGame()` 回村後若再次存狩獵設定，先重進目標圖並確認快照 eligible。
- 縮放／切尺寸後等版面穩定；原生滾輪每輪先以目前目標 rect 的中心執行 `page.mouse.move()`，再 `wheel()`；不能假設 `hover()` 已把游標留在捲動區。scrollTop／scrollLeft 連續畫格穩定後再比對，避免把慣性誤判為兩側連動。
- 原生命中須選目前可視控制項，不能固定取已捲出視窗的第一格；比例／不重疊仍檢查全體。橫向分類的邊界量 nav／箭頭及文字自身溢出，不把正常捲出可視範圍的按鈕當版面越界。
- 原生點擊若被 sticky 欄／分類箭頭擋住，先看命中元素；橫向分類用可見左右箭頭移動、等 `scrollLeft` 連續畫格穩定，再核對 `elementFromPoint` 點擊。不要用全頁 `scrollIntoView` 或直接塞 scrollLeft 抵抗觸控慣性／位置還原；不強制穿透。
- 主角裝備單擊有230ms延遲，先等真正開窗，再等 `modalguard` 的 `Date.now()` 450ms保護達標；凍結時鐘 fixture 須推進合成時間，等牆鐘無效。先確認該入口是否應開窗；公會單擊比較不開窗，不等待或關閉不存在的資訊窗。
- 懸浮測試先等 resize／scroll 與版面穩定；選不被其他 sprite 遮住、離透明邊緣足夠遠的像素，避免取點到送入滑鼠事件間角色已移動。可短暫固定合成場景的原生畫格，完成後還原；不冒充完整戰鬥驗證。
- 不直接改寵物記憶體陣列充當已儲存名冊；用原生 dirty／save 流程，避免下一次查詢把測試寵物清掉。
- `page.evaluate` 單次有 15 秒限制；原生 rAF 被節流時，將同一組逐格斷言拆成短批次，保留原總格數，先核對可見性／實際畫格進度，不改正式碼、不刪斷言或反覆原樣重跑。
- 擷取圖片不可用／`Page.captureScreenshot` 逾時時，從失敗 suite 接續 `--skip-screenshots`，不重跑已通過的；用 Ego screen-media PDF 轉 PNG（`printToPDF` 前設 `setEmulatedMedia` 的 `media:'screen'`）。PDF 放 `tmp/pdfs/`、檔名加任務前綴、驗收後刪除；pypdfium2 `render(scale=1)` 是 72dpi，CSS 像素要 `scale=96/72`。標示協定、轉圖工具與實際 dpi，不宣稱直接截圖。
- 實際檢查桌機 1330／1920px、60／75／80／100% 與 220／300／460px 側欄；倒地傭兵及寵物的所有控制項、標籤文字均須在邊界內，不能只量卡片高度。
- 倉庫另跑 `warehouse-list` 與 `village-clan-warehouse`（HTTP／file）。驗證預設尺寸要清除測試調整並以 100% 量測；預設圖與已拖曳縮放圖分開命名。命中區留在外框內，實測縮放時 border 取整，不能假設 CSS 宣告值等於實際邊界。
- 本地檢查一律跑 `python3 scripts/check-local.py`：JS 語法、`git diff --check`、`?v=` 資源 SHA、69 個鏡像檔 SHA 與全部 `tests/*.integration.js`。integration 只驗原生流程／幾何邊界，不等於瀏覽器 E2E；原生新增全域依賴時更新合成 fixture，不為缺少的測試替身增加正式環境 fallback。
- 保留可重跑的 JSON 報告、來源雜湊及代表性預覽；完整驗證須對應實際程式 commit 與報告。交接要區分「本輪實跑」與「核對前人報告」；事後擷取的來源 SHA 不得冒充 runner 當時記錄的 SHA。
- 報告檔名含自己的 suite／協定，複製測試時同步改名，避免覆寫其他套件；依 runner 實際輸出引用，引用前核對存在、方法、版本與結果，不用歷史報告／早期預覽充作後續驗證。HTTP／file 共用圖檔會被覆寫，須標明最終圖的協定與方法，不能當兩次獨立擷取。
- 桌面橋接替身與 file 協定不等於安裝版實測；本機 iCloud 複製／雜湊相符不等於遠端同步完成。
- 測試保持精簡：先選可重現需求的最小專項，完成後只跑必要核心；通過即停，不因增加信心而追加套件、長測或重複預覽。接手先核對來源 SHA 與報告；未變就沿用，失敗僅接續受影響套件，測試前置錯誤先修 fixture。僅改本檔不重跑遊戲 E2E；使用者縮短時長就依其指示收尾。
- 背景 E2E 執行中不改程式；要改就先停 runner，改完 `update-cache.py` 後重跑，避免同一份報告混到兩版程式。使用者要求「做完再測」時，所有修改完成後只跑一次。等待長 runner 用背景程序與完成通知，不輪詢；期間只在 `tmp/` 準備素材或腳本。
- 自寫量測腳本與報告放 `tmp/test-runs/<任務>/`，需要伺服器時自起 `python3 -m http.server <port> --bind 127.0.0.1`，結束後關閉；先定門檻與改善前基準，改善後以同腳本、同情境放 `after/` 比較。
- 合成物品帶原生預設值（`bless/anc/attr/seteff/lock/junk:false` 等），避免讀檔補欄位被誤判資料變更；`?.` 擋不住 `false`，先判真值再呼叫方法。控制 RNG 時隔離 UID 產生，避免 uid() 吃掉擲骰序列或固定亂數製造重複 UID；不為假資料改正式公式。等價對照的 setup 完成即停止遊戲計時器，在執行同步 tick 的同一次 evaluate 重設 RNG；不能在兩次 evaluate 之間留 running=true，讓背景工作先消耗亂數。
- 找回未提交的舊版本：從 `~/.codex/sessions/<日期>/rollout-*.jsonl` 取出寫檔指令，在 `git worktree` 重放（瀏覽器／runner 指令改為 stub），再以該輪 `sources-under-test.json` 的 SHA256 逐檔驗證；不可手改內容湊雜湊。原程式回歸可用 detached worktree 複製測試與 runner 跑 `--baseline`；HEAD 不等於修正前工作樹時，另核對目標來源 SHA，清理只刪自己產生的檔案與 worktree。

## 存檔、隱私與提交

- 測試只用合成角色與隔離儲存；不得讀寫真實帳號或 iCloud 存檔。
- 保留既有鍵名、未知欄位及網頁／桌面格式隔離；測試寫入失敗與回復流程。帳號匯入先以本版原生匯出→按鈕選檔→預覽→確認→重載驗證；SIG1／SIG2、舊角色檔、完整備份、衝突選擇與寫入回復均沿用原格式，重現解析失敗才修解析器。
- `ADDON_ROLE_PREFS` 的四種角色偏好由鏡像用 `localStorage` 明文讀取，匯入不可走一般 `_lzSet`；用 `_lzSetStoredRaw` 寫入並核對原值，同時使舊壓縮 Worker 結果失效。一般角色／共用存檔仍走原壓縮流程，不移除匯入的逐筆驗證與整批回復。
- 過去匯入可能讓 `afk_bossavoid_*` 等偏好變成 `LZ1:`，再匯出時又攜入壓縮內容；匯出讀解壓值、匯入正規化已知偏好，啟動遷移修回明文。只處理列明前綴，不改 vendor、未知欄位或帳號格式；「儲存失敗：key」先核對編碼與讀回內容，不直接歸因容量不足。
- 此路徑至少驗連續兩次原生匯出→匯入、同步壓縮開／關、舊壓縮偏好與寫入失敗回復。Ego 檔案選擇器須先 arm；若反覆被取消，先查實際 input，只在合成 fixture 保留原生動態 input 後用 `setInputFiles`，保留原 onChange／預覽／確認流程，不改正式環境選檔行為或直接呼叫 apply 冒充 E2E。
- 測試未知欄位時，在匯出快照建立前注入同一份來源資料；不要稍後又還原較早快照，再誤判欄位被匯入流程刪除。
- 不提交玩家存檔、憑證、個資、`.DS_Store`、備份、快取或合成帳號匯出檔。發佈報告先移除本機／iCloud 的絕對路徑，改用專案相對路徑或中性標記。
- 圖像生成概念與合成角色預覽是驗收素材，不得用概念圖的文字／數字替換遊戲資料。
- 分批 commit 須處理全域依賴：定義、script 載入與呼叫端須在同一批可用；共用檔案按功能分段暫存，每批 `index.html` 快取版本須對應該批索引的資源內容，不能提前帶入下一批的 SHA。
- commit 以單一功能範圍命名，例如 `fix: preserve village buffs across ally refresh`；不只寫 `1`／`q`。
- push 前核對遠端／分支與差異，不 force push；未授權不推到 upstream 或改動別人的歷史。
- 補歷史發行版時，先核對指定 commit，再建附註標籤（`git cat-file -t` 為 tag，`git rev-parse <tag>^{}` 符合目標）並推送。以 `gh release create --verify-tag --notes-file` 發布，明確指定 Latest，舊版用 `--latest=false`；不為補標籤新增程式提交或重寫已發布 tag。
- PR／交付列出玩家可見變化、修改原因、modified files、實跑檢查與結果、預覽及未驗證平台。

## GitHub Pages 部署

- GitHub CLI 查詢／操作明確加 `--repo lostshin/idle-lineage-class`，API 用完整 repo 路徑；fork 預設可能指向 upstream。部署以 HEAD SHA 與 run ID 核對，CLI `workflowName` 與 API `name` 不保證相同。
- 已確認入口：<https://lostshin.github.io/idle-lineage-class/>；`origin` 為 `lostshin/idle-lineage-class`，Pages 從 `main:/` 發布（`build_type:legacy`，GitHub 產生建置工作），不需新增本機建置或 workflow。
- 使用者授權部署後，先 `git fetch origin`，核對分支、遠端、落後／超前與**全部待推送 commit**；確認本地驗證與工作樹後，以 `git push origin main` 發布。`tmp/` 素材／報告不可加入，不能誤推 `upstream`。功能／修正發布須同步 `FORK_VERSION`、README 與版本斷言，核對登入顯示與快取 SHA；原版 `GAME_VERSION` 維持獨立。純文件／名稱文案調整不升版，也不移動既有版本標籤。
- push 成功不代表已上線；追蹤這次 HEAD 的 `pages build and deployment`，等 build／deploy 成功。長操作用背景程序並定期回報，不因正常等待重新推送或重建。
- 發布後以公開 HTTPS 比對線上 `index.html`、本次改動的 JS／CSS／素材與本機已提交內容 SHA256；保存 commit、run URL、結果與時間。這是資源驗證，不等於線上瀏覽器 E2E，也不讀寫玩家儲存。

## 最新進度與驗證基準（2026-10-23）

- 本次 **v3.9.26**（原版 `v3.8.34` 不變）：指定物品介面加固定光暈（圖示背景漸層，零額外節點／動畫），資訊窗可外點關閉，主角無變戒自動續用原形態。發布commit／Pages／公開SHA見 `tmp/test-runs/session-release-3926/completion.json`；後端未改，不部署Worker／migration。
- v3.9.26功能證據在 `tmp/test-runs/feedback-1023/report.md`：HEAD worktree baseline 12/24 預期失敗；13 suites×HTTP／file 26 次全通過（`final/`，提示框修正前來源）；提示框修正先重現 2 項失敗再修，`feedback-1023` HTTP／file 24/24（`final2/`）；本地13/13，空間27／28已結束。本機 Ego 截圖逾時，自 `party-equipment` 起 `--skip-screenshots`；預覽為 file 協定 screen-media PDF→pypdfium2 96dpi。主角變身 baseline 13/14、修正與發布補驗見 `session-release-3926/completion.json`。光暈未做效能量測；Safari、實體手機、安裝版、真實存檔未驗。
- v3.9.25 物品頁少量呼吸光：證據 `item-breathing/completion.json`（18份、618項），發布 `session-release-3925/completion.json`；同一240件背包常駐288個動畫→開頁8個→離頁0個，短時主執行緒數據有雜訊，不當速度／耗電保證，OS背景與GPU耗電未驗。
- v3.9.24 補跑重複工作最佳化：證據 `catchup-optimize/completion.json`（22份、776項，與 `c633073b2` 的狀態／RNG 一致），發布 `session-release-3924/completion.json`；配對吞吐中位61,287→89,522 tick/s（速度+46.1%、耗時−31.5%），未重現玩家五小時個案，未改倍率／債務／結算。
- v3.9.23公會入口／連續強化／變戒選單與補跑時間說明已發布，見 `session-release-3923/completion.json`；前功能輪 `guild-controls` 916項（6份明列沿用）、48組版面，`catchup-progress` 622項。v3.9.22批次／能力對齊／法師召喚互斥見 `session-release/completion.json` 及 `same-batch-*`／`feedback-1022`／`guild-poly`；不跨輪加總成獨立案例。舊公會單擊自動開窗及傭兵取消自然到期已被新決策取代。
- v3.9.21保留v3.9.18離線取樣：`offline-team/completion.json`、`rollback-scope.json` 716/716，發布在 `offline-team-release/completion.json`。單純更新七人未重現失敗，原生召喚到期才揭露樣本差異；不改結算／刷新順序，不聲稱補回歷史收益。更早發布見 [docs/agent-progress.md](docs/agent-progress.md)；既有預覽為screen-media PDF→pypdfium2 96dpi，不是新版本直接截圖。
- 使用者已撤回統一v3.9.10，版號持續遞增；單一機制回復不降整體版號、不改既有commit／tag。歷史「先發布名片才在線／地圖子選單入口／隨機姿勢」已被取代。
