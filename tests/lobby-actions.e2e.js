// Failure cases: static sprites, lost actions, early acknowledgement, popup/background
// skips, duplicated retries, whole-fire movement and overflow in the fixed scene.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto'),task=await taskSpace(options.space||'營火動作輪播'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const n of ['js/social-lobby.js','css/social-lobby.css','tests/lobby-actions.e2e.js'])sources[n]=crypto.createHash('sha256').update(await fs.readFile(options.baselineSources?.[n]||options.root+'/'+n)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}await fs.writeFile(options.artifacts+'/lobby-actions-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser; isolated synthetic storage and loopback API fixture with server read cursor, lost-response retry and controlled four-second carousel callback; compositor animations explicitly sought.',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const data={},s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;
 const actor={name:'合成動作法師',cls:'mage',avatar:'女法師'};window.__actions={requests:[],read:0,timers:[],errors:[],lost:false,events:[{id:1,userId:'peer',actor,type:'nod',createdAt:Date.now()},{id:2,userId:'peer',actor,type:'cheer',createdAt:Date.now()}],retry:{}};addEventListener('error',e=>__actions.errors.push(e.message));
 const timer=setTimeout;window.setTimeout=(fn,ms,...args)=>{if(ms===4000||ms===800){__actions.timers.push(()=>fn(...args));return timer(()=>{},3600000);}return timer(fn,ms,...args);};
 const native=fetch;window.fetch=async(input,opts={})=>{if(!String(input).includes('/v1/'))return native(input,opts);const u=new URL(input),path=u.pathname,method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):{};__actions.requests.push({path,method,body});let value={};const serverTime=Date.now();
 if(path.endsWith('/auth/guest'))value={token:'synthetic',user:{id:'self-user',admin:false}};else if(path==='/v1/me')value={card:null,user:{id:'self-user',admin:false}};
 else if(path==='/v1/presence')value={siteRecentCount:2,serverTime};else if(path==='/v1/players')value={players:[{id:'peer',actor,lastSeen:serverTime,hasCard:false}],next:null,serverTime,siteRecentCount:2};
 else if(path==='/v1/actions/read'){__actions.read=Math.max(__actions.read,body.through);value={ok:true};}
 else if(path==='/v1/actions'&&method==='GET')value={actions:__actions.events.filter(e=>e.id>__actions.read),more:false};
 else if(path==='/v1/actions'&&method==='POST'){let event=__actions.retry[body.requestId];if(!event){event={id:__actions.events.length+1,userId:'self-user',actor:{name:'合成動作公主',cls:'royal',avatar:'公主'},type:body.type,createdAt:serverTime};__actions.retry[body.requestId]=event;__actions.events.push(event);}if(__actions.lost){__actions.lost=false;throw TypeError('response lost after commit');}value={id:event.id};}
 return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 };
})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.goto(options.url+'?camp-actions');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{document.getElementById('social-lobby-api').content='http://127.0.0.1:9998';_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('f_royal');document.getElementById('creation-name').value='合成動作公主';startGame();stopGameTimers();state.running=false;setUiScale(80);});
await page.selectOption('#map-category','social_lobby');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
await check('idle sprite actually changes transform while label and hit target stay fixed',()=>page.evaluate(()=>{const s=document.querySelector('[data-self] .lobby-camper-sprite'),a=s.getAnimations()[0];if(!a)return false;const r=s.closest('button').getBoundingClientRect(),n=s.nextElementSibling.getBoundingClientRect(),saved=a.currentTime;a.currentTime=0;const first=getComputedStyle(s).transform;a.currentTime=1400;const second=getComputedStyle(s).transform;a.currentTime=saved;return first!==second&&r.x===s.closest('button').getBoundingClientRect().x&&n.y===s.nextElementSibling.getBoundingClientRect().y;}));
await check('new nod and cheer choices exist alongside original greet',()=>page.evaluate(()=>['nod','cheer'].every(v=>!!document.querySelector('#lobby-action option[value="'+v+'"]'))&&!!document.getElementById('lobby-greet')));
await check('carousel is plain text with no backdrop, border or panel shadow',()=>page.evaluate(()=>{const e=document.getElementById('lobby-activity'),s=e&&getComputedStyle(e);return !!s&&s.backgroundImage==='none'&&s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.borderTopWidth==='0px'&&s.boxShadow==='none';}));
await check('caption and destruction are centered above the fire without covering it',()=>page.evaluate(()=>{const e=document.getElementById('lobby-activity'),fire=document.querySelector('.lobby-campfire'),s=document.getElementById('social-lobby');if(!e||e.hidden)return false;const r=e.getBoundingClientRect(),f=fire.getBoundingClientRect(),b=s.getBoundingClientRect();return r.bottom<f.top&&Math.abs((r.left+r.right)/2-(f.left+f.right)/2)<1&&r.top>=b.top;}));
await check('entry fetches durable unread actions without acknowledging them',()=>page.evaluate(()=>__actions.requests.some(r=>r.path==='/v1/actions'&&r.method==='GET')&&__actions.read===0&&document.getElementById('lobby-activity')?.textContent.includes('合成動作法師')&&document.getElementById('lobby-activity')?.textContent.includes('點頭')));
if(await page.evaluate(()=>!!document.getElementById('lobby-activity'))){
 await page.evaluate(async()=>{document.getElementById('social-lobby').style.transform='translateY(2000px)';await __actions.timers.at(-1)?.();});
 await check('offscreen carousel cannot consume unread action',()=>page.evaluate(()=>__actions.read===0));
 await page.evaluate(()=>document.getElementById('social-lobby').style.transform='');
 await page.click('[data-self="true"]');await page.evaluate(async()=>{await __actions.timers.at(-1)?.();});
 await check('popup pauses animation and does not acknowledge unfinished carousel',()=>page.evaluate(()=>__actions.read===0&&getComputedStyle(document.querySelector('.lobby-camper-sprite')).animationPlayState==='paused'));
 await page.keyboard.press('Escape');await page.click('#lobby-exit');await page.evaluate(async()=>{await __actions.timers.at(-1)?.();});
 await check('leaving lobby does not consume the current unread event',()=>page.evaluate(()=>__actions.read===0));
 await page.selectOption('#map-category','social_lobby');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
 await check('reentry resumes first unread event',()=>page.evaluate(()=>document.getElementById('lobby-activity').textContent.includes('點頭')&&__actions.read===0));
 await page.evaluate(async()=>{await __actions.timers.at(-1)?.();});
 await check('text remains unread during the bottom-to-top paper burn',()=>page.evaluate(()=>__actions.read===0&&document.getElementById('lobby-activity').classList.contains('is-burning')));
 await check('text clips upward with glow confined to glyphs instead of a rectangular fire strip',()=>page.evaluate(()=>{const e=document.getElementById('lobby-activity'),a=e.getAnimations().find(a=>a.animationName==='lobby-paper-burn');if(!a)return false;const r=e.getBoundingClientRect(),old=a.currentTime;a.currentTime=0;const first=getComputedStyle(e).clipPath;a.currentTime=500;const second=getComputedStyle(e).clipPath;a.currentTime=old;return first!==second&&getComputedStyle(e).backgroundClip==='text'&&e.getAnimations().some(a=>a.animationName==='lobby-burn-edge')&&r.y===e.getBoundingClientRect().y;}));
 await page.click('[data-self="true"]');await page.evaluate(async()=>{await __actions.timers.at(-1)?.();});
 await check('interrupting the burn with a popup keeps the event unread',()=>page.evaluate(()=>__actions.read===0));
 await page.keyboard.press('Escape');await page.evaluate(async()=>{await __actions.timers.at(-1)?.();});
 await page.evaluate(async()=>{await __actions.timers.at(-1)?.();});
 await check('four visible seconds acknowledge just the first event and advance in order',()=>page.evaluate(()=>__actions.read===1&&document.getElementById('lobby-activity').textContent.includes('歡呼')));
 await page.evaluate(()=>{__actions.lost=true;});await page.selectOption('#lobby-action','nod');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');await page.selectOption('#lobby-action','nod');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
 await check('lost response retry reuses request ID and produces only one stored action',()=>page.evaluate(()=>{const r=__actions.requests.filter(r=>r.path==='/v1/actions'&&r.method==='POST');return r.length===2&&r[0].body.requestId===r[1].body.requestId&&__actions.events.length===3;}));
 await check('carousel stays inside map and never introduces a scrollbar',()=>page.evaluate(()=>{const e=document.getElementById('lobby-activity'),r=e.getBoundingClientRect(),s=document.getElementById('social-lobby'),b=s.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom&&s.scrollHeight<=s.clientHeight+1&&!socialLobby.isPolling();}));
}
await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await check('reduced motion keeps text but disables decorative character motion',()=>page.evaluate(()=>getComputedStyle(document.querySelector('.lobby-camper-sprite')).animationName==='none'));
await page.cdp('Emulation.setEmulatedMedia',{features:[]});await check('firepit base remains unanimated',()=>page.evaluate(()=>!document.querySelector('.lobby-campfire-base img').getAnimations().length));
await check('no runtime errors',()=>page.evaluate(()=>!__actions.errors.length||__actions.errors));
if(!options.baseline&&options.protocol==='http'){
 await page.cdp('Emulation.setEmulatedMedia',{media:'screen'});
 const regions=await page.evaluate(()=>({camp:document.getElementById('social-lobby').getBoundingClientRect().toJSON(),paper:document.getElementById('lobby-activity').getBoundingClientRect().toJSON()}));
 for(const ms of [40,400,750]){
  await page.evaluate(ms=>{const e=document.getElementById('lobby-activity');e.classList.add('is-burning');getComputedStyle(e).clipPath;for(const a of e.getAnimations({subtree:true})){a.pause();a.currentTime=ms;}},ms);
  const pdf=await page.cdp('Page.printToPDF',{printBackground:true,paperWidth:1330/96,paperHeight:900/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1});await fs.writeFile(options.artifacts+'/paper-'+ms+'.pdf',Buffer.from(pdf.data,'base64'));
 }
 await fs.writeFile(options.artifacts+'/preview-method.json',JSON.stringify({method:'Actual local HTTP Ego browser fixture, synthetic roles; CSS burn timeline sought at 40/400/750ms; screen-media PDF, convert with pypdfium2 at 96dpi, not screenshot.',regions},null,2));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Camp actions regression');if(!options.keepSpace)await task.finish({keep:[]});
