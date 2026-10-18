// Failure cases: implicit activation, lost settings/save data, wrong tick ratios,
// doubled background/offline time, missed retreat, double revival and unsafe market replacement.
(async () => {
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '齒輪加速器移植驗收'), page = task.page(options.page || 'p1');
console.log({spaceId:task.spaceId});
const reports = [], sources = {}, bucket = 'codex_gear_fixture_' + Date.now();
for (const file of ['index.html','js/addon-switches.js','js/01-drops-config.js','js/03-combat-core.js','js/27-offline-rewards.js','js/gear-accelerator.js','tests/gear-accelerator.e2e.js']) {
    try { sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; sources[file] = null; }
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source:`(() => {
    if (!location.href.startsWith(${JSON.stringify(options.url)})) return;
    const native = localStorage, key = ${JSON.stringify(bucket)}, file = location.protocol === 'file:', prefix = key+':';
    const record = JSON.parse((file ? (window.name.startsWith(prefix) ? window.name.slice(prefix.length) : null) : native.getItem(key)) || '{"data":{}}');
    let live = true;
    const persist = () => {if (!live) return; const json=JSON.stringify(record); if(file) window.name=prefix+json; else native.setItem(key,json);};
    window.__gearTest = {data:record.data, errors:[], fail:'', perf:10000, now:record.now || Date.now(),
        advance(ms){this.perf+=ms;this.now+=ms;record.now=this.now;persist();},
        reopenAfter(ms){record.now=this.now+ms;persist();},
        cleanup(){live=false;if(file)window.name='';else native.removeItem(key);}};
    Date.now = () => __gearTest.now;
    Object.defineProperty(performance,'now',{value:()=>__gearTest.perf,configurable:true});
    const storage = {getItem:k=>record.data[k]??null,setItem(k,v){if(__gearTest.fail&&k.includes(__gearTest.fail))throw Error('synthetic write failure');record.data[k]=String(v);persist();},removeItem(k){delete record.data[k];persist();},key:i=>Object.keys(record.data)[i]??null,get length(){return Object.keys(record.data).length;}};
    Object.defineProperty(window,'localStorage',{value:storage}); Object.defineProperty(window,'sessionStorage',{value:storage});
    addEventListener('error',e=>__gearTest.errors.push(e.message));
})();`})).identifier;
async function check(name, fn) {
    try {const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}
    catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}
    await fs.writeFile(options.artifacts+'/gear-accelerator-'+(options.baseline?'baseline':options.protocol)+'.json',JSON.stringify({method:'Real Ego browser; native settings/reload and original game tick, retreat, revival, market, save/load; isolated synthetic storage and controlled simulation clocks; not a performance benchmark',sources,reports},null,2));
}
async function ready(){await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});}
async function settings(){await page.click('#btn-automation');await page.click('#settings-tab-addons');}
async function role(){await page.evaluate(()=>{selectClass('m_mage');document.getElementById('creation-name').value='合成齒輪驗收';startGame();stopGameTimers();state.running=false;player.autoSellOn=false;player.config.gearUnknown={keep:true};});}
async function drain(){await page.waitForFunction(()=>_tickDebt<TICK_MS&&!state.ff);}
async function advance(ms){await page.evaluate(ms=>{__gearTest.advance(ms);gameLoop();},ms);await drain();}
async function cleanup(){await page.evaluate(()=>{state.running=false;__gearTest.cleanup();});await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');}
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?gear-accelerator-test');await ready();await role();await settings();
await check('gear is an unchecked settings option and has no panel or automation by default',()=>page.evaluate(()=>{
    const option=document.querySelector('[data-addon-id="gear"]');
    return !!option&&!option.checked&&!AFK_TOGGLES.enabled('gear')&&!document.getElementById('gear-ui-container')&&typeof setGameSpeed==='undefined';
}));
if(options.baseline){await cleanup();throw Error('Baseline: gear option is absent');}
await page.click('[data-addon-id="gear"]');
await check('draft does not activate gear before saving and reloading',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('gear')&&!document.getElementById('gear-ui-container')));
await page.click('#addons-cancel');
await check('cancel clears the gear draft',()=>page.evaluate(()=>!document.querySelector('[data-addon-id="gear"]').checked));
await page.click('[data-addon-id="gear"]');await page.evaluate(()=>{__gearTest.fail='lineage_optional_addons_v1';});await page.click('#addons-apply');
await check('settings write failure leaves gear disabled and the draft retryable',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('gear')&&document.querySelector('[data-addon-id="gear"]').checked&&document.getElementById('addons-status').textContent.includes('失敗')));
await page.evaluate(()=>{__gearTest.fail='';});await page.click('#addons-apply');await ready();
await check('native apply reload activates the original seven speed buttons',()=>page.evaluate(()=>AFK_TOGGLES.enabled('gear')&&currentSpeed===1&&JSON.stringify([...document.querySelectorAll('.gear-spd-btn')].map(b=>+b.dataset.speed))==='[1,2,4,8,16,32,64]'));
await page.evaluate(()=>{currentSlot=1;loadGame();});await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));await page.evaluate(()=>{stopGameTimers();state.running=false;});
await check('enabling preserves native role identity and unknown config fields',()=>page.evaluate(()=>player.name==='合成齒輪驗收'&&player.config.gearUnknown.keep&&accountRoleDoc(1).p.config.gearUnknown.keep));
await page.click('#gear-toggle-btn');await check('original panel collapses',()=>page.evaluate(()=>document.getElementById('gear-content').style.display==='none'));
await page.click('#gear-toggle-btn');
for(const speed of [1,2,4,8,16,32,64]){
    await page.click(`.gear-spd-btn[data-speed="${speed}"]`);
    const start=await page.evaluate(()=>{state.running=true;_resetGameLoopClock();return state.ticks;});
    await advance(1000);
    await check(speed+'x advances every native tick at the selected ratio',()=>page.evaluate(({start,speed})=>{state.running=false;return state.ticks-start===10*speed&&TICK_MS===100;},{start,speed}));
}
await page.click('.gear-spd-btn[data-speed="4"]');
const background=await page.evaluate(()=>{state.running=true;_resetGameLoopClock();Object.defineProperty(document,'hidden',{value:true,configurable:true});return state.ticks;});
await advance(1000);await page.evaluate(()=>{__gearTest.advance(500);delete document.hidden;_resumeIncrementalBackground('gear-test');});await drain();
await check('background callbacks and resume tail count accelerated time exactly once',()=>page.evaluate(start=>{state.running=false;return state.ticks-start===60;},background));
await page.click('.gear-spd-btn[data-speed="64"]');
const shortTail=await page.evaluate(()=>{state.running=true;_resetGameLoopClock();__gearTest.advance(50);const start=state.ticks;_resumeIncrementalBackground('gear-short-tail');return start;});await drain();
await check('a sub-100ms resume tail retains all 32 accelerated ticks',()=>page.evaluate(start=>{state.running=false;return state.ticks-start===32;},shortTail));
await page.click('.gear-spd-btn[data-speed="4"]');
await page.evaluate(()=>{state.running=true;_resetGameLoopClock();__gearTest.advance(1000);window.__gearBoundaryTicks=state.ticks;});
await page.click('.gear-spd-btn[data-speed="1"]');await page.evaluate(()=>gameLoop());await drain();
await check('switching to 1x retains the elapsed interval at the previous speed',()=>page.evaluate(()=>{state.running=false;return state.ticks-__gearBoundaryTicks===40;}));
await page.click('.gear-spd-btn[data-speed="2"]');await page.evaluate(()=>{state.running=true;_resetGameLoopClock();player.gold+=7;gainItem('potion_heal',2,true,true);});await advance(500);await page.evaluate(()=>{state.running=false;});await page.click('.gear-spd-btn[data-speed="1"]');
await check('small accelerated batches produce a summary and save the actual gains',()=>page.evaluate(()=>document.getElementById('sys-log').textContent.includes('加速總結')&&accountRoleDoc(1).p.gold===player.gold&&accountRoleDoc(1).p.inv.some(i=>i.id==='potion_heal')));
await page.evaluate(()=>{setMapSelectors('training');changeMap(true);state.running=false;player.hp=1;player.mp=player.mmp;player.statuses={};});
await page.click('.gear-spd-btn[data-speed="64"]');await page.evaluate(()=>{state.running=true;_resetGameLoopClock();});await advance(100/64);
await check('low HP protection at 64x returns before the next tick can kill the player',()=>page.evaluate(()=>{state.running=false;return !player.dead&&mapState.current.startsWith('town_')&&document.getElementById('gear-status-text').textContent.includes('回村');}));
await page.evaluate(()=>{state.running=true;_resetGameLoopClock();});await advance(100/64);
await check('automatic retreat waits for real HP and MP recovery before departing',()=>page.evaluate(()=>{state.running=false;return mapState.current.startsWith('town_')&&player.hp<player.mhp;}));
await page.click('.gear-spd-btn[data-speed="1"]');
await page.evaluate(()=>{state.running=false;setMapSelectors('training');changeMap(true);player.statuses.stun=100;player.hp=1;state.running=true;});
await check('retreat keeps native crowd-control restrictions',async()=>{await page.waitForFunction(()=>document.getElementById('gear-status-text').textContent.includes('無法'));return page.evaluate(()=>{state.running=false;return mapState.current==='training';});});
await page.evaluate(()=>{player.statuses={};player.hp=player.mhp;player.dead=true;player.inv.push({id:'scroll_revive',cnt:2,en:0,uid:uid(),bless:false,anc:false,attr:false,seteff:false});state.running=true;});
await page.waitForFunction(()=>!player.dead);
await check('successful native in-place revival consumes one scroll and does not also revive in town',()=>page.evaluate(()=>{state.running=false;return mapState.current==='training'&&player.inv.find(i=>i.id==='scroll_revive').cnt===1;}));
await page.evaluate(()=>{setMapSelectors(getHomeTown());changeMap(true);state.running=false;player.pandoraMarket2.futureGear={keep:true};player.pandoraMarket2.buyOrder={id:'wpn_katana',price:99999};});
const keyword=await page.evaluate(()=>DB.items.wpn_katana.n);await page.fill('#pandora-search-input',keyword);await page.click('#gear-refresh-market');
await check('specified market stock uses native prices and preserves existing order and unknown fields',()=>page.evaluate(()=>{const m=player.pandoraMarket2;return m.slots.length===PANDORA_SLOT_COUNT&&m.slots.every(s=>s.id==='wpn_katana'&&Number.isSafeInteger(s.price)&&s.price>0)&&m.buyOrder.price===99999&&m.futureGear.keep&&accountRoleDoc(1).p.pandoraMarket2.futureGear.keep;}));
await page.fill('#pandora-search-input','合成不存在道具');await page.click('#gear-refresh-market');
await check('invalid keywords fall back to native random stock without invalid items',()=>page.evaluate(()=>player.pandoraMarket2.slots.length===PANDORA_SLOT_COUNT&&player.pandoraMarket2.slots.every(s=>!!DB.items[s.id])&&document.getElementById('sys-log').textContent.includes('隨機刷新')));
const offlineBase=await page.evaluate(()=>{
    setMapSelectors('training');changeMap(true);player.lv=60;player.exp=0;calcStats();state.running=true;player.hp=player.mhp;player.mp=player.mmp;
    for(let i=0;i<3;i++){
        if(i)__gearTest.advance(8000);
        mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);
    }
    _resetGameLoopClock();saveGame();state.running=false;
    return {profile:JSON.parse(JSON.stringify(player.offlineHunt.profile)),gold:player.gold,exp:player.exp};
});
await page.click('.gear-spd-btn[data-speed="64"]');
await page.evaluate(()=>{state.running=true;mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);window.__fb5CloseFlush=true;try{saveGame();}finally{window.__fb5CloseFlush=false;}state.running=false;});
await check('accelerated kills cannot inflate the saved original-speed offline rate',()=>page.evaluate(base=>{const p=player.offlineHunt.profile;return p.sampleKills===base.profile.sampleKills&&p.goldPerMin===base.profile.goldPerMin&&p.expPerMin===base.profile.expPerMin;},offlineBase));
const closedBase=await page.evaluate(()=>{state.running=true;_resetGameLoopClock();__gearTest.reopenAfter(120000);return {gold:player.gold,exp:player.exp};});
await page.reload();await ready();await page.evaluate(()=>{currentSlot=1;loadGame();});await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));await page.evaluate(()=>{stopGameTimers();state.running=false;});
await check('closing accelerated play still grants only the original 70% two-minute offline award at 1x',()=>page.evaluate(({base,rate})=>currentSpeed===1&&player.gold===base.gold+Math.floor(rate.goldPerMin*2*.7+1e-7)&&player.exp===base.exp+Math.floor(rate.expPerMin*2*.7+1e-7),{base:closedBase,rate:offlineBase.profile}));
await page.click('.gear-spd-btn[data-speed="4"]');
await page.evaluate(()=>{state.running=true;_resetGameLoopClock();_tickDebt=2000;__gearTest.advance(500);window.__gearSaveRole=accountRoleId(player);returnToCharacterSelect();});
await check('character selection saves pending accelerated time in simulation units and resets speed',()=>page.evaluate(()=>{const p=Object.entries(__gearTest.data).find(([k])=>k.includes('catchup_'));return currentSpeed===1&&p&&JSON.parse(p[1]).ms===4000;}));
await page.evaluate(()=>{currentSlot=1;loadGame();});await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));await page.evaluate(()=>{stopGameTimers();state.running=false;});
await check('load restores the same role at 1x and consumes pending time only once',()=>page.evaluate(()=>currentSpeed===1&&accountRoleId(player)===__gearSaveRole&&!Object.keys(__gearTest.data).some(k=>k.includes('catchup_'))));
for(const width of [1330,1920])for(const scale of [60,75,80,100]){
    await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate(scale=>setUiScale(scale),scale);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await check(width+'px '+scale+'% keeps the gear controls in the viewport',()=>page.evaluate(()=>{const r=document.getElementById('gear-ui-container').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.getElementById('gear-ui-container').scrollWidth<=document.getElementById('gear-ui-container').clientWidth+1;}));
}
if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/gear-accelerator-'+options.protocol+'.png'});
await settings();await page.click('[data-addon-id="gear"]');await page.click('#addons-apply');await ready();
await check('disabling and reloading removes the panel and all gear hooks without losing progress',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('gear')&&!document.getElementById('gear-ui-container')&&typeof setGameSpeed==='undefined'&&accountRoleDoc(1).p.config.gearUnknown.keep));
await check('no browser runtime errors',()=>page.evaluate(()=>__gearTest.errors.length===0||__gearTest.errors));
await cleanup();console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(reports.some(r=>r.status==='FAIL'))throw Error('Gear accelerator failed');
if(!options.keepSpace)await task.finish({keep:[]});
})();
