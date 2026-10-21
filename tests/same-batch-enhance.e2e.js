// Failure cases: reprocessing new stacks, lost affixes/metadata, stale confirmations,
// insufficient scrolls, zero-change rolls, double submission and an empty result panel.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '同視窗同款批次強化'), page = task.page('p1'), reports = [], sources = {};
console.log({spaceId:task.spaceId});
for (const name of ['index.html','js/10-ui-tabs.js','css/responsive.css','tests/same-batch-enhance.e2e.js']) sources[name] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source:`(() => {
    const data = window.name.startsWith('same-batch-fixture:') ? JSON.parse(window.name.slice(19)) : {};
    window.__batchData = data; window.__batchErrors = []; window.__batchFail = false;
    const storage = {getItem:k=>data[k]??null,setItem(k,v){if(__batchFail)throw Error('synthetic storage failure');data[k]=String(v);window.name='same-batch-fixture:'+JSON.stringify(data);},removeItem(k){delete data[k];},key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length;}};
    for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:storage,configurable:true});
    const nativeFetch = window.fetch;
    window.fetch = (url,...args) => String(url).includes('idle-lineage-lobby.lostshinanalytics.workers.dev') ? Promise.reject(Error('isolated public API')) : nativeFetch(url,...args);
    addEventListener('error',e=>__batchErrors.push(e.message));
})();`})).identifier;
async function check(name, fn) {
    try {const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}
    catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}
    await fs.writeFile(options.artifacts+'/same-batch-enhance-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser; isolated synthetic storage persisted only in window.name, default public API blocked; controlled RNG; native control clicks',sources,reports},null,2));
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
await page.goto('about:blank'); await page.evaluate(()=>window.name='');
await page.goto(options.url+'?same-batch-fixture');
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{
    _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;
    selectClass('m_knight');document.getElementById('creation-name').value='合成批次驗收';startGame();stopGameTimers();state.running=false;setUiScale(100);player.autoSellOn=false;
    window.__gear=(id,uid,en=0,cnt=1,extra={})=>({id,uid,en,cnt,bless:false,anc:false,attr:false,seteff:false,lock:false,junk:false,...extra});
    window.__fixture=(en=0,cnt=100,scrolls=400,id='hlm_mr')=>{
        closeModal();player.eq.wpn=null;player.inv=[__gear(id,'batch-target',en,cnt,{futureMarker:{keep:true}}),__gear(id==='wpn_shortbow'?'scroll_weapon':id==='hlm_mr'?'scroll_armor':'scroll_acc','batch-scroll',0,scrolls)];
        if(id!=='acc_ring_str')player.inv.push(__gear(id==='wpn_shortbow'?'scroll_weapon_b':'scroll_armor_b','batch-bless',0,100));
        calcStats();renderTabs(true);openModal(player.inv[0],false);renderEnhanceOptions(player.inv[0],false);window.__opened=performance.now();
    };
    window.__rng=Math.random;window.__generated=0;uid=()=>'batch-generated-'+(++__generated);
    window.__rolls=(values)=>{let n=0;Math.random=()=>values[n++%values.length];};
    __fixture();
});
await check('same-window batch entry exists below one-click enhancement',()=>page.evaluate(()=>{const b=document.getElementById('same-batch-open'),a=document.getElementById('auto-enh-target');return !!b&&!!a&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);}));
if (await page.evaluate(()=>!!document.getElementById('same-batch-open'))) {
    async function enter(en=0,cnt=100,scrolls=400,id='hlm_mr') {
        await page.evaluate(args=>__fixture(...args),[en,cnt,scrolls,id]);
        await page.waitForFunction(()=>performance.now()-__opened>=450);
        await page.click('#same-batch-open');
    }
    async function group(en) {await page.click(`[data-same-batch-en="${en}"]`);}
    async function run() {await page.click('#same-batch-preview');await page.click('#same-batch-confirm');}
    await page.waitForFunction(()=>performance.now()-__opened>=450);await page.click('#same-batch-open');
    await group(0);await page.click('#same-batch-mode-target');await page.selectOption('#same-batch-goal','4');await run();
    await check('100 normal items reach +4 using 400 scrolls, retaining fields, window and results',()=>page.evaluate(()=>{
        const t=player.inv.filter(i=>i.id==='hlm_mr');return t.reduce((n,i)=>n+i.cnt,0)===100&&t.every(i=>i.en===4&&i.futureMarker.keep)&&!player.inv.some(i=>i.id==='scroll_armor')&&!!document.getElementById('same-batch-panel')&&document.getElementById('same-batch-result').textContent.includes('400')&&!document.querySelector('[data-same-batch-en][aria-pressed="true"]');
    }));
    await enter(4);await group(4);await page.click('#same-batch-scroll-blessed');await page.evaluate(()=>__rolls([0,.1,0,.9,.99]));await run();await page.evaluate(()=>Math.random=__rng);
    await check('100 blessed attempts split into +5/+6/destruction without chasing results',()=>page.evaluate(()=>{
        const rows=player.inv.filter(i=>i.id==='hlm_mr'),count=en=>rows.filter(i=>i.en===en).reduce((n,i)=>n+i.cnt,0);
        return count(5)===34&&count(6)===33&&rows.reduce((n,i)=>n+i.cnt,0)===67&&!player.inv.some(i=>i.id==='scroll_armor_b')&&document.getElementById('same-batch-result').textContent.includes('33')&&document.querySelector('input[name="same-batch-scroll"]:checked').value==='scroll_armor_b'&&document.querySelector('input[name="same-batch-mode"]:checked').value==='once';
    }));
    await page.evaluate(()=>{player.inv.push(__gear('scroll_armor_b','batch-new-scroll',0,100));window.__other=JSON.stringify(player.inv.filter(i=>i.id==='hlm_mr'&&i.en===6));});
    await group(5);await page.fill('#same-batch-quantity','10');await page.evaluate(()=>__rolls([.99]));await run();await page.evaluate(()=>Math.random=__rng);
    await check('partial next batch leaves the unselected +6 group and 24 original +5 items untouched',()=>page.evaluate(()=>JSON.stringify(player.inv.filter(i=>i.id==='hlm_mr'&&i.en===6))===__other&&player.inv.filter(i=>i.id==='hlm_mr'&&i.en===5).reduce((n,i)=>n+i.cnt,0)===24));
    await enter(0,10,3);await group(0);await page.click('#same-batch-preview');
    await check('shortage confirmation states 3 processable and 7 unprocessed without consumption',()=>page.evaluate(()=>document.getElementById('same-batch-confirmation').textContent.includes('可處理 3')&&document.getElementById('same-batch-confirmation').textContent.includes('未處理 7')&&player.inv.find(i=>i.uid==='batch-scroll').cnt===3));
    await page.click('#same-batch-cancel');
    await check('cancel is free and preserves selection',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='batch-target').cnt===10&&player.inv.find(i=>i.uid==='batch-scroll').cnt===3&&!document.getElementById('same-batch-confirm')));
    await run();await check('shortage processes only 3 and accounts for all 10',()=>page.evaluate(()=>player.inv.filter(i=>i.id==='hlm_mr'&&i.en===0).reduce((n,i)=>n+i.cnt,0)===7&&player.inv.filter(i=>i.id==='hlm_mr'&&i.en===1).reduce((n,i)=>n+i.cnt,0)===3&&document.getElementById('same-batch-result').textContent.includes('未處理 7')));
    await enter(0,10,3);await group(0);await page.click('#same-batch-mode-target');await page.selectOption('#same-batch-goal','4');await page.click('#same-batch-preview');
    await check('target mode explicitly warns that sequential execution may stop midway',()=>page.evaluate(()=>/逐件/.test(document.getElementById('same-batch-confirmation').textContent)&&/中途停止/.test(document.getElementById('same-batch-confirmation').textContent)));
    await page.click('#same-batch-confirm');await check('target shortage leaves one partial and nine untouched',()=>page.evaluate(()=>player.inv.filter(i=>i.id==='hlm_mr'&&i.en===3).reduce((n,i)=>n+i.cnt,0)===1&&player.inv.filter(i=>i.id==='hlm_mr'&&i.en===0).reduce((n,i)=>n+i.cnt,0)===9));
    await enter(0,10,0);await group(0);await page.click('#same-batch-preview');await check('zero scrolls disable confirmation',()=>page.evaluate(()=>document.getElementById('same-batch-confirm')?.disabled===true));
    await enter(0,10,10);await group(0);await page.fill('#same-batch-quantity','11');await check('out-of-range quantity cannot preview',()=>page.evaluate(()=>document.getElementById('same-batch-preview').disabled));await page.click('#same-batch-all');
    await page.click('#same-batch-preview');await page.evaluate(()=>player.inv.find(i=>i.uid==='batch-scroll').cnt=2);await page.click('#same-batch-confirm');
    await check('inventory change refreshes confirmation and requires a second approval without consuming',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='batch-target').cnt===10&&player.inv.find(i=>i.uid==='batch-scroll').cnt===2&&document.getElementById('same-batch-confirmation').textContent.includes('資料已變更')));
    await page.click('#same-batch-confirm');await check('second approval uses only the revalidated inventory',()=>page.evaluate(()=>player.inv.filter(i=>i.id==='hlm_mr'&&i.en===1).reduce((n,i)=>n+i.cnt,0)===2));
    await enter(9,3,3,'wpn_shortbow');await group(9);await page.evaluate(()=>__rolls([.25]));await run();await page.evaluate(()=>Math.random=__rng);
    await check('no-change consumes exactly one per item and reports all three',()=>page.evaluate(()=>player.inv.find(i=>i.id==='wpn_shortbow').cnt===3&&player.inv.find(i=>i.id==='wpn_shortbow').en===9&&!player.inv.some(i=>i.id==='scroll_weapon')&&document.getElementById('same-batch-result').textContent.includes('無變化 3')));
    await enter(14,3,3,'wpn_shortbow');await group(14);await page.evaluate(()=>__rolls([0]));await run();await page.evaluate(()=>Math.random=__rng);
    await check('cap is respected and capped groups cannot be selected',()=>page.evaluate(()=>player.inv.find(i=>i.id==='wpn_shortbow').en===15&&!document.querySelector('[data-same-batch-en="15"]')&&!document.getElementById('same-batch-panel').hidden));
    await enter(4,5,5);await group(4);await page.evaluate(()=>__rolls([.99]));await run();await page.evaluate(()=>Math.random=__rng);
    await check('all destroyed keeps a result and a free return without resubmission',()=>page.evaluate(()=>!player.inv.some(i=>i.id==='hlm_mr')&&!!document.getElementById('same-batch-result')&&document.getElementById('same-batch-result').textContent.includes('爆裝 5')&&document.getElementById('same-batch-preview').disabled&&!!document.getElementById('same-batch-return')));
    await enter(0,5,10);await page.evaluate(()=>{
        player.inv.push(__gear('hlm_mr','locked',0,9,{lock:true}),__gear('hlm_mr','blessed',0,8,{bless:true}),__gear('hlm_mr','ancient',0,7,{anc:true}),__gear('hlm_mr','attribute',0,6,{attr:'火'}),__gear('hlm_mr','set',0,4,{seteff:'test'}));
        player.eq.hlm=__gear('hlm_mr','equipped',0,1);window.__excluded=JSON.stringify([player.inv.filter(i=>i.uid!=='batch-target'&&!i.id.startsWith('scroll_')),player.eq.hlm]);
    });await group(0);await page.fill('#same-batch-quantity','2');await run();
    await check('affixes, locks and equipped items stay excluded and unchanged',()=>page.evaluate(()=>JSON.stringify([player.inv.filter(i=>['locked','blessed','ancient','attribute','set'].includes(i.uid)),player.eq.hlm])===__excluded&&player.inv.find(i=>i.uid==='batch-target').cnt===3));
    await enter(0,10,10);await group(0);await page.click('#same-batch-preview');
    await page.evaluate(()=>document.getElementById('same-batch-confirm').scrollIntoView({block:'center'}));
    const hit=await page.evaluate(()=>{const r=document.getElementById('same-batch-confirm').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await page.mouse.click(hit.x,hit.y);await page.mouse.click(hit.x,hit.y);
    await check('double click consumes one batch only',()=>page.evaluate(()=>player.inv.filter(i=>i.id==='hlm_mr').reduce((n,i)=>n+i.cnt,0)===10&&player.inv.filter(i=>i.id==='hlm_mr').every(i=>i.en===1)&&!player.inv.some(i=>i.id==='scroll_armor')));
    await check('native save contains the result and unknown equipment fields',()=>page.evaluate(()=>{const p=_roleReadSavePlayer(1);return p.inv.filter(i=>i.id==='hlm_mr').every(i=>i.en===1&&i.futureMarker.keep);}));
    await page.evaluate(()=>{closeModal();loadGame(1);});await page.waitForFunction(()=>!document.getElementById('game-screen').classList.contains('hidden'));
    await check('native load restores the result',()=>page.evaluate(()=>{stopGameTimers();state.running=false;return player.inv.filter(i=>i.id==='hlm_mr').reduce((n,i)=>n+i.cnt,0)===10&&player.inv.filter(i=>i.id==='hlm_mr').every(i=>i.en===1&&i.futureMarker.keep);}));
    await enter(0,4,4,'acc_ring_str');await group(0);
    await check('accessories only offer their native normal scroll and +5 cap',()=>page.evaluate(()=>document.querySelectorAll('input[name="same-batch-scroll"]').length===1&&document.querySelector('input[name="same-batch-scroll"]:checked').value==='scroll_acc'));
    await page.click('#same-batch-mode-target');
    await check('target options are above current enhancement and end at the native cap',()=>page.evaluate(()=>[...document.querySelectorAll('#same-batch-goal option')].map(o=>o.value).join(',')==='1,2,3,4,5'));
    await page.click('#same-batch-mode-once');await page.evaluate(()=>__rolls([0]));await run();await page.evaluate(()=>Math.random=__rng);
    await check('normal accessory batch uses the native success rule',()=>page.evaluate(()=>player.inv.filter(i=>i.id==='acc_ring_str'&&i.en===1).reduce((n,i)=>n+i.cnt,0)===4&&!player.inv.some(i=>i.id==='scroll_acc')));
    await enter(0,5,10);await page.evaluate(()=>{player.inv.push(__gear('hlm_mr','existing-plus-one',1,30,{futureMarker:{keep:true}}));renderSameBatchEnhance();});await group(1);
    await check('groups include original inventory and switching resets quantity to all',()=>page.evaluate(()=>document.getElementById('same-batch-quantity').value==='30'));
    await group(0);await page.fill('#same-batch-quantity','2');await page.click('#same-batch-preview');
    await page.evaluate(()=>player.inv.find(i=>i.uid==='batch-target').lock=true);await page.click('#same-batch-confirm');
    await check('newly locked items invalidate confirmation without consuming',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='batch-scroll').cnt===10&&!document.getElementById('same-batch-confirm')&&document.getElementById('same-batch-quantity').max==='0'));
    await enter(0,5,10);await group(0);await page.click('#same-batch-preview');
    await page.evaluate(()=>{window.__failureMessages=[];const log=logSys;window.__log=log;logSys=(text,...args)=>{__failureMessages.push(text);return log(text,...args);};__batchFail=true;});
    await page.click('#same-batch-confirm');
    await check('save failure preserves the outcome, emits native failure feedback and does not rerun',()=>page.evaluate(()=>player.inv.find(i=>i.id==='hlm_mr').en===1&&player.inv.find(i=>i.id==='hlm_mr').cnt===5&&player.inv.find(i=>i.id==='scroll_armor').cnt===5&&__failureMessages.some(s=>s.includes('儲存失敗'))&&!!document.getElementById('same-batch-result')));
    await page.evaluate(()=>{__batchFail=false;logSys=__log;saveGame();});
    await enter(0,5,20);await group(0);await page.click('#same-batch-return');await page.click('#modal-actions [onclick^="executeEnhance("]:not([data-enhance-blessed])');
    await check('returning to single enhancement still consumes one scroll and one item',()=>page.evaluate(()=>player.inv.find(i=>i.id==='scroll_armor').cnt===19&&player.inv.filter(i=>i.id==='hlm_mr'&&i.en===1).reduce((n,i)=>n+i.cnt,0)===1));
    await page.evaluate(()=>{closeModal();__fixture(0,3,12);closeModal();});
    await page.click('button[onclick="switchTab(\'armors\', this)"]');
    await page.evaluate(()=>{toggleQuickEnhance('arm');quickEnh.arm.target=4;quickEnh.arm.sel={'batch-target':true};renderTabs(true);});
    await page.selectOption('#qe-target-arm','4');await page.click('#tab-armors [onclick="runQuickEnhance(\'arm\')"]');
    await check('existing quick enhancement still reaches its selected goal with the shared unit helper',()=>page.evaluate(()=>player.inv.filter(i=>i.id==='hlm_mr').reduce((n,i)=>n+i.cnt,0)===3&&player.inv.filter(i=>i.id==='hlm_mr').every(i=>i.en===4)&&!player.inv.some(i=>i.id==='scroll_armor')));
    await enter();await group(0);await page.click('#same-batch-mode-target');
    for(const width of [1330,1920])for(const scale of [60,75,80,100]) {
        await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:759,deviceScaleFactor:1,mobile:false});await page.evaluate(scale=>setUiScale(scale),scale);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await check(`${width}px ${scale}% batch controls fit the scrollable window`,()=>page.evaluate(()=>{const p=document.getElementById('modal-item-window'),r=p.getBoundingClientRect(),b=document.getElementById('same-batch-panel');return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&b.scrollWidth<=b.clientWidth+1&&[...b.querySelectorAll('input,select,button')].every(e=>e.getBoundingClientRect().right<=r.right+1);}));
    }
    await page.click('#same-batch-preview');
    if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/same-batch-enhance-'+options.protocol+'.png'});
    await page.click('#same-batch-confirm');
    if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/same-batch-result-'+options.protocol+'.png'});
    await check('no runtime errors',()=>page.evaluate(()=>!__batchErrors.length||__batchErrors));
    const expected=await page.evaluate(()=>{saveGame();return JSON.stringify(player.inv);});
    await page.reload();await page.waitForFunction(()=>document.readyState==='complete'&&typeof loadGame==='function');
    await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;currentSlot=1;loadGame();});
    await page.waitForFunction(()=>player.cls&&!document.getElementById('game-screen').classList.contains('hidden'));
    await check('document reload and native load preserve batch inventory exactly',()=>page.evaluate(expected=>{stopGameTimers();state.running=false;return JSON.stringify(player.inv)===expected;},expected));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');await page.evaluate(()=>window.name='');
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Same batch enhancement regression');
if(!options.keepSpace)await task.finish({keep:[]});
