/* ==========================================================================
 * afk-buyercompat.js — 收購 NPC 向下兼容:收 +6 的單,手上只有更高強化的也能交
 *
 * 玩家要什麼:安全區叫賣的收購 NPC 指名「+6 的某某裝備」時,現在必須剛好 +6 才交得掉,
 *   於是得為了收購單特地留一件低強化的。放寬成「≥ 需求」之後,背包/倉庫就不用囤那些。
 *   (只有這一處有強化值門檻:遺物布告欄委託的 en 恆為 null、黑市收購單上架的是新生成的 en:0。)
 *
 * 🚨 這件事的風險不在「能不能交」,在「交的是哪一件」:
 *   核心 _findMatches 是「背包由前往後 → 倉庫由前往後,第一個命中就用」。目前因為要求完全相等,
 *   同 id 同 en 同詞綴的本來就疊在一起,挑到誰都一樣;一旦放寬成 ≥,**需求 +0 的白板單就可能
 *   直接把「太初 祝福的 +15 同款」交出去**,而 _consumeMatchedItems 是直接 splice,救不回。
 *   所以核心補丁只開一個「這一件通不通過」的鉤子,**「挑哪一件」100% 留在這裡**:
 *     ① 有剛好符合需求的 → 回 null 完全不介入(不跳確認、走原版流程),對既有情境零影響
 *     ② 沒有 → 只挑最不心疼的一件:無詞綴優先 → 強化值最小 → 背包優先於倉庫
 *     ③ 上鎖的一律不列入候選(自己判,不倚賴 afk-locksafe 是否被玩家關掉)
 *     ④ 畫面上在按下去**之前**就寫出要交哪一件
 *     ⑤ 真的要交出比需求高的,先跳一次確認
 *
 * 為什麼需要核心補丁(不是純外掛能包的):_findMatches 關在 js/24 的 IIFE 裡拿不到。唯一的替代路
 *   是「暫時把某件的 en 改成需求值騙過核心」,但成交後核心自己會 saveGame()(js/24) → 那一疊
 *   +15 會被真的寫成 +6。壞法是「玩家的裝備安靜變質」,不值得。故走錨點補丁(補丁 13),
 *   而補丁本身在鉤子回 null / 外掛沒載 / 開關關掉時與上游行為完全等價。
 *
 * ⚠️ 報酬不會因為你交更高強化的而變多:報酬在叫賣者生成當下就用**需求值**算完寫進 buyer.price /
 *   buyer.reward,成交時只是把那個數字發出去。這是刻意不寫在畫面上的——對話框本來就已經把實際
 *   金額/鑽石數印出來了,再補一句「不變」是廢話。
 *
 * 掛接:排在 afk-locksafe.js **之後**(它也包 performWanderingBuyerTrade /
 *   renderWanderingBuyerDialog;我們後包＝在最外層,算候選時看得到完整背包、自己排除上鎖的)。
 * 優雅降級:核心入口函式或補丁鉤子不在就 console.warn 後安靜停用,收購維持原版嚴格相等。
 * ========================================================================== */
