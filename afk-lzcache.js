/**
 * afk-lzcache.js — 大資料重複處理的快取（三層：解壓、血盟 Buff 查詢、血盟狀態讀取）
 *
 * 為什麼需要：核心把幾包大資料以 LZString 壓在 localStorage（血盟狀態、存檔、圖鑑…），
 * 而 killMob → pvpOnKillMob → npcClanMaybeStartGroupBattle 會在擲骰「要不要開血盟團戰」之前
 * 先 npcClanGetWorld() 讀整包血盟狀態——也就是**每殺一隻怪就完整解壓一次**。線上如此，離線
 * 結算更把它放大成瓶頸：24 小時結算 6 萬多隻怪 ≈ 10 萬次解壓，佔總耗時近八成。
 *
 * 【第一層】包住 LZString.decompressFromUTF16，用「壓縮字串 → 解壓字串」的 LRU 快取。
 *   兩端都是不可變字串、函式本身是純函式 → 快取不可能改變任何遊戲行為；
 *   有人寫過那個 key（localStorage 內容變了）→ 壓縮字串不同 → 自動未命中重算，不需失效通知。
 *   實測（真實存檔 mageLv97 sunrise_east，24h 離線結算）：43.3s → 10.9s。
 *   另跑過對照組：用快取值但每次仍真解壓一遍比對，近 19 萬次比對 0 次不符。
 *
 * 【第二層】包住 getClanBuffStats——解壓被快取之後，剩下的成本是「每次都把解開的 242KB
 *   血盟 JSON 重新 JSON.parse 一次、再整份正規化一次」，那兩步第一層蓋不到。
 *   recomputeStats() 每次都會問一次血盟 Buff，而重算在某些配裝下是逐殺發生的
 *   （見 apply-core-patches 補丁 9：吉爾塔斯魔杖）→ 同樣被放大成離線結算的大宗。
 *   細節見下方該段的註解。
 *
 * 【第三層】包住 _clanReadStateResult——野外圖上「每生一個 PVP 對手、每殺一隻怪問一次要不要開
 *   團戰」都會整包重讀血盟狀態。**線上與離線都吃得到，而且線上省得更多**（線上寫入少 → 命中率更高）：
 *   實測同一份玩家存檔在龍之谷，線上實跑 90 秒 398ms→135ms、離線每次 357µs→231µs。
 *   第一層蓋不到它：結算期間存的多半是未壓縮明文（_lzSet 先寫明文、壓縮丟給 Worker），根本沒解壓。
 *   細節與兩條安全紅線見下方該段的註解。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('lzcache')) return;   // 🎚️ 外掛開關

    if (typeof LZString === 'undefined' || typeof LZString.decompressFromUTF16 !== 'function') {
        console.warn('[AFK-lzcache] 找不到 LZString.decompressFromUTF16，快取停用（遊戲照常運作）。');
        return;
    }
    if (LZString.decompressFromUTF16.__afkLz) return;   // 冪等：重複載入不疊包

    // 上限以「字元數」計而非筆數：一筆存檔可能幾十萬字元，用筆數當上限等於沒有上限。
    var MAX_CHARS = 3000000;   // 全部快取內容合計上限（≈ 6MB 記憶體）
    var MAX_ENTRY = 1200000;   // 單筆超過就不收（不讓一筆大檔把整個快取擠光）

    var cache = new Map();     // 壓縮字串 → 解壓字串（Map 保留插入序 → 拿它做 LRU）
    var chars = 0;
    var hits = 0, misses = 0;

    var orig = LZString.decompressFromUTF16.bind(LZString);
    LZString.decompressFromUTF16 = function (s) {
        if (typeof s !== 'string' || !s) return orig(s);
        if (cache.has(s)) {
            hits++;
            var v = cache.get(s);
            cache.delete(s); cache.set(s, v);   // 移到最新端（LRU）
            return v;
        }
        misses++;
        var out = orig(s);
        var size = (s.length + (typeof out === 'string' ? out.length : 0));
        if (size <= MAX_ENTRY) {
            while (chars + size > MAX_CHARS && cache.size) {
                var oldK = cache.keys().next().value, oldV = cache.get(oldK);
                chars -= oldK.length + (typeof oldV === 'string' ? oldV.length : 0);
                cache.delete(oldK);
            }
            cache.set(s, out);
            chars += size;
        }
        return out;
    };
    LZString.decompressFromUTF16.__afkLz = true;

    // ───────────────────────────────────────────────────────────────────────
    // 第二層：血盟 Buff 查詢快取（省掉重複的 JSON.parse + 正規化）
    //
    // getClanBuffStats(p) 的回傳只由三件事決定：血盟資料本身、這個角色的身分(clanRoleId)、
    // 他所在的模式(clanModeKey)。三者都沒變 → 答案一定一樣，卻要付「重讀 + JSON.parse 242KB
    // + _clanNormalizeState 整份正規化」約 1ms。它掛在 recomputeStats() 裡，逐殺重算的配裝
    // （吉爾塔斯魔杖）一小時離線要跑四萬次 → 45 秒以上都花在這。
    //
    // 快取鍵＝角色+模式，有效性靠「壓縮字串有沒有變」判定（跟第一層同一個道理：任何人寫過
    // 那個 key，字串就不同 → 自動失效，不需要通知機制）。讀那個字串本身很便宜（不解壓、不 parse）。
    //
    // ⚠ 兩個一定要守住的點：
    //   1. **滿 30 秒那次不可以走快取**——getClanBuffStats 裡藏著「順便結算血盟貢獻」的副作用
    //      （_clanSettleRole：扣貢獻、貢獻不足時關掉 Buff、寫回存檔）。那次一律走原函式。
    //   2. **每次都回傳新的複本**——原函式本來就每次回一個新物件，呼叫端若就地改它，
    //      共用同一個物件會把快取汙染掉。
    //   3. 快取要**每個角色一格**（Map）：一次結算會在玩家與各傭兵之間輪流問，
    //      單格快取的命中率是 0（實測過，一開始就是這樣寫錯的）。
    // ───────────────────────────────────────────────────────────────────────
    var cbHits = 0, cbMisses = 0;
    var cbCache = new Map();   // '角色id\n模式' → { raw:壓縮字串, val:結果 }
    if (typeof window.getClanBuffStats === 'function' && !window.getClanBuffStats.__afkClanBuf) {
        var cbOrig = window.getClanBuffStats;
        window.getClanBuffStats = function (p) {
            if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('lzcache')) return cbOrig(p);
            var id, mode, raw;
            try {
                if (!p) p = player;
                id = clanRoleId(p);
                // 這次會觸發 30 秒一輪的貢獻結算（有副作用）→ 一定要走原路
                if (!id || Date.now() - (Number(_clanLastSettleByRole[id]) || 0) >= 30000) return cbOrig(p);
                mode = clanModeKey(p);
                raw = (typeof _lsGet === 'function') ? _lsGet(CLAN_STATE_KEY) : localStorage.getItem(CLAN_STATE_KEY);
            } catch (e) { return cbOrig(p); }   // 少了任何一個核心全域就透明放行
            var k = id + '\n' + mode;
            var hit = cbCache.get(k);
            if (hit && hit.raw === raw) { cbHits++; return hit.val ? Object.assign({}, hit.val) : null; }
            cbMisses++;
            var val = cbOrig(p);
            if (cbCache.size > 200) cbCache.clear();   // 角色數本來就是幾十的量級；真的爆掉就整個丟掉重來
            cbCache.set(k, { raw: raw, val: val });
            return val ? Object.assign({}, val) : null;
        };
        window.getClanBuffStats.__afkClanBuf = true;
    }

    // ───────────────────────────────────────────────────────────────────────
    // 第三層：血盟狀態讀取快取（省掉重複的「解壓 + JSON.parse + 整份正規化」）
    //
    // 每生一個玩家型 PVP 對手、每殺一隻怪問一次「要不要開血盟團戰」都會呼叫 _clanReadState()，
    // 每次約 370µs（JSON.parse 150µs ＋ _clanNormalizeState 230µs）。**線上與離線都會踩到**，
    // 實測同一份玩家存檔（龍之谷·對 8 個 NPC 血盟宣戰·遭遇率 3%）：
    //   ・離線結算：3,002 次／離線小時＝1.1 秒，佔該場 25~35%；每次 357µs→231µs
    //   ・線上遊玩：90 秒實跑累計 398ms→135ms（線上寫入少、快取幾乎不失效，所以省得比離線多）
    // 別把這層綁在「只有補跑時才啟用」——線上才是它效果最好的地方。
    // （結算期間存的多半是未壓縮明文——_lzSet 先寫明文、壓縮丟給 Worker——所以第一層的解壓快取
    // 在這條路上幾乎沒作用，要另外擋一層。）
    //
    // 有效性判定與第一/二層同一個道理：**localStorage 裡那個字串有沒有變**。任何人寫過那個 key
    // （含別的分頁）字串就不同 → 自動未命中重算，不需要通知機制、也不怕跨分頁改到。
    //
    // 🚨 兩個一定要守住的點：
    //   1. **快取存字串、不存物件，每次回傳新的物件**。呼叫端（js/25 _clanWithLock 的 mutator）
    //      會就地改它，而且有 `commit:false` 的路徑是**改完不寫回**的 —— 共用同一個物件會讓
    //      那些「本來該丟掉的修改」默默留下來，是會改變遊戲行為的靜默錯誤。
    //      （這也是為什麼不用 structuredClone 回傳複本：實測 279µs，比重新 parse 還貴。）
    //   2. 跳過正規化的前提是**正規化冪等**（對已正規化的資料再跑一次結果相同）。實測成立，
    //      但上游哪天改成不冪等就會變成靜默失真 → 第一次填快取時自己驗一次，驗不過就
    //      **整層自我停用**（退回原本行為，只是慢一點），不賭。
    // 記憶體成本：固定就兩條字串（儲存原值＋正規化後的文字），各約等於血盟資料大小
    // （實測玩家存檔 68KB／條；名冊爆掉的極端案例約 830KB／條）→ 不必做上限與淘汰。
    var crHits = 0, crMisses = 0, crRaw = null, crNorm = null, crOK = true;
    if (typeof window._clanReadStateResult === 'function' && typeof window._clanNormalizeState === 'function'
        && typeof window._lsGet === 'function' && !window._clanReadStateResult.__afkClanRead) {
        var crKey = (typeof CLAN_STATE_KEY === 'string' && CLAN_STATE_KEY) ? CLAN_STATE_KEY : 'fb5_clan_state_v1';
        var crOrig = window._clanReadStateResult;
        window._clanReadStateResult = function () {
            if (!crOK) return crOrig.apply(this, arguments);
            var raw = null;
            try { raw = _lsGet(crKey); } catch (e) { return crOrig.apply(this, arguments); }
            if (raw != null && raw === crRaw && crNorm != null) {
                try { crHits++; return { ok: true, state: JSON.parse(crNorm) }; }
                catch (e) { crRaw = crNorm = null; }   // 快取內容壞了就丟掉重來，不要拖累遊戲
            }
            crMisses++;
            var r = crOrig.apply(this, arguments);
            if (!r || !r.ok || !r.state || raw == null) return r;
            try {
                var text = JSON.stringify(r.state);
                if (crNorm === null && crRaw === null) {   // 第一次填快取：驗「正規化是冪等的」
                    if (JSON.stringify(_clanNormalizeState(JSON.parse(text))) !== text) {
                        crOK = false;
                        console.warn('[AFK-lzcache] 血盟正規化不再冪等（上游改過？）→ 第三層快取自我停用，結算會慢一點但行為不變。');
                        return r;
                    }
                }
                crRaw = raw; crNorm = text;
            } catch (e) { crRaw = crNorm = null; }
            return r;
        };
        window._clanReadStateResult.__afkClanRead = true;

        // 寫入後順手把快取填好。不填的話每次寫入都讓下一次讀取未命中（實測 3,002 讀對 1,086 寫，
        // 命中率只有六成多，而且每次未命中還要多付一次 JSON.stringify 去填快取）。
        // 填的成本趨近於零：剛寫進去的那個字串就是 localStorage 現在的值，把它 _saveUnwrap
        // 拆掉簽章就是「已正規化的 JSON 文字」——兩步都不用重新正規化也不用重新序列化。
        if (typeof window._clanWriteState === 'function' && !window._clanWriteState.__afkClanRead) {
            var cwOrig = window._clanWriteState;
            window._clanWriteState = function () {
                var ok = cwOrig.apply(this, arguments);
                if (!crOK) return ok;
                if (!ok) { crRaw = crNorm = null; return ok; }   // 沒寫成功 → 舊快取可能已失真，丟掉
                try {
                    var raw = _lsGet(crKey);
                    var u = (typeof _saveUnwrap === 'function') ? _saveUnwrap(raw) : null;
                    var text = (u && u.payload != null) ? u.payload : raw;
                    if (raw != null && text != null) { crRaw = raw; crNorm = text; }
                    else { crRaw = crNorm = null; }
                } catch (e) { crRaw = crNorm = null; }
                return ok;
            };
            window._clanWriteState.__afkClanRead = true;
        }
    }

    window.AFK_LZCACHE = {   // 供 afk-diag / 問題回報取證（唯讀）
        stats: function () {
            return {
                hits: hits, misses: misses, entries: cache.size, chars: chars,
                clanBuffHits: cbHits, clanBuffMisses: cbMisses, clanBuffEntries: cbCache.size,
                clanReadHits: crHits, clanReadMisses: crMisses, clanReadOn: crOK
            };
        },
        clear: function () { cache.clear(); chars = 0; cbCache.clear(); crRaw = crNorm = null; }
    };

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'lzcache',
        // ⚠️ name/desc 要與 afk-toggles.js 內建目錄那筆一致（實際生效的是那筆，這裡只是後備）
        name: '資料記憶體暫存',
        desc: '戰鬥比較不卡、離線結算快好幾倍；會多用一點記憶體',
        group: '系統與其他',
        def: true
    });

    console.log('[AFK-lzcache] hooks OK');
})();
