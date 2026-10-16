// Announce-only tracker presence. Never request peers or create WebRTC connections.
function createOnlinePresence({trackerUrl, infoHash}) {
    const label = document.getElementById('world-online-count');
    const game = document.getElementById('game-screen');
    const ID_KEY = 'lineage_online_browser_v1';
    const SNAPSHOT_KEY = 'lineage_online_snapshot_v1_' + infoHash;
    const MAX_AGE = 5 * 60 * 1000;
    const RESPONSE_TIMEOUT = 10000;
    const room = infoHash.match(/../g).map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
    let active = false, disposed = false, leader = false, socket = null, peerId = '';
    let lockAbort = null, leaderTask = null, releaseLeader = null;
    let announceTimer = null, responseTimer = null, retryTimer = null, retryDelay = 5000;
    let latest = null, awaitingReply = false;

    function paint(snapshot) {
        label.hidden = !active;
        if (!active) return;
        const fresh = snapshot && Date.now() - snapshot.at < MAX_AGE;
        const ready = fresh && snapshot.state === 'ready' && Number.isSafeInteger(snapshot.count) && snapshot.count >= 1;
        label.dataset.state = ready ? 'ready' : snapshot?.state === 'connecting' ? 'connecting' : 'unavailable';
        label.textContent = ready ? '（目前線上 ' + snapshot.count.toLocaleString('en-US') + ' 人）'
            : label.dataset.state === 'connecting' ? '（線上人數查詢中）' : '（線上人數暫不可用）';
        label.title = ready ? '定期更新，同一瀏覽器多分頁合計 1 人。最近更新：' + new Date(snapshot.at).toLocaleTimeString('zh-TW')
            : '暫時無法取得在線人數，稍後會自動重試。';
    }
    function readSnapshot() {
        try { latest = JSON.parse(localStorage.getItem(SNAPSHOT_KEY)); }
        catch (e) { latest = null; }
        paint(latest);
    }
    function publish(state, count = null) {
        latest = {state, count, at: Date.now()};
        paint(latest);
        try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(latest)); } catch (e) {}
    }
    function clearNetworkTimers() {
        clearTimeout(announceTimer); clearTimeout(responseTimer); clearTimeout(retryTimer);
        announceTimer = responseTimer = retryTimer = null;
        awaitingReply = false;
    }
    function payload(event) {
        return JSON.stringify({action:'announce',info_hash:room,peer_id:peerId,event,left:1,downloaded:0,uploaded:0,offers:[]});
    }
    function fail(connection) {
        if (socket !== connection) return;
        socket = null;
        clearNetworkTimers();
        connection.close();
        if (!active || disposed || !leader) return;
        publish('unavailable');
        retryTimer = setTimeout(() => { retryTimer = null; connect(); }, retryDelay + Math.random() * 1000);
        retryDelay = Math.min(300000, retryDelay * 2);
    }
    function announce(event) {
        if (!active || !leader || !socket || socket.readyState !== WebSocket.OPEN || awaitingReply) return;
        clearTimeout(announceTimer);
        awaitingReply = true;
        const connection = socket;
        responseTimer = setTimeout(() => fail(connection), RESPONSE_TIMEOUT);
        try { connection.send(payload(event)); } catch (e) { fail(connection); }
    }
    function connect() {
        if (!active || disposed || !leader || socket || retryTimer) return;
        let connection;
        try { connection = new WebSocket(trackerUrl); }
        catch (e) { publish('unavailable'); return; }
        socket = connection;
        responseTimer = setTimeout(() => fail(connection), RESPONSE_TIMEOUT);
        connection.onopen = () => {
            if (socket !== connection || !active) { connection.close(); return; }
            clearTimeout(responseTimer);
            announce('started');
        };
        connection.onmessage = event => {
            if (socket !== connection || !active || !awaitingReply) return;
            let data;
            try { data = JSON.parse(event.data); } catch (e) { fail(connection); return; }
            if (!data || data['failure reason']) { fail(connection); return; }
            if (data.action !== 'announce' || data.info_hash !== room || data.offer || data.answer) return;
            const count = data.complete + data.incomplete;
            if (!Number.isSafeInteger(data.complete) || data.complete < 0 || !Number.isSafeInteger(data.incomplete) || data.incomplete < 0 || !Number.isSafeInteger(count) || count < 1) {
                fail(connection); return;
            }
            clearTimeout(responseTimer);
            awaitingReply = false;
            retryDelay = 5000;
            publish('ready', count);
            const interval = Number.isFinite(data.interval) && data.interval > 0 ? data.interval * 1000 : 120000;
            announceTimer = setTimeout(() => announce('update'), Math.max(1000, interval));
        };
        connection.onclose = () => fail(connection);
        connection.onerror = () => fail(connection);
    }
    async function disconnect() {
        clearNetworkTimers();
        const connection = socket;
        socket = null;
        if (!connection) return;
        connection.onopen = connection.onmessage = connection.onerror = connection.onclose = null;
        if (connection.readyState !== WebSocket.OPEN) { connection.close(); return; }
        // Wait for the stop acknowledgment before another tab reuses the same peer ID.
        await new Promise(resolve => {
            const done = () => { clearTimeout(timeout); connection.close(); resolve(); };
            const timeout = setTimeout(done, 1500);
            connection.addEventListener('message', done, {once:true});
            connection.addEventListener('close', done, {once:true});
            try { connection.send(payload('stopped')); } catch (e) { done(); }
        });
    }
    function acquireLeader() {
        if (lockAbort || !active || disposed) return;
        if (!navigator.locks || !window.crypto?.getRandomValues) { paint(null); return; }
        const abort = new AbortController();
        lockAbort = abort;
        leaderTask = navigator.locks.request('lineage-online-' + infoHash, {signal:abort.signal}, async () => {
            if (!active || disposed) return;
            try {
                let hex = localStorage.getItem(ID_KEY);
                if (!/^[a-f0-9]{40}$/.test(hex || '')) hex = Array.from(crypto.getRandomValues(new Uint8Array(20)), byte => byte.toString(16).padStart(2, '0')).join('');
                localStorage.setItem(ID_KEY, hex);
                if (localStorage.getItem(ID_KEY) !== hex) throw Error('Presence identity was not saved');
                peerId = hex.match(/../g).map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
            } catch (e) { publish('unavailable'); return; }
            leader = true;
            label.dataset.reporter = 'true';
            publish('connecting');
            try {
                await new Promise(resolve => { releaseLeader = resolve; connect(); });
                await disconnect();
            } finally {
                releaseLeader = null; leader = false; label.dataset.reporter = 'false';
            }
        }).catch(error => { if (error.name !== 'AbortError') paint(null); }).finally(() => {
            if (lockAbort === abort) lockAbort = null;
            if (active && !disposed && abort.signal.aborted) acquireLeader();
        });
    }
    function sync() {
        const inGame = !disposed && !game.classList.contains('hidden') && typeof player !== 'undefined' && !!player.cls;
        if (active === inGame) return;
        active = inGame;
        if (active) { readSnapshot(); acquireLeader(); }
        else {
            label.hidden = true;
            lockAbort?.abort();
            releaseLeader?.();
        }
    }
    function refresh() {
        sync();
        if (!active) return;
        if (leader) { if (socket) announce('update'); else connect(); }
        else { readSnapshot(); acquireLeader(); }
    }
    function onStorage(event) { if (event.key === SNAPSHOT_KEY && active && !leader) readSnapshot(); }
    function onVisibility() { if (document.visibilityState === 'visible') refresh(); }
    function onPageHide() { active = false; lockAbort?.abort(); releaseLeader?.(); }
    const observer = new MutationObserver(sync);
    observer.observe(game, {attributes:true,attributeFilter:['class']});
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    const freshnessTimer = setInterval(() => { if (active) paint(latest); }, 30000);
    sync();
    return {
        refresh,
        stop() {
            disposed = true; active = false; label.hidden = true;
            observer.disconnect(); clearInterval(freshnessTimer);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('online', refresh);
            window.removeEventListener('pageshow', refresh);
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('visibilitychange', onVisibility);
            lockAbort?.abort(); releaseLeader?.();
            return leaderTask || Promise.resolve();
        }
    };
}

// Local/file copies stay outside the public website's room.
if (location.origin === 'https://lostshin.github.io' && location.pathname.startsWith('/idle-lineage-class/')) {
    createOnlinePresence({trackerUrl:'wss://wt.tionis.dev',infoHash:'92d3fe673d72bb775e92cf1f3d97fb9795ee5e40'});
}
