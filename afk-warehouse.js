/**
 * afk-warehouse.js — 倉庫擴充(純外掛,自 main 的核心版移植):
 *   ① 金幣「全部存入/全部取出」鈕(填滿數量欄後走核心 whGold,交易快照/防複製全重用)。
 *   ② 主分類補「遺物」(橫跨武器/防具/飾品;原本分類下仍查得到,不動 whCategory)。
 *   ③ 主分類補「席琳遺骸」,子分類=套裝名(詞綴在實例 seteff 上,核心 whMatchFilter 只吃 id
 *      → 套裝子分類改在 render 後依清單列的 data-tip-uid 反查實例後過濾,不動核心簽名)。
 *   ④ 觸控裝置長按倉庫/背包清單物品 → 顯示物品資料(核心只有 hover tooltip,手機看不到)。
 *   ⑤ 「只列可穿」勾選 ＋ 穿不了的列標紅(核心倉庫兩欄只印物品全名,完全看不出本職業能不能穿,
 *      四個角色共用一個倉庫時尤其難挑)。判定一律走核心 checkCanEquip,不自己重寫職業規則。
 *   ⑥ 背包區塊可摺疊(手機:兩份清單上下疊、整個視窗一起捲,背包擋在倉庫前面)。
 *
 * 作法:包 whSubCatOptions/whMatchFilter/whMatchSearch/renderWarehouseNPC 四支全域;缺任一→console.warn 後停用。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('warehouse')) return;   // 🎚️ 外掛開關
    if (typeof window.renderWarehouseNPC !== 'function' || typeof window.whGold !== 'function'
        || typeof window.loadWarehouse !== 'function' || typeof window.whSubCatOptions !== 'function'
        || typeof window.whMatchFilter !== 'function' || typeof window.whMatchSearch !== 'function'
        || typeof window.checkCanEquip !== 'function') {
        try { console.warn('[AFK-warehouse] 缺核心倉庫函式,倉庫擴充停用。'); } catch (e) {}
        return;
    }

    // ── 「只列可穿」──────────────────────────────────────────────
    // 判定一律呼叫核心 checkCanEquip(職業/性別頭像/負重強化/劍術精通全在裡面),外掛不重寫規則。
    // 它只讀 item.id,故傳 {id:...} 即可(倉庫的過濾點只拿得到 id)。
    var _wearOnly = false;
    // 寵物裝備(petwpn/petarm)是給寵物穿的,拿玩家職業去判會一律變「不可穿」→ 排除(同核心 js/10 比較卡的作法)
    function _isPlayerGear(d) {
        return !!d && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc')
            && d.slot !== 'petwpn' && d.slot !== 'petarm';
    }
    function _cannotWear(id) {
        var d = DB.items[id];
        if (!_isPlayerGear(d)) return false;   // 非玩家裝備(道具/材料/寵物裝)不參與判定
        try { return !checkCanEquip({ id: id }); } catch (e) { return false; }
    }
    // ── 魔法書:已學習／無法學習 ────────────────────────────────
    // 倉庫兩欄只印物品全名,顏色只反映稀有度 → 四個角色共用一個倉庫時,分不出哪本自己學過、
    // 哪本這個職業根本學不了。背包(核心 js/10:285-296)本來就有這兩個標記,這裡把同一件事補到倉庫。
    // 🚨 判定一律用核心自己那兩條,不重寫:已學習＝player.skills 有它;無法學習＝skillReqLv() 回 undefined
    //    (那支已經含魔導精通之類的特例,自己判職業表一定會漏)。
    function _bookState(id) {
        var d = DB.items[id];
        if (!d || d.type !== 'skillbk') return '';
        try {
            if (player && player.skills && player.skills.indexOf(d.sk) >= 0) return 'learned';
            if (typeof skillReqLv === 'function' && skillReqLv(DB.skills[d.sk], d.sk) === undefined) return 'cant';
        } catch (e) {}
        return '';
    }
    window.__afkWhWearOnly = function (on) {
        _wearOnly = !!on;
        renderWarehouseNPC(document.getElementById('interaction-content'));
    };

    // ── 主分類擴充:relic / remains ──────────────────────────────
    var _subOpts = window.whSubCatOptions;
    window.whSubCatOptions = function () {
        try {
            if (_whFilter === 'relic') return [{ key: 'wpn', name: '武器' }, { key: 'arm', name: '防具' }, { key: 'acc', name: '飾品' }];
            if (_whFilter === 'remains') return (typeof SHERINE_EFFECTS !== 'undefined' ? SHERINE_EFFECTS : []).map(function (n) { return { key: n, name: n }; });
        } catch (e) {}
        return _subOpts.apply(this, arguments);
    };
    var _match = window.whMatchFilter;
    window.whMatchFilter = function (id) {
        try {
            if (_wearOnly && _cannotWear(id)) return false;
            if (_whFilter === 'relic') {
                var d = DB.items[id];
                if (!d || typeof isRelic !== 'function' || !isRelic(d)) return false;
                return !_whSubFilter || d.type === _whSubFilter;
            }
            if (_whFilter === 'remains') {
                var d2 = DB.items[id];
                return !!(d2 && d2.remains);   // 套裝名子分類看「實例」的 seteff → render 後過濾(见 afterRender)
            }
        } catch (e) {}
        return _match.apply(this, arguments);
    };
    // 搜尋中核心走的是 whMatchSearch(不經 whMatchFilter)，「只列可穿」要在這裡也生效才一致
    var _search = window.whMatchSearch;
    window.whMatchSearch = function (it) {
        try { if (_wearOnly && it && _cannotWear(it.id)) return false; } catch (e) {}
        return _search.apply(this, arguments);
    };

    // ── 金幣全部存入/取出:填滿數量欄再走核心 whGold(整套交易保護重用) ──
    window.__afkWhGoldAll = function (dir) {
        try {
            var w = loadWarehouse();
            var amt = dir === 'in' ? (player.gold || 0) : ((w && w.gold) || 0);
            if (amt <= 0) return;
            var inp = document.getElementById('wh-gold-amt');
            if (inp) inp.value = amt;
            whGold(dir);
        } catch (e) {}
    };

    // ── 觸控長按看物品資料 ─────────────────────────────────────
    // 核心把格子的 click 寫死成 whDeposit/whWithdraw、資訊只掛在桌機 mousemove tooltip 上,
    // 手機因此完全看不到物品資料;這裡在兩個清單容器上做事件委派補上長按檢視。
    var LP_MS = 450;          // 長按判定時間
    var LP_MOVE_TOL = 10;     // 位移超過此值視為捲動,取消長按
    var LP_CLICK_GUARD_MS = 900;   // 長按觸發後在此時間內攔掉一次 click(否則放開手指東西就被存/取走)
    var LP_Z = 9700;          // 與 afk-mobile 浮動選單同層,壓得過倉庫浮動視窗(72)

    var _isTouch = (function () {
        try {
            return ('ontouchstart' in window)
                || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
        } catch (e) { return false; }
    })();

    var _lpTimer = null, _lpX = 0, _lpY = 0, _lpGuardUntil = 0, _lpTip = null;

    function _lpGetTip() {
        if (_lpTip && _lpTip.parentNode) return _lpTip;
        // 自建一顆,不重用核心 .game-tooltip:那顆有 _id 快取且 document mousedown 會 hideTip,兩邊會互踩
        var el = document.createElement('div');
        el.id = 'afk-wh-tip';
        el.setAttribute('style', 'position:fixed;left:0;top:0;display:none;z-index:' + LP_Z + ';'
            + 'max-width:min(84vw,340px);max-height:60vh;overflow-y:auto;'
            + 'background:rgba(15,23,42,0.98);border:1px solid #475569;border-radius:6px;'
            + 'padding:8px 10px;box-shadow:0 6px 24px rgba(0,0,0,0.6);'
            + 'pointer-events:none;-webkit-user-select:none;user-select:none;');
        document.body.appendChild(el);
        _lpTip = el;
        return el;
    }
    function _lpHide() {
        try { if (_lpTip) _lpTip.style.display = 'none'; } catch (e) {}
        try { document.body.classList.remove('afk-wh-lp'); } catch (e) {}
    }

    function _lpInjectCSS() {
        if (!_isTouch || document.getElementById('afk-wh-lp-style')) return;
        var s = document.createElement('style'); s.id = 'afk-wh-lp-style';
        s.textContent = [
            // iOS Safari 長按可點元素會跳原生「拷貝/查詢」callout 蓋住自製資料框,關掉它與文字選取
            '#wh-inv-list [data-tip-uid],#wh-store-list [data-tip-uid]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}',
            // 本框顯示時蓋掉核心的 hover 提示框:Android Chrome 會在手指放開後補送假滑鼠事件,
            //   核心那顆(只綁 mousemove)照樣跳出來 → 同一件物品出現兩個一模一樣的框(玩家回報)。
            //   iOS 對 <button> 不補這組事件,核心那顆跳不出來,所以自製這顆仍要留著。
            //   ⚠ 必須 !important:核心是用 inline style 開關它,沒有 !important 蓋不過。
            'body.afk-wh-lp .game-tooltip{display:none !important;}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    }

    // 依格子的 data-tip-uid/data-tip-src 反查實例(與遺骸子分類過濾同一套反查邏輯)
    function _lpFindItem(src, uidv) {
        try {
            if (src === 'wh') {
                var w = loadWarehouse();
                return ((w && w.items) || []).find(function (x) { return x && String(x.uid) === String(uidv); }) || null;
            }
            return ((player && player.inv) || []).find(function (x) { return x && String(x.uid) === String(uidv); }) || null;
        } catch (e) { return null; }
    }

    function _lpShow(host, x, y) {
        if (typeof getItemFullName !== 'function' || typeof buildItemDescHTML !== 'function') return;
        var it = _lpFindItem(host.getAttribute('data-tip-src') || 'inv', host.getAttribute('data-tip-uid'));
        if (!it) return;
        var el = _lpGetTip();
        var color = typeof getItemColor === 'function' ? getItemColor(it) : 'text-white';
        el.innerHTML = '<div class="font-bold text-base ' + color + '" style="margin-bottom:4px;">' + getItemFullName(it) + '</div>'
            + '<div class="text-slate-300" style="font-size:12px;line-height:1.5;">' + buildItemDescHTML(it) + '</div>';
        el.style.display = 'block';
        // 先顯示才量得到尺寸,再夾在視窗內(手指附近但不出畫面)
        var pad = 14, w = el.offsetWidth, h = el.offsetHeight;
        var left = x + pad, top = y - h - pad;
        if (left + w > window.innerWidth - 6) left = x - pad - w;
        if (top < 6) top = y + pad;
        if (top + h > window.innerHeight - 6) top = window.innerHeight - 6 - h;
        el.style.left = Math.max(4, left) + 'px';
        el.style.top = Math.max(4, top) + 'px';
        try { document.body.classList.add('afk-wh-lp'); } catch (e) {}   // 同時蓋掉核心的 hover 提示框(見 _lpInjectCSS)
        _lpGuardUntil = Date.now() + LP_CLICK_GUARD_MS;
    }

    function _lpClear() { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }

    function bindLongPress(host) {
        if (!_isTouch || !host || host.dataset.afkLp) return;
        _lpInjectCSS();
        host.dataset.afkLp = '1';   // 容器由核心重繪時整顆換掉,旗標跟著消失 → 不會重複綁

        host.addEventListener('touchstart', function (e) {
            _lpClear(); _lpHide();
            var t = e.touches && e.touches[0]; if (!t) return;
            var cell = e.target && e.target.closest ? e.target.closest('[data-tip-uid]') : null;
            if (!cell) return;
            _lpX = t.clientX; _lpY = t.clientY;
            _lpTimer = setTimeout(function () {
                _lpTimer = null;
                try { _lpShow(cell, _lpX, _lpY); } catch (err) {}
            }, LP_MS);
        }, { passive: true });

        // 不 preventDefault:清單要能垂直捲動,只用位移取消長按
        host.addEventListener('touchmove', function (e) {
            if (!_lpTimer) return;
            var t = e.touches && e.touches[0]; if (!t) return;
            if (Math.abs(t.clientX - _lpX) > LP_MOVE_TOL || Math.abs(t.clientY - _lpY) > LP_MOVE_TOL) _lpClear();
        }, { passive: true });

        host.addEventListener('touchend', _lpClear, { passive: true });
        host.addEventListener('touchcancel', function () { _lpClear(); }, { passive: true });
        host.addEventListener('scroll', function () { _lpClear(); _lpHide(); }, { passive: true });

        // 🚨 長按已顯示資料 → 攔掉隨後那次 click,否則看資料的同時東西就被存入/取出了。
        // capture 階段才擋得住格子上 inline 的 onclick;逾時自動失效,不影響一般短點擊。
        host.addEventListener('click', function (e) {
            if (!_lpGuardUntil || Date.now() > _lpGuardUntil) { _lpGuardUntil = 0; return; }
            _lpGuardUntil = 0;
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }, true);
    }

    if (_isTouch) {
        // 點畫面任一處 / 捲動任何祖先容器都收起
        document.addEventListener('touchstart', function (e) {
            if (!_lpTip || _lpTip.style.display === 'none') return;
            var inList = e.target && e.target.closest ? e.target.closest('#wh-inv-list,#wh-store-list') : null;
            if (!inList) _lpHide();
        }, true);
        // 戰鬥日誌自動捲到底也會打進這個 capture handler(每秒數次)→ 資料框沒開就早退,不做無條件 DOM 寫入
        document.addEventListener('scroll', function () {
            if (!_lpTip || _lpTip.style.display === 'none') return;
            _lpHide();
        }, { capture: true, passive: true });
    }

    // ── 「不可穿」列的樣式(核心兩欄只有物品全名,顏色只反映稀有度、跟能不能穿無關) ──
    function _wearCSS() {
        if (document.getElementById('afk-wh-wear-style')) return;
        var s = document.createElement('style'); s.id = 'afk-wh-wear-style';
        s.textContent = [
            // ⚠️ class 名刻意寫兩次(.afk-wh-noeq.afk-wh-noeq)不是筆誤,是拿掉「靠載入順序決勝」這個變數:
            //   1.8 皮膚在 css/style.css 有 `#interaction-content [class*="bg-slate-"]{background-color:#282730 !important}`,
            //   而倉庫每一列都帶 bg-slate-800 → 該選擇器是 1 id + 1 屬性,跟單寫一次 class 的
            //   `#wh-store-list .afk-wh-noeq` 權重完全相同。同權重時由「後載入者」勝,目前本外掛的 <style>
            //   是執行期才 append 到 head 尾端所以贏得了;但那是巧合,皮膚哪天改成執行期注入就會倒過來。
            //   重複 class 把權重墊高一級,先後順序就不影響結果。
            '#wh-inv-list .afk-wh-noeq.afk-wh-noeq,#wh-store-list .afk-wh-noeq.afk-wh-noeq{background:rgba(80,12,22,.55) !important;border-color:#9f1239 !important;border-left-width:4px !important;}',
            '#wh-inv-list .afk-wh-noeq.afk-wh-noeq:hover,#wh-store-list .afk-wh-noeq.afk-wh-noeq:hover{background:rgba(110,18,30,.7) !important;}',
            // 字樣與顏色跟背包那邊對齊(核心 js/10 是 text-red-500 text-[10px] font-bold 的 [無法裝備])
            '#wh-inv-list .afk-wh-noeq::after,#wh-store-list .afk-wh-noeq::after{content:"　[無法裝備]";font-size:10px;font-weight:bold;color:#ef4444;}',
            // 魔法書:無法學習＝同一套紅底(跟「無法裝備」是同一類「這隻用不了」,不該長得不一樣);
            //         已學習＝灰底壓暗(核心背包用 bg-slate-900 opacity-70,這裡用等效的底色,不動整列透明度以免圖示也一起糊掉)
            '#wh-inv-list .afk-wh-nolearn.afk-wh-nolearn,#wh-store-list .afk-wh-nolearn.afk-wh-nolearn{background:rgba(80,12,22,.55) !important;border-color:#9f1239 !important;border-left-width:4px !important;}',
            '#wh-inv-list .afk-wh-nolearn.afk-wh-nolearn:hover,#wh-store-list .afk-wh-nolearn.afk-wh-nolearn:hover{background:rgba(110,18,30,.7) !important;}',
            '#wh-inv-list .afk-wh-nolearn::after,#wh-store-list .afk-wh-nolearn::after{content:"　[無法學習]";font-size:10px;font-weight:bold;color:#ef4444;}',
            '#wh-inv-list .afk-wh-learned.afk-wh-learned,#wh-store-list .afk-wh-learned.afk-wh-learned{background:rgba(15,23,42,.85) !important;border-color:#475569 !important;border-left-width:4px !important;}',
            '#wh-inv-list .afk-wh-learned.afk-wh-learned:hover,#wh-store-list .afk-wh-learned.afk-wh-learned:hover{background:rgba(30,41,59,.9) !important;}',
            '#wh-inv-list .afk-wh-learned::after,#wh-store-list .afk-wh-learned::after{content:"　[已學習]";font-size:10px;font-weight:bold;color:#94a3b8;}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    }
    // 逐列反查實例 → 標「本職業穿不了」與魔法書的「已學習／無法學習」
    //   (「只列可穿」關掉時才看得到穿不了那些,開著時那些列本來就被濾掉了;魔法書不受該篩選影響)
    function _markNoEquip() {
        var w = loadWarehouse();
        [['wh-inv-list', (player && player.inv) || []], ['wh-store-list', (w && w.items) || []]].forEach(function (pair) {
            var host = document.getElementById(pair[0]); if (!host) return;
            host.querySelectorAll('[data-tip-uid]').forEach(function (el) {
                var uidv = el.getAttribute('data-tip-uid');
                var it = pair[1].find(function (i) { return i && String(i.uid) === String(uidv); });
                if (!it) return;
                if (_cannotWear(it.id)) el.classList.add('afk-wh-noeq');
                var st = _bookState(it.id);
                if (st === 'cant') el.classList.add('afk-wh-nolearn');
                else if (st === 'learned') el.classList.add('afk-wh-learned');
            });
        });
    }
    // ── 背包區塊可摺疊 ──────────────────────────────────────────
    // 手機版面下上游把兩個清單的限高解掉(css/style.css 手機 MQ 內
    // `#warehouse-window-content #wh-inv-list,#wh-store-list{max-height:none!important}`),
    // 兩份清單改成上下疊、整個視窗一起捲 → 背包 88 件就有 3,300px,要看倉庫得先滑過整個背包。
    // 摺起背包,倉庫才會直接出現在畫面上。
    //
    // 「現在是不是那個版面」直接問清單的 computed max-height,不看 body class 也不複製那條 media query:
    //   body.m-mobile 由可被玩家關掉的 afk-mobile 掛(關掉就判成桌機);複製 media query 則是上游改了
    //   我們這邊會安靜失效。max-height 有沒有被解掉,正是「會不會擋住倉庫」的直接成因。
    var LS_FOLD = 'afk_wh_invfold';
    function _foldRead() { try { return localStorage.getItem(LS_FOLD) === '1'; } catch (e) { return false; } }
    function _foldWrite(v) { try { localStorage.setItem(LS_FOLD, v ? '1' : '0'); } catch (e) {} }

    function _foldCSS() {
        if (document.getElementById('afk-wh-fold-style')) return;
        var s = document.createElement('style'); s.id = 'afk-wh-fold-style';
        // 藏「標題以外的所有兄弟」而不是只藏 #wh-inv-list:批次存取(afk-whbatch)會把它的工具列
        // insertBefore 到清單前面,而且它的注入時機不保證早於這裡 → 用 CSS 涵蓋整欄才不會漏掉後來才出現的。
        s.textContent = '.afk-wh-invfold > *:not(:first-child){display:none !important;}';
        (document.head || document.documentElement).appendChild(s);
    }

    // 摺疊時把標題後半的「(點擊存入 ▶)」換成灰色的「(已收起,點擊展開)」:
    //   ① 那句話在摺疊時是錯的指示 —— 清單都收起來了,根本沒東西可點。
    //   ② 狀態是記住的,下次開倉庫會直接看到「背包」與「倉庫」兩行標題疊在一起、背包底下空空的,
    //      不講清楚會被讀成「背包是空的」。
    //   ③ 我們的 ▶ 箭頭跟原標題結尾的「存入 ▶」同一個符號,一行兩個 ▶ 很難看出哪個是摺疊狀態。
    // 只換括號那段、名字沿用上游原字(不寫死「背包」),上游改字也跟著變。
    function _foldLabel(head, folded) {
        var lab = head.querySelector('.afk-wh-lab'); if (!lab) return;
        var orig = head.dataset.afkLabel || '';
        lab.textContent = '';
        if (!folded) { lab.textContent = orig; return; }
        var i = orig.indexOf('（');
        lab.appendChild(document.createTextNode(i > 0 ? orig.slice(0, i) : orig));
        var tag = document.createElement('span');
        tag.textContent = '（已收起，點擊展開）';
        tag.setAttribute('style', 'color:#94a3b8;font-weight:400;');
        lab.appendChild(tag);
    }

    function _foldApply(col, head, folded) {
        col.classList.toggle('afk-wh-invfold', folded);
        head.dataset.afkFold = folded ? '1' : '0';
        head.setAttribute('aria-expanded', folded ? 'false' : 'true');
        var caret = head.querySelector('.afk-wh-caret');
        if (caret) caret.textContent = folded ? '▶' : '▼';
        _foldLabel(head, folded);
    }

    function _injectInvFold() {
        var list = document.getElementById('wh-inv-list'); if (!list) return;
        if (getComputedStyle(list).maxHeight !== 'none') return;   // 清單本來就限高(桌機)→ 沒有擋住倉庫的問題
        var col = list.parentElement; if (!col) return;
        var head = col.firstElementChild;
        if (!head || head === list || head.querySelector('.afk-wh-caret')) return;
        _foldCSS();
        var caret = document.createElement('span');
        caret.className = 'afk-wh-caret';
        caret.style.cssText = 'display:inline-block;width:1em;';
        // 標題是純文字時才接手內容(重建成 caret+文字兩段);上游哪天在標題裡放了元素就只加箭頭,不動它
        if (!head.children.length) {
            head.dataset.afkLabel = (head.textContent || '').trim();
            head.textContent = '';
            var lab = document.createElement('span');
            lab.className = 'afk-wh-lab';
            head.appendChild(lab);
        }
        head.insertBefore(caret, head.firstChild);
        head.setAttribute('style', 'cursor:pointer;-webkit-user-select:none;user-select:none;padding:4px 0;');
        head.setAttribute('role', 'button');
        head.setAttribute('tabindex', '0');
        head.title = '摺疊／展開背包';
        head.addEventListener('click', function () {
            var next = head.dataset.afkFold !== '1';
            _foldWrite(next);
            _foldApply(col, head, next);
        });
        _foldApply(col, head, _foldRead());
    }

    // 分類列插入「只列可穿」勾選(核心每次重繪整塊 innerHTML → 每次重新插)
    function _injectWearToggle() {
        var sel = document.querySelector('select[onchange*="whSetFilter"]');
        if (!sel || document.getElementById('afk-wh-wearonly')) return;
        var searching = false;
        try { searching = (typeof _whSearchActive === 'function') && _whSearchActive(); } catch (e) {}
        if (!searching && _whFilter === 'item') return;   // 道具分類沒有可穿概念,不佔版面
        var lab = document.createElement('label');
        lab.className = 'flex items-center gap-1 text-sm cursor-pointer select-none whitespace-nowrap ' + (_wearOnly ? 'text-emerald-300' : 'text-slate-300');
        lab.title = '只列出本職業穿得上的裝備（判定同背包的「無法裝備」；道具、材料、寵物裝備不受影響）';
        lab.innerHTML = '<input type="checkbox" id="afk-wh-wearonly" class="w-4 h-4"' + (_wearOnly ? ' checked' : '') + '> 只列可穿';
        lab.querySelector('input').addEventListener('change', function () { window.__afkWhWearOnly(this.checked); });
        var sub = document.querySelector('select[onchange*="whSetSubFilter"]');
        var anchor = sub || sel;
        anchor.parentNode.insertBefore(lab, anchor.nextSibling);
    }

    // ── render 後處理:注入鈕/選項 + 遺骸套裝子分類過濾 ─────────────
    function afterRender() {
        try {
            bindLongPress(document.getElementById('wh-inv-list'));
            bindLongPress(document.getElementById('wh-store-list'));
        } catch (e) {}
        var inp = document.getElementById('wh-gold-amt');
        if (!inp) return;   // 倉庫面板不在畫面上
        try { _wearCSS(); _injectWearToggle(); _markNoEquip(); _injectInvFold(); } catch (e) {}
        var goldRow = inp.parentElement;
        if (goldRow && !document.getElementById('afk-wh-allin')) {
            var mk = function (id, txt, tip, dir, style) {
                var b = document.createElement('button');
                b.id = id; b.type = 'button'; b.textContent = txt;
                b.title = tip; b.setAttribute('aria-label', tip);
                b.className = 'btn px-2 text-sm font-bold h-8 inline-flex items-center justify-center';
                b.setAttribute('style', style);
                b.addEventListener('click', function () { window.__afkWhGoldAll(dir); });
                return b;
            };
            // 圖示鈕(文字太佔位);沿用核心存入/取出鈕的配色,一眼看得出同組
            goldRow.appendChild(mk('afk-wh-allin', '📥', '金幣全部存入', 'in', 'background: linear-gradient(135deg, #0c4a5e 0%, #0e7490 28%, #0a3d4d 52%, #11657e 76%, #093440 100%); color: #a5f3fc; border-color: #0891b2;'));
            goldRow.appendChild(mk('afk-wh-allout', '📤', '金幣全部取出', 'out', 'background: linear-gradient(135deg, #6b2a10 0%, #b3490e 28%, #5a230e 52%, #9a3e0c 76%, #4a1d0c 100%); color: #fed7aa; border-color: #c2410c;'));
        }
        // 主分類下拉補 遺物/席琳遺骸(核心每次重繪都重建 select → 每次補)
        var sel = document.querySelector('select[onchange*="whSetFilter"]');
        if (sel && !sel.querySelector('option[value="relic"]')) {
            [['relic', '遺物'], ['remains', '席琳遺骸']].forEach(function (o) {
                var op = document.createElement('option');
                op.value = o[0]; op.textContent = o[1];
                sel.appendChild(op);
            });
        }
        if (sel && (_whFilter === 'relic' || _whFilter === 'remains')) sel.value = _whFilter;
        // 席琳遺骸+選了套裝名:依清單列 uid 反查實例 seteff 過濾(核心 whMatchFilter 只吃 id 看不到詞綴)
        if (_whFilter === 'remains' && _whSubFilter) {
            var w = loadWarehouse();
            var lists = [['wh-inv-list', (player && player.inv) || []], ['wh-store-list', (w && w.items) || []]];
            lists.forEach(function (pair) {
                var host = document.getElementById(pair[0]); if (!host) return;
                host.querySelectorAll('[data-tip-uid]').forEach(function (el) {
                    var uidv = el.getAttribute('data-tip-uid');
                    var it = pair[1].find(function (i) { return i && String(i.uid) === String(uidv); });
                    var g = it && it.seteff ? String(it.seteff).slice(0, 2) : '';
                    if (g !== String(_whSubFilter).slice(0, 2)) el.style.display = 'none';
                });
            });
        }
    }
    var _render = window.renderWarehouseNPC;
    window.renderWarehouseNPC = function () {
        // 📌 捲動保底:手機 PWA 上核心的「innerHTML 重繪→立刻恢復 scrollTop」會偏移(iOS 在版面
        //   還沒重算時設 scrollTop 可能被舊高度鉗制/錨定,玩家回報捲下去後每存一次往上跳一格),
        //   且本外掛 afterRender 又在核心恢復之後才補注入金幣鈕。這裡在「重繪+補注入都完成」後
        //   再恢復一次,並用 rAF 於版面計算完成後補一發。
        var c0 = document.getElementById('warehouse-window-content');
        var s0 = c0 ? c0.scrollTop : 0;
        var r = _render.apply(this, arguments);
        try { afterRender(); } catch (e) {}
        try {
            var c1 = document.getElementById('warehouse-window-content');
            if (c1 && s0 > 0) { c1.scrollTop = s0; requestAnimationFrame(function () { c1.scrollTop = s0; }); }
        } catch (e) {}
        return r;
    };

    try { console.log('[AFK-warehouse] hooks OK — 倉庫擴充(金幣全存取/遺物/席琳遺骸分類/只列可穿)已啟用。'); } catch (e) {}
})();
