/* ==========================================================================
 * afk-relicbatch.js — 遺物整理:重複的一次清掉,可以賣金幣或回收換龍鑽
 *
 * 玩家要什麼:「有了更好的遺物,一般的想賣掉換鑽石」。而遺物特別容易堆——它們幾乎都
 *   `noEnhance`、`gachaWeight 0`,只會越打越多;afk-relicaffix 上線後同一件遺物的每個詞綴
 *   組合各自一疊(itemSig 含 bless/anc/attr,js/01),武器最多 210 種組合 → 疊數逼近件數。
 *   真實存檔實測:一位角色背包 187 件遺物 91 疊,而那還是詞綴上線前的存檔。
 *
 * 🚨 每個遺物 id 一定會自動保留最好的 1 件(寫死,不做成選項)。
 *   原因不是保護玩家的收藏,是**布告欄搜尋的抽獎池看的是「你現在背包和身上有沒有」**
 *   (`_ownedRelicIds` 讀 player.inv + player.eq,js/24:1704——不看圖鑑也不看倉庫)。
 *   某個 id 全部清掉 → 它回到抽獎池 → 變成「花一堆遺物換一次搜尋、搜回剛剛丟掉的那件」。
 *   所以清單上直接把那一件標成「保留」且不可選,玩家看得到自己留了什麼。
 *
 * 定價:回收 3 顆龍鑽/件,白板與三詞綴同價。
 *   為什麼是 3(實測,別憑感覺改):唯一的鑽石出口是遺物布告欄搜尋 100 鑽/次、3 欄 × 24h 冷卻
 *   → 每天最多花 300 鑽;龍鑽收購 NPC 實測給 ~80 鑽/天(5 份真實存檔 × 各 2 萬位模擬;
 *   afk-buyercompat 上線後又 +33~47%)。重度玩家掉 16.67 件遺物/天 → 3 顆/件 = 50 鑽/天
 *   = NPC 管道的 0.63×、每日上限的 17%:是有感的被動保底,但蓋不過 NPC。
 *   5 顆/件會變成 83 鑽/天 → 直接打平 NPC,那條管道就沒意義了,所以 3 是唯一站得住的整數。
 * ❌ 刻意不依詞綴數階梯定價:詞綴是我方外掛自己加的,拿它當定價基礎＝用自己的規則替自己的
 *   規則背書,而且會變成「洗詞綴賺鑽」的誘因。金幣那邊已經有核心的 ×10 了(getSellPrice)。
 *
 * 賣金幣走核心 getSellPrice(js/10:1811),我們一個數字都沒定:定價 30% × 每種詞綴 ×10。
 *   所以帶詞綴的賣金幣遠比換鑽划算(三詞綴 300 萬金 vs 3 顆鑽),白板才適合回收——
 *   這個取捨是核心既有的定價造成的,面板把兩個數字並排讓玩家自己挑。
 *
 * 🚨 龍鑽在潘朵拉那份**跨角色共用資料**(js/24,與角色存檔不同份)。動了就要對帳:
 *   加鑽 → 消耗物品 → 存檔;任何一步失敗就整串退回去(含把鑽石扣回來)。順序照 afk-dograce:
 *   **先加鑽**,萬一中途整個分頁掛掉,玩家是「拿了鑽石但東西還在」而不是「東西沒了什麼都沒拿」。
 *
 * 不做逐件「換龍鑽」按鈕:那顆會長在 js/10 openModal 的 `#modal-actions`,而那正是
 *   afk-sellguard 存在的理由(手機點兩下裝備、第二下落在販賣鈕上,實測賣掉過玩家的斗篷);
 *   何況疊數逼近件數時逐件按等於要按幾百次,根本沒解決玩家的痛點。
 *
 * 優雅降級:缺 player / DB / isRelic / getSellPrice 就 console.warn 後安靜停用。
 *   龍鑽 API(pandoraGetSharedDiamonds / pandoraAdjustSharedDiamonds)不在時**只收起換鑽那顆鈕**,
 *   賣金幣照常可用。
 * 掛接:遺物收集冊頁首 ＋ 自動化分頁的「🔌 外掛」列;排在 afk-relicaffix 之後(它也包
 *   renderRelicBook,我方後包＝在最外層,插入點不會被它的說明行擠掉)。
 * ========================================================================== */
