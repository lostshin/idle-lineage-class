// Failure cases: stretched artwork, overflowing/overlapping sockets, missing
// defaults or figures, wrong actor gender, broken page selection/item handlers,
// incorrect offhand routing, resize collapse, and mutations during rendering.
// Native renderer with synthetic DOM geometry; not browser E2E or visual QA.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline'),reports=[];
function node(){
    const attrs={},classes=new Set(),values={};
    const n={children:[],dataset:{},style:{setProperty(k,v){values[k]=v;},removeProperty(k){delete values[k];}},values,
        classList:{add(...names){names.forEach(s=>classes.add(s));},contains(s){return classes.has(s);},toggle(s,on){if(on)classes.add(s);else classes.delete(s);}},
        appendChild(c){this.children.push(c);c.parentElement=this;return c;},setAttribute(k,v){attrs[k]=String(v);},getAttribute(k){return attrs[k]??null;},
        addEventListener(){},querySelectorAll(){return this.children.filter(n=>n.dataset.equipmentSlot);},querySelector(s){return this.children.find(c=>c.className===s.slice(1))||null;}};
    Object.defineProperty(n,'innerHTML',{set(){this.children=[];}});
    Object.defineProperty(n.style,'cssText',{set(text){for(const entry of text.split(';')){const [k,v]=entry.split(':');if(k)n.style[k.trim()]=v?.trim();}}});
    return n;
}
const ids=Object.fromEntries(['equipment-window','equipment-window-frame','equipment-window-slots','equipment-window-prev','equipment-window-next','equipment-window-weight','tab-content-panel'].map(id=>[id,node()]));
const bg=node();bg.className='equipment-window-bg';ids['equipment-window-frame'].appendChild(bg);
const ready=[],actor={cls:'mage',avatar:'法師',eq:{wpn:{id:'test_staff',uid:'weapon',en:7,cnt:1},rem_eye:{id:'rem_eye',uid:'remains',cnt:1}},d:{weightPct:82,loadTier:2}},actions=[];
const ctx=vm.createContext({console,window:null,document:{readyState:'loading',createElement:node,getElementById:id=>ids[id],addEventListener:(name,fn)=>ready.push(fn)},player:actor,
    DB:{items:{test_staff:{type:'wpn',n:'合成法杖'},rem_eye:{type:'acc',n:'之眼'},acc_earth_dragon_eye:{type:'acc',n:'地龍之魔眼'}}},
    getIconUrl:d=>'icons/'+d.n+'.png',capEn:value=>value,getUiScale:()=>.8,innerWidth:1920,matchMedia:()=>({matches:false}),
    loadStartKeyFromSummary:a=>a.avatar.startsWith('女')?'f_mage':'m_mage',loadFirstFrame:()=>0,loadFrameSrc:key=>'assets/start/'+key+'/0.png',
    openModal:(...args)=>actions.push(['modal',...args]),unequipItem:key=>actions.push(['unequip',key]),requestAnimationFrame:fn=>fn(),addEventListener(){}});ctx.window=ctx;
