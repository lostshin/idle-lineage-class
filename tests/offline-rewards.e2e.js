(async () => {
const fs = await import('node:fs/promises');
const task = await taskSpace(options.space || '離線獎勵恢復驗收');
console.log({spaceId: task.spaceId});
const page = task.page(options.page || 'p1'), reports = [];
const namespace = 'codex_offline_fixture_' + Date.now() + '_' + options.protocol;
// Only this unique synthetic bucket touches native storage; game keys are virtualized.
const fixtureSource = `(() => {
    if (!location.href.startsWith(${JSON.stringify(options.url)})) return;
    const native = window.localStorage, key = ${JSON.stringify(namespace)};
    const record = JSON.parse(native.getItem(key) || '{"data":{}}');
    if (!record.data.lineage_optional_addons_v1) record.data.lineage_optional_addons_v1 = JSON.stringify({v:1,enabled:{history:true,slotinfo:true}});
    const clock = {now: record.nextNow || Date.now(), next: record.nextNow || Date.now()};
    const errors = [];
    let active = true;
    const persist = () => active && native.setItem(key, JSON.stringify({data: record.data, nextNow: clock.next}));
    window.__offlineTest = {data: record.data, clock, errors, fail: '', persist,
        advance(ms) {clock.now += ms; clock.next = clock.now; persist();},
        reopenAfter(ms) {clock.next = clock.now + ms; persist();},
        cleanup() {active = false; native.removeItem(key);}
    };
    Date.now = () => clock.now;
    const api = {getItem: k => record.data[k] ?? null, setItem(k, v) {
        if (__offlineTest.fail && k.includes(__offlineTest.fail)) throw Error('synthetic storage failure');
        record.data[k] = String(v); persist();
    }, removeItem(k) {delete record.data[k]; persist();}, key: i => Object.keys(record.data)[i] ?? null,
        get length() {return Object.keys(record.data).length;}};
    const storage = new Proxy(api, {ownKeys: () => Object.keys(record.data),
        getOwnPropertyDescriptor: (t, k) => k in record.data ? {configurable: true, enumerable: true, value: record.data[k]} : Object.getOwnPropertyDescriptor(t, k)});
    Object.defineProperty(window, 'localStorage', {value: storage});
    Object.defineProperty(window, 'sessionStorage', {value: storage});
    addEventListener('error', e => errors.push(e.message));
})();`;
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source:fixtureSource})).identifier;
async function check(name, fn) {
    try {const r = await fn(); if (r !== true) throw Error(JSON.stringify(r)); reports.push({name, status:'PASS'});}
    catch (e) {reports.push({name, status:'FAIL', error:String(e)}); console.log({name, error:String(e)});}
    await fs.writeFile(options.artifacts + '/offline-rewards-' + (options.baseline ? 'baseline' : options.protocol) + '.json', JSON.stringify({method:'Ego browser, actual tab closure plus native kill/save/load and document reopen, isolated persistent synthetic bucket and controlled wall clock', reports}, null, 2));
}
async function open(target = page) {
    await target.goto(options.url + '?offline-rewards-test');
    await target.waitForFunction(() => document.readyState === 'complete' && typeof startGame === 'function');
    await target.cdp('Page.bringToFront');
    await target.waitForFunction(() => !document.hidden);
    await target.evaluate(() => {_bgHeartbeatWorker?.terminate(); _bgHeartbeatWorker = null; _getLzWorker = () => null;});
}
async function reopen(ms, slot = 1) {
    await page.evaluate(ms => __offlineTest.reopenAfter(ms), ms);
    await page.goto('about:blank'); // Native unload handlers must persist the last snapshot.
    await open();
    await page.evaluate(slot => {currentSlot = slot; loadGame(); stopGameTimers();}, slot);
    await page.waitForFunction(() => !document.getElementById('game-screen').classList.contains('hidden'));
    // A task turn after the native load settlement callback, without arbitrary sleep.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
}
async function sample(slot = 1, target = page) {
    return target.evaluate(slot => {
        document.getElementById('offline-reward-modal')?.remove();
        if (player.cls && !document.getElementById('game-screen').classList.contains('hidden')) returnToCharacterSelect();
        currentSlot = slot; selectClass('m_mage'); document.getElementById('creation-name').value='合成測試角色';startGame(); stopGameTimers();
        player.name = '合成離線角色' + slot; player.lv = 60; player.gold = 100000;
        player.config.offlineSentinel = 'preserve-unknown'; player.autoSellOn = false;
        setMapSelectors('training'); changeMap(true); calcStats(); player.hp = player.mhp; player.mp = player.mmp;
        for (let i = 0; i < 3; i++) {
            if (i) __offlineTest.advance(8000);
            const mob = {...DB.mobs.orc, uid: uid(), curHp: 0, st: newMobStatus()};
            mapState.mobs[0] = mob;
            const random = Math.random;
            Math.random = () => .5; // Keep native gold drops deterministic in the synthetic sample.
            try {killMob(0);} finally {Math.random = random;}
        }
        saveGame(); _resetGameLoopClock();
        return {gold: player.gold, exp: player.exp, lv: player.lv, profile: player.offlineHunt?.profile, roleId: accountRoleId(player)};
    }, slot);
}
await page.cdp('Network.setCacheDisabled', {cacheDisabled:true});
await page.cdp('Emulation.setDeviceMetricsOverride', {width:1330, height:900, deviceScaleFactor:1, mobile:false});
await open();
await check('offline module is enabled in the actual document', () => page.evaluate(() => typeof offlinePrepareCharacterSelect === 'function' && !!document.querySelector('script[src*="27-offline-rewards.js"]')));
if (options.baseline) {
    await page.evaluate(() => __offlineTest.cleanup());
    await page.cdp('Page.removeScriptToEvaluateOnNewDocument', {identifier:init});
    console.log({checks:reports.length, reports});
    return;
}
// Close a real auxiliary tab; p1 stays blank so it cannot overwrite the synthetic bucket.
await page.goto('about:blank');
const closingPage = await task.newPage();
await closingPage.cdp('Page.addScriptToEvaluateOnNewDocument', {source:fixtureSource});
await open(closingPage);
let base = await sample(1, closingPage);
await check('native kills build and save a qualifying same-map rate sample', () => closingPage.evaluate(() => {
    const doc = accountRoleDoc(1), hunt = doc.p.offlineHunt;
    return hunt?.eligible && hunt.map === 'training' && hunt.profile.sampleKills === 3 && hunt.profile.sampleMs >= 15000 && hunt.profile.expPerMin > 0 && hunt.profile.goldPerMin > 0 || {hunt, map:mapState.current, actor:player.name, hidden:document.hidden};
}));
await closingPage.evaluate(() => {
    player.gold += 17; // Unsaved progress must be flushed by the actual close event.
    player.config.actualCloseSentinel = 'native-close';
    __offlineTest.reopenAfter(120000);
});
base.gold += 17;
await closingPage.close();
await open();
await page.evaluate(() => {currentSlot=1; loadGame(); stopGameTimers();});
await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
await check('reopening after actual tab closure grants exactly 70% of two minutes and displays the summary', () => page.evaluate(base => {
    const expectedGold = Math.floor(base.profile.goldPerMin * 2 * .7 + 1e-7), expectedExp = Math.floor(base.profile.expPerMin * 2 * .7 + 1e-7);
    return player.gold === base.gold + expectedGold && player.exp === base.exp + expectedExp && (!document.getElementById('offline-reward-modal')&&document.getElementById('sys-log').textContent.includes('離線掛機完成')) || {gold:player.gold, expectedGold:base.gold + expectedGold, exp:player.exp, expectedExp:base.exp + expectedExp, summary:(!document.getElementById('offline-reward-modal')&&document.getElementById('sys-log').textContent.includes('離線掛機完成'))};
}, base));
await check('settled gains, role identity and unknown preferences survive native save', () => page.evaluate(base => {
    const d = accountRoleDoc(1);
    return d.p.gold === player.gold && d.p.exp === player.exp && accountRoleId(player) === base.roleId && d.p.config.offlineSentinel === 'preserve-unknown' && d.p.config.actualCloseSentinel === 'native-close';
}, base));
await check('native close and reopen records the actual offline award in local history',()=>page.evaluate(base=>{
    const rows=JSON.parse(_lsGet(ADDON_HISTORY_KEY)||'{}')[base.roleId];
    return Array.isArray(rows)&&rows.length===1&&rows[0].gold===player.gold-base.gold&&rows[0].exp===player.exp-base.exp&&rows[0].map===base.profile.mapName;
},base));
const settled = await page.evaluate(() => ({gold:player.gold, exp:player.exp}));
await reopen(0);
await check('immediate reload cannot claim the same offline interval twice', () => page.evaluate(s => player.gold === s.gold && player.exp === s.exp && !document.getElementById('offline-reward-modal'), settled));
await check('immediate reload cannot add a duplicate history entry',()=>page.evaluate(base=>JSON.parse(_lsGet(ADDON_HISTORY_KEY)||'{}')[base.roleId].length===1,base));
base = await sample(2);
await reopen(14 * 3600000, 2);
await check('long absences cap rewards at 12 hours and explain the cap', () => page.evaluate(base => {
    const amount = Math.floor(base.profile.goldPerMin * 720 * .7 + 1e-7), modal = document.getElementById('sys-log');
    return player.gold === base.gold + amount && modal?.textContent.includes('12 小時上限') || {gold:player.gold, expected:base.gold+amount, modal:modal?.textContent};
}, base));
base = await sample(3);
await reopen(59000, 3);
await check('absences shorter than one minute produce no offline award and explain why', () => page.evaluate(base => player.gold === base.gold && !document.getElementById('offline-reward-modal') && document.getElementById('sys-log').textContent.includes('離線時間不足 1 分鐘'), base));
await check('loading a different role keeps its own identity and sample', () => page.evaluate(base => accountRoleId(player) === base.roleId && player.offlineHunt?.profiles?.some(p => p.map === 'training') && player.name === '合成離線角色3', base));
await page.evaluate(() => {setMapSelectors(getHomeTown()); changeMap(true); saveGame();});
const townGold = await page.evaluate(() => player.gold);
await reopen(120000, 3);
await check('closing in town does not award an old hunting profile and explains why', () => page.evaluate(gold => player.gold === gold && !document.getElementById('offline-reward-modal') && document.getElementById('sys-log').textContent.includes('不在可離線掛機的狩獵地圖'), townGold));
base = await sample(4);
await page.evaluate(() => {returnToCharacterSelect();});
const menu = await page.evaluate(() => ({raw:_lsGet('lineage_idle_save_4')}));
await page.evaluate(() => {_flushSaveNow();});
await check('returning to character selection freezes a valid snapshot despite later flushes', () => page.evaluate(menu => _lsGet('lineage_idle_save_4') === menu.raw && accountRoleDoc(4).p.offlineHunt?.eligible === true, menu));
await reopen(120000, 4);
await check('a role left at character selection still receives offline rewards', () => page.evaluate(base => player.gold === base.gold + Math.floor(base.profile.goldPerMin * 2 * .7 + 1e-7) && (!document.getElementById('offline-reward-modal')&&document.getElementById('sys-log').textContent.includes('離線掛機完成')), base));
base = await sample(5);
await reopen(120000, 5);
await page.evaluate(() => {document.getElementById('offline-reward-modal')?.remove();});
await check('role-local checkpoints survive application startup', () => page.evaluate(() => Object.keys(__offlineTest.data).some(k => k.startsWith('lineage_idle_offline_v1_checkpoint_'))));
await page.evaluate(() => {
    document.getElementById('offline-reward-modal')?.remove();
    setMapSelectors('training'); changeMap(true); state.running = true;
    _tickDebt = 1000;
    player.config.closeFlushSentinel = 'latest-progress';
    _flushSaveNow();
});
await check('final flush saves current progress even with outstanding background debt', () => page.evaluate(() => accountRoleDoc(5).p.config.closeFlushSentinel === 'latest-progress'));
await page.evaluate(() => {_resetGameLoopClock();});
// Capture a valid offline save and test a rejected claim in a fresh load callback.
await sample(6);
await page.evaluate(() => {returnToCharacterSelect(); __offlineTest.advance(120000); __offlineTest.fail = 'claim_'; currentSlot=6; loadGame(); stopGameTimers();});
await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
const failedClaimGold = await page.evaluate(() => accountRoleDoc(6).p.gold);
await check('failed claim-marker writes grant no unprotected rewards', () => page.evaluate(gold => player.gold === gold && !document.getElementById('offline-reward-modal'), failedClaimGold));
await page.evaluate(() => {__offlineTest.fail=''; loadGame(); stopGameTimers();});
await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
await check('retry after claim storage recovers grants the pending interval once', () => page.evaluate(gold => player.gold > gold && (!document.getElementById('offline-reward-modal')&&document.getElementById('sys-log').textContent.includes('離線掛機完成')), failedClaimGold));
await sample(7);
await page.evaluate(() => {returnToCharacterSelect(); __offlineTest.advance(120000); __offlineTest.fail='lineage_idle_save_7'; currentSlot=7; loadGame(); stopGameTimers();});
await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
await check('save failures keep granted rewards in memory and show a recovery message', () => page.evaluate(() => player.gold > accountRoleDoc(7).p.gold && document.getElementById('sys-log').textContent.includes('存檔失敗')));
await page.evaluate(() => {__offlineTest.fail=''; saveGame();});
const recovered = await page.evaluate(() => ({gold:player.gold, exp:player.exp}));
await reopen(0, 7);
await check('successful manual save persists recovered gains without duplication', () => page.evaluate(s => player.gold === s.gold && player.exp === s.exp && !document.getElementById('offline-reward-modal'), recovered));
await page.evaluate(() => {
    document.getElementById('offline-reward-modal')?.remove(); returnToCharacterSelect();
    currentSlot=8; selectClass('m_mage'); document.getElementById('creation-name').value='合成測試角色';startGame(); stopGameTimers();
    setMapSelectors('training'); changeMap(true); saveGame();
});
const noSampleGold = await page.evaluate(() => player.gold);
await reopen(120000, 8);
await check('a new hunter without a combat sample receives no invented rewards and is told why', () => page.evaluate(gold => player.gold === gold && !document.getElementById('offline-reward-modal') && document.getElementById('sys-log').textContent.includes('本次沒有離線收益'), noSampleGold));
await check('no uncaught browser runtime errors', () => page.evaluate(() => __offlineTest.errors.length === 0 || __offlineTest.errors));
await page.goto('about:blank');
await open();
await page.evaluate(() => __offlineTest.cleanup());
await page.cdp('Page.removeScriptToEvaluateOnNewDocument', {identifier:init});
console.log({checks:reports.length, passed:reports.filter(r=>r.status==='PASS').length, failed:reports.filter(r=>r.status==='FAIL')});
if (!options.keepSpace) await task.finish({keep:[]});
if (reports.some(r=>r.status==='FAIL')) throw Error('Offline reward checks failed');
})();
