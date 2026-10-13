// Resume the same isolated account used by game-tools E2E.
(async()=>{
const fs=await import('node:fs/promises'),task=await taskSpace(options.space),page=task.page(options.page||'p1'),reports=[];
if(!await page.evaluate(()=>!!window.__toolsData))throw Error('Run game-tools --keep-space before visual-game-tools');
async function check(name,fn){const value=await fn();reports.push({name,status:value===true?'PASS':'FAIL',result:value});}
async function shot(name){if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/'+name+'-'+options.protocol+'.png'});}
await page.evaluate(()=>{AFK_DEX_API.close();AFK_WIKI_API.close();document.querySelector('#dograce-head [data-act="close"]')?.click();player.inv=[{id:'relic_monkey_staff',uid:'visual-monkey',cnt:1,en:0},{id:'wpn_shortbow',uid:'visual-bow',cnt:1,en:0}];switchTab('weapons',document.querySelector('[onclick="switchTab(\'weapons\', this)"]'));renderTabs(true);});
await page.fill('#afk-isearch-input','猴子');await check('original search input filters the item list',()=>page.evaluate(()=>getComputedStyle(document.querySelector('[data-inventory-uid="visual-bow"]')).display==='none'));await shot('addon-search-visual');await page.fill('#afk-isearch-input','');
await page.evaluate(()=>{const doc=JSON.parse(saveStateJson());doc.p.enSeed='visual-party-role';doc.p._roleEpoch='visual-party-epoch';doc.p.name='隊友狀態測試';doc.p.allies=[];_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));player.allies=[buildAlly('2')];player.allies[0].buffs.sk_shield=30;_allyLevelRecompute(player.allies[0]);renderSquadPanel();});
for(const [width,height,percent] of [[1330,900,100],[1330,900,75],[390,844,100],[390,844,75],[844,390,100],[844,390,75]]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1024});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:width<1024,maxTouchPoints:1});await page.evaluate(p=>setUiScale(p),percent);
 await page.evaluate(()=>{document.getElementById('squad-panel').scrollIntoView({block:'start'});openPartyInspector('ally','2');const input=document.getElementById('party-opacity');input.value='100';input.dispatchEvent(new Event('input'));});
 await check(`${width}x${height} ${percent}% party window is in bounds`,()=>page.evaluate(()=>{const p=document.getElementById('party-inspector').getBoundingClientRect();return p.left>=0&&p.top>=0&&p.right<=innerWidth+1&&p.bottom<=innerHeight+1;}));
 await page.evaluate(()=>document.getElementById('party-bonus-window').scrollIntoView({block:'start'}));
 await check(`${width}x${height} ${percent}% one card contains total and shield benefit`,()=>page.evaluate(()=>document.querySelectorAll('#party-bonus-window .ability-window-shell').length===1&&document.querySelector('#party-ability-ac [data-ability-buff]').textContent==='（−2）'&&document.querySelector('#party-ability-ac [data-ability-total]').textContent===document.getElementById('party-ac').textContent));
 await shot(`party-combined-${width}x${height}-${percent}`);
 await page.evaluate(()=>document.getElementById('party-inspector-close').click());
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});await page.evaluate(()=>{setUiScale(100);openPartyInspector('ally','2');const input=document.getElementById('party-opacity');input.value='60';input.dispatchEvent(new Event('input'));});await shot('party-opacity-60');await page.evaluate(()=>document.getElementById('party-inspector-close').click());
await check('visual review has no runtime errors',()=>page.evaluate(()=>__errors.length===0||__errors));
await fs.writeFile(options.artifacts+'/visual-game-tools-'+options.protocol+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});if(!options.keepSpace)await task.finish({keep:[]});if(reports.some(r=>r.status!=='PASS'))throw Error('Visual add-on review failed');
})();
