// Failure cases: accessory entry consumes before choosing a batch, confirmation below
// the fold, silent invalid quantities, lost keyboard focus and result/inventory confusion.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'同款批次強化操作修正'),page=task.page('p1'),reports=[],measurements=[],sources={};
console.log({spaceId:task.spaceId});
for(const name of ['index.html','js/10-ui-tabs.js','css/responsive.css','tests/same-batch-ux.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/same-batch-ux-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego; isolated synthetic memory storage and blocked public lobby API; native entry/click/radio/keyboard, scroll and viewport measurements',sources,measurements,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const data={};window.__uxErrors=[];const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:storage,configurable:true});
 const nativeFetch=fetch;window.fetch=(url,...args)=>String(url).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public API')):nativeFetch(url,...args);
 addEventListener('error',e=>__uxErrors.push(e.message));
})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:759,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?same-batch-ux');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
 _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_knight');document.getElementById('creation-name').value='合成批次操作';startGame();stopGameTimers();state.running=false;setUiScale(100);player.autoSellOn=false;
 window.__uxGear=(id,uid,en=0,cnt=1,extra={})=>({id,uid,en,cnt,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false,...extra});
 window.__uxFixture=(id='hlm_mr',en=0,cnt=10,stock=100)=>{closeModal();player.eq={};const sid=id==='acc_ring_str'?'scroll_acc':id==='wpn_shortbow'?'scroll_weapon':'scroll_armor';player.inv=[__uxGear(id,'ux-target',en,cnt,{futureMarker:{keep:true}}),__uxGear(sid,'ux-scroll',0,stock)];if(sid!=='scroll_acc')player.inv.push(__uxGear(sid+'_b','ux-bless',0,100));calcStats();renderTabs(true);openModal(player.inv[0],false);window.__uxOpened=performance.now();};
 window.__uxRandom=Math.random;window.__uxUid=uid;let n=0;uid=()=>'ux-generated-'+(++n);
 __uxFixture('acc_ring_str');window.__uxBefore=JSON.stringify(player.inv);
});
await page.waitForFunction(()=>performance.now()-__uxOpened>=450);
await check('accessory has a direct non-consuming batch entry in the item window',()=>page.evaluate(()=>!!document.getElementById('same-batch-open')&&JSON.stringify(player.inv)===__uxBefore));
if(await page.evaluate(()=>!!document.getElementById('same-batch-open'))) {
 await page.click('#same-batch-open');await page.click('#same-batch-return');
 await check('accessory batch entry and return never roll or consume',()=>page.evaluate(()=>JSON.stringify(player.inv)===__uxBefore));
 await page.evaluate(()=>Math.random=()=>0);await page.click('#modal-actions [onclick^="executeEnhance("]');await page.evaluate(()=>Math.random=__uxRandom);
 await check('single accessory action still consumes exactly once',()=>page.evaluate(()=>player.inv.find(i=>i.id==='scroll_acc').cnt===99&&player.inv.filter(i=>i.id==='acc_ring_str'&&i.en===1).reduce((n,i)=>n+i.cnt,0)===1));
}
async function enter(id='hlm_mr',en=0,cnt=10,stock=100){await page.evaluate(args=>__uxFixture(...args),[id,en,cnt,stock]);await page.waitForFunction(()=>performance.now()-__uxOpened>=450);if(id!=='acc_ring_str')await page.click('#modal-actions [onclick^="showEnhanceOptions("]');await page.click('#same-batch-open');}
await enter();await page.focus('[data-same-batch-en="0"]');await page.press('[data-same-batch-en="0"]','Enter');
await check('keyboard group selection preserves focus on the selected batch',()=>page.evaluate(()=>document.activeElement.matches('[data-same-batch-en="0"][aria-pressed="true"]')));
await page.fill('#same-batch-quantity','11');
await check('quantity error is visible and associated with the input',()=>page.evaluate(()=>{const e=document.getElementById('same-batch-quantity-error'),q=document.getElementById('same-batch-quantity');return !!e&&e.textContent.includes('1～10')&&q.getAttribute('aria-invalid')==='true'&&q.getAttribute('aria-describedby').includes(e.id)&&document.getElementById('same-batch-preview').disabled;}));
await page.fill('#same-batch-quantity','4');await page.focus('#same-batch-quantity');await page.press('#same-batch-quantity','Tab');
await check('Tab from quantity reaches all button without restarting at the modal close',()=>page.evaluate(()=>document.activeElement.id==='same-batch-all'));
await check('scroll type and mode use native visible radio choices',()=>page.evaluate(()=>document.querySelectorAll('input[name="same-batch-scroll"]').length===2&&document.querySelectorAll('input[name="same-batch-mode"]').length===2));
if(await page.evaluate(()=>!!document.getElementById('same-batch-scroll-blessed'))) {
 await page.focus('#same-batch-scroll-normal');await page.press('#same-batch-scroll-normal','ArrowRight');
 await check('keyboard scroll choice preserves focus after repaint',()=>page.evaluate(()=>document.getElementById('same-batch-scroll-blessed').checked&&document.activeElement.id==='same-batch-scroll-blessed'));
 await page.click('#same-batch-mode-target');
 await check('mode selection preserves focus and reveals a valid target',()=>page.evaluate(()=>document.activeElement.id==='same-batch-mode-target'&&!!document.getElementById('same-batch-goal')));
}
await page.click('#same-batch-preview');
measurements.push(await page.evaluate(()=>{const b=document.getElementById('same-batch-confirm'),risk=document.getElementById('same-batch-risk'),body=document.querySelector('#modal-item-window .item-modal-body'),rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};return {stage:'confirmation',viewport:[innerWidth,innerHeight],confirm:rect(b),risk:risk&&rect(risk),body:rect(body),scrollTop:body.scrollTop,scrollHeight:body.scrollHeight};}));
await check('confirmation replaces editing fields and focuses its summary, never the action',()=>page.evaluate(()=>!document.getElementById('same-batch-quantity')&&!document.getElementById('same-batch-preview')&&document.activeElement.id==='same-batch-confirmation'&&document.querySelector('#same-batch-confirmation').textContent.includes('確認')));
await check('confirmation risk and action fit together inside the visible content area',()=>page.evaluate(()=>{const b=document.getElementById('same-batch-confirm'),r=document.getElementById('same-batch-risk'),body=document.querySelector('#modal-item-window .item-modal-body').getBoundingClientRect();return !!r&&[b,r].every(e=>{const t=e.getBoundingClientRect();return t.top>=body.top-1&&t.bottom<=body.bottom+1;});}));
if(await page.evaluate(()=>!document.getElementById('same-batch-quantity'))) {
 const before=await page.evaluate(()=>JSON.stringify(player.inv));await page.keyboard.press('Enter');
 await check('Enter following preview does not implicitly execute confirmation',()=>page.evaluate(before=>JSON.stringify(player.inv)===before,before));
 await page.click('#same-batch-cancel');
 await check('return to edit restores settings and returns focus to preview',()=>page.evaluate(()=>document.getElementById('same-batch-quantity').value==='4'&&document.activeElement.id==='same-batch-preview'&&!document.getElementById('same-batch-confirm')));
 // Reproduce a native double-click at the preview coordinates, with click count 2.
 const p=await page.evaluate(()=>{const r=document.getElementById('same-batch-preview').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 await page.mouse.click(p.x,p.y);
 for(const type of ['mousePressed','mouseReleased'])await page.cdp('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:2});
 await check('double-clicking preview never consumes',()=>page.evaluate(before=>JSON.stringify(player.inv)===before,before));
 await page.click('#same-batch-cancel');
}
if(!options.baseline) {
 await enter('hlm_mr',0,10,3);await page.click('[data-same-batch-en="0"]');
 await check('shortage is explained before preview',()=>page.evaluate(()=>{const s=document.getElementById('same-batch-feedback');return s.textContent.includes('可處理 3')&&s.textContent.includes('未處理 7');}));
 await enter('hlm_mr',0,10,0);await page.click('[data-same-batch-en="0"]');
 await check('zero stock explains the disabled confirmation without choosing another scroll',()=>page.evaluate(()=>document.getElementById('same-batch-feedback').textContent.includes('卷軸不足')&&document.getElementById('same-batch-scroll-normal').checked));
 await page.click('#same-batch-preview');await check('zero stock keeps final confirmation disabled',()=>page.evaluate(()=>document.getElementById('same-batch-confirm').disabled));
 await enter('hlm_mr',0,10,10);await page.evaluate(()=>{player.inv.push(__uxGear('hlm_mr','ux-existing',1,30,{futureMarker:{keep:true}}));renderSameBatchEnhance();});await page.click('[data-same-batch-en="0"]');await page.fill('#same-batch-quantity','3');await page.click('#same-batch-preview');await page.click('#same-batch-confirm');
 await check('round output 3 and existing inventory 33 are labelled separately',()=>page.evaluate(()=>document.querySelector('#same-batch-result [data-same-batch-result-en="1"]').textContent.includes('×3')&&document.querySelector('[data-same-batch-en="1"]').textContent.includes('×33')&&document.getElementById('same-batch-result').textContent.includes('本輪結果')&&document.getElementById('same-batch-inventory-heading').textContent.includes('背包')));
 await check('results receive focus and are visible; next batch is explicitly required',()=>page.evaluate(()=>{const r=document.getElementById('same-batch-result').getBoundingClientRect(),b=document.querySelector('#modal-item-window .item-modal-body').getBoundingClientRect();return document.activeElement.id==='same-batch-result'&&r.top>=b.top-1&&r.bottom<=b.bottom+1&&document.getElementById('same-batch-feedback').textContent.includes('請選下一批')&&!document.querySelector('[data-same-batch-en][aria-pressed="true"]')&&!document.getElementById('same-batch-goal');}));
 await page.click('[data-same-batch-en="0"]');await page.click('#same-batch-mode-target');
 await page.evaluate(()=>document.getElementById('same-batch-preview').addEventListener('click',()=>{const body=document.querySelector('#modal-item-window .item-modal-body'),b=body.getBoundingClientRect(),r=document.getElementById('same-batch-preview').getBoundingClientRect();window.__uxEditScroll=body.scrollTop;window.__uxEditOffset=r.top<b.top?r.top-b.top:Math.max(0,r.bottom-b.bottom);},{once:true,capture:true}));
 await page.click('#same-batch-preview');await page.click('#same-batch-cancel');
 await check('return from summary restores context and scrolls only enough to reveal the focused control',()=>page.evaluate(()=>{const body=document.querySelector('#modal-item-window .item-modal-body'),b=body.getBoundingClientRect(),r=document.getElementById('same-batch-preview').getBoundingClientRect();return document.activeElement.id==='same-batch-preview'&&Math.abs(body.scrollTop-(__uxEditScroll+__uxEditOffset))<=1&&r.top>=b.top-1&&r.bottom<=b.bottom+1;}));
 for(const width of [1330,1920,390])for(const scale of [60,75,80,100]) {
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:759,deviceScaleFactor:1,mobile:false});await page.evaluate(scale=>setUiScale(scale),scale);
  await enter();await page.click('[data-same-batch-en="0"]');await page.click('#same-batch-mode-target');await page.selectOption('#same-batch-goal','4');await page.click('#same-batch-preview');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await check(`${width}px ${scale}% compact confirmation has no overflow and visible risk/actions`,()=>page.evaluate(()=>{const panel=document.getElementById('same-batch-panel'),body=document.querySelector('#modal-item-window .item-modal-body').getBoundingClientRect(),frame=document.getElementById('modal-item-window').getBoundingClientRect();return panel.scrollWidth<=panel.clientWidth+1&&frame.left>=-1&&frame.right<=innerWidth+1&&['same-batch-risk','same-batch-confirm','same-batch-cancel'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=body.left-1&&r.right<=body.right+1&&r.top>=body.top-1&&r.bottom<=body.bottom+1;});}));
 }
 if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/same-batch-ux-confirmation-'+options.protocol+'.png'});
 await page.click('#same-batch-confirm');
 if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/same-batch-ux-result-'+options.protocol+'.png'});
 await check('no browser runtime errors or duplicate ids',()=>page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return !__uxErrors.length&&ids.length===new Set(ids).size||__uxErrors;}));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Same batch UX regression');
if(!options.keepSpace)await task.finish({keep:[]});
