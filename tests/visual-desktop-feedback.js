(async()=>{
const fs=await import('node:fs/promises'),task=await taskSpace(options.space),page=task.page('p1'),previews=[],reports=[];
await page.evaluate(()=>{if(!window.__feedbackData)throw Error('desktop-feedback fixture required');});
await page.cdp('Emulation.setEmulatedMedia',{media:'screen'});
async function print(name,w,h){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const pdf=await page.cdp('Page.printToPDF',{printBackground:true,paperWidth:w/96,paperHeight:h/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1});await fs.mkdir(options.root+'/tmp/pdfs',{recursive:true});await fs.writeFile(options.root+'/tmp/pdfs/'+name+'.pdf',Buffer.from(pdf.data,'base64'));previews.push({file:name+'.png',width:w,height:h,scale:await page.evaluate(()=>Math.round(getUiScale()*100))});}
for(const [w,h,s]of [[1920,1080,60],[1920,1080,80],[1330,900,75],[1330,900,100]]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
 await page.evaluate(s=>{setUiScale(s);const a=player.allies[0];a._downed=true;a.curHp=0;a._reviveCd=80;const pet=petsOutList()[0];pet._downed=true;pet._reviveCd=30;player.statuses.stun=30;updateUI();renderSquadPanel();switchSquadTab('team');switchTab('automation',document.getElementById('btn-automation'));document.getElementById('tab-automation').scrollTop=0;},s);
 await print(`desktop-feedback-settings-${w}-${s}`,w,h);
 await page.evaluate(()=>document.getElementById('settings-tools').scrollIntoView({block:'end'}));await print(`desktop-feedback-tools-${w}-${s}`,w,h);
 await page.evaluate(()=>{switchTab('items',document.querySelector('[onclick="switchTab(\'items\', this)"]'));});await page.click('#tab-items [data-inventory-sort]');await print(`desktop-feedback-inventory-${w}-${s}`,w,h);

 await page.evaluate(()=>{const a=player.allies[0];a._downed=false;a.curHp=a.mhp;a.statuses={stun:30,poison:30};for(const pet of petsOutList()){pet._downed=false;pet.hp=pet.mhp;}renderSquadPanel();switchTab('stats',document.querySelector('[onclick="switchTab(\'stats\', this)"]'));});
 await page.hover('#dt-str');await print(`desktop-feedback-ability-${w}-${s}`,w,h);
 await page.evaluate(()=>switchTab('equip',document.querySelector('[onclick="switchTab(\'equip\', this)"]')));
 await print(`desktop-feedback-equipment-${w}-${s}`,w,h);
 await page.evaluate(()=>{switchTab('audit',document.querySelector('#col-right [onclick^="switchTab(\'audit\'"]'));_audit.start=Date.now()-10000;const p=petsOutList()[0],q=petsOutList()[1];_dpsReset();_dpsAddPet(_dpsPetSrc(p),9000);_dpsAddPet(_dpsPetSrc(q),13000);_dps.player=17000;renderAuditTab();});
 await print(`desktop-feedback-dps-${w}-${s}`,w,h);
}
reports.push({name:'desktop fixture has no runtime errors',status:await page.evaluate(()=>__errors.length===0)?'PASS':'FAIL'});
await fs.writeFile(options.artifacts+'/desktop-feedback-visual-'+options.protocol+'.json',JSON.stringify({method:'Ego screen-media PDF rasterized locally by pypdfium2 at 96 dpi',previews,reports},null,2));console.log({previews:previews.length,reports});if(reports.some(r=>r.status==='FAIL'))throw Error('Desktop visual fixture failed');
})();
