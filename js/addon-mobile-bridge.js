// Mobile mirrors initialize once; their UI, listeners and timers follow the live setting.
(function () {
    window.AFK_BANNER = {
        MODAL_HOSTS:'#autosell-rule-modal,#autosell-preview-modal,#poly-modal,#osiris-box-modal,#summon-select-overlay,#pet-evo-overlay,#pet-gear-overlay,#card-book,#equip-book,#misc-book,#relic-book,#collection-panel,#offline-reward-modal',
        MODAL_BOXES:'#autosell-rule-modal .as-box,#autosell-preview-modal > div,#poly-modal > div,#osiris-box-modal > div,#summon-select-overlay > div,#pet-evo-overlay > div,#pet-gear-overlay > div,#card-book > div,#equip-book > div,#misc-book > div,#relic-book > div,#collection-panel > div,#offline-reward-modal > div'
    };
    document.documentElement.style.setProperty('--orig-bar-h','0px');
    const nativeMatchMedia = window.matchMedia.bind(window);
    const listeners = [], intervals = new Map(), observers = [], tooltipTimers = new Set(), loadedScripts = new Set();
    const nativeListen = EventTarget.prototype.addEventListener, nativeRemove = EventTarget.prototype.removeEventListener;
    const nativeInterval = window.setInterval, nativeClearInterval = window.clearInterval;
    const nativeTimeout = window.setTimeout, nativeClearTimeout = window.clearTimeout;
    const styleIds = ['afk-mobile-bar-offset','afk-mobile-nav-style','afk-battlehud-style','afk-mapbar-style','afk-nozoom-style','afk-statusicon-style','afk-petui-style','afk-battlebuffs-style','afk-skillbar-style','afk-touchtip-style','m-toast-style'];
    const functions = ['openLoadSelect','showCreation','loadBackToMenu','backToMenu','startGame','loadGame','renderPetStorageNPC','renderStatusEffects','logSys'];
    let intervalId = -1, moduleContext = '', tooltipContext = false, refreshNav = null, loading = null, loaded = false, applied = false, logHome;
    const active = () => optionalAddons.selection().mobile;
    const owner = () => document.currentScript?.dataset.mobileRuntime || (tooltipContext ? 'touchtip' : '');
    function inModule(module, callback, self, args) {
        const previous = moduleContext; moduleContext = module;
        try { return callback.apply(self,args); } finally { moduleContext = previous; }
    }
    // Keep the unmodified mobile mirrors' device checks consistent with the explicit mode.
    window.matchMedia = function (query) {
        const module = owner() || moduleContext;
        if (active() && ((['mobile','touchtip'].includes(module) && query === '(pointer:coarse)') || (module === 'backnav' && query === '(max-width: 768px)'))) return nativeMatchMedia('all');
        return nativeMatchMedia(query);
    };

    EventTarget.prototype.addEventListener = function (type, callback, options) {
        const module = owner();
        if (!module || typeof callback !== 'function') return nativeListen.call(this,type,callback,options);
        const listener = {target:this,type,options,attached:false,callback:function (...args) {
            if (!active()) return;
            const previous = tooltipContext;
            if (module === 'touchtip') tooltipContext = true;
            try { return inModule(module,callback,this,args); } finally { tooltipContext = previous; }
        }};
        listeners.push(listener);
        if (active()) { nativeListen.call(this,type,listener.callback,options); listener.attached = true; }
    };
    window.setInterval = function (callback, delay, ...args) {
        const module = owner();
        if (!module) return nativeInterval(callback,delay,...args);
        const id = intervalId--, timer = {callback:() => inModule(module,callback,window,args),delay,native:null}; intervals.set(id,timer);
        if (module === 'mobile' && delay === 1500) refreshNav = timer.callback;
        if (active()) timer.native = nativeInterval(timer.callback,delay);
        return id;
    };
    window.clearInterval = function (id) {
        const timer = intervals.get(id);
        if (!timer) return nativeClearInterval(id);
        nativeClearInterval(timer.native); intervals.delete(id);
    };
    window.setTimeout = function (callback, delay, ...args) {
        const module = owner();
        if (!module) return nativeTimeout(callback,delay,...args);
        const run = () => { if (active()) inModule(module,callback,window,args); };
        if (module !== 'touchtip') return nativeTimeout(run,delay);
        const id = nativeTimeout(() => { tooltipTimers.delete(id); run(); },delay);
        tooltipTimers.add(id); return id;
    };
    window.clearTimeout = function (id) { tooltipTimers.delete(id); return nativeClearTimeout(id); };
    for (const name of ['MutationObserver','ResizeObserver']) {
        const Native = window[name];
        window[name] = function (callback) {
            const module = owner();
            if (!module) return new Native(callback);
            const observer = new Native((...args) => { if (active()) inModule(module,callback,observer,args); });
            const observe = observer.observe.bind(observer), disconnect = observer.disconnect.bind(observer), targets = new Map();
            observer.observe = (target, options) => { targets.set(target,options); if (active()) observe(target,options); };
            observer.disconnect = () => { targets.clear(); disconnect(); };
            observers.push({start() { for (const [target,options] of targets) observe(target,options); },stop:disconnect});
            return observer;
        };
        window[name].prototype = Native.prototype;
    }

    function apply() {
        const on = active(), changed = applied !== on;
        if (!on) document.getElementById('m-stat-close')?.click();
        applied = on;
        for (const id of ['m-status','m-stat-modal','m-battle-buffs','m-skillbar','m-toast-wrap','afk-tt-title','m-logout-modal','m-logout-overlay']) {
            const node = document.getElementById(id); if (node) node.hidden = !on;
        }
        document.body.classList.toggle('m-mobile',on);
        for (const id of styleIds) { const style = document.getElementById(id); if (style?.sheet) style.sheet.disabled = !on; }
        for (const listener of listeners) if (listener.attached !== on) {
            (on ? nativeListen : nativeRemove).call(listener.target,listener.type,listener.callback,listener.options); listener.attached = on;
        }
        for (const timer of intervals.values()) {
            if (on && timer.native === null) timer.native = nativeInterval(timer.callback,timer.delay);
            else if (!on && timer.native !== null) { nativeClearInterval(timer.native); timer.native = null; }
        }
        if (changed) for (const observer of observers) { if (on) observer.start(); else observer.stop(); }
        if (on) refreshNav?.();
        else {
            for (const timer of tooltipTimers) nativeClearTimeout(timer); tooltipTimers.clear();
            const row = document.getElementById('log-row');
            if (logHome && row.parentNode !== logHome.parent) logHome.parent.insertBefore(row,logHome.next?.parentNode === logHome.parent ? logHome.next : null);
            for (const id of ['m-nav','m-log-sheet']) document.getElementById(id)?.remove();
            document.getElementById('m-toast-wrap')?.replaceChildren();
            const title = document.getElementById('afk-tt-title'), tip = document.querySelector('.game-tooltip:not([id])');
            if (title) title.style.display = 'none';
            if (tip) tip.style.display = 'none';
            document.getElementById('m-logout-modal')?.classList.remove('open');
            document.body.classList.remove('mview-left','mview-center','mview-right','mlog-open','mlog-sys','m-stat-open','afk-hud-tab','afk-buffs-tab','afk-skillbar-tab');
            document.getElementById('load-art-stage')?.style.removeProperty('min-height');
            for (const key of ['--m-nav-h','--afk-hud-bar-h']) document.documentElement.style.setProperty(key,'0px');
            window.addonTouchTooltip = false;
        }
        if (changed) {
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('mobile-ui-change'));
        }
        if (window.gameLayout) gameLayout.apply();
    }
    async function load() {
        for (const source of document.querySelectorAll('script[data-mobile-addon]')) {
            const id = source.dataset.mobileAddon;
            if (loadedScripts.has(id)) continue;
            const before = Object.fromEntries(functions.map(name => [name,window[name]]));
            await new Promise((resolve,reject) => {
                const script = document.createElement('script'); script.src = source.src; script.dataset.mobileRuntime = id;
                script.onload = resolve; script.onerror = () => { script.remove(); reject(Error('行動裝置版載入失敗，請重試。')); };
                document.body.appendChild(script);
            });
            for (const name of functions) {
                const mobile = window[name], original = before[name];
                if (typeof mobile !== 'function' || mobile === original) continue;
                const gated = function (...args) { return active() ? inModule(id,mobile,this,args) : original.apply(this,args); };
                Object.assign(gated,mobile); window[name] = gated;
            }
            if (id === 'mobile') {
                const shell = window.__afkm;
                for (const name of ['isMobile','setView','openLog','setLog']) {
                    const callback = shell[name]; shell[name] = function (...args) { return active() ? inModule(id,callback,this,args) : false; };
                }
            }
            loadedScripts.add(id); apply();
        }
        loaded = true;
    }
    async function sync(keepSettings = false) {
        if (active() && !loaded) {
            if (!loading) loading = load().finally(() => { loading = null; });
            await loading;
        }
        apply();
        if (active() && keepSettings && !document.getElementById('tab-automation').classList.contains('hidden')) {
            window.__afkm.setView('right');
            window.dispatchEvent(new Event('resize'));
        }
    }
    window.mobileUi = {active,sync};
    document.addEventListener('click',event => {
        if (active() && event.target.closest('#m-nav [data-view]')) window.dispatchEvent(new Event('resize'));
    });
    nativeListen.call(window,'resize',() => { if (active() !== applied) sync().catch(error => console.warn(error.message)); });
    document.addEventListener('DOMContentLoaded',() => {
        const row = document.getElementById('log-row'); logHome = {parent:row.parentNode,next:row.nextSibling};
        sync().catch(error => console.warn(error.message));
    });

    const renderStatus = window.renderStatusEffects;
    const battleBuffMedia = matchMedia('(max-width: 768px), (max-height: 520px) and (pointer: coarse)');
    window.renderStatusEffects = function () {
        const result = renderStatus.apply(this,arguments), battle = document.getElementById('battle-view');
        if (!state.ff && active() && battle && !battle.classList.contains('hidden') &&
            (battleBuffMedia.matches || document.body.classList.contains('m-mobile')) && document.getElementById('tab-stats').classList.contains('hidden')) {
            syncEffectStatus(document.getElementById('dt-buffs'),player,'player');
        }
        return result;
    };
})();
