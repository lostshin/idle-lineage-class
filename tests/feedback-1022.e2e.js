// Failure cases: anonymous batch groups, centered compact stats, conflicting mage
// summon preferences restored from source/overrides or after native save/recruit.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'批次名稱與夥伴設定修正'),page=task.page('p1'),reports=[],measurements=[],sources={};
console.log({spaceId:task.spaceId});
for(const name of ['index.html','js/10-ui-tabs.js','js/06-status-allies.js','js/party-inspector.js','css/responsive.css','tests/feedback-1022.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/feedback-1022-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego, native UI clicks and native save/buildAlly; isolated synthetic storage, blocked public lobby API; rendered text and right-edge measurements',sources,measurements,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={};window.__feedbackErrors=[];const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});const f=fetch;window.fetch=(url,...args)=>String(url).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public API')):f(url,...args);addEventListener('error',e=>__feedbackErrors.push(e.message));})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?feedback-1022');await page.waitForFunction(()=>document.readyState==='complete'&&typeof guardDerive==='function'&&typeof startGame==='function');
await page.evaluate(()=>{
 _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_mage');document.getElementById('creation-name').value='合成夥伴驗收';startGame();stopGameTimers();state.running=false;setUiScale(100);player.lv=60;player.skills=['sk_summon','sk_zombie','sk_shield'];calcStats();player.hp=player.mhp;player.mp=player.mmp;player.autoSellOn=false;
 const gear=(id,uid,en,cnt,extra={})=>({id,uid,en,cnt,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false,...extra});
 player.inv=[gear('wpn_shortbow','feedback-gear',4,10,{bless:true,attr:'fr1'}),gear('scroll_weapon','feedback-scroll',0,10)];renderTabs(true);openModal(player.inv[0],false);window.__opened=performance.now();
});await page.waitForFunction(()=>performance.now()-__opened>=450);await page.click('#modal-actions [onclick^="showEnhanceOptions("]');await page.click('#same-batch-open');
await check('batch choices identify full equipment name, affixes, enhancement and quantity',()=>page.evaluate(()=>{const b=document.querySelector('[data-same-batch-en="4"]'),name=getItemFullName({...player.inv[0],cnt:1}).replace(/<[^>]*>/g,'');return b.textContent.replace(/\s/g,'')===(name+' ×10').replace(/\s/g,'')&&b.textContent.includes(DB.items.wpn_shortbow.n);}));
if(!options.baseline){
 await page.click('[data-same-batch-en="4"]');await page.click('#same-batch-preview');await page.click('#same-batch-confirm');
 await check('completed round keeps full names on refreshed groups',()=>page.evaluate(()=>[...document.querySelectorAll('[data-same-batch-en]')].every(b=>b.textContent.includes(DB.items.wpn_shortbow.n))));
 for(const width of [1330,1920,390])for(const scale of [60,75,80,100]){
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate(scale=>setUiScale(scale),scale);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await check(`${width}px ${scale}% full batch names wrap without horizontal clipping`,()=>page.evaluate(()=>{const p=document.getElementById('same-batch-panel');return p.scrollWidth<=p.clientWidth+1&&[...p.querySelectorAll('[data-same-batch-en]')].every(b=>{const r=b.getBoundingClientRect(),pRect=p.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(b);return r.right<=pRect.right+1&&[...range.getClientRects()].every(t=>t.right<=r.right+1);});}));
 }
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.evaluate(()=>{
 setUiScale(100);closeModal();player.buffs.sk_shield=60;calcStats();
 const record=JSON.parse(saveStateJson());Object.assign(record.p,{name:'合成傭兵法師',enSeed:'feedback-mage',_roleEpoch:'feedback-mage',allies:[],config:{...player.config,autoBuffSkills:{sk_summon:false,sk_zombie:false,sk_shield:true}}});_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(record)));player.allies=[buildAlly('2')];
 const pet={cnt:1,form:'杜賓狗',uid:'feedback-pet',lv:30,hp:500,mhp:500,mp:0,mmp:0,exp:0,eq:{},outOwner:_petCurrentOwnerKey(),outSlot:1};petRoster().push(pet);petMarkDirty();petRosterSave();
 player.summonsV2=[{uid:'feedback-summon',form:SUMMON_TIERS[0].mobs[0].n,lv:30,mhp:500,hp:500,buffs:{haste:30},statuses:{}}];
 player.guardsV2=[{uid:'feedback-guard',form:CASTLE_GUARD_BOOK.kent.form,lv:60,mhp:1000,hp:1000,buffs:{},statuses:{}}];
 renderSquadPanel();window.__alignment=()=>[...document.querySelectorAll('#party-bonus-window .pet-ability-stats dd')].map(dd=>{const r=dd.getBoundingClientRect(),walker=document.createTreeWalker(dd,NodeFilter.SHOW_TEXT),texts=[];let node;while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);texts.push(...range.getClientRects());}const right=Math.max(...texts.map(t=>t.right));return {text:dd.textContent,right:r.right,contentRight:right,gap:r.right-right};});
});
for(const kind of ['pet','summon','guard']){
 await page.evaluate(()=>openPartyInspector('ally','2'));
 await page.evaluate(kind=>openPartyInspector(kind,'feedback-'+kind),kind);
 const rows=await page.evaluate(()=>__alignment());measurements.push({kind,rows});
 await check(kind+' compact ability totals and buff additions share the right edge',()=>page.evaluate(()=>{const rows=__alignment();return rows.length>=5&&rows.every(r=>Math.abs(r.gap)<=2);}));
 if(!options.baseline)for(const scale of [60,75,80,100]){
  await page.evaluate(scale=>setUiScale(scale),scale);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await check(kind+' '+scale+'% compact stats remain right aligned',()=>page.evaluate(()=>__alignment().every(r=>Math.abs(r.gap)<=2)));
 }
 await page.click('#party-inspector-close');
}
await page.evaluate(()=>{setUiScale(100);switchSquadTab('skill');});
const sum='input[onchange="setAllyAutoBuff(\'2\',\'sk_summon\',this.checked)"]',zombie='input[onchange="setAllyAutoBuff(\'2\',\'sk_zombie\',this.checked)"]';
await page.click(sum);await page.click(zombie);
await check('selecting zombie clears summon and keeps unrelated buff preferences',()=>page.evaluate(()=>{const a=player.allies[0];return _mercAutoOn(a,'sk_zombie')&&!_mercAutoOn(a,'sk_summon')&&_mercAutoOn(a,'sk_shield')&&a._autoBuff.sk_summon===false;}));
if(!options.baseline){
 await page.click(sum);await check('selecting summon clears zombie immediately in both state and UI',()=>page.evaluate(()=>{const a=player.allies[0],inputs=[...document.querySelectorAll('.ally-auto-chip input')].filter(e=>/sk_summon|sk_zombie/.test(e.getAttribute('onchange')));return _mercAutoOn(a,'sk_summon')&&!_mercAutoOn(a,'sk_zombie')&&inputs.filter(e=>e.checked).length===1;}));
 await page.click(sum);await check('both summoning choices may be disabled',()=>page.evaluate(()=>!_mercAutoOn(player.allies[0],'sk_summon')&&!_mercAutoOn(player.allies[0],'sk_zombie')));
 await page.click(zombie);await check('native save preserves selected zombie and explicit summon false',()=>page.evaluate(()=>{const a=_roleReadSavePlayer(1).allies[0];return a._autoBuff.sk_zombie===true&&a._autoBuff.sk_summon===false;}));
 await page.evaluate(()=>{snapshotMercPrefs(player.allies[0]);player.allies=[buildAlly('2')];_squadSigSkill='';renderSquadPanel();});
 await check('same-role rebuild restores exclusive selection',()=>page.evaluate(()=>_mercAutoOn(player.allies[0],'sk_zombie')&&!_mercAutoOn(player.allies[0],'sk_summon')));
 await page.evaluate(()=>{saveGame();loadGame();});await page.waitForFunction(()=>player.cls&&!document.getElementById('game-screen').classList.contains('hidden'));
 await check('native load keeps exclusive settings',()=>page.evaluate(()=>{stopGameTimers();state.running=false;return _mercAutoOn(player.allies[0],'sk_zombie')&&!_mercAutoOn(player.allies[0],'sk_summon');}));
}
await check('legacy conflicting source preferences resolve to only one summoning spell',()=>page.evaluate(()=>{const a=buildAlly('2');delete a._autoBuff; a.config.autoBuffSkills={sk_summon:true,sk_zombie:true};return [_mercAutoOn(a,'sk_summon'),_mercAutoOn(a,'sk_zombie')].filter(Boolean).length===1;}));
if(!options.baseline){
 await check('legacy conflict keeps the live summon choice and preserves explicit false',()=>page.evaluate(()=>{const a=buildAlly('2');a._autoBuff={sk_summon:true,sk_zombie:true};a.summon={skId:'sk_zombie'};a.buffs.sk_zombie=30;const live=_mercAutoOn(a,'sk_zombie')&&!_mercAutoOn(a,'sk_summon');a._autoBuff={sk_summon:false,sk_zombie:false};return live&&!_mercAutoOn(a,'sk_summon')&&!_mercAutoOn(a,'sk_zombie');}));
 await check('spell switch does not erase the current summon or alter unrelated skills',()=>page.evaluate(()=>{const a=player.allies[0];a.summon={skId:'sk_zombie',endTick:state.ticks+100};a.buffs.sk_zombie=100;const live=JSON.stringify(a.summon);setAllyAutoBuff('2','sk_summon',true);return JSON.stringify(a.summon)===live&&a.buffs.sk_zombie===100&&_mercAutoOn(a,'sk_shield');}));
 for(const sid of ['sk_summon','sk_zombie'])await check(sid+' is the sole next spell cast through native mercenary maintenance',()=>page.evaluate(sid=>{setMapSelectors('training');changeMap(true);const a=player.allies[0];setAllyAutoBuff('2',sid,true);a.summon=null;a.buffs={};a.statuses={};a.mp=a.mmp;const before=a.mp;allyMaintainBuffs(a);return a.summon?.skId===sid&&a.mp<before;},sid));
 await check('no browser runtime errors',()=>page.evaluate(()=>!__feedbackErrors.length||__feedbackErrors));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Feedback 1022 regression');
if(!options.keepSpace)await task.finish({keep:[]});
