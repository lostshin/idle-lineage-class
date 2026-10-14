// Failure cases: equipment opening changes the column budget, lost width
// preferences, overflow at 1330px, and failure to restore other tab widths.
// Native game-layout bounds/apply in synthetic geometry; not browser E2E.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..'),reports=[];
const source=fs.readFileSync(path.join(root,'js/game-layout.js'),'utf8'),baseline=process.argv.includes('--baseline');
for(const viewport of [1330,1920])for(const scale of [.6,.75,.8,1]){
    const values={},original={left:.18,right:.24};let active=false;
    const game={clientWidth:viewport/scale,style:{setProperty:(k,v)=>values[k]=parseFloat(v),removeProperty:k=>delete values[k]},getBoundingClientRect:()=>({left:0,bottom:900})};
    const left={getBoundingClientRect:()=>({left:0,right:values['--game-left-width']*scale,width:values['--game-left-width']*scale,top:0})};
    const right={get clientWidth(){return values['--game-right-width']||300;},getBoundingClientRect:()=>({left:viewport-(values['--game-right-width']||300)*scale,width:(values['--game-right-width']||300)*scale,top:0})};
    const center={getBoundingClientRect:()=>({left:left.getBoundingClientRect().right+8,right:right.getBoundingClientRect().left-8,top:0})};
    const panel={classList:{contains:()=>active},get clientWidth(){return right.clientWidth-32;}};
    const equipment={get clientWidth(){return panel.clientWidth-16;}};
    const ctx=vm.createContext({window:null,document:{readyState:'complete',body:{classList:{contains:()=>false}},getElementById:id=>id==='tab-content-panel'?panel:id==='equipment-window'?equipment:null},game,left,right,center,prefs:{...original},control:{},handles:[],innerWidth:viewport,getUiScale:()=>scale,screenToUiPx:v=>v/scale+'px',matchMedia:()=>({matches:true}),getComputedStyle:()=>({columnGap:'8',paddingLeft:'16',paddingRight:'16'})});ctx.window=ctx;
    vm.runInContext(fs.readFileSync(path.join(root,'js/19-equipment-window.js'),'utf8'),ctx);
    vm.runInContext(source.slice(source.indexOf('    function bounds()'),source.indexOf('    function persist()')),ctx);
    ctx.apply();const before={...values};active=true;ctx.apply();
    const expanded={...values},b=ctx.bounds();active=false;ctx.apply();
    const checks={unchangedWidth:JSON.stringify(expanded)===JSON.stringify(before),center:game.clientWidth-48-expanded['--game-left-width']-expanded['--game-right-width']>0,budget:expanded['--game-left-width']+expanded['--game-right-width']<=b.available-b.minCenter+.01,preference:JSON.stringify(ctx.prefs)===JSON.stringify(original),restored:JSON.stringify(values)===JSON.stringify(before)};
    reports.push({viewport,scale,status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,expanded});
}
const dir=path.join(root,'tmp/test-runs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'equipment-column-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify({method:'Synthetic native game-layout bounds/apply; no browser or saved player data',reports},null,2)+'\n');
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
