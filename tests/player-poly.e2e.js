// Failure cases: automatic renewal rerolls a ringless form, charges despite remaining stock,
// grants free renewal, ignores opt-out, loses form on load, or breaks manual selection/weapon rules.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '主角變身延續與發布驗證'), page = task.page('p1');
console.log({spaceId:task.spaceId});
const reports = [], sources = {};
for (const name of ['index.html','js/08-items-equip.js','js/07-skills-cast.js','js/03-combat-core.js','js/02-stats-recompute.js','tests/player-poly.e2e.js']) {
    sources[name] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
}
const output = options.artifacts+'/player-poly-'+(options.baseline?'baseline-':'')+options.protocol+'.json';
async function check(name, fn) {
    try { const result = await fn(); if (result !== true) throw Error(JSON.stringify(result)); reports.push({name,status:'PASS'}); }
    catch (error) { reports.push({name,status:'FAIL',error:String(error)}); console.log({name,error:String(error)}); }
    await fs.writeFile(output,JSON.stringify({sources,method:'Actual Ego; native inventory double-click/use, automation checkbox, expiry through tick(), stock/purchase and native save/load; synthetic storage and blocked public lobby API',reports},null,2));
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    const data = {}, storage = {getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
    for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{value:storage,configurable:true});
    const nativeFetch=fetch; window.fetch=(url,...args)=>String(url).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public API')):nativeFetch(url,...args);
    window.BroadcastChannel=undefined; window.__ppErrors=[]; addEventListener('error',event=>__ppErrors.push(event.message));
})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?player-poly');
await task.cdp('Target.activateTarget',{targetId:page.targetId});
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
    _bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker=null; _getLzWorker=()=>null;
    selectClass('m_knight'); document.getElementById('creation-name').value='合成主角變身'; startGame(); stopGameTimers(); state.running=false; setUiScale(100);
    player.lv=80; player.gold=1000000; player.autoSellOn=false; player.skills=[];
    window.__ppItem=(id,uid,cnt=1)=>({id,uid,en:0,cnt,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false});
    player.eq={wpn:__ppItem('wpn_katana','pp-sword')}; player.inv=[__ppItem('scroll_poly','pp-stock',6)]; player.poly=null; player.buffs.poly=0; calcStats(); renderTabs(true);
    const originalUid=uid; let sequence=0; uid=()=> 'pp-generated-'+(++sequence); window.__ppOriginalUid=originalUid;
    window.__ppScrolls=()=>player.inv.filter(i=>i.id==='scroll_poly').reduce((sum,i)=>sum+i.cnt,0);
    window.__ppTick=(random=.999)=>{
        const nativeRandom=Math.random;
        state.ticks=9; state.running=true;
        try { Math.random=()=>random; tick(); }
        finally { state.running=false; Math.random=nativeRandom; }
    };
    window.__ppExpire=()=>{player.buffs.poly=1;__ppTick();};
});
await page.click('[onclick="switchTab(\'items\', this)"]');
await page.dblclick('[data-inventory-uid="pp-stock"]');
await check('manual scroll use creates an eligible ringless form and consumes one stock scroll',()=>page.evaluate(()=>!hasPolyRing()&&player.buffs.poly===DB.items.scroll_poly.dur&&polyRandomCandidates().some(f=>f.n===player.poly?.n)&&__ppScrolls()===5));
await page.click('#btn-automation');
await page.waitForFunction(()=>{const e=document.getElementById('set-poly'),r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);});
await page.click('#set-poly');
await page.evaluate(()=>{
    // Pick the opposite end of the native pool on expiry so the old reroll is observable.
    const pool=polyRandomCandidates(),index=pool.findIndex(f=>f.n===player.poly.n);
    window.__ppRandom=index===pool.length-1?0:.999;
    window.__ppForm=JSON.stringify(player.poly); window.__ppGold=player.gold; __ppExpire=()=>{player.buffs.poly=1;__ppTick(__ppRandom);}; __ppExpire();
});
await check('expiry preserves the complete random form without a ring and consumes only one stock scroll',()=>page.evaluate(()=>JSON.stringify(player.poly)===__ppForm&&player.buffs.poly===DB.items.scroll_poly.dur&&__ppScrolls()===4&&player.gold===__ppGold));
await page.evaluate(()=>{player.inv=player.inv.filter(i=>i.id!=='scroll_poly');window.__ppForm=JSON.stringify(player.poly);window.__ppGold=player.gold;__ppExpire();});
await check('out-of-stock expiry buys exactly one native-price scroll and retains the form',()=>page.evaluate(()=>JSON.stringify(player.poly)===__ppForm&&player.buffs.poly===DB.items.scroll_poly.dur&&__ppScrolls()===0&&player.gold===__ppGold-shopPrice(DB.items.scroll_poly.p)));
await page.evaluate(()=>{window.__ppGold=player.gold;__ppTick();});
await check('active duration does not consume another scroll or charge again',()=>page.evaluate(()=>player.buffs.poly===DB.items.scroll_poly.dur-1&&player.gold===__ppGold&&__ppScrolls()===0));
await page.evaluate(()=>{player.gold=0;__ppExpire();});
await check('insufficient gold leaves the expired effect inactive without a free scroll',()=>page.evaluate(()=>player.gold===0&&player.buffs.poly===0&&__ppScrolls()===0));
await page.click('#set-poly');
await page.evaluate(()=>{player.gold=1000000;window.__ppGold=player.gold;__ppTick();});
await check('unchecked automation does not renew or spend gold',()=>page.evaluate(()=>!document.getElementById('set-poly').checked&&player.buffs.poly===0&&player.gold===__ppGold&&__ppScrolls()===0));
await page.evaluate(()=>{player.inv.push(__ppItem('scroll_poly','pp-manual',3));renderTabs(true);});
await page.click('[onclick="switchTab(\'items\', this)"]');
await page.evaluate(()=>{
    window.__ppForm=player.poly.n;
    const pool=polyRandomCandidates(),index=pool.findIndex(f=>f.n===player.poly.n);
    window.__ppManualRandom=Math.random; Math.random=()=>index===pool.length-1?0:.999;
});
try { await page.dblclick('[data-inventory-uid="pp-manual"]'); }
finally { await page.evaluate(()=>{Math.random=__ppManualRandom;}); }
await check('manual use without a ring still rolls a new native form and consumes stock',()=>page.evaluate(()=>player.poly.n!==__ppForm&&player.buffs.poly===DB.items.scroll_poly.dur&&__ppScrolls()===2));
await page.evaluate(()=>{player.inv.push(__ppItem('acc_117','pp-ring'));renderTabs(true);});
await page.click('[data-inventory-uid="pp-manual"]');
await page.waitForFunction(()=>!document.getElementById('item-modal').classList.contains('hidden'));
await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,500)));
await page.click('#modal-actions [onclick^="useItem("]');
await check('manual use with a ring opens the native selector without consuming stock',()=>page.evaluate(()=>!document.getElementById('poly-modal').classList.contains('hidden')&&__ppScrolls()===2));
await page.click('#poly-modal-list button >> nth=0');
await check('confirmed form selection consumes exactly one scroll',()=>page.evaluate(()=>document.getElementById('poly-modal').classList.contains('hidden')&&player.buffs.poly===DB.items.scroll_poly.dur&&__ppScrolls()===1));
await page.click('#btn-automation'); await page.click('#set-poly');
await page.evaluate(()=>{window.__ppForm=JSON.stringify(player.poly);__ppExpire();});
await check('ring-controlled selection still renews unchanged',()=>page.evaluate(()=>JSON.stringify(player.poly)===__ppForm&&player.buffs.poly===DB.items.scroll_poly.dur&&__ppScrolls()===0));
await page.evaluate(()=>{player.inv=player.inv.filter(i=>i.id!=='acc_117');player.eq.wpn=__ppItem('wpn_shortbow','pp-bow');player.buffs.poly=0;__ppTick();});
await check('incompatible melee form is replaced by an eligible ranged form when renewing',()=>page.evaluate(()=>polyFormMatchesEquippedWeapon(player.poly)&&RANGED_POLY_FORMS.has(player.poly.n)&&player.buffs.poly===DB.items.scroll_poly.dur));
await page.evaluate(()=>{window.__ppForm=JSON.stringify(player.poly);window.__ppGold=player.gold;saveGame();loadGame();});
await page.waitForFunction(()=>player.cls&&!document.getElementById('game-screen').classList.contains('hidden')&&!state.offlineCalculating);
await page.evaluate(()=>{stopGameTimers();state.running=false;});
await check('native save/load preserves automation, form and weapon',()=>page.evaluate(()=>document.getElementById('set-poly').checked&&JSON.stringify(player.poly)===__ppForm&&player.eq.wpn.id==='wpn_shortbow'));
await page.evaluate(()=>{window.__ppForm=JSON.stringify(player.poly);window.__ppGold=player.gold;__ppExpire();});
await check('loaded ringless form renews unchanged through the native tick',()=>page.evaluate(()=>JSON.stringify(player.poly)===__ppForm&&player.buffs.poly===DB.items.scroll_poly.dur&&player.gold===__ppGold-shopPrice(DB.items.scroll_poly.p)));
await check('no browser runtime errors',()=>page.evaluate(()=>!__ppErrors.length||__ppErrors));
await page.evaluate(()=>{uid=__ppOriginalUid;});
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init}); await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});
if (!options.baseline&&reports.some(r=>r.status==='FAIL')) throw Error('Player polymorph renewal regression');
if (!options.keepSpace) { await task.finish({keep:[]}); console.log('finished '+task.spaceId); }
