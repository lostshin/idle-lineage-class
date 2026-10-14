(async () => {
const fs=await import('node:fs/promises');
const task=await taskSpace(options.space || '遊玩功能修復驗證');console.log({spaceId:task.spaceId});
const page=task.page(options.page || 'p1');await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
let initId;const reports=[];
async function boot(seed={}){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:759,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
 if(initId)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});
 const token=String(Date.now())+Math.random();
 initId=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__bootToken=${JSON.stringify(token)};const data=${JSON.stringify(seed)};window.__testData=data;window.__failWrites=false;window.__errors=[];const storage={getItem:k=>data[k]??null,setItem:(k,v)=>{if(__failWrites)throw Error('synthetic failure');data[k]=String(v)},removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});Object.defineProperty(window,'sessionStorage',{value:{...storage},configurable:true});window.addEventListener('error',e=>__errors.push(e.message));})();`})).identifier;
 await page.goto(options.url+'?gameplay-test='+token);await page.waitForFunction(t=>__bootToken===t && document.readyState==='complete' && typeof startGame==='function',token);
 await page.evaluate(()=>{if(_bgHeartbeatWorker){_bgHeartbeatWorker.terminate();_bgHeartbeatWorker=null;}});
}
async function writeReport(){await fs.writeFile(options.artifacts+'/'+(options.baseline?'gameplay-baseline':'gameplay-report-'+options.protocol)+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));}
async function inspect(kind,id){const selector=`button[data-party-kind="${kind}"][data-party-id="${id}"]`;await page.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),selector);await page.waitForFunction(s=>{const b=document.querySelector(s),r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest(s)===b;},selector);await page.click(selector);}
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({failed:name,error:String(e)});}await writeReport();}
await boot();await page.evaluate(()=>{selectClass('m_mage');startGame();stopGameTimers();state.running=false;player.autoSellOn=false;});
await page.evaluate(()=>{
 const base={cnt:1,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false};
 player.inv=[{...base,id:'wpn_shortbow',uid:'wpn-low',en:0},{...base,id:'wpn_shortbow',uid:'wpn-high',en:6},{...base,id:'wpn_shortbow',uid:'wpn-three',en:3},{...base,id:'wpn_shortbow',uid:'wpn-lock',en:3,lock:true},{...base,id:'arm_74',uid:'arm-low',en:0},{...base,id:'arm_74',uid:'arm-two',en:2},{...base,id:'arm_74',uid:'arm-high',en:5}];
 const protectedId=Object.keys(DB.items).find(id=>DB.items[id].noJunk);if(protectedId)player.inv.push({...base,id:protectedId,uid:'protected',en:0});
 renderTabs(true);
});
for(const [tab,type] of [['weapons','wpn'],['armors','arm']]){
 await page.click(`[onclick="switchTab('${tab}', this)"]`);
 await check(`${tab}: organize menu entry is visible`,()=>page.evaluate(type=>!!document.querySelector(`[data-inventory-sort="${type}"]`),type));
 if(!options.baseline)await check(`${tab}: action labels fit on one line`,()=>page.evaluate(type=>Array.from(document.querySelector(`[data-inventory-sort="${type}"]`).parentElement.querySelectorAll('button')).every(b=>{const range=document.createRange();range.selectNodeContents(b);const rects=Array.from(range.getClientRects()).filter(r=>r.width>0);return Math.max(...rects.map(r=>r.top))-Math.min(...rects.map(r=>r.top))<5 && b.scrollWidth<=b.clientWidth+1;}),type));
 if(!options.baseline){await page.click(`[data-inventory-sort="${type}"]`);await page.click(`#tab-${tab} [data-sort="category"]`);await check(`${tab}: sort orders items without losing them`,()=>page.evaluate(type=>{const wanted=type==='wpn'?['wpn-lock','wpn-high','wpn-three','wpn-low']:['arm-high','arm-two','arm-low'];const prefix=type==='wpn'?'wpn-':'arm-';return JSON.stringify(player.inv.filter(i=>i.uid.startsWith(prefix)).map(i=>i.uid))===JSON.stringify(wanted);},type));}
 await page.click(`[onclick="toggleQuickJunk('${type}')"]`);
 await check(`${tab}: enhanced-item threshold is available`,()=>page.evaluate(type=>!!document.getElementById('quick-junk-max-'+type),type));
 if(!options.baseline){
  await page.selectOption('#quick-junk-max-'+type,type==='wpn'?'3':'2');await page.click(`[data-qj-select-all="${type}"]`);await page.click(`[onclick="runQuickJunk('${type}')"]`);
  await check(`${tab}: threshold includes strengthened items and preserves higher/locked items`,()=>page.evaluate(type=>{const get=uid=>player.inv.find(i=>i.uid===uid);return type==='wpn' ? get('wpn-three').junk && get('wpn-low').junk && !get('wpn-high').junk && !get('wpn-lock').junk : get('arm-two').junk && get('arm-low').junk && !get('arm-high').junk && !get('protected').junk;},type));
 }else await page.evaluate(type=>cancelQuickJunk(type),type);
}
await check('existing autosell rule respects strengthened-item threshold and locks',()=>page.evaluate(()=>{const r=getAutoSellRules();r.equip.wpn={on:true,max:3};r.protectCraftEquip=false;const get=uid=>player.inv.find(i=>i.uid===uid);return _autoSellDecision(get('wpn-three')).sell && !_autoSellDecision(get('wpn-high')).sell && !_autoSellDecision(get('wpn-lock')).sell;}));
await page.evaluate(()=>{
 const doc=JSON.parse(saveStateJson());doc.p.name='合成隊友';doc.p.enSeed='synthetic-ally';doc.p._roleEpoch='ally-epoch';_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));
 const ally=buildAlly('2');player.allies=[ally];ally.curHp=100;ally.mhp=150;ally.mp=40;ally.mmp=80;ally.d.ac=-12;ally.d.mr=40;ally.d.dr=2;ally.buffs={sk_shield:30};ally.statuses={poison:90,disease:40};player.buffs.sk_elf_earthbless=60;renderSquadPanel();
});
await check('teammate name has an inspect entry',()=>page.evaluate(()=>!!document.querySelector('button[data-party-kind="ally"][data-party-id="2"]')));
if(!options.baseline){
 await inspect('ally','2');
 await check('inspector shows active buff and timed debuff',()=>page.evaluate(()=>document.querySelector('#party-inspector [data-buff="sk_shield"]')?.getAttribute('aria-label').includes(DB.skills.sk_shield.n) && document.querySelector('#party-inspector [data-status="poison"]')?.textContent.includes('9 秒')));
 await check('town teammate is shown as ready',()=>page.evaluate(()=>document.getElementById('party-condition').textContent==='就緒'));
 await check('inspector shows effective AC including team aura and disease',()=>page.evaluate(()=>document.getElementById('party-ac').textContent===String(-12-teamAcBonus(player.allies[0])+8) && document.getElementById('party-mr').textContent==='40'));
 await page.evaluate(()=>{player.allies[0].curHp=88;player.allies[0].d.ac=-30;player.allies[0].buffs.sk_shield=5;});
 await check('inspector updates without reopening',async()=>{await page.waitForFunction(()=>document.getElementById('party-hp').textContent.startsWith('88 /'));return page.evaluate(()=>document.getElementById('party-ac').textContent===String(-30-teamAcBonus(player.allies[0])+8) && document.querySelector('#party-inspector [data-buff="sk_shield"]').textContent.includes('5 秒'));});
 await page.evaluate(()=>{player.allies[0].buffs.sk_shield=0;player.allies[0].statuses.poison=0;});await check('expired effects disappear',async()=>{await page.waitForFunction(()=>!document.querySelector('#party-inspector [data-buff="sk_shield"]'));return page.evaluate(()=>!document.querySelector('#party-inspector [data-status="poison"]'));});
 await page.evaluate(()=>{player.allies[0]._downed=true;player.allies[0].curHp=0;});await check('downed teammate remains inspectable',async()=>{await page.waitForFunction(()=>document.getElementById('party-condition').textContent.includes('倒地'));return true;});
 await page.evaluate(()=>{player.allies=[];renderSquadPanel();});await check('removed teammate does not leave stale stats',async()=>{await page.waitForFunction(()=>document.getElementById('party-inspector').textContent.includes('已離隊'));return page.evaluate(()=>!document.getElementById('party-ac'));});
 await page.keyboard.press('Escape');await check('Escape closes inspector and returns focus',()=>page.evaluate(()=>document.getElementById('party-inspector').hidden && document.activeElement.id==='st-class'));
 await check('inspector closes',()=>page.evaluate(()=>document.getElementById('party-inspector').hidden));
 await page.evaluate(()=>{
  const pets=petRoster();pets.push({uid:'test-pet',form:'杜賓狗',lv:10,exp:0,hp:80,mhp:100,mp:0,mmp:0,outOwner:_petCurrentOwnerKey(),eq:{},_statuses:{poison:20}});
  player.summonsV2=[{uid:'test-spirit',form:'水之精靈',skId:'sk_elf_summon',ele:'water',lv:40,hp:300,mhp:400}];
  player.guardsV2=[{uid:'test-guard',form:'藍色鯊魚',lv:10,hp:90,mhp:160}];renderSquadPanel();
 });
 for(const [kind,id] of [['pet','test-pet'],['summon','test-spirit'],['guard','test-guard']]){
  await inspect(kind,id);
  await check(`${kind}: live defenses and health are inspectable`,()=>page.evaluate(kind=>{const a=kind==='pet'?petsOutList()[0]:kind==='summon'?summonV2List()[0]:guardV2List()[0];const d=kind==='pet'?petDerive(a):kind==='summon'?_sumDeriveAny(a):guardDerive(a);return document.getElementById('party-ac').textContent===String(d.ac-teamAcBonus(a,true)) && document.getElementById('party-hp').textContent.startsWith(String(a.hp)+' /') && document.getElementById('party-mr').textContent===String(d.mr || 0);},kind));
  await page.click('#party-inspector-close');
 }
 await page.evaluate(()=>{_petRoster=[];player.summonsV2=[];player.guardsV2=[];});
 await page.evaluate(()=>{const doc=JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_2')).payload);doc.p.name='合成隊友';_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));player.allies=[buildAlly('2')];renderSquadPanel();});
 for(const [width,height,scale] of [[1330,759,100],[390,844,100],[390,844,75],[844,390,75]]){if(options.desktopOnly&&width<1200)continue;
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=1024});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:width<=1024,maxTouchPoints:1});await page.evaluate(v=>setUiScale(v),scale);
  await inspect('ally','2');
  await check(`${width}x${height} ${scale}%: teammate details fit`,()=>page.evaluate(()=>{const r=document.getElementById('party-inspector').getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1 && getComputedStyle(document.getElementById('party-inspector')).position==='fixed';}));

  await page.click('#party-inspector-close');
 }
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:759,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});await page.evaluate(()=>{
  setUiScale(100);const opt=new Option('新兵修練場','training');document.getElementById('map-select').add(opt);document.getElementById('map-select').value='training';changeMap(true);state.running=true;startGameTimers();
 });
 await inspect('ally','2');
 await check('combat continues while teammate details are open',async()=>{const ticks=await page.evaluate(()=>state.ticks);await page.waitForFunction(n=>state.ticks>n+5,ticks);return page.evaluate(()=>!document.getElementById('party-inspector').hidden && !document.getElementById('battle-view').classList.contains('hidden') && document.getElementById('party-condition').textContent==='戰鬥中');});
 await page.evaluate(()=>{stopGameTimers();state.running=false;});await page.click('#party-inspector-close');
 await check('no runtime errors',()=>page.evaluate(()=>__errors.length===0 || __errors));
}
await fs.writeFile(options.artifacts+'/'+(options.baseline?'gameplay-baseline':'gameplay-report-'+options.protocol)+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});if(!options.keepSpace)await task.finish({keep:[]});
if(!options.baseline && reports.some(r=>r.status==='FAIL'))throw Error('Gameplay checks failed');
})();
