/* ============================================================================
 * afk-touchtip.js — 手機長按看資料(技能/商店/製作/收集冊/背包)
 *
 * 為什麼:核心的資料提示框(.game-tooltip)是純 hover 型——js/14 在 document 上委派
 *   mousemove,靠 e.target.closest('.tip-host') 決定要顯示誰。手機沒有 hover:
 *     - Android Chrome 手指放開後會補送一組假滑鼠事件 → 那框「碰巧」會跳一下;
 *     - iOS Safari 對 <button> 不補這組事件 → 技能格之類根本看不到任何資料。
 *   更糟的是有些格子的 click 是「會產生後果」的(技能格直接 manualCast 把技能放出去、
 *   快速強化/廢品勾選模式下點整列就勾選),玩家想看資料就得先付出代價。
 *
 * 行為:在 document 上做一次長按委派(capture 階段 touchstart),按住 .tip-host 約 400ms 後
 *   **不自建資料框**,而是直接朝該元素派一個合成的 mousemove,讓核心自己算內容、自己定位
 *   .game-tooltip。好處:技能/實例物品/收集冊/製作/商店五種內容格式全部自動吃到(內容產生器
 *   buildSkillTipHTML / buildItemTipHTML 關在 js/14 的 IIFE 裡,外掛本來就拿不到),而且畫面上
 *   永遠只有核心那一顆框,天生不會有雙框(Android 補送的假事件只是再更新同一顆)。
 *   收起=朝 document.body 派一次 mousemove(目標不是 tip-host → 核心自己 hideTip)。
 *
 * 🚨 長按觸發後要攔掉隨後那次 click/mousedown/mouseup:否則長按技能格會把技能放出去、
 *   長按勾選列會誤勾;而核心的 `document mousedown → hideTip` 會在手指放開的瞬間
 *   把剛顯示的框收掉(Android 補送事件順序 mousemove→mousedown→…)。攔截用時戳窗,
 *   逾時自動失效,一般短點擊完全不受影響。
 *
 * 不含倉庫:#wh-inv-list / #wh-store-list 由 afk-warehouse.js 自己那套長按處理(它自建
 *   資料框、有自己的 click guard,已上線驗過)。兩套同時作用在同一格會互踩(它顯示自製框時
 *   會加 body.afk-wh-lp 把核心 .game-tooltip 用 !important 蓋掉),故本檔明確排除那兩個容器。
 *
 * 🏷️ 第二條路:原生 title 屬性(2026-08-02 加)
 *   遊戲有一批說明不是走 .tip-host,而是直接寫在元素的 `title=`——瀏覽器只在**滑鼠停留**時
 *   顯示,手機完全看不到。最有感的是威頓村「漢」的**精通選擇**:四個「道」的說明全在 title 裡,
 *   手機玩家等於是在沒有說明的情況下做一個要花錢才能改的決定(玩家回報)。
 *   這條沒有核心框可借(核心只會畫 .tip-host 那種),所以自己畫一個小框,內容就是 title 純文字。
 *   兩條路互斥:先找 .tip-host,沒有才找 title,畫面上永遠只有一個框。
 *
 * 優雅降級:非觸控裝置直接不啟用;長按後核心沒把框叫出來就什麼都不做(也不攔 click),
 *   任何一步失敗都不影響遊戲原本操作。
 * ========================================================================== */
