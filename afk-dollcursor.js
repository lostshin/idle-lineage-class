/* ============================================================================
 * afk-dollcursor.js — 關閉魔法娃娃的游標變更(預設關)
 *
 * 上游行為:裝備 slot:doll 的魔法娃娃時,`applyDollCursor()`(js/02)會做三件事——
 *   ① `document.body.style.cursor` 換成 `assets/doll/<娃娃名>.png`
 *   ② body 加 `has-doll-cursor`,CSS `body.has-doll-cursor * { cursor: inherit !important }`
 *      讓按鈕、清單等可點擊處也一併變成娃娃圖(連手指游標都沒了)
 *   ③ 啟用 `#doll-cursor-glow` —— 跟著滑鼠跑的一顆光點
 *
 * 手機為什麼也會看到:那顆光點是掛在 `mousemove` 上的,而觸控點一下瀏覽器會補送一次
 *   合成 mousemove → 光點就停在你剛剛點的位置不動。手機沒有滑鼠游標,只有這顆看得到,
 *   所以「關掉娃娃游標」在手機上等於「關掉那顆點」——兩者是同一個開關,不能只關一半。
 *
 * 做法:包住 `applyDollCursor`。開關關(預設)→ 原樣轉呼叫,一個 byte 都不改;
 *   開關開 → 不呼叫原函式,並主動把上面三樣清乾淨(可能是先前就已經套上的)。
 *
 * 預設關的理由:這是拿掉上游的一個視覺功能,不是新增東西 —— 比照 afk-notip、afk-whbatch,
 *   會改掉原版行為的一律預設關,讓覺得礙眼的人自己開。
 *
 * 優雅降級:找不到 `applyDollCursor` 就 console.warn 後安靜停用(遊戲照常運作)。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'dollcursor', name: '關閉魔法娃娃游標', group: '系統與其他', def: false,
    desc: '裝魔法娃娃時不要把滑鼠游標換成娃娃圖；手機點下去也不會留一顆光點'
  });
  // 讀不到開關中樞 → 當「關閉」(透明放行原版)。這支是拿掉上游功能的,不確定時不要動它。
  function on() { try { return !!(window.AFK_TOGGLES && AFK_TOGGLES.enabled('dollcursor')); } catch (e) { return false; } }

  if (typeof window.applyDollCursor !== 'function') {
    try { console.warn('[AFK-dollcursor] 找不到 applyDollCursor，關閉娃娃游標停用。'); } catch (e) {}
    return;
  }
  if (window.applyDollCursor.__afkNoDoll) { try { console.log('[AFK-dollcursor] hooks OK'); } catch (e) {} return; }   // 冪等：重複載入不疊包

  var orig = window.applyDollCursor;

  function clearDollCursor() {
    try {
      document.body.style.cursor = '';
      document.body.classList.remove('has-doll-cursor');   // 少了這行,CSS 的全頁 cursor:inherit 會留著
      var g = document.getElementById('doll-cursor-glow');
      if (g) g.classList.remove('active');                 // 手機上「點一下留一顆光點」的就是它
    } catch (e) {}
  }

  window.applyDollCursor = function () {
    if (!on()) return orig.apply(this, arguments);
    clearDollCursor();
  };
  window.applyDollCursor.__afkNoDoll = true;

  // 玩家在遊戲中把開關打開再重新整理時,載入角色的 calcStats 會再經過一次包裝版 → 自然就清掉了;
  // 但外掛載入時序若晚於某次 calcStats,畫面上會殘留 → 進來先主動清一次,不必等下一次重算。
  if (on()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', clearDollCursor);
    else clearDollCursor();
  }

  try { console.log('[AFK-dollcursor] hooks OK'); } catch (e) {}
})();
