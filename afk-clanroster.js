/* ============================================================================
 * afk-clanroster.js — 血盟名冊瘦身（限制記住的路過玩家人數）
 *
 * 名冊是什麼：核心把「遇過的玩家型 NPC」逐一登記在血盟共用桶
 *   （fb5_clan_state_v1 的 npcWorlds.*.memberships），記下他的職業、性向、等級偏移、
 *   隸屬血盟，好讓同一個名字下次再遇到還是同一個人。
 *
 * 為什麼要瘦身：那份名冊**只增不減**（核心只在「血盟消失」時清掉該盟成員，沒血盟的
 *   路人永遠留著），上限一萬筆。而野外 PVP 開著時，**每生成一個對手就要把整包名冊
 *   讀出來、改完、再寫回去**，一小時離線約 157 次 —— 名冊越大，每一次都越貴。
 *
 *   實測（玩家真實存檔·每 1 小時離線時間）：
 *     名冊 6,189 筆（未壓縮 826 KB）→ 20.0 秒；灌到上限 10,000 筆（1.29 MB）→ 36.6 秒。
 *     所以這是個「越玩越慢、慢到撞上限才停」的性質，不是固定成本。
 *
 * 留多少才夠：用核心真正的名字產生規則模擬 20 萬次遭遇（相異名字 29,080 個），
 *   以「最近遇過優先」保留 N 筆時，再遇到時認得出來的比例是
 *     100 筆 31% ／ 200 筆 39.5% ／ 500 筆 44% ／ 1,000 筆 50% ／ 10,000 筆 82%。
 *   曲線在 200 筆就轉彎（前 40% 幾乎都是那批短名字，它們佔 45% 的抽中機率、本來就一直重複）。
 *   200 → 10,000 是大 50 倍、每次寫貴 50 倍，只換到 42 個百分點的「路人職業跟上次一樣」。
 *   對照組：一位一切正常的玩家實際就只有 609 筆，離線結算 0.2~2.9 秒／離線小時。
 *
 * 保留規則（照「玩家感覺得到什麼」排）：
 *   - 盟主一律留：那是各血盟的固定門面，核心也會自己重建，砍了只是白費工。
 *   - 每個血盟留最近 KEEP_PER_CLAN 個成員：「敵盟固定班底」的體感來自這裡。
 *   - 沒血盟的路人留最近 KEEP_STRANGERS 個：這批是量最大、也最沒人記得的。
 *
 * 🚨 不動玩家自己的東西：被追殺清單／報復清單／擊殺密語／社交聯絡人都各自把完整資料
 *   存在角色存檔裡（見 js/03 的 pvpEnsureState、js/26 的 socialNpcContacts），
 *   不依賴這份名冊 —— 所以瘦身不會讓追你的人換一個職業，也不會弄丟你的聯絡人。
 *
 * 掛接：包住 _clanWriteState（寫入前修剪）與 pvpCreateRandomOpponent（記下「最後一次遇到」）。
 * ========================================================================== */
