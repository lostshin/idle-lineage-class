/* ============================================================================
 * afk-relicaffix.js — 重複的遺物會帶詞綴（祝福／遠古系／屬性）
 *
 * 規則：這件遺物**以前拿過**（遺物收集冊已收錄）→ 之後每一件各自獨立擲三次：
 *   ・祝福   50% → 祝福的（不出詛咒的）
 *   ・遠古系 50% → 遠古／永恆／不朽／太初 各 25%
 *   ・屬性   50% → 4 元素 × 5 階＝20 種各 5%，**僅武器遺物**
 * 第一件永遠是白板（＝圖鑑收藏照舊，重複的才有驚喜）。
 *
 * 為什麼要核心補丁：js/08 gainItem 的詞綴分支寫死 `!isRelic(d)`，而那是全遊戲產生詞綴的
 *   唯一入口。從外面包 gainItem 攔不到——等它跑完，物品已依「白板簽章」併進既有那一疊、
 *   掉落訊息也印完了，事後改會改到整疊。故補一個 `window.__afkRelicAffix(d, id)` 鉤子
 *   （apply-core-patches 補丁 11，比照補丁 2 的 __afkTradRollEn）；沒載這支外掛＝原版。
 *
 * 🚨 「第二件」不能在鉤子裡問遺物收集冊 —— gainItem 是先 registerRelicObtained(id)（js/08:105）
 *   才走到詞綴段，鉤子裡 relicDexHas(id) 永遠已經是 true，第一件就會中。所以另外包一層
 *   gainItem，在呼叫原函式**之前**記下當時的收錄狀態。
 *
 * 🚨 屬性只能給武器遺物 —— js/13 loadGame 會把非武器身上的 attr 清掉（v3.0.77 改版的清理）。
 *   給防具/飾品上屬性＝當下看得到、重開就人間蒸發，而且不報錯。
 *
 * 🚨 先確認條件才擲骰 —— 掉落亂數是 committed RNG（lootRng 吃存檔內 player.lootSeq 遞增序號，
 *   防存讀檔重抽），多消耗一個序號會改變**之後所有掉落**。判斷順序必須是「先確認是重複的遺物，
 *   才呼叫 lootRng」，否則光是裝了這支，第一次撿遺物的玩家掉落序列就整個位移。
 *
 * 涵蓋範圍＝所有走 gainItem 的遺物取得（怪物專屬掉落、玩家 NPC 的獨立遺物判定、離線結算——
 *   afk-offline 是 1:1 重放核心 killMob，同一條路 → 線上離線不會分歧）。潘朵拉遺物布告欄用
 *   forceNormal=true 呼叫（且本來就排除已持有的），維持白板，核心補丁那一行已擋掉。
 *
 * 顯示/堆疊/存檔全部沿用核心：getItemFullName 自動加彩色前綴、getItemColor 讓遺物維持海藍名、
 *   itemSig 已含 bless/anc/attr → 帶詞綴的遺物自己一疊，不會跟白板那疊混在一起。
 *   （圖示光暈仍是遺物海藍光：核心 getGlowClass 遺物優先，刻意不改——那是遺物的身分標記。）
 * ========================================================================== */
