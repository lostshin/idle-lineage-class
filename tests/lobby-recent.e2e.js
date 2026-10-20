// Failure cases: local joins production, expired peers vanish at two minutes,
// count flaps, silent polling, clock skew, unstable seats and unpublished comments.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'近期旅人與離線留言'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const n of ['js/social-lobby.js','js/online-presence.js','css/social-lobby.css','tests/lobby-recent.e2e.js'])sources[n]=crypto.createHash('sha256').update(await fs.readFile(options.baselineSources?.[n]||options.root+'/'+n)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/lobby-recent-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser with isolated synthetic storage and explicit loopback-only social API fixture; production local exclusion checked before setting loopback API; elapsed monotonic time/timers controlled, client wall clock +5 minutes. Real Worker and official origin checked separately.',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const data={},s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;
 window.__recent={requests:[],timers:[],errors:[],elapsed:0,count:18,offline:false,comments:[],stamp:Date.now(),order:false};const perf=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>perf()+__recent.elapsed});const wall=Date.now;Date.now=()=>wall()+300000;
 addEventListener('error',e=>__recent.errors.push(e.message));const timeout=setTimeout;window.setTimeout=(fn,ms,...args)=>{const t={ms,run:()=>fn(...args)};__recent.timers.push(t);return timeout(fn,ms,...args);};
 const native=fetch;window.fetch=async(input,opts={})=>{if(!String(input).includes('/v1/'))return native(input,opts);const u=new URL(input),path=u.pathname,method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):{};__recent.requests.push({path,search:u.search,method,body,host:u.host});if(__recent.offline)throw TypeError('synthetic outage');const serverTime=__recent.stamp;let value={};const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const guests=[{id:id(2),actor:{name:'離線女法師',cls:'mage',avatar:'女法師'},lastSeen:serverTime-3600000,hasCard:false},{id:id(3),actor:{name:'即將離線騎士',cls:'knight',avatar:'男騎士'},lastSeen:serverTime-598000,hasCard:false},{id:id(4),actor:{name:'即將離場王族',cls:'royal',avatar:'公主'},lastSeen:serverTime-86396000,hasCard:false},{id:id(5),actor:{name:'過期旅人',cls:'elf',avatar:'男妖精'},lastSeen:serverTime-86400001,hasCard:false}];
 if(path==='/v1/actions')value={actions:[],more:false};
 else if(path==='/v1/auth/guest')value={token:'synthetic',user:{id:id(1),admin:false}};
 else if(path==='/v1/me')value={user:{id:id(1),admin:false},card:null};
 else if(path==='/v1/presence')value={ok:true,siteRecentCount:__recent.count,siteOnlineCount:2,onlineCount:12,serverTime};
 else if(path==='/v1/players')value={players:__recent.order?guests.toReversed():guests,next:20,siteRecentCount:__recent.count,siteOnlineCount:2,onlineCount:12,serverTime};
 else if(path.endsWith('/comments')){if(method==='POST'){__recent.comments.push({id:__recent.comments.length+1,author:'合成旅人',text:body.text,createdAt:serverTime,canDelete:true});value={id:__recent.comments.length};}else value={comments:__recent.comments.toReversed(),next:null};}
 else if(path.startsWith('/v1/cards/'))value={id:id(2),card:guests[0].actor,presence:true,lastSeen:guests[0].lastSeen,serverTime};
 return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 };
})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.goto(options.url+'?recent-visitors');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('f_royal');document.getElementById('creation-name').value='合成近期旅人';startGame();stopGameTimers();state.running=false;setUiScale(80);});
await page.evaluate(()=>new Promise(r=>setTimeout(r,100)));
await check('default local/file game does not contact production social API',()=>page.evaluate(()=>!__recent.requests.length));
await page.selectOption('#map-category','social_lobby');await check('local lobby gives official link without joining',()=>page.evaluate(()=>!__recent.requests.length&&!!document.querySelector('#social-lobby a[href="https://lostshin.github.io/idle-lineage-class/"]')));
await page.click('#lobby-exit');
await page.evaluate(()=>{__recent.requests=[];document.getElementById('social-lobby-api').content='http://127.0.0.1:9998';});
await page.selectOption('#map-category','social_lobby');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
const seat=n=>'[data-camp-id="00000000-0000-4000-8000-'+String(n).padStart(12,'0')+'"]';
await check('recent API is selected and server total is independent of seats/pagination',()=>page.evaluate(()=>__recent.requests.some(r=>r.path==='/v1/players'&&new URLSearchParams(r.search).get('view')==='recent')&&document.getElementById('world-online-count').textContent==='（近 30 分鐘活躍 18 人）'));
await check('offline visitor remains visible with correct avatar despite fast wall clock',()=>page.evaluate(s=>{const e=document.querySelector(s);return !!e&&e.dataset.online==='false'&&e.querySelector('.lobby-camper-sprite').dataset.avatar==='女法師';},seat(2)));
await check('10-minute and 24-hour thresholds are distinct',()=>page.evaluate(({a,b,c})=>document.querySelector(a)?.dataset.online==='true'&&!!document.querySelector(b)&&!document.querySelector(c),{a:seat(3),b:seat(4),c:seat(5)}));
const positions=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#lobby-seats .lobby-seat')].map(e=>[e.dataset.campId,[e.style.left,e.style.top]])));
await page.click('#lobby-roster');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');await page.evaluate(()=>{__recent.order=true;__recent.count=30;});await page.click('#lobby-refresh');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');await page.click('#lobby-roster-close');
await check('refresh preserves seats and does not flap the 10-minute count snapshot',()=>page.evaluate(pos=>[...document.querySelectorAll('#lobby-seats .lobby-seat')].every(e=>JSON.stringify(pos[e.dataset.campId])===JSON.stringify([e.style.left,e.style.top]))&&document.getElementById('world-online-count').textContent==='（近 30 分鐘活躍 18 人）',positions));
await check('heartbeat is five minutes and no repeating five-second polling',()=>page.evaluate(()=>__recent.timers.some(t=>t.ms===300000)&&!socialLobby.isPolling()));
await page.evaluate(async()=>{const scheduled=__recent.timers.filter(t=>t.ms>0&&t.ms<5000);__recent.before=__recent.requests.length;__recent.elapsed+=5100;for(const t of scheduled)await t.run();});
await check('local boundary timers mark offline and remove 24-hour guest without network',()=>page.evaluate(({a,b})=>document.querySelector(a)?.dataset.online==='false'&&!document.querySelector(b)&&__recent.requests.length===__recent.before,{a:seat(3),b:seat(4)}));
if(await page.evaluate(s=>!!document.querySelector(s),seat(2))){
 await page.click(seat(2));await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
 await check('unpublished offline card exposes comments and last reported status',()=>page.evaluate(()=>document.getElementById('lobby-popup').open&&!document.getElementById('lobby-open-comments').hidden&&document.getElementById('lobby-detail-body').textContent.includes('離線')&&document.getElementById('lobby-favorite').hidden));
 await page.click('#lobby-open-comments');await page.waitForFunction(()=>!document.getElementById('lobby-comment-panel').hidden);await page.click('#lobby-write-comment');await page.fill('#lobby-comment','第一則 <img src=x onerror=alert(1)>');await page.click('#lobby-comment-send');await page.waitForFunction(()=>document.getElementById('lobby-social')||document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
 await check('native comment send renders safe text without HTML execution',()=>page.evaluate(()=>__recent.comments.length===1&&document.getElementById('lobby-comments').textContent.includes('第一則 <img')&&!document.querySelector('#lobby-comments img')));
 await page.keyboard.press('Escape');
}
await page.evaluate(async()=>{__recent.offline=true;const t=__recent.timers.find(t=>t.ms===300000);if(t)await t.run();});
await check('outage retains last count with update-failed state',()=>page.evaluate(()=>{const e=document.getElementById('world-online-count');return e.textContent.includes('18')&&e.dataset.state==='stale'&&e.title.includes('失敗');}));
await page.evaluate(()=>{__recent.elapsed+=600001;});
await page.click('#lobby-greet');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
await check('self also becomes offline after ten minutes without acknowledged report',()=>page.evaluate(()=>document.querySelector('[data-self="true"]').dataset.online==='false'));
await page.evaluate(()=>{__recent.offline=false;});
await page.click('[data-self="true"]');await page.click('#lobby-edit');await page.click('[data-editor-tab="manage"]');await page.click('#lobby-logout');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');await page.click('#lobby-editor-close');await page.click('[data-self="true"]');
await check('after manual disconnect own preview remains accessible without a missing session error',()=>page.evaluate(()=>document.getElementById('lobby-popup').open&&document.getElementById('lobby-detail-body').textContent.includes('合成近期旅人')&&document.getElementById('lobby-open-comments').hidden));
await check('no runtime errors',()=>page.evaluate(()=>!__recent.errors.length||__recent.errors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Recent lobby regression');if(!options.keepSpace)await task.finish({keep:[]});
