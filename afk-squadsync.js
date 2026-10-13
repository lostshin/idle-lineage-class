/* ============================================================================
 * afk-squadsync.js — 傭兵的技能清單變了，隊伍面板的下拉要跟著重建
 *
 * 為什麼需要（2026-08-07 玩家回報「傭兵裝了遺物卻選不到寒冰尖刺」）：
 *   資料層其實一直是對的——法師戴上「古代法師的隨手小抄」後，回村時 refreshAllyOnce 會用
 *   來源存檔重建傭兵快照，ally.skills 確實多了 sk_frost_spike，_allySkillOptions() 重新產
 *   一次也會列出「寒冰尖刺」。卡住的是畫面：js/10 renderSquadPanel 的 skill 分頁重建簽章
 *   （sigSkill）只由「存檔位:名字:倒地:等級」＋妖精屬性組成，**技能清單不在裡面** →
 *   傭兵在隊上期間換了授予技能的裝備、或學了新魔法，下拉永遠停在招募當下那份清單。
 *   玩家只能靠傭兵升級／倒地／解雇重招（讓簽章碰巧變動）才會看到，極難自己想到。
 *
 * 上游踩過同一個坑並只補了一半：js/10:2609 的 v3.8.5 把 elfEle 加進簽章，理由一字不差
 *   （「重建快照時名字/等級都沒變 → 簽章不動 → 技能下拉停在舊清單」）。這支補完剩下的。
 *
 * 做法：包 renderSquadPanel，畫之前比一份便宜的技能簽章，變了就把 _squadSigSkill 清空，
 *   原函式自己會重建 skill 分頁（連帶「自動維持」勾選列也一起更新）。
 *   ⚠️ 刻意不用 skills.join()：那串上百字元、而 renderSquadPanel 每幀都跑。改用
 *   「技能數 ＋ 授予技能 id」——數量變涵蓋「學新魔法／戴上授予裝備」，授予 id 變涵蓋
 *   「換成另一件同樣給一招的裝備」（數量剛好不變的情況）。
 *
 * 為什麼不改成「每次都重建」：v3.2.74 把簽章拆成 team/skill 兩份，就是為了讓戰鬥中寵物
 *   掉血不去重建 skill 分頁——重建會把玩家正拉開的下拉選單關掉。所以這裡只在真的變動時重建。
 *
 * 掛接：只包 renderSquadPanel（全域函式）。缺它就 warn 後停用。
 * ========================================================================== */
(function () {
    'use strict';

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'squadsync', name: '傭兵技能清單即時更新', group: '遊戲介面', def: true,
        desc: '傭兵換了裝備或學了新魔法，隊伍面板的技能下拉才會跟著更新'
    });

    if (typeof window.renderSquadPanel !== 'function') {
        console.warn('[AFK-squadsync] 找不到 renderSquadPanel，停用（遊戲照常運作）。');
        return;
    }
    if (window.renderSquadPanel.__afkSquadSync) { console.log('[AFK-squadsync] hooks OK'); return; }   // 冪等：重複載入不疊包

    function skillSig() {
        var list = (typeof player !== 'undefined' && player && player.allies) || [];
        var out = '';
        for (var i = 0; i < list.length; i++) {
            var a = list[i];
            if (!a) continue;
            out += a._slot + ':' + ((a.skills && a.skills.length) || 0) + ':' + ((a.grantedSkills || []).join('.')) + '|';
        }
        return out;
    }

    var _lastSig = null;
    var _orig = window.renderSquadPanel;
    window.renderSquadPanel = function () {
        if (!window.AFK_TOGGLES || AFK_TOGGLES.enabled('squadsync')) {
            try {
                var sig = skillSig();
                if (_lastSig !== null && sig !== _lastSig) _squadSigSkill = '';
                _lastSig = sig;
            } catch (e) { /* 上游改了簽章變數名 → 維持原本行為，不擋畫面 */ }
        }
        return _orig.apply(this, arguments);
    };
    window.renderSquadPanel.__afkSquadSync = true;

    console.log('[AFK-squadsync] hooks OK — 傭兵技能清單變動會即時反映到隊伍面板。');
})();
