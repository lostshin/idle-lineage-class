/* ============================================================================
 * afk-petui.js — 手機「寵物保管」面板重新排版（純 CSS，不動任何 DOM 與行為）
 *
 * 上游 renderPetStorageNPC(js/22) 的每一列是**單排 flex**，左右四塊都 shrink-0：
 *   鎖鈕 24 ＋ 縮圖 44 ＋（中間資訊 flex-1）＋ 按鈕群（inline style max-width:210px）
 * 390px 手機實測列寬 310px，扣掉上面三塊與 gap 後，**中間資訊只剩 20px** →
 *   「牧羊犬」變成一個字一行直排、那串 HP/MP/EXP/攻擊/命中/AC/減免 逐字換行
 *   → **一列 554px 高**，而清單可見高只有 219px ＝ 一隻寵物都看不完整。
 *
 * 改成兩排（實測列高 554 → 約 110px）：
 *   ① 按鈕群獨佔第二排（蓋掉 inline 的 max-width:210px）→ 中間資訊拿回整列寬 226px
 *   ② 說明段 250px（38% 螢幕）限高可捲 → 約 90px；資訊沒藏起來，想讀就在框裡捲
 *   ③ 統計列（保管/出戰/魅力/果實）內距與間距收窄 → 82px → 約 52px
 *   清單自己的 max-height:380px 刻意不動：上面省下來的空間剛好讓它從「看得到 219px」
 *   變成整個 380px 都在畫面內（改成 vh 反而要處理手機網址列伸縮，得不償失）。
 *
 * ⚠ 按鈕高度 26px 與縮圖 44×40 都不縮：那是點擊目標與辨識用的圖，省高度要從「排數」省。
 * ⚠ 放生確認列（confirmUid 分支）結構不同但同樣吃 `> span:last-child`，
 *    套用後變成「確認文字整排、兩顆鈕第二排」——正是想要的（原本文字也被擠成 20px）。
 *
 * 手機判定用「與核心手機版面同一條 media query」寫在 @media 裡，桌機完全不受影響；
 *   不讀 afk-mobile 的 body.m-mobile（那支可被玩家關掉，靠它會變成關了就恢復擠版）。
 * 掛接：在 index.html 的 </body> 前 <script src="afk-petui.js">。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('petui')) return;   // 🎚️ 外掛開關:關掉就回上游單排

    // 與 css/style.css 手機版面那條完全一致(改一邊要改兩邊,不一致會出現「桌機被壓」或「手機沒壓到」)
    var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
    var ROOT = '[data-petui]';
    var LIST = '[data-pet-storage-list]';

    function injectCSS() {
        if (document.getElementById('afk-petui-style')) return;
        var s = document.createElement('style');
        s.id = 'afk-petui-style';
        s.textContent = [
            '@media ' + MOBILE_MQ + '{',
            /* ① 說明段:限高可捲。-webkit-overflow-scrolling 讓 iOS 慣性捲動,不然框內很難捲 */
            ROOT + ' > div:first-child{max-height:6em !important;overflow-y:auto !important;-webkit-overflow-scrolling:touch;}',
            /* ② 統計列:上游 gap-4(16px)+p-3(12px) 在 390px 下換成兩排還很鬆 */
            ROOT + ' > div:nth-child(2){gap:2px 10px !important;padding:6px 8px !important;}',
            /* ③ 每列改兩排:先讓列可換行,再把按鈕群推成整排 */
            LIST + ' > div{flex-wrap:wrap !important;}',
            /* flex:0 0 100% 讓它一定獨佔第二排;max-width 要蓋掉 inline 的 210px(故 !important)。
               justify-content 從 end 改 start:按鈕靠左才對得齊上面的資訊,靠右會浮在半空。 */
            LIST + ' > div > span:last-child{flex:0 0 100% !important;max-width:none !important;'
                + 'justify-content:flex-start !important;margin-top:4px;}',
            /* ④ 數值那行(HP/MP/EXP/攻擊/命中/AC/減免/ER/MR)字級收一級,少換一行 */
            LIST + ' > div > span.flex-1 span.text-xs{font-size:10px !important;line-height:1.35 !important;}',
            '}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    }

    // 上游改結構時出聲:純 CSS 選不到就是「安靜沒效果」,玩家只會覺得「還是很擠」。
    // 第一次真的渲染出面板時對一次錨點,不合就 warn(只印一次)。
    var checked = false;
    function selfCheck(div) {
        if (checked) return;
        checked = true;
        var root = div && div.querySelector(ROOT);
        if (!root) return;   // 不是寵物面板(其他 NPC 共用同一個容器)
        var row = root.querySelector(LIST + ' > div');
        if (!row) return;    // 保管箱是空的,沒有列可對
        var last = row.lastElementChild;
        if (!last || last.tagName !== 'SPAN' || !last.querySelector('button')) {
            console.warn('[AFK-petui] 寵物列的結構跟預期不同（上游可能改了 renderPetStorageNPC），兩排版面可能沒生效。');
        }
    }

    function init() {
        if (typeof renderPetStorageNPC !== 'function') {
            console.warn('[AFK-petui] 找不到 renderPetStorageNPC（上游可能移除了寵物保管），排版停用。');
            return;
        }
        injectCSS();
        var _orig = renderPetStorageNPC;
        renderPetStorageNPC = function (div) {
            var r = _orig.apply(this, arguments);
            try { selfCheck(div); } catch (e) {}
            return r;
        };
        console.log('[AFK-petui] hooks OK — 手機寵物保管面板已改成兩排版面。');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
