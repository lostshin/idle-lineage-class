# AGENTS.md — idle-lineage-class

## 工作原則

- 一律使用台灣繁體中文；程式識別字、指令與專有名詞保留英文。
- 開工先讀本檔、檢查 `git status`，保留其他人與前一輪的修改。
- 方向已確認就完成範圍內的工作；只有新資訊會改變目標或授權時才再詢問。
- 先用 `rg`、檔案讀取與既有測試查證；不要為本地可回答的問題上網。
- 修 bug 先寫可重現的 E2E，再修程式；禁止為了覆蓋率補表面測試。
- 每行修改須能對應需求，不順便重排、重寫或增加未要求的功能。
- 大段修改前：檔案若已追蹤且乾淨，以 git 為退路；否則先做同目錄 `.bak-時間戳` 備份。
- 同一方法失敗兩次，先查本檔與實際原因，再換方法；不可第三次原樣重試。
- 只有重複、可歸因且可用窄規則避免的問題才寫入本檔；保持 250 行內。
- 未經明確要求，不修改規則／其他文件、不新增代理派工、不自動 commit 或 push。

## 結構、載入順序與加掛來源

- 原生 JavaScript，共用全域狀態，沒有 `package.json`、建置流程或 formatter／linter。
- `index.html` 是 script 載入順序的真相；不得按檔名排序。
- `js/00-data.js`～`js/32-threat.js` 與具名模組處理資料、戰鬥、存檔及 UI。
- `css/` 為樣式；`assets/` 為原版美術／音效；`public/assets/` 為登入素材。
- `tests/` 為 Ego E2E；`tests/artifacts/` 為驗收報告／合成角色預覽；`docs/` 為既有說明。
- 沿用附近排版，展開區塊通常為四個空白；變數／函式用 camelCase，常數用 UPPER_SNAKE_CASE。
- 前端資源修改後，執行 `python3 scripts/update-cache.py` 更新對應 URL 的 SHA 快取版本。
- 原版天堂美術、配色與按鈕風格是既定方向；概念圖不是執行期素材或技能規則。
- 46 個鏡像加掛模組的來源是 <https://pp771007.github.io/idle-lineage-class/>（原 65 個，已移除開關面板與 18 個預設關閉模組）。
- 固定來源 commit：`5f00f4a86389aaa7309c24d7a7c1ab060c47b500`；逐檔 SHA 在 [來源清單](tests/addon-source.json)。
- 不直接修改鏡像加掛模組或 `sw.js`；整合差異放在專案模組，並核對來源 SHA。
- 外掛開關面板已移除；組合固定在 `js/addon-switches.js`（只有 `sellconfirm` 關閉），不讀取舊的 `afk_toggle_*` 偏好。

## 已確認的產品決策（2026-10-14）

### 版面與隊伍

- 內容緊湊、文字盡量單行，優先利用橫向空間；手機與窄欄仍須完整操作。
- 三欄寬度可拖曳／鍵盤調整並記憶；桌機左欄至少 220px、右欄至少 300px。
- 中欄保留原生戰鬥場景的可用寬度與 800×450 比例，不因側欄調整破壞冒險畫面。
- 三次選擇各自獨立：隊伍清單 **C「統一名牌」**、技能設定 **A「緊湊卡片」**、隊友裝備 **A「經典人形」**；不可互相套用。
- 名字不加底線；名牌名稱為 14px，職業與等級樣式一致；保留原 HP／MP／EXP 與寵物控制。
- 用原版 sprite 與透明範圍裁切資訊，不拉伸或修改原圖；資料由 `scripts/update-party-portraits.py` 更新。
- 隊伍區利用左欄剩餘高度；內容放得下時不出現內部捲軸，超出時才捲動。
- 道具頁「一鍵排列」與「快速廢品」並列；其他分頁沿用其操作。

### 隊友浮窗與技能條件