(function () {
    'use strict';

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'clanroster', name: '血盟名冊瘦身', group: '系統與其他', def: true,
        desc: '只記住最近遇過的玩家，離線結算才不會越玩越慢；關掉會慢慢累積到一萬人'
    });

    if (typeof _clanWriteState !== 'function') {
        console.warn('[AFK-clanroster] 找不到 _clanWriteState，瘦身停用（遊戲照常運作）。');
        return;
    }
    if (_clanWriteState.__afkRoster) { console.log('[AFK-clanroster] hooks OK'); return; }   // 冪等：重複載入不疊包

    var KEEP_PER_CLAN  = 20;    // 每個血盟保留幾個非盟主成員（20 盟 → 最多 400 筆；夠撐起「固定班底」的體感）
    var KEEP_STRANGERS = 200;   // 沒血盟的路人保留幾個（模擬曲線的轉彎點，見檔頭）

    // 「最後一次遇到」：核心的 assignedAt 只在**第一次**登記時寫入，之後重複遇到不會更新，
    //   直接拿它當「最近」用會把「最常遇到的那批」（最早登記）優先砍掉——正好砍反。
    //   故自己記一份最後使用時間，寫入前套用到名冊上（assignedAt 沒有任何地方拿來做判斷，
    //   只在 npcClanSocialRoster 原樣回傳，改它是安全的）。
    var _lastSeen = Object.create(null);

    if (typeof pvpCreateRandomOpponent === 'function' && !pvpCreateRandomOpponent.__afkRoster) {
        var _origCreate = pvpCreateRandomOpponent;
        pvpCreateRandomOpponent = function () {
            var entry = _origCreate.apply(this, arguments);
            try { if (entry && entry.n) _lastSeen[String(entry.n).slice(0, 24)] = Date.now(); } catch (e) {}
            return entry;
        };
        pvpCreateRandomOpponent.__afkRoster = true;
    }

    // 一份名冊 → 修剪後的新名冊（回傳 null 代表沒超量、不必動）
    function trimMemberships(mem) {
        var names = Object.keys(mem);
        var byClan = Object.create(null), strangers = [], keep = Object.create(null), n, rec, i;
        for (i = 0; i < names.length; i++) {
            n = names[i]; rec = mem[n];
            if (!rec) continue;
            if (rec.leader) { keep[n] = rec; continue; }                 // 盟主無條件留
            if (rec.clanId) (byClan[rec.clanId] || (byClan[rec.clanId] = [])).push(n);
            else strangers.push(n);
        }
        var over = strangers.length > KEEP_STRANGERS;
        var clanIds = Object.keys(byClan);
        for (i = 0; i < clanIds.length; i++) if (byClan[clanIds[i]].length > KEEP_PER_CLAN) over = true;
        if (!over) return null;   // 沒超量：連排序都不做（一般玩家平常走這條，零成本）

        function recent(a, b) { return seenAt(b) - seenAt(a); }
        function seenAt(name) { return Math.max(_lastSeen[name] || 0, (mem[name] && mem[name].assignedAt) || 0); }
        for (i = 0; i < clanIds.length; i++) {
            byClan[clanIds[i]].sort(recent).slice(0, KEEP_PER_CLAN).forEach(function (nm) { keep[nm] = mem[nm]; });
        }
        strangers.sort(recent).slice(0, KEEP_STRANGERS).forEach(function (nm) { keep[nm] = mem[nm]; });
        return keep;
    }

    var _origWrite = _clanWriteState;
    _clanWriteState = function (st) {
        if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('clanroster')) return _origWrite(st);
        try {
            var worlds = st && st.npcWorlds;
            for (var mode in worlds) {
                var w = worlds[mode];
                if (!w || !w.memberships) continue;
                for (var nm in _lastSeen) if (w.memberships[nm]) w.memberships[nm].assignedAt = _lastSeen[nm];
                var trimmed = trimMemberships(w.memberships);
                if (trimmed) w.memberships = trimmed;
            }
        } catch (e) { /* 修剪失敗就照原樣寫入，絕不可因此讓血盟資料存不進去 */ }
        return _origWrite(st);
    };
    _clanWriteState.__afkRoster = true;

    window.AFK_CLANROSTER = {   // 供 afk-diag／問題回報取證（唯讀）
        keepPerClan: KEEP_PER_CLAN,
        keepStrangers: KEEP_STRANGERS,
        counts: function () {
            var out = {};
            try {
                var st = _clanReadState(), worlds = st && st.npcWorlds;
                for (var mode in worlds) if (worlds[mode] && worlds[mode].memberships) out[mode] = Object.keys(worlds[mode].memberships).length;
            } catch (e) {}
            return out;
        }
    };

    console.log('[AFK-clanroster] hooks OK');
})();
