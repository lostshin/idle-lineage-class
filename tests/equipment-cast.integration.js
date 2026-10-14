// Failure cases: successful/blocked casts, free/HP-only casts, automatic buff
// maintenance and sharing, wrong source, unsafe names, and false weight penalties.
// Native casting flows in synthetic storage; browser visual QA remains separate.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline'),logs=[];
const outDir=path.join(root,process.argv.includes('--record')?'tests/artifacts':'tmp/test-runs');fs.mkdirSync(outDir,{recursive:true});
const sk={n:'保護罩',type:'buff',mp:10,tier:1,dur:30,noRefresh:true};
const ctx=vm.createContext({console,Date,Math,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},window:{},document:{getElementById:()=>({value:'0',checked:false})},localStorage:{getItem:()=>null},DB:{skills:{sk_shield:sk,sk_teleport:{n:'傳送術',type:'manual',mEff:'teleport',mp:5,tier:1},sk_test_atk:{n:'合成攻擊技',type:'atk',mp:5}},items:{},mobs:{}},player:{name:'合成隊長',cls:'mage',lv:40,hp:100,mhp:100,mp:100,mmp:100,skills:['sk_shield','sk_teleport'],buffs:{},statuses:{},eq:{},cds:{},manualCd:{},allies:[],d:{getMpCost:n=>n,loadTier:0}},state:{ticks:10,inTick:true,ff:false},mapState:{current:'town_test',mobs:[]},TEAM_AURA_SKILLS:[],TEAM_SHARE_BUFFS:[],STORM_BUFF_SKILLS:[],logCombat:(msg,type,src)=>logs.push({msg,type,src}),logSys:()=>{},skillReqLv:()=>1,hasMastery:()=>false,isSupportSkill:s=>s.type==='buff'||s.type==='heal',castIntervalTicks:()=>10,nextCastCooldown:()=>10,saveSiegeBossHp:()=>{},isSiegeArea:()=>false,_combatSrc:null,_echoFree:false,_royalFreeCast:false,allyHasMastery:()=>false});ctx.window=ctx;
for(const file of ['js/02-stats-recompute.js','js/03-combat-core.js','js/04-combat-attack.js','js/05-kill-progression.js','js/06-status-allies.js','js/07-skills-cast.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
vm.runInContext('calcStats=()=>{};_allyLevelRecompute=()=>{};getTarget=()=>null;',ctx);
const common=fs.readFileSync(path.join(root,'js/01-drops-config.js'),'utf8');
const start=common.indexOf('function logSpellCast(');if(start>=0)vm.runInContext(common.slice(start,common.indexOf('function logCombat(',start)),ctx);
ctx.actionLogs=()=>logs.filter(x=>x.msg.includes('spell-cast-action'));
ctx.clearLogs=()=>{logs.length=0;};
vm.runInContext(`function allyFixture(){return {_allyName:'合成法師',cls:'mage',lv:40,curHp:80,mhp:100,mp:100,mmp:100,skills:['sk_shield'],config:{autoBuffSkills:{sk_shield:true}},statuses:{},buffs:{},eq:{},d:{getMpCost:n=>n,weightPct:98,loadTier:2},_atkSkill:'sk_test_atk'};}`,ctx);
const reports=[];
function check(name,source){try{ctx.clearLogs();const r=vm.runInContext(source,ctx);if(r!==true)throw Error(JSON.stringify(r));reports.push({name,status:'PASS'});}catch(e){reports.push({name,status:'FAIL',error:String(e)});}}
check('successful native player buff cast emits one player action',`(()=>{player.mp=100;player.buffs={};const r=castSkill('sk_shield');return r===true&&player.mp===90&&actionLogs().length===1&&actionLogs()[0].src==='cast'&&actionLogs()[0].msg.includes('data-cast-source="player"');})()`);
check('already maintained player buff is not a new cast',`(()=>{const before=player.mp;const r=castSkill('sk_shield');return r===false&&player.mp===before&&actionLogs().length===0;})()`);
check('insufficient player MP does not log a cast',`(()=>{player.mp=0;player.buffs={};return castSkill('sk_shield')===false&&actionLogs().length===0;})()`);
check('manual teleport logs one successful cast',`(()=>{player.mp=100;player.manualCd={};manualCast('sk_teleport');return player.mp===95&&actionLogs().length===1&&actionLogs()[0].src==='cast'&&actionLogs()[0].msg.includes('data-cast-source="player"');})()`);
check('manual cooldown does not invent a second cast',`(()=>{const before=player.mp;manualCast('sk_teleport');return player.mp===before&&actionLogs().length===0;})()`);
check('native ally self-buff maintenance logs once and spends normal MP',`(()=>{const a=allyFixture();allyMaintainBuffs(a);return a.mp===90&&a.buffs.sk_shield===30&&actionLogs().length===1&&actionLogs()[0].src==='cast'&&actionLogs()[0].msg.includes('data-cast-source="mercenary"');})()`);
check('active ally buff does not repeatedly log or spend MP',`(()=>{const a=allyFixture();a.buffs.sk_shield=10;allyMaintainBuffs(a);return a.mp===100&&actionLogs().length===0;})()`);
check('insufficient ally MP never produces a buff action',`(()=>{const a=allyFixture();a.mp=0;allyMaintainBuffs(a);return actionLogs().length===0&&!a.buffs.sk_shield;})()`);
check('successful ally attack gate logs one action',`(()=>{const a=allyFixture();return allyActWithSkillGate(a,()=>true)===true&&actionLogs().length===1&&actionLogs()[0].src==='cast'&&actionLogs()[0].msg.includes('data-cast-source="mercenary"');})()`);
check('failed attack gate and ordinary attacks are not casts',`(()=>{const a=allyFixture();allyActWithSkillGate(a,()=>false);a._atkSkill='';allyActWithSkillGate(a,()=>true);return actionLogs().length===0;})()`);
check('free casts still have explicit actor attribution and escaped text',`(()=>{logSpellCast({_allyName:'<img src=x onerror=bad>',eq:{}},{n:'零 MP <魔法>'});const r=actionLogs();return r.length===1&&r[0].src==='cast'&&r[0].msg.includes('data-cast-source="mercenary"')&&!r[0].msg.includes('<img')&&r[0].msg.includes('&lt;魔法&gt;');})()`);
// Load only the read-only equipment presentation functions, not its DOM lifecycle.
const ui=fs.readFileSync(path.join(root,'js/party-inspector.js'),'utf8'),weightStart=ui.indexOf('function partyEquipmentWeightHtml(');
if(weightStart>=0)vm.runInContext(ui.slice(weightStart,ui.indexOf('function partyEquipmentHtml(',weightStart)),ctx);
check('selected ally weight displays its own percentage and actual attack penalty',`(()=>{const a=allyFixture(),before=JSON.stringify(a);a.d.weightCurrent=980;a.d.weightLimit=1000;const saved=JSON.stringify(a);const html=partyEquipmentWeightHtml(a,'ally');return html.includes('98%')&&html.includes('980')&&html.includes((1000).toLocaleString())&&html.includes('×2')&&html.includes('不受負重限制')&&JSON.stringify(a)===saved;})()`);
check('weight thresholds describe ally effects without player-only penalties',`(()=>[0,49,50,81,82,99,100,145].every(pct=>{const tier=pct<50?0:pct<82?1:pct<100?2:3,html=partyEquipmentWeightHtml({d:{weightPct:pct,loadTier:tier}},'ally');return html.includes(pct+'%')&&(tier<2?!html.includes('×2')&&!html.includes('×3'):html.includes(tier===2?'×2':'×3'))&&!html.includes('停止施法');}))()`);
check('companions without native weight data do not show invented percentages',`(()=>partyEquipmentWeightHtml({eq:{}},'pet')==='')()`);
const result={method:'Synthetic Node VM: native castSkillInner, manualCast, allyMaintainBuffs, allyActWithSkillGate and read-only equipment presentation; render/stat recomputation stubbed',reports};
fs.writeFileSync(path.join(outDir,'equipment-cast-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks:reports.length,passed:reports.filter(r=>r.status==='PASS').length,failed:reports.filter(r=>r.status==='FAIL')},null,2));if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
