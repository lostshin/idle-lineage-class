// Real UI/reload; only network, clock and storage are synthetic and isolated.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space ?? '舒適版新版本提示'), page = task.page('p1'), reports = [], sources = {};
console.log({spaceId:task.spaceId});
for (const file of ['index.html','js/update-notice.js','css/update-notice.css','comfort-update.json','scripts/update-cache.py','tests/update-notice.e2e.js']) try { sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex'); } catch {}
async function check(name, fn) {
    try { const detail = await fn(); reports.push({name,status:detail === true ? 'PASS':'FAIL',detail:detail === true ? undefined:detail}); }
    catch (e) { reports.push({name,status:'FAIL',detail:String(e)}); }
    await fs.writeFile(options.artifacts+'/update-notice-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego Chromium; native update buttons and navigation, synthetic storage and release responses, public lobby isolated',sources,reports},null,2));
}
let init;
async function boot({enabled=true, response='new', data={}}={}) {
    if (init) await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
    init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
        window.__updateData=${JSON.stringify(data)}; window.__updateSession={}; window.__updateErrors=[]; window.__updateFail=''; window.__updateRequests=0; window.__updateResponse=${JSON.stringify(response)};
        for (const [key,data] of [['localStorage',__updateData],['sessionStorage',__updateSession]]) Object.defineProperty(window,key,{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{if(key==='localStorage'&&(__updateFail==='all'||k===__updateFail))throw Error('synthetic write failure');data[k]=String(v);},removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}}});
        window.BroadcastChannel=undefined;
        const nativeFetch=fetch;
        window.fetch=(u,...args)=>{
            const url=String(u);
            if(url.includes('idle-lineage-lobby.lostshinanalytics.workers.dev'))return Promise.reject(Error('isolated lobby'));
            if(url.includes('comfort-update.json')){
                __updateRequests++;
                if(__updateResponse==='offline')return Promise.reject(Error('synthetic offline'));
                if(__updateResponse==='bad')return Promise.resolve(new Response('{bad'));
                const v=typeof FORK_VERSION==='string'?FORK_VERSION:'v3.9.29',b=document.querySelector('meta[name="comfort-build"]')?.content||'baseline';
                const body={schema:1,product:'idle-lineage-comfort',version:__updateResponse==='old'?'v1.0.0':__updateResponse==='same'?v:'v99.0.0',build:__updateResponse==='same'?b:'f'.repeat(64),publishedAt:'2099-01-01T00:00:00.000Z',notes:['合成更新：保留進度與操作。']};
                return Promise.resolve(new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}}));
            }
            return nativeFetch(u,...args);
        };
        addEventListener('error',e=>__updateErrors.push(e.message));
        document.addEventListener('DOMContentLoaded',()=>{if(${enabled}&&location.protocol==='http:'){const m=document.createElement('meta');m.name='comfort-update-url';m.content=new URL('comfort-update.json',location.href);document.head.appendChild(m);}});
    })();`})).identifier;
    await page.goto(options.url+'?update-notice');
    await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
    await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});
}
async function create(slot=1) { await page.evaluate(slot=>{if(slot>1){openLoadSelect();loadSetPage(Math.ceil(slot/4));loadSelectSlot(slot);loadCreateSelected();}selectClass('m_knight');document.getElementById('creation-name').value='合成更新驗證';startGame();stopGameTimers();state.running=false;player.gold=123456;saveGame();},slot); }
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.cdp('Network.setBypassServiceWorker',{bypass:true});
await boot({enabled:false});
await check('local HTTP and file do not automatically contact the release service',()=>page.evaluate(()=>__updateRequests===0));
if(options.protocol==='http') {
    for(const response of ['same','old','bad','offline']) {
        await boot({response});
        await check(response+': no update warning or runtime error',()=>page.evaluate(()=>!!window.comfortUpdate&&!document.querySelector('#update-notice')&&!__updateErrors.length));
    }
    await page.evaluate(async()=>{__updateResponse='new';await comfortUpdate.check();});
    await check('failed background check does not linger beside a detected release',()=>page.evaluate(()=>{const b=document.getElementById('update-notice'),m=document.getElementById('update-result');return !!b&&!b.hidden&&b.textContent.includes('v99.0.0')&&(m.hidden||!m.textContent.includes('無法檢查'));}));
    await boot();
    await check('first response detects a newer release against the running page',async()=>{await page.waitForFunction(()=>!!document.getElementById('update-notice'),undefined,{timeout:4000});return page.evaluate(()=>document.getElementById('update-notice').textContent.includes('v99.0.0'));});
    await check('embedded build matches the published metadata',async()=>{const d=JSON.parse(await fs.readFile(options.root+'/comfort-update.json','utf8'));return page.evaluate(d=>document.querySelector('meta[name="comfort-build"]')?.content===d.build&&FORK_VERSION===d.version,d);});
    await check('top banner directly offers update and later without a modal or backdrop',()=>page.evaluate(()=>{const b=document.getElementById('update-notice');if(!b||b.hidden)return false;const r=b.getBoundingClientRect();return b.parentNode===document.body&&getComputedStyle(b).position==='fixed'&&r.top>=0&&r.top<=10&&b.textContent.includes(FORK_VERSION)&&b.textContent.includes('v99.0.0')&&!!b.querySelector('#update-apply')&&!!b.querySelector('#update-notice-later')&&!document.getElementById('update-dialog')&&!document.querySelector('dialog:modal');}));
    if(await page.evaluate(()=>!!document.querySelector('#update-notice-later')))await page.click('#update-notice-later');
    await check('later suppresses this release while settings retain an entry',()=>page.evaluate(async()=>{if(!window.comfortUpdate)return false;await comfortUpdate.check();return !!document.getElementById('update-notice')?.hidden&&!!document.getElementById('update-settings-open');}));
    await check('background pauses checks and foreground resumes only after ten minutes',()=>page.evaluate(async()=>{
        if(!window.comfortUpdate)return false;
        const own=Object.getOwnPropertyDescriptor(document,'hidden'),now=performance.now.bind(performance),before=__updateRequests;
        Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));await comfortUpdate.check();
        const paused=__updateRequests===before;
        Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
        const throttled=__updateRequests===before;
        performance.now=()=>now()+600001;document.dispatchEvent(new Event('visibilitychange'));await comfortUpdate.check();
        performance.now=now;if(own)Object.defineProperty(document,'hidden',own);else delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
        return paused&&throttled&&__updateRequests===before+1;
    }));
    await check('stale release responses cannot downgrade a detected newer release',()=>page.evaluate(async()=>{if(!window.comfortUpdate)return false;__updateResponse='old';await comfortUpdate.check();__updateResponse='new';return document.getElementById('update-settings-open').textContent.includes('v99.0.0');}));
    await create(6);
    await check('checking for updates does not save or mutate the character',()=>page.evaluate(async()=>{if(!window.comfortUpdate)return false;const p=JSON.stringify(player),s=JSON.stringify(__updateData);await comfortUpdate.check();return JSON.stringify(player)===p&&JSON.stringify(__updateData)===s;}));
    await check('repeated checks share the pending request',()=>page.evaluate(async()=>{if(!window.comfortUpdate)return false;const before=__updateRequests;await Promise.all([comfortUpdate.check(),comfortUpdate.check(),comfortUpdate.check()]);return __updateRequests===before+1;}));
    await page.evaluate(()=>window.comfortUpdate?.open());
    const hasButton=await page.evaluate(()=>!!document.getElementById('update-apply'));
    for(const mode of ['catchup','death','dungeon','other-tabs','role-changed','all','pet']) {
        await page.evaluate(mode=>{
            window.__updateSave0=saveGame;window.__updateOther0=_roleOtherActiveSessions;window.__updateAllowed0=_roleSaveAllowed;
            if(mode==='catchup'){state.ff=true;window.__updateCatchupGuard=()=>{state.ff=true;};document.getElementById('update-apply')?.addEventListener('click',__updateCatchupGuard,{capture:true,once:true});}
            if(mode==='death')player.dead=true;
            if(mode==='dungeon')state.riftRun={active:true};
            if(mode==='other-tabs')_roleOtherActiveSessions=()=>[{}];
            if(mode==='role-changed')_roleSaveAllowed=()=>false;
            // Arm write failures on the update click itself so unrelated background flushes cannot hide the banner first.
            const armFailure=key=>document.getElementById('update-apply')?.addEventListener('click',()=>{__updateFail=key;},{capture:true,once:true});
            if(mode==='all')armFailure('all');
            if(mode==='pet'){petRoster();petMarkDirty();armFailure(_petRosterKey);}
            window.__updateToken=performance.timeOrigin;window.__updateMemory=player.gold;
        },mode);
        if(hasButton){await page.evaluate(()=>window.comfortUpdate?.open());await page.click('#update-apply');}
        await check(mode+': blocked update retains document and in-memory progress',()=>page.evaluate(()=>!!window.comfortUpdate&&performance.timeOrigin===__updateToken&&player.gold===__updateMemory&&document.getElementById('update-result')?.textContent.length>0));
        await page.evaluate(()=>{state.ff=false;player.dead=false;delete state.riftRun;_tickDebt=0;_roleOtherActiveSessions=__updateOther0;_roleSaveAllowed=__updateAllowed0;__updateFail='';saveGame=__updateSave0;saveGame();});
    }
    await check('unwritten mercenary ledger blocks reload and preserves entries',async()=>{
        await page.evaluate(()=>{if(!window.comfortUpdate)return;window.__ledgerFlush0=_mercLedgerFlush;window.__ledgerSave0=saveGame;_mercLedgerOutbox=[{uid:'synthetic-update-ledger'}];_mercLedgerFlush=()=>{};saveGame=()=>true;comfortUpdate.open();window.__ledgerToken=performance.timeOrigin;});
        if(hasButton)await page.click('#update-apply');
        const ok=await page.evaluate(()=>!!window.comfortUpdate&&performance.timeOrigin===__ledgerToken&&_mercLedgerOutbox[0]?.uid==='synthetic-update-ledger'&&document.getElementById('update-result').textContent.includes('傭兵經驗'));
        await page.evaluate(()=>{if(window.__ledgerFlush0){_mercLedgerFlush=__ledgerFlush0;saveGame=__ledgerSave0;}_mercLedgerOutbox=[];_mercSyncPlayerOutbox();});return ok;
    });
    await check('normal ticking continues after a blocked update',()=>page.evaluate(()=>{const before=state.ticks;state.running=true;tick();state.running=false;return state.ticks===before+1;}));
    await check('banner leaves native game controls clickable',async()=>{if(!hasButton)return false;await page.click('#btn-automation');return page.evaluate(()=>!document.getElementById('tab-automation').classList.contains('hidden')&&!document.querySelector('dialog:modal'));});
    await page.evaluate(()=>window.comfortUpdate?.open());
    await page.evaluate(()=>{setUiScale(100);});
    for(const [width,height]of [[1330,900],[1920,1080],[390,844],[844,390]]) {
        await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await check(width+'x'+height+': top banner text and actions fit',()=>page.evaluate(()=>{const d=document.getElementById('update-notice');if(!d||d.hidden)return false;const r=d.getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth+1&&r.top>=0&&r.top<=10&&r.bottom<=document.documentElement.clientHeight+1&&d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=23.5);}));
    }
    await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
    if(!options.skipScreenshots&&hasButton)try{
        await page.screenshot({path:options.artifacts+'/update-notice-error-'+options.protocol+'.png'});
        await page.evaluate(()=>{const e=document.getElementById('update-result');e.hidden=true;});
        await page.screenshot({path:options.artifacts+'/update-notice-'+options.protocol+'.png'});
    }catch(e){console.log({screenshot:String(e)});}
    // Use browser-memory storage across the native navigation, never real localStorage.
    if(hasButton) {
        const data=await page.evaluate(()=>{player.gold=987654;player.futureUpdate={kept:true};return {data:{...__updateData},session:{...__updateSession}};});
        const persist=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{Object.assign(__updateData,${JSON.stringify(data.data)});Object.assign(__updateSession,${JSON.stringify(data.session)});})();`})).identifier;
        // Capture the completed native save and reload ticket in window.name before actual navigation.
        await page.evaluate(()=>{const s=localStorage.setItem;localStorage.setItem=function(k,v){s(k,v);window.name=JSON.stringify({data:__updateData,session:__updateSession});};const t=sessionStorage.setItem;sessionStorage.setItem=function(k,v){t(k,v);window.name=JSON.stringify({data:__updateData,session:__updateSession});};});
        const restore=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{try{const p=JSON.parse(window.name);Object.assign(__updateData,p.data);Object.assign(__updateSession,p.session);}catch{}})();`})).identifier;
        const before=await page.evaluate(()=>performance.timeOrigin);
        await page.click('#update-apply');
        await page.waitForFunction(before=>performance.timeOrigin!==before&&document.readyState==='complete',before,{timeout:15000});
        await check('successful native update saves progress and returns to character selection',()=>page.evaluate(()=>accountRoleDoc(6).p.gold===987654&&accountRoleDoc(6).p.futureUpdate.kept&&!document.getElementById('load-select-panel').classList.contains('hidden')&&_loadSelectedSlot===6&&!!document.querySelector('#load-slot-grid .load-slot-card.selected[data-slot="6"]')));
        await check('reload still on old build is reported without an automatic reload loop',()=>page.evaluate(()=>document.getElementById('update-result')?.textContent.includes('仍是')&&!__updateSession.comfort_update_pending));
        await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:persist});await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:restore});
    } else {
        await check('successful native update saves progress and returns to character selection',()=>false);
        await check('reload still on old build is reported without an automatic reload loop',()=>false);
    }
} else await check('file mode keeps native play and save without release checks',async()=>{await create();return page.evaluate(()=>__updateRequests===0&&saveGame()===true&&accountRoleDoc(1).p.gold===123456);});
await check('final document has no runtime errors',()=>page.evaluate(()=>!__updateErrors.length||__updateErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Update notice checks failed');
if(!options.keepSpace)await task.finish({keep:[]});
