// Failure cases: missing breathing glow, offscreen/background animation, unbounded
// layers or observers after redraw, motion preference ignored, or item data changed.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '可見物品省資源呼吸光'), page = task.page('p1');
console.log({spaceId:task.spaceId});
const reports = [], sources = {};
for (const name of ['index.html','css/style.css','js/10-ui-tabs.js','tests/item-breathing.e2e.js']) {
    sources[name] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
}
const output = options.artifacts+'/item-breathing-'+(options.baseline?'baseline-':'')+options.protocol+'.json';
async function check(name, fn) {
    try { const detail = await fn(); if (detail !== true) throw Error(JSON.stringify(detail)); reports.push({name,status:'PASS'}); }
    catch (error) { reports.push({name,status:'FAIL',error:String(error)}); console.log({name,error:String(error)}); }
    await fs.writeFile(output, JSON.stringify({sources,method:'Actual Ego; native tabs, scroll, redraw and save/load; synthetic storage and isolated public API; document visibility/window focus events use explicit synthetic probes because Ego keeps pages visible',reports},null,2));
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    const data = {}, storage = {getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
    for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{value:storage,configurable:true});
    const nativeFetch=fetch; window.fetch=(url,...args)=>String(url).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public API')):nativeFetch(url,...args);
    window.BroadcastChannel=undefined; window.__ibErrors=[]; addEventListener('error',event=>__ibErrors.push(event.message));
})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.goto(options.url+'?item-breathing');
await task.cdp('Target.activateTarget',{targetId:page.targetId});
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
    _bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker=null; _getLzWorker=()=>null;
    selectClass('m_knight'); document.getElementById('creation-name').value='合成呼吸光'; startGame(); stopGameTimers(); state.running=false; setUiScale(100);
    player.lv=80; player.gold=1000000; player.autoSellOn=false;
    const gear=(id,uid,extra={})=>({id,uid,en:7,cnt:1,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false,...extra});
    player.inv=[gear('wpn_katana','ib-plain'),gear('wpn_dragonslayer','ib-legend'),gear('relic_healer_wand','ib-unwearable',{en:0}),
        ...Array.from({length:177},(_,i)=>gear('wpn_katana','ib-w-'+i,{bless:i%2===0,anc:i%2!==0})),
        ...Array.from({length:90},(_,i)=>gear('hlm_mr','ib-a-'+i,{bless:i>0})),
        gear('scroll_weapon','ib-normal-scroll',{en:0,cnt:10}),gear('sherine_crystal','ib-crystal',{en:0,cnt:99}),
        ...Array.from({length:58},(_,i)=>gear('scroll_armor_b','ib-i-'+i,{en:0,cnt:2}))];
    player.eq.wpn=gear('wpn_dragonslayer','ib-equipped'); calcStats(); renderTabs(true);
    window.__ibOriginal=JSON.stringify(player.inv);
    window.__ibRows=()=>[...document.querySelectorAll('.player-backpack-tab [data-inventory-uid]')];
    window.__ibState=()=>__ibRows().map(row=>{
        const box=row.querySelector('.classic-icon-box'),s=getComputedStyle(box,'::after'),r=row.getBoundingClientRect(),v=row.closest('.classic-inventory-viewport').getBoundingClientRect();
        return {uid:row.dataset.inventoryUid,active:s.animationName!=='none'&&s.animationPlayState==='running',animation:s.animationName,content:s.content,
            visible:!!r.width&&r.bottom>v.top+1&&r.top<v.bottom-1&&r.bottom>0&&r.top<innerHeight,tab:row.closest('.player-backpack-tab').id};
    });
});
const tab = async name => { await page.click('[onclick="switchTab(\''+name+'\', this)"]'); };
const ready = () => page.waitForFunction(()=>__ibState().some(x=>x.active),undefined,{timeout:4000});
for (const name of ['weapons','armors','items']) {
    await tab(name);
    if (!options.baseline) await ready();
    await check(name+': only a bounded visible set breathes, including rare consumables',()=>page.evaluate(name=>{
        const rows=__ibState(), active=rows.filter(x=>x.active);
        return active.length>0&&active.length<=8&&active.every(x=>x.visible&&x.tab==='tab-'+name)&&rows.filter(x=>x.uid==='ib-plain'||x.uid==='ib-normal-scroll').every(x=>!x.active);
    },name));
}
if (!options.baseline) {
    await tab('weapons'); await ready();
    await check('breathing animates only a separate opacity layer; icon filters and badges stay native',()=>page.evaluate(()=>{
        const row=document.querySelector('#tab-weapons .inventory-glow-visible'),box=row.querySelector('.classic-icon-box');
        const animation=box.getAnimations({subtree:true}).find(a=>a.effect?.pseudoElement==='::after');
        const keys=animation?.effect.getKeyframes(); const image=row.querySelector('img'),unwearable=document.querySelector('[data-inventory-uid="ib-unwearable"] img');
        return !!keys?.length&&keys.every(k=>Object.keys(k).every(p=>['offset','computedOffset','easing','composite','opacity'].includes(p)))&&
            Number(getComputedStyle(box,'::after').animationDuration.replace('s',''))>=4&&getComputedStyle(image).animationName==='none'&&
            !getComputedStyle(image).filter.includes('drop-shadow')&&getComputedStyle(unwearable).filter.includes('grayscale')&&getComputedStyle(unwearable).opacity==='0.3'&&row.textContent.includes('+7');
    }));
    const initial = await page.evaluate(()=>__ibState().filter(x=>x.active).map(x=>x.uid));
    const rect = await page.evaluate(()=>{const r=document.querySelector('#tab-weapons .classic-inventory-viewport').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await page.mouse.move(rect.x,rect.y); await page.mouse.wheel(0,680);
    await page.waitForFunction(ids=>!__ibState().some(x=>x.active&&ids.includes(x.uid)),initial,{timeout:4000}); await ready();
    await check('scrolling stops old rows and starts only currently visible rows',()=>page.evaluate(ids=>{
        const active=__ibState().filter(x=>x.active);return active.length>0&&active.length<=8&&active.every(x=>x.visible&&!ids.includes(x.uid));
    },initial));
    await page.evaluate(()=>{player.inv.push({id:'wpn_katana',uid:'ib-added',en:0,cnt:1,bless:true,anc:false,attr:false,seteff:false,lock:false,junk:false});renderTabs();}); await ready();
    await check('redraw replaces observation without leaving detached animations',()=>page.evaluate(()=>{
        const active=__ibState().filter(x=>x.active);return active.length>0&&active.length<=8&&active.every(x=>x.visible)&&
            document.getAnimations().filter(a=>a.animationName==='inventoryBreathe').every(a=>a.effect.target.isConnected);
    }));
    for (const name of ['stats','equip','skill']) {
        await tab(name);
        await check(name+': all backpack breathing is removed',()=>page.evaluate(()=>!__ibState().some(x=>x.active)&&!document.getAnimations().some(a=>a.animationName==='inventoryBreathe')));
    }
    await tab('weapons'); await ready();
    await page.evaluate(()=>{Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>false});window.dispatchEvent(new Event('blur'));});
    await check('synthetic window blur removes all item animations',()=>page.evaluate(()=>!__ibState().some(x=>x.active)&&!document.getAnimations().some(a=>a.animationName==='inventoryBreathe')));
    await page.evaluate(()=>{delete document.hasFocus;window.dispatchEvent(new Event('focus'));}); await ready();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await check('synthetic hidden visibility event removes all item animations',()=>page.evaluate(()=>document.hidden&&!__ibState().some(x=>x.active)&&!document.getAnimations().some(a=>a.animationName==='inventoryBreathe')));
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}); await ready();
    await check('returning to foreground restarts a bounded visible set',()=>page.evaluate(()=>!document.hidden&&__ibState().filter(x=>x.active).length>0&&__ibState().filter(x=>x.active).length<=8));
    await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await page.waitForFunction(()=>!__ibState().some(x=>x.active));
    await check('reduced motion removes recurring animation',()=>page.evaluate(()=>!document.getAnimations().some(a=>a.animationName==='inventoryBreathe')));
    await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]}); await ready();
    for (const width of [220,300,460]) {
        await page.evaluate(width=>{const col=document.getElementById('col-right');for(const p of ['width','min-width','max-width']) col.style.setProperty(p,width+'px','important');setUiScale(width===220?60:100);},width);
        await page.waitForFunction(()=>{const active=__ibState().filter(x=>x.active);return active.length>0&&active.every(x=>x.visible);});
        await check(width+'px: glow stays in cells and does not change hit targets',()=>page.evaluate(()=>{
            const row=document.querySelector('#tab-weapons .inventory-glow-visible'),box=row.querySelector('.classic-icon-box'),s=getComputedStyle(box,'::after');
            return s.pointerEvents==='none'&&s.position==='absolute'&&__ibState().filter(x=>x.active).length<=8&&__ibState().filter(x=>x.active).every(x=>x.visible);
        }));
    }
    await check('animation and view changes preserve the original item fields',()=>page.evaluate(()=>JSON.stringify(player.inv.filter(i=>i.uid!=='ib-added'))===__ibOriginal));
    await page.evaluate(()=>{const col=document.getElementById('col-right');for(const p of ['width','min-width','max-width']) col.style.setProperty(p,'460px','important');setUiScale(100);window.__ibSaved=JSON.stringify(player.inv);saveGame();loadGame();});
    await page.waitForFunction(()=>player.cls&&!document.getElementById('game-screen').classList.contains('hidden'));
    await page.evaluate(()=>{stopGameTimers();state.running=false;}); await tab('weapons'); await ready();
    await check('native reload retains quantities by full signature, color and scroll count',()=>page.evaluate(()=>{
        const totals=list=>JSON.stringify(Object.entries(list.reduce((counts,item)=>{const key=itemSig(item)+'|'+item.lock+'|'+item.junk;counts[key]=(counts[key]||0)+(item.cnt||1);return counts;},{})).sort());
        return totals(JSON.parse(__ibSaved))===totals(player.inv)&&getItemColor(player.inv.find(x=>x.uid==='ib-legend'))==='c-legend'&&player.inv.find(x=>x.uid==='ib-normal-scroll').cnt===10;
    }));
    await check('no runtime errors',()=>page.evaluate(()=>!__ibErrors.length||__ibErrors));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init}); await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length});
if (!options.baseline&&reports.some(r=>r.status==='FAIL')) throw Error('Item breathing regression');
if (!options.keepSpace) await task.finish({keep:[]});
