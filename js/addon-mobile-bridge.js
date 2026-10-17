// The fork has no top banner; the mobile shell still needs the shared modal list.
if (AFK_TOGGLES.enabled('mobile')) {
    window.AFK_BANNER = {
        MODAL_HOSTS:'#autosell-rule-modal,#autosell-preview-modal,#poly-modal,#osiris-box-modal,#summon-select-overlay,#pet-evo-overlay,#pet-gear-overlay,#card-book,#equip-book,#misc-book,#relic-book,#collection-panel,#offline-reward-modal',
        MODAL_BOXES:'#autosell-rule-modal .as-box,#autosell-preview-modal > div,#poly-modal > div,#osiris-box-modal > div,#summon-select-overlay > div,#pet-evo-overlay > div,#pet-gear-overlay > div,#card-book > div,#equip-book > div,#misc-book > div,#relic-book > div,#collection-panel > div,#offline-reward-modal > div'
    };
    document.documentElement.style.setProperty('--orig-bar-h','0px');
    const renderStatus = window.renderStatusEffects;
    const battleBuffMedia = matchMedia('(max-width: 768px), (max-height: 520px) and (pointer: coarse)');
    window.renderStatusEffects = function () {
        const result = renderStatus.apply(this,arguments);
        const battle = document.getElementById('battle-view');
        // The downstream mirror consumes this hidden source before copying its HTML.
        if (!state.ff && AFK_TOGGLES.enabled('battlebuffs') && battle && !battle.classList.contains('hidden') &&
            (battleBuffMedia.matches || document.body.classList.contains('m-mobile')) &&
            document.getElementById('tab-stats').classList.contains('hidden')) {
            syncEffectStatus(document.getElementById('dt-buffs'),player,'player');
        }
        return result;
    };
}
