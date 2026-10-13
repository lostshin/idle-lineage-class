(async()=>{
const fs=await import('node:fs/promises'),task=await taskSpace(options.space||'天堂外掛預設驗證'),page=task.page(options.page||'p1');console.log({spaceId:task.spaceId});
const ids=['mobile','invlist','eqlist','npclist','mapbar','battlehud','nozoom','statusicon','battlebuffs','skillbar','petui','backnav','statlist','sellconfirm','touchtip','loadslots','ancdrop','relicaffix','retrial'],reports=[];let init;
async function boot(seed){if(init)await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__defaultsData=${JSON.stringify(seed)};const s={getItem:k=>__defaultsData[k]??null,setItem:(k,v)=>__defaultsData[k]=String(v),removeItem:k=>delete __defaultsData[k],key:i=>Object.keys(__defaultsData)[i]??null,get length(){return Object.keys(__defaultsData).length}};Object.defineProperty(window,'localStorage',{value:s,configurable:true});Object.defineProperty(window,'sessionStorage',{value:s,configurable:true});})();`})).identifier;await page.goto(options.url+'?addon-default-test='+Date.now());await page.waitForFunction(()=>document.readyState==='complete'&&!!window.AFK_TOGGLES);}
async function check(name,fn){try{const value=await fn();if(value!==true)throw Error(JSON.stringify(value));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({failed:name,error:String(e)});}await fs.writeFile(options.artifacts+'/addon-defaults-'+(options.baseline?'baseline':options.protocol)+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));}
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await boot({});
await check('all nineteen requested defaults are registered and disabled',()=>page.evaluate(ids=>{const list=AFK_TOGGLES.list();return ids.every(id=>list.some(x=>x.id===id&&x.def===false)&&!AFK_TOGGLES.enabled(id));},ids));
await check('changing defaults does not write saved toggle choices',()=>page.evaluate(()=>!Object.keys(__defaultsData).some(k=>k.startsWith('afk_toggle_'))));
await check('other original defaults remain enabled',()=>page.evaluate(()=>['autobuy','training','wiki','bossavoid','modalguard'].every(id=>AFK_TOGGLES.enabled(id))));
await page.evaluate(()=>AFK_TOGGLES.openPanel());
await check('the actual toggle panel displays nineteen unchecked options',()=>page.evaluate(ids=>ids.every(id=>document.querySelector('[data-tgid="'+id+'"]')?.checked===false),ids));
if(!options.skipScreenshots)await page.screenshot({path:options.artifacts+'/addon-defaults-'+options.protocol+'.png'});
await boot({'afk_toggle_invlist':'1','afk_toggle_training':'0'});
await check('explicit saved choices take precedence over defaults on reload',()=>page.evaluate(()=>AFK_TOGGLES.enabled('invlist')&&!AFK_TOGGLES.enabled('training')&&document.body.classList.contains('afk-invlist')));
await page.evaluate(()=>AFK_TOGGLES.openPanel());await page.click('#afk-tg-reset');
await check('restore defaults also unchecks the requested nineteen',()=>page.evaluate(ids=>ids.every(id=>!AFK_TOGGLES.enabled(id)&&document.querySelector('[data-tgid="'+id+'"]')?.checked===false)&&AFK_TOGGLES.enabled('training'),ids));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});if(!options.keepSpace)await task.finish({keep:[]});if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Add-on defaults failed');
})();
