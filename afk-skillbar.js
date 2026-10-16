/* ============================================================================
 * afk-skillbar.js — 手機戰鬥畫面下方的「主動技能」快捷列
 *
 * 上游把手動施放的技能（傳送術／能量感測／迷魅術／絕對屏障）只放在背包→技能分頁的技能書裡。
 * 手機一次只顯示一欄 → 想放絕對屏障或迷魅術得先切到技能分頁、翻到對的階、再點那一格，
 * 而這幾支正好都是「戰鬥中臨時要按」的技能，等切完分頁人早就死了（玩家回報）。
 * 本外掛在戰鬥框正下方插一列 #m-skillbar，把「已學會的手動技能」直接做成按鈕。
 *
 * 名單不寫死：掃 DB.skills 取 type==='manual' 且玩家已學會的，依 tier 排序 —— 上游日後新增
 *   手動技能會自動出現在這列，不必回來改這支。點下去就是核心的 manualCast(id)，
 *   MP／冷卻／沉默／屏障中不可行動……全部由核心自己判（我們不重刻條件，只把入口搬過來）。
 *
 * 按鈕只有圖示（與技能書同一張，認圖不認字），一排固定 5 格。畫面上唯一的字是冷卻剩幾秒
 *   （蓋在圖示上）；現在按不動（冷卻中／MP 不夠／屏障期間）就整顆調淡。技能名與說明走長按
 *   （data-tip-skill + .tip-host，由 afk-touchtip 借核心的資料框顯示；那支關掉也只是沒說明）。
 *
 * 顯示時機一律自己判，不讀別的外掛掛的 class（那些可被玩家關掉）：
 *   ・手機 → 與核心手機版面同一條 media query；桌機永遠 display:none（技能書本來就在旁邊）。
 *   ・平板缺口（我方手機殼在、上游手機 media query 不在）→ 自己算一次（tabletGap）。
 *   ・在不在戰鬥 → 看 #battle-view 有沒有 .hidden（村莊/城鎮時整列自動收起）。
 *   ・一支手動技能都還沒學 → 整列不出現（新角色不該多一條空框）。
 *
 * 位置：#battle-view 之後、#m-battle-buffs（afk-battlebuffs 的狀態欄）之前。找不到狀態欄
 *   （那支被玩家關掉）就直接接在戰鬥框後面 —— 位置需求是「戰鬥區下方」，不依賴那支存在。
 *
 * 更新：包核心 renderStatusEffects()（上游每 tick 呼叫一次），簽章沒變就不動 DOM；
 *   冷卻進簽章時已換算成「秒」，所以冷卻中最多每秒改一次畫面，不是每 100ms。
 *   按鈕本體只在「技能名單變了」時才重建 —— 免得手指按著的那顆被重繪掉、點擊失效。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-skillbar.js">；DOM 掛點 #m-skillbar。
 * ========================================================================== */
