// Adapt mirrored optional tools to the current game's UI and save contracts.
(function () {
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
