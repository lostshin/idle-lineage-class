// Failure cases: glowing items that look plain between breaths or outside the backpack, halos that add
// animations/filters/layers, info windows that ignore blank clicks, blank clicks that discard
// enhancement/batch/confirm/guild views, or outside-close racing the opener of the next item/member.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '固定光暈與空白關閉'), page = task.page('p1');
console.log({spaceId:task.spaceId});
const reports = [], sources = {}, blankTargets = [];
for (const name of ['index.html','css/style.css','js/10-ui-tabs.js','js/party-inspector.js','js/addon-optional-integration.js','tests/feedback-1023.e2e.js']) {
    sources[name] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
}
const output = options.artifacts+'/feedback-1023-'+(options.baseline?'baseline-':'')+options.protocol+'.json';
async function check(name, fn) {
    try { const detail = await fn(); if (detail !== true) throw Error(JSON.stringify(detail)); reports.push({name,status:'PASS'}); }
    catch (error) { reports.push({name,status:'FAIL',error:String(error)}); console.log({name,error:String(error)}); }
    await fs.writeFile(output, JSON.stringify({sources,method:'Actual Ego; native tabs, item clicks, enhancement/batch/weaken/guild entries and squad buttons; real mouse clicks on scanned non-interactive points; synthetic storage and isolated public API',blankTargets,reports},null,2));
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    const data = {}, storage = {getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
    for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{value:storage,configurable:true});
    const nativeFetch=fetch; window.fetch=(url,...args)=>String(url).includes('idle-lineage-lobby.lostshinanalytics.workers.dev')?Promise.reject(Error('isolated public API')):nativeFetch(url,...args);
    window.BroadcastChannel=undefined; window.__fbErrors=[]; addEventListener('error',event=>__fbErrors.push(event.message));
})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.goto(options.url+'?feedback-1023');
await task.cdp('Target.activateTarget',{targetId:page.targetId});
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
    _bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker=null; _getLzWorker=()=>null;
    selectClass('m_knight'); document.getElementById('creation-name').value='合成固定光暈'; startGame(); stopGameTimers(); state.running=false; setUiScale(100);
    player.lv=80; player.gold=1000000; player.autoSellOn=false;
    const gear=(id,uid,extra={})=>({id,uid,en:7,cnt:1,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false,...extra});
    player.inv=[gear('wpn_katana','fb-plain',{en:0}),...Array.from({length:30},(_,i)=>gear('wpn_katana','fb-w-'+i,{bless:i%2===0,anc:i%2!==0})),
        gear('hlm_mr','fb-armor',{bless:true}),gear('hlm_mr','fb-armor-plain',{en:0}),gear('scroll_weapon','fb-scroll',{en:0,cnt:10}),gear('scroll_weapon_c','fb-curse',{en:0,cnt:5}),gear('scroll_armor_b','fb-armor-scroll',{en:0,cnt:2})];
    player.eq.wpn=gear('wpn_dragonslayer','fb-equipped'); calcStats(); saveGame();
    const doc=JSON.parse(saveStateJson()); Object.assign(doc.p,{name:'合成光暈隊友',enSeed:'fb-ally',_roleEpoch:'fb-ally',allies:[],inv:[],eq:{wpn:gear('wpn_katana','fb-ally-wpn',{bless:true})}});
    _lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));
    player.allies=[buildAlly('2')]; renderSquadPanel(); renderTabs(true);
    const nativeOpen=openModal; openModal=function(...args){const result=nativeOpen(...args);window.__fbOpenedAt=performance.now();window.__fbOpenedUid=args[0]?.uid;return result;};
    window.__fbOpen=()=>!document.getElementById('item-modal').classList.contains('hidden');
    window.__fbHalo=img=>!!img&&getComputedStyle(img).backgroundImage.includes('radial-gradient');
    // First grid point whose element has no own behavior and lies outside every window under test.
    window.__fbBlank=()=>{
        const busy='button,a,input,select,textarea,label,[onclick],[role],[tabindex],[data-inventory-uid],[data-party-kind],canvas,img,.list-item,[id$="-log"],#battle-view,#squad-panel,#tab-content-panel,#item-modal,#party-inspector,#afk-confirm-modal,#guild-window';
        for (let y=24;y<innerHeight-24;y+=24) for (let x=24;x<innerWidth-24;x+=24) {
            const e=document.elementFromPoint(x,y);
            if (e&&!e.closest(busy)) return {x,y,target:e.tagName+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/).slice(0,3).join('.'):'')};
        }
        return null;
    };
});
const tab = async name => { await page.click('[onclick="switchTab(\''+name+'\', this)"]'); };
const settle = () => page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function openFromBackpack(uid) {
    await page.evaluate(()=>{ if (__fbOpen()) closeModal(); }); // keep later steps independent after a failed close check
    await page.click('[data-inventory-uid="'+uid+'"]');
    await page.waitForFunction(uid=>__fbOpen()&&__fbOpenedUid===uid&&performance.now()-__fbOpenedAt>=450,uid,{timeout:4000});
}
async function clickBlank() {
    const point = await page.evaluate(()=>__fbBlank());
    if (!point) throw Error('no blank point outside the windows');
    blankTargets.push(point.target);
    await page.mouse.click(point.x,point.y); await settle();
}

