// Real Ego pages + native tracker. Synthetic game storage, no public trackers.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space), page = task.page('p1'), reports = [], sources = {};
const room = crypto.randomBytes(20).toString('hex'), prefix = 'presence-e2e-'+crypto.randomUUID()+':';
const extraSockets = [], initScripts = [];
let follower;
for (const path of ['index.html','css/responsive.css','js/online-presence.js','tests/tracker-presence-fixture.mjs']) sources[path] = crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+path)).digest('hex');
async function check(name, action) {
    try { const result = await action(); if (result !== true) throw Error(JSON.stringify(result)); reports.push({name,status:'PASS'}); }
    catch (e) { reports.push({name,status:'FAIL',error:String(e)}); console.log({name,error:String(e)}); }
    await fs.writeFile(options.artifacts+'/report-'+options.protocol+'.json',JSON.stringify({method:'Ego browser and loopback bittorrent-tracker 11.2.3; isolated synthetic storage; 1-second tracker interval; protocol faults injected at native server boundary',sources,reports},null,2));
}
async function prepare(target) {
    const source = `(()=>{const real=window.localStorage,prefix=${JSON.stringify(prefix)};const keys=()=>Array.from({length:real.length},(_,i)=>real.key(i)).filter(k=>k?.startsWith(prefix));const storage={getItem:k=>real.getItem(prefix+k),setItem:(k,v)=>real.setItem(prefix+k,String(v)),removeItem:k=>real.removeItem(prefix+k),key:i=>keys()[i]?.slice(prefix.length)??null,get length(){return keys().length}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});Object.defineProperty(window,'sessionStorage',{value:storage,configurable:true});addEventListener('storage',e=>{if(e.key?.startsWith(prefix)){e.stopImmediatePropagation();dispatchEvent(new StorageEvent('storage',{key:e.key.slice(prefix.length),oldValue:e.oldValue,newValue:e.newValue}));}},true);window.__presenceErrors=[];addEventListener('error',e=>__presenceErrors.push(e.message));})();`;
    const init = (await target.cdp('Page.addScriptToEvaluateOnNewDocument',{source})).identifier;
    initScripts.push([target,init]);
    await target.cdp('Network.setCacheDisabled',{cacheDisabled:true});
    await target.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
    await target.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
    await target.goto(options.url+'?presence-e2e='+room);
    await target.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function'&&typeof renderSyslogPandora==='function');
    await target.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;});
}
async function enable(target) { await target.evaluate(config=>{window.__presence=createOnlinePresence(config);},{trackerUrl:options.trackerUrl,infoHash:room}); }
async function enter(target,slot=1) { await target.evaluate(slot=>{currentSlot=slot;selectClass('m_mage');document.getElementById('creation-name').value='合成在線'+slot;startGame();stopGameTimers();state.running=false;},slot); }
async function count(target, value) { await target.waitForFunction(value=>document.getElementById('world-online-count').textContent==='（目前線上 '+value.toLocaleString('en-US')+' 人）',value,{timeout:15000}); }
async function control(path,data={}) { return fetch(options.controlUrl+path,{method:'POST',body:JSON.stringify(data)}).then(r=>r.json()); }
function announce(peerId,event='started') {return {action:'announce',info_hash:Buffer.from(room,'hex').toString('latin1'),peer_id:peerId,event,left:1,downloaded:0,uploaded:0,offers:[]};}
async function participant() {
    const socket = new WebSocket(options.trackerUrl); extraSockets.push(socket);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    const ready = new Promise(resolve=>socket.addEventListener('message',resolve,{once:true}));
    socket.send(JSON.stringify(announce(crypto.randomBytes(20).toString('latin1')))); await ready; return socket;
}
try {
    await prepare(page);
    await check('HTTP/file pages do not automatically join the public production room',()=>page.evaluate(()=>document.getElementById('world-online-count').hidden&&!localStorage.getItem('lineage_online_browser_v1')));
    await enable(page);
    await check('character selection does not connect or create an identity',async()=>{const state=await control('/');return !state.messages.some(m=>m.room===room)&&await page.evaluate(()=>!localStorage.getItem('lineage_online_browser_v1'));});
    await enter(page); await count(page,1);
    await check('native game entry displays the real tracker count while game timers are paused',()=>page.evaluate(()=>document.getElementById('world-online-count').dataset.state==='ready'&&player.cls==='mage'&&state.running===false));
    const peerId = await page.evaluate(()=>localStorage.getItem('lineage_online_browser_v1'));
    await check('only a random 20-byte peer ID is stored',()=>/^[a-f0-9]{40}$/.test(peerId));
    await page.evaluate(()=>__presence.refresh()); await count(page,1);
    await check('repeat announcements preserve the count and the role identity',()=>page.evaluate(()=>document.getElementById('world-online-count').textContent==='（目前線上 1 人）'&&player.name==='合成在線1'));
    follower = await task.newPage(); await prepare(follower); await enable(follower); await enter(follower,2); await count(follower,1);
    await check('two real browser tabs share one reporting leader',async()=>{const r=await control('/');const joins=r.messages.filter(m=>m.room===room&&m.event==='started');return joins.length===1;});
    await participant(); await count(page,2); await count(follower,2);
    await check('an independent synthetic browser increases the count in both tabs',()=>true);
    await page.evaluate(()=>returnToCharacterSelect());
    await follower.waitForFunction(()=>document.getElementById('world-online-count').dataset.reporter==='true'&&document.getElementById('world-online-count').dataset.state==='ready');
    await count(follower,2);
    await check('leader handover preserves one browser participant',async()=>{const r=await control('/');return r.messages.filter(m=>m.room===room&&m.peerId===peerId&&m.event==='started').length===2;});
    const reloadPeer = await follower.evaluate(()=>localStorage.getItem('lineage_online_browser_v1'));
    await check('switching characters/tabs preserves the anonymous browser ID',()=>reloadPeer===peerId);
    await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();state.running=false;}); await count(page,2);
    await follower.evaluate(async()=>{await __presence.stop();returnToCharacterSelect();});
    await page.waitForFunction(()=>document.getElementById('world-online-count').dataset.reporter==='true'&&document.getElementById('world-online-count').dataset.state==='ready');
    await count(page,2);
    await follower.close(); follower=null;
    await control('/close',{peerId});
    await page.waitForFunction(()=>document.getElementById('world-online-count').dataset.state==='unavailable');
    await count(page,2);
    await check('a severed tracker connection reconnects without inflating the count',()=>true);
    for(let batch=0;batch<10;batch++)await Promise.all(Array.from({length:10},()=>participant()));
    await count(page,102);
    await check('more than 100 real local tracker connections are counted',()=>true);
    for(const width of [1330,1920])for(const scale of [60,75,80,100]) {
        await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
        await page.evaluate(scale=>{setUiScale(scale);gameLayout.reset();player.pandoraMarket2={slots:[{id:'wpn_katana',weight:1}],lastIdx:0};renderSyslogPandora();},scale);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await check(`${width}px ${scale}%: title, count and black-market announcement fit`,()=>page.evaluate(()=>{const header=document.querySelector('.world-channel-header'),h=header.getBoundingClientRect(),e=document.getElementById('world-online-count'),r=e.getBoundingClientRect();return header.scrollWidth<=header.clientWidth+1&&r.left>=h.left-1&&r.right<=h.right+1&&r.bottom<=h.bottom+1&&getComputedStyle(e).whiteSpace==='nowrap'&&!!document.getElementById('syslog-pandora').textContent;}));
    }
    await control('/fault',{room,mode:'malformed'}); await page.evaluate(()=>__presence.refresh());
    await page.waitForFunction(()=>document.getElementById('world-online-count').dataset.state==='unavailable',undefined,{timeout:15000});
    await check('invalid tracker counts produce unavailable instead of zero or stale numbers',()=>page.evaluate(()=>document.getElementById('world-online-count').textContent==='（線上人數暫不可用）'&&saveGame()===true));
    await control('/fault',{room,mode:'normal'}); await count(page,102);
    const observed = await control('/');
    await check('wire payloads never contain role names, saves or WebRTC offers',()=>observed.messages.filter(m=>m.room===room).every(m=>m.offers===0&&m.keys.sort().join(',')==='action,downloaded,event,info_hash,left,offers,peer_id,uploaded'));
    if(!options.skipScreenshots) {
        await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate(()=>{setUiScale(100);gameLayout.reset();});
        await page.screenshot({path:options.artifacts+'/preview-'+options.protocol+'.png'});
    }
    await page.evaluate(()=>__presence.stop());
    await page.reload();await page.waitForFunction(()=>typeof startGame==='function'&&document.readyState==='complete');await enable(page);
    await page.evaluate(()=>{currentSlot=1;loadGame();stopGameTimers();state.running=false;});await count(page,102);
    await check('full reload retains browser identity and restores native game play',()=>page.evaluate(id=>localStorage.getItem('lineage_online_browser_v1')===id&&player.name==='合成在線1'&&saveGame()===true,peerId));
    await page.evaluate(()=>{__presence.stop();returnToCharacterSelect();const storage=window.localStorage;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:storage.getItem,setItem:()=>{throw Error('synthetic storage failure');}}});});
    await enable(page);await enter(page,3);
    await page.waitForFunction(()=>document.getElementById('world-online-count').dataset.state==='unavailable');
    await check('storage failures do not create duplicate transient identities',()=>page.evaluate(()=>document.getElementById('world-online-count').textContent==='（線上人數暫不可用）'));
    await check('no browser runtime errors',()=>page.evaluate(()=>__presenceErrors.length===0||__presenceErrors));
} finally {
    await page.evaluate(()=>window.__presence?.stop());
    if(follower){await follower.evaluate(()=>window.__presence?.stop());await follower.close();}
    for(const socket of extraSockets)socket.close();
    for(const [target,init]of initScripts)if(target===page)await target.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
}
console.log({spaceId:task.spaceId,protocol:options.protocol,checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(reports.some(r=>r.status==='FAIL'))throw Error('Tracker presence E2E failed');
