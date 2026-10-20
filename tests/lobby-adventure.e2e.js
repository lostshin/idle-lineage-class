(async () => {
const fs = await import('node:fs/promises');
const task = await taskSpace(options.space || '冒險者大廳姿勢與經驗');
console.log({spaceId: task.spaceId});
const page = task.page(options.page || 'p1'), reports = [], sources = {};
const crypto=await import('node:crypto');for(const name of ['index.html','js/social-lobby.js','js/05-kill-progression.js','js/11-world-map.js','js/27-offline-rewards.js','css/social-lobby.css','tests/lobby-adventure.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
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
    await fs.writeFile(options.artifacts + '/lobby-adventure-' + (options.baseline ? 'baseline' : options.protocol) + '.json', JSON.stringify({method:'Ego browser, native kill/save/load and document unload/reopen, isolated persistent synthetic bucket and controlled wall clock', sources, reports}, null, 2));
}
async function open(target = page) {
    await target.goto(options.url + '?offline-rewards-test');
    await target.waitForFunction(() => document.readyState === 'complete' && typeof startGame === 'function');
    await target.cdp('Page.bringToFront');
    await target.waitForFunction(() => !document.hidden);
    await target.evaluate(() => {_bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker = null; _getLzWorker = () => null;});
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
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await open();await sample();
await page.evaluate(()=>{state.running=false;window.__adventureErrors=__offlineTest.errors;});
await check('dedicated full-name button replaces the map-category entry',()=>page.evaluate(()=>{const b=document.getElementById('btn-social-lobby');return !!b&&b.textContent==='冒險者大廳'&&b.previousElementSibling?.id==='btn-pandora-shortcut'&&!document.querySelector('#map-category option[value="social_lobby"]');}));
async function enter(){if(options.baseline)await page.evaluate(()=>socialLobby.open());else await page.click('#btn-social-lobby');}
await enter();
await check('entry leaves both selectors on the hunting map and displays the room title and local bonus',()=>page.evaluate(()=>document.getElementById('map-select').value===mapState.current&&document.getElementById('map-category').value===mapRegionOf(mapState.current)&&document.getElementById('lobby-room-title')?.textContent==='肝膽相照'&&document.getElementById('lobby-hunt-status')?.textContent.includes('5%')));
await check('default standing character uses original sprite instead of generated standing art',()=>page.evaluate(()=>document.querySelector('[data-self] .lobby-camper-sprite img')?.src.includes('/assets/classanim/')));
await page.evaluate(()=>{
 const d=JSON.parse(saveStateJson());d.p.name='合成加成隊友';d.p.enSeed='lobby-ally';d.p._roleEpoch='lobby-ally';d.p.allies=[];_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(d)));player.allies=[buildAlly('2')];
 petRoster().push({cnt:1,form:'杜賓狗',uid:'lobby-exp-pet',lv:40,hp:150,mhp:150,mp:0,mmp:0,exp:0,eq:{},outOwner:_petCurrentOwnerKey(),outSlot:1});petMarkDirty();petRosterSave();
 window.__probeExp=()=>{const pet=petsOutList()[0],ally=player.allies[0];player.exp=0;ally.exp=0;pet.exp=0;const mob={...DB.mobs.orc,exp:10000,noGold:true,uid:uid(),curHp:0,st:newMobStatus()};mapState.mobs[0]=mob;const rng=Math.random;Math.random=()=>.5;try{killMob(0);}finally{Math.random=rng;}return [player.exp,ally.exp,pet.exp];};
});
await check('main, ally and pet each receive exactly the party-adjusted 5% gain',()=>page.evaluate(()=>{const expected=Math.floor(10000*(1+partyExpBonusPct()/100)*1.05);return __probeExp().every(n=>n===expected);}));
await check('doll and lobby multipliers agree with the audit and actual main experience',()=>page.evaluate(()=>{const old=player.eq.doll;player.eq.doll={id:'doll_莫提斯',cnt:1,bless:false,anc:false,attr:false,seteff:false};const previous=_audit.exp;const gains=__probeExp(),each=10000*(1+partyExpBonusPct()/100)*1.05;player.eq.doll=old;return gains[0]===Math.floor(each*1.1)&&gains[1]===Math.floor(each)&&gains[2]===gains[0]&&_audit.exp-previous===gains[0];}));
await check('downed ally and pet keep their existing no-experience rule',()=>page.evaluate(()=>{const a=player.allies[0],p=petsOutList()[0];a._downed=true;p._downed=true;const gains=__probeExp();a._downed=false;p._downed=false;return gains[0]===10500&&gains[1]===0&&gains[2]===0;}));
await check('a capped main still grants the boosted pet share',()=>page.evaluate(()=>{const lv=player.lv;player.lv=100;const expected=Math.floor(10000*(1+partyExpBonusPct()/100)*1.05),gains=__probeExp();player.lv=lv;return gains[0]===0&&gains[2]===expected;}));
await page.evaluate(()=>socialLobby.open());
await check('reentering cannot stack the experience bonus',()=>page.evaluate(()=>{const expected=Math.floor(10000*(1+partyExpBonusPct()/100)*1.05);return __probeExp().every(n=>n===expected);}));
if(!options.baseline){
 await page.click('[data-self]');await page.selectOption('#lobby-pose','seated');
 await check('own pose can change without connecting or publishing a card',()=>page.evaluate(()=>player.lobbyPose==='seated'&&document.querySelector('[data-self] .lobby-camper-sprite').dataset.pose==='seated'));
 await page.keyboard.press('Escape');await check('closing card preserves lobby bonus',()=>page.evaluate(()=>socialLobby.isOpen()&&adventureLobbyExpMult()===1.05));
 await page.click('#btn-social-lobby');await check('button exit cancels bonus and restores focus',()=>page.evaluate(()=>!socialLobby.isOpen()&&adventureLobbyExpMult()===1&&document.activeElement.id==='btn-social-lobby'));
 await enter();await check('pose preference survives reentry',()=>page.evaluate(()=>document.querySelector('[data-self] .lobby-camper-sprite').dataset.pose==='seated'));
 await page.evaluate(()=>{player.statuses.stun=5;returnToTown();});await check('blocked return without map change preserves bonus',()=>page.evaluate(()=>socialLobby.isOpen()&&adventureLobbyExpMult()===1.05));
 await page.evaluate(()=>{player.statuses.stun=0;returnToTown();});await check('returning to town cancels bonus',()=>page.evaluate(()=>!socialLobby.isOpen()&&adventureLobbyExpMult()===1));
 await enter();await check('town entry cannot preclaim the next hunting bonus',()=>page.evaluate(()=>adventureLobbyExpMult()===1&&document.getElementById('lobby-hunt-status').textContent.includes('未啟用')));
 await page.evaluate(()=>{setMapSelectors('training');changeMap(true);});await check('departing requires another lobby entry',()=>page.evaluate(()=>!socialLobby.isOpen()&&adventureLobbyExpMult()===1));
 await enter();await page.evaluate(()=>{setMapSelectors('talking_island');changeMap(true);});await check('switching hunting maps cancels lobby and bonus',()=>page.evaluate(()=>!socialLobby.isOpen()&&adventureLobbyExpMult()===1));
}
// Rebuild a native, uncontaminated 16-second sample before actual unload/reopen.
await page.evaluate(()=>{socialLobby.close();player.allies=[];petsOutList().forEach(p=>{p.outOwner=null;p.outSlot=null;});petMarkDirty();petRosterSave();setMapSelectors('training');changeMap(true);offlineResetRateSample();state.running=true;player.exp=0;player.hp=player.mhp;});
for(let i=0;i<3;i++)await page.evaluate(i=>{if(i)__offlineTest.advance(8000);mapState.mobs[0]={...DB.mobs.orc,exp:10000,noGold:true,uid:uid(),curHp:0,st:newMobStatus()};const r=Math.random;Math.random=()=>.5;try{killMob(0);}finally{Math.random=r;}},i);
await page.evaluate(()=>{saveGame();window.__offlineBefore={progress:player.exp,rate:player.offlineHunt.profile.expPerMin};});
await enter();
const before=await page.evaluate(()=>({...__offlineBefore,lv:player.lv}));
await reopen(600000);
await check('actual lobby unload gives one 5% offline bonus from pre-entry baseline sample',()=>page.evaluate(b=>{stopGameTimers();state.running=false;return Math.abs(player.exp-b.progress-Math.floor(Math.floor(b.rate*10*.7)*1.05))<=1;},before));
await check('reloaded town does not inherit the live lobby bonus',()=>page.evaluate(()=>!socialLobby.isOpen()&&(typeof adventureLobbyExpMult==='undefined'||adventureLobbyExpMult()===1)));
if(!options.baseline)await check('saved pose survives actual reload',()=>page.evaluate(()=>player.lobbyPose==='seated'));

if(!options.baseline){
 await page.evaluate(()=>{state.running=true;setMapSelectors('training');changeMap(true);offlineResetRateSample();player.exp=0;});await enter();
 for(let i=0;i<3;i++)await page.evaluate(i=>{if(i)__offlineTest.advance(8000);mapState.mobs[0]={...DB.mobs.orc,exp:10000,noGold:true,uid:uid(),curHp:0,st:newMobStatus()};const rng=Math.random;Math.random=()=>.5;try{killMob(0);}finally{Math.random=rng;}},i);
 await page.evaluate(()=>saveGame());
 await check('samples collected inside the lobby still store unboosted base experience',()=>page.evaluate(()=>Math.abs(player.offlineHunt.profile.expPerMin-112500)<1&&player.exp===31500));
 await page.click('#btn-social-lobby');const unboosted=await page.evaluate(()=>({progress:player.exp,rate:player.offlineHunt.profile.expPerMin}));await reopen(600000);
 await check('leaving before actual unload removes offline bonus from samples collected inside lobby',()=>page.evaluate(b=>{stopGameTimers();state.running=false;return Math.abs(player.exp-b.progress-Math.floor(b.rate*10*.7))<=1;},unboosted));
 const bossBefore=await page.evaluate(()=>{
   socialLobby.close();state.running=true;setMapSelectors('antaras_lair');changeMap(true);player.exp=0;player.hp=player.mhp;return player.exp;
 });await enter();
 await page.evaluate(()=>{__offlineTest.advance(16000);const mob={...DB.mobs.antaras,exp:10000,noGold:true,uid:uid(),curHp:0,st:newMobStatus(),_bornMs:Date.now()-1000};mapState.mobs[0]=mob;const rng=Math.random;Math.random=()=>.5;try{killMob(0);}finally{Math.random=rng;}saveGame();});
 await check('native boss kill is boosted but its saved proof remains unboosted',()=>page.evaluate(()=>player.exp===10500&&player.offlineHunt.eligible&&player.offlineHunt.profile.bossRoom===true&&player.offlineHunt.profile.bosses[0].expPerKill===10000));
 const boss=await page.evaluate(()=>({progress:player.exp,cycle:player.offlineHunt.profile.bossCycleMs,exp:player.offlineHunt.profile.bosses[0].expPerKill}));await reopen(600000);
 await check('pure-boss offline cycles apply the lobby bonus exactly once',()=>page.evaluate(b=>{stopGameTimers();state.running=false;return player.exp-b.progress===Math.floor(Math.floor(600000*.7/b.cycle)*b.exp*1.05);},boss));
 const settled=await page.evaluate(()=>player.exp);await page.evaluate(()=>{state.running=true;offlineSettleCatchup(0);});await page.goto('about:blank');await open();await page.evaluate(()=>{loadGame();stopGameTimers();});await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
 await check('reloading again does not grant the same offline interval twice',()=>page.evaluate(expected=>{state.running=false;return player.exp===expected;},settled));
}
await check('no runtime errors',()=>page.evaluate(()=>!__offlineTest.errors.length||__offlineTest.errors));
await page.evaluate(()=>__offlineTest.cleanup());await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');
console.log({spaceId:task.spaceId,checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Lobby adventure regression');
if(!options.keepSpace)await task.finish({keep:[]});
})();
