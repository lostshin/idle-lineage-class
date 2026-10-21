(async () => {
const fs = await import('node:fs/promises');
const task = await taskSpace(options.space || '離線取樣與介面修正');
console.log({spaceId: task.spaceId});
const page = task.page(options.page || 'p1'), reports = [], sources = {};
const crypto=await import('node:crypto');for(const name of ['css/social-lobby.css','js/27-offline-rewards.js','js/06-status-allies.js','js/10-ui-tabs.js','js/effect-details.js','tests/feedback-reliability.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile((options.sourceRoot&&!name.startsWith('tests/')?options.sourceRoot:options.root)+'/'+name)).digest('hex');
const namespace = 'codex_offline_fixture_' + Date.now() + '_' + options.protocol;
// Only this unique synthetic bucket touches native storage; game keys are virtualized.
const fixtureSource = `(() => {
    if (!location.href.startsWith(${JSON.stringify(options.url)})) return;
    const native = window.localStorage, key = ${JSON.stringify(namespace)};
    const record = JSON.parse(native.getItem(key) || '{"data":{}}');
    if (!record.data.lineage_optional_addons_v1) record.data.lineage_optional_addons_v1 = JSON.stringify({v:1,enabled:{history:true,slotinfo:true}});
    const clock = {now: record.nextNow || Date.now(), next: record.nextNow || Date.now()};
    const errors = [];
    let active = true;
    const persist = () => active && native.setItem(key, JSON.stringify({data: record.data, nextNow: clock.next}));
    window.__offlineTest = {data: record.data, clock, errors, fail: '', persist,
        advance(ms) {clock.now += ms; clock.next = clock.now; persist();},
        reopenAfter(ms) {clock.next = clock.now + ms; persist();},
        cleanup() {active = false; native.removeItem(key);}
    };
    Date.now = () => clock.now;
    const api = {getItem: k => record.data[k] ?? null, setItem(k, v) {
        if (__offlineTest.fail && k.includes(__offlineTest.fail)) throw Error('synthetic storage failure');
        record.data[k] = String(v); persist();
    }, removeItem(k) {delete record.data[k]; persist();}, key: i => Object.keys(record.data)[i] ?? null,
        get length() {return Object.keys(record.data).length;}};
    const storage = new Proxy(api, {ownKeys: () => Object.keys(record.data),
        getOwnPropertyDescriptor: (t, k) => k in record.data ? {configurable: true, enumerable: true, value: record.data[k]} : Object.getOwnPropertyDescriptor(t, k)});
    Object.defineProperty(window, 'localStorage', {value: storage});
    Object.defineProperty(window, 'sessionStorage', {value: storage});
    addEventListener('error', e => errors.push(e.message));
})();`;
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source:fixtureSource})).identifier;
async function check(name, fn) {
    try {const r = await fn(); if (r !== true) throw Error(JSON.stringify(r)); reports.push({name, status:'PASS'});}
    catch (e) {reports.push({name, status:'FAIL', error:String(e)}); console.log({name, error:String(e)});}
    await fs.writeFile(options.artifacts + '/feedback-reliability-' + (options.baseline ? 'baseline' : options.protocol) + '.json', JSON.stringify({method:'Ego browser, actual tab closure plus native kill/save/load and document reopen, isolated persistent synthetic bucket and controlled wall clock', sources,reports}, null, 2));
}
async function open(target = page) {
    await target.goto(options.url + '?offline-rewards-test');
    await target.waitForFunction(() => document.readyState === 'complete' && typeof startGame === 'function' && typeof SUMMON_TIERS !== 'undefined' && typeof guardDerive === 'function');
    await target.cdp('Page.bringToFront');
    await target.waitForFunction(() => !document.hidden);
    await target.evaluate(() => {_bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker = null; _getLzWorker = () => null;
        const record=recordAddonOfflineHistory;
        window.recordAddonOfflineHistory=result=>{__offlineTest.result=structuredClone(result);return record(result);};
        if(__offlineTest.data.__zeroDeath)window.idleLineageNativeOffline={planSurvival:()=>({elapsedMs:0,combatMs:0,deathAtMs:0,potionUsed:0,died:true})};
    });
}
async function reopen(ms, slot = 1) {
    await page.evaluate(ms => __offlineTest.reopenAfter(ms), ms);
    await page.goto('about:blank'); // Native unload handlers must persist the last snapshot.
    await open();
    await page.evaluate(slot => {currentSlot = slot; loadGame(); stopGameTimers();}, slot);
    await page.waitForFunction(() => !document.getElementById('game-screen').classList.contains('hidden'));
    // A task turn after the native load settlement callback, without arbitrary sleep.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
}
async function sample(slot = 1, target = page) {
    return target.evaluate(slot => {
        document.getElementById('offline-reward-modal')?.remove();
        if (player.cls && !document.getElementById('game-screen').classList.contains('hidden')) returnToCharacterSelect();
        currentSlot = slot; selectClass('m_mage'); document.getElementById('creation-name').value='合成測試角色';startGame(); stopGameTimers();
        player.name = '合成離線角色' + slot; player.lv = 60; player.gold = 100000;
        player.config.offlineSentinel = 'preserve-unknown'; player.autoSellOn = false;
        setMapSelectors('training'); changeMap(true); calcStats(); player.hp = player.mhp; player.mp = player.mmp;
        for (let i = 0; i < 3; i++) {
            if (i) __offlineTest.advance(8000);
            const mob = {...DB.mobs.orc, uid: uid(), curHp: 0, st: newMobStatus()};
            mapState.mobs[0] = mob;
            const random = Math.random;
            Math.random = () => .5; // Keep native gold drops deterministic in the synthetic sample.
            try {killMob(0);} finally {Math.random = random;}
        }
        saveGame(); _resetGameLoopClock();
        return {gold: player.gold, exp: player.exp, lv: player.lv, profile: player.offlineHunt?.profile, roleId: accountRoleId(player)};
    }, slot);
}
await page.cdp('Network.setCacheDisabled', {cacheDisabled:true});
await page.cdp('Emulation.setDeviceMetricsOverride', {width:1330, height:900, deviceScaleFactor:1, mobile:false});
await open();
let base=await sample(1);
await check('v3.9.18 sampling replaces the previous window after a fresh runtime qualifies',()=>page.evaluate(()=>{
    offlineResetRateSample();
    for(let i=0;i<3;i++) {if(i)__offlineTest.advance(8000);const m={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};mapState.mobs[0]=m;killMob(0);}
    saveGame();const next=player.offlineHunt.profile;
    return next.sampleMs===16000 && next.sampleKills===3 || {first,next};
}));
await check('saving the same sample twice does not increase its weight',()=>page.evaluate(()=>{const first=JSON.stringify(player.offlineHunt.profile);saveGame();return JSON.stringify(player.offlineHunt.profile)===first;}));
await check('v3.9.18 sampling measures the current runtime without five-minute weighted merging',()=>page.evaluate(()=>{
    offlineResetRateSample();
    for(let i=0;i<35;i++){if(i)__offlineTest.advance(10000);mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}
    saveGame();const p=player.offlineHunt.profile;
    if(p.sampleMs!==340000||p.sampleKills!==35)return p;
    __offlineTest.advance(10000);mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);saveGame();
    const next=player.offlineHunt.profile;
    return next.sampleMs===350000&&next.sampleKills===36&&Math.abs(next.killsPerMin-36*60000/350000)<.001||next;
}));
await check('HP MP gold loot counts and item UID do not invalidate combat history',()=>page.evaluate(()=>{
    const before=player.offlineHunt.profile.condition;
    player.hp--;player.mp--;player.gold+=123;player.inv.push({id:'mat_log',cnt:999,uid:'loot-only',en:0,bless:false,anc:false,attr:false,seteff:false});
    for(const item of Object.values(player.eq))if(item)item.uid='same-gear-new-uid';saveGame();
    return player.offlineHunt.eligible&&player.offlineHunt.profile?.condition===before;
}));
await check('v3.9.18 automation changes keep the existing map sample',()=>page.evaluate(()=>{document.getElementById('set-haste').checked=!document.getElementById('set-haste').checked;saveGame();return player.offlineHunt.eligible;}));
base=await sample(3);
await reopen(0,3);
await page.evaluate(()=>{setMapSelectors('training');changeMap(true);state.running=true;offlineResetRateSample();for(let i=0;i<3;i++){if(i)__offlineTest.advance(8000);mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}saveGame();});
await check('native reload can build a fresh v3.9.18 window',()=>page.evaluate(()=>player.offlineHunt.profile?.sampleMs===16000||{sampleMs:player.offlineHunt.profile?.sampleMs}));
await check('fast-forward kills do not enter the real-time kill count',()=>page.evaluate(()=>{
    const before=player.offlineHunt.profile.sampleKills;state.ff=true;
    __offlineTest.advance(20000);mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);saveGame();state.ff=false;
    return player.offlineHunt.profile.sampleKills===before;
}));
await check('v3.9.18 active team changes do not discard the map sample',()=>page.evaluate(()=>{player.allies=[{cls:'mage',lv:30,skills:[],eq:{},config:{},_slot:'2',enSeed:'new-team',mhp:500,curHp:500}];saveGame();return player.offlineHunt.eligible;}));
await page.evaluate(()=>{player.allies=[];});
for(const explicit of [null,false,true])await check('legacy Harmony migration respects explicit buff '+explicit,()=>page.evaluate(explicit=>{
    const a={cls:'illusion',skills:['sk_illu_cube_harmony'],_convertSkill:'sk_illu_cube_harmony',_autoBuff:explicit===null?{}:{sk_illu_cube_harmony:explicit},config:{autoBuffSkills:{}},curHp:1000,mhp:1000,mmp:100,mp:0,d:{magicDmg:0},enSeed:'harmony-'+explicit};
    const was=JSON.stringify(player.deathLog);state.running=true;mapState.mobs=[];allyCubeTick(a);
    const expected=explicit!==false;
    snapshotMercPrefs(a);const restored={enSeed:a.enSeed,config:{}};applyMercPrefs(restored);
    return a._convertSkill===''&&_mercAutoOn(a,'sk_illu_cube_harmony')===expected&&a.curHp===(expected?975:1000)&&restored._autoBuff?.sk_illu_cube_harmony===expected&&JSON.stringify(player.deathLog)===was;
},explicit));
await check('Harmony retains configured HP safety and town restrictions',()=>page.evaluate(()=>{
    const a={cls:'illusion',skills:['sk_illu_cube_harmony'],_autoBuff:{sk_illu_cube_harmony:true},config:{},curHp:600,mhp:1000,mmp:100,d:{},_hpSkillPct:60};
    allyCubeTick(a);if(a.curHp!==600)return false;a._hpSkillPct=0;a.curHp=250;allyCubeTick(a);if(a.curHp!==250)return false;
    const map=mapState.current;mapState.current=getHomeTown();a.curHp=1000;allyCubeTick(a);mapState.current=map;return a.curHp===1000;
}));
await check('legacy explicit source false also wins and unselected Harmony stays off',()=>page.evaluate(()=>{
    const a={_convertSkill:'sk_illu_cube_harmony',config:{autoBuffSkills:{sk_illu_cube_harmony:false}}},b={_convertSkill:'',config:{autoBuffSkills:{}}};
    return !_mercAutoOn(a,'sk_illu_cube_harmony')&&!_mercAutoOn(b,'sk_illu_cube_harmony');
}));
for(const kind of ['summon','merc-summon','guard','skeleton','spirit'])await check(kind+' compact stats use native fields and inspection does not mutate combat',()=>page.evaluate(kind=>{
    const form=SUMMON_TIERS.find(t=>t.mobs.some(m=>m.proc))?.mobs.find(m=>m.proc)?.n||SUMMON_TIERS[0].mobs[0].n;
    const a={uid:'ability-'+kind,form,n:form,lv:30,mhp:500,hp:500,buffs:{haste:30},statuses:{}};
    if(kind==='guard')a.form=CASTLE_GUARD_BOOK.kent.form;
    if(kind==='merc-summon')a.interval=_sumDeriveAny(a,player).aspd;
    if(kind==='skeleton')Object.assign(a,{_necroSkeleton:true,lv:NECRO_SKELETON_TIERS[0].lv});
    if(kind==='spirit')Object.assign(a,{skId:'sk_elf_summon2',ele:'fire',_king:true});
    const before=JSON.stringify([player,a]),snap=partyBonusSnapshot(a,kind==='skeleton'||kind==='spirit'?'summon':kind,player),node=document.createElement('div');node.innerHTML=partyBonusHtml(snap,a);
    const interval=node.querySelector('[data-ability-field="spd"] [data-ability-total]')?.textContent;
    return JSON.stringify([player,a])===before&&interval===(Math.round(snap.total.aspd/10*100)/100)+'s'&&!node.querySelector('[data-ability-field="str"]')&&node.textContent.includes('防禦 AC')&&(!('mr' in snap.total)?!node.querySelector('[data-ability-field="mr"]'):true)&&node.textContent.includes(kind==='spirit'?'屬性攻擊骰值':'普攻骰值');
},kind));
await check('legacy ally summon displays its actual native attack dice and interval',()=>page.evaluate(()=>{
    const owner=effectActorCopy(player);owner.lv=20;owner.d.cha=0;owner.mastery=null;
    const actor=buildSummon('sk_summon',DB.skills.sk_summon.summon,3600,owner),node=document.createElement('div');
    const snap=partyBonusSnapshot(actor,'merc-summon',owner);node.innerHTML=partyBonusHtml(snap,actor);
    return !actor._v2form&&node.textContent.includes(actor.dmgDice[0]+'D'+actor.dmgDice[1])&&snap.total.aspd===actor.interval/companionHasteMult(actor);
}));
await check('minion ability inspector updates live haste and keeps its equipment tab read-only',()=>page.evaluate(()=>{
    const form=SUMMON_TIERS[0].mobs[0].n;player.summonsV2=[{uid:'inspected-summon',form,lv:20,mhp:300,hp:300,buffs:{},statuses:{}}];renderSquadPanel();openPartyInspector('summon','inspected-summon');
    const first=document.querySelector('#party-inspector [data-ability-field="spd"] [data-ability-total]')?.textContent;
    player.summonsV2[0].buffs.sk_haste_spell=30;refreshPartyInspector();
    const second=document.querySelector('#party-inspector [data-ability-field="spd"] [data-ability-total]')?.textContent;
    document.getElementById('party-tab-equipment').click();const equipment=document.getElementById('party-details').textContent;
    document.getElementById('party-inspector-close').click();return first!==second&&!document.querySelector('#party-inspector [data-ability-field="str"]')&&!/onclick="(?:equip|sell)/.test(document.getElementById('party-details').innerHTML)&&equipment.length>0||{first,second,equipment};
}));

