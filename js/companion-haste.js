// Only normal Haste is shared; all other companion combat rules stay in their native paths.
function companionHasteMembers(includeDowned=false) {
    return [...new Set([...petsOutList(), ...summonV2List(), ...necroSkeletonList(), ...(player.allies||[]).map(a=>a?.summon), player.summon, player.charmed].filter(a=>a && (includeDowned || (!a._downed && (a.hp == null || a.hp > 0)))))];
}
function companionHasteMult(actor) { return actor?.buffs?.sk_haste_spell > 0 ? 4/3 : 1; }
function shareCompanionHaste(caster) {
    const enabled=caster===player ? document.getElementById('auto-sk-sk_haste_spell')?.checked : _mercAutoOn(caster,'sk_haste_spell');
    if (!caster.skills?.includes('sk_haste_spell') || (!(caster.buffs?.sk_haste_spell > 0) && !enabled)) return;
    const sk=DB.skills.sk_haste_spell, cost=caster.d?.getMpCost ? caster.d.getMpCost(sk.mp,sk.tier) : sk.mp;
    for (const actor of companionHasteMembers()) {
        if (actor.buffs?.sk_haste_spell > 0) continue;
        if (caster.mp < cost) break;
        caster.mp-=cost;
        if(caster!==player)allyManaMasteryRefund(caster,cost);
        actor.buffs ||= {}; actor.buffs.sk_haste_spell=sk.dur;
    }
}
function companionHasteTick() {
    for (const actor of companionHasteMembers(true)) if(actor.buffs?.sk_haste_spell>0) actor.buffs.sk_haste_spell=Math.max(0,actor.buffs.sk_haste_spell-.1);
}
