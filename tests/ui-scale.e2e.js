(async () => {
// UI scale is tested with isolated storage, including a desktop storage bridge.
const fs=await import('node:fs/promises');
const task=await taskSpace(options.space || '整體 UI 縮放驗證');
console.log({spaceId:task.spaceId});
const page=task.page(options.page || 'p1');
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
let initId;const reports=[];
async function boot(seed={},desktop=false,failKey=null){
 if(initId)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});
 const token=String(Date.now())+Math.random();
 initId=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__bootToken=${JSON.stringify(token)};const data=${JSON.stringify(seed)};window.__testData=data;window.__failWrites=false;window.__failKey=${JSON.stringify(failKey)};window.__errors=[];const storage={getItem:k=>data[k]??null,setItem:(k,v)=>{if(__failWrites||k===__failKey)throw Error('synthetic failure');data[k]=String(v)},removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});Object.defineProperty(window,'sessionStorage',{value:{...storage},configurable:true});${desktop?"window.fableStore={get:k=>storage.getItem(k),set:(k,v)=>{storage.setItem(k,v);return true},has:k=>data[k]!==undefined,remove:k=>storage.removeItem(k)};":''}window.addEventListener('error',e=>__errors.push(e.message));})();`})).identifier;
 await page.goto(options.url+'?scale-test='+token,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(t=>__bootToken===t && document.readyState!=='loading' && typeof startGame==='function',token);
}
async function check(name,fn){try{const result=await fn();if(result!==true)throw Error(JSON.stringify(result));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}await fs.writeFile(options.artifacts+'/ui-scale-report-'+options.protocol+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));}
async function viewport(w,h){await page.cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<=1024});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:w<=1024,maxTouchPoints:1});await page.waitForFunction(([w,h])=>document.documentElement.clientWidth===w&&document.documentElement.clientHeight===h,[w,h]);}
// At 60% on narrow file pages, the selector click's wheel scroll can shift the sticky tab bar.
// Focus first, verify the actual hit target, then send a native pointer click at its screen position.
async function clickTab(selector){
 await page.focus(selector);
 await page.waitForFunction(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===e||e.contains(hit);},selector);
 const r=await page.evaluate(s=>document.querySelector(s).getBoundingClientRect().toJSON(),selector);
 await page.mouse.click(r.left+r.width/2,r.top+r.height/2);
}
await viewport(1330,759);await boot();
await check('setting uses the current appearance as centered 100%',()=>page.evaluate(()=>{const e=document.getElementById('set-ui-scale');return !!e && e.min==='75' && e.max==='125' && e.step==='6.25' && e.value==='100' && (Number(e.value)-Number(e.min))/(Number(e.max)-Number(e.min))===.5;}));
if(!await page.evaluate(()=>typeof setUiScale==='function')){
 await fs.writeFile(options.artifacts+'/ui-scale-baseline.json',JSON.stringify(reports,null,2));console.log(reports);throw Error('UI scale is not implemented yet');
}
await page.evaluate(()=>{selectClass('m_mage');document.getElementById('creation-name').value='合成測試角色';startGame();stopGameTimers();state.running=false;});
await page.click('#btn-automation');
await page.evaluate(()=>setUiScale(100));
const button100=await page.evaluate(()=>document.getElementById('btn-automation').getBoundingClientRect().height);
await check('keyboard adjusts scale immediately and persists device preference',async()=>{
 await page.focus('#set-ui-scale');await page.keyboard.press('Home');
 return page.evaluate(before=>getUiScale()===.6 && __testData.lineage_ui_scale==='60' && Math.abs(document.getElementById('btn-automation').getBoundingClientRect().height/before-.6)<.06,button100);
});
await check('slider center selects displayed 100 and arrow keys preserve the original size increments',async()=>{const r=await page.evaluate(()=>document.getElementById('set-ui-scale').getBoundingClientRect().toJSON());await page.mouse.click(r.left+r.width/2,r.top+r.height/2);const center=await page.evaluate(()=>getUiScale()===.8);await page.focus('#set-ui-scale');await page.keyboard.press('ArrowRight');return center&&await page.evaluate(()=>getUiScale()===.85&&__testData.lineage_ui_scale==='85');});
await check('scale does not change character settings or progress',()=>page.evaluate(()=>{const before=JSON.stringify({config:player.config,gold:player.gold,lv:player.lv});setUiScale(85);return before===JSON.stringify({config:player.config,gold:player.gold,lv:player.lv});}));
const sizes=[[320,640],[390,844],[768,1024],[844,390],[1024,768],[1330,759],[1920,1080]];
for(const [w,h] of sizes){if(options.desktopOnly&&w<1200)continue;
 await viewport(w,h);
 for(const percent of [60,75,80,100]){
  await page.evaluate(percent=>setUiScale(percent),percent);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await check(`${w}x${h} ${percent}%: game viewport fits`,()=>page.evaluate(()=>{const r=document.getElementById('game-screen').getBoundingClientRect(),body=document.body.getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && Math.abs(r.height-innerHeight)<=2 && Math.abs(body.width-innerWidth)<=2 && Math.abs(body.height-innerHeight)<=2;}));
  await check(`${w}x${h} ${percent}%: scale control remains readable and reachable`,()=>page.evaluate(()=>{const el=document.getElementById('set-ui-scale'),tab=document.getElementById('tab-automation');return el.offsetWidth>=120 && tab.scrollWidth<=tab.clientWidth+1 && document.getElementById('ui-scale-value').textContent===(getUiScale()*125)+'%';}));
  await check(`${w}x${h} ${percent}%: item dialog closes within viewport`,async()=>{await page.evaluate(()=>{gainItem('wpn_shortbow',1,true,true);openModal(player.inv.find(i=>i.id==='wpn_shortbow'),false);window.__scaleModalOpenedAt=Date.now();});const ok=await page.evaluate(()=>{const r=document.getElementById('item-modal').getBoundingClientRect(),b=document.querySelector('#item-modal button[onclick="closeModal()"]').getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1 && b.bottom<=innerHeight+1;});await page.waitForFunction(()=>Date.now()-__scaleModalOpenedAt>=450);await page.click('#item-modal button[onclick="closeModal()"]');await page.waitForFunction(()=>document.getElementById('item-modal').classList.contains('hidden'));return ok;});
  await check(`${w}x${h} ${percent}%: equipment keeps artwork ratio and tab access`,async()=>{await clickTab('[onclick="switchTab(\'equip\', this)"]');const ok=await page.evaluate(()=>{const r=document.getElementById('equipment-window-frame').getBoundingClientRect(),p=document.getElementById('tab-content-panel').getBoundingClientRect();return r.height>=r.width*4/3-1 && r.left>=p.left-1 && r.right<=p.right+1 && document.getElementById('equipment-window').scrollWidth<=document.getElementById('equipment-window').clientWidth+1 && [...document.querySelectorAll('#equipment-window-slots .equipment-visual-slot')].every(s=>s.getBoundingClientRect().width>0&&Math.abs(s.getBoundingClientRect().width-r.width*.16)<1);});await clickTab('#btn-automation');return ok;});
 }
}
await viewport(1330,759);await page.evaluate(()=>setUiScale(75));
await check('VFX anchor coordinates remain aligned while UI is scaled',()=>page.evaluate(()=>{const host=_vfxLayer();const dot=document.createElement('div');dot.style.cssText='position:fixed;left:240px;top:180px;width:1px;height:1px';host.appendChild(dot);const r=dot.getBoundingClientRect();dot.remove();return Math.abs(r.left-240)<1 && Math.abs(r.top-180)<1;}));
await check('custom dropdown aligns with its scaled trigger',()=>page.evaluate(()=>{const select=document.getElementById('set-pot');openCustomSelectPopup(select);const popup=document.getElementById('cdd-pop'),r=select.getBoundingClientRect(),p=popup.getBoundingClientRect();const ok=Math.abs(p.left-r.left)<2 && Math.abs(p.width-r.width)<4 && p.right<=innerWidth+1 && p.bottom<=innerHeight+1;_cddClose();return ok;}));
await check('tooltip follows pointer in screen coordinates',()=>page.evaluate(()=>{const el=_pandoraTipEl();el.textContent='合成物品說明';el.style.display='block';pandoraTipMove({clientX:250,clientY:200});const r=el.getBoundingClientRect();el.style.display='none';return Math.abs(r.left-264)<2 && Math.abs(r.top-212)<2;}));
await check('warehouse drag follows pointer while scaled',()=>page.evaluate(()=>{openWarehouseWindow();const frame=document.getElementById('warehouse-window-frame'),handle=document.getElementById('warehouse-window-drag'),r=frame.getBoundingClientRect();handle.setPointerCapture=()=>{};handle.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,clientX:r.left+50,clientY:r.top+20,bubbles:true}));handle.dispatchEvent(new PointerEvent('pointermove',{pointerId:99,clientX:r.left+70,clientY:r.top+40,bubbles:true}));handle.dispatchEvent(new PointerEvent('pointerup',{pointerId:99,bubbles:true}));const after=frame.getBoundingClientRect();closeWarehouseWindow();return Math.abs(after.left-r.left-20)<2 && Math.abs(after.top-r.top-20)<2;}));
await page.click('#btn-automation');if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/ui-scale-75.png'});
await check('reset button restores the current appearance labeled 100%',async()=>{await page.click('#btn-ui-scale-reset');return page.evaluate(()=>getUiScale()===.8 && document.getElementById('set-ui-scale').value==='100' && __testData.lineage_ui_scale==='80');});
await page.evaluate(()=>setUiScale(65));const seed=await page.evaluate(()=>({...__testData}));await boot(seed);
await check('preference reloads before entering a character',()=>page.evaluate(()=>getUiScale()===.65 && !state.running && _roleReadSavePlayer(1)?.cls==='mage'));
await check('home actions stay in viewport at stored scale',()=>page.evaluate(()=>[...document.querySelectorAll('#main-menu > button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight;})));
await check('write failure is visible; current scale remains applied',()=>page.evaluate(()=>{__failWrites=true;const ok=setUiScale(90)===false && getUiScale()===.9 && document.getElementById('ui-scale-status').textContent.includes('未儲存');__failWrites=false;return ok && setUiScale(90)===true;}));
await boot({lineage_ui_scale:'100'});await check('existing device migrates once to 80%',()=>page.evaluate(()=>getUiScale()===.8 && __testData.lineage_ui_scale==='80' && __testData.lineage_ui_scale_80_v1==='1'));
await page.evaluate(()=>setUiScale(70));await boot(await page.evaluate(()=>({...__testData})));await check('migration does not overwrite later choices',()=>page.evaluate(()=>getUiScale()===.7));
await boot({lineage_ui_scale:'bad',lineage_ui_scale_80_v1:'1'});await check('invalid saved preference uses 80%',()=>page.evaluate(()=>getUiScale()===.8));
await check('invalid input restores 80%',()=>page.evaluate(()=>{setUiScale('bad');return getUiScale()===.8;}));
await check('values outside supported range are clamped',()=>page.evaluate(()=>{setUiScale(999);const top=getUiScale()===1;setUiScale(1);return top && getUiScale()===.6;}));
await boot({lineage_ui_scale:'100'},false,'lineage_ui_scale');await check('failed initial migration applies 80 but does not mark completion',()=>page.evaluate(()=>getUiScale()===.8&&!__testData.lineage_ui_scale_80_v1&&document.getElementById('ui-scale-status').textContent.includes('未儲存')));
await boot(await page.evaluate(()=>({...__testData})));await check('failed migration retries on reload',()=>page.evaluate(()=>getUiScale()===.8&&__testData.lineage_ui_scale_80_v1==='1'));
await boot({lineage_ui_scale:'100'},false,'lineage_ui_scale_80_v1');await check('failed migration marker remains retryable and visible',()=>page.evaluate(()=>getUiScale()===.8&&!__testData.lineage_ui_scale_80_v1&&document.getElementById('ui-scale-status').textContent.includes('未儲存')));
await boot({},true);await check('desktop storage bridge saves and reloads scale',()=>page.evaluate(()=>setUiScale(80)===true && __testData.lineage_ui_scale==='80'));
const desktopSeed=await page.evaluate(()=>({...__testData}));await boot(desktopSeed,true);await check('desktop stored scale applies',()=>page.evaluate(()=>getUiScale()===.8));
await check('no browser runtime errors',()=>page.evaluate(()=>__errors.length===0 || __errors));
await fs.writeFile(options.artifacts+'/ui-scale-report-'+options.protocol+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});if(!options.keepSpace)await task.finish({keep:[]});
if(reports.some(r=>r.status==='FAIL'))throw Error('UI scale E2E failed');

})();