await check('v3.9.18 equipment changes leave the established sample available',()=>page.evaluate(()=>{player.eq.wpn={id:'wpn_katana',en:7,cnt:1,uid:'new-gear',bless:false,anc:false,attr:false,seteff:false};calcStats();saveGame();return player.offlineHunt.eligible===true;}));
await check('Harmony appears with ally buff checkboxes and is absent from convert options',()=>page.evaluate(()=>{const a={skills:['sk_illu_cube_harmony'],cls:'illusion',_slot:'2',config:{autoBuffSkills:{}}};return allyAutoCastableSkills(a).some(s=>s.sid==='sk_illu_cube_harmony')&&!_allySkillOptions(a,'convert','').includes('sk_illu_cube_harmony');}));
await check('summon ability view has real compact combat fields without player attributes',()=>page.evaluate(()=>{
    const form=SUMMON_TIERS[0].mobs[0].n,actor={form,n:form,lv:30,mhp:500,hp:500,buffs:{},statuses:{}};
    const snap=partyBonusSnapshot(actor,'summon',player),el=document.createElement('div');el.innerHTML=partyBonusHtml(snap,actor);
    return !!el.querySelector('.pet-ability-stats')&&!el.querySelector('[data-ability-field="str"]')&&el.textContent.includes('普攻骰值')&&el.textContent.includes('攻擊間隔');
}));
base=await sample(2);
await page.evaluate(()=>{
    const profile=player.offlineHunt.profile;
    profile.survival={sampleMs:60000,damagePerMin:player.mhp*4,healingPerMin:0,potionHealPerMin:0,potionPerMin:0,deathRatePerHour:0,minHpPct:1};
    player.offlineHunt.profiles=[profile];saveGame();
});
await reopen(600000,2);
await check('offline death explains buyback exclusion and shows whole-interval plus pre-death rates',()=>page.evaluate(()=>{
    const text=document.getElementById('sys-log').textContent;
    return player.dead&&text.includes('不列入死亡經驗買回')&&text.includes('整段離線平均')&&text.includes('死亡前狩獵效率')&&text.includes('實際狩獵');
}));
await check('both efficiency labels divide the same actual rewards by the stated durations',()=>page.evaluate(()=>{
    const r=__offlineTest.result,text=document.getElementById('sys-log').textContent;
    return r&&r.requestedElapsedMs===600000&&r.elapsedMs>0&&r.elapsedMs<600000&&
        text.includes('每 10 分鐘效益（整段離線平均）：經驗 '+Math.round(r.exp*600000/r.requestedElapsedMs).toLocaleString()+'、金幣 '+Math.round(r.gold*600000/r.requestedElapsedMs).toLocaleString())&&
        text.includes('死亡前狩獵效率（每 10 分鐘）：經驗 '+Math.round(r.exp*600000/r.elapsedMs).toLocaleString()+'、金幣 '+Math.round(r.gold*600000/r.elapsedMs).toLocaleString());
}));
base=await sample(4);
await check('batch catchup deaths add no experience-buyback entry and explain the exclusion',()=>page.evaluate(()=>{
    const before=JSON.stringify(player.deathLog),p=player.offlineHunt.profile;
    p.survival={sampleMs:60000,damagePerMin:player.mhp*4,healingPerMin:0,potionHealPerMin:0,potionPerMin:0,deathRatePerHour:0,minHpPct:1};player.offlineHunt.profiles=[p];saveGame();
    document.getElementById('sys-log').replaceChildren();offlineSettleCatchup(600000,'test');
    return player.dead&&JSON.stringify(player.deathLog)===before&&document.getElementById('sys-log').textContent.includes('不列入死亡經驗買回');
}));
base=await sample(5);
await page.evaluate(()=>{
    returnToCharacterSelect();const doc=accountRoleDoc(5),s=doc.p.offlineHunt;
    delete s.profile.condition;for(const p of s.profiles)delete p.condition;
    _lzSet('lineage_idle_save_5',_saveWrap(JSON.stringify(doc)));
    for(const [key,value]of Object.entries(__offlineTest.data))if(key.includes('checkpoint_')){
        const cp=JSON.parse(value);if(cp.snapshot?.awaySince===s.awaySince&&cp.snapshot?.profile?.updatedAt===s.profile.updatedAt){cp.snapshot=s;localStorage.setItem(key,JSON.stringify(cp));}
    }
    __offlineTest.reopenAfter(120000);
});
await page.goto('about:blank');await open();await page.evaluate(()=>{currentSlot=5;loadGame();stopGameTimers();});await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));
await check('legacy unsigned pending snapshots still settle with v3.9.18 sampling',()=>page.evaluate(base=>{
    const settled=player.gold===base.gold+Math.floor(base.profile.goldPerMin*2*.7+1e-7);
    setMapSelectors('training');changeMap(true);saveGame();
    return settled&&document.getElementById('sys-log').textContent.includes('離線掛機完成');
},base));
base=await sample(6);
await page.evaluate(()=>{
    const p=player.offlineHunt.profile;p.survival={sampleMs:60000,damagePerMin:1,healingPerMin:0,potionHealPerMin:0,potionPerMin:0,deathRatePerHour:0,minHpPct:1};
    player.offlineHunt.profiles=[p];saveGame();__offlineTest.data.__zeroDeath='1';__offlineTest.persist();
});
await reopen(600000,6);
await check('zero-survival native bridge results never divide by zero or invent hunting time',()=>page.evaluate(()=>{
    const r=__offlineTest.result,text=document.getElementById('sys-log').textContent;delete __offlineTest.data.__zeroDeath;
    return r?.died&&r.elapsedMs===0&&!/NaN|Infinity/.test(text)&&!text.includes('死亡前狩獵效率')&&r.exp===0&&r.gold===0;
}));

