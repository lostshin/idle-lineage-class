/* ============================================================================
 * afk-battlehud.js — 手機戰鬥畫面的加強版狀態列（取代上游只有 HP/MP 兩條的 #mobile-vitals）
 *
 * 上游手機版在戰鬥畫面頂端釘一條 #mobile-vitals，只有 HP / MP 兩條血條。本外掛換成資訊完整的一條：
 *   第一列：暱稱 / 等級 / 防(AC) / 魔防(MR) / 金幣 ＋ 席琳的世界標記
 *   第二列：HP / MP 雙血條（條上直接寫數值）
 *   底  部：經驗值細線（整條的最下緣，不佔高度）
 *
 * 資料來源＝把桌機狀態面板既有元素的文字/寬度「鏡射」過來（只讀 id，不碰原作者的計算與渲染）：
 *   st-class(暱稱) / st-lv / st-ac / st-mr / st-gold / txt-hp / txt-mp / bar-hp / bar-mp / bar-exp。
 *   讀不到就顯示 '--'，任何一項失效都不會影響其他項，也不會弄壞遊戲。
 *
 * 🔮 席琳的世界只顯示一個字（席＝一般、瘋＝瘋狂），狀態列本身不換底色——底色會蓋掉血條的辨識度，
 *   而且 body 上早有核心給的 .sherine-world / .sherine-mad，要辨識世界狀態不缺這一味。
 *
 * 兩種顯示模式（都自己判，不讀別的外掛掛的 class）：
 *   ①手機：條件＝與核心顯示 #mobile-vitals 完全同一條 media query，位置＝上游手機單欄流的第一個（sticky 釘頂）。
 *   ②平板缺口：我方手機殼已套上、但上游那條窄 media query 不成立（例：直向 890px 觸控平板）→ #game-screen
 *     其實還是桌機三欄，所以改放進「目前顯示的那一欄」裡當普通區塊（見 placeStrip）。
 *     這裡讀 body.m-mobile 是對的：手機殼被關掉＝畫面回三欄，桌機完整狀態面板本來就看得到，這條不該出現。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-battlehud.js">；DOM 掛點 #m-status 列入 smoke。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('battlehud')) return;   // 🎚️ 外掛開關:關掉就退回上游原版的 #mobile-vitals

  // ⚠ 必須與 css/style.css 裡「顯示 #mobile-vitals」那條 media query 一字不差,否則會出現
  //   「兩條狀態列同時在」或「兩條都不見」的破口(例如橫向手機 max-height 那半條)。
  //   ⚠ 也不可為了平板把它放寬:模式①的 CSS(sticky/order:-11)是「上游手機單欄版面」的一員,
  //   放寬到 890px 會讓這條變成桌機三欄裡的第四欄 → 戰鬥區被擠掉、喝水鈕消失(2026-07-26 玩家回報)。
  //   平板走模式②(placeStrip)處理,不動這條。
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var MIRROR_MS = 300;   // 鏡射頻率:值多半沒變,只在真的變了才寫 DOM,300ms 對眼睛已是即時

  var SRC = {   // 鏡射來源:桌機狀態面板的元素 id(上游改 id 的話這裡會顯示 '--',不會壞遊戲)
    name: 'st-class', nameFallback: 'st-classname',
    lv: 'st-lv', ac: 'st-ac', mr: 'st-mr', gold: 'st-gold',
    hp: 'txt-hp', mp: 'txt-mp', hpBar: 'bar-hp', mpBar: 'bar-mp', expBar: 'bar-exp'
  };

  // 🚧 非官方橫幅自己量:它 z-index 是 int 上限,壓得過任何外掛,狀態列釘在 top:0 會被整條蓋掉。
  //   afk-mobile 也量了同一個橫幅(--orig-bar-h)並把 #game-screen 整個下移,但那支可以被玩家關掉——
  //   讀它的變數等於「別人關了我就被蓋住」。故這裡自己找、自己算,兩支各自成立、互不依賴。
  //   算法是「橫幅底緣超出 #game-screen 頂端多少」→ afk-mobile 已讓位時差值為 0,不會重複讓位。
  // 找到過就記著:整支的成本都在這裡(走一遍 body 子節點 + 每個 getComputedStyle),
  //   而橫幅是外部注入後就固定的節點。節點被移掉才重找。
  var _banner = null;
  function findBanner() {
    if (_banner && _banner.isConnected) return _banner;
    _banner = findBannerScan();
    return _banner;
  }
  function findBannerScan() {
    var els = document.body ? document.body.children : [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i], s;
      if (!e || e.tagName !== 'DIV') continue;
      try { s = getComputedStyle(e); } catch (_) { continue; }
      if (s.position === 'fixed' && s.top === '0px' && parseInt(s.zIndex || '0', 10) > 1000000) {
        if (/shines871|官方|非官方|轉載/.test(e.textContent || '')) return e;
      }
    }
    return null;
  }
  function fitTop() {
    var gs = document.getElementById('game-screen'), strip = document.getElementById('m-status');
    if (!gs || !strip) return;
    if (document.body.classList.contains('afk-hud-tab')) { strip.style.top = ''; }   // 平板缺口是靜態區塊,不需要 sticky 讓位
    var bar = findBanner(), barBottom = bar ? Math.max(0, Math.ceil(bar.getBoundingClientRect().bottom)) : 0;
    // 狀態列是 sticky in #game-screen → 要的是「橫幅底緣超出容器頂端多少」(容器已被讓位時為 0)
    var top = Math.max(0, barBottom - Math.round(gs.getBoundingClientRect().top));
    var v = top + 'px';
    if (strip.style.top !== v) strip.style.top = v;
    // 角色資訊彈窗是 fixed 貼視窗 → 要的是橫幅在視窗內的絕對底緣
    document.documentElement.style.setProperty('--afk-hud-bar-h', barBottom + 'px');
  }

  // 節流版:最多每 FIT_MIN_MS 量一次,期間內的重複請求併成一次(尾端補跑,不會漏掉最後那次變動)
  var FIT_MIN_MS = 300;
  var _fitLast = 0, _fitPending = null;
  function fitTopThrottled() {
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var wait = FIT_MIN_MS - (now - _fitLast);
    if (wait <= 0) { _fitLast = now; fitTop(); return; }
    if (_fitPending) return;
    _fitPending = setTimeout(function () {
      _fitPending = null;
      _fitLast = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      fitTop();
    }, wait);
  }

  // 剛切到遊戲畫面時版面還在安頓(橫幅圖載入、afk-mobile 讓位、字型換行)→ 隔幾個時間點各量一次
  function refitSoon() {
    try { requestAnimationFrame(function () { requestAnimationFrame(fitTop); }); } catch (e) { fitTop(); }
    [120, 400, 1200, 2500].forEach(function (ms) { setTimeout(fitTop, ms); });
  }

  function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }
  function barW(id) { var e = document.getElementById(id); return (e && e.style.width) ? e.style.width : '0%'; }
  function setTxt(el, v) { if (el && el.textContent !== v) el.textContent = v; }
  function setW(el, v) { if (el && el.style.width !== v) el.style.width = v; }

  function buildStrip() {
    var d = document.createElement('div');
    d.id = 'm-status';
    d.innerHTML =
      '<div class="ms-row ms-row1">' +
        '<span class="ms-seg ms-name"><b id="ms-name">--</b></span>' +
        '<span class="ms-seg ms-lv">Lv <b id="ms-lv">--</b></span>' +
        '<span class="ms-seg ms-ac">防 <b id="ms-ac">--</b></span>' +
        '<span class="ms-seg ms-mr">魔防 <b id="ms-mr">--</b></span>' +
        '<span class="ms-seg ms-gold">💰 <span id="ms-gold">--</span></span>' +
      '</div>' +
      '<div class="ms-row ms-row2">' +
        '<div class="ms-bar ms-hp"><i class="ms-bar-fill" id="ms-hp-bar"></i><span class="ms-bar-txt"><b>HP</b> <span id="ms-hp">--</span></span></div>' +
        '<div class="ms-bar ms-mp"><i class="ms-bar-fill" id="ms-mp-bar"></i><span class="ms-bar-txt"><b>MP</b> <span id="ms-mp">--</span></span></div>' +
        // 🔮 席琳標記放血條右邊(＝分家版王冠的位置);血條是 flex:1 自動讓出這一格的寬度
        '<span class="ms-seg ms-sherine" id="ms-sherine" style="display:none"></span>' +
        '<span class="ms-seg ms-info" title="點狀態列看完整角色資訊">ⓘ</span>' +
      '</div>' +
      '<div id="ms-exp"></div>';
    return d;
  }

  // --- 角色資訊彈窗 -----------------------------------------------------------
  // 點狀態列 → 把桌機的 #status-panel「移進」彈窗(移動而非複製,值才會即時更新;名字也還能點 st-class
  //   用原生 startEditName 改)。關閉時放回原位。
  // 為什麼手機需要這個:afk-mobile 的底部導覽一次只顯示一欄,在「戰鬥」那欄看不到左欄的 #status-panel,
  //   完整能力值就沒地方看了。上游單欄堆疊時它本來就在下面 → 這個彈窗只是多一條捷徑,不衝突。
  var _statLayer = null;
  var _spHome = null;   // #status-panel 的原位:{parent, next};不假設它在哪一欄,原地記原地放
  function buildStatModal() {
    var m = document.createElement('div');
    m.id = 'm-stat-modal';
    m.innerHTML = '<div id="m-stat-card"><div id="m-stat-bar"><button type="button" id="m-stat-close" title="關閉">✕</button></div><div id="m-stat-body"></div></div>';
    m.addEventListener('click', function (e) { if (e.target === m) closeStatModal(); });   // 點背景關閉
    m.querySelector('#m-stat-close').addEventListener('click', function (e) { e.stopPropagation(); closeStatModal(); });
    document.body.appendChild(m);
    return m;
  }
  function openStatModal() {
    if (document.body.classList.contains('m-stat-open')) return;
    var sp = document.getElementById('status-panel');
    var m = document.getElementById('m-stat-modal') || buildStatModal();
    var body = m.querySelector('#m-stat-body');
    if (!sp || !body) return;
    if (!_spHome) _spHome = { parent: sp.parentNode, next: sp.nextSibling };
    body.appendChild(sp);
    document.body.classList.add('m-stat-open');
    // 壓一層 → 手機實體返回鍵 / ESC 關得掉(與其他自製彈窗同一套管理器)
    _statLayer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(dismissStatModal) : null;
  }
  function closeStatModal() {
    if (_statLayer && window.AFK_UI && AFK_UI.closeLayer) AFK_UI.closeLayer(_statLayer);
    else dismissStatModal();
  }
  // 實際收起(也會被 AFK_UI 在返回鍵 / ESC 時呼叫;自己不動歷史)
  function dismissStatModal() {
    _statLayer = null;
    document.body.classList.remove('m-stat-open');
    var sp = document.getElementById('status-panel');
    if (!sp || !_spHome || !_spHome.parent) return;
    // next 可能已被別處移走 → 只有它「還是同一個父層的小孩」才拿來當插入點,否則接回尾端
    var next = (_spHome.next && _spHome.next.parentNode === _spHome.parent) ? _spHome.next : null;
    _spHome.parent.insertBefore(sp, next);
  }

  function injectCSS() {
    if (document.getElementById('afk-battlehud-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-battlehud-style';
    s.textContent = [
      '#m-status,#m-stat-modal{display:none;}',   /* 桌機:本外掛完全不出現(桌機有完整的狀態面板) */
      /* 外觀(無條件宣告:沒啟用時 display:none 看不到) —— 沿用上游 #mobile-vitals 的皮,換掉的只是內容 */
      '#m-status{flex-direction:column;flex:0 0 auto;gap:6px;width:100%;padding:6px 8px 8px;border:1px solid #8d6846;border-radius:4px;background:linear-gradient(180deg,rgba(48,47,57,.98),rgba(28,27,34,.98));box-shadow:0 4px 12px rgba(0,0,0,.72);font-size:13px;color:#e8e2d6;line-height:1.2;}',
      /* 啟用模式①手機:上游手機版面在 → 它就是單欄流裡的一員(sticky 釘頂、order 排到最前) */
      '@media ' + MOBILE_MQ + '{',
      '#mobile-vitals{display:none !important;}',
      '#m-status{display:flex !important;position:sticky;top:0;z-index:70;order:-11;}',
      '}',
      /* 啟用模式②平板缺口:手機殼在、但上游手機版面(那條窄 media query)不在 → #game-screen 其實還是桌機三欄。
         這時**不能**當 #game-screen 的 flex 子項(會變成第四欄把戰鬥區擠掉,2026-07-26 踩過),
         由 JS 放進「目前顯示的那一欄」裡當普通區塊(見 placeStrip)。 */
      'body.afk-hud-tab #m-status{display:flex !important;position:sticky;top:0;z-index:70;order:0;margin:0 0 6px;}',
      'body.afk-hud-tab #mobile-vitals{display:none !important;}',
      /* 以下都是 #m-status / #m-stat-* 自己的內部外觀,兩種模式共用 → 不包 media query
         (沒啟用時整條 display:none,無條件宣告不會影響桌機) */
      '#m-status .ms-row{display:flex;align-items:center;}',
      '#m-status .ms-row1{gap:6px 12px;flex-wrap:wrap;}',
      '#m-status .ms-seg{white-space:nowrap;}',
      /* 暱稱可能很長:限寬 + 省略號,免把整列擠爆(其餘欄位都是短數字) */
      '#m-status #ms-name{display:inline-block;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;color:#fff;font-weight:bold;font-size:14px;}',
      '#m-status .ms-lv,#m-status .ms-ac,#m-status .ms-mr{color:#b3a893;}',
      '#m-status #ms-lv{color:#fff;font-size:15px;}',
      '#m-status #ms-ac,#m-status #ms-mr{color:#bfdbfe;font-size:14px;}',
      '#m-status .ms-gold{color:#fbbf24;font-weight:bold;}',
      /* 🔮 席琳標記靠右;只換字色不換整條底色 */
      '#m-status .ms-sherine{flex:0 0 auto;font-weight:bold;font-size:14px;color:#c4b5fd;text-shadow:0 0 6px rgba(196,181,253,.85);}',
      '#m-status .ms-sherine.ms-sherine-mad{color:#fca5a5;text-shadow:0 0 7px rgba(248,113,113,.9);}',
      '#m-status .ms-info{flex:0 0 auto;color:#b3a893;font-size:13px;}',
      '#m-status{cursor:pointer;touch-action:manipulation;}',
      '#m-status:active{filter:brightness(1.18);}',
      /* 角色資訊彈窗:頂端讓開橫幅(用本外掛自己量的高度)、底部讓開手機導覽列(沒有就是 0) */
      'body.m-stat-open #m-stat-modal{display:flex;position:fixed;left:0;right:0;bottom:0;top:var(--afk-hud-bar-h,0px);z-index:80;align-items:center;justify-content:center;background:rgba(2,6,23,.72);padding:16px 16px calc(16px + var(--m-nav-h,0px));}',
      '#m-stat-card{position:relative;width:min(92vw,420px);max-height:100%;overflow-y:auto;}',
      '#m-stat-bar{display:flex;justify-content:flex-end;margin-bottom:6px;}',
      '#m-stat-close{width:36px;height:36px;border:1px solid #5f5148;border-radius:8px;background:rgba(40,38,46,.95);color:#e8e2d6;font-size:17px;font-family:inherit;cursor:pointer;touch-action:manipulation;}',
      '#m-stat-close:active{background:rgba(72,66,80,.95);}',
      '#m-stat-body{width:100%;}',
      /* 這個面板在手機被核心藏起來,移進彈窗要強制顯示 */
      '#m-stat-body #status-panel{display:flex !important;width:100% !important;margin:0 !important;}',
      '#m-status .ms-row2{gap:8px;}',
      '#m-status .ms-bar{position:relative;flex:1 1 0;min-width:0;height:20px;overflow:hidden;border:1px solid #5f5148;border-radius:2px;background:#15151b;}',
      '#m-status .ms-bar-fill{position:absolute;left:0;top:0;bottom:0;width:0%;transition:width .25s;}',
      '#m-status .ms-hp .ms-bar-fill{background:#dc2626;}',
      '#m-status .ms-mp .ms-bar-fill{background:#2563eb;}',
      '#m-status .ms-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.75);}',
      '#m-status .ms-hp .ms-bar-txt b{color:#fecaca;}',
      '#m-status .ms-mp .ms-bar-txt b{color:#bfdbfe;}',
      /* 經驗值:貼在整條最下緣的細線,不佔高度(絕對定位) */
      '#m-status #ms-exp{position:absolute;left:0;bottom:0;height:3px;width:0%;background:#eab308;transition:width .25s;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  var el = {};
  function cache(strip) {
    el.name = strip.querySelector('#ms-name');
    el.lv = strip.querySelector('#ms-lv');
    el.ac = strip.querySelector('#ms-ac');
    el.mr = strip.querySelector('#ms-mr');
    el.gold = strip.querySelector('#ms-gold');
    el.hp = strip.querySelector('#ms-hp');
    el.mp = strip.querySelector('#ms-mp');
    el.hpBar = strip.querySelector('#ms-hp-bar');
    el.mpBar = strip.querySelector('#ms-mp-bar');
    el.exp = strip.querySelector('#ms-exp');
    el.sherine = strip.querySelector('#ms-sherine');
  }

  // 🔮 '' / 'on'(席琳的世界) / 'mad'(瘋狂的席琳世界)
  function sherineState() {
    try {
      if (typeof sherineMadActive === 'function' && sherineMadActive()) return 'mad';
      if (typeof sherineWorldActive === 'function' && sherineWorldActive()) return 'on';
    } catch (e) {}
    return '';
  }

  var _lastSherine = null;
  function mirror() {
    var gs = document.getElementById('game-screen');
    if (!gs || gs.classList.contains('hidden')) return;   // 不在遊戲畫面(首頁/選角):整段跳過
    // ⏩ 離線補跑期間畫面是凍結的,鏡射純屬白工(且每 300ms 都在讀寫 DOM)→ 直接跳過。
    //   小補跑(ffSmall)照跑,免得補完停在舊數字。
    try { if (window.state && state.ff && !state.ffSmall) return; } catch (e) {}

    setTxt(el.name, txt(SRC.name) || txt(SRC.nameFallback) || '--');
    setTxt(el.lv, txt(SRC.lv) || '--');
    setTxt(el.ac, txt(SRC.ac) || '--');
    setTxt(el.mr, txt(SRC.mr) || '--');
    setTxt(el.gold, txt(SRC.gold) || '--');
    setTxt(el.hp, txt(SRC.hp) || '--');
    setTxt(el.mp, txt(SRC.mp) || '--');
    setW(el.hpBar, barW(SRC.hpBar));   // 跟原版血條同步寬度(讀遊戲自己算好的 %)
    setW(el.mpBar, barW(SRC.mpBar));
    setW(el.exp, barW(SRC.expBar));

    var sh = sherineState();
    if (sh !== _lastSherine) {
      _lastSherine = sh;
      if (el.sherine) {
        el.sherine.textContent = sh === 'mad' ? '瘋' : (sh === 'on' ? '席' : '');
        el.sherine.title = sh === 'mad' ? '瘋狂的席琳世界' : (sh === 'on' ? '席琳的世界' : '');
        el.sherine.classList.toggle('ms-sherine-mad', sh === 'mad');
        el.sherine.style.display = sh ? '' : 'none';
      }
    }
  }

  // 🩹 平板缺口:手機殼在(單欄切換+底部導覽),但上游那條手機版面 media query 不成立(寬 890 的直向平板)
  //   → 版面骨架其實還是桌機三欄。此時狀態列**不可以**待在 #game-screen 裡(會被當成第四欄,
  //   把戰鬥區壓成看不見、喝水鈕也擠掉:2026-07-26 玩家回報),改掛到 #game-screen 前面當獨立區塊。
  //   判斷只讀「手機殼有沒有套」+ 自己的 media query,不需要 afk-mobile 提供任何 API。
  function inTabletGap() {
    try {
      if (!document.body.classList.contains('m-mobile')) return false;
      return !matchMedia(MOBILE_MQ).matches;
    } catch (e) { return false; }
  }
  //   ⚠ #game-screen 是 position:absolute(釘在 #app-stage 裡)→ 把狀態列放它「外面」會被整張畫面蓋住(踩過)。
  //   平板缺口時改插進「目前顯示的那一欄」(手機殼一次只顯示一欄:col-left/col-center/col-right),
  //   在欄內就只是普通區塊 + sticky 釘欄頂,不會變成第四欄。切換分頁時本函式會把它搬到新的可見欄。
  function visibleCol(gs) {
    var kids = gs.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c.id && c.id.indexOf('col-') === 0 && c.getBoundingClientRect().width > 0) return c;
    }
    return null;
  }
  function placeStrip() {
    var strip = document.getElementById('m-status'), gs = document.getElementById('game-screen');
    if (!strip || !gs) return;
    var tab = inTabletGap();
    document.body.classList.toggle('afk-hud-tab', tab);
    if (!tab) {
      if (strip.parentNode !== gs || gs.firstChild !== strip) gs.insertBefore(strip, gs.firstChild);
      return;
    }
    var col = visibleCol(gs);
    if (!col) return;                                          // 還沒進遊戲(全部隱藏)→ 等下一輪
    if (strip.parentNode === col && col.firstChild === strip) return;
    col.insertBefore(strip, col.firstChild);
    strip.style.top = '';                                      // 欄內 sticky:讓位量由欄自己決定,不用 fitTop 算的值
  }

  function init() {
    var gs = document.getElementById('game-screen');
    if (!gs) { console.warn('[AFK-battlehud] 找不到 #game-screen，手機狀態列停用。'); return; }
    if (document.getElementById('m-status')) return;
    injectCSS();
    var strip = buildStrip();
    gs.insertBefore(strip, gs.firstChild);
    placeStrip();
    window.addEventListener('resize', placeStrip);
    window.addEventListener('orientationchange', placeStrip);
    setInterval(function () { if (!document.hidden) placeStrip(); }, 1000);   // 手機殼那支是非同步掛 body.m-mobile(還會隨轉向變) → 定期對齊一次即可,成本極低;背景分頁看不到畫面,跳過
    strip.addEventListener('click', openStatModal);   // 點整條 → 開角色資訊彈窗
    cache(strip);
    mirror();
    setInterval(function () { if (!document.hidden) mirror(); }, MIRROR_MS);   // 背景分頁鏡射純浪費;回前景下一輪(≤300ms)就補上
    // 橫幅是外部注入的、可能晚出現/換行改變高度 → 跟 afk-mobile 同樣的節奏補量幾次 + resize 時重量
    fitTop();
    var n = 0, iv = setInterval(function () { fitTop(); if (++n >= 12) clearInterval(iv); }, 1000);
    window.addEventListener('resize', fitTop);
    // ⚠ 開機後那 12 次量測全都發生在「還在首頁」——#game-screen 這時是 hidden,
    //   getBoundingClientRect().top 量到 0,算出來的讓位量是錯的。玩家在首頁待超過 12 秒
    //   才選角(很常見)就再也沒有重量的機會 → 進遊戲後等級/血/魔/經驗整條位置跑掉(玩家回報「有時」,
    //   差別就在選角快不快)。故改為「畫面真的出現/尺寸變化時」再量一次。
    ['loadGame', 'startGame'].forEach(function (fn) {
      var orig = window[fn];
      if (typeof orig !== 'function' || orig.__afkHud) return;
      var w = function () {
        var r = orig.apply(this, arguments);
        try { refitSoon(); } catch (e) {}
        return r;
      };
      w.__afkHud = true; window[fn] = w;
    });
    try {
      // ⚠ 要節流:#game-screen 的高度會隨戰鬥內容(日誌、清單)一直變,不節流等於每次變動都跑一次
      //   findBanner()——那支要走一遍 body 子節點並對每個做 getComputedStyle(強制重算樣式),很貴。
      if (window.ResizeObserver) new ResizeObserver(fitTopThrottled).observe(gs);
    } catch (e) {}
    console.log('[AFK-battlehud] hooks OK — 手機戰鬥狀態列已取代上游 #mobile-vitals。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
