// Failure cases: no card prevents online presence, old card overrides the current
// class/sex, unregistered guests fail on click/greeting, random pose changes and data leaks.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'在線角色與多姿勢'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const name of ['index.html','js/social-lobby.js','css/social-lobby.css','tests/lobby-live-actors.e2e.js'])sources[name]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+name)).digest('hex');
async function check(name,fn){try{const r=await fn();if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(options.artifacts+'/lobby-live-actors-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Actual Ego browser; isolated synthetic role/storage and stateful social API; controlled heartbeat timer, native actor clicks and 16 class/sex changes. No public data or real saves.',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const data={};window.__actors={data,requests:[],timers:[],poses:[],errors:[],mine:null,actor:null};const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:storage,configurable:true});window.BroadcastChannel=undefined;addEventListener('error',e=>__actors.errors.push(e.message));
 const timer=setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===300000)__actors.timers.push(()=>fn(...args));return timer.call(this,fn,ms,...args);};
 const nativeFetch=fetch;window.fetch=async(input,options={})=>{if(!String(input).startsWith('http://127.0.0.1:9998'))return nativeFetch(input,options);const u=new URL(input),path=u.pathname,body=options.body?JSON.parse(options.body):{};__actors.requests.push({path,method:options.method||'GET',body});
 const stamp=Date.now(),player={id:'00000000-0000-4000-8000-000000000002',actor:__actors.actor||{name:'未發名片女法師',cls:'mage',avatar:'女法師'},lastSeen:stamp,greetingAt:0,hasCard:false};let value={};
 if(path==='/v1/actions')value={actions:[],more:false};
 else if(path==='/v1/auth/guest')value={token:'synthetic',user:{id:'00000000-0000-4000-8000-000000000001',admin:false}};
 else if(path==='/v1/me')value={user:{id:'00000000-0000-4000-8000-000000000001',admin:false},card:__actors.mine};
 else if(path==='/v1/players')value={players:[player,{...player,id:'00000000-0000-4000-8000-000000000003',lastSeen:stamp-86400001}],next:null,serverTime:stamp,onlineCount:2,siteOnlineCount:0,siteRecentCount:0};
 else if(path==='/v1/cards')value={cards:[],next:null,serverTime:stamp,onlineCount:2,siteOnlineCount:0,siteRecentCount:0};
 else if(path.includes('/cards/'))return new Response(JSON.stringify({error:'此玩家尚未發布名片'}),{status:404,headers:{'Content-Type':'application/json'}});
 return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 };
})();`})).identifier;
await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});await page.goto(options.url+'?live-actors');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{document.getElementById('social-lobby-api').content='http://127.0.0.1:9998';_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('f_royal');document.getElementById('creation-name').value='合成在線公主';startGame();stopGameTimers();state.running=false;setUiScale(80);});
async function pulse(){await page.evaluate(async()=>{const timer=__actors.timers.at(-1);if(timer)await timer();});}
await pulse();
await check('new player announces current role outside lobby without publishing any card',()=>page.evaluate(()=>!socialLobby.isOpen()&&__actors.requests.some(r=>r.path==='/v1/presence'&&r.body.actor?.name===player.name&&r.body.actor.cls===player.cls&&r.body.actor.avatar===player.avatar)&&!__actors.requests.some(r=>r.path==='/v1/me/card')));
await check('automatic online payload contains only name/class/avatar/pose and opt-in map',()=>page.evaluate(()=>{const body=__actors.requests.find(r=>r.path==='/v1/presence')?.body;return !!body&&Object.keys(body).every(k=>['map','actor','page'].includes(k))&&Object.keys(body.actor).sort().join(',')==='avatar,cls,name,pose'&&!body.map;}));
await page.click('#btn-social-lobby');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
const remote='[data-camp-id="00000000-0000-4000-8000-000000000002"]';
await check('camp displays unregistered female mage and excludes expired guests',()=>page.evaluate(()=>{const seat=document.querySelector('[data-camp-id="00000000-0000-4000-8000-000000000002"]');return seat?.textContent.includes('未發名片女法師')&&seat.querySelector('.lobby-camper-sprite').dataset.avatar==='女法師'&&!document.querySelector('[data-camp-id="00000000-0000-4000-8000-000000000003"]');}));
if(await page.evaluate(()=>!!document.querySelector('[data-camp-id="00000000-0000-4000-8000-000000000002"]'))){
 await page.click(remote);await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
 await check('clicking a player without a card shows current role without a failed card request or unavailable social controls',()=>page.evaluate(()=>document.getElementById('lobby-popup').open&&document.getElementById('lobby-detail-body').textContent.includes('未發名片女法師')&&!document.getElementById('lobby-open-comments').hidden&&document.getElementById('lobby-favorite').hidden&&!__actors.requests.some(r=>r.path.includes('/cards/'))));
 await page.keyboard.press('Escape');
}
await page.click('#lobby-greet');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
await check('greeting works without a published card',()=>page.evaluate(()=>__actors.requests.some(r=>r.path==='/v1/actions'&&r.body?.type==='greet')&&document.querySelector('[data-self="true"]').classList.contains('is-greeting')));
const pairs={royal:['王子','公主'],knight:['男騎士','女騎士'],elf:['男妖精','女妖精'],mage:['男法師','女法師'],dark:['男黑暗妖精','女黑暗妖精'],dragon:['男龍騎士','女龍騎士'],illusion:['男幻術士','女幻術士'],warrior:['男戰士','女戰士']};
await page.evaluate(()=>{__actors.mine={card:{name:'舊名片男騎士',cls:'knight',avatar:'男騎士'},published:true,version:1};});await page.click('#lobby-exit');await page.click('#btn-social-lobby');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');
for(const[cls,avatars]of Object.entries(pairs))for(const avatar of avatars){
 await page.evaluate(({cls,avatar})=>{player.cls=cls;player.avatar=avatar;__actors.actor={name:'當前'+avatar,cls,avatar,pose:['standing','seated','kneeling'][__actors.poses.length%3]};}, {cls,avatar});
 await pulse();await page.click('#lobby-roster');await page.waitForFunction(()=>document.getElementById('social-lobby').getAttribute('aria-busy')!=='true');await page.click('#lobby-roster-close');
 await check(cls+' '+avatar+': current online identity wins over the old card and selects the correct original identity and pose',()=>page.evaluate(({cls,avatar})=>{const seats=[...document.querySelectorAll('#lobby-seats .lobby-seat')],remote=seats.find(s=>s.dataset.campId!=='self'),self=seats.find(s=>s.dataset.self==='true');for(const node of seats){const pose=node.querySelector('.lobby-camper-sprite').dataset.pose;if(pose)__actors.poses.push(pose);}return !!remote&&remote.textContent.includes('當前'+avatar)&&[remote,self].every(s=>s.querySelector('.lobby-camper-sprite').dataset.avatar===avatar)&&__actors.requests.filter(r=>r.path==='/v1/presence').at(-1)?.body.actor?.cls===cls;}, {cls,avatar}));
}
await check('all 16 original idle sprites and 32 generated resting poses decode',async()=>page.evaluate(async()=>{
 const avatars=['王子','公主','男騎士','女騎士','男妖精','女妖精','男法師','女法師','男黑暗妖精','女黑暗妖精','男龍騎士','女龍騎士','男幻術士','女幻術士','男戰士','女戰士'];
 for(const avatar of avatars)for(const pose of ['standing','seated','kneeling']){const image=new Image();image.src=pose==='standing'?'assets/classanim/'+avatar+'/unarmed_idle_0.png':'assets/ui/lobby-poses-v2/'+avatar+'-'+pose+'.webp';try{await image.decode();}catch{return false;}if(!image.naturalWidth)return false;}
 return true;
}));
await check('selected poses vary between players instead of being randomly reassigned',()=>page.evaluate(()=>{const poses=new Set(__actors.poses),self=document.querySelector('[data-self="true"] .lobby-camper-sprite');if(self?.dataset.pose)poses.add(self.dataset.pose);for(const n of document.querySelectorAll('#lobby-seats .lobby-camper-sprite'))if(n.dataset.pose)poses.add(n.dataset.pose);return [...poses].every(p=>['seated','standing','kneeling'].includes(p))&&poses.size>1;}));
await check('no runtime errors',()=>page.evaluate(()=>!__actors.errors.length||__actors.errors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});await page.goto('about:blank');console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').length});if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Live actor regression');if(!options.keepSpace)await task.finish({keep:[]});
