// Device UI preference. Character progress remains in the existing save system.
const UI_SCALE_KEY = 'lineage_ui_scale';
const UI_SCALE_MIGRATION_KEY = 'lineage_ui_scale_80_v1';
let uiScalePercent = 80;
function getUiScale() { return uiScalePercent / 100; }
function screenToUiPx(value) { return (value / getUiScale()) + 'px'; }

(function () {
    const root = document.documentElement;
    // The file-store migration in 00-data copies missing keys from localStorage.
    function readInitialPreference(key) {
        try {
            const store = window.fableStore;
            if (store && (store.has(key) || store.has('__fs_migrated_v1'))) return store.get(key);
            return localStorage.getItem(key);
        } catch (e) { return null; }
    }
    let migrated = readInitialPreference(UI_SCALE_MIGRATION_KEY) === '1';
    function normalize(value) {
        const amount = value == null || String(value).trim() === '' ? NaN : Number(value);
        return Number.isFinite(amount) ? Math.max(60, Math.min(100, Math.round(amount / 5) * 5)) : 80;
    }
    function persistScale() {
        let saved = _lsSet(UI_SCALE_KEY, String(uiScalePercent)) === true;
        if (saved && !migrated) {
            migrated = _lsSet(UI_SCALE_MIGRATION_KEY, '1') === true;
            saved = migrated;
        }
        document.getElementById('ui-scale-status').textContent = saved ? '' : '縮放已套用，但未儲存；請重試。';
        return saved;
    }
    function updateViewport() {
        const scale = getUiScale();
        root.style.setProperty('--ui-width', (root.clientWidth / scale) + 'px');
        root.style.setProperty('--ui-height', (root.clientHeight / scale) + 'px');
    }
    function applyRootScale() {
        const scale = getUiScale();
        root.style.zoom = scale === 1 ? '' : String(scale);
        root.style.setProperty('--ui-scale-inverse', String(1 / scale));
        updateViewport();
        root.classList.toggle('ui-scale-active', scale !== 1);
    }
    function applyScale() {
        applyRootScale();
        // Keep stored layout units intact; the existing 80% size is now labeled 100%.
        const displayPercent = uiScalePercent / .8;
        document.getElementById('set-ui-scale').value = String(displayPercent);
        document.getElementById('ui-scale-value').textContent = displayPercent + '%';
        // Existing equipment fitting and town-label placement listen for resize.
        window.dispatchEvent(new Event('resize'));
    }
    window.setUiScale = function (value) {
        uiScalePercent = normalize(value);
        applyScale();
        return persistScale();
    };
    function initSettings() {
        migrated = _lsGet(UI_SCALE_MIGRATION_KEY) === '1';
        uiScalePercent = migrated ? normalize(_lsGet(UI_SCALE_KEY)) : 80;
        const slider = document.getElementById('set-ui-scale');
        slider.addEventListener('input', () => setUiScale(Number(slider.value) * .8));
        document.getElementById('btn-ui-scale-reset').addEventListener('click', () => setUiScale(80));
        applyScale();
        if (!migrated) persistScale();
    }
    window.addEventListener('resize', updateViewport);
    uiScalePercent = migrated ? normalize(readInitialPreference(UI_SCALE_KEY)) : 80;
    applyRootScale();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSettings);
    else initSettings();
})();
