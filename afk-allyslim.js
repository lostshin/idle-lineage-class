/* ============================================================================
 * afk-allyslim.js — 傭兵快照瘦身（把「沒有人讀」的欄位清空，不進存檔）
 *
 * 傭兵是「來源角色的深拷貝快照」，所以隊長的存檔裡，每個傭兵都各帶一份完整的角色資料——
 * 包含一堆對傭兵毫無意義的東西。實測三位玩家的全部存檔位（未壓縮 5,299 KB）：
 *   傭兵快照佔 1,644 KB（31%），其中光「廢品標記」就 824 KB（傭兵快照的一半）。
 *   單看最肥的一格：玩家A 存檔1 未壓縮 368 KB，其中玩家自己的廢品標記 48 KB
 *   ＋三個傭兵各帶一份共 122 KB ＝ 170 KB（46%）都是廢品標記。
 *
 * 上游本來就在做同一件事，只是漏了幾個：buildAlly 尾端 `delete ally.summonsV2 … relicDex`
 * （註解寫「無人讀取·純存檔肥大」）、_allyLevelRecompute 尾端 delete 四個收集冊桶。
 * 這支把同一個處理補到剩下的大戶身上。
 *
 * 怎麼確認「沒有人讀」（新增欄位到 DEAD 之前，這三關都要過）：
 *   1. `player = ally` 的視窗裡只跑 recomputeStats()（buildAlly 與 _allyLevelRecompute 皆然）
 *      → js/02 整份不能出現該欄位。
 *   2. js/06（傭兵專屬邏輯）整份不能出現。
 *   3. 全 repo 搜 `.<欄位>` 只能出現在 `player.` 前綴（也就是永遠只對主玩家操作）。
 *   目前 DEAD 這六個都是三關全過；`config` 是反例（js/06:788 會讀 ally.config）故不能清。
 *
 * 🚨 為什麼清空而不是 delete：萬一哪天上游新增一段在 player=ally 視窗裡讀它的程式碼，
 *   `{}` 只是讀到空的、`undefined` 會直接丟例外。留著空殼幾乎不佔位元組，卻換掉一整類崩潰。
 *
 * 🚨 為什麼不會弄壞來源角色的資料：解雇／刷新傭兵時寫回來源存檔的是 _settleAllyExpDirect，
 *   它用 _allyManagerSource 從 localStorage **重新讀一份**來源存檔再改 exp/lv/性向
 *   （js/06:3697），從來不是把傭兵快照整個寫回去。所以清空快照動不到來源角色的廢品標記。
 *
 * 掛接：包 saveGame（存檔前清一次）——一個掛點就涵蓋所有產生傭兵的路徑，
 *   而且**既有存檔的舊快照也會在下一次存檔時自動瘦身**，不必等傭兵被重建。
 * ========================================================================== */
(function () {
    'use strict';

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'allyslim', name: '傭兵快照瘦身', group: '系統與其他', def: true,
        desc: '存檔小三成左右；關掉會讓存檔空間吃緊得更快'
    });

    if (typeof window.saveGame !== 'function') {
        console.warn('[AFK-allyslim] 找不到 saveGame，瘦身停用（遊戲照常運作）。');
        return;
    }
    if (window.saveGame.__afkSlim) { console.log('[AFK-allyslim] hooks OK'); return; }   // 冪等：重複載入不疊包

    // 傭兵快照裡「沒有任何程式碼會讀」的欄位（判定方式見檔頭三關）。括號內是三位玩家實測合計。
    var DEAD = [
        'junkPrefs',        // 廢品標記（824 KB）——隊長自己那份照留，只清傭兵身上的副本
        'pvpAlignLock',     // 性向鎖（180 KB）
        'pandoraMarket2',   // 潘朵拉遺物市場（62 KB）
        '_offStats',        // 離線統計（32 KB）
        'autoSellRules',    // 自動販賣規則（13 KB）
        'lastMapByCat'      // 各類別最後所在地圖（13 KB）
    ];

    function slimOne(ally) {
        if (!ally || typeof ally !== 'object') return 0;
        var freed = 0;
        for (var i = 0; i < DEAD.length; i++) {
            var k = DEAD[i], v = ally[k];
            if (v == null || typeof v !== 'object') continue;
            if (Array.isArray(v)) { if (v.length) { freed += v.length; ally[k] = []; } }
            else { var n = Object.keys(v).length; if (n) { freed += n; ally[k] = {}; } }
        }
        return freed;
    }

    var _freedTotal = 0;
    var _origSave = window.saveGame;
    window.saveGame = function () {
        if (!window.AFK_TOGGLES || AFK_TOGGLES.enabled('allyslim')) {
            try {
                var list = (typeof player !== 'undefined' && player && player.allies) || [];
                for (var i = 0; i < list.length; i++) _freedTotal += slimOne(list[i]);
            } catch (e) { /* 清不動就照原樣存，絕不可因此讓存檔存不進去 */ }
        }
        return _origSave.apply(this, arguments);
    };
    window.saveGame.__afkSlim = true;

    window.AFK_ALLYSLIM = {   // 供 afk-diag／問題回報取證（唯讀）
        fields: DEAD.slice(),
        freedEntries: function () { return _freedTotal; }   // 累計清掉幾筆（0＝本來就沒有肥資料）
    };

    console.log('[AFK-allyslim] hooks OK');
})();
