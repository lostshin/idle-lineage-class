/* ============================================================================
 * afk-bmprice.js — 黑市收購價提示
 *
 * 潘朵拉黑市可以「掛收購單」：指定一件物品 + 出價，之後每次輪換（10 分鐘一格）系統會
 *   替那件物品擲一次行情價，行情價 ≤ 你的出價才命中、以「你的出價」上架。所以：
 *     ① 這件在黑市的成交價落在哪個區間（算得出來，不必試）——出滿上限就必定買到
 *     ② 你成交時付的就是自己出的那個價 —— 直接出上限等於自願買最貴
 *     ③ 行情是均勻分布 → 任何出價的「每次輪換命中率」與「平均要等多久」也都算得出來
 *   遊戲一個都沒告訴玩家，只能靠掛單試 → 這支把 ①③ 寫在收購欄下面，打字即時更新
 *   （② 不另外寫字：「成交價」這個說法本身就講完了）。
 *
 * 掛接：
 *   - 包 pandoraRenderMarket（面板重繪，含輪換就地重繪）→ 補提示列、綁輸入監聽
 *   - 包 pandoraChooseBuyItem（從建議清單點名字：程式塞 value 不會觸發 input 事件）
 *   - 名稱欄／價錢欄的 input 事件 → 即時重算
 *   另對外開 window.AFK_BM.itemInfo(id)，給小百科／掉落查詢的物品詳情標同一個數字。
 *
 * 🚨 絕不呼叫 pandoraBuyOrderPrice()：它內部走 lootRng，而 lootRng 每呼叫一次就把
 *   player.lootSeq 加一（committed RNG 的序號，進存檔且受簽章保護）。查個價就會讓玩家
 *   之後所有掉落／黑市結果整個位移。只用不擲骰的 pandoraBuyOrderPriceProfile 與
 *   pandoraCardPriceRange 拿區間，上限就是必定買到的出價。
 *
 * ⚠️ 同步上游時要看一眼：上面三支核心函式若改名，提示會安靜消失（smoke 有擋，見
 *   scripts/smoke-hooks.mjs 的 [AFK-bmprice]）。
 * ========================================================================== */
