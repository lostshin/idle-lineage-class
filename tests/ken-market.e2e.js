// Failure cases: hidden feedback, unavailable items causing random stock, ambiguous
// partial names, exact-name collisions, IME Enter, lost market fields and covered blue buttons.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'強化配色與黑市搜尋'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const name of ['index.html','css/responsive.css','js/gear-accelerator.js','tests/ken-market.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/ken-market-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser, isolated memory storage and synthetic role; native typing/candidate/click/Enter and enhancement actions; market/RNG/save snapshots and computed colors',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={lineage_optional_addons_v1:JSON.stringify({v:1,enabled:{gear:true}})};window.__kmData=data;window.__kmErrors=[];const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;addEventListener('error',e=>__kmErrors.push(e.message));})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?ken-market');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_knight');document.getElementById('creation-name').value='合成黑市驗收';startGame();stopGameTimers();state.running=false;setUiScale(100);player.autoSellOn=false;const gear=(id,uid,cnt=1)=>({id,uid,cnt,en:0,bless:false,anc:false,attr:false,seteff:false});player.inv=[gear('hlm_mr','km-helm'),gear('scroll_armor','km-normal',4),gear('scroll_armor_b','km-bless',2),gear('scroll_armor_c','km-curse',2)];calcStats();renderTabs(true);openModal(player.inv[0],false);window.__kmOpened=performance.now();});
await page.waitForFunction(()=>performance.now()-__kmOpened>=450);
const blue=selector=>page.evaluate(selector=>{const b=document.querySelector(selector),s=b&&getComputedStyle(b);return !!b&&s.backgroundImage==='none'&&s.backgroundColor==='rgb(21, 48, 78)'&&s.color==='rgb(164, 205, 244)'&&!s.borderImageSlice.includes('fill');},selector);
await check('enhancement entry is blue against the dark-red weaken button',async()=>await blue('#modal-actions [onclick^="showEnhanceOptions("]')&&await page.evaluate(()=>getComputedStyle(document.querySelector('#modal-actions [onclick^="AFK_CURSEBATCH.open("]')).backgroundColor==='rgb(66, 21, 24)'));
await page.click('#modal-actions [onclick^="showEnhanceOptions("]');
await check('normal and one-click enhancement both use the blue fill',async()=>await blue('#modal-actions [onclick^="executeEnhance("]:not([data-enhance-blessed])')&&await blue('#modal-actions [onclick^="executeAutoSafeEnhance("]'));
await check('blessed gold and curse red stay distinct',()=>page.evaluate(()=>getComputedStyle(document.querySelector('[data-enhance-blessed]')).color==='rgb(255, 228, 133)'&&getComputedStyle(document.querySelector('#modal-actions [onclick^="executeCurseDeEnhance("]')).backgroundColor==='rgb(66, 21, 24)'));
await page.click('#modal-actions [onclick^="executeEnhance("]:not([data-enhance-blessed])');
await check('blue enhancement still consumes one scroll and performs native safe enhancement',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='km-helm').en===1&&player.inv.find(i=>i.uid==='km-normal').cnt===3&&!document.getElementById('item-modal').classList.contains('hidden')));
await page.evaluate(()=>{player.inv.find(i=>i.uid==='km-helm').en=enhanceCap(DB.items.hlm_mr);renderEnhanceOptions(player.inv.find(i=>i.uid==='km-helm'),false);});
await check('enhancement cap still disables normal and blessed actions',()=>page.evaluate(()=>[...document.querySelectorAll('#modal-actions [onclick^="executeEnhance("]')].every(b=>b.disabled)));
await page.evaluate(()=>{closeModal();refreshPandoraMarket(true);player.pandoraMarket2.futureKen={keep:true};player.pandoraMarket2.buyOrder={id:'wpn_katana',price:99999};const save=saveGame,rng=lootRng;window.__kmCalls={save:0,rng:0};saveGame=function(){__kmCalls.save++;return save.apply(this,arguments);};lootRng=function(){__kmCalls.rng++;return rng.apply(this,arguments);};window.__kmSnap=()=>JSON.stringify([player.pandoraMarket2,__kmCalls.rng]);const search=doPandoraSpecificSearch;doPandoraSpecificSearch=function(){const before={...__kmCalls};const result=search.apply(this,arguments);window.__kmSearchCalls={save:__kmCalls.save-before.save,rng:__kmCalls.rng-before.rng};return result;};DB.items.km_long={...DB.items.wpn_katana,n:'合成驗收劍・長'};DB.items.km_exact={...DB.items.wpn_katana,n:'合成驗收劍'};DB.items.km_unavailable={...DB.items.wpn_katana,n:'合成驗收',gachaWeight:0};});
for(const name of ['寒冰長靴','合成不存在道具','合成驗收']){
    await page.fill('#pandora-search-input',name);const before=await page.evaluate(()=>__kmSnap());await page.click('#gear-refresh-market');
    await check(name+': invalid/unavailable input explains why beside input without changing stock, RNG or saves',()=>page.evaluate(before=>{const s=document.getElementById('pandora-search-status'),i=document.getElementById('pandora-search-input');return __kmSnap()===before&&__kmSearchCalls.save===0&&__kmSearchCalls.rng===0&&!!s&&s.getBoundingClientRect().height>0&&i.getAttribute('aria-describedby')===s.id&&i.getAttribute('aria-invalid')==='true'&&(/不在黑市商品池|找不到/.test(s.textContent));},before));
}
await page.fill('#pandora-search-input','合成驗收劍');
await check('typing shows clickable eligible candidates with the exact name first',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('#pandora-search-suggestions button')];return b.length===2&&b[0].textContent==='合成驗收劍'&&b[1].textContent==='合成驗收劍・長';}));
await page.press('#pandora-search-input','Enter');
await check('Enter prefers the complete name and saves native-priced stock without losing order/unknown fields',()=>page.evaluate(()=>{const m=player.pandoraMarket2;return m.slots.every(s=>s.id==='km_exact'&&Number.isSafeInteger(s.price)&&s.price>0)&&m.slots.length===PANDORA_SLOT_COUNT&&m.buyOrder.price===99999&&m.futureKen.keep&&accountRoleDoc(1).p.pandoraMarket2.futureKen.keep&&document.getElementById('pandora-search-status')?.textContent.includes('已指定刷新');}));
await page.fill('#pandora-search-input','驗收劍');const ambiguous=await page.evaluate(()=>__kmSnap());await page.click('#gear-refresh-market');
await check('ambiguous partial names request a choice without refreshing',()=>page.evaluate(before=>__kmSnap()===before&&document.getElementById('pandora-search-status')?.textContent.includes('請選'),ambiguous));
if(await page.evaluate(()=>!!document.querySelector('#pandora-search-suggestions button'))){
    await page.click('#pandora-search-suggestions button >> nth=1');
    await check('candidate selection fills the full name but does not refresh before confirmation',()=>page.evaluate(before=>document.getElementById('pandora-search-input').value==='合成驗收劍・長'&&__kmSnap()===before,ambiguous));
    await page.click('#gear-refresh-market');await check('confirmed candidate produces the selected stock',()=>page.evaluate(()=>player.pandoraMarket2.slots.every(s=>s.id==='km_long')));
}
await page.fill('#pandora-search-input','合成驗收劍');const composing=await page.evaluate(()=>__kmSnap());
await page.evaluate(()=>document.getElementById('pandora-search-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));
await check('IME confirmation Enter does not refresh market',()=>page.evaluate(before=>__kmSnap()===before,composing));
await page.fill('#pandora-search-input','<img src=x onerror=alert(1)>');
await check('unknown text is shown safely without creating HTML',()=>page.evaluate(()=>!document.querySelector('#pandora-search-suggestions img')&&document.getElementById('pandora-search-status')?.textContent.includes('找不到')));
await page.fill('#pandora-search-input','耳環');
await check('earring candidates contain only actual black-market eligible items',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('#pandora-search-suggestions button')];return b.every(n=>Object.values(DB.items).some(d=>d.n===n.textContent&&d.gachaWeight>0))&&!!document.getElementById('pandora-search-status')?.textContent;}));
await page.fill('#pandora-search-input','');const random=await page.evaluate(()=>__kmCalls.rng);await page.click('#gear-refresh-market');
await check('empty input deliberately uses native random refresh with inline confirmation',()=>page.evaluate(before=>__kmCalls.rng>before&&player.pandoraMarket2.slots.every(s=>DB.items[s.id])&&document.getElementById('pandora-search-status')?.textContent.includes('隨機刷新'),random));
await page.fill('#pandora-search-input','劍');
for(const width of [1330,1920])for(const scale of [60,75,80,100]){
    await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate(scale=>setUiScale(scale),scale);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await check(width+'px '+scale+'%: candidates stay within panel without horizontal overflow',()=>page.evaluate(()=>{const p=document.getElementById('gear-ui-container'),b=document.getElementById('pandora-search-suggestions'),r=p.getBoundingClientRect();return !!b&&b.children.length<=8&&p.scrollWidth<=p.clientWidth+1&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
}
await check('no browser runtime errors',()=>page.evaluate(()=>!__kmErrors.length||__kmErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Ken market regression');if(!options.keepSpace)await task.finish({keep:[]});
