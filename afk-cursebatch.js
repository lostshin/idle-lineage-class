/* ============================================================================
 * afk-cursebatch.js — 詛咒卷軸（紅武／紅防）一鍵弱化 ＋ 補回滿強化裝備的入口
 *
 * 解兩件事：
 *  1)「一張一張點」：核心 executeCurseDeEnhance（js/10）一次降 1 階、100% 成功、
 *     最低 -1，而且每點一張都跑 calcStats+renderTabs+saveGame+closeModal。
 *     本外掛給一個「目標強化值」下拉，一次降到定位。
 *  2)「點滿的不能用」：物品視窗那顆「強化」鈕的顯示條件含 !isMaxEnhanced(item)
 *     （js/10 openModal），裝備一到強化上限整顆鈕就消失——而詛咒卷軸的入口在那顆
 *     鈕底下，於是 +15 的裝備完全沒地方用詛咒卷軸。本外掛把弱化入口直接掛在物品
 *     視窗上，不看 isMaxEnhanced，滿強化也點得到。
 *
 * 🔑 作法：規則不重寫。把 executeCurseDeEnhance 的副作用（logSys / calcStats /
 *   renderTabs / saveGame / closeModal）暫時換成空函式，在迴圈裡反覆呼叫核心函式。
 *   -1 下限、卷軸扣除都沿用核心那一份；「這一輪卷軸沒被扣掉」＝核心擋下了，
 *   把它自己吐的訊息當停止原因。
 *
 * ⚠️ 背包裡數量>1 的裝備要「先自己拆一件出來」再進迴圈：核心每次呼叫都會拆一件，
 *   若一直拿原始 uid 重複呼叫，會變成拆出 N 件各 -1，而不是一件 -N。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-cursebatch.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'cursebatch', name: '一鍵弱化（詛咒卷軸）', group: '遊戲玩法', def: true,
      desc: '詛咒卷軸可一次降到指定強化值；已強化到上限的裝備也點得到'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('cursebatch'); }

  var MUTE = ['logSys', 'calcStats', 'renderTabs', 'saveGame', 'closeModal'];
  var MIN_EN = -1;   // 核心 executeCurseDeEnhance 的下限（沿用；此處只用於畫下拉選項）

  function plain(html) { return String(html == null ? '' : html).replace(/<[^>]*>/g, '').trim(); }
  function scrollIdOf(d) { return d.type === 'wpn' ? 'scroll_weapon_c' : (d.type === 'arm' ? 'scroll_armor_c' : ''); }
  function scrollCnt(id) { var it = player.inv.find(function (i) { return i.id === id; }); return it ? (it.cnt || 0) : 0; }
  function findItem(uid, isEq) {
    return isEq ? Object.values(player.eq).find(function (e) { return e && e.uid === uid; })
                : player.inv.find(function (i) { return i.uid === uid; });
  }
  // 這件裝備可不可以用詛咒卷軸（箭矢／無法強化／遺物排除；已在 -1 就沒得降）
  function eligible(item, d) {
    if (!d || !item) return false;
    if (d.type !== 'wpn' && d.type !== 'arm') return false;
    if (d.isArrow || d.noEnhance || isRelic(d)) return false;
    return (Number(item.en) || 0) > MIN_EN;
  }

  function panelHTML(item, d, goal) {
    var en = Number(item.en) || 0;
    var sid = scrollIdOf(d), have = scrollCnt(sid), need = en - goal;
    var opts = '';
    for (var t = en - 1; t >= MIN_EN; t--) opts += '<option value="' + t + '"' + (t === goal ? ' selected' : '') + '>' + t + '</option>';
    var enough = have >= need;
    var stopAt = enough ? goal : en - have;
    return '<select id="afk-cb-goal" onchange="AFK_CURSEBATCH.reopen(Number(this.value))"'
      + ' class="col-span-2 w-full bg-slate-800 border border-slate-600 text-slate-200 font-bold rounded px-2 py-2 mb-1">' + opts + '</select>'
      + '<div class="col-span-2 text-sm ' + (enough ? 'text-slate-400' : 'text-red-300') + ' mb-1">需要 ' + need + ' 張 · 持有 ' + have + ' 張'
      + (enough ? '' : ' → 卷軸不足，會停在 ' + stopAt) + '</div>'
      + '<button class="col-span-2 w-full btn border-red-800 bg-red-950 hover:bg-red-900 py-3 text-base font-bold c-cursed shadow"'
      + (have > 0 ? ' onclick="AFK_CURSEBATCH.run()"' : ' disabled') + '>'
      + (have > 0 ? '一鍵降到 ' + stopAt + '（消耗 ' + Math.min(need, have) + ' 張）' : '沒有詛咒卷軸') + '</button>';
  }

  var CUR = null;   // 目前面板鎖定的 {uid,isEq,goal}

  // 批次本體：反覆呼叫核心 executeCurseDeEnhance，副作用先靜音，跑完統一收尾
  function doRun(startUid, isEq, goal) {
    var item = findItem(startUid, isEq);
    if (!item) return;
    var d = DB.items[item.id], sid = scrollIdOf(d);
    var fn0 = getItemFullName(item);

    // 背包堆疊：自己先拆一件出來（核心每次呼叫都會拆，重複呼叫原始 uid 會拆出 N 件各 -1）
    if (!isEq && (item.cnt || 1) > 1) {
      item.cnt -= 1;
      var single = Object.assign({}, item, { cnt: 1, uid: uid() });
      player.inv.push(single);
      item = single;
    }
    var tid = item.uid, used = 0, stop = '', msgs = [];
    var saved = {};
    MUTE.forEach(function (k) { saved[k] = window[k]; });
    window.logSys = function (m) { msgs.push(m); };
    window.calcStats = window.renderTabs = window.saveGame = window.closeModal = function () {};
    try {
      while (true) {
        var t = findItem(tid, isEq);
        if (!t || (Number(t.en) || 0) <= goal) break;
        var c0 = scrollCnt(sid);
        if (c0 <= 0) { stop = '詛咒卷軸用完了。'; break; }
        msgs.length = 0;
        executeCurseDeEnhance(tid, isEq, sid);
        var c1 = scrollCnt(sid);
        if (c1 >= c0) { stop = plain(msgs[msgs.length - 1]) || '被擋下了。'; break; }
        used += c0 - c1;
      }
    } finally {
      MUTE.forEach(function (k) { window[k] = saved[k]; });
    }

    calcStats(); renderTabs(true); saveGame();
    var itN = findItem(tid, isEq);
    var enN = itN ? (Number(itN.en) || 0) : goal;
    logSys('<span class="c-legend font-bold">🔌 一鍵弱化：</span>消耗 ' + used + ' 張 <span class="c-cursed">'
      + DB.items[sid].n + '</span>，' + fn0 + ' ⇒ <span class="text-red-300 font-bold">' + (enN < 0 ? enN : '+' + enN) + ' ' + d.n + '</span>。'
      + (stop ? '<span class="text-amber-300"> 中止：' + stop + '</span>' : ''));

    if (itN && typeof openModal === 'function') {
      var slot = isEq ? Object.keys(player.eq).find(function (k) { return player.eq[k] === itN; }) : undefined;
      openModal(itN, isEq, slot);
    } else if (typeof closeModal === 'function') closeModal();
  }

  window.AFK_CURSEBATCH = {
    // 把物品視窗換成弱化面板（沿用原版「強化 → 選卷軸」那種換頁式）
    open: function (uid, isEq, goal) {
      if (!on()) return;
      var item = findItem(uid, isEq);
      if (!item) return;
      var d = DB.items[item.id];
      if (!eligible(item, d)) return;
      var en = Number(item.en) || 0;
      if (goal == null || goal >= en || goal < MIN_EN) goal = MIN_EN;
      CUR = { uid: uid, isEq: isEq, goal: goal };

      var nm = document.getElementById('modal-item-name');
      nm.innerHTML = '弱化 ' + getItemFullName(item);
      nm.className = 'text-xl font-bold mb-3 border-b border-slate-600 pb-3 c-cursed';
      document.getElementById('modal-item-desc').innerHTML =
        '使用「' + DB.items[scrollIdOf(d)].n + '」降低強化值：<b>100% 成功、不會爆裝</b>，最低到 ' + MIN_EN + '。<br>目標強化值：';
      document.getElementById('modal-actions').innerHTML = panelHTML(item, d, goal)
        + '<button class="col-span-2 w-full btn py-3 bg-slate-700 text-lg font-bold mt-2" onclick="returnToItemModal(\'' + uid + '\', ' + isEq + ')">返回</button>';
    },
    reopen: function (goal) { if (CUR) window.AFK_CURSEBATCH.open(CUR.uid, CUR.isEq, goal); },
    run: function () {
      if (!on() || !CUR) return;
      var item = findItem(CUR.uid, CUR.isEq);
      if (!item) return;
      var d = DB.items[item.id], sid = scrollIdOf(d);
      var el = document.getElementById('afk-cb-goal');
      var goal = el ? Number(el.value) : CUR.goal;
      var en = Number(item.en) || 0, have = scrollCnt(sid);
      if (have < 1) { logSys('<span class="text-red-400">缺少 ' + DB.items[sid].n + '。</span>'); return; }
      var willUse = Math.min(en - goal, have), stopAt = en - willUse;
      var msg = '對 ' + plain(getItemFullName(item)) + ' 使用 ' + DB.items[sid].n + '。\n'   // AFK_UI.confirm 會做 HTML 逃脫，名稱要先去標籤
        + '消耗 ' + willUse + ' 張（持有 ' + have + ' 張），強化值 ' + (en < 0 ? en : '+' + en) + ' ⇒ ' + stopAt + '。\n弱化不可逆，卷軸不會退還。';
      var go = function () { doRun(CUR.uid, CUR.isEq, goal); };
      if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '一鍵弱化', message: msg, okText: '開始', danger: true, onOk: go });
      else if (confirm(msg)) go();
    }
  };

  function init() {
    var missing = ['openModal', 'executeCurseDeEnhance', 'returnToItemModal', 'getItemFullName', 'isRelic', 'logSys', 'saveGame', 'calcStats', 'renderTabs', 'closeModal']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length) {
      console.warn('[AFK-cursebatch] 缺少核心函式（' + missing.join(',') + '），一鍵弱化停用。');
      return;
    }
    var orig = window.openModal;
    window.openModal = function (item, isEq, slot) {
      var r = orig.apply(this, arguments);
      try {
        if (!on() || !item) return r;
        var d = DB.items[item.id];
        if (!eligible(item, d)) return r;
        var sid = scrollIdOf(d), have = scrollCnt(sid);
        if (have < 1) return r;   // 沒有詛咒卷軸就不佔位（同原版「有卷軸才列」的作風）
        var act = document.getElementById('modal-actions');
        if (!act) return r;
        act.insertAdjacentHTML('beforeend',
          '<button class="col-span-2 w-full btn border-red-800 bg-red-950 hover:bg-red-900 c-cursed py-3 text-lg font-bold mt-2"'
          + ' onclick="AFK_CURSEBATCH.open(\'' + item.uid + '\', ' + !!isEq + ')">🔻 弱化（詛咒卷軸 ×' + have + '）</button>');
      } catch (e) {}
      return r;
    };
    console.log('[AFK-cursebatch] hooks OK — 詛咒卷軸一鍵弱化就緒。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
