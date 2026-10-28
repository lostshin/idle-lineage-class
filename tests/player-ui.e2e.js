// Player reports: native guild hover, NPC drag, offline log and touch-mode windows.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space ?? '玩家介面與手機回報'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const f of ['index.html','css/responsive.css','css/floating-ui.css','js/14-craft-pandora.js','js/20-warehouse-window.js','js/27-offline-rewards.js','js/addon-mobile-bridge.js','tests/player-ui.e2e.js'])sources[f]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+f)).digest('hex');
async function check(name,fn){try{const detail=await fn();reports.push({name,status:detail===true?'PASS':'FAIL',detail:detail===true?undefined:detail});}catch(e){reports.push({name,status:'FAIL',detail:String(e)});}await fs.writeFile(options.artifacts+'/player-ui-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; isolated synthetic storage and blocked public lobby; CDP touch/device emulation, native mouse and touch input; no physical phone',sources,reports},null,2));}
const seed={lineage_optional_addons_v1:JSON.stringify({v:1,enabled:{mobile:true}})};
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data=${JSON.stringify(seed)};window.__uiData=data;window.__uiErrors=[];const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;const f=fetch;window.fetch=(u,...a)=>String(u).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public lobby')):f(u,...a);addEventListener('error',e=>__uiErrors.push(e.message));})();`})).identifier;
async function viewport(width,height,touch){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:2});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function tap(selector){const r=await page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},selector);await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
await viewport(1330,900,false);await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(options.url+'?player-ui');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
 _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_knight');document.getElementById('creation-name').value='合成介面隊長';startGame();stopGameTimers();state.running=false;setUiScale(100);player.lv=80;player.gold=1e8;player.autoSellOn=false;
 window.__uiGear=(id,uid,en=0,cnt=1)=>({id,uid,en,cnt,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false});
 player.eq={wpn:__uiGear('wpn_11','ui-equipped')};player.inv=[__uiGear('wpn_katana','ui-candidate',7),__uiGear('sherine_crystal','ui-crystal',0,5)];calcStats();saveGame();
 const doc=JSON.parse(saveStateJson());Object.assign(doc.p,{name:'合成隊友',enSeed:'ui-ally',_roleEpoch:'ui-ally',allies:[],inv:[],eq:{wpn:__uiGear('wpn_11','ui-ally-equipped')}});_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));player.allies=[buildAlly('2')];
 const nativeOpen=openModal;openModal=function(...args){const r=nativeOpen(...args);window.__uiOpened=performance.now();return r;};
 window.__uiTab=t=>switchTab(t,document.querySelector('[onclick="switchTab(\''+t+'\', this)"]'));
 window.__uiRect=e=>e.getBoundingClientRect();window.__uiOverlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 window.__uiFont=e=>parseFloat(getComputedStyle(e).fontSize)*getUiScale();
 window.__uiBounds=(e,bottom=innerHeight)=>{const r=__uiRect(e);return r.width>0&&r.left>=-1&&r.right<=document.documentElement.clientWidth+1&&r.top>=-1&&r.bottom<=bottom+1;};
 guildWindow.open();openAllyEquipmentManager('2');
});
await page.click('[data-guild-item="ui-candidate"]');
for(const width of [1330,1920])for(const scale of [60,75,80,100]){
 await viewport(width,900,false);await page.evaluate(s=>setUiScale(s),scale);await settle();await page.hover('[data-guild-item="ui-candidate"]');
 await check(`${width}/${scale}: guild item tooltip leaves comparison readable`,()=>page.evaluate(()=>{const tip=[...document.querySelectorAll('.game-tooltip')].find(e=>e.style.display==='block'),compare=document.getElementById('guild-comparison');if(!tip)return 'missing tooltip';return (__uiBounds(tip)&&__uiOverlap(__uiRect(tip),__uiRect(compare))<1)||{tip:__uiRect(tip).toJSON(),compare:__uiRect(compare).toJSON()};}));
}
await page.evaluate(()=>{guildWindow.close();setUiScale(100);const town=Object.keys(DB.towns).find(k=>DB.towns[k].npcs.some(n=>n.id==='npc_io'));setMapSelectors(town);changeMap(true);interactNPC('npc_io',town);});await settle();
const before=await page.evaluate(()=>({r:__uiRect(document.getElementById('town-interaction-container')).toJSON(),inv:JSON.stringify(player.inv),gold:player.gold}));
const h=await page.evaluate(()=>{const r=__uiRect(document.getElementById('town-interaction-heading'));return{x:r.x+r.width/2,y:r.y+r.height/2};});
await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x-120,h.y+50);await page.mouse.up();
await check('Io exchange title drags the window without spending crystals or gold',()=>page.evaluate(before=>{const r=__uiRect(document.getElementById('town-interaction-container'));return (r.x<before.r.x-80&&r.y>before.r.y+20&&JSON.stringify(player.inv)===before.inv&&player.gold===before.gold)||{before:before.r,after:r.toJSON()};},before));
await viewport(1330,700,false);await check('dragged NPC window stays within a resized viewport',()=>page.evaluate(()=>__uiBounds(document.getElementById('town-interaction-container'))));
await page.evaluate(()=>{closeNpcInteraction();setUiScale(80);state.running=true;setMapSelectors('training');changeMap(true);const oldNow=Date.now;window.__uiNow=oldNow();Date.now=()=>__uiNow;for(let i=0;i<3;i++){if(i)__uiNow+=8000;mapState.mobs[0]={...DB.mobs.orc,uid:'ui-sample-'+i,curHp:0,st:newMobStatus()};killMob(0);}saveGame();Date.now=oldNow;stopGameTimers();state.running=false;window.__uiOfflineSeed={...__uiData};});
// Native reload settlement with a guaranteed synthetic special-item drop table.
await page.evaluate(()=>{const oldNow=Date.now;Date.now=()=>__uiNow+3600000;MOB_DROPS[DB.mobs.orc.n]=[['sherine_crystal',100],['panacea_str',100]];currentSlot=1;loadGame();window.__uiRestoreClock=oldNow;});
await page.waitForFunction(()=>document.getElementById('sys-log').textContent.includes('離線戰利品'));await page.evaluate(()=>{Date.now=__uiRestoreClock;stopGameTimers();state.running=false;});
await check('offline loot inherits native log typography and keeps name colors',()=>page.evaluate(()=>{const e=[...document.querySelectorAll('#sys-log .sys-item-gain')].find(e=>e.textContent.includes('離線戰利品')),style=getComputedStyle(e),parent=getComputedStyle(e.parentElement);return (style.fontSize===parent.fontSize&&style.lineHeight===parent.lineHeight&&!!e.querySelector('span.c-sherine'))||{font:style.fontSize,lineHeight:style.lineHeight,parentFont:parent.fontSize,parentLineHeight:parent.lineHeight,html:e.outerHTML};}));
await page.evaluate(()=>{player.inv=[__uiGear('wpn_katana','ui-candidate',7),__uiGear('sherine_crystal','ui-crystal',0,5)];player.eq={wpn:__uiGear('wpn_11','ui-equipped')};calcStats();renderTabs(true);});
for(const [width,height]of [[360,640],[390,844],[844,390],[900,900]])for(const scale of [60,80,100]){
 await viewport(width,height,true);await page.waitForFunction(()=>document.body.classList.contains('m-mobile')&&!!document.getElementById('m-nav'));await page.evaluate(s=>{closeModal();closeWarehouseWindow();setUiScale(s);stopGameTimers();state.running=false;},scale);await settle();
 await page.click('#m-nav [data-view="right"]');await page.evaluate(()=>{__uiTab('stats');updateUI();});await settle();
 await check(`${width}x${height}/${scale}: mobile ability text is readable in its own scroll area`,()=>page.evaluate(()=>{const t=document.querySelector('#tab-stats [data-ability-field="mdmg"] [data-ability-total]');return (__uiFont(t)>=13.9&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)||{font:__uiFont(t),page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};}));
 await page.evaluate(()=>{__uiTab('weapons');renderTabs(true);});await settle();
 await check(`${width}x${height}/${scale}: inventory icons retain 55 screen px`,()=>page.evaluate(()=>{const r=__uiRect(document.querySelector('#tab-weapons [data-inventory-uid="ui-candidate"]'));return (r.width>=54.9&&r.height>=54.9)||r.toJSON();}));
 await page.evaluate(()=>openModal(player.inv.find(i=>i.uid==='ui-candidate'),false));await page.waitForFunction(()=>performance.now()-__uiOpened>=450);await settle();
 await check(`${width}x${height}/${scale}: both item windows and close controls fit above navigation`,()=>page.evaluate(()=>{const bottom=__uiRect(document.getElementById('m-nav')).top,els=['modal-compare','modal-item-window'].map(id=>document.getElementById(id));return els.every(e=>__uiBounds(e,bottom)&&__uiBounds(e.querySelector('.item-modal-close'),bottom))&&__uiOverlap(...els.map(__uiRect))<1||els.map(e=>__uiRect(e).toJSON());}));
 const body='#modal-item-window .item-modal-body';await page.evaluate(s=>{const e=document.querySelector(s);e.scrollTop=e.scrollHeight;},body);await settle();
 await check(`${width}x${height}/${scale}: item actions can scroll fully into view without overlapping description`,()=>page.evaluate(()=>{const body=document.querySelector('#modal-item-window .item-modal-body'),actions=document.getElementById('modal-actions'),last=actions.lastElementChild,r=__uiRect(last),b=__uiRect(body),desc=__uiRect(document.getElementById('modal-item-desc'));return (r.bottom<=b.bottom+1&&r.top>=b.top-1&&__uiRect(actions).top>=desc.bottom-1)||{last:r.toJSON(),body:b.toJSON(),actions:__uiRect(actions).toJSON(),desc:desc.toJSON()};}));
 await check(`${width}x${height}/${scale}: touch X is above the HUD and closes both windows`,async()=>{
  const hit=await page.evaluate(()=>{const b=document.querySelector('#modal-item-window .item-modal-close'),r=__uiRect(b);return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
  if(!hit){await page.evaluate(()=>closeModal());return 'close control is covered';}
  await tap('#modal-item-window .item-modal-close');await page.waitForFunction(()=>document.getElementById('item-modal').classList.contains('hidden'));
  return page.evaluate(()=>!document.body.classList.contains('m-stat-open'));
 });
 await page.evaluate(()=>openWarehouseWindow());await settle();
 await check(`${width}x${height}/${scale}: warehouse labels remain at least 14 screen px and fit`,()=>page.evaluate(()=>{const e=document.querySelector('#warehouse-window .wh-name'),bottom=__uiRect(document.getElementById('m-nav')).top;return (__uiFont(e)>=13.9&&__uiBounds(document.getElementById('warehouse-window-frame'),bottom))||{font:__uiFont(e),frame:__uiRect(document.getElementById('warehouse-window-frame')).toJSON(),bottom};}));
 await page.click('#warehouse-window-close');await page.click('#m-nav [data-view="log"]');await settle();
 await check(`${width}x${height}/${scale}: log has readable text and a usable scroll viewport`,()=>page.evaluate(()=>{const e=document.getElementById('sys-log'),r=__uiRect(e),sheet=document.getElementById('m-log-sheet');return (r.height>=Math.min(140,innerHeight*.25)&&__uiBounds(sheet,__uiRect(document.getElementById('m-nav')).top))||{log:r.toJSON(),sheet:__uiRect(sheet).toJSON()};}));
 await page.click('#m-log-close');
}
await viewport(390,844,true);await page.evaluate(()=>{closeModal();closeWarehouseWindow();setUiScale(80);});await page.click('#m-nav [data-view="right"]');await page.evaluate(()=>{__uiTab('weapons');renderTabs(true);});await settle();
await check('mobile option enables no-double-zoom rules and preserves pinch zoom',()=>page.evaluate(()=>!!document.getElementById('afk-nozoom-style')&&getComputedStyle(document.querySelector('#tab-weapons [data-inventory-uid="ui-candidate"]')).touchAction==='manipulation'&&!document.querySelector('meta[name="viewport"]').content.includes('user-scalable=no')));
await check('no browser runtime errors',()=>page.evaluate(()=>!__uiErrors.length||__uiErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').map(r=>r.name)});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Player UI regressions');if(!options.keepSpace)await task.finish({keep:[]});