(function () {
    'use strict';

    // 先登錄再問開關:關掉時本檔提早 return,但面板仍列得出這一項(玩家才有辦法開回來)
    if (window.AFK_TOGGLES) {
        AFK_TOGGLES.register({
            id: 'touchtip', name: '手機長按看資料', group: '遊戲介面', def: true,
            desc: '手機長按技能、商品、背包物品就能看說明（僅手機）'
        });
        if (!AFK_TOGGLES.enabled('touchtip')) return;
    }

    var LP_MS = 400;              // 長按判定時間
    var LP_MOVE_TOL = 10;         // 位移超過此值視為捲動,取消長按
    var LP_GUARD_MS = 900;        // 長按觸發後在此時間內攔掉滑鼠事件(擋誤觸 + 擋核心 mousedown 把框收掉)
    var HOST_SEL = '.tip-host';
    var EXCLUDE_SEL = '#wh-inv-list,#wh-store-list';   // 倉庫兩清單由 afk-warehouse.js 自理(見檔頭)
    var TIP_SEL = '.game-tooltip';

    var isTouch = (function () {
        try {
            return ('ontouchstart' in window)
                || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
        } catch (e) { return false; }
    })();
    if (!isTouch) return;   // 桌機本來就有 hover,不需要也不該掛

    if (typeof window.MouseEvent !== 'function') {
        console.warn('[AFK-touchtip] 環境不支援合成 MouseEvent,長按看資料已停用。');
        return;
    }

    var timer = null, sx = 0, sy = 0, guardUntil = 0, pressEl = null;

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } pressEl = null; }

    function fireMouseMove(target, x, y) {
        try {
            target.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, cancelable: true, view: window, clientX: x, clientY: y
            }));
        } catch (e) {}
    }

    // 「我們叫出過框」的旗標:捲動/觸控事件量很大,不能每次都去查 DOM。
    //   沒叫過就一定不用收(核心自己 hover 叫出來的由核心自己收),直接早退。
    var shown = false;
    var _tipEl = null;
    function tipVisible() {
        try {
            if (!_tipEl || !_tipEl.isConnected) _tipEl = document.querySelector(TIP_SEL);
            var el = _tipEl;
            return !!(el && el.style.display !== 'none' && el.offsetWidth > 0);
        } catch (e) { return false; }
    }

    function hideTip() {
        shown = false;
        if (!document.body) return;
        fireMouseMove(document.body, 0, 0);   // 目標不是 tip-host → 核心委派自己收框
    }

    function show(host, x, y) {
        timer = null;
        fireMouseMove(host, x, y);
        // 核心沒把框叫出來(資料查不到/條件不符)就當作沒發生:不攔 click,讓該格原本的操作照常
        if (tipVisible()) { shown = true; guardUntil = Date.now() + LP_GUARD_MS; }
    }

    // ── 原生 title 的那條路(見檔頭「第二條路」)──────────────────────────
    var titleBox = null;
    function ensureTitleBox() {
        if (titleBox && titleBox.isConnected) return titleBox;
        titleBox = document.createElement('div');
        titleBox.id = 'afk-tt-title';
        // 外觀比照核心 .game-tooltip(css/style.css),讓兩條路長得一樣
        titleBox.style.cssText = 'position:fixed;z-index:80;max-width:min(280px,86vw);display:none;pointer-events:none;'
            + 'background:#26252d;color:#e5e1dc;border:1px solid #8d6846;border-radius:8px;padding:10px 12px;'
            + 'font-size:13px;line-height:1.5;box-shadow:0 12px 30px rgba(0,0,0,.78),inset 0 0 0 1px #141318;';
        document.body.appendChild(titleBox);
        return titleBox;
    }
    // 頂端不可壓到非官方橫幅(它 z-index 是 int 上限,壓不過;貼上去只會被蓋住看不到)
    function topLimit() {
        try {
            var bar = document.getElementById('_orig_pbar');
            if (bar) { var r = bar.getBoundingClientRect(); if (r.height > 0) return r.bottom + 4; }
        } catch (e) {}
        return 4;
    }
    function showTitle(el, text, x, y) {
        timer = null;
        var box = ensureTitleBox();
        box.textContent = text;
        box.style.display = 'block';
        var w = box.offsetWidth, h = box.offsetHeight;
        var left = Math.max(4, Math.min(x - w / 2, window.innerWidth - w - 4));
        var top = y + 18;                                    // 預設放手指下方
        if (top + h > window.innerHeight - 4) top = y - h - 18;   // 下方放不下就翻到上方
        box.style.left = left + 'px';
        box.style.top = Math.max(topLimit(), top) + 'px';
        titleShown = true;
        guardUntil = Date.now() + LP_GUARD_MS;
    }
    var titleShown = false;
    function hideTitle() {
        titleShown = false;
        if (titleBox) titleBox.style.display = 'none';
    }

    function injectCSS() {
        if (document.getElementById('afk-touchtip-style')) return;
        var s = document.createElement('style');
        s.id = 'afk-touchtip-style';
        // iOS Safari 長按會跳原生「拷貝/查詢」callout 蓋住資料框,並把圖示/文字選起來
        //   帶 title 的元素同理(那條路也是長按才看得到);只擋 callout 與圖片拖曳,不動一般文字的選取。
        //   ⚠️ 一定要連 `[title] img` 一起擋:狀態圖示是 `<div title><img></div>`,長按時跳出來的
        //     「下載圖片/拷貝圖片」選單是**圖片**發出來的,只擋外層那個 div 沒有用(玩家回報)。
        s.textContent = HOST_SEL + '{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}'
            + '[title]{-webkit-touch-callout:none;}'
            + '[title] img{-webkit-touch-callout:none;-webkit-user-drag:none;user-select:none;}';
        (document.head || document.documentElement).appendChild(s);
    }

    document.addEventListener('touchstart', function (e) {
        clearTimer();
        // 新的一次觸控開始 → 上一次長按的攔截窗結束。要攔的假滑鼠事件是長按放開後「馬上」補送的,
        //   中間不會夾新的 touchstart;不清掉的話長按看完資料後 0.9 秒內想點別的鈕會被整個吃掉。
        guardUntil = 0;
        if (shown && tipVisible()) hideTip();   // 再按一下畫面任一處就收起(只收我們自己叫出來的)
        if (titleShown) hideTitle();
        var t = e.touches && e.touches[0];
        if (!t) return;
        if (!e.target || !e.target.closest) return;
        sx = t.clientX; sy = t.clientY;
        var host = e.target.closest(HOST_SEL);
        if (host && !host.closest(EXCLUDE_SEL)) {
            pressEl = host;
            timer = setTimeout(function () { show(host, sx, sy); }, LP_MS);
            return;
        }
        // 沒有 .tip-host → 找原生 title(精通四個「道」的說明就在這裡)
        var tEl = e.target.closest('[title]');
        if (!tEl || tEl.closest(EXCLUDE_SEL)) return;
        var txt = (tEl.getAttribute('title') || '').trim();
        if (!txt) return;
        pressEl = tEl;
        timer = setTimeout(function () { showTitle(tEl, txt, sx, sy); }, LP_MS);
    }, { passive: true, capture: true });   // 不 preventDefault → 標 passive,不拖累捲動

    document.addEventListener('touchmove', function (e) {
        if (!timer) return;
        var t = e.touches && e.touches[0];
        if (!t) return;
        if (Math.abs(t.clientX - sx) > LP_MOVE_TOL || Math.abs(t.clientY - sy) > LP_MOVE_TOL) clearTimer();
    }, { passive: true, capture: true });

    document.addEventListener('touchend', clearTimer, { passive: true, capture: true });
    document.addEventListener('touchcancel', clearTimer, { passive: true, capture: true });
    // 捲動時收掉「已經顯示的」框(內容在框底下跑掉了);scroll 不冒泡,要用 capture 才收得到。
    // ⚠ 捲動事件量很大:先看便宜的旗標,沒叫出過框就什麼都不做,不要每次都查 DOM。
    // 🚨 **不可無條件取消「還在按著的長按」**:戰鬥中系統日誌每寫一行就自動捲到底(#sys-log 會發
    //    scroll 事件),那不是玩家在捲 —— 無條件清掉會讓長按看說明在戰鬥中隨機失敗(玩家回報
    //    「有時候按了沒反應」)。手指真的移動有 touchmove 會擋,這裡只在「捲的那個容器就包著
    //    你按住的東西」時才取消(＝手指底下的東西真的位移了)。
    document.addEventListener('scroll', function (e) {
        if (timer && pressEl && e.target && e.target.contains && e.target.contains(pressEl)) clearTimer();
        if (shown && tipVisible()) hideTip();
        if (titleShown) hideTitle();
    }, { passive: true, capture: true });

    // 🚨 長按已顯示資料 → 攔掉隨後那組滑鼠事件(見檔頭)。capture 階段掛在 document,
    //    才擋得住格子上 inline 的 onclick(事件根本到不了目標)。
    function guard(e) {
        if (!guardUntil) return;
        if (Date.now() > guardUntil) { guardUntil = 0; return; }
        if (e.type === 'click') guardUntil = 0;   // 一次點擊只擋一次,之後恢復正常
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    document.addEventListener('mousedown', guard, true);
    document.addEventListener('mouseup', guard, true);
    document.addEventListener('click', guard, true);

    // 🚨 長按我們接手的元素時,擋掉瀏覽器自己的長按選單(Android Chrome 的「下載圖片/拷貝圖片」、
    //    iOS 的分享選單)。CSS 的 -webkit-touch-callout 只有 iOS 吃,Android 一定要攔 contextmenu。
    //    只攔「我們真的會顯示說明」的那些元素,其餘(例如想長按複製文字)完全不動。
    //    本檔在非觸控裝置已提早 return,所以桌機的右鍵選單不受影響。
    document.addEventListener('contextmenu', function (e) {
        if (!e.target || !e.target.closest) return;
        if (e.target.closest(HOST_SEL + ',[title]')) e.preventDefault();
    }, true);

    injectCSS();
    console.log('[AFK-touchtip] hooks OK — 長按 .tip-host 顯示原版資料框、長按帶 title 的元素顯示其說明(倉庫清單除外,由 afk-warehouse 自理)。');
})();
