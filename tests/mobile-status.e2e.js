// Regression: a hidden ability page still supplies the visible mobile status mirror.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || 'Mobile status mirror regression'), page = task.page('p1');
console.log({spaceId:task.spaceId});
const reports = [], sources = {};
for (const file of ['index.html','js/08-items-equip.js','js/addon-mobile-bridge.js','js/vendor/afk/afk-battlebuffs.js']) sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name, fn) {
    const value = await fn(); reports.push({name,status:value===true?'PASS':'FAIL',detail:value===true?undefined:value});
    await fs.writeFile(options.artifacts+'/mobile-status-'+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; isolated synthetic storage; native tick expiry and status mirror; phone, tablet and desktop viewports',sources,reports},null,2));
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const data={lineage_optional_addons_v1:JSON.stringify({v:1,enabled:{mobile:true}})};
    const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
    for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{value:storage,configurable:true});
    window.BroadcastChannel=undefined;window.__mobileStatusErrors=[];addEventListener('error',e=>__mobileStatusErrors.push(e.message));
})();`})).identifier;
async function viewport(width,touch) {
    await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:touch});
    await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:1});
}
await viewport(390,true);await page.goto(options.url+'?mobile-status');
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function'&&!!document.getElementById('m-battle-buffs'));
await page.evaluate(()=>{
    _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;
    selectClass('m_mage');document.getElementById('creation-name').value='狀態鏡射測試';startGame();stopGameTimers();state.running=false;
    setMapSelectors('training');changeMap(true);stopGameTimers();state.running=false;
    window.__statusTab=t=>switchTab(t,document.querySelector('[onclick="switchTab(\''+t+'\', this)"]'));
});
for(const width of [390,900]) {
    await viewport(width,true);
    await page.waitForFunction(()=>document.body.classList.contains('m-mobile'));
    await page.evaluate(()=>{
        __statusTab('stats');player.buffs={sk_shield:60};player.statuses={stun:1};calcStats();updateUI();
        __statusTab('weapons');renderStatusEffects();
    });
    await check(width+'px: hidden source still supplies visible active states',()=>page.evaluate(()=>{
        const mirror=document.getElementById('m-battle-buffs');
        return document.getElementById('tab-stats').classList.contains('hidden')&&mirror.checkVisibility()&&mirror.textContent.includes('暈眩')&&mirror.textContent.includes(DB.skills.sk_shield.n);
    }));
    await page.evaluate(()=>{state.running=true;try{tick();}finally{stopGameTimers();state.running=false;}flushTickRender();renderStatusEffects();});
    await check(width+'px: native stun expiry clears the mirror without opening stats',()=>page.evaluate(()=>{
        const mirror=document.getElementById('m-battle-buffs');
        return player.statuses.stun===0&&document.getElementById('tab-stats').classList.contains('hidden')&&!mirror.textContent.includes('暈眩')&&mirror.textContent.includes(DB.skills.sk_shield.n);
    }));
    await page.evaluate(()=>{player.statuses.poison=20;renderStatusEffects();});
    await check(width+'px: a newly applied status reaches the mirror while stats stay hidden',()=>page.evaluate(()=>document.getElementById('m-battle-buffs').textContent.includes('中毒')));
    await check(width+'px: catch-up suppresses source and mirror writes',()=>page.evaluate(()=>{
        const source=document.getElementById('dt-buffs'),mirror=document.getElementById('m-battle-buffs'),before=[source.innerHTML,mirror.innerHTML];
        state.ff=true;try{player.statuses={};renderStatusEffects();return source.innerHTML===before[0]&&mirror.innerHTML===before[1];}finally{state.ff=false;}
    }));
}
await viewport(1330,false);await page.waitForFunction(()=>!document.body.classList.contains('m-mobile'));
await check('desktop keeps hidden ability values idle even with the mobile option enabled',()=>page.evaluate(()=>{
    __statusTab('weapons');const source=document.getElementById('dt-buffs'),before=source.innerHTML;player.statuses={stun:20};renderStatusEffects();
    return !document.getElementById('m-battle-buffs').checkVisibility()&&source.innerHTML===before;
}));
await check('no runtime errors',()=>page.evaluate(()=>__mobileStatusErrors.length===0||__mobileStatusErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Mobile status mirror regression');
if(!options.keepSpace)await task.finish({keep:[]});
