// Keep existing role preferences when replacing the previously adapted tools.
const ADDON_ROLE_PREFS = ['afk_trad_', 'afk_autobuy_magicbarrier_', 'afk_bossavoid_', 'afk_bossring_on_'];
function addonRolePreferences(p) {
    const c = p.config || {}, prefs = {...p.accountAddonPrefs};
    if (typeof c.randomEnhance === 'boolean' && prefs.afk_trad_ == null) prefs.afk_trad_ = c.randomEnhance ? '1' : '0';
    if (typeof c.barrierStock === 'boolean' && prefs.afk_autobuy_magicbarrier_ == null) prefs.afk_autobuy_magicbarrier_ = c.barrierStock ? '1' : '0';
    if (c.bossAvoid && prefs.afk_bossavoid_ == null) prefs.afk_bossavoid_ = JSON.stringify(c.bossAvoid);
    if (c.bossMode && prefs.afk_bossring_on_ == null) prefs.afk_bossring_on_ = c.bossMode === 'hunt' ? '1' : '0';
    return prefs;
}
function migrateAddonPreferences() {
    for (let slot = 1; slot <= SAVE_SLOT_MAX; slot++) {
        const raw = _lzGet('lineage_idle_save_' + slot);
        if (!raw) continue;
        const save = _saveUnwrap(raw);
        if (!save.ok) continue;
        let p;
        try { p = JSON.parse(save.payload).p; } catch (e) { continue; }
        if (!p?.cls) continue;
        for (const [prefix, value] of Object.entries(addonRolePreferences(p))) {
            if (!ADDON_ROLE_PREFS.includes(prefix)) continue;
            try { if (localStorage.getItem(prefix + slot) == null) localStorage.setItem(prefix + slot, value); } catch (e) {}
        }
    }
}
migrateAddonPreferences();

// Preserve the local grouping feature when the original add-on handles select-all.
document.addEventListener('DOMContentLoaded', () => {
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = 'comfort.webmanifest';
    const selectAll = window.quickJunkSelectAll;
    window.quickJunkSelectAll = function (type, checked) {
        quickJunk[type].groups = {};
        return selectAll.apply(this, arguments);
    };
    const load = window.loadGame;
    window.loadGame = function () {
        migrateAddonPreferences();
        const result = load.apply(this, arguments);
        for (const [prefix, id] of [['afk_autobuy_magicbarrier_', 'set-auto-buy-magicbarrier'], ['afk_bossring_on_', 'set-teleport-boss']]) {
            const value = localStorage.getItem(prefix + currentSlot), input = document.getElementById(id);
            if (value != null && input) { input.checked = value === '1'; input.dispatchEvent(new Event('change')); }
        }
        const traditional = localStorage.getItem('afk_trad_' + currentSlot);
        if (traditional != null && window.AFK_TRAD) AFK_TRAD.setOn(currentSlot, traditional === '1');
        const avoid = localStorage.getItem('afk_bossavoid_' + currentSlot);
        if (avoid && window.AFK_BOSSAVOID) {
            try { for (const [map, ids] of Object.entries(JSON.parse(avoid))) if (Array.isArray(ids)) AFK_BOSSAVOID.set(map, ids); } catch (e) {}
        }
        return result;
    };
});

// The start menu stays minimal: lookup, encyclopedia and other tools live in the settings tab.
document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).has('view')) return;
    const notice = document.getElementById('copyright-notice');
    const parts = [document.querySelector('#main-menu .m-dex-entry-row'), document.querySelector('#main-menu .m-wiki-entry-row'), document.getElementById('afk-stg-wrap')].filter(Boolean);
    if (!notice || !parts.length) return;
    const card = document.createElement('div');
    card.id = 'settings-tools';
    card.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700 mt-3 flex flex-col gap-2';
    card.innerHTML = '<div class="text-sm text-slate-400 border-b border-slate-700 pb-1">📚 查詢與其他功能</div>';
    for (const part of parts) card.appendChild(part);
    notice.before(card);
    for (const id of ['m-afk-nav-dex', 'm-afk-nav-wiki']) document.getElementById(id)?.remove();
});

// Let the mirrored add-on supply tracking/boss controls while the shared model owns buffs and sets.
document.addEventListener('DOMContentLoaded', () => {
    const render=window.renderStatusEffects;
    window.renderStatusEffects=function () {
        if(state.ff)return render.apply(this,arguments);
        const host=document.getElementById('dt-buffs');
        if(!host)return render.apply(this,arguments);
        const previous=[...host.querySelectorAll('.afk-statusadd')];
        const list=host.querySelector('[data-effect-list]');
        if(list)while(list.nextSibling)list.nextSibling.remove();
        const result=render.apply(this,arguments),extras=[...host.querySelectorAll('.afk-statusadd')];
        const names=[...Object.keys(EFFECT_SET_THRESHOLDS).map(effectSetName),...effectDetailsSnapshot(player,'player').entries.map(e=>e.name)].map(name=>name.replace(/\s/g,''));
        for(const node of extras){
            const text=node.textContent.trim();
            if(text==='血盟Buff'||names.includes(text.replace(/\s/g,''))){const sep=node.previousSibling;if(sep?.nodeType===3&&sep.textContent.trim()==='/')sep.remove();node.remove();continue;}
            const id=node.classList.contains('afk-trackinfo')?'tracking':text.startsWith('迴避王')?'boss-avoid':text.startsWith('找王')?'boss-hunt':text;
            node.dataset.addonEffect=id;
            const old=previous.find(e=>e.dataset.addonEffect===id);
            if(old){for(const a of node.attributes)old.setAttribute(a.name,a.value);old.textContent=node.textContent;node.replaceWith(old);}
        }
        return result;
    };
});