- 浮窗出現在隊伍選單右側附近，可拖動；四邊與四角皆可縮放並記住尺寸。
- 不透明度控制在設定頁；沿用 `lineage_party_window_v1`，不另造偏好格式。
- 總能力與 buff 加成同頁；數值如 `13（＋3）` 必須同一行。
- buff 圖示不直接顯示倒數；懸浮顯示秒數，接近到期閃爍並尊重 reduced-motion。
- 裝備分頁採原版人物與部位配置，保留 E／強化值／數量及原生懸浮資訊；不是清單或等寬方格陣列。
- 裝備資料與職業判定取被查看的隊友，不能誤用主角；浮窗唯讀，不可改隊友裝備。
- 裝備框高度由浮窗外框扣除標題、分頁與 padding 決定；不要用內容自身高度回推，否則會逐次縮成細條。
- 依浮窗可用寬高等比例縮放整張裝備畫布，不以橫向捲軸掩蓋破圖；欄位數仍為原生 19／9。
- A 技能卡片的選單／門檻對齊；checkbox 等寬，依最長已學技能名決定最小格寬，不截斷長名稱。
- 停止條件固定在轉換技能右邊；數值統一為 `HP≤30%`、`HP<63%`，不加「停技」「喝水」尾字。
- 保留「喝水條件」標題、門檻說明與原生 handler；不新增概念圖裡不存在的 MP 門檻或技能。
- `_hpSkillPct` 不只影響轉換：也影響龍騎士耗 HP 技、耗 HP 增益與立方和諧。
- HP 低於或等於門檻就停止；0 關閉自訂門檻，但後三類保留至少 25% 的安全限制；普通治癒不受此門檻阻擋。

### 裝備美術、負重與狀態圖示

- 最新背景 **高：寬＝4：3**（寬 1086×高 1448），完整顯示四邊；用 `contain`，不得用 `cover` 裁切或把舊長圖拉寬。
- 概念美術要落成實際素材；需要紋理背景時用 imagegen 產素材，再疊原生互動層，不能只用 CSS 格子冒充所選版型。
- 執行期背景為 `assets/ui/party-equipment-backdrop-v2-4x3.png`；銀框為 `party-equipment-socket-v1.png`。
- 人物用原版創角立繪，取被查看隊友的職業／性別；圖示、人物與背景各自保留比例，不修改原圖。
- 裝備位置沿用 `equipmentView.pages`；槽位寬為畫布 12%、保持正方形，放大須同時檢查兩頁邊界與相鄰槽是否重疊。
- 每個槽要有對應預設底圖：一般部位取原版職業裝備模板，魔眼／遺骸取灰階原圖；實裝圖示與 badge 疊在上方。
- 負重由隊友 live `d.weightCurrent`／`weightLimit`／`weightPct`／`loadTier` 顯示；不套主角數值或替無負重系統的夥伴捏造百分比。
- 協力傭兵現行負重：82～99% 一般攻擊間隔×2，100%↑×3；施法與自然恢復未使用主角負重閘。說明須依實際路徑，不順便更改戰鬥規則。
- 召喚術／造屍術／兩種屬性精靈用原版 `assets/icons/skills/*.png`；其他效果維持 `assets/state-icons/*.jpg`，地圖與浮窗共用 `statusIconUrl`。
- 名牌採縱向 flex 後，直接子血條須 `flex:none`；只看外框高度不夠，須核對紅色 fill 的實際高度與 live HP。

### DPS 與施法日誌

- DPS 快照須保留原怪物物件，不能把槽位消失／瞬移／換怪當作 HP 歸零；已造成的傷害、真正溢殺與變身仍按原怪物掉血量計算。
- `_dpsSnap` 保留數值陣列供鏡像訓練模組使用，另附原物件 `targets`；修改須一起檢查 `threatCommitDiff` 的身分比對，避免新怪繼承假傷害／仇恨。
- DPS 名稱、計量條與數值須共用整張圖的欄寬（`audit-dps-chart`／subgrid），不能逐列獨立計算；每條底條起點與可用長度一致。
- 名稱單行、有完整 title；窄欄不得讓名稱、條與數值互相蓋住。驗證桌機／窄螢幕及 75%／100% 縮放。
- 「施法」是 `combat-filter-pills` 中與玩家／傭兵並列的 **小 tab**，不是上層「戰鬥日誌／系統日誌」分頁。
- 玩家與傭兵的施法動作都用 `data-src="cast"`；施法者身分保留在文字與 `data-cast-source`，不得讓玩家／傭兵開關連帶控制施法開關。
- 沿用 `lineage_idle_combat_filter` 記憶 `cast`，舊偏好原值保留。只在真正施放成功時記一次；MP 不足、無合法目標與增益尚未到期不算施法，補跑不洗版。

### 戰鬥、經驗與村莊增益

