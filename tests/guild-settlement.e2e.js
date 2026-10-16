// Real browser interactions with isolated synthetic characters and storage.
(async () => {
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '公會倉庫與結算改善'), page = task.page('p1'), reports = [], sources = {};
console.log({spaceId:task.spaceId});
for (const file of ['index.html','js/01-drops-config.js','js/03-combat-core.js','js/06-status-allies.js','js/20-warehouse-window.js','js/guild-window.js','js/13-shop-save.js','js/27-offline-rewards.js','js/addon-settings.js','css/floating-ui.css','tests/guild-settlement.e2e.js']) sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name, fn) {
    try { const r = await fn(); if (r !== true) throw Error(JSON.stringify(r)); reports.push({name,status:'PASS'}); }
    catch (e) { reports.push({name,status:'FAIL',error:String(e)}); console.log({name,error:String(e)}); }
    await fs.writeFile(options.artifacts+'/guild-settlement-'+(options.baseline?'baseline':options.protocol)+'.json',JSON.stringify({method:'Ego native controls; isolated synthetic storage; fixture visibility events exercise the real lifecycle handlers',sources,reports},null,2));
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__guildData={};window.__guildErrors=[];window.__failKey='';const s={getItem:k=>__guildData[k]??null,setItem:(k,v)=>{if(__failKey&&k===__failKey)throw Error('synthetic write failure');__guildData[k]=String(v)},removeItem:k=>delete __guildData[k],key:i=>Object.keys(__guildData)[i]??null,get length(){return Object.keys(__guildData).length}};Object.defineProperty(window,'localStorage',{value:s,configurable:true});Object.defineProperty(window,'sessionStorage',{value:s,configurable:true});addEventListener('error',e=>__guildErrors.push(e.message));})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?guild-settlement');
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
    _bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker=null; _getLzWorker=()=>null;
    selectClass('m_knight'); document.getElementById('creation-name').value='合成隊長'; startGame(); stopGameTimers(); state.running=false; setUiScale(100);
    window.__gear=(id,uid,en=0,cnt=1)=>({id,uid,en,cnt,bless:false,anc:false,attr:false,seteff:false});
    player.inv=[__gear('potion_heal','quantity-probe',0,20)];saveGame();saveWarehouse({items:[],gold:0});openWarehouseWindow();whSetFilter('item');
});
await check('warehouse default restores 830 by 600 UI pixels',()=>page.evaluate(()=>{const r=document.getElementById('warehouse-window-frame').getBoundingClientRect();return Math.abs(r.width-830)<1&&Math.abs(r.height-600)<1;}));
await check('quantity hit target hugs the number instead of the whole right block',()=>page.evaluate(()=>document.querySelector('[data-wh-quantity]').getBoundingClientRect().width<45));
await page.click('[data-wh-quantity]');await page.fill('#wh-inv-list input','3');await page.press('#wh-inv-list input','Enter');
await check('Enter directly transfers the typed quantity once',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='quantity-probe')?.cnt===17&&loadWarehouse().items.find(i=>i.id==='potion_heal')?.cnt===3));
await page.evaluate(()=>{closeWarehouseWindow();switchLogTab('combat');_sysLogLocked=true;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
await check('returning to the page selects system log and clears its old scroll lock',()=>page.evaluate(()=>_logTab==='sys'&&!_sysLogLocked&&Math.abs(document.getElementById('sys-log').scrollHeight-document.getElementById('sys-log').clientHeight-document.getElementById('sys-log').scrollTop)<2));
await page.click('#btn-automation');await page.click('#settings-tab-addons');
await page.evaluate(()=>{_ffProgressEnsure();_ffProgressHide();window.__saveCalls=0;saveGame=()=>{__saveCalls++;return false;};});
await page.evaluate(()=>document.getElementById('addons-apply').scrollIntoView({block:'center'}));
await page.click('#addons-apply');
await check('a hidden completed progress indicator does not block the save attempt',()=>page.evaluate(()=>__saveCalls>0&&document.getElementById('addons-status').textContent.includes('儲存失敗')||{calls:__saveCalls,status:document.getElementById('addons-status').textContent,ff:state.ff,debt:_tickDebt}));
await page.evaluate(()=>{window.__nativeCatchup=catchupActive;catchupActive=()=>true;});await page.click('#addons-apply');
await check('an actual active catchup still prevents reload',()=>page.evaluate(()=>document.getElementById('addons-status').textContent.includes('正在結算')||{calls:__saveCalls,status:document.getElementById('addons-status').textContent}));
await page.evaluate(()=>{catchupActive=__nativeCatchup;});
if (!options.baseline) {
    await page.reload();await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
    await page.evaluate(()=>{
        _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;
        selectClass('m_knight');document.getElementById('creation-name').value='合成隊員';currentSlot=2;startGame();stopGameTimers();state.running=false;
        player.lv=60;player.eq={};player.inv=[];saveGame();
        const source=accountRoleDoc(2);source.p.name='合成隊員';source.p.lv=60;_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(source)));
        currentSlot=1;selectClass('m_royal');document.getElementById('creation-name').value='合成隊長';startGame();stopGameTimers();state.running=false;
        window.__gear=(id,uid,en=0,cnt=1)=>({id,uid,en,cnt,bless:false,anc:false,attr:false,seteff:false});
        player.inv=[__gear('wpn_katana','guild-sword',7,2),...Array.from({length:90},(_,i)=>__gear('wpn_katana','guild-many-'+i,i%8)),__gear('arm_helm','guild-helm')];saveGame();toggleAlly('2');
        const npc=DB.towns[mapState.current].npcs.find(n=>n.type==='ally');interactNPC(npc.id,mapState.current);setUiScale(100);
    });
    await check('guild opens in an independent warehouse-style framed window',()=>page.evaluate(()=>!document.getElementById('guild-window').classList.contains('hidden')&&getComputedStyle(document.getElementById('guild-window-frame')).borderImageSource.includes('warehouse-frame-v1.png')&&document.querySelectorAll('[data-guild-resize]').length===8));
    await check('outer guild retains its X close button and has no navigation tabs',()=>page.evaluate(()=>document.getElementById('guild-window-close').textContent==='×'&&!document.querySelector('[data-guild-tab]')));
    await check('roster rows use the same native warehouse bitmap material as equipment',()=>page.evaluate(()=>{const rows=[...document.querySelectorAll('#guild-window-frame .guild-roster-row')];return rows.length>0&&rows.every(row=>getComputedStyle(row).borderImageSource.includes('warehouse-row-v1.png'));}));
    await check('roster gives the source role its original portrait and preserves all native actions',()=>page.evaluate(()=>{const row=document.querySelector('[data-guild-roster-role="2"]');return !!row?.querySelector('.guild-roster-avatar .party-roster-portrait')&&['openAllyEquipmentManager','openAllyQuestManager','dismissAlly'].every(fn=>!!row.querySelector('[onclick^="'+fn+'"]'));}));
    await page.click('[data-guild-manage="2"]');
    await check('equipment alone changes the header close action into return to roster',()=>page.evaluate(()=>document.getElementById('guild-window-close').textContent==='返回'&&document.getElementById('guild-window-close').getAttribute('aria-label')==='返回名冊'));
    await check('A design shows native equipment slots with explicit body-part labels',()=>page.evaluate(()=>document.querySelectorAll('#guild-paperdoll [data-equipment-slot]').length===19&&[...document.querySelectorAll('#guild-paperdoll [data-equipment-slot]')].every(e=>!!e.querySelector('.party-equipment-label')?.textContent)&&!!document.querySelector('#guild-paperdoll .party-paperdoll-figure img')));
    await check('B layout puts role switching and backpack on the right, with equipment pages at bottom left',()=>page.evaluate(()=>{const scene=document.getElementById('guild-body-scroll').getBoundingClientRect();return !!document.getElementById('guild-member-select')&&['guild-window-drag','guild-member-strip','guild-candidates'].every(id=>document.getElementById(id).getBoundingClientRect().left>=scene.right-1)&&[...document.querySelectorAll('[data-guild-page]')].every(e=>{const r=e.getBoundingClientRect(),canvas=document.querySelector('#guild-paperdoll .equipment-window-slots').getBoundingClientRect();return r.left>=canvas.left&&r.right<=canvas.left+canvas.width*.56+1&&r.bottom<=canvas.bottom+1&&r.top>canvas.top+canvas.height*.8;});}));
    await check('the original equipment canvas fills the entire left pane without changing its native artwork',()=>page.evaluate(()=>{const area=document.getElementById('guild-body-scroll'),canvas=document.querySelector('#guild-paperdoll .equipment-window-slots');return Math.abs(canvas.getBoundingClientRect().width-area.getBoundingClientRect().width)<2&&document.querySelector('#guild-paperdoll .party-equipment-backdrop').src.includes('party-equipment-backdrop-v3-tall.png');}));
    await page.click('#guild-paperdoll [data-equipment-slot="wpn"]');
    await check('selecting a body part filters candidates to that equipment slot',()=>page.evaluate(()=>document.querySelectorAll('[data-guild-item]').length>80&&[...document.querySelectorAll('[data-guild-item]')].every(e=>DB.items[player.inv.find(i=>i.uid===e.dataset.guildItem).id].type==='wpn')));
    await page.click('[data-guild-item="guild-sword"]');await page.click('#guild-equip');
    await check('native equip transfers only one stacked item and writes the correct source role',()=>page.evaluate(()=>accountRoleDoc(2).p.eq.wpn?.en===7&&player.inv.find(i=>i.uid==='guild-sword')?.cnt===1&&document.querySelector('#guild-paperdoll [data-equipment-slot="wpn"]').getAttribute('aria-pressed')==='true'));
    await page.click('#guild-unequip');
    await check('unequip returns the item to the leader and clears the exact source slot',()=>page.evaluate(()=>!accountRoleDoc(2).p.eq.wpn&&player.inv.filter(i=>i.id==='wpn_katana'&&i.en===7).reduce((n,i)=>n+(i.cnt||1),0)>=2));
    await page.click('[data-guild-page="1"]');
    await check('special page retains all nine native slots and empty slot labels',()=>page.evaluate(()=>document.querySelectorAll('#guild-paperdoll [data-equipment-slot]').length===9&&!!document.querySelector('[data-equipment-slot="rem_claw"]')));
    await page.click('[data-guild-page="0"]');await page.click('#guild-paperdoll [data-equipment-slot="wpn"]');
    for (const width of [1330,1920]) for (const scale of [60,75,80,100]) {
        await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate(s=>setUiScale(s),scale);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await check(`${width} ${scale}% guild controls stay inside the frame`,()=>page.evaluate(()=>{const root=document.getElementById('guild-window-frame'),r=root.getBoundingClientRect();const bad=[...root.querySelectorAll('.guild-nav button,.guild-filters input,.guild-filters button,.guild-actions button,[data-guild-page]')].filter(e=>e.getClientRects().length).filter(e=>{const q=e.getBoundingClientRect();return q.left<r.left-1||q.right>r.right+1||q.top<r.top-1||q.bottom>r.bottom+1;});return !bad.length&&r.right<=document.documentElement.clientWidth+1&&r.bottom<=document.documentElement.clientHeight+1&&document.getElementById('guild-candidates').scrollWidth<=document.getElementById('guild-candidates').clientWidth+1||{bad:bad.map(e=>e.outerHTML),bounds:r.toJSON()};}));
    }
    await page.evaluate(()=>{document.getElementById('guild-candidates').scrollTop=400;});
    const pos=await page.evaluate(()=>{const e=document.querySelector('[data-guild-resize="se"]'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:document.getElementById('guild-window-frame').getBoundingClientRect().width};});
    await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.mouse.move(pos.x-30,pos.y-20);await page.mouse.up();
    await check('guild resize handles work with native pointer input',()=>page.evaluate(w=>Math.abs(document.getElementById('guild-window-frame').getBoundingClientRect().width-(w-30))<2,pos.w));
    await page.fill('#guild-search','武士');
    await page.evaluate(()=>{__failKey='lineage_idle_save_2';});
    await page.click('[data-guild-item="guild-sword"]');await page.click('#guild-equip');
    await check('source write failure retains the leader inventory and leaves source equipment unchanged',()=>page.evaluate(()=>!accountRoleDoc(2).p.eq.wpn&&player.inv.some(i=>i.uid==='guild-sword')));
    await page.evaluate(()=>{__failKey='';});await page.click('#guild-equip');
    await check('retry keeps the selected body part and search while applying exactly once',()=>page.evaluate(()=>accountRoleDoc(2).p.eq.wpn?.en===7&&document.getElementById('guild-search').value==='武士'&&document.querySelector('[data-equipment-slot="wpn"]').getAttribute('aria-pressed')==='true'));
    await page.click('#guild-window-close');
    await check('return button keeps the guild open and returns to its native roster without tabs',()=>page.evaluate(()=>guildWindow.isOpen()&&document.getElementById('guild-window-close').textContent==='×'&&!document.querySelector('[data-guild-tab]')&&!!document.querySelector('[data-guild-manage="2"]')));
    await page.click('#guild-window-frame [onclick^="openAllyQuestManager"]');
    await check('guild roster quest action retains the native source-role quest controls',()=>page.evaluate(()=>!document.querySelector('[data-guild-tab]')&&document.getElementById('interaction-content').textContent.includes('試煉')));
    await page.click('[onclick="closeAllyQuestManager()"]');await page.click('[data-guild-manage="2"]');
    await page.evaluate(()=>{
        const d=accountRoleDoc(2),id=Object.keys(DB.items).find(id=>DB.items[id].slot==='ring'&&!DB.items[id].unique&&_allyCanEquipLeaderItem(d.p,__gear(id,'probe')));
        window.__ringId=id;d.p.eq.ring1=__gear(id,'old-left');d.p.eq.ring2=__gear(id,'old-right');
        _lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(d)));refreshAllyOnce('2');player.inv.push(__gear(id,'guild-ring',5));openAllyEquipmentManager('2');
    });
    await check('level-locked accessory sockets are visible but cannot be selected',()=>page.evaluate(()=>document.querySelector('[data-equipment-slot="ring3"]').disabled&&document.querySelector('[data-equipment-slot="ring4"]').disabled&&!document.querySelector('[data-equipment-slot="ear2"]').disabled));
    await page.fill('#guild-search','');await page.click('#guild-all-slots');await page.click('[data-guild-item="guild-ring"]');
    const openedAt=Date.now();await page.click('#guild-equip');await page.waitForSelector('[data-acc-slot="ring2"]');
    await check('full rings use the native slot chooser without transferring anything prematurely',()=>page.evaluate(()=>accountRoleDoc(2).p.eq.ring1.uid==='old-left'&&accountRoleDoc(2).p.eq.ring2.uid==='old-right'&&player.inv.some(i=>i.uid==='guild-ring')));
    await page.waitForFunction(at=>Date.now()-at>=450,openedAt);await page.click('[data-acc-slot="ring2"]');
    await check('choosing the right ring replaces only that slot and returns its old item',()=>page.evaluate(()=>accountRoleDoc(2).p.eq.ring1.uid==='old-left'&&accountRoleDoc(2).p.eq.ring2.en===5&&player.inv.some(i=>i.uid==='old-right')&&!player.inv.some(i=>i.uid==='guild-ring')));
    await page.evaluate(()=>{player.inv.push(__gear(__ringId,'guild-ring-direct',4));openAllyEquipmentManager('2');});
    await page.click('[data-equipment-slot="ring1"]');await page.click('[data-guild-item="guild-ring-direct"]');await page.click('#guild-equip');
    await check('an explicitly selected ring slot equips there without an additional chooser',()=>page.evaluate(()=>accountRoleDoc(2).p.eq.ring1.en===4&&accountRoleDoc(2).p.eq.ring2.en===5&&[...document.querySelectorAll('[data-acc-slot]')].every(e=>!e.checkVisibility())));
    await page.evaluate(()=>{const d=accountRoleDoc(2);d.p.avatar='女騎士';_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(d)));refreshAllyOnce('2');openAllyEquipmentManager('2');});
    await check('the paperdoll uses the viewed source role gender and class',()=>page.evaluate(()=>{const key=loadStartKeyFromSummary({avatar:'女騎士',rawCls:'knight'});return document.querySelector('#guild-paperdoll .party-paperdoll-figure img').src===new URL(loadFrameSrc(key,loadFirstFrame(key)),location.href).href;}));
    await page.click('#guild-all-slots');
    for (const scale of [60,80,100]) {
        await page.evaluate(s=>{setUiScale(s);_ffProgressUpdate({ticks:10},5000);},scale);
        await check(`${scale}% actual-progress renderer covers the viewport and hides after completion`,()=>page.evaluate(()=>{const e=document.getElementById('ff-progress-indicator'),r=e.getBoundingClientRect();const covered=Math.abs(r.width-document.documentElement.clientWidth)<2&&Math.abs(r.height-document.documentElement.clientHeight)<2;_ffProgressHide();return covered&&getComputedStyle(e).visibility==='hidden'||{bounds:r.toJSON(),vw:document.documentElement.clientWidth,vh:document.documentElement.clientHeight};}));
    }
    await check('native candidate grid scrolls independently without growing the guild window',()=>page.evaluate(()=>{const e=document.getElementById('guild-candidates');return e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto';}));
    await page.click('#guild-window-close');await page.click('#guild-window-close');
    await check('outer X closes the guild and restores the original NPC content host',()=>page.evaluate(()=>!guildWindow.isOpen()&&!document.getElementById('guild-content-host').contains(document.getElementById('interaction-content'))));
    await page.evaluate(()=>{guildWindow.open();openAllyEquipmentManager('2');});
    await page.evaluate(()=>returnToCharacterSelect());
    await check('returning to character selection closes the guild and restores the shared NPC host',()=>page.evaluate(()=>!guildWindow.isOpen()&&!document.getElementById('guild-content-host').contains(document.getElementById('interaction-content'))));
    await check('no runtime errors',()=>page.evaluate(()=>__guildErrors.length===0||__guildErrors));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Guild and settlement checks failed');
if(!options.keepSpace)await task.finish({keep:[]});
})();
