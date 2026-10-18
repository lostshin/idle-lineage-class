// Failure cases: mutually exclusive ally buffs enabled together, stat buttons at
// the natural cap, stale asset URLs, and missing or duplicate death buyback records.
(async () => {
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || 'KEN 回報修正驗收'), page = task.page(options.page || 'p1');
console.log({spaceId:task.spaceId});
const reports = [], sources = {}, bucket = 'codex_ken_' + Date.now();
for (const f of ['index.html','js/00-data.js','js/08-items-equip.js','js/10-ui-tabs.js','js/04-combat-attack.js','js/11-world-map.js','tests/ken-reports.e2e.js']) sources[f] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+f)).digest('hex');
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    if (!location.href.startsWith(${JSON.stringify(options.url)})) return;
    const native = localStorage, key = ${JSON.stringify(bucket)}, file = location.protocol==='file:', prefix=key+':';
    const data=JSON.parse((file?(window.name.startsWith(prefix)?window.name.slice(prefix.length):null):native.getItem(key))||'{}');
    let live=true;const persist=()=>{if(live){if(file)window.name=prefix+JSON.stringify(data);else native.setItem(key,JSON.stringify(data));}};
    window.__ken={data,errors:[],cleanup(){live=false;if(file)window.name='';else native.removeItem(key);}};
    const s={getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v);persist();},removeItem:k=>{delete data[k];persist();},key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length;}};
    for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});
    window.BroadcastChannel=undefined;addEventListener('error',e=>__ken.errors.push(e.message));
})();`})).identifier;
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/ken-reports-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; native synthetic role/save/load, checkbox clicks, allocation and death/buyback; no real player storage',sources,reports},null,2));}
async function ready(){await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});}
async function reloadRole(slot=1){await page.reload();await ready();await page.evaluate(slot=>{currentSlot=slot;loadGame();},slot);await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));await page.evaluate(()=>{stopGameTimers();state.running=false;});}
const awaken = ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'];
const chip = sid => `[onchange="setAllyAutoBuff('2','${sid}',this.checked)"]`;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.goto(options.url+'?ken-reports');await ready();
await page.evaluate(awaken=>{
    selectClass('m_royal');document.getElementById('creation-name').value='合成回報隊長';startGame();stopGameTimers();state.running=false;
    player.lv=60;player.classicMode=true;player.config.kenUnknown={keep:true};calcStats();saveGame();
    const d=JSON.parse(saveStateJson());Object.assign(d.p,{cls:'dragon',avatar:'男龍騎士',name:'合成龍騎士',enSeed:'ken-dragon',_roleEpoch:'ken-dragon',mastery:null,skills:[...awaken,'sk_dragon_bloodlust'],allies:[],buffs:{},config:{autoBuffSkills:{}}});
    _lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(d)));player.allies=[buildAlly('2')];_squadSigSkill='';renderSquadPanel();switchSquadTab('skill');
},awaken);
await page.click(chip(awaken[0]));
await check('non-mastered dragon selection locks the other two awakens only',()=>page.evaluate(awaken=>{const a=player.allies[0],inputs=awaken.map(s=>document.querySelector(`[onchange="setAllyAutoBuff('2','${s}',this.checked)"]`));const blood=document.querySelector('[onchange="setAllyAutoBuff(\'2\',\'sk_dragon_bloodlust\',this.checked)"]');return inputs[0].checked&&!inputs[0].disabled&&inputs.slice(1).every(e=>!e.checked&&e.disabled)&&!!blood&&!blood.disabled&&_mercAutoOn(a,awaken[0]);},awaken));
await page.click(chip(awaken[0]));
await check('unchecking the current awaken unlocks every choice',()=>page.evaluate(awaken=>awaken.every(s=>{const e=document.querySelector(`[onchange="setAllyAutoBuff('2','${s}',this.checked)"]`);return !e.checked&&!e.disabled;}),awaken));
await page.click(chip(awaken[1]));await page.evaluate(()=>saveGame());await reloadRole();
await check('ally selection and mutual exclusion survive native reload',()=>page.evaluate(awaken=>{switchSquadTab('skill');return player.allies[0]._autoBuff[awaken[1]]===true&&awaken.filter(s=>_mercAutoOn(player.allies[0],s)).length===1&&document.querySelector(`[onchange="setAllyAutoBuff('2','${awaken[2]}',this.checked)"]`).disabled&&player.config.kenUnknown.keep;},awaken));
for(const [active,expected]of [[awaken[1],awaken[1]],['',awaken[0]]]){
    await page.evaluate(({awaken,active})=>{const a=player.allies[0];a.mastery=null;a._autoBuff=Object.fromEntries(awaken.map(s=>[s,true]));a.buffs=active?{[active]:60}:{};_squadSigSkill='';renderSquadPanel();},{awaken,active});
    await check('legacy multiple selections keep '+(active?'the active awaken':'the first learned awaken'),()=>page.evaluate(({awaken,expected})=>awaken.filter(s=>_mercAutoOn(player.allies[0],s)).join()===expected,{awaken,expected}));
}
await page.evaluate(awaken=>{const a=player.allies[0];a.mastery='k_awaken';a._autoBuff=Object.fromEntries(awaken.map(s=>[s,false]));a.buffs={};renderSquadPanel();},awaken);
for(const sid of awaken)await page.click(chip(sid));
await check('awaken mastery allows all three while retaining independent toggles',()=>page.evaluate(awaken=>awaken.every(s=>{const e=document.querySelector(`[onchange="setAllyAutoBuff('2','${s}',this.checked)"]`);return e.checked&&!e.disabled&&_mercAutoOn(player.allies[0],s);}),awaken));
await page.evaluate(()=>{player.allies=[];switchTab('stats',document.querySelector('[onclick="switchTab(\'stats\', this)"]'));window.__kenStat=s=>document.querySelector('.ability-primary-'+s+' .alloc-plus');});
for(const key of ['str','dex','con','int','wis','cha']){
    await page.evaluate(key=>{player.panacea={};player.alloc={str:0,dex:0,con:0,int:0,wis:0,cha:0};player.alloc[key]=60-player.base[key]-2;player.panacea[key]=2;player.bonus=3;calcStats();updateUI();},key);
    await check(key+': natural 60 hides its plus while another uncapped stat stays available',()=>page.evaluate(key=>{const other=key==='str'?'dex':'str';return naturalStat(key)===60&&__kenStat(key).classList.contains('hidden')&&!__kenStat(other).classList.contains('hidden');},key));
}
await page.evaluate(()=>{player.panacea={};player.alloc.str=59-player.base.str;player.bonus=2;calcStats();player.d.str=80;updateUI();});
await check('equipment/buff total over 60 does not hide an uncapped natural stat',()=>page.evaluate(()=>naturalStat('str')===59&&!__kenStat('str').classList.contains('hidden')));
await page.click('.ability-primary-str .alloc-plus');
await check('allocating 59 to 60 spends exactly one point and immediately hides plus',()=>page.evaluate(()=>naturalStat('str')===60&&player.bonus===1&&__kenStat('str').classList.contains('hidden')));
await page.evaluate(()=>{gainItem('candle',1,true,true);startRespec();_respec.pts=100;_respec.draft.str=60-createBase[player.cls].str;updateUI();});
await check('candle draft at 60 hides plus but retains minus',()=>page.evaluate(()=>__kenStat('str').classList.contains('hidden')&&!document.querySelector('.ability-primary-str .alloc-minus').classList.contains('hidden')));
await page.click('.ability-primary-str .alloc-minus');
await check('reducing a candle draft stat reopens its plus',()=>page.evaluate(()=>createBase[player.cls].str+_respec.draft.str===59&&!__kenStat('str').classList.contains('hidden')));
await page.evaluate(()=>cancelRespec());
await check('hound fang and barrier scroll use new cache-safe image URLs without changing value or effects',()=>page.evaluate(()=>getIconUrl(DB.items.pet_fang_hound)==='assets/icons/accessories/hound-fang-v2.png'&&getIconUrl(DB.items.scroll_magicbarrier)==='assets/icons/items/magic-barrier-scroll-v2.png'&&DB.items.scroll_magicbarrier.p===1500&&DB.items.scroll_magicbarrier.eff==='magicbarrier'&&DB.items.pet_fang_hound.petHit===2));
await check('both replacement icons decode as 64px assets',()=>page.evaluate(async()=>{for(const id of ['pet_fang_hound','scroll_magicbarrier']){const image=new Image();image.src=getIconUrl(DB.items[id]);try{await image.decode();}catch(e){return {id,error:String(e)};}if(image.naturalWidth!==64||image.naturalHeight!==64)return false;}return true;}));
await page.evaluate(()=>{setMapSelectors('town_aden');changeMap(true);interactNPC('npc_norse','town_aden');});
await check('Norse crafting displays the corrected fang without rotating other teeth',()=>page.evaluate(()=>{const root=document.getElementById('interaction-content'),img=root.querySelector('[data-tip-id="pet_fang_hound"] img');return img?.getAttribute('src')==='assets/icons/accessories/hound-fang-v2.png'&&['pet_fang_steel','pet_fang_ruin','pet_fang_victory'].every(id=>root.querySelector('[data-tip-id="'+id+'"] img')?.getAttribute('src')===getIconUrl(DB.items[id]));}));
await page.evaluate(()=>{renderTownShop(document.getElementById('interaction-content'),'default');gainItem('scroll_magicbarrier',5,true,true);gainItem('pet_fang_hound',1,true,true);renderTabs(true);});
await check('shop and inventory use the replacement scroll with the original 1500 gold base price',()=>page.evaluate(()=>{const shop=[...document.querySelectorAll('#shop-items-list .list-item')].find(e=>e.textContent.includes('魔法卷軸(魔法屏障)'));return shop?.querySelector('img')?.getAttribute('src')==='assets/icons/items/magic-barrier-scroll-v2.png'&&shop.textContent.includes(shopPrice(1500).toLocaleString())&&!!document.querySelector('#tab-items img[src="assets/icons/items/magic-barrier-scroll-v2.png"]');}));
// Death buyback is investigated without changing its rules or copy.
await page.evaluate(()=>{currentSlot=3;selectClass('m_royal');document.getElementById('creation-name').value='合成死亡買回';document.getElementById('create-classic-toggle').checked=true;startGame();stopGameTimers();state.running=false;player.lv=60;player.mastery=null;player.allies=[];player.deathLog=[];player.exp=Math.floor(getExpReq(60)*.2);player.gold=100000000;player.statuses={};player.buffs={};player.dead=false;setMapSelectors('training');changeMap(true);window.__kenDeathBase={exp:player.exp,gold:player.gold};killPlayer();saveGame();});
await check('classic normal-map death records the actual five-percent loss',()=>page.evaluate(()=>{const loss=Math.floor(getExpReq(60)*.05);return player.exp===__kenDeathBase.exp-loss&&player.deathLog.length===1&&player.deathLog[0].loss===loss;}));
await page.evaluate(()=>revive());
await check('native revival persists the death record without saving a dead character',()=>page.evaluate(()=>!player.dead&&accountRoleDoc(3).p.deathLog[0].loss===player.deathLog[0].loss));
await reloadRole(3);await page.evaluate(()=>{revive();state.running=false;setMapSelectors('town_aden');changeMap(true);interactNPC('npc_arkata','town_aden');window.__kenBeforeBuy={exp:player.exp,gold:player.gold,loss:player.deathLog[0].loss};});
await page.waitForFunction(()=>!!document.querySelector('[onclick="arkataBuyback(0)"]'));
await page.click('[onclick="arkataBuyback(0)"]');
await check('buyback after reload restores half once and charges the native fee',()=>page.evaluate(()=>player.exp===__kenBeforeBuy.exp+Math.floor(__kenBeforeBuy.loss*.5)&&player.gold===__kenBeforeBuy.gold-60*60*1000&&player.deathLog.length===0));
await check('the consumed buyback cannot be repeated',()=>page.evaluate(()=>{const before={exp:player.exp,gold:player.gold};arkataBuyback(0);return player.exp===before.exp&&player.gold===before.gold;}));
for(const kind of ['zero-progress','siege','normal-mode']){
    await check(kind+': no actual loss creates no buyback record',()=>page.evaluate(kind=>{player.classicMode=kind!=='normal-mode';player.dead=false;player.statuses={};player.deathLog=[];player.exp=kind==='zero-progress'?0:Math.floor(getExpReq(player.lv)*.2);mapState.current=kind==='siege'?SIEGE_OUTER_INNER[0]:'training';mapState.mobs=[];const before=player.exp;killPlayer();return player.exp===before&&player.deathLog.length===0;},kind));
}
await check('rift death exits natively without losing EXP or adding a buyback record',()=>page.evaluate(()=>{player.classicMode=true;player.dead=false;player.statuses={};player.deathLog=[];player.exp=Math.floor(getExpReq(player.lv)*.2);setMapSelectors('town_rift');changeMap(true);gainItem('mat_crack_core',1,true,true);delete player.riftRewardMs;enterRift();const entered=state.riftRun&&mapState.current==='rift_battle',before=player.exp;killPlayer();return entered&&!state.riftRun&&!player.dead&&mapState.current==='town_rift'&&player.exp===before&&player.deathLog.length===0;}));
await check('duel death is exempt only during an actual arena duel',()=>page.evaluate(()=>{player.dead=false;player.statuses={};player.deathLog=[];setMapSelectors('town_gludin');changeMap(true);openPvpArena();const select=document.querySelector('#pvp-slot-sel');if(!select)return {missing:'native duel slot selector'};select.value='2';pvpChallengeSlot();const exempt=pvpArenaDeathExempt(),before=player.exp;killPlayer();const result=exempt&&player.exp===before&&player.deathLog.length===0;pvpArenaAbort('合成驗收完成');return result;}));
await check('no runtime errors',()=>page.evaluate(()=>__ken.errors.length===0||__ken.errors));
await page.evaluate(()=>{state.running=false;__ken.cleanup();});await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(reports.some(r=>r.status==='FAIL'))throw Error('KEN reports failed');
if(!options.keepSpace)await task.finish({keep:[]});
})();
