(async()=>{
const fs=await import('node:fs/promises'),task=await taskSpace(options.space),page=task.page('p1'),previews=[],reports=[];
await page.evaluate(()=>{if(!window.__effectData)throw Error('effect-details fixture required');});
await page.cdp('Emulation.setEmulatedMedia',{media:'screen'});
async function print(name,w,h,selector){
 await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await page.mouse.move(0,0);await page.waitForFunction(()=>document.getElementById('party-ability-tip').hidden&&document.getElementById('effect-tooltip').hidden);await page.hover(selector);await page.waitForFunction(()=>!document.getElementById('party-ability-tip').hidden||!document.getElementById('effect-tooltip').hidden||[...document.querySelectorAll('.game-tooltip')].some(e=>e.style.display==='block'));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const result=await page.evaluate(()=>{const tips=[document.getElementById('party-ability-tip'),document.getElementById('effect-tooltip'),...document.querySelectorAll('.game-tooltip')].filter(e=>e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width);return tips.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=document.documentElement.clientWidth+1&&r.bottom<=document.documentElement.clientHeight+1;});});
 reports.push({name:name+' tooltip stays within viewport',status:result?'PASS':'FAIL'});
 const pdf=await page.cdp('Page.printToPDF',{printBackground:true,paperWidth:w/96,paperHeight:h/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1});await fs.mkdir(options.root+'/tmp/pdfs',{recursive:true});await fs.writeFile(options.root+'/tmp/pdfs/'+name+'.pdf',Buffer.from(pdf.data,'base64'));previews.push({file:name+'.png',width:w,height:h,protocol:options.protocol,method:'Ego screen-media PDF, locally rasterized with pypdfium2 at 96 dpi'});
}
for(const [w,h,s,left,right]of [[1920,1080,60,220,300],[1920,1080,80,300,460],[1330,900,75,220,300],[1330,900,100,460,300]]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
 await page.evaluate(({s,left,right})=>{setUiScale(s);document.getElementById('col-left').style.flexBasis=left+'px';document.getElementById('col-right').style.flexBasis=right+'px';switchTab('stats',document.querySelector('[onclick="switchTab(\'stats\', this)"]'));updateUI();},{s,left,right});
 await print(`effects-ability-${w}-${s}-${options.protocol}`,w,h,'#dt-str');
 await print(`effects-summary-${w}-${s}-${options.protocol}`,w,h,'#dt-buffs [data-effect-summary]');
}
await page.evaluate(()=>{setUiScale(80);document.getElementById('col-left').style.flexBasis='';document.getElementById('col-right').style.flexBasis='';gameLayout.reset();openPartyInspector('ally','2');});
await print('effects-ally-'+options.protocol,1330,900,'#party-inspector [data-ability-field="str"]');
await page.click('#party-tab-equipment');await print('effects-equipment-'+options.protocol,1330,900,'#party-details [data-equipment-slot="wpn"]');
await page.hover('#party-details [data-equipment-slot="wpn"]');reports.push({name:'equipment tooltip stays readable while the pointer rests on its slot',status:await page.evaluate(()=>document.querySelector('.game-tooltip[data-party-equipment]')?.style.display==='block')?'PASS':'FAIL'});
await page.keyboard.press('Escape');reports.push({name:'Escape closes equipment explanation before the party window',status:await page.evaluate(()=>document.querySelector('.game-tooltip[data-party-equipment]')?.style.display==='none'&&!document.getElementById('party-inspector').hidden)?'PASS':'FAIL'});
await fs.writeFile(options.artifacts+'/effect-details-visual-'+options.protocol+'.json',JSON.stringify({method:'Ego desktop visual bounds and screen-media PDF; PNGs generated locally',previews,reports},null,2));console.log({previews:previews.length,checks:reports.length,failed:reports.filter(r=>r.status==='FAIL')});if(reports.some(r=>r.status==='FAIL'))throw Error('Effect visual checks failed');
})();