(function () {
    'use strict';

    if (window.AFK_TOGGLES) {
        AFK_TOGGLES.register({
            id: 'buyercompat', name: '收購向下兼容', group: '遊戲介面', def: true,
            desc: '收 +6 的收購單，手上只有更高強化的也能交；交出去之前會先問一次'
        });
    }
    function on() {
        try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('buyercompat'); } catch (e) { return true; }
    }

    var _origTrade = window.performWanderingBuyerTrade;
    var _origDialog = window.renderWanderingBuyerDialog;
    if (typeof _origTrade !== 'function' || typeof _origDialog !== 'function') {
        console.warn('[AFK-buyercompat] 找不到收購 NPC 的入口函式，向下兼容停用（收購維持原版）。');
        return;
    }

    // ── 一次「核心呼叫」內共用的暫存 ───────────────────────────────
    //   核心一次成交會呼叫 _findMatches 兩次(先預檢、再在 _withStateLock 內重算),
    //   兩次必須挑到同一件 → 用 session 快取把「挑哪一件」釘住。
    var _sess = null;   // { picks:{reqKey→pick|null}, wh:倉庫items|null }

    function _withSession(fn, thisArg, args, seedKey, seedPick) {
        var prev = _sess;
        _sess = { picks: {}, wh: null };
        if (seedKey) _sess.picks[seedKey] = seedPick;
        try { return fn.apply(thisArg, args); } finally { _sess = prev; }
    }

    function _reqKey(req) { return String(req && req.id) + '|' + String(req && req.en); }

    function _warehouseItems() {
        if (_sess && _sess.wh) return _sess.wh;
        var arr = [];
        try {
            if (typeof loadWarehouse === 'function') {
                var w = loadWarehouse();
                if (w && Array.isArray(w.items)) arr = w.items;
            }
        } catch (e) {}
        if (_sess) _sess.wh = arr;
        return arr;
    }

    // 「這件心不心疼」——判準沿用 afk-sellguard 的 worthAsking(它已經定義過一次,不要再造一份)。
    //   差別:這裡不看 en>0(每個候選依定義都比需求高),強化值是另一條排序鍵。
    function _fancy(it) {
        var d = null;
        try { d = DB.items[it.id]; } catch (e) {}
        if (d && d.legend) return true;
        try { if (d && typeof isRelic === 'function' && isRelic(d)) return true; } catch (e) {}
        return !!(it.anc || it.bless === true || it.attr || it.seteff);
    }

    // 回傳 null = 不介入(有剛好符合的、或沒有可用候選);否則 { source, item, en }
    function _computePick(req) {
        var wantEn = Math.floor(Number(req && req.en) || 0);
        var p = (typeof player !== 'undefined') ? player : null;   // ⚠️ player 是 js/01 的 let,不在 window 上
        var inv = (p && Array.isArray(p.inv)) ? p.inv : [];
        var hasExact = false, cands = [];

        function scan(list, source) {
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!it || it.id !== req.id) continue;
                var cnt = Math.floor(Number(it.cnt));
                if (!isFinite(cnt) || cnt < 1) cnt = 1;
                if (cnt < 1) continue;
                if (it.lock) continue;                     // 上鎖的一律當作不存在(含判斷「有沒有剛好符合的」)
                var en = Math.floor(Number(it.en) || 0);
                if (en === wantEn) { hasExact = true; continue; }
                if (en < wantEn) continue;
                // 倉庫的物件每次 loadWarehouse 都是新的 → 只能靠 uid 對上;沒有 uid 就不當候選(寧可少做)
                if (source === 'warehouse' && it.uid == null) continue;
                cands.push({ source: source, item: it, en: en, fancy: _fancy(it) });
            }
        }
        scan(inv, 'inventory');
        scan(_warehouseItems(), 'warehouse');

        if (hasExact || !cands.length) return null;
        cands.sort(function (a, b) {
            if (a.fancy !== b.fancy) return a.fancy ? 1 : -1;                       // 無詞綴優先
            if (a.en !== b.en) return a.en - b.en;                                  // 強化值最小
            return (a.source === b.source) ? 0 : (a.source === 'inventory' ? -1 : 1); // 背包優先於倉庫
        });
        return cands[0];
    }

    function _isPick(it, sourceName, pick) {
        if (!pick || sourceName !== pick.source) return false;
        if (it === pick.item) return true;
        return !!(it && pick.item && it.uid != null && it.uid === pick.item.uid);
    }

    // ── 核心補丁 13 的鉤子:核心只問「這一件通不通過」 ───────────────
    //   回 null = 我沒意見,照原版嚴格相等。沒有 session(不是我們包住的呼叫)一律不表態。
    window.__afkBuyerEnMatch = function (it, req, sourceName) {
        if (!_sess || !on()) return null;
        var key = _reqKey(req);
        if (!(key in _sess.picks)) _sess.picks[key] = _computePick(req);
        var pick = _sess.picks[key];
        if (!pick) return null;
        return _isPick(it, sourceName, pick);
    };

    // ── 顯示用 ────────────────────────────────────────────────
    function _plainName(it) {
        var n = '';
        try { if (typeof _autoSellPlainItemName === 'function') n = _autoSellPlainItemName(it); } catch (e) {}
        if (!n) { try { n = (DB.items[it.id] && DB.items[it.id].n) || it.id; } catch (e) { n = String(it.id); } }
        return String(n).replace(/\s*\(\d+\)\s*$/, '');   // 核心全名尾巴會帶整疊數量,這裡只交 1 件
    }
    function _pickText(pick) {
        return _plainName(pick.item) + '（' + (pick.source === 'warehouse' ? '倉庫' : '背包') + '）';
    }
    function _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // 目前這位叫賣者要什麼(拿不到就整個不介入 → 退回原版嚴格相等,不會默默交出高強化的)
    function _reqOf(wandererId) {
        try {
            if (typeof getWanderingBuyersForTown !== 'function') return null;
            var town = (typeof mapState !== 'undefined' && mapState) ? mapState.current : null;
            var list = getWanderingBuyersForTown(town) || [];
            for (var i = 0; i < list.length; i++) {
                var w = list[i];
                if (!w) continue;
                if (!wandererId || w.id === wandererId) return { id: w.itemId, en: w.en };
            }
        } catch (e) {}
        return null;
    }

    // ── 包 ①:對話框——按下去之前就把要交的那一件寫出來 ──────────────
    window.renderWanderingBuyerDialog = function (div, wandererId) {
        if (!on()) return _origDialog.apply(this, arguments);
        var self = this, args = arguments;
        var req = _reqOf(wandererId);
        if (!req || req.en == null) return _origDialog.apply(self, args);
        var pick = _computePick(req);
        var r = _withSession(_origDialog, self, args, _reqKey(req), pick);
        if (pick && div) {
            try {
                var main = div.querySelector('.wandering-buyer-offer-main');
                if (main) {
                    main.insertAdjacentHTML('beforeend',
                        '<div class="afk-buyercompat-donor" style="margin-top:4px;color:#fbbf24;font-size:12px;">' +
                        '將交出：' + _esc(_pickText(pick)) + '</div>');
                }
            } catch (e) {}
        }
        return r;
    };

    // ── 包 ②:成交——要交出比需求高的就先問一次 ──────────────────────
    window.performWanderingBuyerTrade = function (wandererId) {
        if (!on()) return _origTrade.apply(this, arguments);
        var self = this, args = arguments;
        var req = _reqOf(wandererId);
        if (!req || req.en == null) return _origTrade.apply(self, args);
        var pick = _computePick(req);
        var key = _reqKey(req);
        if (!pick) return _withSession(_origTrade, self, args, key, null);   // 有剛好符合的 → 原版流程

        var msg = '將交出：' + _pickText(pick);
        var go = function () { _withSession(_origTrade, self, args, key, pick); };
        if (window.AFK_UI && typeof AFK_UI.confirm === 'function') {
            AFK_UI.confirm({ title: '交出更高強化的裝備', message: msg, okText: '確定', cancelText: '取消', danger: true, onOk: go });
        } else if (typeof confirm === 'function') {
            if (confirm(msg)) go();
        } else {
            go();
        }
    };

    console.log('[AFK-buyercompat] hooks OK — 收購向下兼容（挑最不心疼的一件、上鎖不列入、交付前確認）。');
})();
