(async () => {
const fs = await import('node:fs/promises');
const task = await taskSpace(options.space ?? '離線七人隊伍結算修正');
console.log({spaceId: task.spaceId});
const page = task.page(options.page || 'p1'), reports = [], sources = {};
const crypto=await import('node:crypto');for(const name of ['index.html','js/27-offline-rewards.js','js/06-status-allies.js','tests/offline-team.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
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
    await fs.writeFile(options.artifacts + '/offline-team-' + (options.baseline ? 'baseline' : options.protocol) + '.json', JSON.stringify({method:'Ego browser, native document unload, kill/save/load and document reopen, isolated persistent synthetic bucket and controlled wall clock', sources,reports}, null, 2));
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
        currentSlot = slot; selectClass('m_royal'); document.getElementById('creation-name').value='合成測試角色';startGame(); stopGameTimers();
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
async function team(){
 await sample(1);
 await page.evaluate(()=>{
  player.alloc.cha=60-player.base.cha;calcStats();const base=JSON.parse(saveStateJson());
  const classes=['knight','elf','mage','dark','dragon','illusion','warrior'];
  const skills=[[],['sk_elf_summon2'],['sk_summon'],[],[],['sk_illu_ogre'],[]];
  for(let i=0;i<7;i++){const d=structuredClone(base);Object.assign(d.p,{name:'合成隊員'+(i+1),cls:classes[i],enSeed:'offline-team-'+i,_roleEpoch:'offline-team-'+i,allies:[],skills:skills[i],elfEle:'fire'});d.p.config.autoBuffSkills=Object.fromEntries(skills[i].map(s=>[s,true]));_lzSet('lineage_idle_save_'+(i+2),_saveWrap(JSON.stringify(d)));}
  player.allies=classes.map((c,i)=>buildAlly(String(i+2)));setMapSelectors('zone_39');changeMap(true);state.running=true;state.ticks=10;
  for(const a of player.allies)allyMaintainBuffs(a);
  offlineResetRateSample();for(let i=0;i<3;i++){if(i)__offlineTest.advance(8000);mapState.mobs[0]={...DB.mobs.nm_025,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}saveGame();
 });
}
for(const lobby of [false,true]){
 await team();if(lobby)await page.evaluate(()=>socialLobby.open());
 await check((lobby?'lobby':'battle')+' ivory tower six: seven-member party qualifies at normal speed',()=>page.evaluate(()=>currentSpeed===1&&player.allies.length===7&&allyActiveCap()===7&&player.offlineHunt.eligible&&player.allies.filter(a=>a.summon).length===2));
 await page.evaluate(()=>{const a=player.allies.find(a=>a.cls==='mage');a.summon.endTick=state.ticks;summonTick(a.summon,()=>{a.summon=null;},a);saveGame();});
 await check((lobby?'lobby':'battle')+' native summon expiry does not erase the established sample',()=>page.evaluate(()=>!player.allies.find(a=>a.cls==='mage').summon&&player.offlineHunt.eligible||{reason:player.offlineHunt.blockReason}));
 const before=await page.evaluate(()=>({exp:player.exp,lv:player.lv,ally:player.allies.map(a=>a.exp),roleId:accountRoleId(player)}));
 await reopen(600000,1);
 await check((lobby?'lobby':'battle')+' native unload/reopen settles instead of showing the reported missing-sample message',()=>page.evaluate(b=>{const log=document.getElementById('sys-log').textContent;return player.allies.length===7&&(player.exp>b.exp||player.lv>b.lv)&&log.includes('已依最新存檔更新 7 名隊員')&&log.includes('離線掛機完成：象牙塔6樓')&&!log.includes('本次沒有離線收益')&&accountRoleId(player)===b.roleId||{log:log.slice(-1200)};},before));
 await check((lobby?'lobby':'battle')+' settlement is recorded with positive actual rewards',()=>page.evaluate(()=>__offlineTest.result?.mapName==='象牙塔6樓'&&__offlineTest.result.exp>0));
}
await check('no browser runtime errors',()=>page.evaluate(()=>!__offlineTest.errors.length||__offlineTest.errors));
await page.evaluate(()=>{stopGameTimers();state.running=false;__offlineTest.cleanup();});await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({suite:'offline-team',passed:reports.filter(r=>r.status==='PASS').length,total:reports.length});
if(!options.keepSpace)await task.finish({keep:[]});if(reports.some(r=>r.status==='FAIL'))process.exitCode=1;
})();
