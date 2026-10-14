// Fixed add-on set: the switch panel is removed, so every loaded add-on runs except those listed here.
(function () {
    const off = new Set(['sellconfirm']);
    const registry = [], byId = new Map(), overrides = new Map();
    window.AFK_TOGGLES = {
        register(spec) {
            if (!spec || !spec.id || byId.has(spec.id)) return;
            const entry = {...spec, def: !off.has(spec.id)};
            registry.push(entry);
            byId.set(spec.id, entry);
        },
        enabled(id) { return overrides.has(id) ? overrides.get(id) : !off.has(id); },
        // Page-local only: no saved switch preferences exist any more.
        set(id, on) { overrides.set(id, !!on); },
        list() { return registry.slice(); }
    };
})();
