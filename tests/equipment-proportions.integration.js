// Verify proportional (16% width) square nonoverlapping sockets on both pages, width-and-height
// fitting that stops shrinking at 50 screen px sockets, and resize stability.
// Geometry-only native renderer harness; does not replace browser visual QA.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline');
const outDir=path.join(root,process.argv.includes('--record')?'tests/artifacts':'tmp/test-runs');fs.mkdirSync(outDir,{recursive:true});
const nodes=[];
function node(){
    const values={},style={setProperty:(k,v)=>values[k]=v};
    Object.defineProperty(style,'cssText',{set(text){for(const entry of text.split(';')){const [k,v]=entry.split(':');if(k)style[k.trim()]=v?.trim();}}});
    const n={style,values,dataset:{},children:[],appendChild(c){this.children.push(c);},setAttribute(){},removeAttribute(){},outerHTML:'',querySelector:()=>null};nodes.push(n);return n;
}
const frame=node(),details={clientWidth:0,querySelector:s=>s==='.party-equipment-frame'?frame:s==='.party-equipment-toolbar'?{offsetHeight:32}:null};
const panel={clientHeight:0,style:{maxHeight:'0'},querySelector:s=>({offsetHeight:s==='header'?44:32})};
const ctx=vm.createContext({window:{},getUiScale:()=>ctx.scale,scale:.8,document:{readyState:'complete',createElement:node,getElementById:id=>id==='party-details'?details:null},panel,userSize:{},getComputedStyle:()=>({paddingTop:'16',paddingBottom:'16',paddingLeft:'16',paddingRight:'16'}),partyPortraitNode:node,equipmentSummaryHtml:()=>'',ALLY_EQUIP_SLOT_NAME:{},DB:{items:{}}});
vm.runInContext(fs.readFileSync(path.join(root,'js/19-equipment-window.js'),'utf8'),ctx);
ctx.equipmentView=ctx.window.equipmentView;
const source=fs.readFileSync(path.join(root,'js/party-inspector.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('function partyEquipmentWeightHtml('),source.indexOf('(function () {')),ctx);
const pages=[];
for(let page=0;page<2;page++){
    nodes.length=0;ctx.partyEquipmentHtml({eq:{}},'pet','synthetic',page);
    pages.push(nodes.filter(n=>n.dataset.equipmentSlot));
}
const reports=[];
for(const scale of [.6,.75,.8,1])for(const [width,height]of [[260,900],[300,650],[460,320],[320,900],[320,240],[358,844],[477,1125],[1330,900]]){
    ctx.scale=scale;
    const layouts=pages.map((slots,page)=>ctx.equipmentView.layout(width,page));
    const rects=layouts.map(layout=>layout.slots.map(s=>({x:s.x-layout.size/2,y:s.y-layout.size/2,w:layout.size,h:layout.size})));
    const all=rects.flat();
    const noOverlap=rects.every(rows=>rows.every((r,i)=>rows.slice(i+1).every(b=>Math.min(r.x+r.w,b.x+b.w)-Math.max(r.x,b.x)<=.1||Math.min(r.y+r.h,b.y+b.h)-Math.max(r.y,b.y)<=.1)));
    const fitted=pages.map((slots,page)=>ctx.equipmentView.layout(ctx.equipmentView.fitWidth(width,height,page),page));
    const before=JSON.stringify(layouts);let stable=true;for(let i=0;i<100;i++)stable=stable&&before===JSON.stringify(pages.map((slots,page)=>ctx.equipmentView.layout(width,page)));
    const checks={originalWidth:layouts.every(l=>l.width===width),proportionalSockets:layouts.every(l=>Math.abs(l.size-l.width*.16)<.01),squareSockets:all.every(r=>Math.abs(r.w-r.h)<.1),allSlotsInside:rects.every((rows,page)=>rows.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+.01&&r.y+r.h<=layouts[page].height-30/scale+.01)),noOverlap,stable,fitsAvailableHeight:fitted.every((l,page)=>l.width<=width+.01&&(l.height<=height+.01||l.width>=Math.min(width,50/scale/.16)-.01)),slotCounts:rects[0].length===19&&rects[1].length===9};
    reports.push({scale,availableWidth:width,availableHeight:height,layout:layouts.map(l=>({width:l.width,height:l.height,size:l.size})),fitted:fitted.map(l=>({width:l.width,height:l.height,size:l.size})),status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks});
}
const result={method:'Native equipment layout and equipment renderer in synthetic Node VM; geometry only, not browser layout or visual QA',reports};
fs.writeFileSync(path.join(outDir,'equipment-larger-slots-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').map(r=>({size:[r.availableWidth,r.availableHeight],checks:r.checks}))},null,2));
if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