vm.runInContext(fs.readFileSync(path.join(root,'js/19-equipment-window.js'),'utf8'),ctx);
const party=fs.readFileSync(path.join(root,'js/party-inspector.js'),'utf8');
vm.runInContext(party.slice(party.indexOf('function partyEquipmentDefault('),party.indexOf('function partyEquipmentHtml(')),ctx);
ready.forEach(fn=>fn());
const panel=ids['tab-content-panel'],frame=ids['equipment-window-frame'],host=ids['equipment-window-slots'];
function slots(){return host.children.filter(n=>n.className?.startsWith('equipment-visual-slot'));}
function check(name,fn){try{if(fn()!==true)throw Error('check returned false');reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}}
check('both pages retain slot counts, square defaults and nonoverlapping coordinates',()=>{
    for(const [id,count]of [['equipment-window-prev',19],['equipment-window-next',9]]){
        panel.clientWidth=460;panel.clientHeight=700;ctx.setEquipmentPanelEmbedded(true);ids[id].onclick();
        const ss=slots();if(ss.length!==count||ss.some(s=>parseFloat(s.style.width)*.8<49.9||Math.abs(parseFloat(s.style.width)-parseFloat(s.style.height))>.01||!s.children.some(c=>c.dataset.equipmentDefault)))return false;
        const rects=ss.map(s=>{const w=parseFloat(s.style.width),h=parseFloat(s.style.height);return {x:parseFloat(s.style.left)-w/2,y:parseFloat(s.style.top)-h/2,w,h};});
        if(!rects.every((a,i)=>a.x>=0&&a.y>=0&&a.x+a.w<=460&&a.y+a.h<=parseFloat(frame.values.height)&&rects.slice(i+1).every(b=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=0||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=0)))return false;
    }return true;
});
check('native fit keeps the existing width and reserves vertical room for 50px sockets',()=>{
    for(const [w,h]of [[300,700],[460,700],[300,320],[460,320]]){
        panel.clientWidth=w;panel.clientHeight=h;ctx.setEquipmentPanelEmbedded(true);
        const width=parseFloat(frame.values.width);if(width<=0||Math.abs(width-w)>.01||slots().some(s=>parseFloat(s.style.width)*.8<49.9))return false;
        for(let i=0;i<20;i++)ctx.setEquipmentPanelEmbedded(true);
        if(parseFloat(frame.values.width)!==width)return false;
    }return true;
});
check('main backdrop uses teammate artwork and first-page figure follows actor gender',()=>{
    ids['equipment-window-prev'].onclick();const figure=()=>host.children.find(n=>n.className==='party-paperdoll-figure')?.children[0];
    if(!bg.src?.includes('party-equipment-backdrop-v2-4x3.png')||!figure()?.src.includes('m_mage'))return false;
    actor.avatar='女法師';ctx.refreshEquipmentWindow();if(!figure()?.src.includes('f_mage'))return false;
    ids['equipment-window-next'].onclick();return !figure()&&ids['equipment-window-next'].getAttribute('aria-pressed')==='true';
});
check('native leader click and double click retain item identity and correct offhand key',()=>{
    actor.eq.offwpn={...actor.eq.wpn,uid:'offhand'};ids['equipment-window-prev'].onclick();
    const s=slots().find(n=>n.getAttribute('data-tip-uid')==='offhand');if(!s||s.getAttribute('data-tip-src')!=='eq')return false;
    s.onclick();s.ondblclick({preventDefault(){},stopPropagation(){}});
    return actions[0][0]==='modal'&&actions[0][1]===actor.eq.offwpn&&actions[0][2]===true&&actions[0][3]==='offwpn'&&actions[1][0]==='unequip'&&actions[1][1]==='offwpn';
});
check('rendering preserves actor state, native weight and enhancement badges',()=>{
    const before=JSON.stringify(actor);ctx.refreshEquipmentWindow();const s=slots().find(n=>n.getAttribute('data-tip-uid')==='weapon');
    return JSON.stringify(actor)===before&&ids['equipment-window-weight'].textContent==='負重 82 %'&&s.children.some(n=>n.className==='equipment-slot-enhance'&&n.textContent==='+7')&&s.children.some(n=>n.className==='equipment-slot-equipped'&&n.textContent==='E');
});
check('short panels retain 50px sockets and scroll rather than shrinking the artwork',()=>{
    panel.clientWidth=460;panel.clientHeight=400;ctx.setEquipmentPanelEmbedded(true);
    return !ids['equipment-window'].children.some(n=>n.id==='equipment-stat-contributions')&&parseFloat(frame.values.width)===460&&slots().every(s=>parseFloat(s.style.width)*.8>=49.9);
});
const outDir=path.join(root,process.argv.includes('--record')?'tests/artifacts':'tmp/test-runs');fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'main-equipment-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify({method:'Synthetic Node VM native main equipment renderer and fitting; DOM, icons and character frame loaders stubbed; not browser E2E',reports},null,2)+'\n');
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
