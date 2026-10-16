/* ============================================================================
 * afk-junkmgr.js — 廢品標記管理（自動化分頁「🔌 外掛」列，木人場按鈕下方）
 *
 * 為什麼需要：玩家標一件廢品時，core 的 toggleJunk 會把該物品的完整簽章寫進 player.junkPrefs，
 *   之後**掉到同樣的東西就自動標成廢品**（js/08 gainItem）。這份名單是隱形的——遊戲內看不到、
 *   也刪不掉（只能等它再掉出來、手動取消那一件），誤標過一次就會一直被靜靜標記賣掉。
 *   本外掛就是那份名單的檢視／搜尋／刪除介面，外加一鍵全清。
 *
 * 清單＝player.junkPrefs，一列＝一種標記（itemSig 完整簽章：同 id 但強化值／祝福／遠古／屬性
 *   不同者各自一列）。刪除一列＝刪記憶＋把背包內同簽章的廢品標記一起取消，與 core toggleJunk
 *   的「取消標記」等價，含規則標記的豁免處理（_ruleJunk → _userKeep）。
 *
 * ⚠ 刻意不列「自動販賣規則標記的物品」（_ruleJunk，只寫 i.junk、不寫 junkPrefs）：那是規則的產物，
 *   在這裡刪掉下一輪又會被 applyAutoSellRules 重標，看起來像刪不掉；要停那些請改規則本身。
 *
 * 效能：標記可能上千筆 → 清單走虛擬捲動（只建視窗內約 20 列 DOM）、搜尋 debounce、
 *   名稱 HTML 依簽章快取（同一簽章只算一次 getItemFullName）。
 * 不跳動：刪除後不重設捲動位置——記住視窗頂端「存活下來的那一列」，重建後把它捲回原本的位置。
 * 橫幅：彈窗自己讓開非官方轉載橫幅（top/max-height 吃 --orig-bar-h，開啟當下先 AFK_BANNER.remeasure()）。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-junkmgr.js">。缺核心函式 → warn 後安靜停用。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('junkmgr')) return;

  var ROW_H = 46;      // 列高固定＝虛擬捲動的前提（名稱單行、超出以 … 收尾）
  var OVERSCAN = 6;    // 視窗上下各多畫幾列，快速滑動時不會露白
  var TYPE_ORDER = { wpn: 0, arm: 1, acc: 2 };

  var rows = [];       // 全部標記（已排序）：{ sig, html, plain, icon }
  var view = [];       // 目前搜尋條件下顯示的子集（rows 的參照）
  var sel = Object.create(null);   // 已勾選的簽章
  var nameCache = Object.create(null);   // sig → { html, plain, icon, order }（名稱不會變，跨重建共用）
  var lastStart = -1, lastEnd = -1, rafPend = false, searchTimer = 0, layer = null;

  // ⚠ DB 是 `const DB`(全域語彙環境),不是 window 屬性 → 只能用裸識別字判斷,不可寫 window.DB
  function ready() {
    return ['itemSig', 'getItemFullName', 'getIconUrl', 'renderTabs'].every(function (n) { return typeof window[n] === 'function'; })
      && typeof DB !== 'undefined' && !!DB.items;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function loaded() { try { return !!(player && player.cls); } catch (e) { return false; } }   // player 同 DB：`let player`，不是 window 屬性

  // ---- 簽章 → 假物件（讓 core 的 getItemFullName/getIconUrl 直接吃）-------
  //   itemSig 格式：id|en|bless(0/B/C)|anc(0/A/字串)|attr|seteff[|attrMagic[@星]]
  function sigToItem(sig) {
    var p = String(sig).split('|');
    var it = { id: p[0], en: Number(p[1]) || 0, cnt: 1 };
    if (p[2] === 'B') it.bless = true; else if (p[2] === 'C') it.bless = 'cursed';
    if (p[3] === 'A') it.anc = true; else if (p[3] && p[3] !== '0') it.anc = p[3];
    if (p[4]) it.attr = p[4];
    if (p[5]) it.seteff = p[5];
    if (p[6]) {
      var am = p[6].split('@');
      it.attrMagic = am[0];
      it.attrMagicStar = Number(am[1]) || 1;
    }
    return it;
  }

  function infoOf(sig) {
    var c = nameCache[sig];
    if (c) return c;
    var it = sigToItem(sig);
    var d = DB.items[it.id];
    var html, plain;
    try { html = getItemFullName(it); } catch (e) { html = ''; }
    if (!d || !html) {   // 上游移除過的舊物品：仍列出來讓玩家清得掉
      html = '<span class="m-junk-unknown">未知的物品（' + esc(it.id) + '）</span>';
      plain = '未知的物品 ' + it.id;
    } else {
      plain = html.replace(/<[^>]*>/g, '');
    }
    var icon = '';
    try { icon = d ? getIconUrl(d) : ''; } catch (e) {}
    c = nameCache[sig] = {
      html: html,
      plain: (plain + ' ' + it.id).toLowerCase(),
      icon: icon,
      order: [(d && TYPE_ORDER[d.type] != null) ? TYPE_ORDER[d.type] : 3, (d && d.n) || it.id, it.en]
    };
    return c;
  }

  // ---- 資料重建（O(標記數)）-----------------------------------------------
  function rebuild() {
    var prefs = (player.junkPrefs = player.junkPrefs || {});
    var seen = Object.create(null);
    rows = [];
    Object.keys(prefs).forEach(function (s) {
      if (!prefs[s] || seen[s]) return;
      seen[s] = 1;
      rows.push({ sig: s });
    });
    rows.forEach(function (r) {
      var c = infoOf(r.sig);
      r.html = c.html; r.plain = c.plain; r.icon = c.icon; r.order = c.order;
    });
    rows.sort(function (a, b) {
      if (a.order[0] !== b.order[0]) return a.order[0] - b.order[0];
      if (a.order[1] !== b.order[1]) return String(a.order[1]).localeCompare(String(b.order[1]), 'zh-Hant');
      return a.order[2] - b.order[2];
    });
    for (var k in sel) if (!seen[k]) delete sel[k];   // 已不存在的簽章不留在勾選集
    applyFilter();
  }

  function applyFilter() {
    var q = (document.getElementById('m-junk-search') || {}).value || '';
    q = q.trim().toLowerCase();
    view = q ? rows.filter(function (r) { return r.plain.indexOf(q) >= 0; }) : rows.slice();
  }

  // ---- 虛擬捲動 -----------------------------------------------------------
  function renderWindow(force) {
    var list = document.getElementById('m-junk-list');
    var vp = document.getElementById('m-junk-view');
    if (!list || !vp) return;
    var total = view.length;
    if (!total) {
      list.style.height = 'auto';
      list.innerHTML = '<div class="m-junk-empty">' + (rows.length ? '沒有符合搜尋的標記。' : '目前沒有任何廢品標記。') + '</div>';
      lastStart = lastEnd = -1;
      return;
    }
    list.style.height = (total * ROW_H) + 'px';
    var start = Math.max(0, Math.floor(vp.scrollTop / ROW_H) - OVERSCAN);
    var end = Math.min(total, Math.ceil((vp.scrollTop + vp.clientHeight) / ROW_H) + OVERSCAN);
    if (!force && start === lastStart && end === lastEnd) return;
    lastStart = start; lastEnd = end;
    var h = '';
    for (var i = start; i < end; i++) {
      var r = view[i];
      h += '<div class="m-junk-row' + (sel[r.sig] ? ' on' : '') + '" data-i="' + i + '" style="top:' + (i * ROW_H) + 'px">'
        + '<span class="m-junk-cb"></span>'
        + (r.icon ? '<img class="m-junk-ic" src="' + esc(r.icon) + '" onerror="this.style.visibility=\'hidden\'">' : '<span class="m-junk-ic"></span>')
        + '<span class="m-junk-nm">' + r.html + '</span>'
        + '</div>';
    }
    list.innerHTML = h;
  }

  function selCount() { var n = 0; for (var k in sel) n++; return n; }

  function refreshCounts() {
    var sub = document.getElementById('m-junk-sub');
    if (sub) sub.textContent = '共 ' + rows.length + ' 種標記' + (view.length !== rows.length ? '（顯示 ' + view.length + ' 種）' : '') + '・已選 ' + selCount() + ' 種';
    var del = document.getElementById('m-junk-del');
    if (del) { var n = selCount(); del.disabled = !n; del.textContent = n ? ('🗑️ 刪除選取（' + n + '）') : '🗑️ 刪除選取'; }
  }

  // ---- 刪除（記憶＋背包標記一起清）----------------------------------------
  //   與 core toggleJunk 的「取消標記」等價：規則標記的物品要記玩家意圖（_userKeep），
  //   否則 applyAutoSellRules 下一輪又把它標回廢品。
  function unmarkSigs(sigMap) {
    var prefs = (player.junkPrefs = player.junkPrefs || {});
    for (var k in sigMap) delete prefs[k];
    (player.inv || []).forEach(function (i) {
      if (!i.junk || !sigMap[itemSig(i)]) return;
      i.junk = false;
      if (i._ruleJunk) { i._userKeep = true; i._ruleJunk = false; delete i.junkSince; delete i._autoSellQty; }
    });
  }

  function commit(msg) {
    try { if (typeof saveGame === 'function' && loaded()) saveGame(); } catch (e) {}
    try { renderTabs(true); } catch (e) {}
    if (msg && typeof logSys === 'function') logSys('<span class="text-amber-300">' + msg + '</span>');
  }

  // 刪除後維持捲動位置：記住視窗頂端第一列「不會被刪掉」的簽章，重建後把它捲回同一個位置。
  function deleteSelected() {
    var n = selCount();
    if (!n) return;
    var vp = document.getElementById('m-junk-view');
    var top = vp ? vp.scrollTop : 0;
    var firstIdx = Math.floor(top / ROW_H), delta = top - firstIdx * ROW_H, anchor = null;
    for (var i = firstIdx; i < view.length; i++) { if (!sel[view[i].sig]) { anchor = view[i].sig; break; } }
    var doomed = sel;
    sel = Object.create(null);
    unmarkSigs(doomed);
    rebuild();
    if (vp) {
      var ni = -1;
      if (anchor) for (var j = 0; j < view.length; j++) if (view[j].sig === anchor) { ni = j; break; }
      var want = (ni >= 0) ? (ni * ROW_H + delta) : top;
      vp.scrollTop = Math.max(0, Math.min(want, Math.max(0, view.length * ROW_H - vp.clientHeight)));
    }
    renderWindow(true);
    refreshCounts();
    commit('已刪除 ' + n + ' 種廢品標記（含背包內同款物品的標記）。');
  }

  function clearAll() {
    if (!rows.length) { alert('目前沒有任何廢品標記。'); return; }
    var n = rows.length;
    AFK_UI.confirm({
      title: '清除全部廢品標記',
      message: '將取消全部 ' + n + ' 種廢品標記，以後掉到這些東西不會再自動標成廢品；背包裡同款的廢品標記也會一起取消。\n\n此動作無法復原，要繼續嗎？',
      okText: '全部清除', danger: true,
      onOk: function () {
        var all = Object.create(null);
        rows.forEach(function (r) { all[r.sig] = 1; });
        sel = Object.create(null);
        unmarkSigs(all);
        var vp = document.getElementById('m-junk-view');
        if (vp) vp.scrollTop = 0;
        rebuild();
        renderWindow(true);
        refreshCounts();
        commit('已清除全部 ' + n + ' 種廢品標記。');
      }
    });
  }

  // ---- 彈窗 ---------------------------------------------------------------
  function build() {
    var m = document.createElement('div');
    m.id = 'm-junk-modal';
    m.innerHTML =
      '<div class="m-junk-box">' +
        '<div class="m-junk-head">🗑️ 廢品標記管理<button id="m-junk-x" type="button">✕</button></div>' +
        '<div class="m-junk-tools">' +
          '<input id="m-junk-search" type="search" placeholder="搜尋名稱…" autocomplete="off">' +
          '<button id="m-junk-selall" class="m-junk-btn" type="button">全選</button>' +
          '<button id="m-junk-selnone" class="m-junk-btn" type="button">取消選取</button>' +
        '</div>' +
        '<div id="m-junk-sub" class="m-junk-sub"></div>' +
        '<div id="m-junk-view"><div id="m-junk-list"></div></div>' +
        '<div class="m-junk-foot">' +
          '<button id="m-junk-clearall" class="m-junk-btn m-junk-btn-red" type="button">🧹 清除全部標記</button>' +
          '<button id="m-junk-del" class="m-junk-btn m-junk-btn-red" type="button" disabled>🗑️ 刪除選取</button>' +
          '<button id="m-junk-close" class="m-junk-btn" type="button">關閉</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);

    m.addEventListener('click', function (e) { if (e.target === m) close(); });   // 點背景關閉
    document.getElementById('m-junk-x').addEventListener('click', close);
    document.getElementById('m-junk-close').addEventListener('click', close);
    document.getElementById('m-junk-del').addEventListener('click', deleteSelected);
    document.getElementById('m-junk-clearall').addEventListener('click', clearAll);

    document.getElementById('m-junk-selall').addEventListener('click', function () {
      view.forEach(function (r) { sel[r.sig] = 1; });
      renderWindow(true); refreshCounts();
    });
    document.getElementById('m-junk-selnone').addEventListener('click', function () {
      sel = Object.create(null);
      renderWindow(true); refreshCounts();
    });

    var s = document.getElementById('m-junk-search');
    s.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var vp = document.getElementById('m-junk-view');
        if (vp) vp.scrollTop = 0;   // 換搜尋條件＝換一份清單，回到頂端（不是「刪除後跳動」那種非預期位移）
        applyFilter();
        renderWindow(true);
        refreshCounts();
      }, 150);
    });

    // 整列可點＝切換勾選（委派，不逐列掛 listener；只改自己那列的 class → 不重排、不跳動）
    var listEl = document.getElementById('m-junk-list');
    listEl.addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('.m-junk-row') : null;
      if (!row) return;
      var r = view[+row.dataset.i];
      if (!r) return;
      if (sel[r.sig]) { delete sel[r.sig]; row.classList.remove('on'); }
      else { sel[r.sig] = 1; row.classList.add('on'); }
      refreshCounts();
    });

    document.getElementById('m-junk-view').addEventListener('scroll', function () {
      if (rafPend) return;
      rafPend = true;
      requestAnimationFrame(function () { rafPend = false; renderWindow(false); });
    }, { passive: true });

    window.addEventListener('resize', function () { if (isOpen()) renderWindow(true); });
  }

  function isOpen() { var m = document.getElementById('m-junk-modal'); return !!m && m.style.display === 'flex'; }

  function open() {
    if (!loaded()) { alert('請先載入角色，再管理廢品標記。'); return; }
    if (!document.getElementById('m-junk-modal')) build();
    try { if (window.AFK_BANNER) AFK_BANNER.remeasure(); } catch (e) {}   // 開啟當下重量橫幅 → --orig-bar-h 一定是最新的
    sel = Object.create(null);
    var s = document.getElementById('m-junk-search'); if (s) s.value = '';
    var vp = document.getElementById('m-junk-view'); if (vp) vp.scrollTop = 0;
    rebuild();
    document.getElementById('m-junk-modal').style.display = 'flex';
    lastStart = lastEnd = -1;
    renderWindow(true);
    refreshCounts();
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;   // 手機返回鍵 / ESC 可關
  }
  function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose(); }
  function doClose() {
    layer = null;
    var m = document.getElementById('m-junk-modal');
    if (m) m.style.display = 'none';
  }

  // ---- 入口：自動化面板「🔌 外掛」列，木人場按鈕下方 ----------------------
  function injectAutoNav() {
    var panel = document.getElementById('tab-automation');
    if (!panel) return false;
    if (document.getElementById('m-afk-nav-junkmgr')) return true;
    var row = document.getElementById('m-afk-navrow');
    if (!row) {   // 木人場/查詢外掛都被關掉時這列還不存在 → 自己建（欄位與 afk-training 一致）
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      panel.appendChild(row);
    }
    var b = document.createElement('button');
    b.id = 'm-afk-nav-junkmgr'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%';
    b.style.marginTop = '8px';
    b.textContent = '🗑️ 廢品標記管理';
    b.addEventListener('click', open);
    var train = document.getElementById('m-afk-nav-train');
    if (train) train.insertAdjacentElement('afterend', b);   // 指定排在木人場下方（不靠載入順序）
    else row.appendChild(b);
    return true;
  }

  function injectCss() {
    if (document.getElementById('m-junk-css')) return;
    var st = document.createElement('style');
    st.id = 'm-junk-css';
    st.textContent = [
      /* 讓開非官方轉載橫幅：整個 overlay 從橫幅底下開始，卡片高度也跟著扣掉 */
      /* z-index 9800：要壓過手機底部導覽列(9600)與浮動日誌(9500)，否則手機上彈窗下半截被它們蓋住；
         仍低於 AFK_UI 的 alert/confirm(10000/10001)，「清除全部」的確認框才會疊在本視窗之上 */
      '#m-junk-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9800;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:14px;}',
      '.m-junk-box{width:100%;max-width:560px;max-height:calc((100dvh - var(--orig-bar-h,0px)) * .9);display:flex;flex-direction:column;overflow:hidden;background:#0f172a;border:1px solid #475569;border-radius:12px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
      '.m-junk-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;font-size:16px;font-weight:bold;color:#fbbf24;border-bottom:1px solid #334155;}',
      '.m-junk-head button{background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:0 4px;}',
      '.m-junk-tools{flex:none;display:flex;gap:6px;padding:10px 14px 6px;}',
      '#m-junk-search{flex:1;min-width:0;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#e2e8f0;padding:7px 9px;font-size:13px;outline:none;font-family:inherit;}',
      '#m-junk-search:focus{border-color:#d97706;}',
      '.m-junk-sub{flex:none;padding:4px 14px 8px;font-size:12px;color:#64748b;}',
      '#m-junk-view{flex:1;min-height:120px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;border-top:1px solid #1e293b;border-bottom:1px solid #1e293b;background:#0b1220;}',
      '#m-junk-list{position:relative;width:100%;}',
      '.m-junk-row{position:absolute;left:0;right:0;height:' + ROW_H + 'px;display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box;border-bottom:1px solid #1e293b;cursor:pointer;user-select:none;-webkit-user-select:none;}',
      '.m-junk-row:hover{background:#152034;}',
      '.m-junk-row.on{background:#3b2a08;}',
      '.m-junk-cb{flex:none;width:17px;height:17px;border:1px solid #64748b;border-radius:4px;background:#0f172a;position:relative;}',
      '.m-junk-row.on .m-junk-cb{background:#b45309;border-color:#d97706;}',
      '.m-junk-row.on .m-junk-cb::after{content:"✓";position:absolute;left:2px;top:-2px;font-size:14px;color:#fff;font-weight:bold;}',
      '.m-junk-ic{flex:none;width:24px;height:24px;object-fit:contain;}',
      '.m-junk-nm{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.m-junk-unknown{color:#94a3b8;font-style:italic;}',
      '.m-junk-empty{padding:26px 14px;text-align:center;color:#64748b;font-size:13px;}',
      '.m-junk-foot{flex:none;display:flex;gap:8px;padding:10px 14px;}',
      '.m-junk-btn{flex:1;cursor:pointer;border-radius:6px;padding:8px 6px;font-size:13px;background:#334155;border:1px solid #475569;color:#e2e8f0;white-space:nowrap;font-family:inherit;}',
      '.m-junk-btn:hover{background:#475569;}',
      '.m-junk-tools .m-junk-btn{flex:none;padding:7px 10px;font-size:12px;}',
      '.m-junk-btn-red{background:#991b1b;border-color:#dc2626;}.m-junk-btn-red:hover{background:#dc2626;}',
      '.m-junk-btn:disabled{opacity:.45;cursor:default;background:#334155;}',
      '@media (max-width:640px){.m-junk-box{max-width:none;max-height:calc((100dvh - var(--orig-bar-h,0px)) * .94);}.m-junk-tools,.m-junk-foot{padding-left:10px;padding-right:10px;}.m-junk-btn{padding:9px 4px;}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  function init() {
    if (!ready()) { console.warn('[AFK-junkmgr] 缺必要核心函式，停用'); return; }
    injectCss();
    console.log('[AFK-junkmgr] hooks OK');
    var tries = 0;
    (function tryInject() {
      if (injectAutoNav()) return;
      if (++tries < 40) setTimeout(tryInject, 500);
      else console.warn('[AFK-junkmgr] 找不到 tab-automation，入口未注入');
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
