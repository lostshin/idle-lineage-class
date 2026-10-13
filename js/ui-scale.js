// Device UI preference. Character progress remains in the existing save system.
const UI_SCALE_KEY = 'lineage_ui_scale';
let uiScalePercent = 100;
function getUiScale() { return uiScalePercent / 100; }
function screenToUiPx(value) { return (value / getUiScale()) + 'px'; }

(function () {
    const root = document.documentElement;
    function updateViewport() {
        const scale = getUiScale();
        root.style.setProperty('--ui-width', (innerWidth / scale) + 'px');
        root.style.setProperty('--ui-height', (innerHeight / scale) + 'px');
    }
    function applyScale() {
        const scale = getUiScale();
        root.style.zoom = scale === 1 ? '' : String(scale);
        root.style.setProperty('--ui-scale-inverse', String(1 / scale));
        updateViewport();
        root.classList.toggle('ui-scale-active', scale !== 1);
        document.getElementById('set-ui-scale').value = String(uiScalePercent);
        document.getElementById('ui-scale-value').textContent = uiScalePercent + '%';
        // Existing equipment fitting and town-label placement listen for resize.
        window.dispatchEvent(new Event('resize'));
    }
    window.setUiScale = function (value) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return false;
        uiScalePercent = Math.max(75, Math.min(100, Math.round(amount / 5) * 5));
        applyScale();
        const saved = _lsSet(UI_SCALE_KEY, String(uiScalePercent)) === true;
        document.getElementById('ui-scale-status').textContent = saved ? '' : '縮放已套用，但未儲存；請重試。';
        return saved;
    };
    const slider = document.getElementById('set-ui-scale');
    slider.addEventListener('input', () => setUiScale(slider.value));
    document.getElementById('btn-ui-scale-reset').addEventListener('click', () => setUiScale(100));
    window.addEventListener('resize', updateViewport);
    const stored = _lsGet(UI_SCALE_KEY);
    const amount = stored === null ? 100 : Number(stored);
    uiScalePercent = Number.isFinite(amount) ? Math.max(75, Math.min(100, Math.round(amount / 5) * 5)) : 100;
    applyScale();
})();