for (const name of ['weapons','armors','items']) {
    await tab(name);
    if (!options.baseline && name === 'weapons') await page.waitForFunction(()=>!!document.querySelector('#tab-weapons .inventory-glow-visible'),undefined,{timeout:4000});
    await check(name+': every visible glowing item keeps a fixed halo, including rows outside the breathing set',()=>page.evaluate(name=>{
        const view=document.querySelector('#tab-'+name+' .classic-inventory-viewport').getBoundingClientRect();
        const rows=[...document.querySelectorAll('#tab-'+name+' [data-inventory-uid]')].filter(r=>{const b=r.getBoundingClientRect();return b.width&&b.bottom>view.top&&b.top<view.bottom;});
        const glow=rows.filter(r=>r.dataset.itemGlow),plain=rows.filter(r=>!r.dataset.itemGlow),fixed=glow.filter(r=>__fbHalo(r.querySelector('.classic-icon-box img')));
        const breathing=document.querySelectorAll('#tab-'+name+' .inventory-glow-visible').length;
        return glow.length>0&&fixed.length===glow.length&&plain.length>0&&plain.every(r=>!__fbHalo(r.querySelector('.classic-icon-box img')))&&(name!=='weapons'||glow.length>breathing)||{glow:glow.length,fixed:fixed.length,plain:plain.length,breathing};
    },name));
}
await tab('weapons');
await check('halo color follows the native glow type and adds no animation, filter or layer hint',()=>page.evaluate(()=>{
    const img=uid=>document.querySelector('[data-inventory-uid="'+uid+'"] .classic-icon-box img'),s=getComputedStyle(img('fb-w-0'));
    return s.backgroundImage.includes('245, 196, 88')&&getComputedStyle(img('fb-w-1')).backgroundImage.includes('192, 148, 255')&&s.animationName==='none'&&!s.filter.includes('drop-shadow')&&s.willChange==='auto'&&
        document.getAnimations().filter(a=>a.animationName==='inventoryBreathe').length<=8;
}));
await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await page.waitForFunction(()=>!document.getAnimations().some(a=>a.animationName==='inventoryBreathe'),undefined,{timeout:4000});
await check('reduced motion stops breathing but keeps fixed halos',()=>page.evaluate(()=>__fbHalo(document.querySelector('[data-inventory-uid="fb-w-0"] .classic-icon-box img'))&&__fbHalo(document.querySelector('[data-inventory-uid="fb-w-1"] .classic-icon-box img'))));
await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
await tab('equip');
await check('equipment window keeps the equipped item halo',()=>page.evaluate(()=>{
    const img=document.querySelector('#equipment-window-slots [data-equipment-slot="wpn"] img.legend-glow');
    return __fbHalo(img)&&getComputedStyle(img).backgroundImage.includes('245, 196, 88');
}));
await tab('weapons');
await openFromBackpack('fb-w-0');
await check('item information and comparison icons keep the halo',()=>page.evaluate(()=>!document.getElementById('modal-compare').classList.contains('hidden')&&
    __fbHalo(document.querySelector('#modal-item-name img.bless-glow'))&&__fbHalo(document.querySelector('#modal-compare-body .modal-current-equipment img.legend-glow'))));

