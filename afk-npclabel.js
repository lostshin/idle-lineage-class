/* ============================================================================
 * afk-npclabel.js — 村莊 NPC 的名牌不要跑出畫面外
 *
 * 問題(玩家回報·已重現):炎魔謁見所的「炎魔的輔佐官」名字看不到。
 *   量出來的原因是**上方出界**,不是左右:名牌是貼在 NPC 立繪的正上方
 *   (css/style.css 的 .tn-label:bottom:100% + margin-bottom),而這位站得高(y=32%)、
 *   立繪又特別高 → 名牌整個跑到地圖頂端**外面** 68px,被上面的面板蓋掉。
 *   ⚠️ 這與視窗寬度無關:實測 1400 / 1024 / 860 三種寬度都一樣差 68px(所以不是「窄視窗才有」)。
 *
 *   核心的 _resolveTownLabelOverlap 只在「為了閃開別的名牌而往上抬」時檢查地圖頂端,
 *   **名牌自己天生就在頂端外**的情況它不管(那不是它抬上去的)。
 *
 * 作法:包住核心那支,等它排完之後把每個名牌夾回「地圖與視窗的交集」內——
 *   上方出界 → 調 margin-bottom 把它往下壓(與核心同一個位移管道,不會互相打架);
 *   左右出界 → 用 translateX 微調(順手處理:名字長又站得靠邊的 NPC 同樣會被切,如視窗
 *   窄到 860px 時這位的名牌右緣就會超出瀏覽器)。
 *   視窗大小改變時重跑一次(核心不會為了 resize 重排名牌)。
 *
 * 優雅降級:找不到那支核心函式就 console.warn 後安靜停用,不影響遊戲。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'npclabel', name: '村莊名牌不出界', group: '遊戲介面', def: true,
      desc: '村莊裡站得高或靠邊的 NPC，名字不會跑到畫面外'
    });
    if (!AFK_TOGGLES.enabled('npclabel')) return;
  }

  var PAD = 4;   // 離邊緣留一點縫,不要貼死

  function clamp() {
    var map = document.getElementById('town-npc-map');
    if (!map || map.classList.contains('hidden')) return;
    var mr = map.getBoundingClientRect();
    // 版面還沒安定就別夾:剛切進村莊時量到的地圖矩形可能是暫時值(高度極小/位置還在 0),
    //   那時算出來的「可視上緣」是錯的,會得到「不用移」的結論而卡在錯的位置(踩過:時好時壞)
    if (!mr.width || mr.height < 60) return;
    // 看得見的範圍＝地圖 ∩ 視窗(窄視窗時地圖自己就有一截在畫面外)
    var minX = Math.max(mr.left, 0) + PAD;
    var maxX = Math.min(mr.right, window.innerWidth || mr.right) - PAD;
    var minY = Math.max(mr.top, 0) + PAD;
    // 核心量位移時會除以縮放比,這裡沿用同一套(地圖被 CSS 縮放時才不會壓過頭)
    var scale = (mr.width / (map.offsetWidth || mr.width)) || 1;

    var npcs = map.querySelectorAll('.town-npc');
    var i, el, l, r;

    // ① 名牌被擠到地圖上方外面 → **把整個 NPC 往下挪**,而不是把名牌壓到牠臉上。
    //    (先把牠往下移到名牌進得來為止;牠自己的腳不可以掉出地圖下緣。)
    for (i = 0; i < npcs.length; i++) {
      el = npcs[i]; l = el.querySelector('.tn-label');
      if (!l) continue;
      // 🚨 用 margin-top 位移,**不可以用 transform**:.town-npc 的 CSS 帶
      //    `transition: transform .12s`,設完馬上量會量到動畫途中的值 → 下面兩步依據錯的數字
      //    再補一次位移,結果名牌被推到立繪身上(踩過,而且時好時壞)。margin 沒有 transition。
      el.style.marginTop = '';                        // 先歸零再量(冪等:重跑不會越推越下面)
      r = l.getBoundingClientRect();
      if (!r.height || r.top >= minY) continue;
      var need = (minY - r.top) / scale;
      var er = el.getBoundingClientRect();
      var room = (Math.min(mr.bottom, window.innerHeight || mr.bottom) - PAD - er.bottom) / scale;
      var dy = Math.max(0, Math.min(need, room));     // 沒空間就有多少挪多少,剩下的交給 ②
      if (dy > 0.5) el.style.marginTop = Math.round(dy) + 'px';
    }

    // ② 挪完還是進不來(地圖太矮/NPC 太高)→ 才退而求其次把名牌壓下來,至少看得到字
    for (i = 0; i < npcs.length; i++) {
      l = npcs[i].querySelector('.tn-label');
      if (!l) continue;
      r = l.getBoundingClientRect();
      if (r.height && r.top < minY) {
        var cur = parseFloat(getComputedStyle(l).marginBottom) || 0;
        l.style.marginBottom = (cur - (minY - r.top) / scale) + 'px';   // 走 margin-bottom,與核心同一個管道
      }
    }

    // ③ 左右出界 → 用 translateX 微調(核心沒用到名牌的水平位移)
    for (i = 0; i < npcs.length; i++) {
      l = npcs[i].querySelector('.tn-label');
      if (!l) continue;
      l.style.transform = '';                         // 先歸零再量,否則會疊加上一次的位移
      r = l.getBoundingClientRect();
      if (!r.width || maxX <= minX) continue;
      var dx = 0;
      if (r.right > maxX) dx = maxX - r.right;        // 右邊出界 → 往左推
      if (r.left + dx < minX) dx = minX - r.left;     // 推完換左邊出界(名牌比可視範圍還寬)→ 靠左對齊
      if (dx) l.style.transform = 'translateX(calc(-50% + ' + Math.round(dx) + 'px))';
    }
  }

  function init() {
    if (typeof window._resolveTownLabelOverlap !== 'function') {
      console.warn('[AFK-npclabel] 找不到核心的名牌排版函式，名牌防出界停用（遊戲照常運作）。');
      return;
    }
    if (window._resolveTownLabelOverlap.__afkNpcLabel) return;
    var orig = window._resolveTownLabelOverlap;
    var burst = [];
    function clampSoon() {   // 立繪是逐張載入的,版面會再動好幾次 → 補跑幾次直到安定(clamp 是冪等的)
      burst.forEach(clearTimeout); burst = [];
      try { clamp(); } catch (e) {}   // 純視覺,出錯不影響遊戲
      [120, 400, 900].forEach(function (ms) {
        burst.push(setTimeout(function () { try { clamp(); } catch (e) {} }, ms));
      });
    }
    window._resolveTownLabelOverlap = function () {
      var r = orig.apply(this, arguments);
      clampSoon();
      return r;
    };
    window._resolveTownLabelOverlap.__afkNpcLabel = true;

    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { try { clamp(); } catch (e) {} }, 120);
    });

    console.log('[AFK-npclabel] hooks OK — 村莊 NPC 名牌會夾在畫面內。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
