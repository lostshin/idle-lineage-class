/* ============================================================================
 * afk-attrbatch.js — 象牙塔『碧恩』賦予屬性：一鍵衝到指定階段／星數
 *
 * 原版一次只能點一張（js/11 doBianAttr）：屬性提升 7%、第5階後附加/重抽魔法 1%，
 * 而且每點一張都跑 calcStats+updateUI+renderTabs+saveGame+重繪面板。要衝到
 * 第5階再上 ★3，手點的次數是天文數字。本外掛在碧恩面板下方加一塊批次區：
 * 選「部位／屬性／目標（第1~5階 或 ★1~★3）／最多消耗張數」→ 一次跑完。
 *
 * 🔑 作法：規則不重寫。把 doBianAttr 的副作用（logSys / calcStats / updateUI /
 *   renderTabs / saveGame / renderBianAttr）暫時換成空函式，在迴圈裡反覆呼叫
 *   核心函式，跑完再真的重算＋存檔＋重繪一次。7%、1%、掉星、第4/5階的 +10/+11
 *   門檻全部沿用核心那一份，上游改規則我們自動跟上。
 *
 * 停止條件：達成目標／張數用盡／卷軸用完／「這一輪卷軸沒被扣掉」。最後一項＝
 *   核心把這次操作擋下來了（+10/+11 門檻、遺物、武器本身已有觸發技能…），此時
 *   把核心自己吐的那句訊息當成停止原因顯示，不必在外掛重寫一份判斷條件。
 *
 * ⚠️ 衝星是硬衝：核心規則是「抽到不同技能就掉回 ★1」，批次不會因此停手（設計如此）。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-attrbatch.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'attrbatch', name: '一鍵附魔（碧恩）', group: '遊戲玩法', def: true,
      desc: '象牙塔碧恩的「賦予屬性」可以選目標階段／星數，一次把卷軸燒到定位'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('attrbatch'); }

  // 副作用暫時關掉的核心函式（跑批次時換成空函式，跑完還原並各呼叫一次）
  var MUTE = ['logSys', 'calcStats', 'updateUI', 'renderTabs', 'saveGame', 'renderBianAttr'];
  var ELE_NAMES = { fire: '🔥 火', water: '💧 水', wind: '🌪 風', earth: '⛰ 地' };   // 下拉用（emoji 是代理對，別用 slice 去掉圖示）
  var ELE_PLAIN = { fire: '火', water: '水', wind: '風', earth: '地' };
  var TARGETS = ['t1', 't2', 't3', 't4', 't5', 's1', 's2', 's3'];

  var S = { slot: 'wpn', ele: '', target: 't5' };   // 面板選取狀態（重繪要保得住）

  function tgtLabel(v) { return v.charAt(0) === 't' ? ('第' + v.slice(1) + '階') : ('★' + v.slice(1)); }
  function stars(n) { var s = ''; for (var i = 0; i < n; i++) s += '★'; return s; }
  function plain(html) { return String(html == null ? '' : html).replace(/<[^>]*>/g, '').trim(); }
  function scrollCnt(id) { var it = player.inv.find(function (i) { return i.id === id; }); return it ? (it.cnt || 0) : 0; }
  function skName(id) { return (DB.skills[id] && DB.skills[id].n) || id; }

  function slotList() {
    var out = [{ k: 'wpn', n: '武器' }];
    if (player && player.eq && player.eq.offwpn) out.push({ k: 'offwpn', n: '副手武器' });
    return out;
  }
  // 目前狀態的白話描述（屬性階段＋附加魔法星級）
  function attrText(it) {
    if (!it) return '（未裝備）';
    var a = getAttrAffix(it.attr), m = getAttrMagicProc(it);
    var s = a ? (a.n + ' 第' + a.tier + '階') : '無屬性';
    if (m) s += '　' + stars(m.star) + ' ' + skName(m.skId) + ' ' + m.rate + '%';
    return s;
  }
  // 是否已達目標（階段目標＝該屬性且階數夠；星數目標＝該屬性第5階且星數夠）
  function reached(it, ele, target) {
    var a = getAttrAffix(it.attr);
    if (!a || a.ele !== ele) return false;
    if (target.charAt(0) === 't') return a.tier >= Number(target.slice(1));
    if (a.tier < 5) return false;
    var m = getAttrMagicProc(it);
    return !!m && m.star >= Number(target.slice(1));
  }

  function blockHTML() {
    var slots = slotList();
    if (!slots.some(function (s) { return s.k === S.slot; })) S.slot = 'wpn';
    var it = player.eq[S.slot];
    var cur = it ? getAttrAffix(it.attr) : null;
    if (!S.ele || !ATTR_SCROLLS[S.ele]) S.ele = cur ? cur.ele : 'fire';

    var h = '<div class="mt-1 p-2 rounded border border-slate-600">'
      + '<div class="text-sky-300 font-bold text-xs mb-1">🔌 外掛一鍵附魔</div>';

    if (!it) return h + '<div class="text-xs text-slate-500">請先裝備武器。</div></div>';

    var cfg = ATTR_SCROLLS[S.ele], have = scrollCnt(cfg.id);
    h += '<div class="text-xs text-slate-400 mb-2">目前：<span class="text-slate-200">' + attrText(it) + '</span></div>';

    var slotSel = '';
    if (slots.length > 1) {
      slotSel = '<select onchange="AFK_ATTRBATCH.pick(\'slot\',this.value)" class="bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold rounded px-1 py-1">'
        + slots.map(function (s) { return '<option value="' + s.k + '"' + (s.k === S.slot ? ' selected' : '') + '>' + s.n + '</option>'; }).join('')
        + '</select>';
    }
    var eleSel = '<select onchange="AFK_ATTRBATCH.pick(\'ele\',this.value)" class="bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold rounded px-1 py-1">'
      + Object.keys(ATTR_SCROLLS).map(function (e) { return '<option value="' + e + '"' + (e === S.ele ? ' selected' : '') + '>' + ELE_NAMES[e] + '</option>'; }).join('')
      + '</select>';
    var tgtSel = '<select onchange="AFK_ATTRBATCH.pick(\'target\',this.value)" class="bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold rounded px-1 py-1">'
      + TARGETS.map(function (t) { return '<option value="' + t + '"' + (t === S.target ? ' selected' : '') + '>' + tgtLabel(t) + '</option>'; }).join('')
      + '</select>';

    h += '<div class="flex items-center gap-1 flex-wrap text-xs text-slate-400 mb-1">'
      + (slotSel ? '部位 ' + slotSel + '　' : '') + '屬性 ' + eleSel + '　目標 ' + tgtSel + '</div>'
      + '<div class="flex items-center gap-2 flex-wrap text-xs text-slate-400">最多消耗'
      + '<input id="afk-ab-qty" type="number" min="1" max="' + have + '" value="' + have + '" onclick="event.stopPropagation()"'
      + ' class="w-20 bg-slate-900 border border-slate-600 text-white text-center rounded py-1">張'
      + '<button class="btn px-2 py-1 text-xs font-bold bg-slate-700 border-slate-500" onclick="document.getElementById(\'afk-ab-qty\').value=' + have + '">全部</button>'
      + '<span class="' + (have > 0 ? 'text-slate-400' : 'text-red-400') + '">持有 ' + have + ' 張</span>'
      + '<button class="btn bg-emerald-800 hover:bg-emerald-700 py-1 px-4 font-bold text-sm ml-auto"'
      + (have > 0 ? ' onclick="AFK_ATTRBATCH.run()"' : ' disabled') + '>一鍵附魔</button>'
      + '</div>';

    if (reached(it, S.ele, S.target)) h += '<div class="text-xs text-emerald-300 mt-1">已達成此目標。</div>';
    else if (cur && cur.ele !== S.ele) h += '<div class="text-xs text-red-300 mt-1">⚠ 與目前屬性不同：一旦成功會變成 ' + ELE_PLAIN[S.ele] + ' 第1階，原本的 ' + cur.n + ' 與附加魔法會消失。</div>';
    return h + '</div>';
  }

  function repaint() {
    var el = document.getElementById('interaction-content');
    if (el && typeof renderBianAttr === 'function') renderBianAttr(el);
  }

  // 批次本體：反覆呼叫核心 doBianAttr，副作用先靜音，跑完統一收尾
  function doRun(slotKey, ele, target, limit) {
    var cfg = ATTR_SCROLLS[ele];
    var it0 = player.eq[slotKey];
    var before = attrText(it0);
    var used = 0, attrWin = 0, magicWin = 0, stop = '';
    var msgs = [];
    var saved = {};

    MUTE.forEach(function (k) { saved[k] = window[k]; });
    window.logSys = function (m) { msgs.push(m); };
    window.calcStats = window.updateUI = window.renderTabs = window.saveGame = window.renderBianAttr = function () {};
    try {
      while (used < limit) {
        var it = player.eq[slotKey];
        if (!it) { stop = '武器已不在該欄位。'; break; }
        if (reached(it, ele, target)) break;
        var c0 = scrollCnt(cfg.id);
        if (c0 <= 0) { stop = '卷軸用完了。'; break; }
        var a0 = getAttrAffix(it.attr), m0 = getAttrMagicProc(it);
        msgs.length = 0;
        doBianAttr(slotKey, ele);
        var c1 = scrollCnt(cfg.id);
        if (c1 >= c0) { stop = plain(msgs[msgs.length - 1]) || '被擋下了。'; break; }   // 沒扣卷軸＝核心把這次擋下
        used += c0 - c1;
        var a1 = getAttrAffix(it.attr), m1 = getAttrMagicProc(it);
        if ((a1 ? a1.ele + a1.tier : '') !== (a0 ? a0.ele + a0.tier : '')) attrWin++;
        if ((m1 ? m1.skId + m1.star : '') !== (m0 ? m0.skId + m0.star : '')) magicWin++;
      }
    } finally {
      MUTE.forEach(function (k) { window[k] = saved[k]; });
    }

    calcStats(); updateUI(); renderTabs(true); saveGame();
    var itN = player.eq[slotKey];
    var parts = [];
    if (attrWin) parts.push('屬性成功 ' + attrWin + ' 次');
    if (magicWin) parts.push('魔法成功 ' + magicWin + ' 次');
    logSys('<span class="c-legend font-bold">🔌 一鍵附魔（目標 ' + tgtLabel(target) + '）：</span>消耗 ' + used + ' 張 '
      + cfg.n + '，<span class="text-slate-400">' + before + '</span> ⇒ <span class="text-amber-200">' + attrText(itN) + '</span>'
      + (parts.length ? '（' + parts.join('、') + '）' : '') + '。'
      + (stop ? '<span class="text-amber-300"> 中止：' + stop + '</span>' : ''));
    repaint();
  }

  window.AFK_ATTRBATCH = {
    pick: function (k, v) { S[k] = v; repaint(); },
    run: function () {
      if (!on()) return;
      var slotKey = S.slot, ele = S.ele, target = S.target;
      var it = player.eq[slotKey];
      if (!it) { logSys('<span class="text-red-400">該欄位沒有裝備武器。</span>'); return; }
      if (reached(it, ele, target)) { logSys('<span class="text-amber-300">已達成 ' + tgtLabel(target) + '，不需要再燒卷軸。</span>'); return; }
      var cfg = ATTR_SCROLLS[ele], have = scrollCnt(cfg.id);
      if (have < 1) { logSys('<span class="text-red-400">缺少 ' + cfg.n + '。</span>'); return; }
      var el = document.getElementById('afk-ab-qty');
      var qty = el ? parseInt(el.value, 10) : have;
      if (!qty || qty < 1) qty = have;
      var limit = Math.min(qty, have);

      var cur = getAttrAffix(it.attr);
      var msg = '對 ' + plain(getItemFullName(it)) + ' 使用 ' + cfg.n + '，衝到「' + tgtLabel(target) + '」。\n'   // AFK_UI.confirm 會做 HTML 逃脫，名稱要先去標籤
        + '本次最多消耗 ' + limit + ' 張（持有 ' + have + ' 張）。\n目前：' + attrText(it);
      if (cur && cur.ele !== ele) msg += '\n⚠ 屬性不同：一旦成功會變成 ' + ELE_PLAIN[ele] + ' 第1階，原本的 ' + cur.n + ' 與附加魔法會消失。';
      if (target.charAt(0) === 's') msg += '\n⚠ 衝星會硬衝：抽到不同技能會掉回 ★1，批次不會因此停手。';

      var go = function () { doRun(slotKey, ele, target, limit); };
      if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '一鍵附魔', message: msg, okText: '開始', danger: true, onOk: go });
      else if (confirm(msg)) go();
    }
  };

  function init() {
    var missing = ['renderBianAttr', 'doBianAttr', 'getAttrAffix', 'getAttrMagicProc', 'getItemFullName', 'logSys', 'saveGame', 'calcStats', 'updateUI', 'renderTabs']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length || typeof ATTR_SCROLLS === 'undefined') {
      console.warn('[AFK-attrbatch] 缺少核心函式/資料（' + (missing.join(',') || 'ATTR_SCROLLS') + '），一鍵附魔停用。');
      return;
    }
    var orig = window.renderBianAttr;
    window.renderBianAttr = function (el) {
      var r = orig.apply(this, arguments);
      try {
        if (on() && el && player && player.eq) {
          var host = el.firstElementChild || el;   // 原版整塊包在一個 flex-col 容器裡，塞進去才對齊
          host.insertAdjacentHTML('beforeend', blockHTML());
        }
      } catch (e) {}
      return r;
    };
    console.log('[AFK-attrbatch] hooks OK — 碧恩一鍵附魔就緒。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
