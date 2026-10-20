// Reuse the lobby report; the displayed total is a ten-minute snapshot.
const onlinePresence = (() => {
    const label = document.getElementById('world-online-count');
    const game = document.getElementById('game-screen');
    const officialSite = location.origin === 'https://lostshin.github.io' && ['/idle-lineage-class/','/idle-lineage-class/index.html'].includes(location.pathname);
    let count = null, receivedAt = 0, checkedAt = 0, serverAt = 0, failed = false;
    function canConnect() {
        const endpoint = document.getElementById('social-lobby-api')?.content || '';
        // Explicit loopback backends are isolated development services, never the public lobby.
        return officialSite || /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/.test(endpoint);
    }
    function paint() {
        label.hidden = !canConnect() || game.classList.contains('hidden') || !player.cls;
        const stale = failed || count !== null && performance.now()-checkedAt > 900000;
        label.dataset.state = count !== null ? stale ? 'stale' : 'ready' : failed ? 'unavailable' : 'connecting';
        label.textContent = count !== null ? '（近 30 分鐘活躍 '+count.toLocaleString('en-US')+' 人）'
            : failed ? '（活躍人數暫不可用）' : '（活躍人數查詢中）';
        label.title = count !== null ? '後端統計正式站近 30 分鐘的遊玩訪客；不含本機，同一瀏覽器多分頁合計 1 人。每 10 分鐘更新，與大廳的 10 分鐘在線／24 小時旅人不同。最近更新：'+new Date(serverAt).toLocaleString('zh-TW')+(stale ? '；更新失敗或逾時，保留上次資料。' : '')
            : '無法確認活躍人數，重新連線後會更新。';
    }
    new MutationObserver(paint).observe(game, {attributes:true,attributeFilter:['class']});
    setInterval(paint, 300000);
    paint();
    return {
        page: officialSite ? location.pathname : '',
        canConnect,
        update(value, serverTime) {
            if (!Number.isSafeInteger(value) || value < 0 || !Number.isFinite(serverTime)) { this.unavailable(); return; }
            const at = performance.now();
            if (count === null || at-receivedAt >= 600000) { count = value; receivedAt = at; serverAt = serverTime; }
            checkedAt = at; failed = false; paint();
        },
        unavailable() { failed = true; paint(); }
    };
})();
