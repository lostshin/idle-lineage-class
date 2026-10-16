// Native warehouse interactions in synthetic storage; no player saves are accessed.
(async()=>{
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const task=await taskSpace(options.space||'裝備提示精簡與倉庫改版'),page=task.page('p1'),reports=[];
console.log({spaceId:task.spaceId});
const sources={};
for(const file of ['js/12-npc-quests.js','js/20-warehouse-window.js','assets/ui/warehouse-frame-v1.png','assets/ui/warehouse-row-v1.png','js/effect-details.js','js/14-craft-pandora.js','css/floating-ui.css','css/responsive.css','index.html','tests/warehouse-list.e2e.js','tests/effect-details.e2e.js'])sources[file]=crypto.createHash('sha256').update(await fs.readFile(options.root+'/'+file)).digest('hex');
const reportPath=options.artifacts+'/warehouse-list-'+(options.baseline?'baseline':options.protocol)+'.json';
async function check(name,fn){let result;try{result=await fn();if(result!==true)throw Error(JSON.stringify(result));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});console.log({name,error:String(e)});}await fs.writeFile(reportPath,JSON.stringify({method:'Ego desktop native clicks and keyboard; isolated synthetic storage',sources,reports},null,2));}
const init=(await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__warehouseData={};window.__errors=[];window.__failKey=null;const s={getItem:k=>__warehouseData[k]??null,setItem:(k,v)=>{if(k===__failKey)throw Error('synthetic write failure');__warehouseData[k]=String(v)},removeItem:k=>delete __warehouseData[k],key:i=>Object.keys(__warehouseData)[i]??null,get length(){return Object.keys(__warehouseData).length}};Object.defineProperty(window,'localStorage',{value:s,configurable:true});Object.defineProperty(window,'sessionStorage',{value:s,configurable:true});addEventListener('error',e=>__errors.push(e.message));})();`})).identifier;
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1330,height:900,deviceScaleFactor:1,mobile:false});
await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
await page.goto(options.url+'?warehouse-list');
await page.waitForFunction(()=>document.readyState==='complete'&&typeof startGame==='function');
await page.evaluate(()=>{_bgHeartbeatWorker?.terminate();_bgHeartbeatWorker=null;_getLzWorker=()=>null;selectClass('m_royal');document.getElementById('creation-name').value='合成測試角色';startGame();stopGameTimers();state.running=false;setUiScale(100);window.__item=(id,uid,cnt=1,en=0)=>({id,uid,cnt,en,bless:false,anc:false,attr:false,seteff:false});player.inv=[__item('potion_heal','row-heal',20),__item('potion_blue','row-mana',12)];saveGame();saveWarehouse({items:[],gold:0});openWarehouseWindow();whSetFilter('item');});
await check('warehouse shows two scrolling icon lists without pagination or shared quantity',()=>page.evaluate(()=>!document.getElementById('wh-qty-amt')&&!document.querySelector('[data-wh-page],[data-wh-next],[data-wh-prev]')&&!!document.querySelector('#wh-inv-list .wh-row img')));
await check('approved A artwork is loaded as the real window skin',()=>page.evaluate(async()=>{const source=getComputedStyle(document.getElementById('warehouse-window-frame')).borderImageSource;if(!source.includes('warehouse-frame-v1.png'))return false;const image=new Image();image.src=source.slice(5,-2);await image.decode();return image.naturalWidth>1000;}));
await check('warehouse opens at the requested default 830 by 600 UI pixels',()=>page.evaluate(()=>{const r=document.getElementById('warehouse-window-frame').getBoundingClientRect();return Math.abs(r.width-830)<1&&Math.abs(r.height-600)<1;}));
await check('approved A keeps quantity in the same item strip rather than a separate wide button',()=>page.evaluate(()=>{const row=document.querySelector('.wh-row'),r=row.getBoundingClientRect(),button=row.querySelector('[data-wh-quantity]'),q=button.getBoundingClientRect(),transfer=row.querySelector('[data-wh-transfer]');return q.width<r.width*.25&&getComputedStyle(transfer).backgroundImage==='none'&&getComputedStyle(button).backgroundImage==='none';}));
await check('approved A shows category tabs and distinct blue deposit and gold withdrawal headers',()=>page.evaluate(()=>{const tabs=document.querySelector('[role="tablist"][aria-label="物品分類"]'),headers=[...document.querySelectorAll('.wh-column h3')].map(e=>getComputedStyle(e).color);return tabs?.querySelectorAll('[role="tab"]').length>=3&&headers.length===2&&headers[0]!==headers[1];}));
await check('warehouse exposes eight edge and corner resize handles',()=>page.evaluate(()=>document.querySelectorAll('[data-warehouse-resize]').length===8));
if(!options.baseline){
const row=(side,uid)=>'#wh-'+(side==='inv'?'inv':'store')+'-list [data-wh-uid="'+uid+'"]';
const amount=(side,uid)=>row(side,uid)+' [data-wh-quantity]';
const transfer=(side,uid)=>row(side,uid)+' [data-wh-transfer]';
async function edit(side,uid,value,key='Enter'){if(!await page.evaluate(sel=>!!document.querySelector(sel),row(side,uid)+' input'))await page.click(amount(side,uid));await page.fill(row(side,uid)+' input',value);await page.press(row(side,uid)+' input',key);}
await page.click(amount('inv','row-heal'));
await check('quantity click opens an inline editor showing owned and requested counts without a trade',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='row-heal').cnt===20&&loadWarehouse().items.length===0&&document.querySelector('[data-wh-uid="row-heal"] input')&&document.querySelector('[data-wh-uid="row-heal"]').textContent.includes('持有 20')));
await page.fill(row('inv','row-heal')+' input','4');await page.press(row('inv','row-heal')+' input','Escape');
await page.click(transfer('inv','row-heal'));
await check('Escape cancels the draft and the next name click deposits the entire stack',()=>page.evaluate(()=>!player.inv.some(i=>i.uid==='row-heal')&&loadWarehouse().items.find(i=>i.uid==='row-heal')?.cnt===20));
await edit('store','row-heal','5');
await check('Enter finishes editing without withdrawing anything',()=>page.evaluate(()=>loadWarehouse().items.find(i=>i.uid==='row-heal').cnt===20&&!document.querySelector('[data-wh-uid="row-heal"] input')&&document.querySelector('[data-wh-uid="row-heal"] [data-wh-quantity]').textContent.includes('5')));
await page.click(transfer('store','row-heal'));
await check('withdrawal uses only the selected row quantity and clears it after success',()=>page.evaluate(()=>loadWarehouse().items.find(i=>i.uid==='row-heal').cnt===15&&player.inv.find(i=>i.id==='potion_heal').cnt===5&&document.querySelector('#wh-store-list [data-wh-uid="row-heal"] [data-wh-quantity]').textContent.trim()==='15'));
await edit('inv','row-mana','3');
await page.click(transfer('inv','row-mana'));
await check('a partial deposit changes only its UID and side',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='row-mana').cnt===9&&player.inv.find(i=>i.id==='potion_heal').cnt===5&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===3));
for(const value of ['0','-1','1.5','999','']){
 await edit('inv','row-mana',value);
 await page.click(transfer('inv','row-mana'));
 await check('invalid quantity '+JSON.stringify(value)+' stays inline and blocks transfer',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='row-mana').cnt===9&&!!document.querySelector('[data-wh-uid="row-mana"] [role="alert"]')?.textContent));
}
await edit('inv','row-mana','2');
await page.click(amount('inv','row-mana'));await page.fill(row('inv','row-mana')+' input','7');await page.press(row('inv','row-mana')+' input','Escape');
await page.evaluate(()=>{__failKey=whKey();});await page.click(transfer('inv','row-mana'));
await check('failed warehouse write restores both stores and retains the previous confirmed quantity',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='row-mana').cnt===9&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===3&&document.querySelector('[data-wh-uid="row-mana"] [data-wh-quantity]').textContent.includes('2')));
await page.evaluate(()=>{__failKey='lineage_idle_save_'+currentSlot;});await page.click(transfer('inv','row-mana'));
await check('failed character write restores the inventory and keeps the requested quantity for retry',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='row-mana').cnt===9&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===3&&document.querySelector('[data-wh-uid="row-mana"] [data-wh-quantity]').textContent.includes('2')));
await page.evaluate(()=>{__failKey=null;});await page.click(transfer('inv','row-mana'));
await check('retry transfers the retained quantity once',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='row-mana').cnt===7&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===5));
await page.evaluate(()=>{const w=loadWarehouse();w.items=Array.from({length:WH_MAX},(_,i)=>__item('wpn_katana','full-'+i,1,1));saveWarehouse(w);});
await edit('inv','row-mana','1');await page.click(transfer('inv','row-mana'));
await check('full warehouse blocks new stacks and retains the row setting',()=>page.evaluate(()=>loadWarehouse().items.length===WH_MAX&&player.inv.find(i=>i.uid==='row-mana').cnt===7&&document.querySelector('[data-wh-uid="row-mana"] [data-wh-quantity]').textContent.includes('轉移 1')));
await page.evaluate(()=>{player.inv=[__item('potion_blue','same-side-uid',20),__item('potion_heal','other-row',7)];saveWarehouse({items:[__item('potion_blue','same-side-uid',30)],gold:500});renderWarehouseNPC(document.getElementById('interaction-content'));});
await edit('inv','same-side-uid','3');await edit('store','same-side-uid','5');
await page.click(transfer('store','same-side-uid'));
await check('matching UIDs on opposite sides retain independent quantities',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='same-side-uid').cnt===25&&loadWarehouse().items[0].cnt===25&&document.querySelector('#wh-inv-list [data-wh-quantity]').textContent.includes('轉移 3')));
await page.click(transfer('inv','other-row')+' img');
await check('clicking another row icon transfers its entire stack without inheriting the first row quantity',()=>page.evaluate(()=>!player.inv.some(i=>i.uid==='other-row')&&loadWarehouse().items.find(i=>i.id==='potion_heal').cnt===7));
await page.click(transfer('inv','same-side-uid'));
await check('deposit uses its own retained quantity after a withdrawal on the other side',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='same-side-uid').cnt===22&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===28));
await edit('store','same-side-uid','4');
for(const key of ['warehouse','role']){
 await page.evaluate(key=>{__failKey=key==='warehouse'?whKey():'lineage_idle_save_'+currentSlot;},key);await page.click(transfer('store','same-side-uid'));
 await check('failed '+key+' write restores withdrawal and retains its quantity',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='same-side-uid').cnt===22&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===28&&document.querySelector('#wh-store-list [data-wh-uid="same-side-uid"] [data-wh-quantity]').textContent.includes('轉移 4')));
}
await page.evaluate(()=>{__failKey=null;});await page.click(transfer('store','same-side-uid'));
await check('withdrawal retry applies the requested quantity exactly once',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='same-side-uid').cnt===26&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===24));
await edit('inv','same-side-uid','20');
await page.evaluate(()=>{player.inv.find(i=>i.uid==='same-side-uid').cnt=10;renderWarehouseNPC(document.getElementById('interaction-content'));});
await page.click(transfer('inv','same-side-uid'));
await check('a quantity above the current holding is rejected rather than silently clamped',()=>page.evaluate(()=>player.inv.find(i=>i.uid==='same-side-uid').cnt===10&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===24&&!!document.querySelector('#wh-inv-list [role="alert"]')?.textContent));
await page.evaluate(()=>{player.classicMode=true;renderWarehouseNPC(document.getElementById('interaction-content'));});
await check('mode changes reset transient quantities without changing either warehouse',()=>page.evaluate(()=>loadWarehouse().items.length===0&&document.querySelector('#wh-inv-list [data-wh-quantity]').textContent.trim()==='10'));
await page.evaluate(()=>{player.classicMode=false;renderWarehouseNPC(document.getElementById('interaction-content'));});
await page.click('[onclick="whOneClickDeposit()"]');
await check('one-click deposit still merges matching stacks through the original transaction',()=>page.evaluate(()=>!player.inv.some(i=>i.id==='potion_blue')&&loadWarehouse().items.find(i=>i.id==='potion_blue').cnt===34));
await page.click('[onclick="sortWarehouse()"]');
await check('warehouse sort preserves all quantities and orders items with the native comparator',()=>page.evaluate(()=>{const w=loadWarehouse();return w.items.length===2&&w.items.every((it,i)=>i===0||invSortCmp(w.items[i-1],it)<=0)&&w.items.reduce((n,it)=>n+it.cnt,0)===41;}));
await page.evaluate(()=>{player.inv=Array.from({length:130},(_,i)=>__item('wpn_katana','inv-page-'+i,1,i%15));saveWarehouse({items:Array.from({length:107},(_,i)=>__item('wpn_katana','store-page-'+i,1,i%15)),gold:500});whSetFilter('weapon');});
await check('all filtered rows are available in their scroll lists',()=>page.evaluate(()=>document.querySelectorAll('#wh-inv-list [data-wh-uid]').length===130&&document.querySelectorAll('#wh-store-list [data-wh-uid]').length===107));
async function wheelList(side,delta){const point=await page.evaluate(side=>{const r=document.getElementById('wh-'+side+'-list').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},side);await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,delta);await page.waitForFunction(side=>document.getElementById('wh-'+side+'-list').scrollTop>0,side);const settled=await page.evaluate(async side=>{const list=document.getElementById('wh-'+side+'-list');let last=list.scrollTop,still=0;for(let i=0;i<90&&still<4;i++){await new Promise(r=>requestAnimationFrame(r));const now=list.scrollTop;still=Math.abs(now-last)<.01?still+1:0;last=now;}return still>=4;},side);if(!settled)throw Error('Native wheel motion did not settle');}
await wheelList('inv',600);await page.waitForFunction(()=>document.getElementById('wh-inv-list').scrollTop>300);
await check('backpack wheel scrolling does not move the warehouse or fixed controls',()=>page.evaluate(()=>document.getElementById('wh-store-list').scrollTop===0&&document.getElementById('warehouse-window-content').scrollTop===0));
const leftScroll=await page.evaluate(()=>document.getElementById('wh-inv-list').scrollTop);
await wheelList('store',900);await page.waitForFunction(()=>document.getElementById('wh-store-list').scrollTop>500);
await check('warehouse wheel scrolling is independent of the backpack',()=>page.evaluate(left=>document.getElementById('wh-inv-list').scrollTop===left,leftScroll));
const beforeTransfer=await page.evaluate(()=>({inv:document.getElementById('wh-inv-list').scrollTop,store:document.getElementById('wh-store-list').scrollTop,uid:[...document.querySelectorAll('#wh-inv-list [data-wh-uid]')].find(e=>{const r=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom;}).dataset.whUid}));
await page.click(transfer('inv',beforeTransfer.uid));
await check('transferring a visible row preserves both scroll positions',()=>page.evaluate(b=>Math.abs(document.getElementById('wh-inv-list').scrollTop-b.inv)<1&&Math.abs(document.getElementById('wh-store-list').scrollTop-b.store)<1&&!player.inv.some(i=>i.uid===b.uid),beforeTransfer));
await page.evaluate(()=>{const a=document.getElementById('wh-inv-list'),b=document.getElementById('wh-store-list');a.scrollTop=a.scrollHeight;b.scrollTop=b.scrollHeight;window.__bottomScroll=a.scrollTop;player.inv.splice(-12);renderWarehouseNPC(document.getElementById('interaction-content'));});
await check('removing bottom rows clamps the scroll position to the new end',()=>page.evaluate(()=>{const a=document.getElementById('wh-inv-list');return a.scrollTop>0&&a.scrollTop<__bottomScroll&&Math.abs(a.scrollHeight-a.clientHeight-a.scrollTop)<2;}));
await page.focus('#wh-search-input');await page.keyboard.insertText('治癒');
await check('cross-category search resets both scroll positions',()=>page.evaluate(()=>document.getElementById('wh-inv-list').scrollTop===0&&document.getElementById('wh-store-list').scrollTop===0&&!document.querySelector('#wh-inv-list [data-wh-uid]')));
await page.evaluate(()=>{const e=document.getElementById('wh-search-input');window.__imeNode=e;e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='武士';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});
await check('Chinese composition preserves the live search input',()=>page.evaluate(()=>__imeNode===document.getElementById('wh-search-input')));
await page.evaluate(()=>{__imeNode.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));});
await page.waitForFunction(()=>document.getElementById('wh-search-input').value==='武士'&&!!document.querySelector('#wh-inv-list [data-wh-uid]'));
await page.click('[onclick="whClearSearch()"]');
await page.click('[data-wh-filter="armor"]');
await check('category changes reset both scroll positions and keep the native wearable filter',()=>page.evaluate(()=>document.getElementById('wh-inv-list').scrollTop===0&&document.getElementById('wh-store-list').scrollTop===0&&!!document.getElementById('afk-wh-wearonly')));
await page.evaluate(()=>{const ids=Object.keys(DB.items).filter(id=>['arm','wpn','acc'].includes(DB.items[id].type)&&!checkCanEquip({id})&&!WH_NO_STORE.includes(id));player.inv=[__item(ids[0],'cannot-wear')];whSetFilter(whCategory(ids[0]));});
await page.click('#afk-wh-wearonly');
await check('only wearable items filter still excludes incompatible equipment',()=>page.evaluate(()=>!document.querySelector('[data-wh-uid="cannot-wear"]')));
await page.click('#afk-wh-wearonly');
await page.evaluate(()=>{player.inv=Array.from({length:45},(_,i)=>({...__item('rem_claw','rem-'+i),seteff:i<30?'紅獅':'白鳥'}));whSetFilter('remains');whSetSubFilter('白鳥');});
await check('remains subcategory filters the entire scrolling list',()=>page.evaluate(()=>[...document.querySelectorAll('#wh-inv-list [data-wh-uid]')].every(e=>Number(e.dataset.whUid.slice(4))>=30)&&!!document.querySelector('#wh-inv-list [data-wh-uid]')));
await page.evaluate(()=>{player.gold=1931000000;const longest=Object.keys(DB.items).filter(id=>DB.items[id].type==='wpn').sort((a,b)=>DB.items[b].n.length-DB.items[a].n.length)[0];player.inv=Array.from({length:180},(_,i)=>({...__item(i%2?longest:'wpn_katana','layout-'+i,100,15),bless:true,anc:'primordial',attr:'fire5'}));saveWarehouse({items:Array.from({length:175},(_,i)=>__item('wpn_katana','layout-store-'+i,100,15)),gold:39000000});whSetFilter('weapon');});
await page.evaluate(()=>{const frame=document.getElementById('warehouse-window-frame');Object.assign(frame.style,{width:'1100px',height:'600px',left:'100px',top:'120px',transform:'none',aspectRatio:'auto'});});
await page.click(amount('inv','layout-0'));await page.fill(row('inv','layout-0')+' input','7');await page.evaluate(()=>{window.__warehouseDraft=document.querySelector('#wh-inv-list [data-wh-uid="layout-0"] input');});
for(const side of ['n','s','e','w','ne','nw','se','sw']){
 await page.evaluate(()=>{Object.assign(document.getElementById('warehouse-window-frame').style,{width:'1100px',height:'600px',left:'100px',top:'120px',transform:'none',aspectRatio:'auto'});});
 const start=await page.evaluate(side=>{const f=document.getElementById('warehouse-window-frame').getBoundingClientRect(),h=document.querySelector('[data-warehouse-resize="'+side+'"]').getBoundingClientRect();return {x:h.left+h.width/2,y:h.top+h.height/2,r:f.toJSON()};},side);
 const dx=side.includes('w')?-24:side.includes('e')?24:0,dy=side.includes('n')?-18:side.includes('s')?18:0;
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y+dy);await page.mouse.up();
 await check('native '+side+' resize changes the selected edges and preserves the opposite edges',()=>page.evaluate(({side,r,dx,dy})=>{const a=document.getElementById('warehouse-window-frame').getBoundingClientRect();return Math.abs(a.left-(r.left+(side.includes('w')?dx:0)))<2&&Math.abs(a.right-(r.right+(side.includes('e')?dx:0)))<2&&Math.abs(a.top-(r.top+(side.includes('n')?dy:0)))<2&&Math.abs(a.bottom-(r.bottom+(side.includes('s')?dy:0)))<2;},{side,r:start.r,dx,dy}));
}
await check('resizing keeps the active quantity editor and draft intact without trading',()=>page.evaluate(()=>__warehouseDraft===document.querySelector('#wh-inv-list [data-wh-uid="layout-0"] input')&&__warehouseDraft.value==='7'&&player.inv.find(i=>i.uid==='layout-0').cnt===100));
await page.press(row('inv','layout-0')+' input','Escape');
await page.focus('[data-warehouse-resize="se"]');const beforeKey=await page.evaluate(()=>document.getElementById('warehouse-window-frame').getBoundingClientRect().width);await page.keyboard.press('ArrowRight');
await check('resize handle also supports keyboard adjustment',()=>page.evaluate(w=>Math.abs(document.getElementById('warehouse-window-frame').getBoundingClientRect().width-w-24)<2,beforeKey));
async function dragCornerTo(x,y){const r=await page.evaluate(()=>{const a=document.querySelector('[data-warehouse-resize="se"]').getBoundingClientRect();return {x:a.left+a.width/2,y:a.top+a.height/2};});await page.mouse.move(r.x,r.y);await page.mouse.down();await page.mouse.move(x,y);await page.mouse.up();}
await dragCornerTo(180,220);
await check('minimum size keeps all fixed controls visible and both lists usable',()=>page.evaluate(()=>{const f=document.getElementById('warehouse-window-frame').getBoundingClientRect(),bad=[...document.querySelectorAll('.wh-filters button,.wh-filters input,.wh-filters select,.wh-tools button,.wh-gold input,.wh-gold button')].filter(e=>e.getClientRects().length).some(e=>{const r=e.getBoundingClientRect();return r.left<f.left||r.right>f.right||r.bottom>f.bottom;});return f.width>=759&&f.height>=479&&!bad&&[...document.querySelectorAll('.wh-list')].every(e=>e.clientHeight>=50);}));
await dragCornerTo(1329,899);
await check('resizing is clamped to the viewport boundary',()=>page.evaluate(()=>{const f=document.getElementById('warehouse-window-frame').getBoundingClientRect();return f.left>=0&&f.top>=0&&f.right<=document.documentElement.clientWidth-7&&f.bottom<=document.documentElement.clientHeight-7;}));
await page.evaluate(()=>{window.__closedWarehouseSize=document.getElementById('warehouse-window-frame').getBoundingClientRect().toJSON();});await page.click('#warehouse-window-close');await page.evaluate(()=>openWarehouseWindow());
await check('reopening retains the adjusted size during the current session',()=>page.evaluate(()=>{const r=document.getElementById('warehouse-window-frame').getBoundingClientRect();return Math.abs(r.width-__closedWarehouseSize.width)<1&&Math.abs(r.height-__closedWarehouseSize.height)<1;}));
await page.evaluate(()=>{const f=document.getElementById('warehouse-window-frame');for(const k of ['width','height','left','top','transform','aspectRatio'])f.style[k]='';});
for(const [width,height] of [[1330,900],[1920,1080]])for(const scale of [60,75,80,100]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await page.evaluate(s=>{const f=document.getElementById('warehouse-window-frame');for(const k of ['width','height','left','top','transform','aspectRatio'])f.style[k]='';setUiScale(s);},scale);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const resizeStart=await page.evaluate(()=>{const f=document.getElementById('warehouse-window-frame').getBoundingClientRect(),h=document.querySelector('[data-warehouse-resize="se"]').getBoundingClientRect();return {x:h.left+h.width/2,y:h.top+h.height/2,w:f.width,h:f.height};});
 await page.mouse.move(resizeStart.x,resizeStart.y);await page.mouse.down();await page.mouse.move(resizeStart.x-24,resizeStart.y-18);await page.mouse.up();
 await check(width+' '+scale+'%: native resizing tracks screen coordinates correctly',()=>page.evaluate(r=>{const f=document.getElementById('warehouse-window-frame').getBoundingClientRect();return Math.abs(f.width-(r.w-24))<2&&Math.abs(f.height-(r.h-18))<2;},resizeStart));
 await check(width+' '+scale+'%: warehouse chrome stays fixed while both lists scroll vertically without horizontal overflow',()=>page.evaluate(()=>{const root=document.getElementById('warehouse-window-frame'),bounds=root.getBoundingClientRect(),chrome=[document.getElementById('warehouse-window-content'),...root.querySelectorAll('.wh-columns,.wh-column,.wh-filters,.wh-tools,.wh-gold')],lists=[...root.querySelectorAll('.wh-list')];const overflow=chrome.filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1),bad=[...root.querySelectorAll('[data-warehouse-resize],.wh-filters button,.wh-filters input,.wh-filters select,.wh-tools button,.wh-gold input,.wh-gold button,#warehouse-window-close')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<bounds.left||r.right>bounds.right+1||r.top<bounds.top||r.bottom>bounds.bottom+1;});return bounds.left>=0&&bounds.top>=0&&bounds.right<=innerWidth+1&&bounds.bottom<=innerHeight+1&&!overflow.length&&!bad.length&&lists.every(e=>e.scrollHeight>e.clientHeight&&e.scrollWidth<=e.clientWidth+1&&getComputedStyle(e).overflowY==='auto')||{bounds:bounds.toJSON(),overflow:overflow.map(e=>e.className),bad:bad.map(e=>e.outerHTML.slice(0,180))};}));
 if(scale===100){await page.cdp('Emulation.setEmulatedMedia',{media:'screen'});const pdf=await page.cdp('Page.printToPDF',{printBackground:true,paperWidth:width/96,paperHeight:height/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1});await fs.mkdir(options.root+'/tmp/pdfs',{recursive:true});await fs.writeFile(options.root+'/tmp/pdfs/warehouse-list-'+width+'-'+options.protocol+'.pdf',Buffer.from(pdf.data,'base64'));}
}
await check('no runtime errors',()=>page.evaluate(()=>__errors.length===0||__errors));
}
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:init});
console.log({report:reportPath,checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')});
if(!options.baseline&&reports.some(r=>r.status==='FAIL'))throw Error('Warehouse list checks failed');
if(!options.keepSpace)await task.finish({keep:[]});
})();
