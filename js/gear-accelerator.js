// Adapted from https://aquamarineserver.com/Lineage/ (2026-10-18); source hashes: tests/gear-source.json.
(function () {
    if (!AFK_TOGGLES.enabled('gear')) return;
    const host = document.createElement('div');
    host.innerHTML = `<div id="gear-ui-container" style="position: fixed; top: 10px; right: 10px; width: 280px; max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); overflow: auto; background-color: rgba(15, 23, 42, 0.95); border: 2px solid #3b82f6; border-radius: 8px; z-index: 99999; color: #fff; font-size: 14px; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.3); ">
    <div id="gear-header" tabindex="0" aria-label="齒輪加速器；方向鍵移動面板" style="background-color: #1e3a8a; padding: 8px 12px; border-top-left-radius: 6px; border-top-right-radius: 6px; cursor: move; touch-action: none; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
        <span>⚙️ 齒輪加速器 (<span id="gear-current-speed">1</span>x)</span>
        <button type="button" id="gear-toggle-btn" aria-label="收合齒輪加速器" aria-expanded="true" aria-controls="gear-content" style="cursor: pointer; padding: 0 5px;">－</button>
    </div>

    <div id="gear-content" style="padding: 12px;">
        <div style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 5px;">
            <button class="gear-spd-btn" data-speed="1" style="flex: 1; padding: 4px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">1x</button>
            <button class="gear-spd-btn" data-speed="2" style="flex: 1; padding: 4px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">2x</button>
            <button class="gear-spd-btn" data-speed="4" style="flex: 1; padding: 4px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">4x</button>
            <button class="gear-spd-btn" data-speed="8" style="flex: 1; padding: 4px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">8x</button>
            <button class="gear-spd-btn" data-speed="16" style="flex: 1; padding: 4px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">16x</button>
            <button class="gear-spd-btn" data-speed="32" style="flex: 1; padding: 4px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">32x</button>
            <button class="gear-spd-btn" data-speed="64" style="flex: 1; padding: 4px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">64x</button>
            </div>

        <div style="border-top: 1px solid #334155; margin: 10px 0;"></div>

        <div style="margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" id="gear-auto-hp" checked="">
                HP低於 <input type="number" min="0" max="100" aria-label="自動回村 HP 門檻" id="gear-hp-val" value="30" style="width: 50px; background: #1e293b; color: #fff; border: 1px solid #475569; text-align: center; border-radius: 3px;"> % 自動回村
            </label>
        </div>
        <div>
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" id="gear-auto-mp">
                MP低於 <input type="number" min="0" max="100" aria-label="自動回村 MP 門檻" id="gear-mp-val" value="10" style="width: 50px; background: #1e293b; color: #fff; border: 1px solid #475569; text-align: center; border-radius: 3px;"> % 自動回村
            </label>
        </div>

        <div class="flex justify-center items-center gap-2 mb-3 shrink-0" style="margin: 10px 0px 0px 0px;">
            <input type="text" aria-label="指定黑市道具關鍵字" aria-describedby="pandora-search-status" aria-controls="pandora-search-suggestions" autocomplete="off" style="min-width:0; width:150px;" id="pandora-search-input" placeholder="輸入道具名稱(關鍵字)" class="px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white outline-none focus:border-purple-500">
            <button id="gear-refresh-market" onclick="doPandoraSpecificSearch()" class="btn bg-purple-700 hover:bg-purple-600 border-purple-500 px-3 py-1 text-xs font-bold rounded shadow" title="馬上刷新潘朵拉商品內容！">刷新黑市</button>
        </div>
        <div id="pandora-search-status" role="status" style="font-size:12px; color:#cbd5e1; margin-top:5px; overflow-wrap:anywhere;"></div>
        <div id="pandora-search-suggestions" style="display:flex; flex-direction:column; gap:3px; max-height:150px; overflow:auto;"></div>
        <div style="border-top: 1px solid #334155; margin: 10px 0;"></div>

        <div style="font-size: 12px; color: #94a3b8; text-align: center;">
            <span id="gear-status-text" role="status">當前狀態：監測中...</span>
        </div>
    </div>
</div>`;
    document.body.appendChild(host.firstElementChild);

    const ui = document.getElementById('gear-ui-container');
    const header = document.getElementById('gear-header');
    const content = document.getElementById('gear-content');
    const toggleBtn = document.getElementById('gear-toggle-btn');
    const statusText = document.getElementById('gear-status-text');
    window._speedMod = { isSpeeding: false, summary: null };

    window.setGameSpeed = function (speed) {
        speed = Number(speed);
        if (![1, 2, 4, 8, 16, 32, 64].includes(speed) || speed === currentSpeed) return;
        const lastSpeed = currentSpeed, now = _perfNow();
        // Attribute the interval before the click to its old speed, including pending background work.
        if (_loopLast !== null && state.running && !player.dead) {
            const elapsed = Math.max(0, now - _loopLast);
            _tickDebt += (document.hidden ? elapsed : Math.min(elapsed, FF_MAX_ELAPSED_MS)) * lastSpeed;
        }
        _loopLast = now;
        if (lastSpeed === 1 && speed > 1) {
            _speedMod.summary = { ticks: state.ticks, gold: player.gold || 0, items: _ffInventoryCounts() };
        }
        currentSpeed = speed;
        _speedMod.isSpeeding = speed > 1;
        if (lastSpeed === 1 || speed === 1) offlineResetRateSample();
        logSys('<span class="text-yellow-400 font-bold">【齒輪加速器】切換至' + speed + '倍速...</span>');
        if (speed === 1) _dumpSpeedhackSummary();
        document.getElementById('gear-current-speed').innerText = speed;
        document.querySelectorAll('.gear-spd-btn').forEach(btn => {
            btn.style.backgroundColor = Number(btn.dataset.speed) === speed ? '#3b82f6' : '#475569';
            btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === speed));
        });
        if (state.running && _tickDebt >= TICK_MS) _ffScheduleNext();
    };

    const searchInput = document.getElementById('pandora-search-input');
    const searchStatus = document.getElementById('pandora-search-status');
    const suggestions = document.getElementById('pandora-search-suggestions');
    let selectedItem = null;
    function suggestPandoraItems() {
        const keyword = searchInput.value.trim();
        const named = keyword ? Object.keys(DB.items).filter(id => DB.items[id]?.n?.includes(keyword)) : [];
        const exact = named.filter(id => DB.items[id].n === keyword);
        const available = named.filter(id => DB.items[id].gachaWeight > 0).sort((a, b) =>
            Number(DB.items[b].n === keyword) - Number(DB.items[a].n === keyword) || DB.items[a].n.length - DB.items[b].n.length);
        const targets = (exact.length ? exact : named).filter(id => DB.items[id].gachaWeight > 0);
        searchInput.setAttribute('aria-invalid', String(!!keyword && !targets.length));
        searchStatus.textContent = !keyword ? '留空會隨機刷新；只能指定黑市商品池內的物品。'
            : !targets.length ? (exact.length || named.length ? '此物品不在黑市商品池，無法指定；未刷新。' : '找不到相符物品；請檢查名稱，未刷新。')
            : targets.length > 1 ? `符合 ${targets.length} 件，請選下方候選或輸入完整名稱。`
            : '可指定：' + DB.items[targets[0]].n + '；按刷新黑市確認。';
        suggestions.replaceChildren();
        for (const id of available.slice(0, 8)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pandora-buy-suggestion';
            button.style.cssText = 'width:100%; white-space:normal; overflow-wrap:anywhere; text-align:left;';
            button.textContent = DB.items[id].n;
            button.addEventListener('click', () => {
                searchInput.value = DB.items[id].n;
                selectedItem = id;
                suggestions.replaceChildren();
                searchInput.setAttribute('aria-invalid', 'false');
                searchStatus.textContent = '已選擇：' + DB.items[id].n + '；按刷新黑市確認。';
                searchInput.focus();
            });
            suggestions.appendChild(button);
        }
        if (available.length > 8) searchStatus.textContent += ' 僅列前 8 件，可繼續輸入縮小範圍。';
        return targets;
    }
    searchInput.addEventListener('input', e => { selectedItem = null; if (!e.isComposing) suggestPandoraItems(); });
    searchInput.addEventListener('compositionend', () => { selectedItem = null; suggestPandoraItems(); });
    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); doPandoraSpecificSearch(); }
    });
    suggestPandoraItems();

    window.doPandoraSpecificSearch = function () {
        if (!player.cls || document.getElementById('game-screen').classList.contains('hidden')) return;
        const keyword = searchInput.value.trim();
        const matches = suggestPandoraItems();
        const targetId = matches.includes(selectedItem) ? selectedItem : matches.length === 1 ? matches[0] : null;
        if (keyword && !targetId) return;
        if (!keyword) {
            refreshPandoraMarket(true);
            searchStatus.textContent = '已隨機刷新潘朵拉商品。';
            logSys('成功刷新潘朵拉商品！');
        } else {
            const nowT = state.ticks, slots = [];
            for (let i = 0; i < PANDORA_SLOT_COUNT; i++) {
                const d = DB.items[targetId];
                slots.push({ id: targetId, price: pandoraPrice(targetId), weight: d.gachaWeight, setTick: nowT, sold: false, bless: false });
            }
            player.pandoraMarket2 = { ...player.pandoraMarket2, slots, seq: 0, lastTick: nowT, lastIdx: PANDORA_SLOT_COUNT - 1 };
            const latest = slots[PANDORA_SLOT_COUNT - 1];
            _pandoraLogLatest(latest);
            player.pandoraAnnounce = latest.weight === 1 ? latest.id : null;
            player.pandoraAnnounceBless = false;
            renderPandoraBanner();
            renderSyslogPandora();
            if (_pandoraDiv && document.body.contains(_pandoraDiv) && _pandoraDiv.querySelector('#pandora-msg')) pandoraRenderMarket(_pandoraDiv);
            logSys('已為您指定刷新：' + DB.items[targetId].n + '！');
            searchStatus.textContent = '已指定刷新：' + DB.items[targetId].n + '。';
        }
        suggestions.replaceChildren();
        if (saveGame() !== true && !catchupActive()) {
            searchStatus.textContent += ' 黑市已更新，但儲存失敗，請重試儲存。';
            logSys('黑市已更新，但儲存失敗，請重試儲存。');
        }
    };

    function _dumpSpeedhackSummary() {
        const start = _speedMod.summary;
        if (!start) return;
        const s = { sec: Math.round((state.ticks - start.ticks) / 10), gold: (player.gold || 0) - start.gold, items: {} };
        const after = _ffInventoryCounts();
        for (const id of Object.keys(after)) {
            const count = after[id] - (start.items[id] || 0);
            if (count > 0) s.items[id] = count;
        }
        const dur = s.sec >= 60 ? Math.floor(s.sec / 60) + ' 分 ' + (s.sec % 60) + ' 秒' : s.sec + ' 秒';
        logSys('<span class="text-cyan-300 font-bold">⏩ 加速總結：</span>共推進了 ' + dur + ' 的進度' + (s.gold > 0 ? '，金幣 +' + s.gold.toLocaleString() : '') + '。');
        const gains = Object.keys(s.items).filter(id => DB.items[id]);
        if (gains.length) {
            logSys('<span class="sys-item-gain">加速期間總獲得：' + gains.map(id => '<span class="' + getItemColor({ id, en: 0 }) + ' font-bold">' + DB.items[id].n + ' ×' + s.items[id] + '</span>').join('、') + '</span>');
        }
        _speedMod.summary = null;
        if (player.cls && saveGame() !== true && !catchupActive()) logSys('加速進度尚未儲存，請重試儲存。');
    }

    toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        const collapsed = content.style.display !== 'none';
        content.style.display = collapsed ? 'none' : 'block';
        toggleBtn.innerText = collapsed ? '＋' : '－';
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.setAttribute('aria-label', collapsed ? '展開齒輪加速器' : '收合齒輪加速器');
    });
    ui.querySelectorAll('.gear-spd-btn').forEach(btn => {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === 1));
        btn.addEventListener('click', () => setGameSpeed(btn.dataset.speed));
    });

    let isDragging = false, startX, startY, initialLeft, initialTop;
    function moveTo(left, top) {
        const rect = ui.getBoundingClientRect();
        ui.style.right = 'auto';
        ui.style.left = screenToUiPx(Math.max(0, Math.min(innerWidth - rect.width, left)));
        ui.style.top = screenToUiPx(Math.max(0, Math.min(innerHeight - rect.height, top)));
    }
    function onDragStart(e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = ui.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
    }
    function onDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        moveTo(initialLeft + clientX - startX, initialTop + clientY - startY);
    }
    header.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', () => { isDragging = false; });
    header.addEventListener('touchstart', onDragStart, { passive: true });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', () => { isDragging = false; });
    header.addEventListener('keydown', e => {
        if (e.target !== header || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const r = ui.getBoundingClientRect();
        moveTo(r.left + (e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0), r.top + (e.key === 'ArrowUp' ? -10 : e.key === 'ArrowDown' ? 10 : 0));
    });
    window.addEventListener('resize', () => { const r = ui.getBoundingClientRect(); moveTo(r.left, r.top); });

    let wasInTown = false;
    function checkPlayerState() {
        if (!player.cls || !state.running || document.getElementById('game-screen').classList.contains('hidden')) return;
        const currentlyInTown = mapState.current.startsWith('town_');
        if (player.dead) {
            if (state.inTick) return;
            const savedSpeed = currentSpeed;
            setGameSpeed(1);
            reviveInPlace();
            if (player.dead) { revive(); wasInTown = true; }
            statusText.textContent = '當前狀態：已自動復活';
            setGameSpeed(savedSpeed);
            return;
        }
        if (!currentlyInTown) {
            const hpLimit = Math.max(0, Math.min(100, Number(document.getElementById('gear-hp-val').value) || 0));
            const mpLimit = Math.max(0, Math.min(100, Number(document.getElementById('gear-mp-val').value) || 0));
            const lowHp = document.getElementById('gear-auto-hp').checked && player.hp / Math.max(1, player.mhp) * 100 <= hpLimit;
            const lowMp = document.getElementById('gear-auto-mp').checked && player.mmp > 0 && player.mp / player.mmp * 100 <= mpLimit;
            if (lowHp || lowMp) {
                const blocked = player.statuses && ['stone', 'paralyze', 'freeze', 'stun', 'sleep'].some(k => player.statuses[k] > 0);
                if (blocked || state.riftRun && mapState.current === 'rift_battle') {
                    statusText.textContent = '當前狀態：目前無法回村';
                    return;
                }
                returnToTown();
                wasInTown = mapState.current.startsWith('town_');
                statusText.textContent = wasInTown ? '當前狀態：血魔過低，觸發自動回村' : '當前狀態：目前無法回村';
                return;
            }
            statusText.textContent = currentSpeed > 1 ? '當前狀態：加速掛機中...' : '當前狀態：監測中...';
        } else if (wasInTown && player.hp >= player.mhp * .99 && player.mp >= player.mmp * .99) {
            statusText.textContent = '當前狀態：補滿血魔，回到掛機點！';
            departToLastBattle();
            wasInTown = false;
        }
    }
    const originalTick = window.tick;
    window.tick = function () {
        if (!player.dead) checkPlayerState();
        return originalTick.apply(this, arguments);
    };
    const originalSelect = window.returnToCharacterSelect;
    window.returnToCharacterSelect = function () {
        setGameSpeed(1);
        wasInTown = false;
        return originalSelect.apply(this, arguments);
    };
    function monitorTick() {
        try { checkPlayerState(); }
        catch (e) { statusText.textContent = '當前狀態：齒輪加速器監控錯誤'; console.error('[gear]', e); }
        setTimeout(monitorTick, Math.max(100, 500 / currentSpeed));
    }
    setTimeout(monitorTick, 500);
})();
