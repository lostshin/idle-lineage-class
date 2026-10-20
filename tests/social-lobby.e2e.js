// Failure cases: selecting the lobby teleports/ends a run, uploads without consent,
// stale replies reopen closed UI, unsafe card text executes, or background combat stops.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '冒險者大廳驗收'), page = task.page('p1'), reports = [], sources = {};
const apiBase = options.lobbyApi || 'http://127.0.0.1:9998', origin = new URL(options.url).origin;
let visitor = null, basicVisitor = null;
async function worker(path, method = 'GET', body, token) {
    const response = await fetch(apiBase + '/v1' + path, { method, headers: { Origin: 'https://lostshin.github.io', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json(); if (!response.ok) throw Error(JSON.stringify(result)); return result;
}
if (options.lobbyApi) {
    visitor = await worker('/auth/guest', 'POST', { deviceKey: crypto.randomBytes(32).toString('hex') });
    await worker('/me/card', 'PUT', { card: { name: '合成旅人', intro: '<img src=x onerror=alert(1)>', cls: 'knight', avatar: '男騎士', level: 65 }, version: 0 }, visitor.token);
    await worker('/presence', 'POST', {actor:{name:'合成旅人',cls:'knight',avatar:'男騎士'},page:'/idle-lineage-class/'}, visitor.token);
    basicVisitor = await worker('/auth/guest','POST',{deviceKey:crypto.randomBytes(32).toString('hex')});
    await worker('/presence','POST',{actor:{name:'未發名片旅人',cls:'mage',avatar:'女法師'},page:'/idle-lineage-class/'},basicVisitor.token);
}
console.log({ spaceId: task.spaceId });
for (const file of ['index.html', 'js/social-lobby.js', 'js/11-world-map.js', 'js/09-vfx-render.js', 'css/social-lobby.css', 'tests/social-lobby.e2e.js', ...(options.lobbyApi ? ['backend/lobby/src/worker.mjs', 'backend/lobby/migrations/0001_lobby.sql'] : [])]) {
    sources[file] = crypto.createHash('sha256').update(await fs.readFile(options.root + '/' + file)).digest('hex');
}
async function check(name, fn) {
    try { const value = await fn(); if (value !== true) throw Error(JSON.stringify(value)); reports.push({ name, status: 'PASS' }); }
    catch (error) { reports.push({ name, status: 'FAIL', error: String(error) }); }
    await fs.writeFile(options.artifacts + '/social-lobby-' + (options.lobbyApi ? 'worker-' : '') + options.protocol + '.json', JSON.stringify({ method: options.lobbyApi ? 'Actual Ego browser with local Cloudflare workerd and D1, synthetic visitors; not deployed Cloudflare' : 'Actual Ego browser; isolated synthetic storage and social API fixture, not a Cloudflare deployment', sources, reports }, null, 2));
}
async function click(selector) {
    await page.waitForFunction(() => document.getElementById('social-lobby')?.getAttribute('aria-busy') !== 'true');
    await page.waitForSelector(selector, {state:'visible'});
    await page.evaluate(selector => { const el=document.querySelector(selector); el.focus({preventScroll:true}); el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}); }, selector);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const point=await page.evaluate(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return hit===el||el.contains(hit)?{x,y}:null;},selector);
    if(!point)throw Error('Control is obscured: '+selector);
    await page.mouse.click(point.x,point.y);
    await page.waitForFunction(() => document.getElementById('social-lobby')?.getAttribute('aria-busy') !== 'true');
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const values = {}, requests = []; window.__lobbyRequests = requests; window.__lobbyErrors = [];
    const storage = {getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k],key:i=>Object.keys(values)[i]??null,get length(){return Object.keys(values).length}};
    for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{value:storage,configurable:true});
    window.BroadcastChannel=undefined;
    addEventListener('error',event=>__lobbyErrors.push(event.message));
    const nativeFetch=window.fetch, snapshotTime=Date.now();window.__lobbyTimers=[];const nativeTimeout=setTimeout;window.setTimeout=(fn,ms,...args)=>{if(ms===300000)__lobbyTimers.push(()=>fn(...args));return nativeTimeout(fn,ms,...args);};
    window.fetch=async (input,options={})=>{
        if(!String(input).startsWith('${apiBase}'))return nativeFetch(input,options);
        const path=new URL(input).pathname;requests.push({path,method:options.method||'GET',body:options.body});
        if(${!!options.lobbyApi})return nativeFetch(input,options);
        const card={id:'00000000-0000-4000-8000-000000000002',version:1,updatedAt:snapshotTime,lastSeen:snapshotTime,card:{name:'合成旅人',intro:'<img src=x onerror=alert(1)>',progress:'一起聊配裝',cls:'knight',avatar:'男騎士',level:65}};
        let value={};
        if(path.endsWith('/auth/guest'))value={token:'synthetic',user:{id:'00000000-0000-4000-8000-000000000001',admin:false}};
        else if(path.endsWith('/me'))value={user:{id:'00000000-0000-4000-8000-000000000001',admin:false},card:null};
        else if(path.endsWith('/cards'))value={cards:[card],next:null};
        else if(path.endsWith('/players'))value={players:[{id:card.id,actor:card.card,lastSeen:card.lastSeen,hasCard:true}],next:null,serverTime:Date.now(),onlineCount:2,siteOnlineCount:0,siteRecentCount:0};
        else if(path.endsWith('/comments'))value={comments:[],next:null};
        else if(path.endsWith('/me/card'))value={version:1};
        else if(path.includes('/cards/'))value={...card,favorite:false};
        return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
    };
})();` })).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1330, height: 900, deviceScaleFactor: 1, mobile: false });
await page.goto(options.url + '?social-lobby');
await page.waitForFunction(() => document.readyState === 'complete' && typeof startGame === 'function');
await page.evaluate(apiBase => {
    document.getElementById('social-lobby-api').content = apiBase;
    _bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker = null;
    selectClass('m_knight'); document.getElementById('creation-name').value = '合成大廳角色'; startGame();
    stopGameTimers(); state.running = false; setUiScale(80); setMapSelectors('training'); changeMap(true);
    window.__lobbyBefore = { map: mapState.current, lastMap: player.lastBattleMap, mobs: mapState.mobs, gold: player.gold, inv: JSON.stringify(player.inv), player };
}, apiBase);
await check('lobby is available in the original map category selector', () => page.evaluate(() => !!document.querySelector('#map-category option[value="social_lobby"]')));
await page.selectOption('#map-category', 'social_lobby');
await page.waitForSelector('#social-lobby:not([hidden])');
await check('entering does not teleport, replace mobs, consume items or replace the actor', () => page.evaluate(() => mapState.current === __lobbyBefore.map && mapState.mobs === __lobbyBefore.mobs && player === __lobbyBefore.player && player.gold === __lobbyBefore.gold && JSON.stringify(player.inv) === __lobbyBefore.inv && player.lastBattleMap === __lobbyBefore.lastMap));
await check('entry announces only current role identity and does not publish a card or private map', () => page.evaluate(() => !__lobbyRequests.some(r=>r.path==='/v1/me/card')&&__lobbyRequests.every(r=>{if(r.path!=='/v1/presence')return true;const b=JSON.parse(r.body);return !b.map&&Object.keys(b.actor).every(k=>['name','cls','avatar'].includes(k));})));
await check('battle scene is concealed while the lobby scene is visible', () => page.evaluate(() => getComputedStyle(document.getElementById('battle-view')).display === 'none' && document.getElementById('social-lobby').getBoundingClientRect().height > 100));
await check('lobby mode is absent from the serialized player', () => page.evaluate(() => !JSON.stringify(player).includes('social_lobby')));
await check('portable account exports do not contain the browser visitor credential', () => page.evaluate(() => {
    const key=localStorage.getItem('lineage_social_lobby_device_v1');
    return !key || !JSON.stringify(buildAccountSnapshot()).includes(key);
}));
await click('[data-self="true"]');await click('#lobby-edit');
await page.fill('#lobby-intro', '我想聊配裝');
await click('[data-editor-tab="sharing"]');await page.fill('#lobby-progress', '象牙塔七樓');
await click('#lobby-preview');
await check('preview is local and contains only checked fields', () => page.evaluate(() => {
    const value = document.getElementById('lobby-preview-text').textContent;
    return value.includes('合成大廳角色') && value.includes('我想聊配裝') && !value.includes('象牙塔七樓') && !__lobbyRequests.some(r => r.path.endsWith('/me/card'));
}));
await click('#lobby-editor-close');
if (!options.lobbyApi) await page.evaluate(() => { socialLobby.setSession({token:'synthetic',user:{id:'00000000-0000-4000-8000-000000000001',admin:false}}); });
await click('#lobby-roster');await click('#lobby-refresh');
const visitorSelector=options.lobbyApi ? '#lobby-visitors [data-card-id="'+visitor.user.id+'"]' : '#lobby-visitors [data-card-id]';
await page.waitForSelector(visitorSelector);
if(options.lobbyApi)await check('actual D1 peer remains visible and shares the backend recent headcount',async()=>{
    const result=await worker('/players','GET',undefined,visitor.token);
    return page.evaluate(({id,count})=>!!document.querySelector('[data-camp-id="'+id+'"]')&&document.getElementById('world-online-count').textContent==='（近 30 分鐘活躍 '+count+' 人）',{id:visitor.user.id,count:result.siteRecentCount});
});
await page.evaluate(selector => { window.__lobbyVisitorNode=document.querySelector(selector); },visitorSelector);
await click('#lobby-refresh');
await check('an unchanged list refresh preserves the original visitor node', () => page.evaluate(selector => document.querySelector(selector) === __lobbyVisitorNode,visitorSelector));
await click(visitorSelector);
await page.waitForSelector('#lobby-card-detail:not([hidden])');
await check('remote content is rendered as text rather than executable HTML', () => page.evaluate(() => document.getElementById('lobby-card-detail').textContent.includes('<img src=x onerror=alert(1)>') && !document.querySelector('#lobby-card-detail img[src="x"]')));
if (options.lobbyApi) {
    await click('#lobby-favorite');
    await click('#lobby-open-comments');
    await click('#lobby-write-comment');
    await page.fill('#lobby-comment', '合成訪客向你打招呼'); await click('#lobby-comment-send');
    await check('a second visitor can read the browser-posted comment from actual D1', async () => (await worker('/cards/' + visitor.user.id + '/comments', 'GET', undefined, visitor.token)).comments.some(row => row.text === '合成訪客向你打招呼'));
    await click('#lobby-comment-close');
}
await click('#lobby-detail-close');
await click('[data-self="true"]');await click('#lobby-edit');
await page.fill('#lobby-intro', '合成公開介紹');
if (options.lobbyApi) { await click('[data-editor-tab="sharing"]'); await click('#lobby-share-map'); }
await click('#lobby-preview');
await click('#lobby-publish');
await page.waitForFunction(() => __lobbyRequests.some(r => r.path.endsWith('/me/card')));
await check('explicit publish sends a small allowlisted snapshot without save identity or inventory', () => page.evaluate(() => {
    const request = __lobbyRequests.find(r => r.path.endsWith('/me/card')), payload = JSON.parse(request.body);
    return payload.card.name === '合成大廳角色' && !['inv','enSeed','eq','gold','stats','skills','offlineHunt'].some(k => JSON.stringify(payload).includes('"'+k+'"'));
}));
if (options.lobbyApi) await check('a second visitor sees the browser-published card from actual D1', async () => (await worker('/cards', 'GET', undefined, visitor.token)).cards.some(row => row.card.name === '合成大廳角色'));
if (options.lobbyApi) await check('actual D1 online list includes the published browser player and its shared current map', async () => {
    const expected=await page.evaluate(()=>mapEntryOf(mapState.current).t);
    return (await worker('/cards?view=online','GET',undefined,visitor.token)).cards.some(row=>row.card.name==='合成大廳角色'&&row.currentMap===expected);
});
if (options.lobbyApi) {
    await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
    await click('[data-camp-id="'+basicVisitor.user.id+'"]');
    await click('#lobby-open-comments');await click('#lobby-write-comment');
    await page.fill('#lobby-comment','未發名片仍可收留言');await click('#lobby-comment-send');
    await check('unpublished visitor receives native browser message persisted in real D1',async()=>
        (await worker('/cards/'+basicVisitor.user.id+'/comments','GET',undefined,basicVisitor.token)).comments.some(row=>row.text==='未發名片仍可收留言'));
    await click('#lobby-comment-close');await click('#lobby-detail-close');
    await worker('/me','DELETE',{confirm:true},basicVisitor.token);
}
await page.evaluate(() => { window.__lobbyCombatTicks = state.ticks; state.running = true; for (let i=0;i<10;i++) { state.inTick=true; tick(); state.inTick=false; settleDeadMobs(); } flushTickRender(); });
await check('native combat still advances while the lobby remains open', () => page.evaluate(() => state.ticks === __lobbyCombatTicks + 10 && mapState.current === 'training' && !document.getElementById('social-lobby').hidden && state.running));
await check('hidden battle effects do not accumulate in the social scene', () => page.evaluate(() => _vfxMute() && !document.querySelector('#vfx-layer > *')));
await click('#lobby-exit');
await check('exit restores the current battle without restoring an old actor snapshot', () => page.evaluate(() => document.getElementById('social-lobby').hidden && !document.getElementById('map-view-panel').classList.contains('social-lobby-open') && player === __lobbyBefore.player && mapState.current === 'training' && document.getElementById('map-select').value === 'training' && !socialLobby.isPolling()));
await page.evaluate(() => { state.running=false; });
if (options.lobbyApi) {
    const expected=await page.evaluate(()=>{setMapSelectors(getHomeTown());changeMap(true);state.running=false;return mapEntryOf(mapState.current).t;});
    await page.evaluate(async()=>{await __lobbyTimers.at(-1)?.();});
    await page.waitForFunction(expected=>__lobbyRequests.some(r=>r.path==='/v1/presence'&&r.body&&JSON.parse(r.body).map===expected),expected,{timeout:40000});
    await check('controlled five-minute heartbeat updates real D1 while the player is outside the lobby',async()=>
        (await worker('/cards?view=online','GET',undefined,visitor.token)).cards.some(row=>row.card.name==='合成大廳角色'&&row.currentMap===expected));
}
await page.selectOption('#map-category', 'social_lobby');
await page.selectOption('#map-category', 'silverknight');
await check('selecting a real map leaves lobby mode through the normal map flow', () => page.evaluate(() => document.getElementById('social-lobby').hidden && mapState.current !== 'social_lobby'));
await check('no browser runtime errors', () => page.evaluate(() => !__lobbyErrors.length || __lobbyErrors));
if (!options.skipScreenshots) {
    await page.selectOption('#map-category', 'social_lobby');
    await page.screenshot({ path: options.artifacts + '/social-lobby-' + (options.lobbyApi ? 'worker-' : '') + options.protocol + '.png' });
}
if (options.lobbyApi) {
    const deviceKey = await page.evaluate(() => localStorage.getItem('lineage_social_lobby_device_v1'));
    const own = await worker('/auth/guest', 'POST', { deviceKey });
    await worker('/me', 'DELETE', { confirm: true }, own.token);
    await worker('/me', 'DELETE', { confirm: true }, visitor.token);
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: init });
console.log({ checks: reports.length, passed: reports.filter(r => r.status === 'PASS').length, failed: reports.filter(r => r.status === 'FAIL') });
if (reports.some(r => r.status === 'FAIL')) throw Error('Social lobby regression');
if (!options.keepSpace) await task.finish({ keep: [] });