- 寵物與召喚物沿用原版選敵／攻擊邏輯；不要恢復指定目標、保護主人或新的指揮功能。
- 寵物／召喚物只接受一般「加速術」；按受益者扣施法者 MP，不分享強力加速術或其他增益。
- 加速須影響真正攻擊間隔／移動速度，到期恢復；不改選敵與武器觸發頻率。
- 招募隊友保留來源 EXP，再投影未領取的帳本／outbox；按 UID 去重並核對角色身分。
- 擊殺即時更新隊友 EXP／等級；回村只結算受僱期間增量，不把整個經驗進度重算或重複領取。
- 來源寫入失敗時保留待領資料與顯示進度；重試、重載與領取後都不得重複計入。
- 村莊也顯示同一條原生 buff 圖示列；移到當前可見容器，不複製 ID，不放在會被重建的 NPC 子內容中。
- 主角與隊友在村內維持已勾選的普通增益：未到期不重放，到期按原資源成本補放。
- 未勾選、資源不足或施法受限時，到期效果／圖示正常消失；出村不重施仍有效的增益。
- 同角色回村刷新保留 live buff 與剩餘時間；不可拿來源存檔的舊倒數覆蓋，也不可復活已過期的增益。
- 刷新仍更新來源裝備／經驗，保留原角色身分檢查、召喚／立方／持續傷害的安全區限制。
- 村莊人物名字常駐，與戰鬥「狀態」徽章開關無關。

### 強化與金額記憶

- 單次、一鍵、詛咒卷與飾品強化後都保留視窗，更新結果、強化值與卷軸數量。
- 只重繪強化內容；不要重呼叫會立即執行飾品強化的入口，否則可能連續消耗卷軸。
- 堆疊拆分後追蹤實際被強化的 singleton UID，不能繼續操作原來那疊。
- 爆裝、缺卷軸、達上限時留結果並停用不可執行的按鈕；不改成功率、爆裝或消耗規則。
- 原加掛 `modalguard` 在 `openModal` 後 **450ms** 攔截點擊。點擊無效先查此保護，勿先改工具或取消保護。
- 測試在開窗時記錄時間，等滿 450ms 再原生點擊；交易後等可觀察狀態更新，不用任意長 sleep。
- 血盟金幣／鑽石捐獻與倉庫金額按角色記憶；沿用 `config.clanDonationAmounts`、`config.warehouseGoldAmount`。
- 驗證有效數值、重開／重載、不同角色隔離、寫入失敗與原交易回復；不覆蓋未知欄位。

## 開發與驗證

