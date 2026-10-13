/* ============================================================================
 * afk-trackmaps.js — 魔物追蹤選單補上選不到的地圖
 *
 * 為什麼需要（2026-08-05 玩家回報「地獄奴隸沒有地圖可以追蹤」）：
 *   核心 obelMapList() 只掃 MAP_CATEGORIES 的 wild/dungeon/special/rift/pirate_island 五類，
 *   不在那五類的圖天生選不到。上游對這種圖的做法是逐張補進 OBEL_EXTRA_MAPS
 *   （遺忘之島途中/本島、風木地監就是這樣補的），本外掛把剩下沒補的一次補齊。
 *
 * 只補選單，不碰出怪判定，也不代表能進得去——
 *   核心 js/03 的判定是「tracking.map === mapState.current 且該怪在這張圖的怪表裡」，
 *   選進去之後兩個條件本來就成立；至於怎麼進場（交道具、母圖傳送…）一律照原本的規矩，
 *   追蹤選單只決定「到了那張圖之後哪隻怪變常見」。
 *
 * 一律無條件列出，不看背包/進度（使用者拍板）：清單不隨進度變動，行為單純可預期。
 *   代價：還沒解鎖的人也看得到，可能花 10 萬買了追蹤卻還進不去。
 *
 * ⚠️ 補的三批「來歷不同」，同步上游時照這張表判斷，別一律當成 bug 或一律當成刻意：
 *
 *   ① 黑暗妖精聖地(dark_elf_sanctuary) ＝ 補上游的漏
 *      上游 2026-06-30 建 OBEL_EXTRA_MAPS 時這張圖還不存在（2026-07-13 才誕生），
 *      之後沒回頭補。全核心沒有任何一句話說它不能追蹤——對照之下隱藏區/純BOSS房/攻城/攀登層
 *      每種排除都各有註解。它是唯一一張「8 種一般怪卻完全不能追蹤」的正常獵場，
 *      地獄奴隸(sanct_hellslave)自上游 v3.4.21 起只住這裡（遺物 奴隸粗布衫 的唯一來源）。
 *      → 上游哪天自己補了，本外掛偵測到重複會讓路。
 *
 *   ② 傲慢之塔2~10樓(pride_2_10) ＝ 刻意偏離上游設計
 *      上游 2026-07-19 只開放「持支配符 → 可追蹤 pride_N_(N+9)」，N 只列 11、21⋯91
 *      ＝剛好就是有支配符的九組；而支配符的道具說明把「城堡的魔物追蹤可指定該樓層區間的魔物」
 *      寫成自己的賣點 → 塔內追蹤本來是支配符特權，2~10樓沒有符（符只做了那九組）就不該能追蹤。
 *      我們選擇一律開放。
 *
 *   ③ 隱藏狩獵區域(hidden_*·6 張) ＝ 上游明確拒絕過，我們選擇推翻
 *      上游在建 OBEL_EXTRA_MAPS 的**同一個 commit**（2026-06-30，隱藏區系統上線後三天）
 *      寫下「🚫 隱藏狩獵區域…用戶要求不開放追蹤·維持只能由母圖傳送進入」——是看過之後的決定，不是遺漏。
 *      我們照樣開放：追蹤不會把人送進去，玩家仍得自己在母圖手動放傳送術／手動用瞬移卷軸才進得去，
 *      「只能由母圖傳送進入」這條並沒有被破壞。進去之後沒有時間限制、可以一直待著打，所以追蹤是有用的。
 *
 * 隱藏區的清單與名稱一律由核心的 HIDDEN_AREA_PARENT / HIDDEN_AREA_NAMES 推導，不寫死——
 *   上游增減隱藏區或改名都會自動跟上。名稱後面補「（母圖名）」是必要的不是裝飾：
 *   隱藏區的「黑魔法研究室」跟地監選單既有的 dark_magic_lab 完全同名、是兩張不同的圖，
 *   不標母圖會在下拉出現兩個一模一樣的選項。
 *
 * 掛接：只包 obelMapList（全域函式）。缺它就 warn 後停用。
 * ========================================================================== */
(function () {
  'use strict';

  var FIXED_MAPS = [
    { v: 'dark_elf_sanctuary', t: '黑暗妖精聖地' },
    { v: 'pride_2_10', t: '傲慢之塔2~10樓' }
  ];

  function enabled() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('trackmaps'); }

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'trackmaps', name: '追蹤可選的地圖變多', def: true, group: '遊戲玩法',
      desc: '可以追蹤黑暗妖精聖地、傲慢之塔2~10樓與象牙塔密室等隱藏區域'
    });
  }

  //   HIDDEN_AREA_PARENT / HIDDEN_AREA_NAMES 是核心的頂層 const → 不掛 window，只能用裸名讀
  //   （寫 window.HIDDEN_AREA_NAMES 會靜默拿到 undefined）。js/15 讀它們也是同一種寫法。
  function hiddenMaps() {
    var out = [];
    if (typeof HIDDEN_AREA_PARENT === 'undefined' || typeof HIDDEN_AREA_NAMES === 'undefined') return out;
    for (var parent in HIDDEN_AREA_PARENT) {
      var v = HIDDEN_AREA_PARENT[parent], name = HIDDEN_AREA_NAMES[v];
      if (!name) continue;
      var pe = (typeof mapEntryOf === 'function') ? mapEntryOf(parent) : null;
      out.push({ v: v, t: name + (pe && pe.t ? '（' + pe.t + '）' : '') });
    }
    return out;
  }

  function init() {
    var orig = window.obelMapList;
    if (typeof orig !== 'function') { console.warn('[AFK-trackmaps] 缺 obelMapList，停用'); return; }
    window.obelMapList = function () {
      var out = orig.apply(this, arguments);
      if (!enabled() || !Array.isArray(out)) return out;
      if (typeof DB === 'undefined' || !DB.maps) return out;   // DB 同樣是頂層 const，裸名讀
      FIXED_MAPS.concat(hiddenMaps()).forEach(function (e) {
        if (!DB.maps[e.v]) return;
        if (out.some(function (x) { return x && x.v === e.v; })) return;   // 上游自己補了就讓路，不出現兩筆
        out.push({ v: e.v, t: e.t });
      });
      return out;
    };
    console.log('[AFK-trackmaps] hooks OK — 追蹤選單補上 ' + (FIXED_MAPS.length + hiddenMaps().length) + ' 張圖。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
