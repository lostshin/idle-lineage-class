// All browser storage is synthetic; personal characters and iCloud files are never used.
const fs=await import('node:fs/promises');
const task=await taskSpace(options.space || '天堂原版 RWD 驗證');
console.log({spaceId:task.spaceId});
const page=task.page(options.page || 'p1');
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
let initId;
const reports=[];
async function boot(url,seed={}){
 if(initId)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});
 const token=String(Date.now())+Math.random();
 initId=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__bootToken=${JSON.stringify(token)};const data=${JSON.stringify(seed)};window.__testData=data;window.__errors=[];const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});Object.defineProperty(window,'sessionStorage',{value:{...storage},configurable:true});window.addEventListener('error',e=>__errors.push(e.message));})();`})).identifier;
 await page.goto(url+'?rwd-test='+token);
 await page.waitForFunction(t=>window.__bootToken===t && document.readyState==='complete' && typeof startGame==='function',token);
}
async function viewport(width,height){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=1024});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:width<=1024,maxTouchPoints:1});}
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}}
async function bounds(ids){return page.evaluate(ids=>{const errors=[];for(const id of ids){const e=document.getElementById(id);if(!e || !e.getClientRects().length)continue;const r=e.getBoundingClientRect();if(r.left < -1 || r.right > innerWidth+1)errors.push({id,left:r.left,right:r.right,viewport:innerWidth});}return errors.length?errors:true;},ids);}
const sizes=[[320,640],[390,844],[768,1024],[844,390],[1024,768],[1199,800],[1330,759],[1440,900],[1920,1080]];
await boot(options.url);
for(const [w,h] of sizes){if(options.desktopOnly&&w<1200)continue;
 await viewport(w,h);await check(`${w}x${h}: home actions fit horizontally`,()=>bounds(['main-menu','btn-start-menu','btn-vfx-toggle','btn-vfxnum-toggle']));await check(`${w}x${h}: touch home actions remain tappable`,()=>page.evaluate(()=>!matchMedia('(pointer: coarse)').matches || [...document.querySelectorAll('#main-menu > button')].every(e=>e.getBoundingClientRect().height>=44)));
 for(const scale of [100,75]){
  await page.evaluate(v=>setUiScale(v),scale);
  await check(`${w}x${h} ${scale}%: home artwork keeps its viewport size and ratio`,()=>page.evaluate(()=>{
   const r=document.getElementById('login-art-stage').getBoundingClientRect(),portrait=matchMedia('(max-width:600px) and (orientation:portrait)').matches;
   const width=portrait?innerWidth:Math.min(innerWidth,innerHeight*4/3),height=portrait?Math.max(640*getUiScale(),innerHeight):width*3/4;
   return Math.abs(r.width-width)<2 && Math.abs(r.height-height)<2 || {actual:{width:r.width,height:r.height},expected:{width,height}};
  }));
  await check(`${w}x${h} ${scale}%: credits align in three columns without clipped text`,()=>page.evaluate(()=>{
   const credits=document.getElementById('login-credits'),r=credits.getBoundingClientRect(),cells=[...credits.children],errors=[];
   if(cells.length!==9 || r.left<0 || r.right>innerWidth+1)errors.push('credits missing or outside viewport');
   cells.forEach((cell,i)=>{const c=cell.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(cell);if([...range.getClientRects()].some(t=>t.left<r.left-1 || t.right>r.right+1 || t.top<r.top-1 || t.bottom>r.bottom+1))errors.push({text:cell.textContent,reason:'text outside credits'});if(i>=3 && Math.abs(c.left-cells[i%3].getBoundingClientRect().left)>1)errors.push({text:cell.textContent,reason:'column misaligned'});});
   return errors.length?errors:true;
  }));
 }
 await page.evaluate(()=>setUiScale(100));
}
await viewport(options.desktopOnly?1330:390,options.desktopOnly?900:844);await page.click('#btn-start-menu');
await check('character slots and actions fit',()=>bounds(['load-art-stage','load-slot-grid','load-action-panel']));
await check('selection page removes per-role transfer and keeps account transfer available',()=>page.evaluate(()=>!document.getElementById('load-btn-import') && !document.getElementById('load-btn-export') && ['load-btn-account-import','load-btn-account-export'].every(id=>!!document.getElementById(id)?.getClientRects().length)));
await page.click('#load-btn-create');await page.click('#btn-class-base-mage');
await check('creation controls fit',()=>bounds(['creation-class-list','stat-allocation','creation-gender-panel','btn-start']));
await page.evaluate(()=>{
 currentSlot=1;selectClass('m_mage');document.getElementById('creation-name').value='合成測試角色';startGame();stopGameTimers();state.running=false;
 player.lv=60;player.skills=[...new Set([...Object.keys(DB.skills).filter(s=>DB.skills[s].type==='buff' && !DB.skills[s].procOnly).slice(0,24),'sk_summon','sk_zombie','sk_heal1'])];player.grantedSkills=[];calcStats();renderSkillSelects();updateUI();
});
for(const [w,h] of sizes){if(options.desktopOnly&&w<1200)continue;
 await page.evaluate(()=>{player.skills=[...new Set([...Object.keys(DB.skills).filter(s=>DB.skills[s].type==='buff' && !DB.skills[s].procOnly).slice(0,24),'sk_summon','sk_zombie','sk_heal1'])];player.grantedSkills=[];renderSkillSelects();});
 await viewport(w,h);await check(`${w}x${h}: settings button is reachable`,async()=>{await page.click('#btn-automation');return true;});
 await page.evaluate(()=>{if(document.getElementById('tab-automation').classList.contains('hidden'))switchTab('automation',document.getElementById('btn-automation'));});
 await check(`${w}x${h}: mobile vitals remain visible`,()=>page.evaluate(()=>{const e=document.getElementById('mobile-vitals');if(!e.getClientRects().length)return true;const r=e.getBoundingClientRect();return r.top>=-1 && r.top<=80 && r.bottom<=innerHeight;}));
 await check(`${w}x${h}: game columns fit horizontally`,()=>bounds(['col-left','col-center','col-right','map-view-panel','tab-content-panel']));
 await check(`${w}x${h}: map and logs stay inside their column`,()=>page.evaluate(()=>{const parent=document.getElementById('col-center').getBoundingClientRect();const children=['map-view-panel','log-row'].map(id=>document.getElementById(id).getBoundingClientRect());return parent.height>100 && children.every(r=>r.top>=parent.top-1 && r.bottom<=parent.bottom+1);}));
 await check(`${w}x${h}: map and lower panels do not overlap`,()=>page.evaluate(()=>{const map=document.getElementById('col-center').getBoundingClientRect(),left=document.getElementById('col-left').getBoundingClientRect(),right=document.getElementById('col-right').getBoundingClientRect();return innerWidth>=1200 || (innerWidth<=768 ? map.bottom<=left.top+1 && left.bottom<=right.top+1 : map.bottom<=Math.min(left.top,right.top)+1);}));
 await check(`${w}x${h}: setting labels remain readable`,()=>page.evaluate(()=>{
  const errors=[];
  for(const id of ['set-sfx-on','set-bgm-on']){const label=document.getElementById(id).closest('label'),text=label.querySelector('span');if(!text)continue;const range=document.createRange();range.selectNodeContents(text);const lines=new Set([...range.getClientRects()].map(r=>Math.round(r.top)));if(lines.size>1)errors.push({id,lines:lines.size,width:text.getBoundingClientRect().width});}
  if(document.querySelectorAll('#auto-buff-skills > label').length<6)errors.push({error:'Synthetic skill list missing'});
  for(const label of document.querySelectorAll('#auto-buff-skills > label')){const text=label.querySelector('span');if(text){const r=text.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(text);if([...range.getClientRects()].some(t=>t.left<r.left-1||t.right>r.right+1)||getComputedStyle(label).whiteSpace!=='nowrap')errors.push({skill:text.textContent,width:r.width});}}
  return errors.length?errors.slice(0,5):true;
 }));
 await check(`${w}x${h}: class-only potion rows stay hidden`,()=>page.evaluate(()=>!document.getElementById('ui-brave-row').getClientRects().length && !document.getElementById('ui-elfcookie-row').getClientRects().length && !!document.getElementById('ui-cautious-row').getClientRects().length));
 await check(`${w}x${h}: percentage controls stay together`,()=>page.evaluate(()=>{
  const errors=[];for(const id of ['set-hp-pot','set-mp-atk','set-mp-heal','set-hp-skill','set-hp-convert']){const input=document.getElementById(id);if(!input.getClientRects().length)continue;const parent=input.parentElement;const before=[...parent.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());if(!before)continue;const range=document.createRange();range.selectNode(before);const r=range.getBoundingClientRect(),i=input.getBoundingClientRect();if(Math.abs((r.top+r.height/2)-(i.top+i.height/2))>6)errors.push({id,textCenter:r.top+r.height/2,inputCenter:i.top+i.height/2});}return errors.length?errors:true;
 }));
 await check(`${w}x${h}: settings have no horizontal overflow`,()=>page.evaluate(()=>{const t=document.getElementById('tab-automation');return t.scrollWidth<=t.clientWidth+1;}));
 await check(`${w}x${h}: ability button is reachable`,async()=>{await page.click('button[title="查看角色能力"]');return true;});
 await page.evaluate(()=>{if(document.getElementById('tab-stats').classList.contains('hidden'))switchTab('stats',document.querySelector('button[title="查看角色能力"]'));});
 await check(`${w}x${h}: ability window fits its tab`,()=>page.evaluate(()=>{const e=document.querySelector('.ability-window-shell'),t=document.getElementById('tab-stats');return !!e && e.getBoundingClientRect().width<=t.clientWidth+1;}));
 for(const tab of ['skill','items','weapons','armors','equip','audit','clan','pvp']){
  await check(`${w}x${h}: ${tab} tab fits`,async()=>{await page.click(`#col-right > .tab-bar [onclick^="switchTab('${tab}'"]`);return page.evaluate(tab=>{const el=document.getElementById('tab-'+tab);if(tab==='equip'){const r=document.getElementById('equipment-window-frame').getBoundingClientRect(),p=document.getElementById('tab-content-panel').getBoundingClientRect();if(r.left<p.left-1 || r.right>p.right+1 || r.top<p.top-1 || r.height<r.width*4/3-1 || document.getElementById('equipment-window').scrollWidth>document.getElementById('equipment-window').clientWidth+1 || [...document.querySelectorAll('#equipment-window-slots .equipment-visual-slot')].some(s=>Math.abs(s.getBoundingClientRect().width-r.width*.16)>1))return false;}return !el.classList.contains('hidden') && el.scrollWidth<=el.clientWidth+1;},tab);});
 }
 await check(`${w}x${h}: item dialog fits and close is reachable`,()=>page.evaluate(()=>{
  gainItem('wpn_shortbow',1,true,true);const item=player.inv.find(i=>i.id==='wpn_shortbow');openModal(item,false);
  const el=document.getElementById('item-modal'),r=el.getBoundingClientRect();const close=el.querySelector('button[onclick="closeModal()"]'),b=close.getBoundingClientRect();
  const ok=r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1 && b.top>=0 && b.bottom<=innerHeight+1;closeModal();return ok;
 }));
 await check(`${w}x${h}: warehouse fits and close is reachable`,()=>page.evaluate(()=>{openWarehouseWindow();const r=document.getElementById('warehouse-window-frame').getBoundingClientRect(),b=document.getElementById('warehouse-window-close').getBoundingClientRect();const ok=r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1 && b.bottom<=innerHeight+1;closeWarehouseWindow();return ok;}));
 await check(`${w}x${h}: collection dialog fits`,()=>page.evaluate(()=>{openCollectionPanel();const r=document.getElementById('collection-panel').firstElementChild.getBoundingClientRect();const ok=r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1;closeCollectionPanel();return ok;}));
}
await viewport(1330,759);await page.click('#btn-automation');
await check('leaving equipment hides its canvas and releases settings controls',()=>page.evaluate(()=>getComputedStyle(document.getElementById('equipment-window')).display==='none'&&document.getElementById('equipment-window').getClientRects().length===0));
await page.fill('#set-hp-pot','37');await page.click('#set-auto-buy-pot');
await check('settings edits save and reload',async()=>{const seed=await page.evaluate(()=>{if(!saveGame())return null;return {...__testData};});if(!seed)return false;await boot(options.url,seed);return page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();state.running=false;return document.getElementById('set-hp-pot').value==='37';});});
await check('no browser runtime errors',()=>page.evaluate(()=>__errors.length===0 || __errors));
await boot('file://'+options.root+'/index.html');
await check('file URL: original settings and game load',()=>page.evaluate(()=>{selectClass('m_mage');document.getElementById('creation-name').value='合成測試角色';startGame();stopGameTimers();state.running=false;switchTab('automation',document.getElementById('btn-automation'));return !document.getElementById('tab-automation').classList.contains('hidden') && saveGame()===true;}));
if(!options.baseline && !options.skipScreenshots){
 await page.evaluate(()=>{player.lv=60;player.skills=[...new Set(['sk_summon','sk_zombie','sk_heal1',...Object.keys(DB.skills).filter(s=>DB.skills[s].type==='buff' && !DB.skills[s].procOnly).slice(0,18)])];player.grantedSkills=[];calcStats();renderSkillSelects();updateUI();});
 await viewport(1330,759);await page.click('#btn-automation');await page.screenshot({path:options.artifacts+'/rwd-desktop.png'});
 if(!options.desktopOnly){await page.evaluate(()=>document.getElementById('tab-automation').scrollTop=0);
 await viewport(390,844);await page.click('#btn-automation');await page.evaluate(()=>{const game=document.getElementById('game-screen');game.scrollTop+=document.getElementById('col-right').getBoundingClientRect().top-70;});await page.screenshot({path:options.artifacts+'/rwd-mobile-settings.png'});
 await page.evaluate(()=>document.getElementById('tab-automation').scrollTop=10000);await page.screenshot({path:options.artifacts+'/rwd-mobile-buffs.png'});
 await viewport(1024,768);await page.click('#btn-automation');await page.evaluate(()=>{document.getElementById('tab-automation').scrollTop=0;const game=document.getElementById('game-screen');game.scrollTop+=document.getElementById('col-right').getBoundingClientRect().top-16;});await page.screenshot({path:options.artifacts+'/rwd-tablet.png'});}
}
await fs.writeFile(options.artifacts+'/'+(options.baseline?'rwd-baseline':'rwd-report-'+options.protocol)+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});
if(!options.keepSpace)await task.finish({keep:[]});
if(!options.baseline && reports.some(r=>r.status==='FAIL'))throw Error('RWD validation failed');