常用指令從根目錄執行：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
node --check js/companion-haste.js
python3 scripts/update-cache.py
python3 tests/run-rwd.py --help
```

- E2E 需要 Python 3、`ego-browser` CLI 與 Ego；runner 自行啟動 HTTP 測試伺服器。
- 使用瀏覽器前讀目前提供的 `ego-browser` 技能；只用已記載的 API，不猜 Playwright 方法。
- 一個任務只建一個 TaskSpace；所有 runner **逐批共用同一個 space 與 p1**，不並行啟動 Ego 測試程序。
- 首輪可用 `rwd --protocol http --keep-space`，讀輸出的 `spaceId`；之後每輪帶 `--space` 與 `--keep-space`。
- 不用新空間救失敗／消失的空間；依技能在原空間恢復。成功後只呼叫一次 `finish({keep:[]})` 並等待完成。
- 必跑 `rwd`、`ui-scale`、`gameplay`、`account-gameplay`、`companion-commands`，每個各跑 HTTP 與 file。
- 相關 E2E：`compact-layout`、`party-refinements`、`party-equipment`、`village-clan-warehouse`、`skill-cards`、`ally-skill-stop`、`town-buffs-enhance`、`summon-display`。
- TaskSpace 消失不能自行重建；使用者暫緩重建時，先完成本地工作並記錄待跑的瀏覽器檢查，後續不得把 Node VM／幾何替身說成瀏覽器 E2E 通過。
- `visual-account-gameplay` 必須緊接 `account-gameplay --keep-space`，同一 space；中間不可先跑會替換合成資料的其他 suite。
- 其他 `visual-*` 也要接對應的行為 fixture；fixtures 的全域儲存名稱不同，不可互換。
- 不直接改寵物記憶體陣列充當已儲存名冊；用原生 dirty／save 流程，避免下一次查詢把測試寵物清掉。
- 若瀏覽器圖片擷取不可用：行為 suite 用 `--skip-screenshots`；畫面用 Ego screen-media PDF，再本機轉 PNG。
- PDF 中間檔放 `tmp/pdfs/`，驗收後刪除；明確標示 PNG 的生成方式，不宣稱是直接瀏覽器截圖。
- 桌機／窄螢幕及 75%／100% 預覽均須實際檢查；手機技能區須捲到 sticky HP／MP 列下方再擷取。
- 驗證語法、`git diff --check`、資源 SHA 與 46 個鏡像檔；保留可重跑的 JSON 報告及代表性預覽。
- 最新本地檢查：`node tests/dps-teleport.integration.js`、`node tests/spell-category.integration.js`、`node tests/equipment-cast.integration.js`、`node tests/equipment-proportions.integration.js`。只驗證各自標明的原生流程／幾何邊界。
- 報告檔名先讀 runner 實際輸出，不猜新檔名；引用前核對檔案存在、方法、版本與結果。歷史報告及早期預覽不得充作後續美術／排版驗證。
- 桌面橋接替身與 file 協定不等於安裝版實測；本機 iCloud 複製／雜湊相符不等於遠端同步完成。
- 必要檢查通過就交付；沒有新修改或具體疑慮，不重跑整套或展開額外調查。

## 存檔、隱私與提交

- 測試只用合成角色與隔離儲存；不得讀寫真實帳號或 iCloud 存檔。
- 保留既有鍵名、未知欄位及網頁／桌面格式隔離；測試寫入失敗與回復流程。
- 不提交玩家存檔、憑證、個資、`.DS_Store`、備份、快取或合成帳號匯出檔。
- 發佈報告先移除本機／iCloud 的絕對路徑，改用專案相對路徑或中性標記。
- 圖像生成概念與合成角色預覽是驗收素材，不得用概念圖的文字／數字替換遊戲資料。
- 分批 commit 須處理全域依賴：定義、script 載入與呼叫端須在同一批可用；每批快取版本對應該批索引的實際內容。
- commit 以單一功能範圍命名，例如 `fix: preserve village buffs across ally refresh`；不只寫 `1`／`q`。
- push 前核對遠端／分支與差異，不 force push；未授權不推到 upstream 或改動別人的歷史。
- PR／交付列出玩家可見變化、修改原因、modified files、實跑檢查與結果、預覽及未驗證平台。

## 本次 Session 進度與證據

- 前一批：隊友 EXP、夥伴加速、三欄／名牌／技能卡片、村莊 buff／名稱、金額記憶與持續強化已提交到 `origin/main`；基準 `182f7e4f2`。
- [前一批完整 E2E](tests/artifacts/town-buffs-enhance-final-validation.json)：1,105／1,105 PASS，屬歷史版本；不代表本批也通過。
- 本批程式：召喚圖示、召喚／護衛血條、DPS 名稱與共同起點、瞬移假 DPS、原版人形裝備／4：3 背景／預設底圖／負重，以及獨立施法小 tab 已實作。
- [瞬移傷害驗證](tests/artifacts/dps-teleport-integration.json)：11／11 PASS；原版 100 萬 HP 頭目逃離誤計 100 萬傷害，修後為 0，真正傷害保留。
- [施法與放大槽位驗證](tests/artifacts/spell-tab-equipment-final-validation.json)：29／29 本地整合／幾何 PASS；與前項合計 40 項，不能加總重跑／歷史報告灌大數字。
- [DPS 共同起點](tests/artifacts/dps-bar-alignment-validation.json)：語法／快取／read-back 已過；六組螢幕／縮放的 E2E 斷言已更新，尚未執行。
- [背景與負重素材紀錄](tests/artifacts/equipment-cast-final-validation.json)／[最新 prompt](output/imagegen/teammate-equipment-20261014-v2/production-4x3-prompt.json)；舊 4：3 前版與格狀預覽不是最新成品。
- 最新狀態：使用者要求暫不重建消失的 Ego 空間；後期裝備、美術、施法小 tab、DPS 對齊尚待瀏覽器 HTTP／file E2E、畫面及安裝版實測。
- iCloud 素材只驗證本機複製與 SHA 相符，遠端同步未獨立核驗；不讀寫玩家存檔。
- [本批提交前檢查](tests/artifacts/session-20261014-publish-validation.json)：40／40 本地 PASS、108 份 JS 語法、105 資源 SHA、65 鏡像 SHA 與文件驗證通過；瀏覽器待驗狀態保留。
- 分批提交／推送以 `git log` 與 `origin/main` 為準；本節不以未執行的測試或預期 push 當完成證據。
