(async()=>{
const fs=await import('node:fs/promises'),task=await taskSpace(options.space||'遊玩回報修正驗證'),page=task.page(options.page||'p1'),reports=[];console.log({spaceId:task.spaceId});
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__fixData={};window.__errors=[];const s={getItem:k=>__fixData[k]??null,setItem:(k,v)=>__fixData[k]=String(v),removeItem:k=>delete __fixData[k],key:i=>Object.keys(__fixData)[i]??null,get length(){return Object.keys(__fixData).length}};Object.defineProperty(window,'localStorage',{value:s,configurable:true});Object.defineProperty(window,'sessionStorage',{value:s,configurable:true});addEventListener('error',e=>__errors.push(e.message));})();`})).identifier;
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/play-fixes-'+(options.baseline?'baseline':options.protocol)+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?play-fixes='+Date.now());await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_knight');document.getElementById('creation-name').value='合成測試角色';startGame();stopGameTimers();player.lv=60;player.autoSellOn=false;calcStats();});
// 1. Enhanced single items rejoin the stack with the same enhancement.
await check('an enhanced single rejoins the existing stack with the same enhancement',()=>page.evaluate(()=>{
 player.inv=[{id:'wpn_dagger1',uid:uid(),cnt:3,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false},{id:'wpn_dagger1',uid:uid(),cnt:1,en:1,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false},{id:'scroll_weapon',uid:uid(),cnt:5,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false}];
 activeScroll=player.inv[2];doEnhance(player.inv[0].uid,false);
 const daggers=player.inv.filter(i=>i.id==='wpn_dagger1');return daggers.length===2&&daggers.some(i=>i.en===0&&i.cnt===2)&&daggers.some(i=>i.en===1&&i.cnt===2)||daggers;}));
// 2. A full set of rings asks which side to replace.
await check('equipping a third ring asks which side to replace and keeps the other',async()=>{
 const ids=await page.evaluate(()=>{const ring=Object.keys(DB.items).filter(k=>DB.items[k].slot==='ring'&&!DB.items[k].unique&&!DB.items[k].relic&&checkCanEquip({id:k,en:0}));player.lv=60;player.eq.ring1={id:ring[0],uid:uid(),cnt:1,en:0};player.eq.ring2={id:ring[1],uid:uid(),cnt:1,en:0};const n={id:ring[2],uid:uid(),cnt:1,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false};player.inv=[n];equipItem(n);return {ring,left:player.eq.ring1.uid};});
 await page.waitForSelector('#acc-slot-dialog [data-acc-slot="ring2"]');
 const buttons=await page.evaluate(()=>[...document.querySelectorAll('#acc-slot-dialog [data-acc-slot]')].map(b=>b.dataset.accSlot).join());
 await page.click('#acc-slot-dialog [data-acc-slot="ring2"]');
 return page.evaluate(([ids,buttons])=>buttons==='ring1,ring2'&&player.eq.ring2.id===ids.ring[2]&&player.eq.ring1.uid===ids.left&&player.inv.some(i=>i.id===ids.ring[1])&&document.getElementById('acc-slot-dialog').hidden,[ids,buttons]);
});
await check('an empty ring slot is still filled without asking',()=>page.evaluate(()=>{player.eq.ring2=null;const ring=Object.keys(DB.items).filter(k=>DB.items[k].slot==='ring'&&!DB.items[k].unique&&!DB.items[k].relic&&checkCanEquip({id:k,en:0}));const n={id:ring[3]||ring[0],uid:uid(),cnt:1,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false};player.inv.push(n);equipItem(n);return !!player.eq.ring2&&document.getElementById('acc-slot-dialog').hidden;}));
// 4. Villages no longer refill; they regenerate 50% faster; deaths revive at half.
await check('returning to a village keeps current HP and MP',()=>page.evaluate(()=>{player.hp=Math.floor(player.mhp*.4);player.mp=Math.floor(player.mmp*.3);const hp=player.hp,mp=player.mp;setMapSelectors(getHomeTown());changeMap(true);stopGameTimers();return player.hp===hp&&player.mp===mp||{hp:player.hp,mp:player.mp,hp0:hp,mp0:mp};}));
await check('safe zones restore HP and MP 50% faster',()=>page.evaluate(()=>{const town=safeZoneRegenInterval(160);mapState.current='training';const field=safeZoneRegenInterval(160);setMapSelectors(getHomeTown());changeMap(true);stopGameTimers();return town===107&&field===160;}));
// 2b. Giving a leader's ring to a mercenary whose ring slots are full also asks which side.
const allyRing=await page.evaluate(()=>{
 const ring=Object.keys(DB.items).filter(k=>DB.items[k].slot==='ring'&&!DB.items[k].unique&&!DB.items[k].relic&&checkCanEquip({id:k,en:0}));
 currentSlot=1;player.allies=[];saveGame();const d=JSON.parse(saveStateJson());d.p.enSeed='fix-ally';d.p.name='合成傭兵';d.p.lv=60;d.p.allies=[];d.p.inv=[];
 d.p.eq.ring1={id:ring[0],uid:'ally-left',cnt:1,en:0};d.p.eq.ring2={id:ring[1],uid:'ally-right',cnt:1,en:0};_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(d)));
 player.allies=[buildAlly('2')];const n={id:ring[2],uid:uid(),cnt:1,en:0,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false};player.inv=[n];
 allyEquipItem('2',encodeURIComponent(n.uid));return {ring,uid:n.uid};});
await page.waitForSelector('#acc-slot-dialog [data-acc-slot="ring2"]');
await check('a mercenary with full ring slots is asked which side to replace without changing anything first',()=>page.evaluate(r=>{const src=JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_2')).payload).p;return [...document.querySelectorAll('#acc-slot-dialog [data-acc-slot]')].map(b=>b.dataset.accSlot).join()==='ring1,ring2'&&src.eq.ring2.uid==='ally-right'&&player.inv.some(i=>i.uid===r.uid);},allyRing));
await page.click('#acc-slot-dialog [data-acc-slot="ring2"]');
await check('the chosen mercenary side is replaced and the old ring returns to the leader',()=>page.evaluate(r=>{const src=JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_2')).payload).p;return src.eq.ring2.id===r.ring[2]&&src.eq.ring1.uid==='ally-left'&&player.inv.some(i=>i.id===r.ring[1])&&!player.inv.some(i=>i.uid===r.uid)||{eq:src.eq,inv:player.inv.map(i=>i.id)};},allyRing));
await check('dying and returning to town revives at half HP and MP',()=>page.evaluate(()=>{setMapSelectors('training');changeMap(true);stopGameTimers();player.hp=0;player.mp=0;setMapSelectors(getHomeTown());changeMap(true);stopGameTimers();return player.hp===Math.ceil(player.mhp/2)&&player.mp===Math.ceil(player.mmp/2)||{hp:player.hp,mp:player.mp};}));
await check('no runtime errors',()=>page.evaluate(()=>__errors.length===0||__errors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});if(!options.keepSpace)await task.finish({keep:[]});if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Play fixes failed');
})();
