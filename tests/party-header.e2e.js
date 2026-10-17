// Failure cases: duplicate frame layers, old title cartouche, plain tabs, clipping and broken native switching.
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'Party header reference correction'),page=task.page('p1'),reports=[],sources={};console.log({spaceId:task.spaceId});
for(const file of ['index.html','css/responsive.css','assets/ui/warehouse-frame-v1.webp','assets/ui/warehouse-row-v1.webp'])sources[file]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
async function check(name,fn){const value=await fn();reports.push({name,status:value===true?'PASS':'FAIL',detail:value===true?undefined:value});await fs.writeFile(options.artifacts+'/party-header-'+(options.baseline?'baseline-':'')+options.protocol+'.json',JSON.stringify({method:'Ego native tab clicks and keyboard; synthetic isolated storage; layout and artwork assertions; screen-media PDF previews',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const data={};const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:s,configurable:true});window.BroadcastChannel=undefined;window.__headerErrors=[];addEventListener('error',e=>__headerErrors.push(e.message));})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(options.url+'?party-header');await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_mage');document.getElementById('creation-name').value='合成標題驗收';startGame();stopGameTimers();state.running=false;player.lv=60;calcStats();saveGame();const doc=JSON.parse(saveStateJson());doc.p.name='合成隊友';doc.p.enSeed='header-ally';doc.p._roleEpoch='header-epoch';doc.p.allies=[];_lzSet('lineage_idle_save_2',_saveWrap(JSON.stringify(doc)));player.allies=[buildAlly('2')];renderSquadPanel();});
await check('panel uses one silver frame with an unframed title and no repeated full-frame background',()=>page.evaluate(()=>{const p=document.getElementById('squad-panel'),h=p.querySelector('.panel-header'),s=getComputedStyle(p),before=getComputedStyle(h,'::before');return s.borderImageSource.includes('warehouse-frame-v1.webp')&&s.borderImageSlice.includes('fill')&&!s.backgroundImage.includes('warehouse-frame-v1.webp')&&!before.backgroundImage.includes('party-title-cartouche-v1.png');}));
await check('both native tabs use the textured bevel artwork',()=>page.evaluate(()=>['team','skill'].every(id=>getComputedStyle(document.getElementById('squad-tab-btn-'+id),'::before').backgroundImage.includes('warehouse-row-v1.webp'))));
for(const width of [1330,1920])for(const scale of [60,75,80,100])for(const left of [220,300,460]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 await page.evaluate(({scale,left})=>{setUiScale(scale);const col=document.getElementById('col-left');col.style.setProperty('width',left+'px','important');col.style.setProperty('min-width',left+'px','important');col.style.setProperty('max-width',left+'px','important');}, {scale,left});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await check(width+'px '+scale+'% left '+left+': header and complete labels fit one line inside the outer frame',()=>page.evaluate(()=>{
  const panel=document.getElementById('squad-panel'),pr=panel.getBoundingClientRect(),header=panel.querySelector('.panel-header'),hr=header.getBoundingClientRect(),title=header.querySelector('span');
  for(const e of [title,document.getElementById('squad-tab-btn-team'),document.getElementById('squad-tab-btn-skill')]){
   const r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect();if(r.left<pr.left||r.right>pr.right+1||text.left<r.left-1||text.right>r.right+1||text.height>parseFloat(getComputedStyle(e).lineHeight)+2)return {text:e.textContent,rect:r.toJSON(),textRect:text.toJSON()};
  }
  return hr.bottom<=document.getElementById('squad-body').getBoundingClientRect().top+1&&panel.scrollWidth<=panel.clientWidth+1;
 }));
}
await page.evaluate(()=>setUiScale(80));
await page.click('#squad-tab-btn-skill');
await check('native skill click changes the selected texture and opens the existing skill controls',()=>page.evaluate(()=>document.getElementById('squad-tab-btn-skill').getAttribute('aria-selected')==='true'&&!document.getElementById('squad-tab-skill').classList.contains('hidden')&&document.getElementById('squad-tab-team').classList.contains('hidden')));
await page.focus('#squad-tab-btn-team');await page.keyboard.press('Enter');
await check('keyboard returns to the original roster and retains focus',()=>page.evaluate(()=>document.activeElement.id==='squad-tab-btn-team'&&document.getElementById('squad-tab-btn-team').getAttribute('aria-selected')==='true'&&!document.getElementById('squad-tab-team').classList.contains('hidden')));
await check('no runtime errors',()=>page.evaluate(()=>__headerErrors.length===0||__headerErrors));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});console.log({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Party header regression');if(!options.keepSpace)await task.finish({keep:[]});
