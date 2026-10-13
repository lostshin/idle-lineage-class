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
    for (let slot = 1; slot <= 8; slot++) {
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
