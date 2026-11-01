// Release checks never write game data; only an explicit, fully saved update navigates.
const comfortUpdate = (() => {
    const POLL_MS = 10 * 60 * 1000, TICKET_KEY = 'comfort_update_pending';
    const build = document.querySelector('meta[name="comfort-build"]')?.content || '';
    const publishedAt = Date.parse(document.querySelector('meta[name="comfort-published"]')?.content || '');
    const official = location.origin === 'https://lostshin.github.io' && ['/idle-lineage-class/','/idle-lineage-class/index.html'].includes(location.pathname);
    let latest = null, dismissed = '', timer = null, pending = null, checkedAt = -Infinity, bar = null, updating = false, result = '', showStatus = false;
    const versionParts = version => /^v\d+\.\d+\.\d+$/.test(version || '') ? version.slice(1).split('.').map(Number) : null;
    function compareVersions(a, b) {
        const x = versionParts(a), y = versionParts(b);
        if (!x || !y || [...x,...y].some(n => !Number.isSafeInteger(n))) return null;
        for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
        return 0;
    }
    function endpoint() {
        if (!/^https?:$/.test(location.protocol) || typeof _FS !== 'undefined' && _FS) return null;
        if (official) return new URL('comfort-update.json',location.href);
        // Only an explicitly configured loopback fixture can enable checks outside the official site.
        if (!['127.0.0.1','localhost','[::1]'].includes(location.hostname)) return null;
        try {
            const url = new URL(document.querySelector('meta[name="comfort-update-url"]')?.content || '');
            return url.origin === location.origin && url.pathname === new URL('comfort-update.json',location.href).pathname ? url : null;
        } catch { return null; }
    }
    function validRelease(data) {
        return data?.schema === 1 && data.product === 'idle-lineage-comfort' && compareVersions(data.version,FORK_VERSION) !== null
            && /^[a-f0-9]{64}$/.test(data.build || '') && Number.isFinite(Date.parse(data.publishedAt))
            && Array.isArray(data.notes) && data.notes.length <= 12 && data.notes.every(note => typeof note === 'string' && note.length <= 400);
    }
    function newer(data) {
        const order = compareVersions(data.version,FORK_VERSION);
        return data.build !== build && (order > 0 || order === 0 && Number.isFinite(publishedAt) && Date.parse(data.publishedAt) > publishedAt);
    }
    const inGame = () => !!player?.cls && !document.getElementById('game-screen').classList.contains('hidden');
    function button(id, text, handler) {
        const element = document.createElement('button'); element.type = 'button'; element.id = id; element.className = 'btn'; element.textContent = text; element.onclick = handler; return element;
    }
    function paint() {
        const entry = document.getElementById('update-settings-open');
        if (entry) entry.textContent = latest ? '新版 '+latest.version+' · 顯示更新提示' : '檢查遊戲更新';
        const failed = inGame() && saveHealth.get(accountRoleId(player))?.failed;
        const visible = !failed && (showStatus || latest && dismissed !== latest.build);
        if (!bar && !visible) return;
        if (!bar) {
            bar = document.createElement('section'); bar.id = 'update-notice'; bar.setAttribute('aria-label','遊戲更新');
            const info = document.createElement('div'); info.className = 'update-notice-info';
            const title = document.createElement('span'); title.className = 'update-notice-title'; title.setAttribute('role','status');
            const meta = document.createElement('span'); meta.className = 'update-notice-meta';
            info.append(title,meta);
            const actions = document.createElement('div'); actions.className = 'update-notice-actions';
            actions.append(button('update-apply','儲存並更新',apply),button('update-notice-later','稍後',() => { dismissed = latest?.build || ''; showStatus = false; paint(); }));
            const message = document.createElement('p'); message.id = 'update-result'; message.setAttribute('role','status'); message.tabIndex = -1;
            bar.append(info,actions,message); document.body.appendChild(bar);
        }
        bar.hidden = !visible;
        bar.querySelector('.update-notice-title').textContent = latest ? '新版 '+latest.version+' 已發布' : '遊戲更新';
        bar.querySelector('.update-notice-meta').textContent = latest ? '目前 '+FORK_VERSION : '';
        document.getElementById('update-apply').hidden = !latest;
        const message = document.getElementById('update-result'); message.textContent = result; message.hidden = !result;
    }
    function open() {
        showStatus = true;
        if (result.startsWith('進度未確認完整儲存') && !saveHealth.get(accountRoleId(player))?.failed) result = '';
        paint();
    }
    function updateBlocker() {
        if (document.hidden) return '請回到遊戲畫面後再更新。';
        if (state.ff || state.inTick || catchupActive()) return '正在結算，請完成後再更新。';
        if (document.getElementById('creation-panel')?.classList.contains('hidden') === false) return '請先完成或取消創角，再更新。';
        if (document.querySelector('.transfer-overlay:not([hidden])')) return '請先完成或取消帳號操作，再更新。';
        if (inGame()) {
            if (player.dead) return '請先復活，再儲存並更新。';
            if (saveHealth.get(accountRoleId(player))?.failed) return '進度未確認完整儲存，請先處理存檔救援，再更新。';
            if (state.antharas || state.riftRun || state.prideClimb || player.siege?.active || /^(?:antharas_|rift_battle|siege_v2_)/.test(mapState.current)) return '請先完成目前副本或攻城，再更新。';
            if (!_uiConfigReady) return '角色尚在載入，請稍後再更新。';
            if (!_roleSaveAllowed()) return '角色存檔位已變更，無法從此分頁更新。';
        }
        return '';
    }
    async function apply() {
        if (updating || !latest) return;
        updating = true;
        const action = document.getElementById('update-apply'), message = document.getElementById('update-result'); action.disabled = true;
        let ticketWritten = false;
        try {
            const blocked = updateBlocker(); if (blocked) throw Error(blocked);
            accountIdleRequired();
            if (inGame()) {
                const flush = window.__fb5CloseFlush; window.__fb5CloseFlush = true;
                try { if (saveGame() !== true) throw Error('進度未確認完整儲存，請先處理存檔救援，再更新。'); }
                finally { window.__fb5CloseFlush = flush; }
                if (_mercLedgerOutbox.length) { _mercLedgerFlush(); if (_mercLedgerOutbox.length) throw Error('傭兵經驗尚未寫入，請稍後重試。'); }
            }
            const ticket = JSON.stringify({from:build,to:latest.build,slot:inGame() ? currentSlot : null,at:Date.now()});
            sessionStorage.setItem(TICKET_KEY,ticket);
            if (sessionStorage.getItem(TICKET_KEY) !== ticket) throw Error('更新狀態無法保存，請稍後重試。');
            ticketWritten = true;
            const url = new URL(location.href); url.searchParams.set('comfort-update',latest.build.slice(0,12));
            location.replace(url.href);
        } catch (error) {
            if (ticketWritten) try { sessionStorage.removeItem(TICKET_KEY); } catch {}
            result = error.message || '更新未完成，請稍後重試。'; message.textContent = result; message.focus(); paint();
        } finally { updating = false; action.disabled = false; }
    }
    function schedule() {
        clearTimeout(timer); timer = null;
        if (endpoint() && !document.hidden) timer = setTimeout(() => { check(); },Math.max(1000,POLL_MS-(performance.now()-checkedAt)));
    }
    function check() {
        if (pending) return pending;
        const url = endpoint();
        if (!url || document.hidden) return Promise.resolve();
        checkedAt = performance.now();
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),8000);
        pending = (async () => {
            try {
                const response = await fetch(url.href,{cache:'no-store',credentials:'omit',signal:controller.signal});
                if (!response.ok) throw Error('release unavailable');
                const data = await response.json();
                if (!validRelease(data)) throw Error('invalid release');
                if (newer(data) && (!latest || compareVersions(data.version,latest.version) > 0 || data.version === latest.version && Date.parse(data.publishedAt) >= Date.parse(latest.publishedAt))) latest = data;
                // Check-status text is stale once a later check answers; reload and save messages stay.
                const checkStatus = ['目前未查到較新的版本。','目前無法檢查更新，請確認連線後重試。'];
                if (!latest && (!result || checkStatus.includes(result))) result = checkStatus[0];
                else if (latest && checkStatus.includes(result)) result = '';
                paint();
            } catch { if (!latest) result = '目前無法檢查更新，請確認連線後重試。'; }
            finally { clearTimeout(timeout); pending = null; schedule(); }
        })();
        return pending;
    }
    function resume() {
        try {
            const raw = sessionStorage.getItem(TICKET_KEY);
            if (!raw) return;
            const ticket = JSON.parse(raw);
            sessionStorage.removeItem(TICKET_KEY);
            if (!ticket || !/^[a-f0-9]{64}$/.test(ticket.to || '') || Date.now()-ticket.at < 0 || Date.now()-ticket.at > 3600000) return;
            if (Number.isInteger(ticket.slot) && ticket.slot >= 1 && ticket.slot <= SAVE_SLOT_MAX) { openLoadSelect(); loadSetPage(Math.ceil(ticket.slot / 4)); loadSelectSlot(ticket.slot); }
            result = build === ticket.to ? '已載入新版 '+FORK_VERSION+'。' : '目前仍是原版本，更新尚未完成。請確認連線後再試，不會自動重新整理。';
            open();
        } catch { result = '更新狀態無法讀取；請確認目前版本。'; }
    }
    document.addEventListener('DOMContentLoaded',() => {
        if (!endpoint()) return;
        const settings = document.getElementById('settings-general');
        const entry = button('update-settings-open','檢查遊戲更新',async () => { result = ''; await check(); open(); }); settings.appendChild(entry);
        new MutationObserver(paint).observe(document.getElementById('game-screen'),{attributes:true,attributeFilter:['class']});
        window.addEventListener('save-health-change',paint);
        document.addEventListener('visibilitychange',() => { if (!document.hidden && performance.now()-checkedAt >= POLL_MS) check(); else schedule(); });
        window.addEventListener('online',() => { if (performance.now()-checkedAt >= POLL_MS) check(); });
        window.addEventListener('pageshow',event => { if (event.persisted && performance.now()-checkedAt >= POLL_MS) check(); });
        resume(); check();
    });
    return {check,open};
})();
window.comfortUpdate = comfortUpdate;
