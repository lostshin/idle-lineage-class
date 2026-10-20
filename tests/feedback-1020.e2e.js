// Failure cases: preferences get compressed twice, lost rollback, curse action loses
// its red fill, stale visitors occupy seats, hidden map leaks and one-comment pagination.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'匯入與在線大廳回報'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const name of ['index.html','js/account-transfer.js','js/addon-integration.js','js/social-lobby.js','css/social-lobby.css','css/responsive.css','tests/feedback-1020.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/feedback-1020-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser; isolated synthetic storage, native account export/import buttons and real compression, native weaken action; stateful social API fixture and controlled presence timer, not public Worker E2E',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const data={};window.__feedback={data,requests:[],errors:[],mine:null,presence:null,clock:Date.now(),fail:null,timers:[]};
 const s={getItem:k=>data[k]??null,setItem:(k,v)=>{if(k===__feedback.fail)throw Error('synthetic write failure');data[k]=String(v)},removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
 for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;const inputClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'){document.getElementById('feedback-import')?.remove();this.id='feedback-import';this.hidden=true;document.body.appendChild(this);return;}return inputClick.call(this);};addEventListener('error',e=>__feedback.errors.push(e.message));
 const timeout=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===30000)__feedback.timers.push(()=>fn(...args));return timeout.call(this,fn,ms,...args);};
 const nativeFetch=window.fetch;window.fetch=async(input,options={})=>{
  if(!String(input).startsWith('https://lobby.synthetic.test'))return nativeFetch(input,options);
  const u=new URL(input),p=u.pathname,b=options.body?JSON.parse(options.body):{};__feedback.requests.push({path:p,query:u.search,method:options.method||'GET',body:b});
  const stamp=Date.now(),card={id:'00000000-0000-4000-8000-000000000002',version:1,lastSeen:stamp,currentMap:'象牙塔7樓',card:{name:'在線旅人',cls:'mage',avatar:'女法師',intro:'一起冒險',shareMap:true}};
  let value={};if(p.endsWith('/auth/guest'))value={token:'synthetic',user:{id:'00000000-0000-4000-8000-000000000001',admin:false}};
  else if(p==='/v1/presence')__feedback.presence=b;
  else if(p==='/v1/me')value={user:{id:'00000000-0000-4000-8000-000000000001',admin:false},card:__feedback.mine};
  else if(p==='/v1/me/card'){__feedback.mine={card:b.card,version:1,published:true};value={version:1};}
  else if(p.endsWith('/players'))value={players:[{id:card.id,actor:card.card,lastSeen:stamp,hasCard:true}],next:null};
  else if(p.endsWith('/cards'))value={cards:u.searchParams.get('view')==='online'?[card]:[card,{...card,id:'00000000-0000-4000-8000-000000000003',lastSeen:stamp-300000,card:{name:'離線旅人'}}],next:null};
  else if(p.endsWith('/comments'))value={comments:Array.from({length:5},(_,i)=>({id:5-i,author:'留言旅人'+i,text:'留言內容'+i,createdAt:stamp+i,canDelete:false})),next:null};
  else if(p.includes('/cards/'))value={...card,favorite:false};
  return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 };
})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?feedback-1020');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{document.getElementById('social-lobby-api').content='https://lobby.synthetic.test';_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;selectClass('m_knight');document.getElementById('creation-name').value='合成匯入旅人';startGame();stopGameTimers();state.running=false;player.autoSellOn=false;setUiScale(80);window.showSaveFilePicker=undefined;window.__feedbackRoleId=accountRoleId(player);saveGame();returnToCharacterSelect();AFK_TOGGLES.set('synccompress',true);for(const prefix of ADDON_ROLE_PREFS)localStorage.setItem(prefix+'1',prefix==='afk_bossavoid_'?JSON.stringify({training:['orc']}):'1');});
async function roundTrip(index){
 const downloadPromise=page.waitForEvent('download');await page.click('#load-btn-account-export');const download=await downloadPromise;const path=options.artifacts+'/synthetic-account-'+index+'.json';await download.saveAs(path);
 await page.click('#load-btn-account-import');await page.setInputFiles('#feedback-import',[path]);await page.waitForSelector('#account-import-confirm');await page.click('#account-import-confirm');
 await check('export/import '+index+' succeeds and keeps addon preferences in native plain storage',()=>page.evaluate(()=>document.getElementById('account-import-status').textContent.includes('已匯入')&&JSON.parse(localStorage.getItem('afk_bossavoid_1')).training[0]==='orc'&&localStorage.getItem('afk_trad_1')==='1'&&accountRoleDoc(1).p.enSeed===__feedbackRoleId));
 await page.click('#account-import-cancel');await fs.rm(path,{force:true});
}
await roundTrip(1);await page.evaluate(()=>{AFK_TOGGLES.set('synccompress',false);_getLzWorker=()=>null;localStorage.setItem('afk_bossavoid_1','LZ1:'+LZString.compressToUTF16(JSON.stringify({training:['orc']})));});await roundTrip(2);
await check('real preference write failure rolls all touched storage back',()=>page.evaluate(()=>{const a=buildAccountSnapshot(),before=JSON.stringify(__feedback.data);__feedback.fail='afk_bossavoid_1';const r=applyAccountImport(planAccountImport(a));__feedback.fail=null;return !r.ok&&r.error.includes('已還原')&&JSON.stringify(__feedback.data)===before;}));
await page.evaluate(()=>{currentSlot=1;loadGame();});await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));await page.evaluate(()=>{stopGameTimers();state.running=false;const item=(id,uid,cnt,en=0)=>({id,uid,cnt,en,bless:false,anc:false,attr:false,seteff:false});player.inv=[item('hlm_mr','f-helm',1,4),item('scroll_armor_c','f-curse',8)];renderTabs(true);openModal(player.inv[0],false);window.__feedbackModalAt=performance.now();});await page.waitForFunction(()=>performance.now()-__feedbackModalAt>=450);
await page.click('#modal-actions [onclick^="AFK_CURSEBATCH.open("]');
await check('batch weaken confirmation has the same dark-red fill as curse actions',()=>page.evaluate(()=>{const b=document.querySelector('#modal-actions [onclick^="AFK_CURSEBATCH.run("]'),s=getComputedStyle(b);return s.backgroundColor==='rgb(66, 21, 24)'&&s.color==='rgb(227, 161, 155)'&&!s.borderImageSlice.includes('fill');}));
await page.click('#modal-actions [onclick^="AFK_CURSEBATCH.run("]');await page.click('loc=role:button[name="開始"]');await check('red confirmation still weakens to -1 and spends exactly five scrolls',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='f-helm').en===-1&&player.inv.find(i=>i.uid==='f-curse').cnt===3));
await page.evaluate(()=>{closeModal();setMapSelectors('training');changeMap(true);state.running=false;});await page.selectOption('#map-category','social_lobby');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
await check('camp requests online players rather than recent historical cards',()=>page.evaluate(()=>__feedback.requests.some(r=>r.path==='/v1/players')&&!document.querySelector('[data-camp-id="00000000-0000-4000-8000-000000000003"]')));
async function click(selector){await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');await page.click(selector);await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');}
await click('[data-camp-id="00000000-0000-4000-8000-000000000002"]');
await check('remote card displays live current map',()=>page.evaluate(()=>document.getElementById('lobby-detail-body').textContent.includes('目前地圖：象牙塔7樓')));
await click('#lobby-open-comments');await check('message board renders several people vertically at once',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#lobby-comments article')];return rows.length===5&&rows.every((r,i)=>i===0||r.getBoundingClientRect().top>=rows[i-1].getBoundingClientRect().bottom)&&['留言旅人0','留言旅人4'].every(n=>document.getElementById('lobby-comments').textContent.includes(n))&&!document.getElementById('lobby-comments-previous');}));
await check('only comment feed scrolls; popup and scene stay within the map',()=>page.evaluate(()=>{const h=document.getElementById('lobby-comments'),p=document.getElementById('lobby-popup'),s=document.getElementById('social-lobby'),r=p.getBoundingClientRect(),b=s.getBoundingClientRect();return getComputedStyle(h).overflowY==='auto'&&p.scrollHeight<=p.clientHeight+1&&s.scrollHeight<=s.clientHeight+1&&r.top>=b.top&&r.bottom<=b.bottom;}));
await page.keyboard.press('Escape');await click('[data-self="true"]');await click('#lobby-edit');await click('[data-editor-tab="sharing"]');
await check('editor explicitly offers current-map sharing',()=>page.evaluate(()=>!!document.getElementById('lobby-share-map')&&document.querySelector('label:has(#lobby-share-map)').textContent.includes('目前地圖')));
if(await page.evaluate(()=>!!document.getElementById('lobby-share-map'))){await page.evaluate(()=>{document.getElementById('lobby-share-map').checked=true;});}
await click('#lobby-preview');await click('#lobby-publish');await click('#lobby-exit');
const beforePresence=await page.evaluate(()=>__feedback.requests.filter(r=>r.path==='/v1/presence').length);
await page.evaluate(async()=>{setMapSelectors(getHomeTown());changeMap(true);state.running=false;const timer=__feedback.timers.at(-1);if(timer)await timer();});
await check('published player keeps sending current map while hunting outside lobby',()=>page.evaluate(before=>!socialLobby.isOpen()&&__feedback.requests.filter(r=>r.path==='/v1/presence').length>before&&__feedback.presence.map===mapEntryOf(mapState.current)?.t,beforePresence));
await check('no runtime errors',()=>page.evaluate(()=>!__feedback.errors.length||__feedback.errors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Feedback 1020 regression');if(!options.keepSpace)await task.finish({keep:[]});
