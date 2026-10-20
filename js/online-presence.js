// The lobby heartbeat owns the connection; this view never creates a second transport.
const onlinePresence = (() => {
    const label = document.getElementById('world-online-count');
    const game = document.getElementById('game-screen');
    const officialSite = location.origin === 'https://lostshin.github.io' && ['/idle-lineage-class/','/idle-lineage-class/index.html'].includes(location.pathname);
    let count = null, receivedAt = 0, failed = false;
    function paint() {
        label.hidden = game.classList.contains('hidden') || !player.cls;
        const fresh = count !== null && performance.now() - receivedAt < 120000 && !failed;
        label.dataset.state = fresh ? 'ready' : failed || count !== null ? 'unavailable' : 'connecting';
        label.textContent = fresh ? (officialSite ? '（目前線上 ' : '（正式站線上 ') + count.toLocaleString('en-US') + ' 人）'
            : label.dataset.state === 'connecting' ? '（線上人數查詢中）' : '（線上人數暫不可用）';
        label.title = fresh ? '後端統計 https://lostshin.github.io/idle-lineage-class/ 最近 2 分鐘有心跳的遊玩訪客；不含本機或其他專案，同一瀏覽器多分頁合計 1 人。'
            : '無法確認後端有效連線人數，重新連線後會更新。';
    }
    new MutationObserver(paint).observe(game, {attributes:true,attributeFilter:['class']});
    setInterval(paint, 30000);
    paint();
    return {
        page: officialSite ? location.pathname : '',
        update(value) {
            if (!Number.isSafeInteger(value) || value < 0) { this.unavailable(); return; }
            count = value; receivedAt = performance.now(); failed = false; paint();
        },
        unavailable() { failed = true; paint(); }
    };
})();
