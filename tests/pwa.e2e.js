(async()=>{
const fs=await import('node:fs/promises'),task=await taskSpace(options.space||'天堂功能整合驗證');console.log({spaceId:task.spaceId});const page=task.page(options.page||'p1'),reports=[];
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={};window.__pwaTestData=data;const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};Object.defineProperty(window,'localStorage',{value:s,configurable:true});Object.defineProperty(window,'sessionStorage',{value:s,configurable:true});})();`})).identifier;
await page.cdp('Network.enable');await page.goto(options.url+'?pwa-test');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({failed:name,error:String(e)});}await fs.writeFile(options.artifacts+'/pwa-'+options.protocol+'.json',JSON.stringify({date:new Date().toISOString(),reports},null,2));}
await check('original PWA modules and manifest are loaded',()=>page.evaluate(()=>!!document.querySelector('script[src^="afk-pwa.js"]')&&!!document.querySelector('script[src^="afk-sw.js"]')&&(location.protocol==='file:'?!document.querySelector('link[rel="manifest"]'):!!document.querySelector('link[rel="manifest"]'))));
if(options.protocol==='file'){
 await check('file protocol plays without a service worker',()=>page.evaluate(()=>location.protocol==='file:'&&(!navigator.serviceWorker||!navigator.serviceWorker.controller)&&typeof startGame==='function'));
}else{
 await check('localhost registers the original service worker',async()=>{await page.waitForFunction(()=>!!navigator.serviceWorker.controller,undefined,{timeout:20000});return page.evaluate(()=>navigator.serviceWorker.controller.scriptURL.endsWith('/sw.js'));});
 await page.reload();await page.waitForFunction(()=>document.readyState==='complete'&&!!navigator.serviceWorker.controller&&typeof startGame==='function');
 await check('original code cache contains the page and mirrored scripts',()=>page.evaluate(async()=>{const cache=await caches.open('code-v1');const urls=(await cache.keys()).map(r=>r.url);return urls.some(u=>u.endsWith('/index.html'))&&urls.some(u=>u.includes('/afk-training.js?'))&&urls.some(u=>u.includes('/js/addon-integration.js?'));}));
 await check('original image cache stores requested artwork',async()=>{await page.evaluate(async()=>{await (await fetch('assets/ui/能力.png')).arrayBuffer();});await page.waitForFunction(async()=>!!await(await caches.open('img-v3')).match(new URL('assets/ui/能力.png',location.href)),undefined,{timeout:5000});return true;});
 try{
  await page.cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await page.reload();await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
  await check('offline launch loads the original add-ons and local game',()=>page.evaluate(()=>!!window.AFK_TRAD&&!!window.AFK_DEX_API&&!!window.__race&&typeof startGame==='function'));
  await check('requested artwork remains available offline',()=>page.evaluate(async()=>{const r=await fetch('assets/ui/能力.png');return r.ok&&(await r.blob()).size>0;}));
 }finally{await page.cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}
}
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});if(!options.keepSpace)await task.finish({keep:[]});if(reports.some(r=>r.status==='FAIL'))throw Error('PWA checks failed');
})();