(function () {
  'use strict';

  var DIA_PER_RELIC = 3;   // 每件遺物回收給幾顆龍鑽(依據見檔頭;要改先讀那段)
  var KEEP_PER_ID = 1;     // 每個遺物 id 至少留幾件(寫死,不做選項;原因見檔頭)

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'relicbatch', name: '遺物整理', group: '遊戲介面', def: true,
      desc: '重複的遺物一次清掉，可以賣金幣或回收換龍鑽；每個遺物一定會留最好的一件'
    });
  }
  function on() {
    try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('relicbatch'); } catch (e) { return true; }
  }

  // ── 小工具 ────────────────────────────────────────────────
  // ⚠️ player 是 js/01 的 `let player`、DB 是 `const DB`——都不在 window 上,一律裸名 + typeof 探
  function P() { return (typeof player !== 'undefined') ? player : null; }
  function ITEMS() { try { return DB.items; } catch (e) { return null; } }
  function loaded() { var p = P(); return !!(p && p.cls); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isRelicId(id) {
    try { var d = ITEMS()[id]; return !!(d && typeof isRelic === 'function' && isRelic(d)); } catch (e) { return false; }
  }
  function fullNameHtml(it) {
    try {
      var h = getItemFullName(it);
      return String(h).replace(/\s*\(\d+\)\s*(<\/[^>]+>)?\s*$/, '$1');   // 核心全名尾巴帶整疊數量,數量我們自己顯示
    } catch (e) {}
    try { return esc(ITEMS()[it.id].n); } catch (e) { return esc(it.id); }
  }
  function iconOf(d) { try { return getIconUrl(d); } catch (e) { return (d && d.img) || ''; } }

  // 詞綴分數:三種各算 1(白板 0 ～ 三詞綴 3)。用來決定「保留哪一件」與清單排序。
  function affixScore(it) {
    var s = 0;
    if (it.bless === true) s++;
    if (it.anc) s++;
    if (it.attr) s++;
    return s;
  }
  function variantKey(it) {
    return (it.bless === true ? 'B' : '') + '|' + (it.anc || '') + '|' + (it.attr || '') + '|' + (Math.floor(Number(it.en) || 0));
  }
  function affixPills(it) {
    var out = '';
    if (it.bless === true) out += '<i class="rb-pill rb-pill-bless">祝福</i>';
    if (it.anc) out += '<i class="rb-pill rb-pill-anc">遠古系</i>';
    if (it.attr) out += '<i class="rb-pill rb-pill-attr">屬性</i>';
    return out;
  }
  function sellPriceOf(it) { try { return Math.max(0, Math.floor(getSellPrice(it) || 0)); } catch (e) { return 0; } }
  function entryCnt(it) {
    var n = Math.floor(Number(it && it.cnt));
    return (isFinite(n) && n >= 1) ? n : 1;
  }

  function warehouseItems() {
    try {
      if (typeof loadWarehouse !== 'function') return [];
      var w = loadWarehouse();
      return (w && Array.isArray(w.items)) ? w.items : [];
    } catch (e) { return []; }
  }

  // ── 龍鑽(潘朵拉共用資料) ──────────────────────────────────
  function diaReady() {
    return typeof window.pandoraGetSharedDiamonds === 'function' && typeof window.pandoraAdjustSharedDiamonds === 'function';
  }
  function diaBalance() {
    if (!diaReady()) return 0;
    var n = Number(window.pandoraGetSharedDiamonds());
    return isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  function diaAdjust(delta) {
    if (!diaReady()) return { ok: false, error: '龍之鑽石系統未就緒。' };
    var r = window.pandoraAdjustSharedDiamonds(delta) || {};
    if (r.ok) return { ok: true };
    return { ok: false, error: r.error || (r.busy ? '共用資料忙碌中，請稍後再試。' : '龍之鑽石異動失敗。') };
  }
  // 動過共用鑽石就得確認角色存檔真的落盤,否則兩份資料不同步。saveGame 回非 true 一律當沒成功。
  function persistOk() {
    try { return typeof saveGame === 'function' && saveGame() === true; }
    catch (e) { console.warn('[AFK-relicbatch] saveGame failed', e); return false; }
  }

  // ── 掃描:把背包＋倉庫的遺物依 id 分組、組內依詞綴分列 ──────
  var groups = [];      // [{ id, def, name, icon, total, locked, keepKey, variants:[...] , expanded }]
  var sel = Object.create(null);   // rowKey('id::variantKey') -> true
  var filter = 'avail';
  var search = '';

  function scan() {
    var p = P(), items = ITEMS();
    groups = [];
    if (!p || !items) return;
    var byId = Object.create(null);

    function add(it, source) {
      if (!it || !it.id || !isRelicId(it.id)) return;
      if (it.lock) { (byId[it.id] = byId[it.id] || newGroup(it.id)).locked += entryCnt(it); return; }   // 上鎖的只計數、不列入
      var g = byId[it.id] = byId[it.id] || newGroup(it.id);
      var k = variantKey(it);
      var v = g.vmap[k];
      if (!v) {
        v = g.vmap[k] = { key: k, sample: it, cnt: 0, inv: 0, wh: 0, score: affixScore(it), gold: sellPriceOf(it) };
        g.variants.push(v);
      }
      var n = entryCnt(it);
      v.cnt += n;
      if (source === 'warehouse') v.wh += n; else v.inv += n;
      g.total += n;
    }
    function newGroup(id) {
      var d = items[id];
      return { id: id, def: d, name: (d && d.n) || id, icon: iconOf(d), total: 0, locked: 0, vmap: Object.create(null), variants: [], keepKey: null, expanded: false };
    }

    (Array.isArray(p.inv) ? p.inv : []).forEach(function (it) { add(it, 'inventory'); });
    warehouseItems().forEach(function (it) { add(it, 'warehouse'); });

    for (var id in byId) {
      var g = byId[id];
      if (!g.total) continue;                         // 只有上鎖的 → 整組不列
      g.variants.sort(function (a, b) {               // 好的排前面:詞綴多 → 賣價高 → key 穩定
        return (b.score - a.score) || (b.gold - a.gold) || (a.key < b.key ? -1 : 1);
      });
      g.keepKey = g.variants[0].key;                  // 自動保留最好的那一件
      g.variants.forEach(function (v) { v.avail = v.cnt - (v.key === g.keepKey ? KEEP_PER_ID : 0); });
      g.availTotal = g.variants.reduce(function (s, v) { return s + Math.max(0, v.avail); }, 0);
      delete g.vmap;
      groups.push(g);
    }
    groups.sort(function (a, b) { return (b.availTotal - a.availTotal) || (a.name < b.name ? -1 : 1); });
  }

  function rowKey(gid, vkey) { return gid + '::' + vkey; }
  function visibleGroups() {
    var q = search.trim();
    return groups.filter(function (g) {
      if (q && String(g.name).indexOf(q) < 0) return false;
      if (filter === 'all') return true;
      if (filter === 'avail') return g.availTotal > 0;
      if (filter === 'plain') return g.variants.some(function (v) { return v.score === 0 && v.avail > 0; });
      if (filter === 'affix') return g.variants.some(function (v) { return v.score > 0 && v.avail > 0; });
      return true;
    });
  }
  function selectableRows(g) {
    return g.variants.filter(function (v) { return v.avail > 0; });
  }
  function selTotals() {
    var n = 0, gold = 0;
    groups.forEach(function (g) {
      g.variants.forEach(function (v) {
        if (v.avail > 0 && sel[rowKey(g.id, v.key)]) { n += v.avail; gold += v.avail * v.gold; }
      });
    });
    return { n: n, gold: gold, dia: n * DIA_PER_RELIC };
  }

  // ── 版面 ──────────────────────────────────────────────────
  var layer = null, searchTimer = null;

  function build() {
    var m = document.createElement('div');
    m.id = 'rb-modal';
    m.innerHTML =
      '<div class="rb-box">' +
        '<div class="rb-head">' +
          '<div class="rb-title">🏺 遺物整理</div>' +
          '<div class="rb-bal" id="rb-bal"></div>' +
          '<button id="rb-x" class="rb-x" type="button" aria-label="關閉">✕</button>' +
        '</div>' +
        '<div class="rb-tools">' +
          '<input id="rb-search" class="rb-search" type="search" placeholder="搜尋遺物名稱…" autocomplete="off">' +
          '<div class="rb-chips" id="rb-chips">' +
            '<button class="rb-chip is-on" data-f="avail" type="button">可整理</button>' +
            '<button class="rb-chip" data-f="plain" type="button">白板</button>' +
            '<button class="rb-chip" data-f="affix" type="button">有詞綴</button>' +
            '<button class="rb-chip" data-f="all" type="button">全部</button>' +
          '</div>' +
        '</div>' +
        '<div class="rb-note">每個遺物會自動留最好的 1 件，標「保留」的那列不會被清掉。</div>' +
        '<div class="rb-acts">' +
          '<button id="rb-all" class="rb-mini" type="button">全選</button>' +
          '<button id="rb-plain" class="rb-mini" type="button">只選白板</button>' +
          '<button id="rb-none" class="rb-mini" type="button">取消選取</button>' +
        '</div>' +
        '<div id="rb-list" class="rb-list"></div>' +
        '<div class="rb-foot">' +
          '<div class="rb-sum" id="rb-sum"></div>' +
          '<div class="rb-btns">' +
            '<button id="rb-sell" class="rb-go rb-go-gold" type="button" disabled>賣出換金幣</button>' +
            '<button id="rb-dia" class="rb-go rb-go-dia" type="button" disabled>回收換龍鑽</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);

    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('rb-x').addEventListener('click', close);
    document.getElementById('rb-sell').addEventListener('click', function () { runAction('gold'); });
    document.getElementById('rb-dia').addEventListener('click', function () { runAction('dia'); });

    document.getElementById('rb-all').addEventListener('click', function () {
      visibleGroups().forEach(function (g) { selectableRows(g).forEach(function (v) { sel[rowKey(g.id, v.key)] = true; }); });
      render();
    });
    document.getElementById('rb-plain').addEventListener('click', function () {
      sel = Object.create(null);
      visibleGroups().forEach(function (g) {
        selectableRows(g).forEach(function (v) { if (v.score === 0) sel[rowKey(g.id, v.key)] = true; });
      });
      render();
    });
    document.getElementById('rb-none').addEventListener('click', function () { sel = Object.create(null); render(); });

    document.getElementById('rb-chips').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.rb-chip') : null;
      if (!b) return;
      filter = b.dataset.f;
      render();
    });

    var s = document.getElementById('rb-search');
    s.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        search = s.value || '';
        var lv = document.getElementById('rb-list'); if (lv) lv.scrollTop = 0;
        render();
      }, 150);
    });

    // 事件委派:展開/收合整組、切換單列勾選
    document.getElementById('rb-list').addEventListener('click', function (e) {
      var head = e.target.closest ? e.target.closest('.rb-g-head') : null;
      if (head) {
        var g0 = groups.filter(function (x) { return x.id === head.dataset.id; })[0];
        if (g0) { g0.expanded = !g0.expanded; render(); }
        return;
      }
      var row = e.target.closest ? e.target.closest('.rb-v[data-k]') : null;
      if (!row) return;
      var k = row.dataset.k;
      if (sel[k]) delete sel[k]; else sel[k] = true;
      render();
    });
  }

  function render() {
    var host = document.getElementById('rb-list');
    if (!host) return;
    var chips = document.querySelectorAll('#rb-chips .rb-chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('is-on', chips[i].dataset.f === filter);

    var vis = visibleGroups();
    if (!vis.length) {
      host.innerHTML = '<div class="rb-empty">' +
        (groups.length ? '沒有符合的遺物。' : '背包和倉庫裡沒有可整理的遺物。') + '</div>';
    } else {
      host.innerHTML = vis.map(renderGroup).join('');
    }

    var t = selTotals();
    var sum = document.getElementById('rb-sum');
    if (sum) {
      sum.innerHTML = t.n
        ? '已選 <b>' + t.n + '</b> 件　<span class="rb-gold">💰 ' + t.gold.toLocaleString() + '</span>　<span class="rb-dia">🔷 ' + t.dia + '</span>'
        : '<span class="rb-dim">點一列來選取</span>';
    }
    var bd = document.getElementById('rb-dia'), bs = document.getElementById('rb-sell');
    if (bs) bs.disabled = !t.n;
    if (bd) { bd.disabled = !t.n; bd.style.display = diaReady() ? '' : 'none'; }
    var bal = document.getElementById('rb-bal');
    if (bal) bal.innerHTML = diaReady() ? '🔷 <b>' + diaBalance().toLocaleString() + '</b>' : '';
  }

  function renderGroup(g) {
    var picked = selectableRows(g).filter(function (v) { return sel[rowKey(g.id, v.key)]; })
                                  .reduce(function (s, v) { return s + v.avail; }, 0);
    var head =
      '<div class="rb-g-head' + (g.expanded ? ' is-open' : '') + '" data-id="' + esc(g.id) + '">' +
        '<img class="rb-ico" src="' + esc(g.icon) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="rb-g-main">' +
          '<div class="rb-g-name">' + esc(g.name) + '</div>' +
          '<div class="rb-g-sub">共 ' + g.total + ' 件' +
            (g.availTotal ? '　可整理 <b>' + g.availTotal + '</b>' : '　<span class="rb-dim">只有保留的那件</span>') +
            (g.locked ? '　<span class="rb-lockdim">🔒 ' + g.locked + '</span>' : '') +
          '</div>' +
        '</div>' +
        (picked ? '<span class="rb-count">已選 ' + picked + '</span>' : '') +
        '<span class="rb-caret">' + (g.expanded ? '▾' : '▸') + '</span>' +
      '</div>';
    if (!g.expanded) return '<div class="rb-g">' + head + '</div>';

    var rows = g.variants.map(function (v) {
      var keep = (v.key === g.keepKey);
      var k = rowKey(g.id, v.key);
      var isSel = v.avail > 0 && !!sel[k];
      var srcTxt = [];
      if (v.inv) srcTxt.push('背包 ' + v.inv);
      if (v.wh) srcTxt.push('倉庫 ' + v.wh);
      return '<div class="rb-v' + (isSel ? ' is-sel' : '') + (v.avail > 0 ? '' : ' is-keep') + '"' +
             (v.avail > 0 ? ' data-k="' + esc(k) + '"' : '') + '>' +
        '<span class="rb-ck' + (isSel ? ' on' : '') + '">' + (v.avail > 0 ? (isSel ? '✓' : '') : '🔒') + '</span>' +
        '<span class="rb-v-name">' + fullNameHtml(v.sample) + affixPills(v.sample) + '</span>' +
        '<span class="rb-v-src">' + esc(srcTxt.join('・')) + '</span>' +
        '<span class="rb-v-n">' +
          (keep && v.cnt > v.avail ? '<i class="rb-pill rb-pill-keep">保留 1</i>' : '') +
          (v.avail > 0 ? '<b>' + v.avail + '</b> 件' : '') +
        '</span>' +
        // 整列都被保留(avail 0)就不印價格——那是「拿不到的錢」,寫出來只會誤導
        (v.avail > 0
          ? '<span class="rb-v-price"><i class="rb-gold">💰 ' + (v.gold * v.avail).toLocaleString() + '</i>' +
            (diaReady() ? '<i class="rb-dia">🔷 ' + (v.avail * DIA_PER_RELIC) + '</i>' : '') + '</span>'
          : '<span class="rb-v-price"></span>') +
      '</div>';
    }).join('');
    return '<div class="rb-g is-open">' + head + '<div class="rb-vs">' + rows + '</div></div>';
  }

  // ── 執行 ──────────────────────────────────────────────────
  // 依「目前選取」重新從實際資料取件(不用畫面上的快照),回傳 { ok, taken, gold, restore }
  function consumeSelected() {
    var p = P();
    if (!p || !Array.isArray(p.inv)) return { ok: false, error: '角色資料尚未就緒。' };

    var want = Object.create(null);   // id\0vkey -> 還要拿幾件
    var goldSum = 0, takenTotal = 0;
    groups.forEach(function (g) {
      g.variants.forEach(function (v) {
        if (v.avail > 0 && sel[rowKey(g.id, v.key)]) want[rowKey(g.id, v.key)] = v.avail;
      });
    });

    var invSnap = p.inv.map(function (it) { return it; });
    var invCnt = p.inv.map(entryCnt);
    var whBefore = null;

    // 背包
    var removeInv = [];
    for (var i = 0; i < p.inv.length; i++) {
      var it = p.inv[i];
      if (!it || it.lock || !isRelicId(it.id)) continue;
      var k = rowKey(it.id, variantKey(it));
      if (!want[k]) continue;
      var take = Math.min(entryCnt(it), want[k]);
      if (take <= 0) continue;
      want[k] -= take; takenTotal += take; goldSum += take * sellPriceOf(it);
      var left = entryCnt(it) - take;
      if (left <= 0) removeInv.push(it); else it.cnt = left;
    }
    if (removeInv.length) p.inv = p.inv.filter(function (x) { return removeInv.indexOf(x) < 0; });

    // 倉庫(整份讀出→改→寫回,失敗就整串放棄)
    var needWh = false;
    for (var kk in want) { if (want[kk] > 0) { needWh = true; break; } }
    if (needWh) {
      var w = null;
      try { w = (typeof loadWarehouse === 'function') ? loadWarehouse() : null; } catch (e) {}
      if (!w || !Array.isArray(w.items)) { restoreInv(); return { ok: false, error: '讀不到倉庫資料，請重開視窗再試。' }; }
      whBefore = JSON.parse(JSON.stringify(w));
      var removeWh = [];
      for (var j = 0; j < w.items.length; j++) {
        var wi = w.items[j];
        if (!wi || wi.lock || !isRelicId(wi.id)) continue;
        var wk = rowKey(wi.id, variantKey(wi));
        if (!want[wk]) continue;
        var wtake = Math.min(entryCnt(wi), want[wk]);
        if (wtake <= 0) continue;
        want[wk] -= wtake; takenTotal += wtake; goldSum += wtake * sellPriceOf(wi);
        var wleft = entryCnt(wi) - wtake;
        if (wleft <= 0) removeWh.push(wi); else wi.cnt = wleft;
      }
      if (removeWh.length) w.items = w.items.filter(function (x) { return removeWh.indexOf(x) < 0; });
      var okw = false;
      try { okw = (typeof saveWarehouse === 'function') && saveWarehouse(w) !== false; } catch (e) { okw = false; }
      if (!okw) { restoreInv(); return { ok: false, error: '倉庫寫入失敗，什麼都沒有變動。' }; }
    }

    function restoreInv() {
      p.inv = invSnap;
      for (var z = 0; z < invSnap.length; z++) invSnap[z].cnt = invCnt[z];
    }
    function restoreAll() {
      restoreInv();
      if (whBefore) {
        try { if (typeof loadWarehouse === 'function') loadWarehouse(); } catch (e) {}   // 先重讀,讓 js/12 的 uid 快照跟上(同 js/24 的回滾註解)
        try { if (typeof saveWarehouse === 'function') saveWarehouse(whBefore); } catch (e) {}
      }
    }
    return { ok: true, taken: takenTotal, gold: goldSum, restore: restoreAll };
  }

  function runAction(mode) {
    if (!loaded()) return;
    var t = selTotals();
    if (!t.n) return;
    if (mode === 'dia' && !diaReady()) return;

    var msg = mode === 'dia'
      ? '回收 ' + t.n + ' 件遺物，換 ' + t.dia + ' 顆龍之鑽石？'
      : '賣出 ' + t.n + ' 件遺物，換 ' + t.gold.toLocaleString() + ' 金幣？';
    var go = function () { doAction(mode); };
    if (window.AFK_UI && typeof AFK_UI.confirm === 'function') {
      AFK_UI.confirm({ title: mode === 'dia' ? '回收換龍鑽' : '賣出換金幣', message: msg + '\n交出去就拿不回來。', okText: '確定', cancelText: '取消', danger: true, onOk: go });
    } else if (typeof confirm === 'function') {
      if (confirm(msg + ' 交出去就拿不回來。')) go();
    } else { go(); }
  }

  function doAction(mode) {
    var t = selTotals();
    var p = P();
    if (!p || !t.n) return;

    // 🚨 先加鑽再消耗:萬一中途整個分頁掛掉,玩家是「拿了鑽石但東西還在」,而不是「東西沒了卻什麼都沒拿」。
    var diaGiven = 0;
    if (mode === 'dia') {
      var r = diaAdjust(t.dia);
      if (!r.ok) { toast(r.error || '龍之鑽石異動失敗。', true); return; }
      diaGiven = t.dia;
    }

    var res = consumeSelected();
    if (!res.ok) {
      if (diaGiven) diaAdjust(-diaGiven);
      toast(res.error || '整理失敗，什麼都沒有變動。', true);
      return;
    }

    var goldBefore = Math.max(0, Math.floor(Number(p.gold) || 0));
    if (mode === 'gold') p.gold = goldBefore + res.gold;

    if (!persistOk()) {   // 存檔沒落盤 → 整串退回去(鑽石也要扣回來,否則兩份資料不同步)
      if (mode === 'gold') p.gold = goldBefore;
      res.restore();
      if (diaGiven) diaAdjust(-diaGiven);
      toast('存檔失敗，什麼都沒有變動。', true);
      return;
    }

    sel = Object.create(null);
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    toast(mode === 'dia'
      ? '整理了 ' + res.taken + ' 件遺物，獲得龍之鑽石 × ' + diaGiven + '。'
      : '整理了 ' + res.taken + ' 件遺物，獲得 ' + res.gold.toLocaleString() + ' 金幣。');
    scan();
    render();
  }

  function toast(text, bad) {
    try {
      if (typeof logSys === 'function') {
        logSys('<span class="' + (bad ? 'text-red-400' : 'text-amber-300') + '">' + esc(text) + '</span>');
        return;
      }
    } catch (e) {}
    try { console.log('[AFK-relicbatch] ' + text); } catch (e) {}
  }

  // ── 開關視窗 ──────────────────────────────────────────────
  function open() {
    if (!on()) return;
    if (!loaded()) return;
    if (!document.getElementById('rb-modal')) { injectCss(); build(); }
    try { if (window.AFK_BANNER) AFK_BANNER.remeasure(); } catch (e) {}
    sel = Object.create(null); filter = 'avail'; search = '';
    var s = document.getElementById('rb-search'); if (s) s.value = '';
    var lv = document.getElementById('rb-list'); if (lv) lv.scrollTop = 0;
    scan();
    document.getElementById('rb-modal').style.display = 'flex';
    render();
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;   // 手機返回鍵 / ESC 可關
  }
  function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose(); }
  function doClose() {
    layer = null;
    var m = document.getElementById('rb-modal');
    if (m) m.style.display = 'none';
  }

  // ── 入口 ①:遺物收集冊頁首 ────────────────────────────────
  function hookRelicBook() {
    if (typeof window.renderRelicBook !== 'function' || window.renderRelicBook.__afkRelicBatch) return false;
    var orig = window.renderRelicBook;
    window.renderRelicBook = function () {
      var ret = orig.apply(this, arguments);
      if (on()) {
        try {
          var host = document.getElementById('relic-book-body');
          if (host && !host.querySelector('#rb-open')) {
            var b = document.createElement('button');
            b.id = 'rb-open'; b.type = 'button'; b.className = 'rb-open';
            b.innerHTML = '🧹 整理重複遺物';
            b.addEventListener('click', open);
            host.insertBefore(b, host.firstChild);
          }
        } catch (e) { /* 入口沒插上不影響功能本體 */ }
      }
      return ret;
    };
    window.renderRelicBook.__afkRelicBatch = true;
    return true;
  }

  // ── 入口 ②:自動化分頁的「🔌 外掛」列(沿用 afk-training / afk-dex 的共用列) ──
  function injectAutoNav() {
    var panel = document.getElementById('tab-automation');
    if (!panel) return false;
    if (document.getElementById('m-afk-nav-relicbatch')) return true;
    var row = document.getElementById('m-afk-navrow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      panel.appendChild(row);
    }
    var b = document.createElement('button');
    b.id = 'm-afk-nav-relicbatch'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%'; b.style.marginTop = '8px';
    b.textContent = '🏺 遺物整理';
    b.addEventListener('click', open);
    row.appendChild(b);
    return true;
  }

  // ── CSS ───────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('rb-css')) return;
    var st = document.createElement('style');
    st.id = 'rb-css';
    st.textContent = [
      /* 遺物收集冊頁首那顆入口鈕 */
      '.rb-open{display:block;width:100%;margin:0 0 12px;padding:9px 12px;border:1px solid #0e7490;border-radius:9px;',
      '  background:linear-gradient(135deg,#0b3b4f,#0e5a70);color:#a5f3fc;font-weight:800;font-size:14px;cursor:pointer;',
      '  font-family:inherit;transition:filter .12s;}',
      '.rb-open:hover{filter:brightness(1.18)}',
      /* 視窗外框:頂端讓開橫幅(--orig-bar-h 由 afk-banner 量;沒人設時 0 剛好正確) */
      '#rb-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9700;background:rgba(2,6,23,.72);',
      '  display:none;align-items:center;justify-content:center;padding:14px;}',
      '.rb-box{width:min(720px,96vw);display:flex;flex-direction:column;',
      '  height:min(calc((100vh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) * .92),820px);',
      '  height:min(calc((100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) * .92),820px);',
      '  background:#0b1220;border:2px solid #0e7490;border-radius:14px;overflow:hidden;',
      '  box-shadow:0 22px 60px rgba(0,0,0,.75);color:#e2e8f0;font-family:inherit;}',
      /* 標題列:沿用遺物收集冊的藍 */
      '.rb-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:11px 14px;',
      '  border-bottom:1px solid #155e75;background:linear-gradient(to bottom,#0b2e40,#08222e);}',
      '.rb-title{flex:1;min-width:0;font-size:17px;font-weight:900;color:#38bdf8;',
      '  text-shadow:0 0 6px rgba(56,189,248,.55);letter-spacing:.02em;}',
      '.rb-bal{flex:0 0 auto;font-size:13px;color:#a5f3fc;}',
      '.rb-x{flex:0 0 auto;width:30px;height:30px;border:1px solid #475569;border-radius:7px;background:#1e293b;',
      '  color:#cbd5e1;font-size:14px;line-height:1;cursor:pointer;padding:0;font-family:inherit;}',
      '.rb-x:hover{background:#334155}',
      /* 工具列 */
      '.rb-tools{flex:0 0 auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px 8px;}',
      '.rb-search{flex:1;min-width:150px;box-sizing:border-box;background:#0f172a;border:1px solid #334155;',
      '  color:#e2e8f0;border-radius:8px;padding:8px 11px;font-size:15px;font-family:inherit;}',
      '.rb-search:focus{outline:none;border-color:#0e7490}',
      '.rb-chips{display:flex;gap:5px;flex-wrap:wrap}',
      '.rb-chip{padding:6px 11px;border:1px solid #334155;border-radius:999px;background:#0f172a;color:#94a3b8;',
      '  font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .12s;}',
      '.rb-chip:hover{border-color:#475569;color:#cbd5e1}',
      '.rb-chip.is-on{background:#0e7490;border-color:#22d3ee;color:#ecfeff}',
      '.rb-note{flex:0 0 auto;padding:0 14px 8px;font-size:12px;color:#7dd3fc;}',
      '.rb-acts{flex:0 0 auto;display:flex;gap:6px;padding:0 14px 9px;border-bottom:1px solid #1e293b;}',
      '.rb-mini{padding:5px 10px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#cbd5e1;',
      '  font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.rb-mini:hover{background:#334155}',
      /* 清單 */
      '.rb-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:9px 10px;}',
      '.rb-empty{padding:44px 16px;text-align:center;color:#64748b;font-size:13px;}',
      '.rb-g{margin-bottom:6px;border:1px solid #1e293b;border-radius:10px;background:#0f172a;overflow:hidden;}',
      '.rb-g.is-open{border-color:#155e75}',
      '.rb-g-head{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;transition:background .12s;}',
      '.rb-g-head:hover{background:#14203a}',
      '.rb-ico{flex:0 0 auto;width:38px;height:38px;object-fit:contain;}',
      '.rb-g-main{flex:1;min-width:0}',
      '.rb-g-name{font-size:14px;font-weight:800;color:#38bdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rb-g-sub{font-size:11.5px;color:#94a3b8;margin-top:1px}',
      '.rb-g-sub b{color:#e2e8f0}',
      '.rb-count{flex:0 0 auto;font-size:11px;font-weight:800;color:#0b1220;background:#22d3ee;border-radius:999px;padding:2px 8px;}',
      '.rb-caret{flex:0 0 auto;color:#64748b;font-size:13px;width:12px;text-align:center}',
      '.rb-vs{border-top:1px solid #1e293b;background:#0b1220;padding:4px}',
      /* 詞綴列 */
      '.rb-v{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;',
      '  border:1px solid transparent;transition:background .1s,border-color .1s;}',
      '.rb-v:hover{background:#14203a}',
      '.rb-v.is-sel{background:#0c3a45;border-color:#22d3ee}',
      '.rb-v.is-keep{cursor:default;opacity:.62}',
      '.rb-v.is-keep:hover{background:transparent}',
      '.rb-ck{flex:0 0 auto;width:19px;height:19px;border:1px solid #475569;border-radius:5px;background:#0f172a;',
      '  display:flex;align-items:center;justify-content:center;font-size:12px;color:#0b1220;font-weight:900;}',
      '.rb-ck.on{background:#22d3ee;border-color:#22d3ee}',
      '.rb-v-name{flex:1;min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rb-v-src{flex:0 0 auto;font-size:10.5px;color:#64748b;white-space:nowrap}',
      '.rb-v-n{flex:0 0 auto;font-size:11.5px;color:#94a3b8;white-space:nowrap}',
      '.rb-v-n b{color:#e2e8f0;font-size:12.5px}',
      '.rb-v-price{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-size:10.5px;font-style:normal;min-width:66px}',
      '.rb-v-price i{font-style:normal}',
      '.rb-gold{color:#fbbf24;font-style:normal}',
      '.rb-dia{color:#67e8f9;font-style:normal}',
      '.rb-dim{color:#64748b}',
      '.rb-lockdim{color:#94a3b8}',
      /* 詞綴小標 */
      '.rb-pill{display:inline-block;margin-left:4px;padding:0 5px;border-radius:4px;font-size:9.5px;font-style:normal;',
      '  font-weight:800;line-height:15px;vertical-align:middle;}',
      '.rb-pill-bless{background:#1e3a8a;color:#bfdbfe}',
      '.rb-pill-anc{background:#4c1d95;color:#ddd6fe}',
      '.rb-pill-attr{background:#065f46;color:#a7f3d0}',
      '.rb-pill-keep{background:#334155;color:#e2e8f0;margin:0 5px 0 0}',
      /* 底部 */
      '.rb-foot{flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;',
      '  border-top:1px solid #155e75;background:#0a1729;}',
      '.rb-sum{flex:1;min-width:130px;font-size:13px;color:#cbd5e1}',
      '.rb-sum b{color:#f8fafc;font-size:15px}',
      '.rb-btns{display:flex;gap:8px}',
      '.rb-go{padding:9px 15px;border-radius:9px;border:1px solid;font-size:13.5px;font-weight:800;',
      '  cursor:pointer;font-family:inherit;transition:filter .12s;}',
      '.rb-go:disabled{opacity:.38;cursor:not-allowed}',
      '.rb-go:not(:disabled):hover{filter:brightness(1.16)}',
      '.rb-go-gold{border-color:#b45309;background:linear-gradient(135deg,#78350f,#b45309);color:#fef3c7}',
      '.rb-go-dia{border-color:#0891b2;background:linear-gradient(135deg,#0e5a70,#0891b2);color:#ecfeff}',
      /* 手機 */
      '@media(max-width:760px){',
      '  #rb-modal{padding:0}',
      '  .rb-box{width:100vw;border-radius:0;border-left:0;border-right:0;',
      '    height:calc(100vh - var(--orig-bar-h,0px) - var(--m-nav-h,0px));',
      '    height:calc(100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px));}',
      '  .rb-v-src{display:none}',
      '  .rb-title{font-size:16px}',
      '  .rb-go{flex:1;padding:11px 10px}',
      '  .rb-btns{width:100%}',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  // ── 起動 ──────────────────────────────────────────────────
  function init() {
    if (typeof isRelic !== 'function' || typeof getSellPrice !== 'function' || !ITEMS()) {
      console.warn('[AFK-relicbatch] 缺少 isRelic / getSellPrice / DB，遺物整理停用（遊戲照常運作）。');
      return;
    }
    injectCss();
    var okBook = hookRelicBook();
    var tries = 0;
    var t = setInterval(function () {
      var okNav = injectAutoNav();
      if (okNav || ++tries > 40) clearInterval(t);
    }, 250);
    injectAutoNav();
    window.AFK_RELICBATCH = { open: open, close: close };
    console.log('[AFK-relicbatch] hooks OK — 遺物整理（賣金幣／回收換龍鑽 ' + DIA_PER_RELIC + ' 顆・每個遺物自動留 ' + KEEP_PER_ID + ' 件）'
      + (okBook ? '' : '・收集冊入口未掛上'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