(function () {
    'use strict';

    var AFFIX_CHANCE = 0.5;   // 祝福／遠古系／屬性各自獨立的附加機率（三者互不排擠）
    var ANC_TIERS = [true, 'eternal', 'immortal', 'primordial'];   // true＝基礎「遠古」；其餘為 js/08 ancName 認得的變體 key。四種平級不是四個等級（見 applyAncStats）
    var ATTR_ELES = ['fr', 'wa', 'wi', 'ea'];   // ATTR_AFFIX 的元素字首（火/水/風/地）
    var ATTR_TIERS = 5;

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'relicaffix', name: '重複遺物帶詞綴', group: '遊戲玩法', def: true,
        desc: '已經收錄進遺物收集冊的遺物，之後再打到的每一件都有機會帶祝福、遠古系或屬性（屬性只出現在武器遺物）'
    });

    function enabled() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('relicaffix'); }

    // 這次 gainItem「開始之前」該遺物是否已收錄；null＝現在不在 gainItem 裡
    var _dupRelic = false;

    function pick(arr, r) { return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))]; }

    window.__afkRelicAffix = function (d, id) {
        if (!enabled() || !_dupRelic) return null;
        if (!d || !d.relic) return null;
        if (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') return null;   // 蛋等 type:'etc' 的遺物：核心本來就不給詞綴
        if (d.isArrow) return null;   // 箭矢比照核心詞綴分支排除
        try {
            var out = { bless: false, anc: false, attr: false };
            if (lootRng('relicb') < AFFIX_CHANCE) out.bless = true;
            if (lootRng('relica') < AFFIX_CHANCE) out.anc = pick(ANC_TIERS, lootRng('relicat'));
            // 屬性只能存在於武器：給防具/飾品會被 loadGame 清掉（見檔頭）
            if (d.type === 'wpn' && lootRng('relicx') < AFFIX_CHANCE) {
                out.attr = pick(ATTR_ELES, lootRng('relicxe')) + (1 + Math.min(ATTR_TIERS - 1, Math.floor(lootRng('relicxt') * ATTR_TIERS)));
            }
            return out;
        } catch (e) { return null; }   // 任何意外都當作沒這功能：掉落絕不可因此壞掉
    };

    // ⚠️ 缺任何一支就整支停用並印 warn，不可「安靜地永遠不觸發」——這支外掛沒中詞綴時本來就長得跟
    //   原版一模一樣，靠玩家或畫面看不出差別；上游哪天改掉 relicDexHas，沒有這道檢查就會變成
    //   「console 照印 hooks OK、功能其實整支死掉」，而且 smoke 也驗不到（它只看有沒有印 hooks OK）。
    var missing = ['gainItem', 'relicDexHas', 'lootRng'].filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length) {
        console.warn('[AFK-relicaffix] 缺少核心函式（' + missing.join(',') + '），重複遺物詞綴停用（遊戲照常運作）。');
        delete window.__afkRelicAffix;
        return;
    }

    // 記下「這件遺物在本次取得之前有沒有收錄過」。gainItem 內部會先 registerRelicObtained，
    // 所以只有在這裡（呼叫原函式之前）問得到真正的答案。
    if (!window.gainItem.__afkRelicAffix) {
        var _origGain = window.gainItem;
        window.gainItem = function (id) {
            var prev = _dupRelic;
            try {
                var d = DB.items[id];
                _dupRelic = !!(d && d.relic && relicDexHas(id));
            } catch (e) { _dupRelic = false; }
            try { return _origGain.apply(this, arguments); } finally { _dupRelic = prev; }
        };
        window.gainItem.__afkRelicAffix = true;
    }

    // 遺物收集冊頁首補一句——玩家正是在這裡看到「這隻已經收了」，不講他不會知道再打還有意義。
    if (typeof window.renderRelicBook === 'function' && !window.renderRelicBook.__afkRelicAffix) {
        var _origBook = window.renderRelicBook;
        window.renderRelicBook = function () {
            var ret = _origBook.apply(this, arguments);
            if (enabled()) {
                try {
                    var host = document.getElementById('relic-book-body');
                    var head = host && host.firstElementChild;
                    if (head && !host.querySelector('.afk-relicaffix-note')) {
                        head.insertAdjacentHTML('afterend',
                            '<div class="afk-relicaffix-note c-relic text-sm mb-3">已收錄的遺物再打到，有機會帶祝福、遠古系或屬性。</div>');
                    }
                } catch (e) { /* 說明沒插上不影響功能本體 */ }
            }
            return ret;
        };
        window.renderRelicBook.__afkRelicAffix = true;
    }

    console.log('[AFK-relicaffix] hooks OK — 已收錄的遺物再取得時可帶祝福／遠古系／屬性詞綴。');
})();
