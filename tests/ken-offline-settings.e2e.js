// Failure cases: hidden-map codes leak into summaries, avoided bosses still grant
// offline loot, slot filters affect hidden equipment, and returning overrides the chosen log.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || 'KEN 離線與設定回報驗收'), page = task.page('p1'), reports = [], sources = {};
console.log({spaceId:task.spaceId});
for (const file of ['index.html','js/01-drops-config.js','js/10-ui-tabs.js','js/27-offline-rewards.js','js/addon-switches.js','tests/ken-offline-settings.e2e.js']) sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name, fn) {
    try { const result = await fn(); if (result !== true) throw Error(JSON.stringify(result)); reports.push({name,status:'PASS'}); }
    catch (error) { reports.push({name,status:'FAIL',error:String(error)}); console.log({name,error:String(error)}); }
    await fs.writeFile(options.artifacts+'/ken-offline-settings-'+(options.baseline?'baseline-':'')+options.protocol+'.json', JSON.stringify({method:'Actual Ego browser; isolated synthetic storage/clock, native kill/save/document-reopen settlement, settings apply/reload and backpack controls',sources,reports},null,2));
}
async function click(selector) {
    await page.evaluate(selector => {
        const element=document.querySelector(selector);
        element.focus({preventScroll:true});element.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    },selector);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const point=await page.evaluate(selector => {
        const element=document.querySelector(selector),rect=element.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,hit=document.elementFromPoint(x,y);
        return hit===element||element.contains(hit)?{x,y}:null;
    },selector);
    if(!point)throw Error('Control is obscured: '+selector);
    await page.mouse.click(point.x,point.y);
}
let init;
const prefix = 'ken-offline-settings-'+Date.now()+':';
async function boot(data = {}, now = Date.now()) {
    if (init) await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
    await page.evaluate(() => {window.name = '';});
    init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
        const prefix = ${JSON.stringify(prefix)};
        const data = window.name.startsWith(prefix) ? JSON.parse(window.name.slice(prefix.length)) : ${JSON.stringify(data)};
        window.__kenData = data; window.__kenNow = ${now}; window.__kenErrors = [];
        Date.now = () => __kenNow;
        const persist = () => {window.name = prefix+JSON.stringify(data);};
        const storage = {getItem:k=>data[k]??null,setItem(k,v){data[k]=String(v);persist();},removeItem(k){delete data[k];persist();},key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length;}};
        for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{value:storage,configurable:true});
        window.BroadcastChannel = undefined;
        addEventListener('error',event=>__kenErrors.push(event.message));
    })();`})).identifier;
    await page.goto(options.url+'?ken-offline-settings');
    await page.cdp('Page.bringToFront');
    await page.waitForFunction(() => document.readyState === 'complete' && typeof startGame === 'function');
    await page.evaluate(() => {_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});
}
async function create() {
    await page.evaluate(() => {
        selectClass('m_knight');document.getElementById('creation-name').value='合成回報驗收';startGame();stopGameTimers();
        player.lv=80;player.gold=1000000;player.autoSellOn=false;player.classicMode=false;calcStats();state.running=false;
    });
}
async function sample(map, bosses = [], avoid = false) {
    await boot();await create();
    return page.evaluate(({map,bosses,avoid}) => {
        state.running=true;
        if (isHiddenArea(map)) enterHiddenArea(map); else {setMapSelectors(map);changeMap(true);}
        const random=Math.random;Math.random=()=>.5;
        try {
            for (let i=0;i<3;i++) {if(i)__kenNow+=8000;mapState.mobs[0]={...DB.mobs.orc,uid:uid(),curHp:0,st:newMobStatus()};killMob(0);}
            for (const id of bosses) {
                if (!DB.maps[map].includes(id)) DB.maps[map].push(id);
                let mob=DB.mobs[id];while(mob.transformTo)mob=DB.mobs[mob.transformTo];
                mapState.mobs[0]={...mob,uid:uid(),curHp:0,st:newMobStatus(),_bornMs:__kenNow-1000};killMob(0);
            }
        } finally {Math.random=random;}
        document.getElementById('set-teleport').checked=avoid;
        player.hp=player.mhp;player.mp=player.mmp;saveGame();stopGameTimers();state.running=false;
        return {data:{...__kenData},now:__kenNow,profile:player.offlineHunt.profile,eligible:player.offlineHunt.eligible};
    },{map,bosses,avoid});
}
async function load(saved, minutes, setup) {
    await boot(saved.data,saved.now+minutes*60000);
    if (setup) await page.evaluate(setup);
    await page.evaluate(() => {currentSlot=1;loadGame();stopGameTimers();});
    await page.waitForFunction(() => document.getElementById('sys-log').textContent.includes('離線戰利品'));
    await page.evaluate(() => {stopGameTimers();state.running=false;});
}
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
const hidden = ['hidden_lab_nolife','hidden_lab_darkmagic','hidden_seal_spirit','hidden_seal_monster','hidden_seal_demon','hidden_antqueen'];
for (const map of hidden) {
    const saved=await sample(map);
    await check(map+': native sample stores a Chinese map name',() => page.evaluate(map => player.offlineHunt.mapName===HIDDEN_AREA_NAMES[map] && player.offlineHunt.profile.mapName===HIDDEN_AREA_NAMES[map],map));
    await load(saved,5);
    await check(map+': document reopen shows Chinese offline summary',() => page.evaluate(map => document.getElementById('sys-log').textContent.includes('離線掛機完成：'+HIDDEN_AREA_NAMES[map]) && !document.getElementById('sys-log').textContent.includes('完成：'+map),map));
}
let old=await sample('hidden_seal_monster');
old.data=await page.evaluate(() => {
    const doc=accountRoleDoc(1),hunt=doc.p.offlineHunt;hunt.mapName=hunt.map;hunt.profile.mapName=hunt.map;
    _lzSet('lineage_idle_save_1',_saveWrap(JSON.stringify(doc)));
    for(const key of Object.keys(__kenData))if(key.includes('offline_v1_checkpoint_'))localStorage.removeItem(key);
    return {...__kenData};
});
await load(old,5);
await check('legacy saved English map labels are corrected at settlement',() => page.evaluate(() => document.getElementById('sys-log').textContent.includes('離線掛機完成：魔物封印室')));
const bossIds=['sr_gashadokuro','sr_tamamo'];
const bossSave=await sample('sunrise_north',bossIds);
await check('native kills retain both proven bosses for offline planning',() => bossSave.eligible && bossSave.profile.bosses.length===2);
for(const mode of ['off','all','selected']) {
    await boot(bossSave.data,bossSave.now);
    const saved=await page.evaluate(mode => {
        currentSlot=1;loadGame();stopGameTimers();state.running=true;
        setMapSelectors('sunrise_north');changeMap(true);
        document.getElementById('set-teleport').checked=mode!=='off';
        AFK_BOSSAVOID.set('sunrise_north',mode==='selected'?['sr_tamamo']:[]);
        saveGame();stopGameTimers();state.running=false;
        return {data:{...__kenData},now:__kenNow};
    },mode);
    await load(saved,720,() => {
        if(!DB.maps.sunrise_north.includes('sr_tamamo'))DB.maps.sunrise_north.push('sr_tamamo');
        window.__kenBossDrops=[];
        const original=gainItem;window.gainItem=function(id,count){if(id.startsWith('ken_boss_'))__kenBossDrops.push(id);return original.apply(this,arguments);};
        for(const [id,mobId]of [['ken_boss_a','sr_gashadokuro'],['ken_boss_b','sr_sessyoseki']]) {
            DB.items[id]={n:id,type:'mat',c:'text-white',w:0,p:1,req:'all'};MOB_DROPS[DB.mobs[mobId].n]=[[id,100]];
        }
        let seed=12345;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed+.5)/4294967296;};
    });
    await check(mode+': offline boss rewards follow the saved avoidance selection',() => page.evaluate(mode => {
        const a=player.inv.some(item=>item.id==='ken_boss_a'),b=player.inv.some(item=>item.id==='ken_boss_b');
        return mode==='off' ? a&&b : mode==='all' ? !a&&!b : a&&!b;
    },mode));
    await check(mode+': ordinary hunting still grants and saves rewards',() => page.evaluate(() => player.gold>0 && accountRoleDoc(1).p.gold===player.gold && !player.dead));
}
const pureBossSave=await sample('antaras_lair',['antaras'],true);
await load(pureBossSave,5);
await check('pure boss rooms keep their native no-avoidance exception',()=>page.evaluate(()=>document.getElementById('sys-log').textContent.includes('含頭目')&&document.getElementById('set-teleport').checked));
await boot();await create();
await page.evaluate(() => {
    window.__kenSlots=['helm','armor','shield','cloak','gloves','boots','tshirt','shin','petarm'];
    player.inv=__kenSlots.map((slot,index)=>({id:Object.keys(DB.items).find(id=>DB.items[id].type==='arm'&&DB.items[id].slot===slot),uid:'ken-slot-'+slot,en:0,cnt:1,bless:false,anc:false,attr:false,seteff:false}));
    player.inv.push({id:'blt_body',uid:'ken-belt',en:0,cnt:1,bless:false,anc:false,attr:false,seteff:false});
    player.inv.push({id:'scroll_armor',uid:'ken-scroll',en:0,cnt:100,bless:false,anc:false,attr:false,seteff:false});
    calcStats();renderTabs(true);switchTab('armors',document.querySelector('[onclick="switchTab(\'armors\', this)"]'));
});
const slots=await page.evaluate(() => __kenSlots);
await check('armor page exposes every equipment-slot category',() => page.evaluate(() => __kenSlots.every(slot=>document.querySelector('#tab-armors [data-backpack-category="'+slot+'"]'))));
for(const slot of slots) {
    if(!await page.evaluate(slot=>!!document.querySelector('#tab-armors [data-backpack-category="'+slot+'"]'),slot))continue;
    await click('#tab-armors [data-backpack-category="'+slot+'"]');
    await check(slot+': category and redraw show only the matching slot',() => page.evaluate(slot => {
        renderTabs(true);const items=[...document.querySelectorAll('#tab-armors [data-inventory-uid]')];
        return items.length===1&&items[0].dataset.inventoryUid==='ken-slot-'+slot&&inventoryCategories.arm===slot;
    },slot));
}
const hasSlots=await page.evaluate(()=>!!document.querySelector('[data-backpack-category="helm"]'));
if(hasSlots) {
    await click('#tab-armors [data-backpack-category="helm"]');
    await page.fill('#afk-isearch-input','不存在的合成物品');
    await check('slot categories compose with name search',()=>page.evaluate(()=>![...document.querySelectorAll('#tab-armors [data-inventory-uid]')].some(el=>getComputedStyle(el).display!=='none')));
    await page.fill('#afk-isearch-input','');
    await click('#tab-armors [onclick="toggleQuickJunk(\'arm\')"]');await click('#tab-armors [data-qj-select-all="arm"]');await click('#tab-armors [onclick="runQuickJunk(\'arm\')"]');
    await check('slot bulk junk leaves other slots unchanged',()=>page.evaluate(()=>player.inv.find(item=>item.uid==='ken-slot-helm').junk===true&&player.inv.filter(item=>item.uid!=='ken-slot-helm').every(item=>!item.junk)));
    await click('#tab-armors [data-backpack-category="armor"]');await click('#tab-armors [onclick="toggleQuickEnhance(\'arm\')"]');
    await page.selectOption('#qe-target-arm','1');await click('#tab-armors input[onchange*="quickEnhanceSelectAll"]');
    await check('slot batch enhancement locks category changes',()=>page.evaluate(()=>[...document.querySelectorAll('#tab-armors [data-backpack-category]')].every(button=>button.disabled)));
    await click('#tab-armors [onclick="runQuickEnhance(\'arm\')"]');
    await check('slot enhancement consumes one scroll and leaves hidden armor untouched',()=>page.evaluate(()=>player.inv.some(item=>DB.items[item.id]?.slot==='armor'&&item.en===1)&&player.inv.filter(item=>item.uid.startsWith('ken-slot-')&&DB.items[item.id]?.slot!=='armor').every(item=>item.en===0)&&player.inv.find(item=>item.uid==='ken-scroll').cnt===99));
    await page.evaluate(()=>cancelQuickEnhance('arm'));
    for(const width of [1330,1920])for(const scale of [60,75,80,100])for(const right of [220,300,460]) {
        await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        await page.evaluate(({scale,right})=>{setUiScale(scale);for(const property of ['width','min-width','max-width'])document.getElementById('col-right').style.setProperty(property,right+'px','important');},{scale,right});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await check(width+' '+scale+'% '+right+'px: slot categories stay in a single scrollable row',()=>page.evaluate(()=>{
            const strip=document.querySelector('#tab-armors .backpack-categories'),buttons=[...strip.querySelectorAll('button')],nav=strip.parentElement,r=nav.getBoundingClientRect(),panel=document.getElementById('tab-content-panel').getBoundingClientRect();
            return strip.scrollWidth>strip.clientWidth&&buttons.every(button=>Math.abs(button.getBoundingClientRect().top-buttons[0].getBoundingClientRect().top)<1)&&r.left>=panel.left-1&&r.right<=panel.right+1;
        }));
    }
    await page.evaluate(()=>{document.querySelector('#tab-armors .backpack-categories').scrollLeft=0;});
    await click('#tab-armors [data-category-scroll="right"]');
    await check('right arrow reveals more armor slots',()=>page.evaluate(()=>document.querySelector('#tab-armors .backpack-categories').scrollLeft>0));
    await page.evaluate(()=>{window.__kenScroll=document.querySelector('#tab-armors .backpack-categories').scrollLeft;renderTabs(true);switchTab('weapons',document.querySelector('[onclick="switchTab(\'weapons\', this)"]'));switchTab('armors',document.querySelector('[onclick="switchTab(\'armors\', this)"]'));});
    await check('redraw and tab changes preserve the slot category and horizontal position',()=>page.evaluate(()=>inventoryCategories.arm==='armor'&&Math.abs(document.querySelector('#tab-armors .backpack-categories').scrollLeft-__kenScroll)<1));
    await click('#tab-armors [data-category-scroll="left"]');
    await check('left arrow returns to the first armor categories',()=>page.evaluate(()=>document.querySelector('#tab-armors .backpack-categories').scrollLeft===0));
}
await boot();await create();
await check('returning keeps the existing automatic system-log default',()=>page.evaluate(()=>{
    switchLogTab('combat');dispatchEvent(new Event('blur'));dispatchEvent(new Event('focus'));return _logTab==='sys';
}));
await click('#btn-automation');await click('#settings-tab-addons');
await check('addon settings expose the opt-in to keep the original view',()=>page.evaluate(()=>!!document.querySelector('[data-addon-id="keepview"]')&&!AFK_TOGGLES.enabled('keepview')));
if(await page.evaluate(()=>!!document.querySelector('[data-addon-id="keepview"]'))) {
    await click('[data-addon-id="keepview"]');await click('#addons-cancel');
    await check('cancel discards the keep-view draft',()=>page.evaluate(()=>!document.querySelector('[data-addon-id="keepview"]').checked));
    await click('[data-addon-id="keepview"]');await click('#addons-apply');
    await page.waitForFunction(()=>document.readyState==='complete'&&AFK_TOGGLES.enabled('keepview'));
    await page.evaluate(()=>{_getLzWorker=()=>null;currentSlot=1;loadGame();stopGameTimers();});
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
    await page.evaluate(()=>{stopGameTimers();state.running=false;});
    for(const event of ['focus','visibilitychange','pageshow'])await check(event+': returning preserves the chosen combat log',()=>page.evaluate(event=>{
        switchLogTab('combat');dispatchEvent(new Event('blur'));
        if(event==='visibilitychange')document.dispatchEvent(new Event(event));
        else dispatchEvent(event==='pageshow'?new PageTransitionEvent(event,{persisted:true}):new Event(event));
        return _logTab==='combat'&&!document.getElementById('combat-log').classList.contains('hidden');
    },event));
    await click('#btn-automation');await click('#settings-tab-addons');await click('[data-addon-id="keepview"]');await click('#addons-apply');
    await page.waitForFunction(()=>document.readyState==='complete'&&!AFK_TOGGLES.enabled('keepview'));
    await page.evaluate(()=>{_getLzWorker=()=>null;currentSlot=1;loadGame();stopGameTimers();});
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
    await check('turning keep-view off restores automatic system-log selection',()=>page.evaluate(()=>{stopGameTimers();state.running=false;switchLogTab('combat');dispatchEvent(new Event('blur'));dispatchEvent(new Event('focus'));return _logTab==='sys';}));
}
await check('no browser runtime errors',()=>page.evaluate(()=>!__kenErrors.length||__kenErrors));
await page.evaluate(()=>{window.name='';});
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({checks:reports.length,passed:reports.filter(row=>row.status==='PASS').length,failed:reports.filter(row=>row.status==='FAIL')});
if(!options.baseline&&reports.some(row=>row.status==='FAIL'))throw Error('KEN offline/settings regression');
if(!options.keepSpace)await task.finish({keep:[]});
