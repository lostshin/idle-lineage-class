/* ============================================================================
 * afk-statusicon.js — 手機的狀態圖示縮小一半
 *
 * 問題:狀態列(#status-icon-bar)是絕對定位浮在戰鬥畫面上的,圖示固定 28px。桌機的戰鬥區很寬,
 *   28px 只佔一小角;手機整個戰鬥區才 346px 寬,增益一多就排成兩三排、把怪物與角色蓋掉一大半
 *   (實測 22 個狀態時佔掉 346×92px,戰鬥畫面幾乎看不到)。玩家回報「手機上狀態圖示太大」。
 *
 * 作法:純 CSS,只在窄畫面把尺寸與間距對半砍(28→14px、gap 4→2px),隊友光環那顆藍點跟著縮
 *   (6→4px,不然一顆點就佔掉圖示三分之一)。不動 DOM、不包任何核心函式。
 *
 * 為什麼只用上游那條窄 MQ、不做平板路徑:這屬於「窄畫面排版優化」而不是「手機殼套上了就該有」
 *   ——平板的戰鬥區夠寬,28px 本來就不擋事(判準見 docs/mobile.md)。同 afk-mapbar 的處理。
 *
 * 為什麼不寫 body.m-mobile:那個 class 由可被玩家關掉的 afk-mobile 掛,關掉手機版面時
 *   戰鬥區一樣窄、一樣需要縮(判準見 CLAUDE.md「不可停用的基礎設施不能依賴可被關掉的外掛」)。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-statusicon.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'statusicon', name: '手機狀態圖示縮小', group: '遊戲介面', def: true,
      desc: '手機上的狀態圖示縮成一半，不會蓋住戰鬥畫面'
    });
    if (!AFK_TOGGLES.enabled('statusicon')) return;
  }

  // 與 afk-mobile / afk-battlehud 同一條(上游手機斷點),不要各寫各的
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var SIZE = 14, GAP = 2, DOT = 4;   // 上游是 28 / 4 / 6

  if (document.getElementById('afk-statusicon-style')) return;   // 冪等:重複載入不疊
  var s = document.createElement('style');
  s.id = 'afk-statusicon-style';
  // 用 `#status-icon-bar .status-icon` 提高特異性壓過上游的裸 class,不必動用 !important
  s.textContent = '@media ' + MOBILE_MQ + '{'
    + '#status-icon-bar{gap:' + GAP + 'px;}'
    + '#status-icon-bar .status-icon{width:' + SIZE + 'px;height:' + SIZE + 'px;flex:0 0 ' + SIZE + 'px;border-radius:3px;}'
    + '#status-icon-bar .status-icon--ally::after{width:' + DOT + 'px;height:' + DOT + 'px;top:0;right:0;}'
    + '}';
  (document.head || document.documentElement).appendChild(s);

  console.log('[AFK-statusicon] hooks OK — 手機狀態圖示 28→' + SIZE + 'px。');
})();
