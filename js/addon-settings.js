// Settings controls stay mounted: gameplay reads their IDs even in a hidden panel.
document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('tab-automation');
    const general = document.createElement('section');
    general.id = 'settings-general'; general.setAttribute('role','tabpanel'); general.setAttribute('aria-labelledby','settings-tab-general');
    while (host.firstChild) general.appendChild(host.firstChild);
    const nav = document.createElement('div'); nav.className = 'settings-tabs'; nav.setAttribute('role','tablist'); nav.setAttribute('aria-label','設定分類');
    nav.innerHTML = '<button type="button" class="btn" id="settings-tab-general" role="tab" aria-controls="settings-general" aria-selected="true">一般設定</button><button type="button" class="btn" id="settings-tab-addons" role="tab" aria-controls="settings-addons" aria-selected="false" tabindex="-1">加掛版功能</button>';
    const panel = document.createElement('section'); panel.id = 'settings-addons'; panel.className = 'hidden'; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby','settings-tab-addons');
    panel.innerHTML = '<p class="addon-intro">目前已內建的功能維持開啟。以下額外功能預設關閉，這台裝置的角色共用選擇；儲存並重新載入後生效。</p><div id="addons-options"></div><details class="addon-info"><summary>已內建的功能</summary><p>木人場、賽狗、自動補貨、找王／避王、查詢與小百科、倉庫擴充、能力來源、隊伍介面、離線結算及帳號搬移，皆是本版固定基底。</p></details><details class="addon-info"><summary>未提供的來源功能</summary><p>來源離線引擎、舊點數來源與整包清空還原已由本版取代。身分重發、第三方搬家、作者統計及重複首頁工具不列入可選功能。</p></details><section id="addon-history" hidden></section><div class="addon-actions"><button type="button" class="btn" id="addons-apply">儲存並重新載入</button><button type="button" class="btn" id="addons-cancel">取消變更</button><button type="button" class="btn" id="addons-off">全部關閉</button><p id="addons-status" role="status" aria-live="polite"></p></div>';
    host.append(nav,general,panel);
    const list = panel.querySelector('#addons-options');
    let group = '';
    for (const item of optionalAddons.catalog) {
        if (item.group !== group) { group = item.group; const title = document.createElement('h3'); title.textContent = group; list.appendChild(title); }
        const label = document.createElement('label'); label.className = 'addon-option';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.addonId = item.id; input.checked = optionalAddons.selection()[item.id];
        const text = document.createElement('span'), name = document.createElement('strong'), desc = document.createElement('small');
        name.textContent = item.name; desc.textContent = item.desc; text.append(name,desc); label.append(input,text); list.appendChild(label);
    }
    function status(message) { document.getElementById('addons-status').textContent = message; }
    function selection() { return Object.fromEntries([...list.querySelectorAll('input')].map(input => [input.dataset.addonId,input.checked])); }
    function select(id) {
        const addons = id === 'addons'; general.classList.toggle('hidden',addons); panel.classList.toggle('hidden',!addons);
        for (const key of ['general','addons']) { const button = document.getElementById('settings-tab-'+key), selected = key === id; button.setAttribute('aria-selected',String(selected)); button.tabIndex = selected ? 0 : -1; }
        if (addons && AFK_TOGGLES.enabled('history')) renderAddonHistory();
    }
    for (const id of ['general','addons']) {
        const button = document.getElementById('settings-tab-'+id); button.onclick = () => select(id);
        button.onkeydown = event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 'general' : event.key === 'End' ? 'addons' : id === 'general' ? 'addons' : 'general'; select(next); document.getElementById('settings-tab-'+next).focus(); };
    }
    list.addEventListener('change',() => status('尚未套用，儲存並重新載入後生效。'));
    document.getElementById('addons-cancel').onclick = () => { const active = optionalAddons.selection(); for (const input of list.querySelectorAll('input')) input.checked = active[input.dataset.addonId]; status('已取消變更。'); };
    document.getElementById('addons-off').onclick = () => { for (const input of list.querySelectorAll('input')) input.checked = false; status('已選擇全部關閉，尚未套用。'); };
    document.getElementById('addons-apply').onclick = () => {
        try {
            accountIdleRequired();
            if (state.ff || document.getElementById('ff-progress-indicator')?.getClientRects().length) throw Error('正在結算，請完成後再套用。');
            if (player.cls && !document.getElementById('game-screen').classList.contains('hidden')) {
                window.__fb5CloseFlush = true;
                try { if (saveGame() !== true) throw Error('角色進度儲存失敗，尚未重新載入。'); }
                finally { window.__fb5CloseFlush = false; }
                if (_mercLedgerOutbox.length) { _mercLedgerFlush(); if (_mercLedgerOutbox.length) throw Error('傭兵經驗尚未寫入，請稍後重試。'); }
            }
            optionalAddons.save(selection());
            location.reload();
        } catch (e) { status(e.message); }
    };
});

const ADDON_HISTORY_KEY = 'lineage_offline_history_v1';
function recordAddonOfflineHistory(result) {
    if (!AFK_TOGGLES.enabled('history')) return;
    let history;
    try { history = JSON.parse(_lsGet(ADDON_HISTORY_KEY) || '{}'); } catch (e) { history = {}; }
    if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
    const id = accountRoleId(player), rows = Array.isArray(history[id]) ? history[id] : [];
    history[id] = [{at:Date.now(),name:player.name || '未命名',map:result.mapName,elapsedMs:result.elapsedMs,exp:result.exp,gold:result.gold,kills:result.kills},...rows].slice(0,5);
    if (!_lsSet(ADDON_HISTORY_KEY,JSON.stringify(history))) logSys('離線收益已結算，但本機歷史紀錄儲存失敗。');
}
function renderAddonHistory() {
    const host = document.getElementById('addon-history'); if (!host) return;
    host.hidden = false; host.replaceChildren();
    const title = document.createElement('h3'); title.textContent = '本機離線掛機歷史'; host.appendChild(title);
    let data; try { data = JSON.parse(_lsGet(ADDON_HISTORY_KEY) || '{}'); } catch(e) { data = {}; }
    const rows = Object.values(data || {}).filter(Array.isArray).flat().filter(row => row && typeof row === 'object').sort((a,b) => b.at-a.at);
    if (!rows.length) { const p = document.createElement('p'); p.textContent = '啟用後完成離線結算，即會留下紀錄。'; host.appendChild(p); }
    for (const row of rows) { const p = document.createElement('p'); p.className = 'addon-history-row'; p.textContent = row.name+' · '+row.map+' · '+new Date(row.at).toLocaleString('zh-TW')+'｜'+Math.floor(row.elapsedMs/60000)+' 分鐘｜經驗 '+row.exp+'／金幣 '+row.gold+'／擊殺 '+row.kills; host.appendChild(p); }
}
