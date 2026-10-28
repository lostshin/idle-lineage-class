// Save status is session-local; failed writes never require another storage write.
document.addEventListener('DOMContentLoaded', () => {
    const status = document.createElement('p');
    status.id = 'save-health-status'; status.setAttribute('role','status');
    document.getElementById('settings-general').prepend(status);
    const notice = document.createElement('section');
    notice.id = 'save-recovery-notice'; notice.hidden = true; notice.setAttribute('aria-label','存檔失敗救援');
    notice.innerHTML = '<p id="save-recovery-message" role="status"></p><div><button type="button" class="btn" id="save-recovery-export">匯出救援帳號</button><button type="button" class="btn" id="save-recovery-retry">重試存檔</button></div>';
    document.body.appendChild(notice);
    function refresh() {
        const health = player.cls ? saveHealth.get(accountRoleId(player)) : null;
        const time = health?.at ? new Date(health.at).toLocaleTimeString('zh-TW') : '本次開頁尚無成功紀錄';
        status.textContent = '上次成功儲存：'+time+(health?.failed ? '；目前進度未確認完整儲存。' : '。');
        notice.hidden = !health?.failed || document.getElementById('game-screen').classList.contains('hidden');
        document.getElementById('save-recovery-message').textContent = '進度未確認完整儲存，請勿重新整理或關閉頁面。上次成功：'+time+'。請先匯出救援帳號，再排除儲存問題。匯出不代表本機存檔已恢復。';
    }
    document.getElementById('save-recovery-export').onclick = () => exportAccount(true);
    document.getElementById('save-recovery-retry').onclick = () => { saveGame(); refresh(); };
    window.addEventListener('save-health-change',refresh);
    for (const name of ['loadGame','startGame','returnToCharacterSelect','backToMenu']) {
        const original = window[name];
        window[name] = function (...args) { const result = original.apply(this,args); refresh(); return result; };
    }
    refresh();
});
