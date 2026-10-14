// Before implementation: verify wider/shorter sheets, square nonoverlapping
// sockets on both pages, viewport containment, and repeated resize stability.
// Geometry-only native renderer harness; does not replace browser visual QA.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline');
const nodes=[];
function node(){
    const values={},style={setProperty:(k,v)=>values[k]=v};
    Object.defineProperty(style,'cssText',{set(text){for(const entry of text.split(';')){const [k,v]=entry.split(':');if(k)style[k.trim()]=v?.trim();}}});
    const n={style,values,dataset:{},children:[],appendChild(c){this.children.push(c);},setAttribute(){},removeAttribute(){},outerHTML:'',querySelector:()=>null};nodes.push(n);return n;
}
const frame=node(),details={clientWidth:0,querySelector:s=>s==='.party-equipment-frame'?frame:s==='.party-equipment-toolbar'?{offsetHeight:32}:null};
const panel={clientHeight:0,style:{maxHeight:'0'},querySelector:s=>({offsetHeight:s==='header'?44:32})};
const ctx=vm.createContext({window:{},document:{readyState:'complete',createElement:node,getElementById:id=>id==='party-details'?details:null},panel,userSize:{},getComputedStyle:()=>({paddingTop:'16',paddingBottom:'16',paddingLeft:'16',paddingRight:'16'}),partyPortraitNode:node,ALLY_EQUIP_SLOT_NAME:{},DB:{items:{}}});
vm.runInContext(fs.readFileSync(path.join(root,'js/19-equipment-window.js'),'utf8'),ctx);
ctx.equipmentView=ctx.window.equipmentView;
const source=fs.readFileSync(path.join(root,'js/party-inspector.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('function partyEquipmentWeightHtml(')>=0?source.indexOf('function partyEquipmentWeightHtml('):source.indexOf('function partyEquipmentHtml('),source.indexOf('(function () {')),ctx);
vm.runInContext(source.slice(source.indexOf('    function fitEquipment(){'),source.indexOf('    function close() {')),ctx);
const pages=[];
for(let page=0;page<2;page++){
    nodes.length=0;ctx.partyEquipmentHtml({eq:{}},'pet','synthetic',page);
    pages.push(nodes.filter(n=>n.dataset.equipmentSlot));
}
const reports=[];
for(const [width,height]of [[480,900],[480,650],[640,320],[320,900],[320,240],[358,844],[477,1125],[1330,900]]){
    details.clientWidth=width+32;panel.clientHeight=height+44+32+32+32+8;
    ctx.fitEquipment();
    const w=parseFloat(frame.values['--party-equipment-canvas-width']),h=parseFloat(frame.values['--party-equipment-canvas-height']),fh=parseFloat(frame.values['--party-equipment-height']);
    const rects=pages.map(slots=>slots.map(slot=>{const sw=parseFloat(slot.style.width)/100*w,sh=slot.style.height==='auto'?sw:parseFloat(slot.style.height)/100*h,x=parseFloat(slot.style.left)/100*w,y=parseFloat(slot.style.top)/100*h;return {x:x-sw/2,y:y-sh/2,w:sw,h:sh};}));
    const all=rects.flat();
    const noOverlap=rects.every(rows=>rows.every((r,i)=>rows.slice(i+1).every(b=>Math.min(r.x+r.w,b.x+b.w)-Math.max(r.x,b.x)<=.1||Math.min(r.y+r.h,b.y+b.h)-Math.max(r.y,b.y)<=.1)));
    const before=JSON.stringify(frame.values);for(let i=0;i<100;i++)ctx.fitEquipment();
    const checks={largerSockets:all.every(r=>Math.abs(r.w/w-.12)<.0001),widerAspect:Math.abs(w/h-.75)<.001,shorter:fh<=height+.01,inside:w<=width+.01&&h<=height+.01,squareSockets:all.every(r=>Math.abs(r.w-r.h)<.1),allSlotsInside:all.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=w+.01&&r.y+r.h<=h+.01),noOverlap,stable:before===JSON.stringify(frame.values),slotCounts:rects[0].length===19&&rects[1].length===9};
    reports.push({availableWidth:width,availableHeight:height,canvasWidth:w,canvasHeight:h,frameHeight:fh,status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks});
}
const result={method:'Native fitEquipment and equipment renderer in synthetic Node VM; geometry only, not browser layout or visual QA',reports};
fs.writeFileSync(path.join(root,'tests/artifacts/equipment-larger-slots-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL').map(r=>({size:[r.availableWidth,r.availableHeight],checks:r.checks}))},null,2));
if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
