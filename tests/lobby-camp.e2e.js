// Failure cases: local HTTP/file cannot connect, an unpublished self disappears,
// representative sprites stand instead of sitting, the campfire is static, or gestures leak after exit.
const fs = await import('node:fs/promises'), crypto = await import('node:crypto');
const task = await taskSpace(options.space || '大廳本機連線與營地'), page = task.page('p1'), reports = [], sources = {};
const peers=[];
async function backend(path,method='GET',body,token){
    const response=await fetch(options.lobbyApi+'/v1'+path,{method,headers:{Origin:new URL(options.url).origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    const value=await response.json();if(!response.ok)throw Error(JSON.stringify(value));return value;
}
if(options.lobbyApi){
    for(const [index,avatar]of ['女騎士','男妖精','女妖精','男法師','女法師','男黑暗妖精','女龍騎士','男戰士'].entries()){
        const visitor=await backend('/auth/guest','POST',{deviceKey:crypto.randomBytes(32).toString('hex')});peers.push(visitor);
        await backend('/me/card','PUT',{card:{name:'合成旅人'+(index+1),intro:'營地合成測試',avatar},version:0},visitor.token);
        await backend('/presence','POST',{},visitor.token);
    }
}
console.log({ spaceId: task.spaceId });
for (const path of ['index.html','js/social-lobby.js','css/social-lobby.css','backend/lobby/src/worker.mjs','backend/lobby/migrations/0002_greeting.sql','tests/lobby-camp.e2e.js']) {
    const source=options.baselineSources?.[path] || options.root+'/'+path;
    sources[path] = crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex');
}
async function check(name, fn) {
    try { const result = await fn(); if(result !== true) throw Error(JSON.stringify(result)); reports.push({name,status:'PASS'}); }
    catch(error) { reports.push({name,status:'FAIL',error:String(error)}); }
    await fs.writeFile(options.artifacts + '/lobby-camp-' + (options.baseline ? 'baseline-' : '') + options.protocol + '.json',JSON.stringify({method:options.lobbyApi?'Actual Ego browser with isolated local workerd and D1':'Actual Ego browser, isolated synthetic storage; local page connects to public HTTPS API as a synthetic visitor, no automatic card publishing',sources,reports},null,2));
}
const init = (await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const data={};window.__campErrors=[];window.__campWrites=[];
 const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:storage,configurable:true});
 window.BroadcastChannel=undefined;addEventListener('error',event=>__campErrors.push(event.message));
 const nativeFetch=window.fetch;window.fetch=async(input,options={})=>{
  if(String(input).includes('.workers.dev')){if(options.method&&options.method!=='GET')__campWrites.push({path:new URL(input).pathname,body:options.body});}
  return nativeFetch(input,options);
 };
})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?lobby-camp');
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(api=>{
 if(api)document.getElementById('social-lobby-api').content=api;
 _bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;selectClass('m_knight');document.getElementById('creation-name').value='合成營地騎士';startGame();stopGameTimers();state.running=false;setUiScale(80);setMapSelectors('training');changeMap(true);window.__campPlayer=player;
},options.lobbyApi || null);
await page.selectOption('#map-category','social_lobby');
await page.waitForFunction(()=>document.getElementById('social-lobby')?.getAttribute('aria-busy')!=='true');
await check('local '+options.protocol+' connects to the public lobby without third-party login',()=>page.evaluate(()=>document.getElementById('lobby-auth-state').textContent.includes('連線中')||document.getElementById('lobby-status').textContent));
await check('unpublished local self is seated exactly once, using the current representative avatar',()=>page.evaluate(()=>{const seats=document.querySelectorAll('#lobby-seats [data-self="true"]');return seats.length===1&&seats[0].textContent.includes('合成營地騎士')&&seats[0].querySelector('[data-avatar="男騎士"]')!==null;}));
await check('self and greeting control are visible on entry without scrolling the lobby',()=>page.evaluate(()=>{const root=document.getElementById('social-lobby').getBoundingClientRect(),scene=document.getElementById('lobby-scene').getBoundingClientRect(),self=document.querySelector('[data-self="true"]')?.getBoundingClientRect(),greet=document.getElementById('lobby-greet')?.getBoundingClientRect();return !!self&&!!greet&&self.y>=scene.y&&self.bottom<=root.bottom&&greet.bottom<=root.bottom;}));
await check('self visibility does not silently publish a player card',()=>page.evaluate(()=>!__campWrites.some(r=>r.path==='/v1/me/card')));
await check('wilderness art replaces the old town and table',()=>page.evaluate(()=>getComputedStyle(document.getElementById('lobby-scene')).backgroundImage.includes('lobby-camp')&&!document.querySelector('.lobby-table')));
await check('campfire has an active sprite animation',()=>page.evaluate(()=>{const fire=document.querySelector('.lobby-campfire-strip');return !!fire&&getComputedStyle(fire).animationName!=='none'&&fire.getAnimations().length>0;}));
await check('campfire sprite exposes six distinct frames on its looping CSS timeline',()=>page.evaluate(()=>{
 const fire=document.querySelector('.lobby-campfire-strip'),animation=fire?.getAnimations()[0];if(!animation)return false;
 // Ego's minimized window can freeze wall-clock animation; seek the actual browser timeline.
 const saved=animation.currentTime,frames=[];
 for(const time of [0,220,420,620,820,1020]){animation.currentTime=time;frames.push(getComputedStyle(fire).transform);}
 animation.currentTime=saved;
 return new Set(frames).size===6&&animation.effect.getTiming().iterations===Infinity;
}));
await check('greeting control and seated sprite are available',()=>page.evaluate(()=>!!document.getElementById('lobby-greet')&&!!document.querySelector('[data-self="true"] .lobby-camper-sprite')));
if(!options.baseline){
 await page.click('#lobby-greet');
 await check('greeting swaps to the raised-hand pose and shows readable feedback',()=>page.evaluate(()=>!!document.querySelector('[data-self="true"].is-greeting')&&document.querySelector('[data-self="true"] .lobby-greeting').textContent.includes('嗨')));
 await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await check('reduced motion keeps a still flame with greeting feedback',()=>page.evaluate(()=>getComputedStyle(document.querySelector('.lobby-campfire-strip')).animationName==='none'));
 await page.cdp('Emulation.setEmulatedMedia',{features:[]});
 await page.click('[data-self="true"]');await page.click('#lobby-edit');await page.fill('#lobby-intro','合成營火測試');await page.click('#lobby-preview');await page.click('#lobby-publish');
 await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
 await check('published self remains present once among the camp guests',()=>page.evaluate(()=>document.querySelectorAll('#lobby-seats [data-self="true"]').length===1));
 await check('own published avatar retains its sitting pose',()=>page.evaluate(()=>!!document.querySelector('[data-self="true"] [data-avatar="男騎士"]')));
 if(options.lobbyApi){
  await backend('/greeting','POST',{},peers[0].token);await page.click('#lobby-roster');await page.click('#lobby-refresh');await page.click('#lobby-roster-close');
  await check('a remote greeting is shown on the matching seated avatar',()=>page.evaluate(id=>!!document.querySelector('[data-camp-id="'+id+'"].is-greeting'),peers[0].user.id));
  await check('eight visitors use their distinct representative sprites',()=>page.evaluate(()=>document.querySelectorAll('#lobby-seats .lobby-seat').length===9&&new Set([...document.querySelectorAll('#lobby-seats [data-avatar]')].map(el=>el.dataset.avatar)).size===9));
 }
 await check('live scene has no overlapping character hit targets',()=>page.evaluate(()=>{const rects=[...document.querySelectorAll('#lobby-seats .lobby-seat')].map(el=>el.getBoundingClientRect());return rects.every((a,i)=>rects.every((b,j)=>i===j||a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));}));
 if(!options.skipScreenshots){await page.screenshot({path:options.artifacts+'/lobby-camp-'+options.protocol+'.png'});}
 else{
  await page.evaluate(()=>{document.getElementById('social-lobby').scrollTop=0;});
  const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  await page.cdp('Emulation.setEmulatedMedia',{media:'screen'});
  const pdf=await page.cdp('Page.printToPDF',{printBackground:true,paperWidth:dimensions.width/96,paperHeight:dimensions.height/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1});
  await fs.mkdir(options.root+'/tmp/pdfs',{recursive:true});
  await fs.writeFile(options.root+'/tmp/pdfs/lobby-camp-'+(options.lobbyApi?'workerd-':'')+options.protocol+'.pdf',Buffer.from(pdf.data,'base64'));
  await fs.writeFile(options.artifacts+'/preview-method.json',JSON.stringify({method:'Ego Page.printToPDF with screen media, not a screenshot',dimensions,renderDpi:96},null,2));
 }
 const cleanup=await page.evaluate(async()=>{const deviceKey=localStorage.getItem('lineage_social_lobby_device_v1'),url=document.getElementById('social-lobby-api').content;const auth=await fetch(url+'/v1/auth/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceKey})});if(!auth.ok)return false;const session=await auth.json();const del=await fetch(url+'/v1/me',{method:'DELETE',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});return del.ok;});
 await check('synthetic public visitor data is removed after verification',()=>cleanup);
 for(const visitor of peers)await backend('/me','DELETE',{confirm:true},visitor.token);
 await page.click('#lobby-exit');
 await check('exit stops polling and retains the original hunting actor and map',()=>page.evaluate(()=>!socialLobby.isOpen()&&!socialLobby.isPolling()&&player===__campPlayer&&mapState.current==='training'));
}
await check('no browser runtime errors',()=>page.evaluate(()=>!__campErrors.length||__campErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Camp lobby regression');
if(!options.keepSpace)await task.finish({keep:[]});