// Blank-click closing
for (const selector of ['#modal-item-desc','#modal-compare-body .modal-current-equipment']) {
    const p = await page.evaluate(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+Math.min(r.height/2,10)};},selector);
    await page.mouse.click(p.x,p.y); await settle();
}
await check('clicks inside either window keep item information open',()=>page.evaluate(()=>__fbOpen()&&!document.getElementById('modal-compare').classList.contains('hidden')));
const header = await page.evaluate(()=>{const r=document.querySelector('#modal-item-window .item-modal-header h2').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
const outside = await page.evaluate(()=>__fbBlank());
await page.mouse.move(header.x,header.y); await page.mouse.down(); await page.mouse.move(outside.x,outside.y); await page.mouse.up(); await settle();
await check('a drag that starts inside and ends outside does not close item information',()=>page.evaluate(()=>__fbOpen()));
await clickBlank();
await check('a blank page click closes item information and its comparison together',()=>page.evaluate(()=>!__fbOpen()&&document.getElementById('modal-compare').classList.contains('hidden')));
await openFromBackpack('fb-w-0');
const gap = await page.evaluate(()=>{const a=document.getElementById('modal-compare').getBoundingClientRect(),b=document.getElementById('modal-item-window').getBoundingClientRect();return {x:(a.right+b.left)/2,y:Math.max(a.top,b.top)+20,width:b.left-a.right};});
await page.mouse.click(gap.x,gap.y); await settle();
await check('the empty gap between both windows also counts as blank',()=>page.evaluate(gap=>gap.width>=8&&!__fbOpen()||gap,gap));
await openFromBackpack('fb-w-0');
const other = await page.evaluate(()=>{
    for (const r of document.querySelectorAll('#tab-weapons [data-item-glow]')) {
        const b=r.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;
        if (r.dataset.inventoryUid!=='fb-w-0'&&b.width&&r.contains(document.elementFromPoint(x,y))) return {uid:r.dataset.inventoryUid,x,y};
    }
    return null;
});
await page.mouse.click(other.x,other.y);
await page.waitForFunction(uid=>__fbOpen()&&__fbOpenedUid===uid,other.uid,{timeout:4000});
await check('clicking another visible item while open switches item information to it',()=>page.evaluate(uid=>__fbOpen()&&__fbOpenedUid===uid,other.uid));
await page.evaluate(()=>closeModal());

await openFromBackpack('fb-w-0');
await page.click('#modal-actions [onclick^="showEnhanceOptions("]');
await page.waitForFunction(()=>document.getElementById('modal-item-name').textContent.startsWith('強化'));
await clickBlank();
await check('enhancement view ignores blank clicks and keeps its return path',()=>page.evaluate(()=>__fbOpen()&&document.getElementById('modal-item-name').textContent.startsWith('強化')&&!!document.querySelector('#modal-actions [onclick^="returnToItemModal("]')));
await page.click('#same-batch-open');
await page.waitForFunction(()=>document.getElementById('modal-item-name').textContent.startsWith('同款批次強化'));
await clickBlank();
await check('same-item batch settings ignore blank clicks',()=>page.evaluate(()=>__fbOpen()&&document.getElementById('modal-item-name').textContent.startsWith('同款批次強化')&&player.inv.find(i=>i.uid==='fb-scroll').cnt===10));
await page.evaluate(()=>closeModal());

await openFromBackpack('fb-w-0');
await page.click('#modal-actions [onclick^="AFK_CURSEBATCH.open("]');
await page.waitForFunction(()=>!!document.getElementById('afk-cb-goal'));
await clickBlank();
await check('one-click weaken settings ignore blank clicks without consuming scrolls',()=>page.evaluate(()=>__fbOpen()&&!!document.getElementById('afk-cb-goal')&&player.inv.find(i=>i.uid==='fb-curse').cnt===5));
await page.click('#modal-actions [onclick^="returnToItemModal("]');
await page.waitForFunction(()=>__fbOpen()&&!document.getElementById('afk-cb-goal')&&performance.now()-__fbOpenedAt>=450);
await clickBlank();
await check('returning to item information restores blank-click closing',()=>page.evaluate(()=>!__fbOpen()));

await openFromBackpack('fb-w-0');
await page.evaluate(()=>{window.__fbCancelled=false;AFK_UI.confirm({title:'合成確認',message:'測試取消',onCancel:()=>{window.__fbCancelled=true;}});});
await page.click('#afk-confirm-cancel'); await settle();
await check('cancelling a confirmation above item information keeps item information open',()=>page.evaluate(()=>__fbOpen()&&__fbCancelled===true&&!document.getElementById('afk-confirm-modal').classList.contains('open')));
await page.evaluate(()=>alert('合成提示'));
await page.click('#afk-alert-ok'); await settle();
await check('dismissing a system alert above item information keeps item information open',()=>page.evaluate(()=>__fbOpen()&&getComputedStyle(document.getElementById('afk-alert-modal')).display==='none'));
await page.evaluate(()=>closeModal());

await page.evaluate(()=>{const npc=DB.towns[mapState.current].npcs.find(n=>n.type==='ally');interactNPC(npc.id,mapState.current);openAllyEquipmentManager('2');});
await page.click('#guild-paperdoll [data-equipment-slot="wpn"]');
await page.click('#guild-enhance');
await page.waitForFunction(()=>__fbOpen()&&document.getElementById('item-modal').hasAttribute('data-guild-item-modal')&&performance.now()-__fbOpenedAt>=450);
await clickBlank();
await check('guild enhancement ignores blank clicks',()=>page.evaluate(()=>__fbOpen()&&document.getElementById('item-modal').hasAttribute('data-guild-item-modal')));
await page.evaluate(()=>{closeModal();guildWindow.close();});

await page.click('button[data-party-kind="ally"][data-party-id="2"]');
await page.waitForFunction(()=>!document.getElementById('party-inspector').hidden);
await page.click('#party-tab-equipment'); await settle();
await check('party inspector stays open for inside clicks and keeps the equipped item halo',()=>page.evaluate(()=>!document.getElementById('party-inspector').hidden&&__fbHalo(document.querySelector('#party-inspector [data-equipment-slot="wpn"] img.bless-glow'))));
await page.click('button[data-party-kind="ally"][data-party-id="2"]'); await settle();
await check('clicking the member button while open keeps showing that member',()=>page.evaluate(()=>{const p=document.getElementById('party-inspector');return !p.hidden&&p.dataset.kind==='ally'&&p.dataset.id==='2';}));
await page.evaluate(()=>alert('合成提示'));
await page.click('#afk-alert-ok'); await settle();
await check('dismissing a system alert keeps the party inspector open',()=>page.evaluate(()=>!document.getElementById('party-inspector').hidden&&getComputedStyle(document.getElementById('afk-alert-modal')).display==='none'));
await clickBlank();
await check('party inspector closes on a blank outside click',()=>page.evaluate(()=>document.getElementById('party-inspector').hidden));
await check('no runtime errors',()=>page.evaluate(()=>!__fbErrors.length||__fbErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init}); await page.goto('about:blank');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,blankTargets:[...new Set(blankTargets)]});
if (!options.baseline&&reports.some(r=>r.status==='FAIL')) throw Error('Feedback 1023 regression');
if (!options.keepSpace) await task.finish({keep:[]});