(function () {
  'use strict';

  var HINT_ID = 'afk-bm-hint';

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'bmprice', name: '黑市收購價提示', group: '遊戲介面', def: true,
    desc: '潘朵拉收購欄顯示成交價區間與命中機率；小百科／掉落查詢的物品也標成交價'
  });

  function enabled() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('bmprice'); }

  // 每格輪換間隔幾分鐘。核心的 PANDORA_SLOT_TICKS 是頂層 const（拿不到），改從面板標題
  //   那句「每 10 分鐘輪換 1 件」抓數字，作者調整時自動跟上；抓不到才退回 10。
  //   ⚠️ 一定要在包裝 pandoraRenderMarket「之前」抓，否則讀到的是我們自己的 wrapper。
  var ROTATE_FROM_CORE = false;
  var ROTATE_MIN = (function () {
    try {
      var m = String(window.pandoraRenderMarket).match(/每\s*(\d+)\s*分鐘輪換/);
      if (m) { ROTATE_FROM_CORE = true; return Number(m[1]); }
    } catch (e) {}
    return 10;
  })();

  // ---- 行情價區間（純計算·不擲骰）------------------------------------------
  function rangeOf(id) {
    var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
    if (!d) return null;
    if (typeof pandoraCardPriceRange === 'function') {
      var cr = pandoraCardPriceRange(d);
      if (cr) return { min: cr.min, max: cr.max, card: true };
    }
    if (typeof pandoraBuyOrderPriceProfile !== 'function') return null;
    var p = pandoraBuyOrderPriceProfile(id);
    return {
      min: Math.max(1, Math.round(p.base * p.minMult)),
      max: Math.max(1, Math.round(p.base * p.maxMult)),
      base: p.base, minMult: p.minMult, maxMult: p.maxMult
    };
  }

  // 出價 offer 時，「每一次輪換」的命中機率。卡片＝區間內均勻取整數；其餘＝倍率取整數後
  //   乘底價，逐一數（式子與核心 pandoraBuyOrderPrice 相同，不用近似公式；價格對倍率單調
  //   遞增，所以第一個超過就能停）。
  function hitChance(r, offer) {
    if (!r || !(offer > 0)) return 0;
    if (r.card) return Math.max(0, Math.min(1, (offer - r.min + 1) / (r.max - r.min + 1)));
    var n = 0;
    for (var m = r.minMult; m <= r.maxMult; m++) {
      if (Math.max(1, Math.round(r.base * m)) <= offer) n++;
      else break;
    }
    return n / (r.maxMult - r.minMult + 1);
  }

  // 名稱 → 可收購的物品 id。比對規則跟核心 pandoraSetBuyOrder 一致（完全吻合的名字裡挑
  //   第一個可收購的），算出來的數字才會跟按下「確認收購」後真正生效的那件一致。
  function resolveName(name) {
    name = String(name || '').trim();
    if (!name || typeof DB === 'undefined' || !DB.items) return null;
    var first = null;
    for (var id in DB.items) {
      var d = DB.items[id];
      if (!d || d.n !== name) continue;
      if (!first) first = d;
      if (typeof pandoraBuyOrderAllowed === 'function' && pandoraBuyOrderAllowed(id)) return { id: id, d: d, ok: true };
    }
    return first ? { ok: false, d: first } : null;
  }

  function fmtPct(p) {
    var v = p * 100;
    if (v > 0 && v < 0.1) return '不到 0.1%';
    return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + '%';
  }
  function fmtWait(p) {
    var mins = Math.round(ROTATE_MIN / p);
    if (mins >= 1440) return '約 ' + Math.round(mins / 1440) + ' 天';
    if (mins >= 60) return '約 ' + Math.round(mins / 60) + ' 小時';
    return '約 ' + mins + ' 分鐘';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- 收購欄下面那一行 -----------------------------------------------------
  function hintHTML() {
    var nameEl = document.getElementById('pandora-buy-name');
    if (!nameEl) return '';
    var hit = resolveName(nameEl.value);
    if (!hit) return '';   // 名字還沒打完整 → 不出字（每個按鍵都跳「查無此物品」只會閃）
    if (!hit.ok) {
      return hit.d.relic
        ? '<span class="afk-bm-no">遺物不能用金幣收購，要在下面的布告欄花龍鑽搜索</span>'
        : '<span class="afk-bm-no">這件不能指定收購</span>';
    }
    var r = rangeOf(hit.id);
    if (!r) return '';
    // 每一段各自 nowrap：手機一行放不下時整段換行，不會斷在「平均等 約 / 20 分鐘」中間
    var seg = function (html, cls) { return '<span class="afk-bm-seg' + (cls ? ' ' + cls : '') + '">' + html + '</span>'; };
    var out = seg('黑市成交價 <b>' + r.min.toLocaleString() + ' ~ ' + r.max.toLocaleString() + '</b> 金幣');

    var priceEl = document.getElementById('pandora-buy-price');
    var offer = Number(String((priceEl && priceEl.value) || '').replace(/[,\s，]/g, ''));
    if (!Number.isSafeInteger(offer) || offer <= 0) return out;

    var p = hitChance(r, offer);
    if (offer >= r.max) out += seg('下次輪換必定上架' + (offer > r.max ? '，多出的是白付的' : ''));
    else if (offer < r.min) out += seg('出價低於下限，永遠不會上架');
    else out += seg('你出的價 ' + fmtPct(p) + ' 命中，平均等 ' + fmtWait(p));

    var gold = (typeof player !== 'undefined' && player) ? (player.gold || 0) : 0;
    if (offer > gold) out += seg('金幣不夠，命中了也買不起', 'afk-bm-warn');
    return out;
  }

  function hintEl() {
    var priceEl = document.getElementById('pandora-buy-price');
    if (!priceEl) return null;
    var el = document.getElementById(HINT_ID);
    if (el && el.isConnected) return el;
    var bar = priceEl.closest('.pandora-buybar') || priceEl.parentElement;
    if (!bar) return null;
    el = document.createElement('div');
    el.id = HINT_ID;
    el.className = 'afk-bm-hint';
    bar.insertAdjacentElement('afterend', el);
    return el;
  }

  function update() {
    var el = document.getElementById(HINT_ID);
    if (!enabled()) { if (el) el.remove(); return; }   // 面板開著時關掉開關 → 下次重繪就收乾淨
    el = hintEl();
    if (!el) return;
    var html = hintHTML();
    el.innerHTML = html;
    el.style.display = html ? '' : 'none';
  }

  function closeSuggestions() {
    var box = document.getElementById('pandora-buy-suggestions');
    if (box && !box.classList.contains('hidden')) { box.innerHTML = ''; box.classList.add('hidden'); }
  }

  function bindInputs() {
    ['pandora-buy-name', 'pandora-buy-price'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.__afkBm) { el.__afkBm = 1; el.addEventListener('input', update); }
    });
    // 游標進到價錢欄＝名字已經挑完了 → 收掉建議清單。
    //   ⚠️ 不能假設「玩家去點金額欄，下拉自然就被點掉了」——實測不會：上游收掉清單只有兩處
    //   （點建議項、名字砍到 <2 字），沒有任何 blur／點外面的收合。清單是絕對定位、正好浮在
    //   提示列上，不收的話玩家在決定要出多少的整段時間裡都看不到數字，正是最需要它的時候。
    var priceEl = document.getElementById('pandora-buy-price');
    if (priceEl && !priceEl.__afkBmFocus) {
      priceEl.__afkBmFocus = 1;
      priceEl.addEventListener('focus', function () { if (enabled()) closeSuggestions(); });
    }
  }

  // ---- 對外：小百科／掉落查詢的物品詳情用 -----------------------------------
  //   回 { min, max } ＝黑市成交價區間（出滿 max 必定上架，低於 min 永遠不會）；{ deny } ＝玩家
  //   會拿去試但不給收的（遺物、耳環、箭矢、寵物裝備…）；null ＝不必在詳情裡提（藥水、材料
  //   這些沒人會去掛收購單）。
  function itemInfo(id) {
    if (!enabled()) return null;
    var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
    if (!d) return null;
    if (typeof pandoraBuyOrderAllowed === 'function' && pandoraBuyOrderAllowed(id)) {
      var r = rangeOf(id);
      return r ? { min: r.min, max: r.max } : null;
    }
    if (d.relic) return { deny: 'relic' };
    if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') return { deny: 'other' };
    return null;
  }
  // rotateFromCore：輪換間隔是不是真的從核心那句標題抓到的（false＝退回猜 10 分鐘，
  //   「平均等多久」會失準）。smoke 靠它抓「上游改了標題寫法」這種安靜失準。
  window.AFK_BM = {
    itemInfo: itemInfo, range: rangeOf, hitChance: hitChance, resolveName: resolveName,
    rotateMin: ROTATE_MIN, rotateFromCore: ROTATE_FROM_CORE
  };

  // ---- 包核心 --------------------------------------------------------------
  function wrap(name, after) {
    var orig = window[name];
    if (typeof orig !== 'function') return false;
    if (orig.__afkBm) return true;   // 冪等：重複載入不疊包
    var w = function () {
      var r = orig.apply(this, arguments);
      try { after(); } catch (e) {}
      return r;
    };
    w.__afkBm = 1;
    window[name] = w;
    return true;
  }

  var style = document.createElement('style');
  style.textContent =
    '.afk-bm-hint{font-size:12px;line-height:1.5;color:#94a3b8;margin:3px 0 0;padding:0 2px;}' +
    '.afk-bm-seg{white-space:nowrap;margin-right:1em;}' +
    '.afk-bm-hint b{color:#fde047;font-weight:700;}' +
    '.afk-bm-warn{color:#f87171;}' +
    '.afk-bm-no{color:#fca5a5;}';
  document.head.appendChild(style);

  var okPanel = wrap('pandoraRenderMarket', function () { bindInputs(); update(); })
    && wrap('pandoraChooseBuyItem', update);   // 點建議清單是程式塞 value，不會觸發 input
  if (!okPanel) console.warn('[AFK-bmprice] 找不到潘朵拉黑市面板函式，收購欄提示停用（小百科／掉落查詢的標價照常）。');
  if (typeof pandoraBuyOrderPriceProfile !== 'function' || typeof pandoraBuyOrderAllowed !== 'function') {
    console.warn('[AFK-bmprice] 找不到核心收購價函式，成交價全面停用（遊戲照常運作）。');
  }
  console.log('[AFK-bmprice] hooks OK');
})();
