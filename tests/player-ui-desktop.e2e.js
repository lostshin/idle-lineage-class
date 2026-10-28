// Desktop preservation: compare current and original CSS on the same synthetic native UI.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto'),cp=await import('node:child_process');
const task=await taskSpace(options.space ?? '桌機版面保持驗證'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const f of ['index.html','css/responsive.css','css/floating-ui.css','js/20-warehouse-window.js','css/mobile-mode.css','js/addon-mobile-bridge.js','js/addon-switches.js','js/addon-settings.js','tests/player-ui-desktop.e2e.js'])sources[f]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+f)).digest('hex');
const originalCss=cp.execFileSync('git',['show','HEAD:css/responsive.css'],{cwd:options.root,encoding:'utf8'});
sources.originalResponsiveCss=crypto.createHash('sha256').update(originalCss).digest('hex');
async function check(name,fn){try{const r=await fn();reports.push({name,status:r===true?'PASS':'FAIL',detail:r===true?undefined:r});}catch(e){reports.push({name,status:'FAIL',detail:String(e)});}await fs.writeFile(options.artifacts+'/player-ui-desktop-'+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; native desktop UI; isolated synthetic storage and blocked public lobby; same document alternates original/current responsive CSS in the original cascade position; geometry and computed-style comparison, not screenshot pixel equality',sources,reports},null,2));}
let init;
for(const mobile of options.mobileOptions ?? [false]){
 if(init)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
 init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={lineage_optional_addons_v1:JSON.stringify({v:1,enabled:{mobile:${mobile}}})};const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;window.__desktopErrors=[];addEventListener('error',e=>__desktopErrors.push(e.message));const f=fetch;window.fetch=(u,...a)=>String(u).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public lobby')):f(u,...a);})();`})).identifier;
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(options.url+'?desktop-preservation='+mobile);await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
 await page.evaluate(originalCss=>{
  _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_knight');document.getElementById('creation-name').value='合成桌機保護';startGame();stopGameTimers();state.running=false;player.lv=80;player.gold=1e8;player.autoSellOn=false;
  const gear=(id,uid,en=0)=>({id,uid,en,cnt:1,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false});player.eq={wpn:gear('wpn_11','desktop-equipped')};player.inv=Array.from({length:30},(_,i)=>gear('wpn_katana','desktop-item-'+i,i%8));calcStats();saveGame();
  const doc=JSON.parse(saveStateJson());Object.assign(doc.p,{name:'桌機隊友',enSeed:'desktop-ally',_roleEpoch:'desktop-ally',allies:[],inv:[],eq:{wpn:gear('wpn_11','desktop-ally-weapon')}});_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));player.allies=[buildAlly('2')];renderSquadPanel();
  const link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(e=>e.href.includes('/css/responsive.css'));const baseline=document.createElement('style');baseline.textContent=originalCss;baseline.disabled=true;link.before(baseline);window.__desktopStyles={link,baseline};
  window.__desktopTab=t=>switchTab(t,document.querySelector('[onclick="switchTab(\''+t+'\', this)"]'));
  window.__desktopSample=selectors=>selectors.flatMap(s=>[...document.querySelectorAll(s)].filter(e=>e.checkVisibility()).map((e,i)=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{selector:s,index:i,rect:[r.x,r.y,r.width,r.height],style:[c.display,c.position,c.fontSize,c.gridTemplateColumns,c.flexDirection,c.overflowX,c.overflowY,c.backgroundImage,c.borderImageSource]};}));
 },originalCss);
 for(const width of [1330,1920])for(const scale of [60,75,80,100])for(const [left,right]of [[220,300],[300,460]]){
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate(([scale,left,right])=>{setUiScale(scale);document.getElementById('game-screen').style.setProperty('--game-left-width',left+'px');document.getElementById('game-screen').style.setProperty('--game-right-width',right+'px');},[scale,left,right]);
  for(const view of ['stats','weapons','equip','item','warehouse','guild']){
   await page.evaluate(view=>{closeModal();closeWarehouseWindow();guildWindow.close();if(view==='item'){__desktopTab('weapons');openModal(player.inv[0],false);}else if(view==='warehouse')openWarehouseWindow();else if(view==='guild'){guildWindow.open();openAllyEquipmentManager('2');}else __desktopTab(view);},view);
   const selectors=['#game-screen','#col-left','#col-center','#col-right','#tab-content-panel','#log-row',view==='stats'?'#tab-stats .ability-window-shell':view==='weapons'?'#tab-weapons .classic-inventory-shell':view==='equip'?'#equipment-window-frame':view==='item'?'#item-modal > div':view==='warehouse'?'#warehouse-window-frame':'#guild-window-frame'];
   const samples=[];
   for(const original of [true,false]){
    await page.evaluate(original=>{__desktopStyles.link.disabled=original;__desktopStyles.baseline.disabled=!original;},original);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));samples.push(await page.evaluate(selectors=>__desktopSample(selectors),selectors));
   }
   await check(`${mobile?'mobile-option-on':'mobile-option-off'} ${width}px ${scale}% ${left}/${right} ${view}: desktop matches original CSS`,()=>{
    if(samples[0].length!==samples[1].length)return{before:samples[0],after:samples[1]};
    const differences=samples[0].flatMap((a,i)=>{const b=samples[1][i];return a.selector!==b.selector||JSON.stringify(a.style)!==JSON.stringify(b.style)||a.rect.some((n,j)=>Math.abs(n-b.rect[j])>.75)?[{before:a,after:b}]:[];});return !differences.length||differences;
   });
  }
 }
 await check(`${mobile?'on':'off'}: desktop remains outside mobile mode without runtime errors`,()=>page.evaluate(()=>!document.body.classList.contains('m-mobile')&&!__desktopErrors.length||{mobile:document.body.classList.contains('m-mobile'),errors:__desktopErrors}));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').map(r=>r.name)});
if(reports.some(r=>r.status==='FAIL'))throw Error('Desktop layout changed');if(!options.keepSpace)await task.finish({keep:[]});
