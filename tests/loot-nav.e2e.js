// Failure cases: one kill emits several item rows, counts/colors or rare dots vanish,
// batches cross kills or leak on errors, and armor navigation rebuilds unrelated tabs or interrupts scrolling.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space),page=task.page('p1'),reports=[],timings=[],sources={};console.log({spaceId:task.spaceId});
for(const file of ['index.html','js/05-kill-progression.js','js/08-items-equip.js','js/10-ui-tabs.js','tests/loot-nav.e2e.js'])sources[file]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name,fn){try{const result=await fn();if(result!==true)throw Error(JSON.stringify(result));reports.push({name,status:'PASS'});}catch(error){reports.push({name,status:'FAIL',error:String(error)});console.log({name,error:String(error)});}await fs.writeFile(options.artifacts+'/loot-nav-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser; synthetic native kills/guaranteed drops and error cleanup, live item grants during native horizontal wheel, native category/batch/search controls; synchronous category timings are not FPS',sources,reports,timings},null,2));}
async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function click(selector){await page.evaluate(selector=>{const el=document.querySelector(selector);el.focus({preventScroll:true});el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});},selector);await settle();const point=await page.evaluate(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return hit===el||el.contains(hit)?{x,y}:null;},selector);if(!point)throw Error('Control is obscured: '+selector);await page.mouse.click(point.x,point.y);await settle();}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={};window.__lootNavErrors=[];const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:s,configurable:true});window.BroadcastChannel=undefined;addEventListener('error',event=>__lootNavErrors.push(event.message));})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.goto(options.url+'?loot-nav');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
 _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_knight');document.getElementById('creation-name').value='合成掉落與滑動';startGame();stopGameTimers();state.running=false;setUiScale(80);player.lv=80;player.autoSellOn=false;player.gold=1000000;calcStats();setMapSelectors('training');changeMap(true);
 DB.items.loot_test_mat={n:'合成木棒',type:'mat',c:'text-slate-300',req:'all',w:0,p:1};DB.items.loot_test_legend={n:'合成傳說頭盔',type:'arm',slot:'helm',legend:true,c:'c-legend',req:'all',w:0,p:1,safe:4,ac:1};DB.items.loot_test_relic={n:'合成遺物',type:'mat',relic:true,c:'c-relic',req:'all',w:0,p:1};
 window.__killLoot=(drops,uid)=>{MOB_DROPS[DB.mobs.orc.n]=drops;mapState.mobs[0]={...DB.mobs.orc,uid,curHp:0,st:newMobStatus()};const random=Math.random;Math.random=()=>.5;state.inTick=true;try{killMob(0);}finally{Math.random=random;state.inTick=false;}};
 window.__lootDrops=[['loot_test_mat',100],['loot_test_mat',100],['loot_test_legend',100],['loot_test_relic',100]];
 document.getElementById('sys-log').replaceChildren();switchLogTab('sys');switchLogTab('combat');__killLoot(__lootDrops,'loot-first');
});
await check('one native kill produces one inline loot entry with separators and granted counts',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#sys-log .sys-item-gain')],text=rows.map(el=>el.textContent).join('');return rows.length===1&&text.includes('妖魔')&&['合成木棒 ×2','合成傳說頭盔 ×1','合成遺物 ×1'].every(name=>text.includes(name))&&text.includes('、')&&!rows[0].querySelector('br,div,li')&&player.inv.filter(item=>item.id==='loot_test_mat').reduce((sum,item)=>sum+item.cnt,0)===2;}));
await check('grouped loot keeps native rarity colors, glow classes and the unread rare dot',()=>page.evaluate(()=>{const row=document.querySelector('#sys-log .sys-item-gain'),legend=row?.querySelector('.c-legend'),relic=row?.querySelector('.c-relic'),dot=document.getElementById('logtab-dot-sys');return !!legend&&!!relic&&legend.classList.contains('sys-drop-rare')&&relic.classList.contains('sys-drop-rare')&&getComputedStyle(legend).color!==getComputedStyle(relic).color&&!dot.classList.contains('hidden')&&dot.classList.contains('logtab-dot-relic');}));
await page.evaluate(()=>__killLoot(__lootDrops,'loot-second'));
await check('separate kills remain separate entries with per-kill quantities',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#sys-log .sys-item-gain')];return rows.length===2&&rows.every(row=>row.textContent.includes('合成木棒 ×2'))&&player.inv.filter(item=>item.id==='loot_test_mat').reduce((sum,item)=>sum+item.cnt,0)===4;}));
await page.evaluate(()=>{__killLoot([],'loot-empty');});
await check('a kill without item drops adds no empty loot entry',()=>page.evaluate(()=>document.querySelectorAll('#sys-log .sys-item-gain').length===2));
await page.evaluate(()=>gainItem('loot_test_mat',3,false,true));
await check('noncombat grants keep their standalone message and actual inventory count',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#sys-log .sys-item-gain')];return rows.length===3&&rows[2].textContent.startsWith('獲得物品:')&&player.inv.filter(item=>item.id==='loot_test_mat').reduce((sum,item)=>sum+item.cnt,0)===7;}));
await page.evaluate(()=>{
 const original=window.rollCardDrops;window.rollCardDrops=()=>{throw Error('synthetic loot failure');};
 try{__killLoot([['loot_test_mat',100]],'loot-error');}catch(error){window.__lootExpectedError=error.message;}finally{window.rollCardDrops=original;}
 gainItem('loot_test_mat',1,false,true);
});
await check('partial grants are logged once and kill context is cleared even when a later drop hook fails',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#sys-log .sys-item-gain')];return __lootExpectedError==='synthetic loot failure'&&_lootMobInfo===null&&rows.length===5&&rows[3].textContent.includes('妖魔')&&rows[3].textContent.includes('合成木棒 ×1')&&rows[4].textContent.startsWith('獲得物品:');}));
await page.evaluate(()=>{
 player.inv=Array.from({length:1000},(_,i)=>({id:['hlm_mr','wpn_katana','potion_heal'][i%3],uid:'nav-'+i,cnt:1,en:i%10,bless:false,anc:false,attr:false,seteff:false}));calcStats();renderTabs(true);switchTab('armors',document.querySelector('[onclick="switchTab(\'armors\', this)"]'));
 window.__nav=document.querySelector('#tab-armors .backpack-category-nav');window.__strip=__nav.querySelector('.backpack-categories');window.__otherRows=['weapons','items'].map(tab=>document.querySelector('#tab-'+tab+' [data-inventory-uid]'));
});
for(const category of ['helm','all','armor','all']){
 await click('#tab-armors [data-backpack-category="'+category+'"]');
 await check(category+': category changes preserve navigation and unrelated inventory pages',()=>page.evaluate(category=>document.querySelector('#tab-armors .backpack-category-nav')===__nav&&['weapons','items'].every((tab,i)=>document.querySelector('#tab-'+tab+' [data-inventory-uid]')===__otherRows[i])&&inventoryCategories.arm===category&&document.querySelector('#tab-armors [data-backpack-category="'+category+'"]').getAttribute('aria-pressed')==='true',category));
}
for(let i=0;i<6;i++)timings.push(await page.evaluate(category=>{const t=performance.now();setInventoryCategory('arm',category);return {category,ms:performance.now()-t};},i%2?'all':'helm'));
await page.evaluate(()=>{window.__navLive={done:false};window.__navLiveTimer=setInterval(()=>{state.inTick=true;try{gainItem('potion_heal',1,true,true);}finally{state.inTick=false;}},100);});
for(const delta of [140,140,-90]){
 const point=await page.evaluate(()=>{const r=document.querySelector('#tab-armors .backpack-categories').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 await page.mouse.move(point.x,point.y);await page.mouse.wheel(delta,0);
}
await page.evaluate(()=>{clearInterval(__navLiveTimer);setTimeout(()=>__navLive.done=true,400);});await page.waitForFunction(()=>__navLive.done);await settle();
await check('native horizontal scrolling keeps the same connected category strip through background gains',()=>page.evaluate(()=>__strip.isConnected&&document.querySelector('#tab-armors .backpack-categories')===__strip&&__strip.scrollLeft>0));
await page.evaluate(()=>{window.__navLeft=document.querySelector('#tab-armors .backpack-categories').scrollLeft;renderTabs(true);});await settle();
await check('forced refresh keeps navigation identity and horizontal position',()=>page.evaluate(()=>__strip.isConnected&&document.querySelector('#tab-armors .backpack-categories')===__strip&&Math.abs(__strip.scrollLeft-__navLeft)<1));
await click('#tab-armors [data-backpack-category="helm"]');await page.fill('#afk-isearch-input','不存在的合成名稱');
await check('search still filters the selected category',()=>page.evaluate(()=>![...document.querySelectorAll('#tab-armors [data-inventory-uid]')].some(el=>getComputedStyle(el).display!=='none')));await page.fill('#afk-isearch-input','');
await click('#tab-armors [onclick="toggleQuickJunk(\'arm\')"]');
await check('reused category controls and arrows are disabled during batch operations',()=>page.evaluate(()=>[...document.querySelectorAll('#tab-armors .backpack-category-nav button')].every(button=>button.disabled)));
await page.evaluate(()=>cancelQuickJunk('arm'));
await check('leaving batch mode restores category controls',()=>page.evaluate(()=>[...document.querySelectorAll('#tab-armors .backpack-category-nav button')].every(button=>!button.disabled)));
await check('no browser runtime errors',()=>page.evaluate(()=>!__lootNavErrors.length||__lootNavErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(row=>row.status==='PASS').length,failed:reports.filter(row=>row.status==='FAIL'),timings});
if(!options.baseline&&reports.some(row=>row.status==='FAIL'))throw Error('Loot/navigation regression');if(!options.keepSpace)await task.finish({keep:[]});
