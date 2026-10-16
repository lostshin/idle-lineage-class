/**
 * afk-invlist.js — 背包「條列式」顯示（像我方舊 main：一行一物品，取代上游 1.8 皮膚格狀）
 *
 * 上游 v3.0.40 起背包改成「1.8 皮膚」：.classic-inventory-shell(背景藝術圖·固定比例) 內
 *   .classic-inventory-viewport(4 欄 grid) 排 .list-item(格狀·以圖示為主)。我方舊 main 是條列式
 *   (一行一物品：小圖示 + 全名 + 詞綴/強化/廢品標籤)。
 *
 * 這支「純 CSS 覆寫」把外殼藝術拆掉、grid 改成單欄列表、每格改成整寬一行。桌機/手機通用、可開關
 *   (關掉 → body 不帶 .afk-invlist → 完全回上游格狀皮膚)。item 內容本來就含圖示+全名，改排版即成條列。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('invlist')) return;   // 🎚️ 外掛開關

    // 一列的幾何(與下面 .list-item 那條規則對應)。ROW_BOX 是實測的整列高度——min-height 只是地板(34)，
    //   內容(圖示 + 一行字)實際把它撐到 38；量法見下面 ROW_CONTENT_H 的註解。
    var ROW_BOX = 38, ROW_PADDING_Y = 5 * 2, ROW_BORDER_Y = 1 * 2;
    var ROW_CONTENT_H = ROW_BOX - ROW_PADDING_Y - ROW_BORDER_Y;

    var CSS = [
        // 外殼：拆掉藝術背景圖與固定比例，改成「吃掉分頁剩餘高度」的彈性容器。
        //   ⚠ 不可用 height:100%：分頁是直向 flex，外殼上面還有「快速操作」工具列(約 55px)，
        //     100% 是對「分頁全高」算的 → 外殼比剩餘空間高一截、底部被 overflow:hidden 裁掉又捲不到
        //     (桌機看不到背包最後幾列、也找不到地方拉·玩家回報)。flex:1+min-height:0 才是扣掉工具列後的剩餘高。
        'body.afk-invlist .classic-inventory-shell{aspect-ratio:auto !important;background:none !important;flex:1 1 auto !important;height:auto !important;min-height:0 !important;max-width:100% !important;}',
        // 視窗：絕對定位的 4 欄 grid → 靜態單欄直向清單，正常捲動
        //   ⚠ iOS 觸控捲動：溢出量小時（如武器只多幾件）沒有 -webkit-overflow-scrolling:touch 會滑不動、
        //     觸控被外層 #game-screen 吃掉（防具/道具溢出大反而滑得動）。補齊 iOS 觸控三件套。
        'body.afk-invlist .classic-inventory-viewport{position:static !important;inset:auto !important;left:auto !important;top:auto !important;width:100% !important;height:100% !important;display:flex !important;flex-direction:column !important;gap:3px !important;padding:4px !important;grid-template-columns:none !important;grid-auto-rows:auto !important;background:transparent !important;overflow-y:auto !important;-webkit-overflow-scrolling:touch !important;touch-action:pan-y !important;overscroll-behavior:contain !important;}',
        // 每格：滿寬一行(圖示 + 名稱靠左、勾選/標籤靠右)
        //   ⚠ flex:0 0 auto 不可省：viewport 是固定高的直向 flex，子項預設會被壓縮 →
        //     物品一多列高被壓到 min-height 以下，而本檔又把 overflow 改成 visible(格狀皮膚原本靠 hidden 裁掉)
        //     → 名稱直接溢出疊到下一列上(玩家回報「背包名稱疊在一起」)。列各自撐開、整份交給捲軸。
        'body.afk-invlist .classic-inventory-viewport > .list-item{flex:0 0 auto !important;width:100% !important;height:auto !important;min-height:34px;aspect-ratio:auto !important;display:flex !important;align-items:center !important;justify-content:space-between !important;padding:5px 9px !important;border:1px solid #334155 !important;border-radius:6px !important;background:rgba(15,23,42,.55) !important;box-shadow:none !important;overflow:visible !important;}',
        // 📜 只排版「畫得到的那幾列」：條列式把整份背包攤成一長條（2083 件的真實存檔＝防具分頁 1405 列、
        //   近 58,000px 高），瀏覽器一次就得把每一列都排版 → 之後遊戲裡**任何一次讀版面**
        //   （getBoundingClientRect、設 scrollTop）都要把整份清單重排一遍。而遊戲每秒做幾十次這種事
        //   （8fps 貼圖換向、狀態列對位、掉一件東西就重建清單），手指正在滑的時候主執行緒被鎖住幾百毫秒、
        //   來不及畫的區塊送出空白 → 玩家看到「上下滑動時畫面閃爍破圖」（2026-08-10 回報）。
        //   實測（手機模擬 412×915・防具分頁・交錯 A/B 各 4 輪取中位數）：
        //     一次強制重排 117ms → 25ms；掉一件東西重建清單 288ms → 208ms。
        //   捲動幾何完全不變：300 步 × 100px（涵蓋 30,000px）逐步比對，位移偏差 0px、捲動高度全程不變。
        // ⚠ contain-intrinsic-size 給的是**內容框**高度，padding 與框線瀏覽器會自己加上去 ——
        //   直接填整列的 38px 會讓捲動高度多算 35%（踩過：58,045 → 79,199）。
        //   `auto` 關鍵字＝已經進過畫面的列改用實測值，所以這個估值只影響「從沒被捲到過」的列，
        //   日後列高變了也會自己修正。不認得 content-visibility 的瀏覽器（iOS < 18）整條忽略、行為同以前。
        'body.afk-invlist .classic-inventory-viewport > .list-item{content-visibility:auto;contain-intrinsic-size:auto ' + ROW_CONTENT_H + 'px;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item:hover{border-color:#7dd3fc !important;filter:none;background:rgba(30,41,59,.75) !important;}',
        // 🚫 無法裝備／無法學習：上面那條整片鋪底的 background 帶 !important，會把核心給的 bg-red-950/40
        //   壓掉（Tailwind 那個 class 沒有 !important）→ 條列式下「能不能穿」只剩右側一個 10px 紅字，
        //   滑過一整排根本認不出來。這裡把紅底補回來，再加左緣紅條讓它在一長串裡跳出來。
        //   兩種選法各自寫成獨立規則、不可併成 selector list：:has() 在舊瀏覽器（iOS < 15.4）不認得，
        //   併在一起會讓整條規則連同前半段一起失效。
        'body.afk-invlist .classic-inventory-viewport > .list-item.bg-red-950\\/40{background:rgba(80,12,22,.55) !important;border-color:#9f1239 !important;border-left-width:4px !important;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item:has(.classic-item-flags .text-red-500){background:rgba(80,12,22,.55) !important;border-color:#9f1239 !important;border-left-width:4px !important;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item.bg-red-950\\/40:hover{background:rgba(110,18,30,.7) !important;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item:has(.classic-item-flags .text-red-500):hover{background:rgba(110,18,30,.7) !important;}',
        'body.afk-invlist .classic-item-main{justify-content:flex-start !important;gap:8px !important;width:auto !important;height:auto !important;flex:1 1 auto;min-width:0;}',
        'body.afk-invlist .classic-icon-box{width:26px !important;height:26px !important;flex:0 0 26px !important;}',
        'body.afk-invlist .classic-icon-box img,body.afk-invlist .classic-item-main .classic-icon-box img{width:100% !important;height:100% !important;}',
        'body.afk-invlist .classic-name-box{display:flex !important;flex-flow:row wrap !important;align-items:baseline !important;gap:0 8px !important;justify-content:flex-start !important;text-align:left !important;min-width:0;width:auto !important;height:auto !important;}',
        'body.afk-invlist .classic-item-flags{white-space:normal !important;}',
        // 格狀皮膚把強化值/數量、🔒、廢品標籤都絕對定位在「圖示格」四角，但條列模式下它們的定位錨
        //   .classic-item-main 是整條列 → 會壓在名稱上。強化值/數量 getItemFullName 已含(+9、(3))→ 直接收掉；
        //   🔒 與 廢品 改回文流排在名稱後面。
        'body.afk-invlist .classic-inventory-viewport > .list-item .classic-icon-corner-value{display:none !important;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item .classic-item-lock-badge,body.afk-invlist .classic-inventory-viewport > .list-item .classic-item-junk-label{position:static !important;left:auto !important;right:auto !important;top:auto !important;bottom:auto !important;flex:0 0 auto !important;width:auto !important;height:auto !important;max-width:none !important;max-height:none !important;margin-left:6px !important;background:transparent !important;}',
        // 條列不需要「空格填充」與皮膚捲動箭頭
        'body.afk-invlist .classic-inventory-scroll{display:none !important;}',
        'body.afk-invlist .classic-grid-empty{display:none !important;}',
        // 上游把這個捲動區的捲軸關掉(scrollbar-width:none)，因為皮膚背景圖畫了假的上下箭頭鈕；
        //   但條列模式把那兩顆假箭頭藏了 → 桌機變成兩邊都沒有、只剩滾輪(玩家回報「只有能力那格有拉條」)。
        //   只給有精準指標的桌機開回真捲軸(手機用手指捲、不必佔 8px 寬)。
        '@media (hover:hover) and (pointer:fine){',
        'body.afk-invlist .classic-inventory-viewport{scrollbar-width:thin !important;scrollbar-color:#8a6547 #17161b !important;}',
        'body.afk-invlist .classic-inventory-viewport::-webkit-scrollbar{width:8px !important;height:8px !important;}',
        'body.afk-invlist .classic-inventory-viewport::-webkit-scrollbar-track{background:#17161b;border-radius:2px;}',
        'body.afk-invlist .classic-inventory-viewport::-webkit-scrollbar-thumb{background:#5c4739;border:1px solid #8a6547;border-radius:2px;}',
        '}'
    ].join('\n');

    var st = document.createElement('style'); st.id = 'afk-invlist-style'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);

    function on() { if (document.body) document.body.classList.add('afk-invlist'); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', on);
    else on();
    // 保險：有些流程可能重設 body class → 定期確保還在（背景分頁跳過）
    setInterval(function () { if (!document.hidden) on(); }, 3000);

    try { console.log('[AFK-invlist] hooks OK — 背包條列式已套用（可於外掛開關關閉回原版格狀）。'); } catch (e) {}
})();
