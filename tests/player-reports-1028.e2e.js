// Regression coverage for the three screenshot reports; synthetic storage only.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space ?? '玩家回報：登入、離線與倉庫'),page=task.page('p1'),reports=[],sources={};
console.log({spaceId:task.spaceId});
for(const file of ['index.html','css/mobile-mode.css','js/12-npc-quests.js','js/27-offline-rewards.js','tests/player-reports-1028.e2e.js'])sources[file]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name,fn){try{const detail=await fn();reports.push({name,status:detail===true?'PASS':'FAIL',detail:detail===true?undefined:detail});}catch(e){reports.push({name,status:'FAIL',detail:String(e)});}await fs.writeFile(options.artifacts+'/player-reports-1028-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; synthetic in-memory storage, public lobby blocked, native ticks/save/load and UI actions; controlled clock and seeded RNG',sources,reports},null,2));}
let init;
async function boot(data={},now=1900000000000){
    if(init)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
    init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__reportData=${JSON.stringify(data)};window.__reportNow=${now};Date.now=()=>__reportNow;window.__reportErrors=[];const s={getItem:k=>__reportData[k]??null,setItem:(k,v)=>__reportData[k]=String(v),removeItem:k=>delete __reportData[k],key:i=>Object.keys(__reportData)[i]??null,get length(){return Object.keys(__reportData).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;const f=fetch;window.fetch=(u,...a)=>String(u).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public lobby')):f(u,...a);addEventListener('error',e=>__reportErrors.push(e.message));})();`})).identifier;
    await page.goto(options.url+'?player-reports-1028');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
    await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;const original=recordAddonOfflineHistory;window.recordAddonOfflineHistory=function(r){window.__reportResult=structuredClone(r);return original.apply(this,arguments);};});
}
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function create(){await page.evaluate(()=>{currentSlot=1;selectClass('m_mage');document.getElementById('creation-name').value='合成回報驗證';startGame();stopGameTimers();state.running=false;player.lv=64;player.gold=1e8;player.autoSellOn=false;calcStats();player.hp=player.mhp;player.mp=player.mmp;});}
await page.cdp('Network.setBypassServiceWorker',{bypass:true});await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Page.bringToFront');
for(const [width,height] of [[1330,900],[390,844],[844,390]]){
    await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await boot({lineage_optional_addons_v1:JSON.stringify({v:1,enabled:{mobile:true}})});
    await page.waitForFunction(()=>document.body.classList.contains('m-mobile'));await settle();
    await check(`${width}x${height}: mobile credits have a readable width and start button is reachable`,()=>page.evaluate(()=>{
        const meta=document.getElementById('login-meta-layer').getBoundingClientRect(),d=document.getElementById('login-disclaimer').getBoundingClientRect(),start=document.getElementById('btn-start-menu').getBoundingClientRect(),menu=document.getElementById('main-menu').getBoundingClientRect(),screen=document.getElementById('creation-screen');
        return d.width>=Math.min(260,document.documentElement.clientWidth*.75)&&d.height<150&&start.top>=0&&start.bottom<=document.documentElement.clientHeight&&meta.top>=menu.bottom-1&&screen.scrollWidth<=screen.clientWidth+1||{meta:meta.toJSON(),disclaimer:d.toJSON(),start:start.toJSON(),menu:menu.toJSON()};
    }));
    await check(`${width}x${height}: native start opens character selection`,async()=>{await page.click('#btn-start-menu');return page.evaluate(()=>!document.getElementById('load-select-panel').classList.contains('hidden'));});
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await boot();await create();
await page.evaluate(()=>{
    setUiScale(100);window.__reportItem=(id,uid,seteff=false)=>({id,uid,seteff,cnt:2,en:0,bless:false,anc:false,attr:false,lock:false,junk:false});
    window.__reportIds={normal:Object.keys(DB.items).find(id=>DB.items[id].type==='arm'&&!isRelic(DB.items[id])&&!DB.items[id].remains),relic:Object.keys(DB.items).find(id=>DB.items[id].type==='arm'&&isRelic(DB.items[id])),remains:'rem_heart',claw:'rem_claw'};
    player.inv=Object.entries(__reportIds).map(([key,id])=>__reportItem(id,'inv-'+key,key==='remains'||key==='claw'?'幻覺':false));saveGame();saveWarehouse({items:player.inv.map(i=>({...i,uid:i.uid.replace('inv-','store-')})),gold:0});openWarehouseWindow();
});
for(const [category,keys] of [['armor',['normal']],['weapon',[]],['relic',['relic']],['remains',['remains','claw']]]){
    await page.click('[data-wh-filter="'+category+'"]');
    await check(category+': both lists contain only their own category',()=>page.evaluate(keys=>['inv','store'].every(side=>{const actual=[...document.querySelectorAll('#wh-'+side+'-list [data-wh-uid]')].map(e=>e.dataset.whUid.replace(side+'-','')).sort();return JSON.stringify(actual)===JSON.stringify([...keys].sort());}),keys));
}
await page.click('[data-wh-filter="remains"]');await page.selectOption('[aria-label="細分類"]',{label:'幻覺'});
await page.click('#wh-store-list [data-wh-uid="store-remains"] [data-wh-transfer]');
await check('remains category keeps native withdrawal and set-effect filtering',()=>page.evaluate(()=>!loadWarehouse().items.some(i=>i.uid==='store-remains')&&player.inv.filter(i=>i.id==='rem_heart').reduce((n,i)=>n+i.cnt,0)===4));
await page.focus('#wh-search-input');await page.keyboard.insertText('之心');await check('cross-category search still finds remains',()=>page.evaluate(()=>!!document.querySelector('#wh-inv-list [data-wh-uid]')&&document.getElementById('wh-inv-list').textContent.includes('之心')));
await page.press('#warehouse-window-close','Enter');
// Build a real kill sample, then seed an older dangerous survival snapshot as a legacy fixture.
await boot();await create();
await page.evaluate(()=>{
    state.running=true;setMapSelectors('fire_dragon');changeMap(true);stopGameTimers();player.hp=player.mhp;player.mp=player.mmp;
    document.getElementById('set-teleport').checked=true;AFK_BOSSAVOID.set('fire_dragon',['phoenix']);
    for(let i=0;i<3;i++){if(i)__reportNow+=8000;mapState.mobs[0]={...DB.mobs.salamander,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}
    for(const id of ['phoenix','ifrit']){mapState.mobs[0]={...DB.mobs[id],uid:uid(),curHp:0,st:newMobStatus(),_bornMs:__reportNow-1000};killMob(0);}saveGame();
    const p=player.offlineHunt.profile;p.survival={sampleMs:1800000,damagePerMin:0,healingPerMin:0,potionHealPerMin:0,potionPerMin:0,potionId:'',deathRatePerHour:0,minHpPct:0.01,updatedAt:__reportNow-3600000};player.offlineHunt.profiles=[structuredClone(p)];offlineResetRateSample();
    window.__reportStableTicks=count=>{mapState.mobs=Array(5).fill(null);mapState.spawnAt=Array(5).fill(1e9);player.hp=player.mhp;player.mp=player.mmp;for(let i=0;i<count;i++){__reportNow+=TICK_MS;tick();}saveGame();};
    __reportStableTicks(100);stopGameTimers();state.running=false;
});
await check('under fifteen seconds keeps the previous survival evidence',()=>page.evaluate(()=>player.offlineHunt.profile.survival.minHpPct===.01));
await page.evaluate(()=>{state.running=true;__reportStableTicks(60);stopGameTimers();state.running=false;});
await check('fresh stable native ticks replace an old low-HP survival sample',()=>page.evaluate(()=>{const s=player.offlineHunt.profile.survival;return s.sampleMs===16000&&s.minHpPct>=.99&&s.deathRatePerHour===0||s;}));
await check('saving the same stable sample twice does not add historical weight',()=>page.evaluate(()=>{const before=JSON.stringify(player.offlineHunt.profile.survival);saveGame();return before===JSON.stringify(player.offlineHunt.profile.survival);}));
await check('native ally summon expiry and recast retain the qualified survival sample',()=>page.evaluate(()=>{
    state.running=true;
    const doc=JSON.parse(saveStateJson());Object.assign(doc.p,{name:'合成召喚隊員',enSeed:'report-summon-owner',_roleEpoch:'report-summon-owner',allies:[],skills:['sk_summon']});doc.p.config.autoBuffSkills={sk_summon:true};_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));
    const ally=buildAlly('2');player.allies=[ally];ally.mp=ally.mmp;allyMaintainBuffs(ally);if(!ally.summon)return {stage:'first summon'};
    const before=player.offlineHunt.profile.survival.minHpPct,old=ally.summon;old.endTick=state.ticks;summonTick(old,()=>{ally.summon=null;},ally);if(ally.summon)return {stage:'expiry'};
    ally.mp=ally.mmp;allyMaintainBuffs(ally);saveGame();const result=!!ally.summon&&ally.summon!==old&&player.offlineHunt.eligible&&player.offlineHunt.profile.survival.minHpPct===before;state.running=false;return result||{summon:!!ally.summon,recast:ally.summon!==old,eligible:player.offlineHunt.eligible,reason:player.offlineHunt.blockReason,before,after:player.offlineHunt.profile.survival.minHpPct};
}));
const saved=await page.evaluate(()=>{state.running=true;saveGame();stopGameTimers();state.running=false;return{data:{...__reportData},now:__reportNow};});
await page.goto('about:blank');await boot(saved.data,saved.now+7*3600000);
await page.evaluate(()=>{
    for(const id of ['phoenix','ifrit']){const item='report_drop_'+id;DB.items[item]={n:item,type:'mat',w:0,p:0,c:'text-white',req:'all'};MOB_DROPS[DB.mobs[id].n]=[[item,100]];}
    window.idleLineageNativeOffline={planSurvival(input){window.__reportSurvival=structuredClone(input);return null;}};
    let seed=12345;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed+.5)/4294967296;};currentSlot=1;loadGame();
});
await page.waitForFunction(()=>!!window.__reportResult);await page.evaluate(()=>{stopGameTimers();state.running=false;});
await check('seven-hour native reload settlement survives the fresh stable sample',()=>page.evaluate(()=>!__reportResult.died&&__reportResult.elapsedMs===7*3600000||__reportResult));
await check('offline settlement excludes phoenix but still rewards ifrit',()=>page.evaluate(()=>!player.inv.some(i=>i.id==='report_drop_phoenix')&&player.inv.some(i=>i.id==='report_drop_ifrit')));
await check('fresh stable sample gives no stale random-death risk to the native bridge',()=>page.evaluate(()=>__reportSurvival.deathRatePerHour===0||__reportSurvival));
await check('saved phoenix-only avoidance remains selected after native load',()=>page.evaluate(()=>document.getElementById('set-teleport').checked&&JSON.stringify(AFK_BOSSAVOID.picked('fire_dragon'))==='["phoenix"]'));
await check('no runtime errors in final document',()=>page.evaluate(()=>!__reportErrors.length||__reportErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Player screenshot regressions failed');if(!options.keepSpace)await task.finish({keep:[]});
