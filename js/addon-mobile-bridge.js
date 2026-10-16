// The fork has no top banner; the mobile shell still needs the shared modal list.
if (AFK_TOGGLES.enabled('mobile')) {
    window.AFK_BANNER = {
        MODAL_HOSTS:'#autosell-rule-modal,#autosell-preview-modal,#poly-modal,#osiris-box-modal,#summon-select-overlay,#pet-evo-overlay,#pet-gear-overlay,#card-book,#equip-book,#misc-book,#relic-book,#collection-panel,#offline-reward-modal',
        MODAL_BOXES:'#autosell-rule-modal .as-box,#autosell-preview-modal > div,#poly-modal > div,#osiris-box-modal > div,#summon-select-overlay > div,#pet-evo-overlay > div,#pet-gear-overlay > div,#card-book > div,#equip-book > div,#misc-book > div,#relic-book > div,#collection-panel > div,#offline-reward-modal > div'
    };
    document.documentElement.style.setProperty('--orig-bar-h','0px');
}
