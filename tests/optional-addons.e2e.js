(async () => {
const fs = await import('node:fs/promises');
const task = await taskSpace(options.space || '可選加掛與行動版驗收'), page = task.page(options.page || 'p1');
console.log({spaceId:task.spaceId});
const bucket = 'codex_optional_fixture_' + Date.now(), reports = [];
const crypto = await import('node:crypto');
const html = await fs.readFile(options.root+'/index.html','utf8');
const sources = {};
for (const [,url] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)) { const path=url.split('?')[0]; if(!path.startsWith('http')) sources[path]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+path)).digest('hex'); }
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source:`(() => {
    if (!location.href.startsWith(${JSON.stringify(options.url)})) return;
    const native = localStorage, key = ${JSON.stringify(bucket)}, fileFixture = location.protocol === 'file:';
    const prefix = key + ':';
    const data = JSON.parse((fileFixture ? (window.name.startsWith(prefix) ? window.name.slice(prefix.length) : null) : native.getItem(key)) || '{}');
    let live = true;
    const persist = () => { if (!live) return; if (fileFixture) window.name = prefix + JSON.stringify(data); else native.setItem(key, JSON.stringify(data)); };
    window.__addonTest = {data, errors:[], fail:'', persist, cleanup(){live=false;if(fileFixture)window.name='';else native.removeItem(key);}};
    const storage = {getItem:k=>data[k]??null,setItem(k,v){if(__addonTest.fail && k.includes(__addonTest.fail))throw Error('synthetic write failure');data[k]=String(v);persist();},removeItem(k){delete data[k];persist();},key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length;}};
    Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
    Object.defineProperty(window,'sessionStorage',{value:storage,configurable:true});
    addEventListener('error',e=>__addonTest.errors.push(e.message));
})();`})).identifier;
async function check(name, fn) {
    try {const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}
    catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}
    await fs.writeFile(options.artifacts+'/optional-addons-'+options.protocol+'.json',JSON.stringify({method:'Ego browser, native settings controls and reload, isolated persistent synthetic storage; synthetic loot scenarios use controlled committed RNG',sources,reports},null,2));
}
async function open(){await page.goto(options.url+'?optional-addons-test');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});}
async function nativeClick(selector) {
    const hit = await page.evaluate(selector => {
        const el = document.querySelector(selector); if (!el) return false;
        el.scrollIntoView({block:'center'});
        const r = el.getBoundingClientRect(), target = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return target === el || el.contains(target);
    },selector);
    if (!hit) throw Error('Control is obscured: '+selector);
    await page.click(selector);
}
async function settings(){await nativeClick('#btn-automation');await nativeClick('#settings-tab-addons');}
async function viewport(width,height,touch=false){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:1});await page.waitForFunction(([w,h])=>document.documentElement.clientWidth===w&&document.documentElement.clientHeight===h,[width,height]);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
await viewport(1330,900);await open();
await page.evaluate(()=>{localStorage.setItem('afk_toggle_mobile','1');localStorage.setItem('afk_toggle_training','0');});
await page.reload();await page.waitForFunction(()=>document.readyState==='complete');
await check('all optional features default off, old preferences cannot disable the fixed base',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('mobile')&&!AFK_TOGGLES.enabled('sellconfirm')&&AFK_TOGGLES.enabled('training')&&AFK_TOGGLES.enabled('dograce')&&AFK_TOGGLES.enabled('wpnfix')&&!AFK_TOGGLES.enabled('unregistered-addon')));
await page.evaluate(()=>{selectClass('m_mage');startGame();stopGameTimers();player.name='合成加掛驗收';player.config.addonUnknown='keep';});
await settings();
await check('settings contains exactly seventeen optional switches and no floating switch panel',()=>page.evaluate(()=>document.querySelectorAll('#settings-addons input[data-addon-id]').length===17&&!document.getElementById('afk-toggles-entry')&&document.getElementById('settings-general').classList.contains('hidden')));
await nativeClick('[data-addon-id="invlist"]');
await check('editing a switch does not change the running game',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('invlist')&&!document.body.classList.contains('afk-invlist')));
await nativeClick('#addons-cancel');
await check('cancel discards the draft',()=>page.evaluate(()=>!document.querySelector('[data-addon-id="invlist"]').checked));
await nativeClick('[data-addon-id="invlist"]');
await page.evaluate(()=>{__addonTest.fail='lineage_optional_addons_v1';});
await nativeClick('#addons-apply');
await check('preference write failure keeps the running game and editable draft',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('invlist')&&document.querySelector('[data-addon-id="invlist"]').checked&&document.getElementById('addons-status').textContent.includes('失敗')));
await page.evaluate(()=>{__addonTest.fail='lineage_idle_save_';});
await nativeClick('#addons-apply');
await check('progress write failure prevents saving preferences and reloading',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('invlist')&&document.getElementById('addons-status').textContent.includes('失敗')));
await page.evaluate(()=>{__addonTest.fail='';const r=_roleReadObject(ROLE_SESSION_REGISTRY_KEY);r.syntheticOther={ts:Date.now(),slot:2,name:'合成另一分頁'};_roleWriteObject(ROLE_SESSION_REGISTRY_KEY,r);});
await nativeClick('#addons-apply');
await check('another active role blocks applying device-wide changes',()=>page.evaluate(()=>!AFK_TOGGLES.enabled('invlist')&&document.getElementById('addons-status').textContent.includes('其他角色分頁')));
await page.evaluate(()=>{const r=_roleReadObject(ROLE_SESSION_REGISTRY_KEY);delete r.syntheticOther;_roleWriteObject(ROLE_SESSION_REGISTRY_KEY,r);});
await nativeClick('#addons-apply');
await page.waitForFunction(()=>document.readyState==='complete'&&document.getElementById('main-menu').getClientRects().length>0&&AFK_TOGGLES.enabled('invlist'));
await check('native apply saves progress then reloads with only the selected option',()=>page.evaluate(()=>document.body.classList.contains('afk-invlist')&&accountRoleDoc(1).p.name==='合成加掛驗收'&&accountRoleDoc(1).p.config.addonUnknown==='keep'&&!AFK_TOGGLES.enabled('mobile')));
await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();});await settings();
await nativeClick('[data-addon-id="loadslots"]');await nativeClick('#addons-apply');
await page.waitForFunction(()=>document.readyState==='complete'&&AFK_TOGGLES.enabled('loadslots'));
await page.evaluate(()=>openLoadSelect());
await check('sixteen slots expose four native selection pages',()=>page.evaluate(()=>document.querySelectorAll('#load-page-tabs button').length===4));
await check('four-page ornament uses its own artwork and stays above character information',()=>page.evaluate(()=>{const tabs=document.getElementById('load-page-tabs'),r=tabs.getBoundingClientRect(),info=document.querySelector('.load-info-row.name').getBoundingClientRect(),buttons=[...tabs.querySelectorAll('button')];return getComputedStyle(buttons[0],'::before').backgroundImage.includes('public/assets/login/load.png')&&r.bottom<=info.top+2&&buttons.every((b,i)=>{const q=b.getBoundingClientRect();return q.left>=r.left&&q.right<=r.right&&(!i||q.left>=buttons[i-1].getBoundingClientRect().right);});}));
await check('pagination keeps original bitmap scale and centered enlarged numerals',()=>page.evaluate(()=>{const tabs=document.getElementById('load-page-tabs'),stage=document.getElementById('load-art-stage').getBoundingClientRect(),r=tabs.getBoundingClientRect(),b=tabs.querySelector('button'),style=getComputedStyle(b);return r.width/stage.width<=.35&&parseFloat(style.fontSize)*getUiScale()/stage.width<=.024&&style.display==='grid'&&style.placeItems==='center';}));
for(const n of [2,4,1,3]){await nativeClick('#load-page-'+n);await check('ornament page '+n+' opens the correct four roles',()=>page.evaluate(n=>document.querySelector('#load-slot-grid [data-slot="'+((n-1)*4+1)+'"]')!==null&&document.getElementById('load-page-'+n).getAttribute('aria-current')==='true',n));}
await page.evaluate(()=>{loadSetPage(3);});
await check('page three starts at slot nine',()=>page.evaluate(()=>document.querySelector('#load-slot-grid [data-slot="9"]')!==null));
await page.evaluate(()=>{currentSlot=9;selectClass('m_knight');startGame();stopGameTimers();player.name='合成第九格';player.config.hiddenSentinel='preserve';saveGame();returnToCharacterSelect();currentSlot=16;selectClass('m_elf');startGame();stopGameTimers();player.name='合成第十六格';saveGame();});
await check('account export includes all sixteen slots and accepts legacy eight-slot accounts',()=>page.evaluate(()=>{const a=buildAccountSnapshot();const legacy=accountClone(a);legacy.schema=1;legacy.roles=legacy.roles.slice(0,8);return a.schema===2&&a.roles.length===16&&a.roles[8].p.name==='合成第九格'&&a.roles[15].p.name==='合成第十六格'&&validateAccount(legacy).roles.length===16;}));
await page.evaluate(()=>{returnToCharacterSelect();currentSlot=1;loadGame();stopGameTimers();toggleAlly('9');saveGame();});
await check('the ninth role can be recruited using the native employment flow',()=>page.evaluate(()=>isAllyActive('9')&&player.allies.some(a=>a._slot==='9'&&a.name==='合成第九格')));
await page.evaluate(()=>returnToCharacterSelect());
const accountDownload=page.waitForEvent('download',{timeout:15000});
await page.evaluate(()=>window.showSaveFilePicker=undefined);await nativeClick('#load-btn-account-export');
const accountPath=options.artifacts+'/synthetic-sixteen-'+options.protocol+'.json';await (await accountDownload).saveAs(accountPath);
await check('native account export includes ninth and sixteenth role progress',async()=>{const raw=await fs.readFile(accountPath,'utf8');return page.evaluate(raw=>{const a=parseAccountFile(raw);return a.roles.length===16&&a.roles[8].p.config.hiddenSentinel==='preserve'&&a.roles[15].p.name==='合成第十六格';},raw);});
await page.evaluate(()=>_lzRemoveStored('lineage_idle_save_9'));
const accountChooser=page.waitForFileChooser();await nativeClick('#load-btn-account-import');await (await accountChooser).setFiles(accountPath);
await page.waitForSelector('#account-import-confirm');await nativeClick('#account-import-confirm');
await check('native account preview restores extra slots and unknown fields',()=>page.evaluate(()=>accountRoleDoc(9).p.config.hiddenSentinel==='preserve'&&accountRoleDoc(16).p.name==='合成第十六格'));
await nativeClick('#account-import-cancel');await fs.rm(accountPath,{force:true});
await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();});
await settings();await nativeClick('[data-addon-id="loadslots"]');await nativeClick('#addons-apply');
await page.waitForFunction(()=>document.readyState==='complete'&&!AFK_TOGGLES.enabled('loadslots'));
await page.evaluate(()=>{openLoadSelect();});
await check('disabling sixteen slots hides extra pages without deleting roles or exported progress',()=>page.evaluate(()=>{const a=buildAccountSnapshot();return document.querySelectorAll('#load-page-tabs button').length===2&&a.roles.length===16&&a.roles[8].p.config.hiddenSentinel==='preserve'&&a.roles[15].p.name==='合成第十六格';}));
await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();});await settings();
await nativeClick('[data-addon-id="mobile"]');await nativeClick('[data-addon-id="whbatch"]');await nativeClick('#addons-apply');
await page.waitForFunction(()=>document.readyState==='complete'&&AFK_TOGGLES.enabled('mobile'));
await viewport(390,844,true);
await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();});
await page.waitForFunction(()=>document.body.classList.contains('m-mobile')&&document.getElementById('m-nav')?.getClientRects().length>0);
await check('one mobile switch enables every mobile component',()=>page.evaluate(()=>['mobile','battlehud','mapbar','nozoom','statusicon','battlebuffs','skillbar','petui','backnav','touchtip','toast'].every(id=>AFK_TOGGLES.enabled(id))&&document.body.classList.contains('m-mobile')&&!!document.getElementById('m-nav')));
await nativeClick('#m-nav [data-view="right"]');await settings();
await check('mobile settings and apply controls remain reachable',()=>page.evaluate(()=>{const ids=['settings-tab-general','settings-tab-addons','addons-apply'];return ids.every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=document.documentElement.clientWidth+1;});}));
await page.evaluate(()=>{setMapSelectors(getHomeTown());changeMap(true);openWarehouseWindow();});
await check('mobile warehouse has side tabs and fits the viewport',()=>page.evaluate(()=>{const r=document.getElementById('warehouse-window-frame').getBoundingClientRect();return !!document.querySelector('[data-warehouse-side="wh"]')&&r.left>=-1&&r.right<=document.documentElement.clientWidth+1;}));
await nativeClick('[data-warehouse-side="wh"]');
await check('mobile warehouse switches lists without moving items',()=>page.evaluate(()=>document.getElementById('warehouse-window-content').dataset.mobileSide==='wh'));
await check('mobile warehouse filter labels and search stay inside the frame',()=>page.evaluate(()=>{
    const frame=document.getElementById('warehouse-window-frame').getBoundingClientRect();
    return [...document.querySelectorAll('#warehouse-window-content .wh-filters label')].every(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=frame.left&&r.right<=frame.right-4;});
}));
for (const [w,h] of [[390,844],[390,480],[844,390],[768,1024],[1024,768]]) {
    await viewport(w,h,true);
    for (const scale of [60,75,80,100]) {
        await page.evaluate(scale=>setUiScale(scale),scale);
        await check(w+'x'+h+' at '+scale+'% warehouse and navigation fit the usable viewport',()=>page.evaluate(()=>{
            const r=document.getElementById('warehouse-window-frame').getBoundingClientRect(),n=document.getElementById('m-nav').getBoundingClientRect(),root=document.documentElement;
            return r.left>=0&&r.top>=0&&r.right<=root.clientWidth+1&&r.bottom<=n.top+1&&n.bottom<=root.clientHeight+1&&n.height>=43;
        }));
    }
}
await page.evaluate(()=>{setUiScale(80);closeWarehouseWindow();});
if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/optional-addons-mobile-'+options.protocol+'.png'});
for(const [w,h] of [[844,390],[768,1024],[1024,768],[1920,1080]]){
    await viewport(w,h,w<=1024);await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await check(w+'x'+h+' mobile shell preserves navigation and restores desktop',()=>page.evaluate(w=>w>1024?!document.body.classList.contains('m-mobile'):document.getElementById('m-nav').getClientRects().length>0,w));
}
await settings();
for (const item of await page.evaluate(()=>optionalAddons.catalog.map(x=>({id:x.id,on:document.querySelector('[data-addon-id="'+x.id+'"]').checked})))) if(!item.on) await nativeClick('[data-addon-id="'+item.id+'"]');
await nativeClick('#addons-apply');
await page.waitForFunction(()=>document.readyState==='complete'&&optionalAddons.catalog.every(x=>AFK_TOGGLES.enabled(x.id)));
await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();player.autoSellOn=false;});
await check('all selected options survive reload while fixed functions remain enabled',()=>page.evaluate(()=>optionalAddons.catalog.every(x=>AFK_TOGGLES.enabled(x.id))&&['training','dograce','autobuy','modalguard','wpnfix'].every(id=>AFK_TOGGLES.enabled(id))&&!AFK_TOGGLES.enabled('statpts')));
await check('list modes render the native inventory, stats and equipment',()=>page.evaluate(()=>{renderTabs(true);switchTab('stats',document.querySelector('[onclick*="switchTab(\'stats\'"]'));const cards=document.getElementById('tab-stats').classList.contains('afk-sl');switchTab('equip',document.querySelector('[onclick*="switchTab(\'equip\'"]'));return cards&&document.body.classList.contains('afk-invlist')&&document.getElementById('equipment-window').classList.contains('hidden')&&document.querySelector('#tab-equip [data-tip-uid]')!==null;}));
await check('cross-class equipment uses native equip and is persisted',()=>page.evaluate(()=>{const entry=Object.entries(DB.items).find(([id,d])=>d.type==='wpn'&&!d.isArrow&&d.req&&!reqAllowsClass(d,player.cls)&&!d.relic);if(!entry)return false;const[id]=entry;gainItem(id,1,true,true);const item=player.inv.find(it=>it.id===id);if(!checkCanEquip(item))return false;equipItem(item);window.__crossWeapon=id;return player.eq.wpn?.id===id&&saveGame()===true;}));
await check('native save is immediately compressed when the option is enabled',()=>page.evaluate(()=>saveGame()===true&&_lsGet('lineage_idle_save_'+currentSlot).startsWith('LZ1:')));
await check('town list uses the native visible NPCs',()=>page.evaluate(()=>{setMapSelectors(getHomeTown());changeMap(true);return document.body.classList.contains('afk-npclist')&&document.getElementById('afk-npclist')?.children.length>0;}));
await check('repeated relics gain independent affixes after a plain first collection',()=>page.evaluate(()=>{const id=Object.keys(DB.items).find(id=>DB.items[id].relic&&DB.items[id].type==='wpn'&&!relicDexHas(id));const original=lootRng;lootRng=()=>0;try{gainItem(id,1,true,false);const first=player.inv.find(it=>it.id===id);const plain=!first.bless&&!first.anc&&!first.attr;gainItem(id,1,true,false);return plain&&player.inv.some(it=>it.id===id&&it.bless&&it.anc&&it.attr);}finally{lootRng=original;}}));
await check('gold-card monster drops receive ancient affixes through the native gain path',()=>page.evaluate(()=>{const original=lootRng,context=_lootMobInfo;_cardRegister('妖魔',3,1);lootRng=()=>0;_lootMobInfo={n:'妖魔',boss:false};try{gainItem('wpn_katana',1,true,false);return player.inv.some(it=>it.id==='wpn_katana'&&it.anc);}finally{lootRng=original;_lootMobInfo=context;}}));
await check('completed class trials expose repeat exchange without resetting quest state',()=>page.evaluate(()=>{const [key,c]=Object.entries(TRIAL_Q).find(([key,c])=>c.cls===player.cls);player.trialQ||={};player.trialQ[key]=2;return c.reqs.every(([id])=>trialItemActive(id))&&trialQHTML(key,'').includes('外掛批次兌換')&&player.trialQ[key]===2;}));
await page.evaluate(()=>{setMapSelectors(getHomeTown());changeMap(true);gainItem('wpn_5',3,true,true);openWarehouseWindow();});
await nativeClick('#afk-whb-toggle');
const batchId=await page.evaluate(()=>document.querySelector('#wh-inv-list [data-wh-transfer]')?.dataset.tipUid);
await nativeClick('#wh-inv-list [data-tip-uid="'+batchId+'"]');
const batchBefore=await page.evaluate(()=>({inv:player.inv.reduce((n,it)=>n+(it.cnt||1),0),wh:loadWarehouse().items.reduce((n,it)=>n+(it.cnt||1),0)}));
await nativeClick('#afk-whb-bar-inv .afk-whb-go');
await check('native warehouse batch moves selected stacks without changing total item count',()=>page.evaluate(before=>{const inv=player.inv.reduce((n,it)=>n+(it.cnt||1),0),wh=loadWarehouse().items.reduce((n,it)=>n+(it.cnt||1),0);return inv<before.inv&&inv+wh===before.inv+before.wh;},batchBefore));
await page.evaluate(()=>closeWarehouseWindow());await settings();
await check('local offline history panel is available without another reward engine',()=>page.evaluate(()=>!document.getElementById('addon-history').hidden&&!document.querySelector('script[src^="afk-offline.js"]')));
await nativeClick('#addons-off');await nativeClick('#addons-apply');
await page.waitForFunction(()=>document.readyState==='complete'&&optionalAddons.catalog.every(x=>!AFK_TOGGLES.enabled(x.id)));
await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();});
await check('turning extras off restores the base and keeps acquired affixed items',()=>page.evaluate(()=>!document.body.classList.contains('afk-invlist')&&!document.body.classList.contains('m-mobile')&&player.inv.some(it=>DB.items[it.id]?.relic&&it.anc)&&(!player.eq.wpn||checkCanEquip(player.eq.wpn))));
await check('no runtime errors during native settings and role flows',()=>page.evaluate(()=>__addonTest.errors.length===0||__addonTest.errors));
await page.evaluate(()=>__addonTest.cleanup());await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.keepSpace)await task.finish({keep:[]});
if(reports.some(r=>r.status==='FAIL'))throw Error('Optional add-ons failed');
})();
