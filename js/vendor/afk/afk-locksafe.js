/* ============================================================================
 * afk-locksafe.js — 上鎖的裝備不會被潘朵拉的收購／遺物布告欄拿走
 *
 * 問題(玩家回報·已重現):遺物布告欄與安全區的龍鑽／金幣收購 NPC 在挑「要交出去的那一件」時
 *   只比對 物品 id、強化值、數量(js/24 的 _findMatches),**完全沒看 `lock`** → 背包裡上鎖的
 *   那件會被直接交易掉。實測:把一把上鎖的「亞連」放進背包 → 找金幣收購員成交 → 那把消失、
 *   金幣入帳,全程沒有任何警告。
 *
 *   這與全專案其他破壞性路徑的規則相反(核心自己在 js/04 的血盟掉落池就寫著「鎖定件與任務/
 *   收集冊類不列入,與全專案其他破壞性路徑一致」),所以認定是上游漏了這一處,不是設計。
 *
 * 作法:那幾支的挑選邏輯關在 js/24 的 IIFE 裡(_findMatches 拿不到),但**入口是全域函式**。
 *   包住入口,在它執行的那一瞬間把「上鎖的物品」從 player.inv 暫時抽掉 → 核心挑不到它們,
 *   會照原本的流程回報「道具欄與倉庫內都沒有符合的物品」;跑完立刻把背包按**原順序**組回去。
 *   連同兩支畫面函式一起包,畫面才不會先說「可以交」、按下去卻說沒有(前後一致)。
 *
 * 🚨 還原必須以「核心跑完後的 player.inv」為準再組回去,不能直接把舊陣列指回去:
 *   核心成交時是 `player.inv = player.inv.filter(...)`(換成新陣列)。若無腦還原舊陣列,
 *   玩家剛剛真的賣掉的東西會被「復活」;反過來若忘了把藏起來的接回去,上鎖的東西就真的消失了。
 *   故：上鎖的一律留、沒上鎖的看核心有沒有把它拿走、核心新加的補在最後。數量遞減(cnt--)是
 *   就地改同一個物件,不受影響。
 *
 * 倉庫不處理:核心的 whDeposit(js/12)本來就擋下「鎖定物品需先解鎖才能存入倉庫」,倉庫裡不會有
 *   上鎖的東西;而倉庫那條路要動 loadWarehouse/saveWarehouse,做錯會把倉庫寫壞,不值得為
 *   不存在的情境冒險。
 *
 * 優雅降級:那幾支全域函式一支都沒有(上游改名)就 console.warn 後安靜停用,不影響遊戲。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'locksafe', name: '上鎖裝備不被收購', group: '遊戲介面', def: true,
      desc: '潘朵拉的收購與遺物布告欄不會拿走你上鎖的裝備'
    });
    if (!AFK_TOGGLES.enabled('locksafe')) return;
  }

  // 會「挑背包裡的東西交出去」的入口(前兩支會真的消耗,後兩支是畫面,一起包才不會前後不一致)
  var TARGETS = ['performWanderingBuyerTrade', 'pandoraExchangeRelic', 'renderWanderingBuyerDialog', 'pandoraRelicBoardHTML'];

  function withLockedHidden(fn, thisArg, args) {
    // ⚠️ 一定要用 `typeof player` 探，**不可寫 window.player**：核心是 `let player`(js/01)，
    //    宣告在全域語彙環境、**不會掛上 window** → window.player 永遠 undefined，
    //    整段會安靜地什麼都不做（wrapper 掛得好好的、測起來卻完全沒效果，踩過兩次；同 DB）。
    var p = (typeof player !== 'undefined') ? player : null;
    var orig = p && p.inv;
    if (!Array.isArray(orig)) return fn.apply(thisArg, args);

    var hidden = [], visible = [], i, it;
    for (i = 0; i < orig.length; i++) { it = orig[i]; if (it && it.lock) hidden.push(it); else visible.push(it); }
    if (!hidden.length) return fn.apply(thisArg, args);   // 沒有上鎖的東西 → 完全不介入

    p.inv = visible;
    try {
      return fn.apply(thisArg, args);
    } finally {
      var after = Array.isArray(p.inv) ? p.inv : visible;
      var keep = [];
      for (i = 0; i < orig.length; i++) {                 // 照原順序重建
        it = orig[i];
        if (it && it.lock) keep.push(it);                 // 上鎖的一定留著
        else if (after.indexOf(it) >= 0) keep.push(it);   // 沒上鎖的:核心沒拿走才留
      }
      for (i = 0; i < after.length; i++) {                // 核心新加的(這幾支理論上不會,但不能漏)
        if (orig.indexOf(after[i]) < 0) keep.push(after[i]);
      }
      p.inv = keep;
    }
  }

  var wrapped = [];
  TARGETS.forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__afkLockSafe) return;
    window[name] = function () { return withLockedHidden(orig, this, arguments); };
    window[name].__afkLockSafe = true;
    wrapped.push(name);
  });

  if (!wrapped.length) {
    console.warn('[AFK-locksafe] 找不到潘朵拉收購/布告欄的入口函式，上鎖保護停用（遊戲照常運作）。');
    return;
  }
  console.log('[AFK-locksafe] hooks OK — 上鎖物品不會被收購/布告欄拿走（已包住 ' + wrapped.join('、') + '）。');
})();
