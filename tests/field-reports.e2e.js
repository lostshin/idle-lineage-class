// Reproduce field reports through native entry, pet inspection, combat dispatch and offline load settlement.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'Four field report regressions'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const f of ['index.html','js/13-shop-save.js','js/effect-details.js','js/01-drops-config.js','js/06-status-allies.js','js/27-offline-rewards.js','tests/field-reports.e2e.js'])sources[f]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+f)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}await fs.writeFile(options.artifacts+'/field-reports-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; native dispatch and offline grant/save/load with synthetic isolated storage and clock; synthetic guaranteed loot table; source hashes at runner start',sources,reports},null,2));}
let init;
async function boot(data={},now=Date.now()){
 if(init)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
 init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data=${JSON.stringify(data)};window.__fieldData=data;window.__fieldNow=${now};window.__fieldErrors=[];Date.now=()=>__fieldNow;const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;addEventListener('error',e=>__fieldErrors.push(e.message));})();`})).identifier;
 await page.goto(options.url+'?field-reports');await page.cdp('Page.bringToFront');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
 await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;window.__fieldLoot=()=>{const rows=[];for(let i=1;i<=61;i++){const id='field_loot_'+i;DB.items[id]={n:'合成戰利品 '+String(i).padStart(2,'0'),type:'mat',w:0,p:1,icon:'',req:'all'};rows.push([id,100]);}MOB_DROPS[DB.mobs.orc.n]=rows;};});
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await boot();
await page.evaluate(()=>{selectClass('m_knight');document.getElementById('creation-name').value='合成回報隊長';startGame();stopGameTimers();state.running=false;player.lv=80;player.base.cha=60;calcStats();player.hp=player.mhp;player.mp=player.mmp;setMapSelectors('town_witon');changeMap(true);antharasEnter();stopGameTimers();state.running=false;});
for(const [i,map]of ['antharas_nest_1','antharas_nest_2','antharas_nest_3','antharas_lair'].entries()){
 if(i)await page.evaluate(()=>antharasOnBossKill('合成前區頭目'));
 await check(map+': native entry/progression selects a decoded background',()=>page.evaluate(async map=>{
  const el=document.getElementById('battle-view'),url=el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
  if(mapState.current!==map||!url)return {map:mapState.current,url};
  return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0&&el.classList.contains('area-fit'));img.onerror=()=>resolve({missing:url});img.src=url;});
 },map));
}
await page.evaluate(()=>{state.antharas=0;setMapSelectors('training');changeMap(true);const p=petStoreAdd('高等淘氣龍','合成驗收');p.lv=68;p.outOwner=_petCurrentOwnerKey();p.outSlot=1;p.outV=Date.now();p.mhp=1000;p.hp=1000;petMarkDirty();petRosterSave();window.__fieldPetUid=p.uid;renderSquadPanel();});
await page.click('[data-party-kind="pet"][data-party-id]');
await check('Lv68 pet shows its own damage, hit and attack interval without unused player attributes',()=>page.evaluate(()=>{
 const root=document.getElementById('party-bonus-window'),pet=petsOutList().find(p=>p.uid===__fieldPetUid),d=petDerive(pet);
 return root.matches('[data-pet-ability]')&&!root.querySelector('[data-ability-field="str"]')&&['mdmg','mhit','spd'].every(k=>{const e=root.querySelector('[data-ability-field="'+k+'"]');return !!e&&!e.textContent.includes('—');})&&root.textContent.includes('1D'+d.dice);
}));
await check('displayed pet dice and physical additions match a native guaranteed heavy hit',()=>page.evaluate(()=>{
 const p=petsOutList().find(p=>p.uid===__fieldPetUid),d=petDerive(p),root=document.getElementById('party-bonus-window');
 const add=Number(root.querySelector('[data-ability-field="mdmg"] [data-ability-total]')?.textContent),mobs=mapState.mobs,random=Math.random;
 const target={...DB.mobs.orc,uid:'field-pet-hit',lv:68,ac:0,mr:0,dr:0,hp:1000000,curHp:1000000,st:newMobStatus()};
 try{mapState.mobs=[target];Math.random=()=>.99;petAttackOnce(p,d,target,true,0,'');return Number.isFinite(add)&&1000000-target.curHp===Math.max(1,Math.floor((d.dice+add)*(d.damageMult||1)*(d.attackMult||1)));}
 finally{mapState.mobs=mobs;Math.random=random;_combatSrc=null;}
}));
await check('pet magic fields use native skill dice instead of player spell/critical stats',()=>page.evaluate(()=>{
 const p=petNewInstance('高等袋鼠',68),box=document.createElement('div');box.innerHTML=partyBonusHtml(partyBonusSnapshot(p,'pet'),p);
 return box.textContent.includes('2D18')&&box.textContent.includes('魔法必中')&&!box.textContent.includes('—')&&!box.querySelector('[data-ability-field="str"]')&&!box.querySelector('[data-ability-field="mcrit"]');
}));
await check('pet inspection preserves live actor, roster and storage',()=>page.evaluate(()=>{const p=petsOutList().find(p=>p.uid===__fieldPetUid),before=JSON.stringify([player,p,__fieldData]);partyBonusHtml(partyBonusSnapshot(p,'pet'),p);return JSON.stringify([player,p,__fieldData])===before;}));
await page.click('#party-inspector-close');
await page.evaluate(()=>{
 const doc=JSON.parse(saveStateJson());for(const slot of [2,3]){const d=JSON.parse(JSON.stringify(doc));d.p.name='同名隊友';d.p.enSeed='field-ally-'+slot;d.p._roleEpoch='field-epoch-'+slot;d.p.allies=[];d.p.inv=[];_lzSet('lineage_idle_save_'+slot,_saveWrap(JSON.stringify(d)));}
 player.allies=[buildAlly('2'),buildAlly('3')];player.allies.forEach(a=>{a._atkCd=0;a._atkSkill='';a.buffs={};});
 mapState.mobs=[{...DB.mobs.orc,uid:'field-target',curHp:1000000,hp:1000000,st:newMobStatus()}];mapState.targetIdx=0;renderSquadPanel();switchLogTab('combat');document.getElementById('combat-log').replaceChildren();_combatSrc='mercenary';alliesTick();_combatSrc=null;logCombat('玩家對照','player','player');logSpellCast(player,{n:'合成施法'});
});
const hasSelector=await page.evaluate(()=>!!document.getElementById('combat-mercenary-filter'));
await check('mercenary filter offers all and each same-name teammate separately',()=>page.evaluate(()=>{const s=document.getElementById('combat-mercenary-filter');return !!s&&s.options.length===3&&s.options[1].value!==s.options[2].value;}));
await check('native ally attacks carry a stable actor identity',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#combat-log [data-src="mercenary"]')];return rows.length>=2&&new Set(rows.map(e=>e.dataset.mercenaryId).filter(Boolean)).size===2;}));
if(hasSelector){
 const first=await page.evaluate(()=>document.getElementById('combat-mercenary-filter').options[1].value);
 await page.evaluate(()=>{window.__fieldCombatSnapshot=()=>JSON.stringify({hp:player.hp,mp:player.mp,exp:player.exp,gold:player.gold,inv:player.inv,eq:player.eq,buffs:player.buffs,statuses:player.statuses,ticks:state.ticks,allies:player.allies.map(a=>({id:accountRoleId(a),hp:a.curHp,mp:a.mp,exp:a.exp,buffs:a.buffs,statuses:a.statuses,atkCd:a._atkCd})),mobs:mapState.mobs.map(m=>({uid:m.uid,hp:m.curHp,st:m.st}))});window.__fieldCombatBefore=__fieldCombatSnapshot();});await page.selectOption('#combat-mercenary-filter',first);
 await check('selecting one teammate hides only other mercenary rows and never mutates combat',()=>page.evaluate(first=>{
  const rows=[...document.querySelectorAll('#combat-log [data-src="mercenary"]')],visible=rows.filter(e=>getComputedStyle(e).display!=='none');
  const checks={hasSelected:visible.length>0,selectedOnly:visible.every(e=>e.dataset.mercenaryId===first),otherHidden:rows.some(e=>getComputedStyle(e).display==='none'),playerUnfiltered:getComputedStyle(document.querySelector('#combat-log [data-src="player"]')).display!=='none',castUnfiltered:getComputedStyle(document.querySelector('#combat-log [data-src="cast"]')).display!=='none',combatUnchanged:__fieldCombatSnapshot()===__fieldCombatBefore};return Object.values(checks).every(Boolean)||checks;
 },first));
 await page.evaluate(()=>{player.allies.forEach(a=>a._atkCd=0);_combatSrc='mercenary';alliesTick();_combatSrc=null;});
 await check('new native attack rows obey the selection and actor context does not leak',()=>page.evaluate(first=>{
  const rows=[...document.querySelectorAll('#combat-log [data-src="mercenary"]')];return rows.some(e=>e.dataset.mercenaryId===first)&&rows.every(e=>getComputedStyle(e).display==='none'||e.dataset.mercenaryId===first)&&_combatMercenary===null;
 },first));
 await page.selectOption('#combat-mercenary-filter','');await check('all restores the original retained nodes',()=>page.evaluate(()=>[...document.querySelectorAll('#combat-log [data-src="mercenary"]')].every(e=>getComputedStyle(e).display!=='none')));
}
// Native qualifying sample followed by a full document reopen with 61 guaranteed synthetic drop kinds.
await page.evaluate(()=>{
 player.allies=[];player.autoSellOn=false;state.antharas=0;state.running=true;setMapSelectors('training');changeMap(true);__fieldLoot();
 for(let i=0;i<3;i++){if(i)__fieldNow+=8000;mapState.mobs[0]={...DB.mobs.orc,uid:'field-sample-'+i,curHp:0,st:newMobStatus()};killMob(0);}saveGame();stopGameTimers();state.running=false;
});
const saved=await page.evaluate(()=>({data:{...__fieldData},now:__fieldNow,eligible:player.offlineHunt?.eligible}));
await check('offline fixture has a native qualifying sample',()=>saved.eligible===true||saved.eligible);
await boot(saved.data,saved.now+60*60000);await page.evaluate(()=>{__fieldLoot();currentSlot=1;loadGame();stopGameTimers();});
await page.waitForFunction(()=>document.getElementById('sys-log').textContent.includes('離線戰利品'));
await page.evaluate(()=>{stopGameTimers();state.running=false;});
await check('offline system log lists every one of 61 loot kinds with quantities',()=>page.evaluate(()=>{
 const row=[...document.querySelectorAll('#sys-log .sys-item-gain')].find(e=>e.textContent.includes('離線戰利品'));if(!row)return false;
 return Array.from({length:61},(_,i)=>'合成戰利品 '+String(i+1).padStart(2,'0')).every(n=>row.textContent.includes(n))&&!row.textContent.includes('其餘 ')&&row.querySelectorAll('b').length>=61;
}));
await check('expanded loot output leaves native awarded inventory and saved counts intact',()=>page.evaluate(()=>{
 const saved=accountRoleDoc(1).p;return Array.from({length:61},(_,i)=>'field_loot_'+(i+1)).every(id=>{const sum=a=>a.filter(x=>x.id===id).reduce((n,x)=>n+(x.cnt||1),0);return sum(player.inv)>0&&sum(player.inv)===sum(saved.inv);})&&!document.getElementById('offline-reward-modal');
}));
await check('no runtime errors',()=>page.evaluate(()=>__fieldErrors.length===0||__fieldErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Field report regressions');if(!options.keepSpace)await task.finish({keep:[]});
