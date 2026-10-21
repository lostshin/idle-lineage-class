(async () => {
const fs = await import('node:fs/promises');
const task = await taskSpace(options.space ?? '大廳趴姿與離線收益修正');
console.log({spaceId: task.spaceId});
const page = task.page(options.page || 'p1'), reports = [], sources = {};
const crypto=await import('node:crypto');for(const name of ['js/social-lobby.js','css/social-lobby.css','js/27-offline-rewards.js','js/06-status-allies.js','js/10-ui-tabs.js','tests/lobby-rest.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
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
    await fs.writeFile(options.artifacts + '/lobby-rest-' + (options.baseline ? 'baseline' : options.protocol) + '.json', JSON.stringify({method:'Ego browser, native document unload, kill/save/load and document reopen, isolated persistent synthetic bucket and controlled wall clock', sources,reports}, null, 2));
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
for(const lobby of [false,true]) {
    await sample(lobby?2:1);
    await page.evaluate(lobby=>{if(lobby)socialLobby.open();player.exp=getExpReq(player.lv)-1;__offlineTest.advance(8000);mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);saveGame();},lobby);
    await check((lobby?'lobby':'battle')+' natural level-up preserves an already qualified hunt sample',()=>page.evaluate(()=>player.lv===61&&player.offlineHunt.eligible||{lv:player.lv,reason:player.offlineHunt.blockReason}));
    const before=await page.evaluate(()=>({exp:player.exp,lv:player.lv}));
    await reopen(600000,lobby?2:1);
    await check((lobby?'lobby':'battle')+' native close and reopen grants offline reward after level-up',()=>page.evaluate(b=>player.lv>b.lv||player.exp>b.exp||{log:document.getElementById('sys-log').textContent.slice(-500)},before));
}
await sample(3);await page.evaluate(()=>socialLobby.open());
await check('experience bonus replaces the title at the top-left',()=>page.evaluate(()=>{const e=document.getElementById('lobby-room-title'),r=e.getBoundingClientRect(),c=document.getElementById('lobby-scene').getBoundingClientRect();return e.textContent.includes('經驗 +5%')&&!e.textContent.includes('肝膽相照')&&r.top-c.top<25&&r.left-c.left<25&&!document.getElementById('lobby-hunt-status').textContent.includes('5%');}));
await check('all 16 prone assets decode (HTTP also checks alpha)',()=>page.evaluate(async()=>{
 const avatars=['王子','公主','男騎士','女騎士','男妖精','女妖精','男法師','女法師','男黑暗妖精','女黑暗妖精','男龍騎士','女龍騎士','男幻術士','女幻術士','男戰士','女戰士'];
 for(const avatar of avatars){const i=new Image();i.src='assets/ui/lobby-poses-v2/'+avatar+'-prone.webp';try{await i.decode();}catch{return false;}if(i.naturalWidth!==128)return false;if(location.protocol==='file:')continue;const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);if(ctx.getImageData(0,0,1,1).data[3]!==0)return false;}return true;
}));
await page.click('[data-self]');
await check('prone pose is available alongside existing poses',()=>page.evaluate(()=>!!document.querySelector('#lobby-pose option[value="prone"]')));
if(!options.baseline){
    await page.selectOption('#lobby-pose','prone');await page.keyboard.press('Escape');
    await page.waitForFunction(()=>{const i=document.querySelector('[data-self] img');return i?.complete&&i.naturalWidth>0;});
    await check('prone choice renders the avatar-specific transparent sprite',()=>page.evaluate(()=>player.lobbyPose==='prone'&&document.querySelector('[data-self] img').src.includes('-prone.webp')));
}
await page.evaluate(()=>{socialLobby.close();const d=JSON.parse(saveStateJson());d.p.enSeed='rest-ally';d.p._roleEpoch='rest-ally';d.p.name='合成隊友';d.p.allies=[];d.p.poly={n:'骷髏',c:'text-gray-300'};d.p.buffs.poly=50;_lzSet('lineage_idle_save_4',_saveWrap(JSON.stringify(d)));player.allies=[buildAlly('4')];renderSquadPanel();switchSquadTab('skill');});
await check('ally has an individual polymorph toggle in skill settings',()=>page.evaluate(()=>!!document.querySelector('[data-ally-poly="4"]')));
if(!options.baseline){
 await page.click('[data-ally-poly="4"]');
 await check('disabled polymorph does not renew or spend gold, retaining current timed effect',()=>page.evaluate(()=>{const a=player.allies[0],before=player.gold;const held=a.buffs.poly===50;a.buffs.poly=0;allyMaintainPoly(a);return held&&!a._mercPolyAuto&&a.buffs.poly===0&&player.gold===before;}));
 await page.click('[data-ally-poly="4"]');
 await check('enabled polymorph renews the existing form using native cost',()=>page.evaluate(()=>{const a=player.allies[0],before=player.gold,price=shopPrice(DB.items.scroll_poly.p);allyMaintainPoly(a);return a.buffs.poly>0&&player.gold===before-price;}));
 await page.click('[data-ally-poly="4"]');
 await check('explicit disabled preference survives rebuilding the same ally',()=>page.evaluate(()=>{snapshotMercPrefs(player.allies[0]);const a=buildAlly('4');return a._mercPolyAuto===false;}));
}
await check('v3.9.18 sampling keeps its established map sample across equipment changes',()=>page.evaluate(()=>{player.eq.wpn={id:'wpn_katana',en:7,cnt:1,uid:'changed',bless:false,anc:false,attr:false,seteff:false};calcStats();saveGame();return player.offlineHunt.eligible;}));
await check('no browser runtime errors',()=>page.evaluate(()=>!__offlineTest.errors.length||__offlineTest.errors));
await page.evaluate(()=>{stopGameTimers();state.running=false;__offlineTest.cleanup();});
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log(JSON.stringify({suite:'lobby-rest',passed:reports.filter(r=>r.status==='PASS').length,total:reports.length,reports}));
if(!options.keepSpace)await task.finish({keep:[]});
if(reports.some(r=>r.status==='FAIL'))throw Error('lobby-rest checks failed');
})();
