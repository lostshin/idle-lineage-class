// Synthetic storage only. Timings are local Chromium measurements, not an FPS claim.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto'), os = await import('node:os');
const task = await taskSpace(options.space || 'UI performance P0 P1'), page = task.page('p1');
console.log({spaceId: task.spaceId});
const result = {method: 'Cache-disabled cold proxy / warm navigation, 5 samples; DOMContentLoaded and synchronous role-load timing; synthetic in-memory storage, heartbeat/compression workers disabled; native combat; bounded rAF observations are not painted FPS; MutationObserver and CDP main-thread metrics; post-GC heap excludes images', environment: {cpu: os.cpus()[0]?.model, memory: os.totalmem(), platform: os.platform()}, sources: {}, checks: [], startup: [], updates: [], combat: [], soak: []};
for (const file of ['index.html','js/08-items-equip.js','js/10-ui-tabs.js','js/effect-details.js','tests/ui-performance.e2e.js']) result.sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
const path = options.artifacts+'/ui-performance-'+options.protocol+'.json';
const write = () => fs.writeFile(path, JSON.stringify(result, null, 2));
async function check(name, fn) { const value = await fn(); result.checks.push({name, status: value === true ? 'PASS' : 'FAIL', detail: value === true ? undefined : value}); await write(); }
let init;
async function boot(seed = {}, hideLogin = false) {
    if (init) await page.cdp('Page.removeScriptToEvaluateOnNewDocument', {identifier: init});
    init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source: `(() => {
        const data=${JSON.stringify(seed)}; window.__perfStore=data; window.__perfErrors=[]; window.__loginFrames=0;
        for(const field of ['localStorage','sessionStorage']) Object.defineProperty(window,field,{value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}},configurable:true});
        window.BroadcastChannel=undefined;
        addEventListener('error',e=>__perfErrors.push(e.message));
        const raf=window.requestAnimationFrame; window.requestAnimationFrame=function(fn){return raf.call(window,fn.name==='animateLogin'?function(t){__loginFrames++;fn(t);}:fn);};
        addEventListener('DOMContentLoaded',()=>{window.__homeReady=performance.now();${hideLogin ? "document.getElementById('creation-screen').classList.add('hidden');" : ''}});
    })();` })).identifier;
    await page.goto(options.url+'?ui-performance');
    await page.cdp('Page.bringToFront');
    await page.waitForFunction(()=>document.readyState==='complete' && typeof startGame==='function' && !!window.__perfStore);
    await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});
}
async function fixture() {
    await page.evaluate(()=>{
        selectClass('m_royal');document.getElementById('creation-name').value='效能合成角色';startGame();stopGameTimers();state.running=false;setUiScale(80);
        player.lv=80;player.autoSellOn=false;calcStats();player.hp=player.mhp;player.mp=player.mmp;saveGame();
        window.__perfBase=JSON.stringify(player);
        window.__perfTab=t=>switchTab(t,document.querySelector('[onclick="switchTab(\''+t+'\', this)"]'));
    });
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.cdp('Network.setBypassServiceWorker',{bypass:true});
for (const cold of [true,false]) {
    await page.cdp('Network.setCacheDisabled',{cacheDisabled:cold});
    for(let sample=0;sample<5;sample++) {
        await boot(); await fixture();
        const seed=await page.evaluate(()=>({...__perfStore}));
        await boot(seed);
        result.startup.push(await page.evaluate(({cold,sample})=>{
            const t=performance.now();currentSlot=1;loadGame();stopGameTimers();state.running=false;
            return {cold,sample,homeReady:__homeReady,roleLoadMs:performance.now()-t,navigation:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').reduce((r,e)=>({count:r.count+1,transfer:r.transfer+e.transferSize,decoded:r.decoded+e.decodedBodySize}),{count:0,transfer:0,decoded:0})};
        },{cold,sample})); await write();
    }
}
// Observe hidden login for a bounded interval; one already in-flight image may finish.
await boot({},true);
await page.evaluate(()=>{window.__loginStart=__loginFrames;window.__loginProbeDone=false;setTimeout(()=>window.__loginProbeDone=true,800);});
await page.waitForFunction(()=>__loginProbeDone);
await check('hidden login schedules no animation callbacks or remaining frame requests',()=>page.evaluate(()=>({frames:__loginFrames-__loginStart,requests:performance.getEntriesByType('resource').filter(e=>/login\/(27[4-9]|28\d|29\d|300)\.png/.test(e.name)).length})).then(r=>r.frames===0&&r.requests===0||r));
await page.evaluate(()=>document.getElementById('creation-screen').classList.remove('hidden'));
await page.waitForFunction(()=>document.getElementById('login-anim-image').getAttribute('src')!=='public/assets/login/273.png');
await check('login resumes with original decoded artwork',()=>page.evaluate(()=>{const e=document.getElementById('login-anim-image');return e.complete&&e.naturalWidth>0;}));
await page.click('#btn-start-menu');
await page.evaluate(()=>{window.__loginStart=__loginFrames;window.__loginProbeDone=false;setTimeout(()=>window.__loginProbeDone=true,400);});
await page.waitForFunction(()=>__loginProbeDone);
await check('covered login stops callbacks on character selection',()=>page.evaluate(()=>__loginFrames-__loginStart<=1||{frames:__loginFrames-__loginStart}));
await fixture();
for(const tab of ['weapons','stats']) {
    result.updates.push(await page.evaluate(tab=>{
        __perfTab(tab);_updateUIImpl();const observer=new MutationObserver(()=>{});const roots=['status-panel','mobile-vitals','tab-stats','btn-return-town'];
        roots.forEach(id=>observer.observe(document.getElementById(id),{subtree:true,childList:true,characterData:true,attributes:true}));
        const samples=[];for(let i=0;i<5;i++){const t=performance.now();for(let j=0;j<20;j++)_updateUIImpl();samples.push((performance.now()-t)/20);}
        const records=observer.takeRecords();observer.disconnect();return {tab,samples,mutations:records.length,statsMutations:records.filter(r=>document.getElementById('tab-stats').contains(r.target)).length};
    },tab)); await write();
}
await check('hidden ability page receives no repeated writes',()=>result.updates[0].statsMutations===0||result.updates[0]);
await check('unchanged visible ability fields preserve their nodes and focused control',()=>page.evaluate(()=>{
    __perfTab('stats');const e=document.getElementById('dt-str'),total=e.querySelector('[data-ability-total]');e.focus();_updateUIImpl();return total===e.querySelector('[data-ability-total]')&&document.activeElement===e;
}));
await check('hidden values refresh on opening and visible HP, status, gold stay live',()=>page.evaluate(()=>{
    __perfTab('weapons');player.hp-=1;player.gold+=123;player.statuses.stun=2;player.d.str+=3;_updateUIImpl();
    const live=document.getElementById('txt-hp').textContent===`${Math.floor(player.hp)}/${Math.floor(player.mhp)}`&&document.getElementById('st-gold').textContent===player.gold.toLocaleString()&&document.getElementById('st-status').textContent===partyStatusText(player);
    __perfTab('stats');const value=document.getElementById('dt-str').querySelector('[data-ability-total]')?.textContent;player.statuses.stun=0;calcStats();_updateUIImpl();return live&&Number(value)===player.d.str+3&&document.getElementById('st-status').textContent===partyStatusText(player);
}));
await check('allocation drafts and cancellation restore ability markup without touching live attributes',()=>page.evaluate(()=>{
    gainItem('candle',1,true,true);const before=player.d.str;startRespec();adjAlloc('str',1);
    const draft=document.getElementById('dt-str').textContent===String(createBase[player.cls].str+1)&&player.d.str===before;
    cancelRespec();return draft&&!!document.querySelector('#dt-str [data-ability-total]')&&Number(document.querySelector('#dt-str [data-ability-total]').textContent)===before;
}));
await check('external style changes are corrected by the next native UI refresh',()=>page.evaluate(()=>{
    const e=document.getElementById('bar-hp');e.style.width='1%';_updateUIImpl();return Math.abs(parseFloat(e.style.width)-Math.max(0,player.hp/player.mhp*100))<.001;
}));
if(!options.baseline&&result.checks.some(c=>c.status==='FAIL'))throw Error('UI behavior checks failed before timed combat');
await page.cdp('Performance.enable');
async function metrics() {
    const perf=await page.cdp('Performance.getMetrics'),dom=await page.cdp('Memory.getDOMCounters');
    return {performance:Object.fromEntries(perf.metrics.map(m=>[m.name,m.value])),dom,...await page.evaluate(()=>({at:performance.now(),ticks:state.ticks,map:mapState.current,visibility:document.visibilityState,hp:player.hp,exp:player.exp,dead:player.dead,inventory:player.inv.length,errors:__perfErrors,spellCache:Object.keys(_spellFxCache).length}))};
}
async function combatFixture(team) {
    await page.evaluate(team=>{
        stopGameTimers();state.running=false;player=JSON.parse(__perfBase);
        player.inv=Array.from({length:1000},(_,i)=>({id:['wpn_shortbow','arm_74','potion_heal'][i%3],uid:'perf-'+i,cnt:2,en:i%3===2?0:1,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false}));
        if(team){const doc=JSON.parse(saveStateJson());for(let s=2;s<=4;s++){const d=JSON.parse(JSON.stringify(doc));d.p.inv=[];d.p.allies=[];d.p.name='合成隊員'+s;d.p.enSeed='perf-team-'+s;d.p._roleEpoch='perf-epoch-'+s;_lzSet('lineage_idle_save_'+s,_saveWrap(JSON.stringify(d)));}player.allies=[2,3,4].map(s=>buildAlly(String(s)));}
        calcStats();player.hp=player.mhp;player.mp=player.mmp;renderTabs(true);__perfTab('weapons');mapState=freshMapState();
        if(!document.querySelector('#map-select option[value="training"]'))document.getElementById('map-select').add(new Option('新兵修練場','training'));
        document.getElementById('map-select').value='training';changeMap(true);
        const live=window.__live={frames:[],frameCount:0,frameTotalMs:0,maxFrameMs:0,longTasks:[],longTaskCount:0,longTaskMs:0,mutations:0,started:performance.now(),done:false};
        window.__liveObserver=new MutationObserver(r=>live.mutations+=r.length);__liveObserver.observe(document.getElementById('game-screen'),{subtree:true,attributes:true,childList:true,characterData:true});
        window.__longObserver=new PerformanceObserver(l=>{for(const e of l.getEntries()){live.longTaskCount++;live.longTaskMs+=e.duration;if(live.longTasks.length<512)live.longTasks.push(e.duration);}});__longObserver.observe({type:'longtask'});
        let last=performance.now();function frame(t){if(live.done)return;const ms=t-last;live.frameCount++;live.frameTotalMs+=ms;live.maxFrameMs=Math.max(live.maxFrameMs,ms);if(live.frames.length<512)live.frames.push(ms);last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
        startGameTimers();state.running=true;
    },team);
}
for(const team of [0,3]) {
    await combatFixture(team);const begin=await metrics();
    await page.evaluate(()=>setTimeout(()=>{stopGameTimers();state.running=false;__live.done=true;__liveObserver.disconnect();__longObserver.disconnect();},60000));
    await page.waitForFunction(()=>__live.done,undefined,{timeout:70000});
    result.combat.push({team,begin,end:await metrics(),observations:await page.evaluate(()=>__live)});await write();
}
// Full wall-clock soak with alternating native maps. Duration is explicit in the report.
await combatFixture(3);
await page.evaluate(minutes=>{
    window.__soakStarted=Date.now();window.__soakEnd=__soakStarted+minutes*60000;window.__soakSwitch=setInterval(()=>{const map=mapState.current==='training'?'town_talking':'training';const select=document.getElementById('map-select');if(!select.querySelector('option[value="'+map+'"]'))select.add(new Option(map,map));select.value=map;changeMap(true);},30000);
},options.soakMinutes);
while(true) {
    await page.cdp('HeapProfiler.collectGarbage');result.soak.push(await metrics());await write();
    if(await page.evaluate(()=>Date.now()>=__soakEnd))break;
    const nextSample=Date.now()+30000;
    await page.waitForFunction(next=>Date.now()>=Math.min(__soakEnd,next),nextSample,{timeout:40000});
}
await page.evaluate(()=>{clearInterval(__soakSwitch);stopGameTimers();state.running=false;__live.done=true;__liveObserver.disconnect();__longObserver.disconnect();});
result.soakMinutes={requested:options.soakMinutes,actual:await page.evaluate(()=>(Date.now()-__soakStarted)/60000)};
await check('native combat and map soak have no runtime errors',()=>page.evaluate(()=>__perfErrors.length===0||__perfErrors));
if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/ui-performance-'+options.protocol+'.png'});
await write();await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.cdp('Network.setCacheDisabled',{cacheDisabled:false});await page.cdp('Network.setBypassServiceWorker',{bypass:false});
console.log({report:path,checks:result.checks});
if(!options.baseline&&result.checks.some(c=>c.status==='FAIL'))throw Error('UI performance checks failed');
if(!options.keepSpace)await task.finish({keep:[]});