(function () {
  'use strict';

  // 先登錄再問開關：關掉時本檔提早 return，但面板仍列得出這一項（玩家才有辦法開回來）
  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'skillbar', name: '手機主動技能列', group: '遊戲介面', def: true,
      desc: '戰鬥框下方多一列已學會的手動技能按鈕（絕對屏障、迷魅術…），不用切到技能分頁'
    });
    if (!AFK_TOGGLES.enabled('skillbar')) return;
  }

  // 與 css/style.css 手機版面那條完全一致（afk-mapbar / afk-battlehud / afk-battlebuffs 也用同一條）
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var TICKS_PER_SEC = 10;   // 核心 TICK_MS=100 → manualCd 是 tick 數，除以這個才是秒
  var COLS = 5;             // 一排幾格（格子寬度固定，不隨學會幾支技能而變）
  var ICON_MAX = 44;        // 圖示上限 px（技能圖檔原生 64px，放太大會糊）

  var host = null, mq = null, lastIds = '', lastSig = '';
  var btns = {};   // skId → { el, cd, mp }

  // 平板缺口：我方已套手機殼(單欄+底部導覽)，但上游那條窄 media query 不成立 → CSS 不會生效，改用 body class 補
  function tabletGap() {
    try {
      if (!document.body.classList.contains('m-mobile')) return false;
      if (!mq) mq = matchMedia(MOBILE_MQ);
      return !mq.matches;
    } catch (e) { return false; }
  }

  function injectCSS() {
    if (document.getElementById('afk-skillbar-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-skillbar-style';
    s.textContent = [
      /* 外觀無條件宣告（沒顯示時 display:none 看不到）。固定 5 欄格線：技能再多也是一排 5 個、
         第 6 個換下一排，格子寬度不會因為學會幾支而變 —— 位置固定，手指才記得住。 */
      '#m-skillbar{display:none;grid-template-columns:repeat(' + COLS + ',1fr);gap:6px;flex:0 0 auto;margin:2px 12px 0;padding:6px;background:#0f172a;border:1px solid #334155;border-radius:10px;}',
      /* .on 由 JS 掛（＝現在在戰鬥畫面、且至少有一支手動技能）；顯示條件：手機 media query，或平板缺口 */
      '@media ' + MOBILE_MQ + '{',
      '#m-skillbar.on{display:grid;}',
      '}',
      'body.afk-skillbar-tab #m-skillbar.on{display:grid;}',
      '.mskb-btn{display:flex;align-items:center;justify-content:center;padding:4px;background:#1e293b;border:1px solid #475569;border-radius:8px;cursor:pointer;touch-action:manipulation;}',
      /* 🚨 現在按不動只調淡、不用 disabled 屬性:disabled 的元素不吃 touch/mouse 事件,
         長按看說明(afk-touchtip 走 touchstart 委派)會連帶失效——而冷卻中正是最想看說明的時候。
         按下去由核心 manualCast 自己擋並寫日誌(「技能冷卻中。」/「MP 不足。」),條件不重刻一份。 */
      '.mskb-btn.is-off{opacity:.45;}',
      /* 圖檔原生 64px：封頂在 ICON_MAX 免得放大糊掉，窄機才靠 width:100% 縮小 */
      '.mskb-ico{position:relative;display:block;width:100%;max-width:' + ICON_MAX + 'px;aspect-ratio:1;}',
      '.mskb-ico img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 1px 2px #000);}',
      '.mskb-cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;border-radius:5px;background:rgba(2,6,23,.74);color:#fca5a5;font-size:15px;font-weight:700;font-family:inherit;}',
      '.mskb-btn.is-cd .mskb-cd{display:flex;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function applyTab() {
    var tab = tabletGap();
    if (document.body.classList.contains('afk-skillbar-tab') !== tab) document.body.classList.toggle('afk-skillbar-tab', tab);
  }

  function inBattle() {
    var bv = document.getElementById('battle-view');
    return !!(bv && !bv.classList.contains('hidden'));
  }

  /** 已學會的手動技能 id（依 tier 由小到大；上游新增 type:'manual' 會自動吃到） */
  function manualIds() {
    if (typeof DB === 'undefined' || !DB.skills) return [];
    if (typeof player === 'undefined' || !player || !player.skills) return [];
    var out = [];
    for (var id in DB.skills) {
      var sk = DB.skills[id];
      if (sk && sk.type === 'manual' && player.skills.indexOf(id) !== -1) out.push(id);
    }
    out.sort(function (a, b) { return (+DB.skills[a].tier || 0) - (+DB.skills[b].tier || 0); });
    return out;
  }

  /** 這支技能現在要花多少 MP（走核心的 getMpCost，含各種減免；算不出來就用基礎值） */
  function mpCost(sk) {
    try { return player.d && player.d.getMpCost ? player.d.getMpCost(sk.mp || 0, sk.tier) : (sk.mp || 0); }
    catch (e) { return sk.mp || 0; }
  }

  function rebuild(ids) {
    host.innerHTML = '';
    btns = {};
    ids.forEach(function (id) {
      var sk = DB.skills[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mskb-btn tip-host';
      b.setAttribute('data-tip-skill', id);   // 長按看說明（afk-touchtip 借核心資料框；那支關掉也只是沒說明）
      b.setAttribute('aria-label', sk.n);
      b.onclick = function () { try { manualCast(id); } catch (e) {} };

      var ico = document.createElement('span');
      ico.className = 'mskb-ico';
      var img = document.createElement('img');
      img.src = (typeof getIconUrl === 'function') ? getIconUrl(sk, true) : '';
      img.alt = '';
      img.onerror = function () { this.style.display = 'none'; };
      var cd = document.createElement('span');
      cd.className = 'mskb-cd';
      ico.appendChild(img); ico.appendChild(cd);

      b.appendChild(ico);
      host.appendChild(b);
      btns[id] = { el: b, cd: cd };
    });
  }

  function sync() {
    if (!host) return;
    applyTab();
    var ids = inBattle() ? manualIds() : [];
    var show = ids.length > 0;
    if (host.classList.contains('on') !== show) host.classList.toggle('on', show);
    if (!show) return;

    var key = ids.join(',');
    if (key !== lastIds) { rebuild(ids); lastIds = key; lastSig = ''; }

    // 冷卻換算成「秒」才進簽章 → 冷卻中最多每秒重寫一次，不是每 100ms
    var barrier = false;
    try { barrier = typeof inAbsBarrier === 'function' && inAbsBarrier(); } catch (e) {}
    var sig = barrier ? 'B' : '-', st = [];
    ids.forEach(function (id) {
      var sk = DB.skills[id];
      var cdSec = Math.ceil(Math.max(0, (player.manualCd && player.manualCd[id]) || 0) / TICKS_PER_SEC);
      var cost = mpCost(sk);
      st.push({ id: id, cdSec: cdSec, cost: cost, noMp: player.mp < cost });
      sig += '|' + id + ':' + cdSec + ':' + cost + ':' + (player.mp < cost ? 1 : 0);
    });
    if (sig === lastSig) return;
    lastSig = sig;

    st.forEach(function (s) {
      var b = btns[s.id];
      if (!b) return;
      var off = barrier || s.cdSec > 0 || s.noMp;
      b.el.classList.toggle('is-cd', s.cdSec > 0);
      b.el.classList.toggle('is-off', off);
      b.el.setAttribute('aria-disabled', off ? 'true' : 'false');
      var cdTxt = s.cdSec > 0 ? String(s.cdSec) : '';
      if (b.cd.textContent !== cdTxt) b.cd.textContent = cdTxt;
    });
  }

  function init() {
    var bv = document.getElementById('battle-view');
    if (!bv || !bv.parentNode || typeof window.renderStatusEffects !== 'function' || typeof window.manualCast !== 'function') {
      console.warn('[AFK-skillbar] 找不到 #battle-view / renderStatusEffects / manualCast（上游可能改了結構），主動技能列停用。');
      return;
    }
    injectCSS();
    host = document.createElement('div');
    host.id = 'm-skillbar';
    // 戰鬥框正下方；狀態欄(afk-battlebuffs)在的話排在它上面，不在就直接接戰鬥框
    var buffs = document.getElementById('m-battle-buffs');
    bv.parentNode.insertBefore(host, (buffs && buffs.parentNode === bv.parentNode) ? buffs : bv.nextSibling);
    applyTab();
    addEventListener('resize', applyTab);
    addEventListener('orientationchange', applyTab);

    var orig = window.renderStatusEffects;
    window.renderStatusEffects = function () {
      var r = orig.apply(this, arguments);
      if (typeof state !== 'undefined' && state.ff) return r;   // 離線補跑期間不動畫面
      try { sync(); } catch (e) {}
      return r;
    };
    console.log('[AFK-skillbar] hooks OK — 手機戰鬥框下方已加上主動技能列。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
