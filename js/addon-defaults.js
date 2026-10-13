// Keep the mirrored add-on files unchanged; apply the user's default selections here.
(function () {
    const disabled = new Set(['mobile', 'invlist', 'eqlist', 'npclist', 'mapbar',
        'battlehud', 'nozoom', 'statusicon', 'battlebuffs', 'skillbar', 'petui',
        'backnav', 'statlist', 'sellconfirm', 'touchtip', 'loadslots', 'ancdrop',
        'relicaffix', 'retrial']);
    for (const entry of AFK_TOGGLES.list()) if (disabled.has(entry.id)) entry.def = false;
    const register = AFK_TOGGLES.register;
    AFK_TOGGLES.register = function (spec) {
        return register.call(this, disabled.has(spec.id) ? {...spec, def:false} : spec);
    };
})();