await page.evaluate(()=>{player.dead=false;player.hp=player.mhp;setMapSelectors('training');changeMap(true);player.eq.wpn={id:'wpn_katana',en:0,cnt:1,uid:'modal-gear',bless:false,anc:false,attr:false,seteff:false};socialLobby.open();openModal(player.eq.wpn,true,'wpn');});
for(const width of [1330,1920])for(const scale of [60,75,80,100]){
    await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await page.evaluate(scale=>{setUiScale(scale);},scale);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await check('lobby layers stay behind item windows '+width+'px '+scale+'%',()=>page.evaluate(()=>{
        const modal=document.getElementById('item-modal'),bounds=modal.getBoundingClientRect();let tested=0;
        for(const id of ['lobby-campfire','lobby-activity-frame','lobby-camp-controls']){
            const node=document.getElementById(id)||document.querySelector('.'+id);if(!node)continue;
            const r=node.getBoundingClientRect(),y=(Math.max(r.top,bounds.top)+Math.min(r.bottom,bounds.bottom))/2;
            const left=Math.max(r.left,bounds.left),right=Math.min(r.right,bounds.right);if(right<=left||y<bounds.top||y>bounds.bottom)continue;
            const hit=document.elementFromPoint((left+right)/2,y);tested++;if(!modal.contains(hit))return {id,hit:hit?.outerHTML.slice(0,150)};
        }
        // Paint order, including non-interactive flames, is constrained by the lobby root.
        const style=getComputedStyle(document.getElementById('social-lobby'));
        return (style.isolation==='isolate'||style.zIndex!=='auto')&&tested>0 || {tested,isolation:style.isolation};
    }));
}
await page.evaluate(()=>{closeModal();socialLobby.close();__offlineTest.cleanup();});
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log(JSON.stringify({passed:reports.filter(r=>r.status==='PASS').length,total:reports.length}));
if(!options.keepSpace)await task.finish({keep:[]});
if(reports.some(r=>r.status==='FAIL'))process.exitCode=1;
})();
