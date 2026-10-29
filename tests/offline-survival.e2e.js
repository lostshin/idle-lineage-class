// Native HP/potion feedback and reload regression; all storage is synthetic.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space ?? '魔族神殿離線生存驗證'),page=task.page('p1'),reports=[],evidence=[],sources={};
console.log({spaceId:task.spaceId});
for(const file of ['index.html','js/27-offline-rewards.js','tests/offline-survival.e2e.js'])sources[file]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name,fn){try{const detail=await fn();reports.push({name,status:detail===true?'PASS':'FAIL',detail:detail===true?undefined:detail});}catch(e){reports.push({name,status:'FAIL',detail:String(e)});}await fs.writeFile(options.artifacts+'/offline-survival-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; isolated in-memory storage/public API blocked; native poison ticks, automatic potion consumption, save/unload/load; controlled clock/RNG, not real elapsed hours',sources,reports,evidence},null,2));}
let init;
async function boot(data={},now=1900000000000){
    if(init)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
    init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__survivalData=${JSON.stringify(data)};window.__survivalNow=${now};Date.now=()=>__survivalNow;window.__survivalErrors=[];const s={getItem:k=>__survivalData[k]??null,setItem:(k,v)=>__survivalData[k]=String(v),removeItem:k=>delete __survivalData[k],key:i=>Object.keys(__survivalData)[i]??null,get length(){return Object.keys(__survivalData).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;const f=fetch;window.fetch=(u,...a)=>String(u).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public lobby')):f(u,...a);addEventListener('error',e=>__survivalErrors.push(e.message));})();`})).identifier;
    await page.goto(options.url+'?offline-survival');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function',undefined,{timeout:60000});
    await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;const original=recordAddonOfflineHistory;window.recordAddonOfflineHistory=function(r){window.__survivalResult=structuredClone(r);return original.apply(this,arguments);};});
}
await page.cdp('Network.setBypassServiceWorker',{bypass:true});await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Page.bringToFront');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await boot();
await page.evaluate(()=>{
    currentSlot=1;selectClass('m_mage');document.getElementById('creation-name').value='合成神殿生存';startGame();stopGameTimers();state.running=false;
    player.lv=64;player.gold=1e8;player.autoSellOn=false;player.skills=[];player.config.autoBuffSkills={};calcStats();
    // Enter the real map, then replace enemy attacks with native periodic poison for a repeatable HP cycle.
    mapState.current='demon_temple';setMapSelectors('demon_temple');
    mapState.mobs=Array(5).fill(null);mapState.spawnAt=Array(5).fill(1e9);
    player.inv=[{id:'potion_ult',uid:'survival-white',cnt:1000,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false}];
    document.getElementById('set-pot').value='potion_ult';document.getElementById('set-hp-pot').value='70';document.getElementById('set-auto-buy-pot').checked=true;
    for(const el of document.querySelectorAll('#settings-content input[type=checkbox]'))if(el.id!=='set-auto-buy-pot')el.checked=false;
    document.getElementById('set-teleport').checked=false;
    state.running=true;player.hp=player.mhp;player.mp=player.mmp;
    for(let i=0;i<3;i++){if(i)__survivalNow+=8000;mapState.mobs[0]={...DB.mobs.metal_centipede,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}
    saveGame();mapState.mobs=Array(5).fill(null);mapState.spawnAt=Array(5).fill(1e9);offlineResetRateSample();
    player.d.hpRegenMax=0;player.d.hpR=0;player.statuses={poison:1000000,poisonTick:10,poisonDmg:2};
    window.__survivalRun=count=>{for(let i=0;i<count;i++){__survivalNow+=TICK_MS;tick();}stopGameTimers();};
    let seed=8234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed+.5)/4294967296;};
    __survivalRun(6000);
    for(let i=0;i<3;i++){if(i)__survivalNow+=8000;mapState.mobs[0]={...DB.mobs.metal_centipede,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}
    mapState.mobs=Array(5).fill(null);mapState.spawnAt=Array(5).fill(1e9);player.inv.find(i=>i.id==='potion_ult').cnt=5;saveGame();stopGameTimers();state.running=false;
    window.__survivalSample={hp:player.hp,mhp:player.mhp,profile:structuredClone(player.offlineHunt.profile),gold:player.gold};
});
evidence.push({sample:await page.evaluate(()=>__survivalSample)});
await check('native automatic white potions establish a living cycle with a positive sampled deficit',()=>page.evaluate(()=>{const s=__survivalSample.profile.survival;return !player.dead&&s.potionPerMin>0&&s.damagePerMin>s.healingPerMin&&player.hp>player.mhp*.6||{hp:player.hp,mhp:player.mhp,s};}));
const saved=await page.evaluate(()=>({data:{...__survivalData},now:__survivalNow}));
// Continue the exact same living actor online for another hour of native ticks.
for(let i=0;i<12;i++)await page.evaluate(()=>{state.running=true;__survivalRun(3000);state.running=false;});
await check('same native online poison/potion loop remains alive for another simulated hour',()=>page.evaluate(()=>!player.dead&&player.hp>player.mhp*.6));
async function reopen(data,now){await page.goto('about:blank');await boot(data,now);await page.evaluate(()=>{currentSlot=1;loadGame();});await page.waitForFunction(()=>!!window.__survivalResult);await page.evaluate(()=>{stopGameTimers();state.running=false;});}
await reopen(saved.data,saved.now+113*60000);
evidence.push({settlement:await page.evaluate(()=>__survivalResult)});
await check('113-minute native reload no longer invents death from an incomplete healing cycle',()=>page.evaluate(()=>!__survivalResult.died&&__survivalResult.elapsedMs===113*60000||__survivalResult));
await check('offline increases white potion usage to cover the measured HP deficit and charges purchases',()=>page.evaluate(s=>__survivalResult.potionId==='potion_ult'&&__survivalResult.potionUsed>Math.floor(s.potionPerMin*113*.7)&&__survivalResult.potionBought>0&&__survivalResult.potionCost>0||__survivalResult,evidence[0].sample.profile.survival));
// Reuse the qualified original sample with intentionally insufficient supplies and explicit settings.
async function variant(kind){await boot(saved.data,saved.now);await page.evaluate(kind=>{currentSlot=1;loadGame();stopGameTimers();state.running=true;mapState.current='demon_temple';setMapSelectors('demon_temple');
    player.inv=player.inv.filter(i=>i.id!=='potion_ult');player.gold=0;
    const p=structuredClone(__survivalVariantProfile);player.offlineHunt.profile=p;player.offlineHunt.profiles=[p];
    document.getElementById('set-pot').value='potion_ult';document.getElementById('set-hp-pot').value=kind==='disabled'?'0':'70';document.getElementById('set-auto-buy-pot').checked=kind!=='empty';
    if(kind==='disabled')player.inv.push({id:'potion_ult',uid:'disabled-stock',cnt:10000});
    if(kind==='overload'){p.survival.damagePerMin=1e6;p.survival.healingPerMin=p.survival.potionHealPerMin;p.survival.potionPerMin=60;player.inv.push({id:'potion_ult',uid:'overload-stock',cnt:10000});}
    saveGame();stopGameTimers();state.running=false;
},kind);const v=await page.evaluate(()=>({data:{...__survivalData},now:__survivalNow}));await reopen(v.data,v.now+113*60000);}
// Profile assignment is synthetic setup; survival calculation remains native JS, without a planner replacement.
// Supply the captured pre-close profile on each new document through the bootstrap's data-independent hook.
const originalBoot=boot;boot=async(...args)=>{await originalBoot(...args);await page.evaluate(p=>{window.__survivalVariantProfile=p;},evidence[0].sample.profile);};
for(const kind of ['empty','disabled','overload']){await variant(kind);await check(kind+': real supply/cooldown limits still permit offline death',()=>page.evaluate(()=>__survivalResult.died===true||__survivalResult));}
await check('no runtime errors in final document',()=>page.evaluate(()=>!__survivalErrors.length||__survivalErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Offline survival regression failed');if(!options.keepSpace)await task.finish({keep:[]});
