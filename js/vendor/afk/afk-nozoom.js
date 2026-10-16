/* ============================================================================
 * afk-nozoom.js — 手機取消「連點兩下放大」（雙擊縮放）
 *
 * 手機瀏覽器預設把「快速點兩下」當成放大手勢。遊戲裡有大量需要連點的按鈕
 * （魔法娃娃合成、NPC 兌換、商店數量…），連點時整頁被放大、又不會自己縮回來。
 *
 * 作法：對 body 與底下每個元素設 touch-action:manipulation —— 這個值等於「保留單指捲動＋兩指捏合縮放，
 *   只拿掉雙擊縮放與它附帶的 300ms 點擊延遲」：
 *   - 兩指捏合放大（無障礙需求）照常可用，不是把縮放整個關掉；
 *   - 選擇器用 `body *`（權重最低）→ 其他外掛/上游已寫 none / pinch-zoom / pan-y 的拖曳把手、
 *     裝備框/倉庫框、捲動容器全部照舊（它們的規則權重都比這條高），本規則只把「原本是預設 auto」的元素收緊；
 *   - 背包「雙擊＝裝備/使用」的 dblclick 事件照發（manipulation 只擋縮放手勢）。
 *
 * ⚠ 為什麼不能只寫 body：touch-action 不會繼承，實際被手指點到的元素（選角卡片、背包格子…）
 *   自己算出來仍是 auto。規範說「沿觸控鏈取交集」，但 iOS 上實測不可靠（玩家回報選角、點卷軸時照樣放大），
 *   所以直接把值放到每個元素身上，不賭祖先那條會不會被採計。
 *
 * 觸控裝置判定只看 `pointer: coarse`（手指），不跟手機版面的寬度斷點綁在一起：
 *   雙擊放大是「觸控手勢」問題，跟畫面寬窄無關 —— 平板、以及 iPhone 開「要求電腦版網站」
 *   （視窗寬度變 980）都會落在寬度斷點外，那時整條規則消失、雙擊放大全部回來（玩家回報）。
 * 不讀 afk-mobile 掛的 body.m-mobile ——那支可被玩家關掉，靠它會變成「關了手機版面連雙擊放大也一起回來」的跨外掛耦合。
 * 掛接：在 index.html 的 </body> 前 <script src="afk-nozoom.js">。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('nozoom')) return;   // 🎚️ 外掛開關:關掉就回瀏覽器預設(雙擊會放大)

  var TOUCH_MQ = '(pointer: coarse)';   // 只問「主要輸入是手指嗎」,不問畫面寬窄

  function init() {
    if (document.getElementById('afk-nozoom-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-nozoom-style';
    s.textContent = '@media ' + TOUCH_MQ + '{body,body *{touch-action:manipulation;}}';
    (document.head || document.documentElement).appendChild(s);
    console.log('[AFK-nozoom] hooks OK — 手機已取消雙擊放大（兩指捏合縮放保留）。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
