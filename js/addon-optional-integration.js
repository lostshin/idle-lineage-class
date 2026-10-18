// Adapt mirrored optional tools to the current game's UI and save contracts.
(function () {
    // Rename the entry after the mirrored curse-batch hook appends it.
    document.addEventListener('DOMContentLoaded',() => {
        const open = window.openModal;
        window.openModal = function () {
            const result = open.apply(this,arguments);
            const button = document.querySelector('#modal-actions > [onclick^="AFK_CURSEBATCH.open("]');
            if (button) button.textContent = '一鍵弱化';
            return result;
        };
    });
    // The mirrored repeat tool predates owner-based party quest drops and the guild quest UI.
    const trialActive = window.trialItemActiveFor;
    window.trialItemActiveFor = function (owner,id,pending,assignedOnly) {
        const active = trialActive.apply(this,arguments);
        if (active || !owner || !AFK_TOGGLES.enabled('retrial')) return active;
        const keys = TRIAL_ITEM_Q[id];
        if (keys) return keys.some(key => TRIAL_Q[key].cls === owner.cls && trialQStateFor(owner,key) >= 1);
        const item = TRIAL50_ITEM[id], cfg = TRIAL_50_CFG[owner.cls];
        return !!(item?.ex && item.cls === owner.cls && cfg && owner.trialStage >= cfg.stages.length + 1);
    };
    function allyRepeatConfig(ctx,key) {
        if (!AFK_TOGGLES.enabled('retrial')) return null;
        if (key === '50') {
            const cfg = TRIAL_50_CFG[ctx.source.cls];
            return cfg && ctx.source.trialStage >= cfg.stages.length + 1 ? {reqs:[[cfg.exMat,cfg.exMatCnt || 1]],rewards:cfg.rewards.map(r=>r.id),lv:50} : null;
        }
        const cfg = TRIAL_Q[key];
        return cfg && cfg.cls === ctx.source.cls && trialQStateFor(ctx.source,key) >= 1 ? cfg : null;
    }
    function allyRepeatSets(ctx,cfg) {
        return Math.min(100,...cfg.reqs.map(([id,need]) => Math.floor(Math.min(questCountId(id),_allyQuestLootCount(ctx.ally,id))/need)));
    }
    AFK_RETRIAL.exAlly = function (slotN,key) {
        const ctx = _allyManagerSource(slotN,true), cfg = ctx && allyRepeatConfig(ctx,key);
        if (!cfg) return;
        const sets = allyRepeatSets(ctx,cfg), value = Number(document.getElementById('ally-retrial-qty-'+key)?.value);
        if (sets < 1 || !Number.isInteger(value) || value < 1) return;
        const count = Math.min(sets,value), before = effectActorCopy(player);
        // Exchanges leave allies untouched; keep their runtime methods and actor references.
        before.allies = player.allies;
        const saveKey = 'lineage_idle_save_'+currentSlot, saved = _lsGet(saveKey);
        try {
            _allyConsumeQuestProgress(slotN,cfg.reqs.map(([id,need])=>[id,need*count]));
            for (let n=0;n<count;n++) _allyGrantTrialRewards(cfg.rewards);
            if (saveGame() !== true) throw Error('save failed');
        } catch (e) {
            for (const key of Object.keys(player)) delete player[key];
            Object.assign(player,before);
            if (_lsGet(saveKey) !== saved) {
                if (saved == null) _lzRemoveStored(saveKey);
                else _lzSetStoredRaw(saveKey,saved);
            }
            const restored = _lsGet(saveKey) === saved;
            calcStats(); renderTabs(true);
            logSys('<span class="text-red-400">'+(restored
                ? '隊員試煉重複兌換未能儲存，已還原材料與獎勵。'
                : '隊員試煉重複兌換未能儲存，記憶體已還原，但存檔回復失敗。請勿重新載入，排除儲存問題後再儲存。')+'</span>');
            return;
        }
        logSys('隊員試煉重複兌換 ×'+count+'：獎勵已交給隊長，原試煉進度保留。');
        updateUI(); renderTabs(); openAllyQuestManager(slotN);
    };
    const renderAllyQuests = window.renderAllyQuestManager;
    window.renderAllyQuestManager = function (div,slotN) {
        const result = renderAllyQuests.apply(this,arguments);
        if (!AFK_TOGGLES.enabled('retrial')) return result;
        const ctx = _allyManagerSource(slotN,false);
        if (!ctx) return result;
        const section = document.createElement('section'); section.className = 'guild-repeat-trials';
        const title = document.createElement('h3'); title.textContent = '試煉重複兌換'; section.appendChild(title);
        for (const key of [...Object.keys(TRIAL_Q),'50']) {
            const cfg = allyRepeatConfig(ctx,key);
            if (!cfg) continue;
            const sets = allyRepeatSets(ctx,cfg), row = document.createElement('div');
            row.innerHTML = '<p>'+cfg.lv+' 級 · '+cfg.reqs.map(([id,need])=>partyEscape(DB.items[id].n)+' ×'+need).join('、')+' → '+cfg.rewards.map(id=>partyEscape(DB.items[id].n)).join('、')+'</p>'+
                '<label>數量 <input type="number" id="ally-retrial-qty-'+key+'" min="1" max="'+sets+'" value="1"'+(sets ? '' : ' disabled')+'></label>'+
                '<button type="button" class="btn" data-ally-retrial="'+key+'"'+(sets ? '' : ' disabled')+'>兌換（可換 '+sets+' 份）</button>';
            row.querySelector('button').onclick = () => AFK_RETRIAL.exAlly(ctx.slotN,key);
            section.appendChild(row);
        }
        if (section.children.length > 1) div.firstElementChild.appendChild(section);
        return result;
    };
    document.addEventListener('touchstart',() => { window.addonTouchTooltip = true; },{passive:true,capture:true});
    document.addEventListener('pointermove',event => { if (event.pointerType === 'mouse') window.addonTouchTooltip = false; },{passive:true,capture:true});
    if (AFK_TOGGLES.enabled('dollcursor')) {
        document.body.classList.add('addon-no-doll-cursor');
        document.body.style.cursor = '';
        document.body.classList.remove('has-doll-cursor');
        document.getElementById('doll-cursor-glow')?.classList.remove('active');
    }
    const render = window.renderWarehouseNPC;
    let side = 'inv';
    window.renderWarehouseNPC = function (div) {
        const result = render.apply(this,arguments);
        const host = document.getElementById('warehouse-window-content');
        if (!host || !host.querySelector('.wh-panel')) return result;
        host.dataset.mobileSide = side;
        if (AFK_TOGGLES.enabled('mobile') && !host.querySelector('.warehouse-mobile-tabs')) {
            const tabs = document.createElement('div'); tabs.className = 'warehouse-mobile-tabs'; tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','倉庫清單');
            for (const [id,name] of [['inv','背包'],['wh','倉庫']]) {
                const button = document.createElement('button'); button.className = 'btn'; button.type = 'button'; button.dataset.warehouseSide = id;
                button.textContent = name; button.setAttribute('role','tab'); button.setAttribute('aria-selected',String(side === id));
                button.onclick = () => { side = id; host.dataset.mobileSide = side; for (const b of tabs.children) b.setAttribute('aria-selected',String(b === button)); };
                tabs.appendChild(button);
            }
            host.querySelector('.wh-columns').before(tabs);
        }
        return result;
    };
    if (!AFK_TOGGLES.enabled('mobile')) return;
    const home = document.getElementById('log-row').parentNode;
    function fitMobileViewport() {
        const root = document.documentElement, viewport = window.visualViewport, scale = getUiScale();
        const height = Math.min(root.clientHeight,viewport ? viewport.height : root.clientHeight);
        const bottom = Math.max(0,root.clientHeight-height-(viewport ? viewport.offsetTop : 0));
        const nav = document.getElementById('m-nav');
        root.style.setProperty('--addon-mobile-height',(height/scale)+'px');
        root.style.setProperty('--addon-keyboard-bottom',(bottom/scale)+'px');
        root.style.setProperty('--addon-nav-height',nav ? (nav.getBoundingClientRect().height/scale)+'px' : '0px');
    }
    window.visualViewport?.addEventListener('resize',fitMobileViewport);
    window.visualViewport?.addEventListener('scroll',fitMobileViewport);
    new MutationObserver(fitMobileViewport).observe(document.body,{childList:true});
    function sync() {
        const mobile = matchMedia('(pointer:coarse)').matches || matchMedia('(max-width:820px)').matches;
        document.body.classList.toggle('m-mobile',mobile);
        if (!mobile) {
            const row = document.getElementById('log-row'); if (row.parentNode !== home) home.appendChild(row);
            document.getElementById('m-log-sheet')?.remove(); document.getElementById('m-nav')?.remove();
            document.body.classList.remove('mview-left','mview-center','mview-right','mlog-open');
            document.documentElement.style.setProperty('--m-nav-h','0px');
        }
        fitMobileViewport();
        if (window.gameLayout) gameLayout.apply();
    }
    addEventListener('resize',sync);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',sync); else sync();
    document.addEventListener('click',event => {
        if (event.target.closest('[data-view="logout"]')) queueMicrotask(() => {
            const message = document.getElementById('m-logout-msg'); if (message) message.textContent = '回首頁或切換角色前會儲存進度。離線收益依本版資格與 12 小時上限計算。';
            for (const button of document.querySelectorAll('.m-logout-slot-go')) if (Number(button.dataset.slot) > visibleSaveSlotMax()) button.closest('.m-logout-slot').remove();
        });
        const button = event.target.closest('#m-logout-ok,.m-logout-slot-go'); if (!button) return;
        event.preventDefault(); event.stopImmediatePropagation();
        try {
            const slot = Number(button.dataset.slot);
            if (button.dataset.slot && (!Number.isInteger(slot) || slot < 1 || slot > visibleSaveSlotMax() || !slotSummary(slot))) throw Error('此角色目前無法選擇。');
            if (state.ff || typeof catchupActive === 'function' && catchupActive()) throw Error('正在結算，請稍後再切換。');
            window.__fb5CloseFlush = true;
            try { if (saveGame() !== true) throw Error('進度儲存失敗，未離開目前角色。'); }
            finally { window.__fb5CloseFlush = false; }
            if (!returnToCharacterSelect()) throw Error('未能返回選角，請重試。');
            document.getElementById('m-logout-modal')?.classList.remove('open');
            if (button.dataset.slot) { currentSlot = slot; loadGame(); }
            else loadBackToMenu();
        } catch (e) { alert(e.message); }
    },true);
})();
