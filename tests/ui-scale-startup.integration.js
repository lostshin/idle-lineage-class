// Failure cases: a 100% first paint before the saved scale, different early/final
// viewport dimensions, lost migration or retry semantics, premature writes,
// blocked storage, and desktop preferences read before file-store migration.
// Native startup in a synthetic DOM/storage harness; not browser E2E.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),source=fs.readFileSync(path.join(root,'js/ui-scale.js'),'utf8');
const baseline=process.argv.includes('--baseline'),reports=[];
function boot(initial={},options={}){
    const data={...initial},files={...(options.files||{})},writes=[],listeners={},classes=new Set(),properties={};
    let hasBody=false;
    const controls=Object.fromEntries(['set-ui-scale','ui-scale-value','ui-scale-status','btn-ui-scale-reset'].map(k=>[k,{value:'',textContent:'',addEventListener(){}}]));
    const element={clientWidth:1330,clientHeight:900,style:{zoom:'',setProperty:(k,v)=>properties[k]=v},classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}};
    const storage={getItem:k=>{if(options.readFailure)throw Error('blocked read');return data[k]??null;},setItem:(k,v)=>{if(options.failKey===k)throw Error('blocked write');data[k]=String(v);writes.push(k);}};
    const bridge=options.desktop?{get:k=>files[k]??null,has:k=>Object.hasOwn(files,k),set:(k,v)=>{if(options.failKey===k)return false;files[k]=String(v);writes.push(k);return true;}}:null;
    const ctx=vm.createContext({window:null,document:{readyState:'loading',documentElement:element,getElementById:id=>hasBody?controls[id]:null,addEventListener:(k,fn)=>(listeners[k]||=[]).push(fn)},localStorage:storage,Event:class{constructor(type){this.type=type;}},fableStore:bridge,addEventListener(){},dispatchEvent(){}});ctx.window=ctx;
    const snapshot=()=>({scale:Number(element.style.zoom)||1,active:classes.has('ui-scale-active'),properties:{...properties}});
    const inHead=html.indexOf('src="js/ui-scale.js')<html.indexOf('<body');
    if(inHead)vm.runInContext(source,ctx);
    const early=snapshot(),earlyWrites=writes.length;
    // Match the existing file-store migration before the main settings initialize.
    if(bridge&&!bridge.has('__fs_migrated_v1')){for(const [k,v]of Object.entries(data))if(!bridge.has(k))bridge.set(k,v);bridge.set('__fs_migrated_v1','1');}
    ctx._lsGet=k=>{try{return bridge?bridge.get(k):storage.getItem(k);}catch{return null;}};
    ctx._lsSet=(k,v)=>{try{if(bridge)return bridge.set(k,v);storage.setItem(k,v);return true;}catch{return false;}};
    hasBody=true;
    if(!inHead)vm.runInContext(source,ctx);
    else for(const fn of listeners.DOMContentLoaded||[])fn();
    return {early,final:snapshot(),earlyWrites,controls,data:bridge?files:data,ctx,options};
}
function check(name,fn){try{if(fn()!==true)throw Error('check returned false');reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}}
for(const [name,initial,expected]of [
    ['new device',{},80],['unmigrated device',{lineage_ui_scale:'100'},80],
    ...[60,75,80,100].map(p=>['saved '+p,{lineage_ui_scale_80_v1:'1',lineage_ui_scale:String(p)},p]),
    ...[['invalid','bad',80],['empty','',80],['below range','40',60],['above range','120',100]].map(([n,v,p])=>[n,{lineage_ui_scale_80_v1:'1',lineage_ui_scale:v},p])]){
    check(name+' uses the same scale and viewport before body and after initialization',()=>{const b=boot(initial);return b.early.scale===expected/100&&JSON.stringify(b.early)===JSON.stringify(b.final)&&b.early.properties['--ui-width']===(1330/(expected/100))+'px'&&b.early.properties['--ui-height']===(900/(expected/100))+'px'&&b.earlyWrites===0&&b.controls['set-ui-scale'].value===String(expected/.8);});
}
check('blocked storage still renders 80% from the first paint',()=>{const b=boot({}, {readFailure:true,failKey:'lineage_ui_scale'});return b.early.scale===.8&&JSON.stringify(b.early)===JSON.stringify(b.final)&&b.controls['ui-scale-status'].textContent.includes('未儲存')&&!b.data.lineage_ui_scale_80_v1;});
for(const failKey of ['lineage_ui_scale','lineage_ui_scale_80_v1'])check('failed '+failKey+' remains retryable without early writes or a scale jump',()=>{const b=boot({lineage_ui_scale:'100'},{failKey});if(b.early.scale!==.8||b.final.scale!==.8||b.data.lineage_ui_scale_80_v1||b.earlyWrites)return false;b.options.failKey=null;return b.ctx.setUiScale(90)===true&&b.data.lineage_ui_scale==='90'&&b.data.lineage_ui_scale_80_v1==='1';});
check('desktop reads its existing file preferences before body',()=>{const b=boot({lineage_ui_scale:'100'},{desktop:true,files:{__fs_migrated_v1:'1',lineage_ui_scale_80_v1:'1',lineage_ui_scale:'75'}});return b.early.scale===.75&&JSON.stringify(b.early)===JSON.stringify(b.final)&&b.earlyWrites===0;});
check('desktop first migration matches the local preferences it will copy',()=>{const b=boot({lineage_ui_scale_80_v1:'1',lineage_ui_scale:'60'},{desktop:true});return b.early.scale===.6&&JSON.stringify(b.early)===JSON.stringify(b.final)&&b.earlyWrites===0;});
check('user changes and reset retain persistence with the current size displayed as 100%',()=>{const b=boot({lineage_ui_scale_80_v1:'1',lineage_ui_scale:'75'});return b.ctx.setUiScale(95)===true&&b.data.lineage_ui_scale==='95'&&b.controls['ui-scale-value'].textContent==='118.75%'&&b.ctx.setUiScale(80)===true&&b.data.lineage_ui_scale==='80'&&b.controls['set-ui-scale'].value==='100';});
const outDir=path.join(root,process.argv.includes('--record')?'tests/artifacts':'tmp/test-runs');fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'ui-scale-startup-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify({method:'Native ui-scale.js in synthetic head/body DOM and storage; not browser first-paint measurement or E2E',reports},null,2)+'\n');
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
