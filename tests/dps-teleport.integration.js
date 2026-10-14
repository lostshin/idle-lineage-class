// Failure cases: escape/despawn, same-slot replacement, reordering, healing,
// overkill/removal, damage before escape, repeated escapes, and phantom threat.
// Run native autoActions -> useItem -> doTeleport -> DPS in a synthetic Node VM.
// Browser UI and persisted player accounts are deliberately outside this harness.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const outDir = path.join(root, process.argv.includes('--record') ? 'tests/artifacts' : 'tmp/test-runs');
const controls = new Map();
const ctx = vm.createContext({
    console, Date, Math, setTimeout, clearTimeout, setInterval:()=>0, clearInterval:()=>{},
    document: {getElementById(id) {
        if (!controls.has(id)) controls.set(id, {checked:false, value:'0', classList:{contains:()=>true}});
        return controls.get(id);
    }},
    player: {cls:'mage', hp:100, mhp:100, mp:100, mmp:100, gold:0, buffs:{}, cds:{pot:0}, statuses:{}, skills:[], inv:[], eq:{}, d:{loadTier:2}},
    state: {ticks:10, ff:true, inTick:true},
    mapState: {current:'zone_1', mobs:[], spawnAt:[]},
    DB: {items:{scroll_teleport:{n:'瞬間移動卷軸',type:'scroll',eff:'teleport_scroll',p:100}},skills:{},mobs:{}},
    isSiegeArea:()=>false, saveSiegeBossHp:()=>{}, renderMobs:()=>{}, renderTabs:()=>{}, updateUI:()=>{},
    logSys:()=>{}, inAbsBarrier:()=>false, reqAllowsClass:()=>true,
    localStorage:{getItem:()=>null},
});
ctx.window = ctx;
for (const file of ['js/02-stats-recompute.js','js/03-combat-core.js','js/05-kill-progression.js','js/07-skills-cast.js','js/08-items-equip.js','js/32-threat.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}
// Stat recomputation is outside this damage-accounting integration boundary.
vm.runInContext('calcStats=()=>{};',ctx);
const reports=[];
function check(name,source) {
    try {
        const actual=vm.runInContext(source,ctx);
        if(actual!==true)throw Error(JSON.stringify(actual));
        reports.push({name,status:'PASS'});
    } catch(error) { reports.push({name,status:'FAIL',error:String(error)}); }
}
vm.runInContext(`
function fixture(hp=1000000) {
    _dpsReset();state.ticks=10;state.prideClimb=false;state.oblivion=false;state.riftRun=false;state.prideRanked=false;state.antharas=false;state._manualTpUntil=null;
    player.inv=[{id:'scroll_teleport',uid:'synthetic-scroll',cnt:30}];player.statuses={};player.hp=player.mhp;player.gold=0;
    document.getElementById('set-teleport').checked=true;
    mapState.current='zone_1';mapState.mobs=[{uid:'synthetic-boss',n:'合成頭目',boss:true,curHp:hp,hp,st:{}},null,null,null,null];mapState.targetIdx=0;
    return mapState.mobs[0];
}
function avoidPhase(){const s=_dpsSnap();autoActions();_dps.player+=_dpsDealt(s);}
`,ctx);
check('automatic boss avoidance consumes one native scroll but credits zero DPS',`(()=>{const boss=fixture();avoidPhase();return mapState.mobs.every(m=>!m)&&boss.curHp===1000000&&player.inv[0].cnt===29&&_dps.player===0||{hp:boss.curHp,scrolls:player.inv[0].cnt,dps:_dps.player};})()`);
check('twenty consecutive boss escapes cannot inflate player damage',`(()=>{fixture();for(let i=0;i<20;i++){mapState.mobs[0]={uid:'escape-'+i,boss:true,curHp:1000000+i};avoidPhase();}return _dps.player===0&&player.inv[0].cnt===10||_dps.player;})()`);
check('damage before teleport remains counted without adding remaining boss HP',`(()=>{const b=fixture(),s=_dpsSnap();b.curHp-=37;autoActions();return _dpsDealt(s)===37||_dpsDealt(s);})()`);
check('same-slot replacement is not damage even when the new UID is reused',`(()=>{fixture();const s=_dpsSnap();mapState.mobs[0]={uid:'synthetic-boss',curHp:10};return _dpsDealt(s)===0||_dpsDealt(s);})()`);
check('reordered living targets retain only their actual HP loss',`(()=>{const b=fixture(1000),other={uid:'second',curHp:200};mapState.mobs[1]=other;const s=_dpsSnap();b.curHp-=13;other.curHp-=7;mapState.mobs=[other,b];return _dpsDealt(s)===20||_dpsDealt(s);})()`);
check('a real overkill still counts only remaining HP after corpse removal',`(()=>{const b=fixture(41),s=_dpsSnap();b.curHp=-100;b._dead=true;mapState.mobs[0]=null;return _dpsDealt(s)===41||_dpsDealt(s);})()`);
check('damage to a newly spawned target is not attributed to an earlier snapshot',`(()=>{fixture();mapState.mobs=[];const s=_dpsSnap();mapState.mobs[0]={uid:'new',curHp:1};return _dpsDealt(s)===0;})()`);
check('healing is excluded from outgoing damage',`(()=>{const b=fixture(100),s=_dpsSnap();b.curHp+=20;return _dpsDealt(s)===0;})()`);
check('stunned automatic escape neither consumes a scroll nor invents damage',`(()=>{fixture();player.statuses.stun=10;avoidPhase();return !!mapState.mobs[0]&&player.inv[0].cnt===30&&_dps.player===0;})()`);
check('an escaped boss cannot give its replacement phantom player threat',`(()=>{fixture();const s=_dpsSnap();doTeleport(false);const m={uid:'replacement',curHp:1,boss:true};mapState.mobs[0]=m;threatCommitDiff(s,player);return !m._threat||Object.keys(m._threat).length===0||m._threat;})()`);
check('native same-target damage still creates real player threat',`(()=>{const b=fixture(1000),s=_dpsSnap();b.curHp-=50;threatCommitDiff(s,player);return b._threat?.P>0||b._threat;})()`);
const report={method:'Synthetic Node VM; native autoActions, useItem, doTeleport, DPS and threat modules; not browser E2E',reports};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'dps-teleport-'+(baseline?'baseline':'integration')+'.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!baseline&&reports.some(r=>r.status==='FAIL'))process.exitCode=1;
