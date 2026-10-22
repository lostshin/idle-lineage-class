// Failure cases: changed RNG order/rewards/HP/threat, missed cooldown actions,
// stale aura changes, target replacement, and accelerating by discarding ticks.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto'),cp=await import('node:child_process');
const task=await taskSpace(options.space||'補跑運算最佳化驗證'),page=task.page('p1'),reports=[],outcomes={},sources={};console.log({spaceId:task.spaceId});
const referenceCommit='c633073b2ed9e301a39631c259547cd2d1368f8f';
for(const f of ['index.html','js/03-combat-core.js','js/06-status-allies.js','js/04-combat-attack.js','js/32-threat.js','tests/catchup-equivalence.e2e.js'])sources[f]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+f)).digest('hex');
const functions=[['js/03-combat-core.js','function _dpsSnap()','function _dpsDealt('],['js/06-status-allies.js','function alliesTick()','function allyTryHeal('],['js/32-threat.js','function threatCommitDiff(','function threatWrap('],['js/04-combat-attack.js','function teamIlluAura(','function enemyAttackAlly(']];
let reference='';for(const [file,start,end] of functions){const s=cp.execFileSync('git',['show',referenceCommit+':'+file],{cwd:options.root,encoding:'utf8'}),a=s.indexOf(start),b=s.indexOf(end,a);if(a<0||b<a)throw Error('Missing reference function '+start);reference+=s.slice(a,b)+'\n';}
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/catchup-equivalence-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego, synthetic storage/public API isolation; original c633073 functions restored in reference mode; seeded RNG, independent UID counter, fixed virtual wall clock, native tick and rewards; complete canonical state/RNG digest comparison',referenceCommit,sources,reports,outcomes},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={lineage_optional_addons_v1:JSON.stringify({v:1,enabled:{gear:true}})};window.__optErrors=[];window.__optNow=1900000000000;Date.now=()=>Math.floor(__optNow);const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});const f=fetch;window.fetch=(u,...a)=>String(u).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public API')):f(u,...a);window.BroadcastChannel=undefined;addEventListener('error',e=>__optErrors.push(e.message));})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
async function boot(mode,scenario){
 await page.goto(options.url+'?catchup-equivalence='+mode+'-'+scenario);await page.waitForFunction(()=>document.readyState==='complete'&&typeof setGameSpeed==='function');
 if(mode==='reference'||options.baseline)await page.evaluate(s=>window.eval(s),reference);
 await page.evaluate(scenario=>{
  _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;window.__optUid=0;uid=()=>'opt-'+(++__optUid);window.__optSeed=123456;window.__optCalls=0;Math.random=()=>{__optCalls++;__optSeed=(Math.imul(__optSeed,1664525)+1013904223)>>>0;return __optSeed/4294967296;};selectClass('m_royal');document.getElementById('creation-name').value='合成運算對照';startGame();stopGameTimers();state.running=false;setUiScale(80);player.lv=100;player.gold=10000000;player.autoSellOn=false;player.alloc.cha=60-player.base.cha;
  const gear=(id,u,en=7,cnt=1)=>({id,uid:u,en,cnt,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false});
  player.eq={wpn:gear('wpn_dragonslayer','eq-main'),helm:gear('hlm_mr','eq-helm'),armor:gear('arm_74','eq-armor')};player.skills=[];player.config.autoBuffSkills={};player.inv=Array.from({length:1000},(_,i)=>gear(['wpn_1','arm_74','rng_earth'][i%3],'inv-'+i,i%15));calcStats();player.hp=player.mhp;player.mp=player.mmp;
  const base=JSON.parse(saveStateJson()),classes=['knight','elf','mage','dark','dragon','illusion','warrior'],skills=[[],['sk_elf_summon2'],['sk_summon'],[],[],['sk_illu_ogre'],[]];
  for(let i=0;i<7;i++){const d=structuredClone(base);Object.assign(d.p,{name:'合成對照隊友'+i,cls:classes[i],enSeed:'opt-seed-'+i,_roleEpoch:'opt-epoch-'+i,allies:[],inv:[],skills:skills[i],elfEle:'fire',eq:{wpn:gear(i===1?'wpn_3':'wpn_2','ally-'+i),helm:gear('hlm_mr','ah-'+i),armor:gear('arm_74','aa-'+i)}});d.p.config.autoBuffSkills=Object.fromEntries(skills[i].map(s=>[s,true]));_lzSet('lineage_idle_save_'+(i+2),_saveWrap(JSON.stringify(d)));}player.allies=classes.map((_,i)=>buildAlly(String(i+2)));setMapSelectors('zone_39');changeMap(true);state.running=true;state.ticks=10;for(const a of player.allies)allyMaintainBuffs(a);calcStats();player.hp=player.mhp;player.mp=player.mmp;_dpsReset();_audit.kills=0;_audit.exp=0;
  if(scenario==='offhand-control'){player.allies[6].skills.push('sk_warrior_dualaxe');window.__optOffhandHits=0;const original=allyDualWieldOffhandAttack;allyDualWieldOffhandAttack=function(...a){__optOffhandHits++;return original.apply(this,a);};}
  if(scenario==='support-periodic'){
   const mage=player.allies[2],illu=player.allies[5];
   mage.skills.push('sk_fire_prison','sk_heal2');mage._healSkill='sk_heal2';mage._autoBuff={sk_summon:true,sk_fire_prison:true};
   illu.skills.push('sk_illu_cube_harmony');illu._autoBuff={sk_illu_ogre:true,sk_illu_cube_harmony:true};
   for(const a of player.allies){a.curHp=Math.floor(a.mhp*.7);a._healHpPct=90;}player.hp=Math.floor(player.mhp*.7);
  }
  if(scenario==='pets-guards'){
   const pet=petNewInstance('杜賓狗',50);pet.uid='opt-pet';pet.outOwner=_petCurrentOwnerKey();pet.outSlot=String(currentSlot);petRoster().push(pet);petMarkDirty();petRosterSave();
   player.guardsV2=[{uid:'opt-guard',form:'藍色鯊魚',city:'kent',lv:60,hp:1000,mhp:1000,_atkCd:0}];_guardSyncCd=10000;
  }
  stopGameTimers();window.__optScenario=scenario;window.__optSeed=987654321;window.__optCalls=0;window.__optStartTicks=state.ticks;state.ff=false;state.running=false;currentSpeed=64;
 },scenario);
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>!['_animAct','_animAt','_animUntil','_faceTgt','_px','_py','_walkT','_attackAnimAt','_spawnAnimAt'].includes(k)).map(k=>[k,canonical(value[k])]));return value;}
for(const scenario of ['ordinary','status-aura','offhand-control','support-periodic','pets-guards','aura-matrix'])for(const mode of ['reference','current']){
 await boot(mode,scenario);
 const result=await page.evaluate(()=>{
  __optSeed=987654321;__optCalls=0;state.ff=true;state.running=true;
  for(let i=0;i<2400;i++){
   __optNow+=100/64;
   if(__optScenario==='status-aura'&&i%100===0){const a=player.allies[(i/100)%7|0];a.statuses.stun=7;a.buffs.sk_royal_burnweapon=15;a.buffs.sk_elf_dancefire=9;player.buffs.sk_royal_burnweapon=5;}
   if(__optScenario==='offhand-control'&&i%80===0){const a=player.allies[6];a.eq.offwpn=i%160===0?{...a.eq.wpn,uid:'offhand'}:null;_allyLevelRecompute(a);a.statuses.silence=11;player.allies[2].statuses.poison=15;player.allies[2].statuses.poisonDmg=2;player.allies[2].statuses.poisonTick=5;}
   state.inTick=true;try{tick();}finally{state.inTick=false;settleDeadMobs();}
  }
  let auraMatrix=[];
  if(__optScenario==='aura-matrix'){
   const actors=[player,...player.allies],saved=actors.map(a=>({buffs:structuredClone(a.buffs),down:a._downed})),sids=['sk_illu_ogre','sk_illu_avatar','sk_illu_lich','sk_royal_burnweapon','sk_elf_dancefire'];
   for(let mask=0;mask<16;mask++){
    for(let j=0;j<actors.length;j++){actors[j].buffs=Object.fromEntries(sids.map((sid,k)=>[sid,(mask+j+k)%3===0?20:0]));actors[j]._downed=(mask+j)%5===0;}
    for(const who of [undefined,...actors,{buffs:{sk_royal_burnweapon:1,sk_elf_dancefire:1}}])for(const minion of [false,true])auraMatrix.push(teamIlluAura(who,minion));
   }
   actors.forEach((a,i)=>{a.buffs=saved[i].buffs;if(saved[i].down===undefined)delete a._downed;else a._downed=saved[i].down;});
  }
  const raw={auraMatrix,offhandAttacks:window.__optOffhandHits||0,player:JSON.parse(JSON.stringify(player)),map:JSON.parse(JSON.stringify(mapState)),ticks:state.ticks,dps:structuredClone(_dps),audit:{kills:_audit.kills,exp:_audit.exp},random:{calls:__optCalls,seed:__optSeed},uid:__optUid};
  state.running=false;state.ff=false;return {raw,errors:__optErrors};
 });
 const serialized=JSON.stringify(canonical(result.raw)),digest=crypto.createHash('sha256').update(serialized).digest('hex');
 outcomes[scenario]??={};outcomes[scenario][mode]={digest,rng:result.raw.random,ticks:result.raw.ticks,kills:result.raw.audit.kills,gold:result.raw.player.gold,errors:result.errors};await fs.writeFile(options.artifacts+'/catchup-state-'+scenario+'-'+mode+'-'+options.protocol+'.json',JSON.stringify(canonical(result.raw)));
 if(mode==='current'&&scenario==='offhand-control')await check('dual-wield fixture actually executes native offhand attacks',()=>result.raw.offhandAttacks>0);
 if(mode==='current'&&scenario==='support-periodic')await check('support fixture actually heals and advances native harmony cube',()=>result.raw.player.allies[2]._lastHealCastSupport===true&&result.raw.player.allies[5]._cubeHpCd.sk_illu_cube_harmony>0);
 if(mode==='current'&&scenario==='pets-guards')await check('companion fixture produces real pet and guard damage',()=>result.raw.dps.pet>0&&result.raw.dps.guard>0);
 if(mode==='current')await check(scenario+': native full state, damage, threat, inventory, cooldowns and RNG match original',()=>result.errors.length===0&&outcomes[scenario].current.digest===outcomes[scenario].reference.digest);
}
await check('idle threat commits avoid computing a weapon multiplier',()=>page.evaluate(()=>{const native=computeThreatMult;let calls=0;computeThreatMult=(...a)=>{calls++;return native(...a);};try{const snap=_dpsSnap();threatCommitDiff(snap,player);return calls===0;}finally{computeThreatMult=native;}}));
await check('inactive ally rounds avoid per-ally damage snapshots',()=>page.evaluate(()=>{const native=_dpsSnap;let calls=0;for(const a of player.allies){a.skills=[];a._healSkill='';a._convertSkill='';a.summon=null;a._atkCd=100;a.eq.offwpn=null;a.statuses={stun:10};}state.ff=true;state.running=true;_dpsSnap=(...a)=>{calls++;return native(...a);};try{alliesTick();return calls===0;}finally{_dpsSnap=native;state.ff=false;state.running=false;}}));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,outcomes});if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Catchup equivalence regression');if(!options.keepSpace)await task.finish({keep:[]});
