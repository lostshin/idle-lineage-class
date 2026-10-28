// One read-only UTF-16 estimate for the warning, storage list and diagnostics.
(function () {
    const REFERENCE_BYTES = 5 * 1024 * 1024;
    function collect() {
        const rows = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i); if (key == null) continue;
            const value = localStorage.getItem(key) || '';
            rows.push({key,bytes:(key.length+value.length)*2,form:value.startsWith('LZ1:') ? '壓縮' : value.startsWith('SIG1:') ? '未壓縮' : '明文'});
        }
        rows.sort((a,b) => b.bytes-a.bytes);
        const bytes = rows.reduce((sum,row) => sum+row.bytes,0);
        return {rows,bytes,percent:bytes/REFERENCE_BYTES*100};
    }
    function size(bytes) { return bytes >= 1024*1024 ? (bytes/1024/1024).toFixed(2)+' MiB' : (bytes/1024).toFixed(2)+' KiB'; }
    function summary(data) { return 'UTF-16 估算 '+size(data.bytes)+'／參考 5 MiB（'+data.percent.toFixed(1)+'%）；實際配額依瀏覽器而異'; }
    const guidance = '可在角色的「設定 → 加掛版功能」啟用「存檔即時壓縮」，儲存其他變更並重新載入後生效。壓縮比例與耗時依資料及裝置而異。請先確認存檔成功並匯出帳號備份，再整理不需要的角色；寫入失敗時請先在遊戲畫面匯出救援帳號，勿重新整理。';
    function refresh() {
        const menu = document.getElementById('main-menu'); if (!menu) return;
        let data;
        try { data = collect(); } catch { return; }
        let banner = document.getElementById('afk-quotawarn');
        if (data.percent < 80 || _FS) { banner?.remove(); return; }
        if (!banner) { banner = document.createElement('div'); banner.id = 'afk-quotawarn'; banner.className = 'storage-health-warning'; menu.prepend(banner); }
        banner.textContent = '存檔空間可能接近參考容量。'+summary(data)+'。'+guidance;
    }
    function storageDetails() {
        const body = document.getElementById('m-stg-body'); if (!document.getElementById('m-stg-modal')?.classList.contains('open')) return;
        try {
            const data = collect(), total = body.querySelector('.m-stg-total'), bar = total.querySelector('.m-stg-capbar');
            total.replaceChildren(document.createTextNode(summary(data)));
            if (bar) { bar.firstElementChild.style.width = Math.min(100,data.percent).toFixed(1)+'%'; total.appendChild(bar); }
            let help = body.querySelector('.m-stg-warn');
            if (!help) { help = document.createElement('p'); help.className = 'm-stg-warn'; total.after(help); }
            help.textContent = guidance;
            const byKey = new Map(data.rows.map(row => [row.key,row]));
            for (const item of body.querySelectorAll('.m-stg-item')) {
                const row = byKey.get(item.querySelector('.m-stg-key').title);
                if (row) item.querySelector('.m-stg-size').textContent = size(row.bytes);
            }
            const copy = body.querySelector('#m-stg-copy');
            if (copy) copy.addEventListener('click',event => {
                event.stopImmediatePropagation();
                copyText([summary(data),...data.rows.map(row => '['+row.form+'] '+row.key+'：'+size(row.bytes))].join('\n'),copy);
            },true);
        } catch { body.textContent = '無法讀取本機儲存用量，未更動任何資料。'; }
    }
    async function copyText(text,button) {
        try { await navigator.clipboard.writeText(text); button.textContent = '已複製'; }
        catch {
            const area = document.createElement('textarea'); area.value = text; button.after(area); area.focus(); area.select();
            if (document.execCommand('copy')) { area.remove(); button.focus(); button.textContent = '已複製'; }
            else button.textContent = '請選取文字複製';
        }
    }
    let diagnosticBody;
    function syncDiagnostic() {
        if (!diagnosticBody) return;
        const original = diagnosticBody.textContent;
        if (!/^localStorage:/m.test(original)) return;
        let replacement;
        try {
            const data = collect();
            replacement = summary(data)+'\n          吃最多的：\n          '+data.rows.slice(0,5).map(row => '· '+row.key+'  '+size(row.bytes)).join('\n          ');
        } catch { replacement = '無法讀取本機儲存用量'; }
        const text = original.replace(/^localStorage:[^\n]*(?:\n[ \u3000]+[^\n]*)*/m,'localStorage: '+replacement);
        if (text !== original) diagnosticBody.textContent = text;
    }
    const observer = new MutationObserver(syncDiagnostic);
    document.addEventListener('click',event => {
        if (!event.target.closest('#afk-stg-menu button')) return;
        storageDetails();
        const body = document.getElementById('m-diag-body');
        if (body && diagnosticBody !== body) { observer.disconnect(); diagnosticBody = body; observer.observe(body,{childList:true}); }
        syncDiagnostic();
    });
    document.addEventListener('click',event => {
        const button = event.target.closest('#m-diag-copy,#m-diag-save');
        if (button && diagnosticBody) {
            event.stopImmediatePropagation(); syncDiagnostic();
            if (button.id === 'm-diag-copy') copyText(diagnosticBody.textContent,button);
            else downloadSaveFile(diagnosticBody.textContent,'comfort-diagnostics.txt');
        }
    },true);
    document.addEventListener('DOMContentLoaded',() => {
        const menu = document.getElementById('main-menu');
        new MutationObserver(() => { if (!menu.classList.contains('hidden')) refresh(); }).observe(menu,{attributes:true,attributeFilter:['class']});
        refresh();
    });
    window.storageHealth = {collect,summary,refresh};
})();
