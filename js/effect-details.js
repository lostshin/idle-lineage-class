// One effect description and tooltip for the battle bar and companion details.
const EFFECT_STAT_NAMES = {str:'力量',dex:'敏捷',con:'體質',int:'智力',wis:'精神',cha:'魅力',ac:'防禦 AC',mr:'魔防 MR',dr:'固定減傷',er:'迴避 ER',hp:'HP 上限',mp:'MP 上限',mhp:'HP 上限',mmp:'MP 上限',meleeDmg:'近距離傷害',rangedDmg:'遠距離傷害',extraDmg:'額外傷害',meleeHit:'近距離命中',rangedHit:'遠距離命中',extraHit:'額外命中',magicDmg:'魔法傷害',magicHit:'魔法命中',extraMp:'魔法點數',hpR:'HP 恢復',mpR:'MP 恢復',resFire:'火屬性抗性',resWater:'水屬性抗性',resEarth:'地屬性抗性',resWind:'風屬性抗性',meleeCrit:'近距離爆擊',rangedCrit:'遠距離爆擊',magicCrit:'魔法爆擊',weightCap:'負重上限'};
const EFFECT_FLAG_NAMES = {immStone:'免疫石化',immPoison:'免疫中毒／麻痺',immSilence:'免疫沉默'};
const EFFECT_BASIC = {
    haste:{name:'加速',icon:'加速術',text:'攻擊速度 +33%、移動速度 +33%。相同加速效果不重複疊加，不改變施法間隔。'},
    brave:{name:'勇敢藥水',icon:'勇敢藥水',text:'攻擊速度 +33%、移動速度 +33%，與加速效果乘算疊加。'},
    cautious:{name:'慎重藥水',icon:'慎重藥水',text:'魔法傷害 +2、MP 恢復 +2；不改變普通攻擊或施法間隔。'},
    blue:{name:'藍色藥水',icon:'藍色藥水',text:'提高 MP 自然恢復，實際恢復受精神與負重影響。'},
    elfcookie:{name:'精靈餅乾',icon:'精靈餅乾',text:'攻擊速度 +15%、移動速度 +15%；風之疾走取代餅乾移速，攻速仍保留。'},
    poly:{name:'變身',icon:'變形術',text:'依目前變身形態調整攻擊、施法及移動速度；裝備套裝變身優先。'},
    'equip-haste':{name:'裝備加速',icon:'加速術',text:'由裝備提供攻擊速度 +33%、移動速度 +33%，不與同類加速重複疊加。'}
};
function effectInfo(id) {
    let key=id.startsWith('merc-')?id.slice(5):id;
    if(key==='shield')key='sk_shield';
    const sk=DB.skills[key],basic=EFFECT_BASIC[key];
    const icon=STATUS_ICON_SKILLS[key]||basic?.icon||PLAYER_DEBUFF_ICON[key];
    const lines=[];
    if(sk?.d && typeof sk.d==='object')for(const [key,label] of Object.entries(EFFECT_FLAG_NAMES))if(sk.d[key])lines.push(label);
    if(sk?.d && typeof sk.d==='object')for(const [k,v] of Object.entries(sk.d))if(typeof v==='number'&&v)lines.push((EFFECT_STAT_NAMES[k]||k)+' '+((k==='ac'?-v:v)>0?'+':'')+(k==='ac'?-v:v));
    if(sk?.desc)lines.push(sk.desc);if(typeof sk?.d==='string')lines.push(sk.d);
    if(sk?.haste)lines.push('攻擊速度 +33%、移動速度 +33%，相同加速不重複疊加。');
    if(key==='sk_set_dragonscion')lines.push('龍血套裝觸發的龍裔：承受傷害減少 15%，與其他百分比減傷乘算。');
    if(key==='sk_reduction_armor')lines.push('固定減傷增加 ⌊角色等級 ÷ 10⌋。');
    if(key==='sk_dragon_awaken_antares')lines.push('HP 上限增加 2 × 角色等級，免疫中毒與麻痺；覺醒攻速依精通生效。');
    if(key==='sk_dragon_awaken_falion')lines.push('魔防 MR ×1.15；覺醒攻速依精通生效。');
    if(sk?.moveSpeedMult)lines.push('移動速度 ×'+sk.moveSpeedMult);
    if(sk?.dmgTakenReduce)lines.push('承受傷害減少 '+sk.dmgTakenReduce+'%');
    if(sk?.dur)lines.push('標準持續時間 '+sk.dur+' 秒');
    if(sk?.type==='heal'){if(sk.groupHeal)lines.push('作用於目前有效的全隊治療對象。');if(sk.healBase)lines.push('基礎恢復 '+sk.healBase+' HP');}
    if(basic?.text)lines.push(basic.text);
    const status={disease:'防禦 AC +8，更容易被命中。',weaken:'降低近距離攻擊傷害。',poison:'持續受到中毒傷害。',silence:'無法施放魔法。',stun:'暫時無法行動。',freeze:'暫時無法行動。',stone:'石化，暫時無法行動。',potionFrost:'受到藥水霜化，藥水使用受到限制。',foulWater:'受到的治癒效果減半。',blind:'視線受到限制。',magicseal:'魔法受到封印。'};
    if(status[key])lines.push(status[key]);
    if(PET_LURES[key])lines.push('期間擊敗對應動物，可依誘捕規則捕獲寵物。');
    return {id,name:sk?.n||basic?.name||PLAYER_DEBUFF_NAME[key]||PET_LURES[key]?.n||BUFF_NAMES[key]||'其他狀態',icon,lines};
}
function effectIconHtml(id,seconds,source='自身',type='buff') {
    const e=effectInfo(id),name=e.name,time=seconds==null?'常駐':Math.ceil(seconds)+' 秒';
    const image=e.icon?'<img src="'+statusIconUrl(id,e.icon)+'" alt="'+partyEscape(name)+'" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>'+partyEscape(name)+'</span>':'<span>'+partyEscape(name)+'</span>';
    return '<button type="button" class="effect-icon'+(seconds!=null&&seconds<=10?' effect-expiring':'')+'" data-'+type+'="'+partyEscape(id)+'" data-effect-id="'+partyEscape(id)+'" data-effect-seconds="'+(seconds==null?'':seconds)+'" data-effect-source="'+partyEscape(source)+'" aria-label="'+partyEscape(name)+' '+time+'">'+image+'<small>'+time+'</small></button>';
}
(function(){
    const tip=document.createElement('div');tip.id='effect-tooltip';tip.className='game-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
    let target=null,role=null,actorAtOpen=null,closeTimer=null;
    function hide(){clearTimeout(closeTimer);tip.hidden=true;if(target)target.removeAttribute('aria-describedby');target=null;role=null;}
    function render(){
        if(!target?.isConnected||!target.getClientRects().length||role!==player){hide();return;}
        const context=effectTargetContext(target);if(!context){hide();return;}
        const {actor,kind,owner}=context;if(actorAtOpen&&actorAtOpen!==actor){hide();return;}
        let name,source,lines,sec;
        if(target.dataset.addonEffect){name=target.textContent;source='追蹤／地圖設定';lines=[target.title||'依目前地圖與設定生效。'];sec=target.dataset.addonEffect==='tracking'?Math.max(0,((player.tracking?.until||0)-Date.now())/1000):null;}
        else if(target.hasAttribute('data-effect-summary')){const s=effectDetailsSnapshot(actor,kind,owner);name='狀態：其他效益';source='目前生效的規則與條件';lines=s.summary.concat(s.entries.filter(e=>e.id.startsWith('equip:')||e.id.startsWith('remains:')).flatMap(e=>e.lines.map(l=>e.name+'：'+l)));}
        else if(target.dataset.effectKey){
            const s=effectDetailsSnapshot(actor,kind,owner),e=s.entries.find(e=>e.id===target.dataset.effectKey);if(!e){hide();return;}
            name=e.name;source=e.source;lines=e.lines;sec=effectRemaining(e,actor);
        }else{const e=effectInfo(target.dataset.effectId);name=e.name;source=target.dataset.effectSource||'自身';lines=e.lines;sec=target.dataset.effectSeconds===''?null:Number(target.dataset.effectSeconds);}
        const text=[name,source+(sec==null?'': ' · 剩餘 '+Math.ceil(sec)+' 秒'),...lines].join('\n');
        if(tip.textContent!==text)tip.textContent=text;
        tip.hidden=false;target.setAttribute('aria-describedby',tip.id);
        const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight,r=target.getBoundingClientRect();
        tip.style.maxWidth=screenToUiPx(Math.min(430,width-24));tip.style.maxHeight=screenToUiPx(height-24);
        const b=tip.getBoundingClientRect();tip.style.left=screenToUiPx(Math.max(8,Math.min(r.left,width-b.width-8)));tip.style.top=screenToUiPx(Math.max(8,Math.min(r.bottom+8,height-b.height-8)));
    }
    function open(event){const node=event.target.closest('[data-effect-id],[data-effect-key],[data-effect-summary],[data-addon-effect]');if(!node)return;clearTimeout(closeTimer);target=node;role=player;actorAtOpen=effectTargetContext(node)?.actor;render();}
    document.addEventListener('mouseover',open);document.addEventListener('focusin',open);document.addEventListener('click',event=>{if(event.target.closest('[data-effect-id],[data-effect-key],[data-effect-summary],[data-addon-effect]'))open(event);else if(!tip.contains(event.target))hide();});
    document.addEventListener('mouseout',event=>{if(target&&!target.contains(event.relatedTarget)&&!tip.contains(event.relatedTarget))closeTimer=setTimeout(hide,180);});
    document.addEventListener('focusout',event=>{if(target&&!target.contains(event.relatedTarget)&&!tip.contains(event.relatedTarget))closeTimer=setTimeout(hide,180);});
    tip.addEventListener('mouseenter',()=>clearTimeout(closeTimer));tip.addEventListener('mouseleave',()=>{closeTimer=setTimeout(hide,180);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!tip.hidden){event.preventDefault();hide();}else if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-effect-key],[data-effect-summary]')){event.preventDefault();open(event);}});
    document.addEventListener('scroll',event=>{if(target&&!tip.contains(event.target))render();},true);setInterval(()=>{if(target)render();},250);
})();
function effectTargetContext(node) {
    const panel=node.closest('#party-inspector');
    if(!panel)return {actor:player,kind:'player',owner:player};
    const kind=panel.dataset.kind,actor=partyMemberById(kind,panel.dataset.id);
    if(!actor)return null;
    return {actor,kind,owner:kind==='merc-summon'?(player.allies||[]).find(a=>String(a._slot)===panel.dataset.id)||player:actor._necroSkeleton?_necroOwnerByKey(actor._necroOwnerKey)||player:player};
}
function effectRemaining(entry,actor) {
    if(entry.id.startsWith('hot:')){const h=player.hots?.[entry.id.slice(4)];return h?Math.max(0,((h.ticksLeft-1)*(h.interval||0)+(h.cd||0))/10):0;}
    if(entry.id.startsWith('runtime:'))return Math.max(0,(actor[entry.id.slice(8)]-state.ticks)/10);
    if(entry.id.startsWith('buff:'))return actor.buffs?.[entry.id.slice(5)]||0;
    if(entry.id.startsWith('status:'))return (_supStatuses(actor)?.[entry.id.slice(7)]||0)/10;
    if(entry.id.startsWith('aura:'))return Math.max(0,...[player,...(player.allies||[])].filter(a=>a&&a!==actor&&!a._downed&&!a.dead).map(a=>a.buffs?.[entry.skill]||0));
    return entry.seconds;
}
// Recompute isolated copies: the live actor, timers and shared progress stay untouched.
function effectActorCopy(value, seen = new WeakMap()) {
    if (typeof value === 'function') return undefined;
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const copy = Array.isArray(value) ? [] : {}; seen.set(value, copy);
    for (const [key, item] of Object.entries(value)) { const next = effectActorCopy(item, seen); if (next !== undefined) copy[key] = next; }
    return copy;
}
function effectPreviewActor(actor) {
    // Preview formulas only read inventory; allies and collections are supplied below.
    const {inv,allies,cardDex,equipDex,miscDex,relicDex,...fields}=actor;
    return {...effectActorCopy(fields),inv:inv||[],allies:[],cardDex,equipDex,miscDex,relicDex};
}
function partyAbilityStats(actor, stats) {
    const result={...stats,rawEr:stats.er||0,er:effResistPct(stats.er||0),aspd:Math.max(.1,stats.aspd||.1),
        potionBonus:getConPotionPct(stats.con||0)+(DB.items[actor.eq?.doll?.id]?.potionBonus||0),
        mpKillInterval:wisMpRegenIntervalTicks(stats.wis||0)/10};
    const root=player;
    try {player=actor;result.moveSpeedPct=playerEffectiveMoveSpeedPct();}
    finally {player=root;}
    return result;
}
const EFFECT_STAGES = ['基礎','常駐','裝備','套裝','血盟','藥水／變身','魔法','狀態修正'];
const effectSnapshotCache = new WeakMap();
function effectBuffStage(id,actor) {
    if(id==='sk_set_dragonscion')return 7;
    if(DB.skills[id]||id==='haste'&&Object.keys(actor?.buffs||{}).some(k=>actor.buffs[k]>0&&DB.skills[k]?.haste))return 6;
    return EFFECT_BASIC[id]||PET_LURES[id]?5:7;
}
function effectActiveKeys(values) { return Object.keys(values||{}).filter(k=>values[k]>0).sort(); }
function effectConditionKey(actor) {
    const hp=actor.curHp??actor.hp??0,max=actor.mhp||1,mp=actor.mp||0,items=Object.values(actor.eq||{}).map(e=>DB.items[e?.id]).filter(Boolean);
    const has=key=>items.some(d=>d[key]);
    return [has('fullHpMpHalf')?hp>=max:null,has('lowHpPotionX2')?hp<max*.2:null,
        actor.mastery==='k_tough'?hp<max*.4:null,actor._setDragonblood2?hp<max*.5:null,
        has('lowMpRegenBonus')?mp<(actor.mmp||1)*.15:null,actor._setApprentice5?mp<(actor.mmp||1)*.3:null,
        actor._setFury5?Math.min(5,Math.floor((1-hp/max)*10+1e-9)):null,
        ...items.filter(d=>d.critDmgLowHp).map(d=>hp<d.critDmgLowHp.hp)];
}
function effectSignature(actor,kind,owner=player) {
    const timers=a=>Object.entries(a).filter(([k,v])=>/Until$/.test(k)&&typeof v==='number').map(([k,v])=>[k,v>state.ticks]);
    const team=[player,...(player.allies||[])].filter(Boolean);
    return JSON.stringify([kind,kind==='ally'?actor.d:null,actor.base,actor.alloc,actor.panacea,actor.lv,actor.cls,actor.avatar,actor.mastery,actor.skills,actor.eq,
        player.cardDex,player.equipDex,player.miscDex,actor.antharasHelpers,actor.poly,actor.classicMode,actor.elfEle,actor.config,actor.alignmentValue,actor.form,actor.mhp,actor.mmp,actor.potPct,
        actor._mercPermanentPotions,actor.dead,actor._downed,effectActiveKeys(actor.buffs),effectActiveKeys(_supStatuses(actor)),
        Object.keys(player.hots||{}).filter(k=>player.hots[k]?.ticksLeft>0),effectConditionKey(actor),timers(actor),actor._darkEvadeStack,actor._spellbladeTier,actor._spellbladeEle,actor.statuses?.armorBreakPct,actor._autoBuff,actor._hardSkinPool>0,actor._cleaveTicks>0,actor._fangFuryTicks>0,actor._crushFuryTicks>0,
        clanBuffSnapshot(actor),mapState.current,owner?.eq,team.map(a=>[accountRoleId(a),a.eq,a.lv,a.mastery,a.dead,a._downed,effectActiveKeys(a.buffs),a.cubes,a.config])]);
}
function effectPreview(actor,kind,owner=player,stage=7,omit=null,clan=clanBuffSnapshot(actor)) {
    const root=player,flag=_recomputingAlly,minion=kind!=='ally'&&kind!=='player';
    const copy=effectPreviewActor(actor),leader=minion?effectPreviewActor(root):null;
    const others=[root,...(root.allies||[])].filter(a=>a&&a!==actor).map(a=>effectPreviewActor(a));
    for(const a of [copy,...others]) {
        for(const [id,sourceStage]of Object.keys(a.buffs||{}).map(id=>[id,effectBuffStage(id,a)]))if(stage<sourceStage)delete a.buffs[id];
        if(stage<7){a.statuses={};a._statuses={};a.hots={};for(const k of Object.keys(a))if(/Until$/.test(k))a[k]=0;a._crushFuryTicks=0;a._fangFuryTicks=0;a._darkEvadeStack=0;}
    }
    if(stage<5){copy._mercPermanentPotions=false;copy.poly=null;}
    copy._setPoly=null;
    for(const key of ['cardDex','equipDex','miscDex','relicDex'])copy[key]=stage<1?{}:effectActorCopy(root[key]||{});
    if(stage<1){copy.mastery=null;copy.skills=[];copy.grantedSkills=[];copy.antharasHelpers=null;}
    if(stage<2)copy.eq={};
    copy.allies=others;
    if(omit)omit(copy,others);
    try {
        player=copy;_recomputingAlly=kind==='ally';
        let d;
        if(!minion) {
            // The second pass resolves equipment morph-dependent attributes using the same native formulas.
            recomputeStats(stage>=4?clan?.stats||null:null,{readonly:true,sets:stage>=3,omitSet:copy._effectOmitSet});
            recomputeStats(stage>=4?clan?.stats||null:null,{readonly:true,sets:stage>=3,omitSet:copy._effectOmitSet});
            if(kind==='ally'&&stage>=1)_applyMercCubeRes(copy);
            if(stage<7){copy.hp=copy.mhp;if(copy.curHp!=null)copy.curHp=copy.mhp;copy.mp=copy.mmp;}
            d={...copy.d,mhp:copy.mhp,mmp:copy.mmp};
            if(kind==='ally'&&stage>=6){const aura=teamIlluAura(copy);if(aura){d.extraDmg+=aura.ed||0;d.extraHit+=aura.eh||0;d.magicDmg+=aura.md||0;d.meleeDmg+=aura.mel||0;}}
            d.castSeconds=castIntervalTicks(copy,false)/10;
            d=partyAbilityStats(copy,d);
            if(kind==='ally'){d.aspd=allyAttackIntervalTicks(copy,stage>=7?_supStatuses(copy):null)/10;d.aspdOff=allyOffhandIntervalTicks(copy,stage>=7?_supStatuses(copy):null)/10;delete d.moveSpeedPct;}
            if(kind==='player'){
                d.aspd=playerAttackIntervalTicks(stage>=7)/10;d.aspdOff=playerOffhandIntervalTicks(stage>=7)/10;
                d.potionBonus=getConPotionPct(d.con||0)+dollFieldVal('potionBonus')+playerEquipPotionBonusPct()+(copy._miscPotionBonus||0);
            }
        } else {
            leader.buffs=stage>=6?leader.buffs:{};leader.allies=others.filter(a=>accountRoleId(a)!==accountRoleId(root));
            for(const key of ['cardDex','equipDex','miscDex','relicDex'])leader[key]=effectActorCopy(root[key]||{});
            player=leader;
            d=kind==='pet'?petDerive(copy):kind==='guard'?guardDerive(copy):_sumDeriveAny(copy,effectPreviewActor(owner));
            d={...d,mhp:_supMhp(copy),mmp:(copy.mmp||0)+(d?.mmpBonus||0)};
            if(typeof d.er==='number'){d.rawEr=d.er;d.er=effResistPct(d.er);}
            if(kind==='pet'){
                const gear=petGearBonus(copy),charm=petCharmCombatBonus(),aura=teamIlluAura(copy,true),statuses=_supStatuses(copy)||{};
                d.petGearDmg=gear.dmg;d.petGearHit=gear.hit;d.petCharmDmg=charm.dmg;d.petCharmHit=charm.hit;
                d.petAuraDmg=(aura?.ed||0)+(aura?.mel||0);d.petAuraHit=aura?.eh||0;d.petAuraMagicDmg=aura?.md||0;
                d.petPartnerHit=typeof _relicPartnerHit==='function'?_relicPartnerHit(copy.form):0;
                d.petStatusDmg=(petDevotionGuardOn(copy)?8:0)-(statuses.weaken>0?5:0);
                d.petStatusHit=-(statuses.weaken>0?2:0)-(statuses.disease>0?4:0)-(statuses.blind>0?6:0);
                d.petTakenMult=petMasteryTakenMult()*petArmorDmgReduceMult(copy)*(petDevotionGuardOn(copy)?0:1);
            }
        }
        d.ac=(d.ac||0)-(stage>=6?teamAcBonus(copy,minion):0)+(stage>=7&&(kind==='player'||kind==='ally'||kind==='pet')&&(_supStatuses(copy)?.disease||0)>0?8:0);
        if(!minion){d.finalDamageMult=kind==='ally'?allyRlFuryMult(copy):rlFuryMult();d.threatMult=computeThreatMult(copy);}
        d.damageReductionPct=(1-teamDmgReduceMult(minion)*(minion?1:avatarSelfDmgReduceMult(copy))*(minion?1:allyBuffDmgReduceMult(copy))*(copy._setIron3 ? .8 : 1)*(kind==='pet'?d.petTakenMult:1))*100;
        return {stats:d,actor:copy};
    } finally {player=root;_recomputingAlly=flag;}
}
function effectDelta(total,base={}) {
    const delta={};for(const [key,value]of Object.entries(total))if(typeof value==='number')delta[key]=value-(Number(base[key])||0);
    return delta;
}
function effectDetailsSnapshot(actor,kind,owner=player) {
    const signature=effectSignature(actor,kind,owner),cached=effectSnapshotCache.get(actor);
    if(cached?.signature===signature)return cached.snapshot;
    const stages=[];let previous={},calculated=null;
    for(let i=0;i<EFFECT_STAGES.length;i++){
        const preview=effectPreview(actor,kind,owner,i);
        if(i===7){calculated=preview.stats;if(kind==='ally'&&actor.d){const live=partyAbilityStats(actor,actor.d);preview.stats={...preview.stats,...live,mhp:actor.mhp,mmp:actor.mmp,ac:(actor.d.ac||0)-teamAcBonus(actor)+((_supStatuses(actor)?.disease||0)>0?8:0),aspd:allyAttackIntervalTicks(actor,_supStatuses(actor))/10,aspdOff:allyOffhandIntervalTicks(actor,_supStatuses(actor))/10,castSeconds:castIntervalTicks(actor,false)/10};delete preview.stats.moveSpeedPct;const aura=teamIlluAura(actor);if(aura){preview.stats.extraDmg+=aura.ed||0;preview.stats.extraHit+=aura.eh||0;preview.stats.magicDmg+=aura.md||0;preview.stats.meleeDmg+=aura.mel||0;}}}
        stages.push({name:EFFECT_STAGES[i],total:preview.stats,delta:effectDelta(preview.stats,previous)});previous=preview.stats;
    }
    const snapshot={kind,stages,total:previous,calculated,base:stages[0].total,delta:effectDelta(previous,stages[0].total),clanBuff:kind==='player'||kind==='ally'?clanBuffSnapshot(actor):null};
    snapshot.recovery=effectRecovery(actor,kind,previous);
    snapshot.summary=effectSummary(actor,kind,snapshot);
    snapshot.entries=effectEntries(actor,kind,owner,snapshot);
    effectSnapshotCache.set(actor,{signature,snapshot});return snapshot;
}
function partyBonusSnapshot(actor,kind,owner=player,omit=null,clanBuff=clanBuffSnapshot(actor)) {
    if(!omit&&clanBuff?.name===clanBuffSnapshot(actor)?.name)return effectDetailsSnapshot(actor,kind,owner);
    const calculated=effectPreview(actor,kind,owner,7,omit,clanBuff).stats;
    return {kind,total:calculated,calculated,base:calculated,delta:{},clanBuff};
}
function effectNumber(value) { return String(Math.round((Number(value)||0)*100)/100); }
function effectRecovery(actor,kind,d) {
    const minion=kind!=='player'&&kind!=='ally';
    if(minion)return kind==='pet'?{hpInterval:safeZoneRegenInterval(50)/10,mpInterval:safeZoneRegenInterval(50)/10,hp:PET_BOOK[actor.form]?.hpReg||0,mp:(PET_BOOK[actor.form]?.mpReg||0)+(d.mpRegBonus||0)}:{hpInterval:null,mpInterval:null};
    const free=Object.entries(actor.buffs||{}).some(([id,t])=>t>0&&DB.skills[id]?.loadFreeRegen);
    const barrier=kind==='player'&&(actor.buffs?.sk_abs_barrier||0)>0;
    let hpTicks=kind==='ally'?160:Math.max(30,160-10*(d.hpRegenFaster||0));
    if(actor.buffs?.sk_heal_energy_storm>0)hpTicks=Math.min(hpTicks,DB.skills.sk_heal_energy_storm.hpRegenIv||30);
    const blocked=barrier||kind==='player'&&!free&&(d.loadTier||0)>=1;
    const floor=kind==='ally'?1:0,flat=Number(d.hpR)||0,max=Number(d.hpRegenMax)||0;
    return {hpInterval:safeZoneRegenInterval(hpTicks)/10,mpInterval:safeZoneRegenInterval(wisMpRegenIntervalTicks(d.wis||0))/10,
        hpMin:blocked||kind==='player'&&actor.buffs?.sk_berserk>0?0:Math.max(floor,flat+(max>0?1:0)),
        hpMax:blocked||kind==='player'&&actor.buffs?.sk_berserk>0?0:Math.max(floor,flat+max),
        mp:blocked?0:Math.max(0,(d.mpR||0)+(kind==='player'&&actor.mp<(actor.mmp||1)*.15?(d.lowMpRegenBonus||0):0)),blocked};
}
function effectSummary(actor,kind,snapshot) {
    const d=snapshot.total,r=snapshot.recovery,lines=[];
    if(kind==='player'||kind==='ally') {
        lines.push('HP 自然恢復：'+effectNumber(r.hpMin)+'～'+effectNumber(r.hpMax)+' HP／'+effectNumber(r.hpInterval)+' 秒；MP 自然恢復：'+effectNumber(r.mp)+' MP／'+effectNumber(r.mpInterval)+' 秒。');
        lines.push(kind==='ally'?'隊友自然恢復與施法不受負重限制；HP 每次至少恢復 1，低 MP 裝備加成與主角快速再生間隔不套用。':'負重 ≥50% 停止 HP／MP 自然恢復；具負重恢復技能時例外。狂暴術停止 HP 恢復，絕對屏障停止兩者。');
        lines.push('村莊恢復間隔縮為 2／3，依 tick 取整；恢復量不變。');
        const divisor=actor.cls==='knight'?2:['elf','dark','dragon','warrior'].includes(actor.cls)?3:actor.cls==='illusion'?4:5;
        const disease=(_supStatuses(actor)?.disease||0)>0?8:0,acMax=Math.max(0,Math.floor((10-d.ac+disease)/divisor));
        lines.push('固定減傷：'+effectNumber(d.dr)+'；AC 隨機減傷：'+Math.floor(acMax/3)+'～'+acMax+'（一般物理受擊）。百分比減傷與種族／重擊條件另計。');
        const shield=DB.items[actor.eq?.shield?.id],pair=actor.eq?.wpn?.id==='relic_bk_lance'&&actor.eq?.shield?.id==='relic_guard_towershield';
        if(shield&&(pair||!actor.classicMode)){const rate=pair?100:(shield.block||0);if(rate)lines.push('盾牌格檔：重擊 '+effectNumber(rate)+'%／一般 '+effectNumber(pair?100:rate*.3)+'%；成功時該次物理傷害減半。');}
        if(shield?.dmgReduceProc){const p=shield.dmgReduceProc;lines.push('盾牌受傷減免：'+effectNumber((p.rate||0)+(p.per||0)*(actor.eq.shield.en||0))+'% 機率減少 '+(p.amt||50)+' 點（物理／魔法）。');}
        if(d.crushDr)lines.push('受重擊傷害減少 '+Math.min(80,d.crushDr)+'%（上限 80%，乘算）。');
        if(d.physDrGated)lines.push('物理受擊傷害減少 '+Math.min(90,d.physDrGated)+'%（上限 90%，每 3 秒一次；與其他減傷乘算）。');
        lines.push('主手攻擊間隔：'+effectNumber(d.aspd)+' 秒'+(d.aspdOff? '；副手：'+effectNumber(d.aspdOff)+' 秒':'')+'；施法間隔：'+effectNumber(d.castSeconds)+' 秒；受擊硬直：'+effectNumber((d.hitstun||0)/10)+' 秒。');
        lines.push('負重 '+effectNumber(d.weightPct)+'%；82～99% 普攻間隔 ×2，100%↑ ×3。'+(kind==='player'?'負重 ≥82% 時施法另受原生限制。':''));
        lines.push('智力 SP '+getIntExtraMp(d.int||0)+' → 有效 '+magicIntSp(d)+'；其他 SP '+magicItemSp(d)+'；有效 SP 合計 '+(magicIntSp(d)+magicItemSp(d))+'。');
        lines.push('最終增傷倍率 ×'+effectNumber(d.finalDamageMult)+'（紅獅／狂怒；不含技能限定或敵人條件）；常態百分比減傷 '+effectNumber(d.damageReductionPct)+'%。');
        lines.push('迴避 ER：原始 '+effectNumber(d.rawEr)+' → 有效 '+effectNumber(d.er)+'%；仇恨累積倍率 ×'+effectNumber(d.threatMult)+'（職業×武器；非敵人選擇機率）。');
        lines.push('命中欄為命中加值；傷害欄為傷害加值。實際命中／傷害另依敵人 AC、MR、種族、大小與屬性計算。');
        lines.push('耗魔：先依減耗 '+effectNumber(d.mpReduce)+'% 向上取整、最低 1；'+(actor._setApprentice5?'MP<30% 時學徒套裝減半，再向上取整；':'')+(d.fullHpMpHalf?'滿血時裝備減半，再向上取整；':'')+(actor.mastery==='i_mana'?'魔力精通 ×2；':'')+(kind==='ally'?'攻擊技依各自路徑；學徒折扣僅 getMpCost 路徑套用。':'其餘技能／裝備專屬條件依技能判斷。'));
        const hp=actor.curHp??actor.hp??0;
        if(kind==='player'){if(actor.mastery==='k_survive')lines.push('生存精通：喝藥恢復 ×1.25，逐步向下取整。');if(actor.mastery==='k_dragonblood')lines.push('龍血精通：喝藥恢復 ×1.15。');if(actor.mastery==='k_tough')lines.push('堅韌精通：HP<40% 時喝藥恢復 ×1.5（目前'+(hp<actor.mhp*.4?'生效':'未達門檻')+'）。');}
        if((_supStatuses(actor)?.potionFrost||0)>0)lines.push('藥水霜化：藥水恢復 ×0.5；最低 1。');
        if(foulWaterHealMult(actor)<1)lines.push('汙濁之水：藥水與治癒技能恢復 ×0.5。');
        lines.push('治癒技能：智力影響骰數（目前修正 '+classicHealMagicBonus(d)+'）；團體治癒武器倍率 ×'+healingSpellCasterMult({groupHeal:true},actor)+'，正義治癒另依施法者性向。');
        lines.push('喝藥：'+(kind==='player'?'體質、娃娃、裝備與道具圖鑑恢復量加成 '+effectNumber(d.potionBonus)+'%；HP<20% 的急救裝備另乘 2。':'隊友自動喝藥使用自身體質＋娃娃加成 '+effectNumber(d.potionBonus)+'%，不套主角精通、一般裝備或圖鑑喝藥倍率。')+'治癒倍率與汙濁之水另計。');
    } else {
        lines.push('夥伴數據取自身原生推導；不套主角負重、配點、施法減耗或喝藥倍率。');
        lines.push('原生普攻骰值：1D'+effectNumber(d.dice)+'＋'+effectNumber(d.flat)+'；原生命中加值 '+effectNumber(d.hit)+'。實際命中與傷害另依敵人條件計算。');
        lines.push('原生攻擊間隔：'+effectNumber((kind==='pet'?d.atkItv:d.aspd)/10)+' 秒'+(kind==='pet'? '；技能間隔：'+effectNumber((d.castItv||0)/10)+' 秒；受擊硬直：'+effectNumber((d.stunTicks||0)/10)+' 秒。':'。'));
        lines.push('傷害倍率 ×'+effectNumber((d.damageMult||d.dmgMult||1)*(d.attackMult||1))+'；固定減傷 '+effectNumber(d.dr)+'；有效迴避 '+effectNumber(d.er)+'%；百分比減傷 '+effectNumber(d.damageReductionPct)+'%。持續傷害依各自路徑另計。');
        if(kind==='pet'){lines.push('自身武器與隊伍裝備：傷害加值 +'+effectNumber(d.petGearDmg)+'、命中加值 +'+effectNumber(d.petGearHit)+'；隊長魅力：傷害 +'+effectNumber(d.petCharmDmg)+'、命中 +'+effectNumber(d.petCharmHit)+'；技能固定加值 '+effectNumber(d.skillFlat)+'。');lines.push('寵物自然恢復量：HP '+effectNumber(r.hp)+'／MP '+effectNumber(r.mp)+'。');}
        if(kind==='pet')lines.push('HP／MP 自然恢復每 '+effectNumber(r.hpInterval)+' 秒判斷；喝藥依自身 potPct，消耗隊長補給，套隊長體質加成 '+getConPotionPct(player.d.con||0)+'%，不套娃娃／裝備／圖鑑／精通倍率。');
    }
    for(const key of ['resNone','resFire','resWater','resWind','resEarth'])if(typeof d[key]==='number')lines.push((EFFECT_STAT_NAMES[key]||'無屬性抗性')+'：原始 '+effectNumber(d[key])+' → 有效抗性 '+effectNumber(effResistPct(d[key]))+'%（'+(key==='resNone'?'僅無屬性魔法傷害':'對應屬性傷害')+'）。');
    for(const [key,name]of Object.entries(EFFECT_FLAG_NAMES))if(d[key])lines.push(name+'；僅攔截原生支援此免疫的異常路徑。');
    if(kind==='player'||kind==='ally') {
        const resist={stun:'暈眩',freeze:'冰凍',paralyze:'麻痺',sleep:'睡眠',slow:'緩速',poison:'中毒',burn:'灼燒',blind:'闇盲'};
        for(const [key,name]of Object.entries(resist)){
            const cap=key[0].toUpperCase()+key.slice(1);let raw=key==='stun'&&actor.skills?.includes('sk_royal_kingguard')?20:0,immune=false;
            for(const slot of WEIGHT_COUNT_SLOTS){const e=DB.items[actor.eq?.[slot]?.id];if(e){raw+=((['burn','blind'].includes(key)?0:e[key+'Resist'])||0)+(e.abnormalResist||0);immune=immune||!!e['imm'+cap];}}
            if(key==='poison'&&d.immPoison)immune=true;
            if(raw||immune)lines.push(name+'抵抗：原始 '+raw+' → '+(immune?100:Math.min(100,raw))+'%'+(immune?'（裝備免疫）':'')+'；不影響未經異常抵抗判定的傷害。');
        }
    }
    return lines;
}
const EFFECT_SET_THRESHOLDS={leather:4,bone:3,dk:4,silver:4,oasis:4,gnome:3,mage:2,kurt:4,steel:5,mr:3,guard:3,kinglord:4,demon:4,darkelf:3,orin:2,icequeen_charm:3,frost:3,bluepirate:4,emperor:5,priest:5};
// Direct bonuses verified against the early-attribute and flat set stages in recomputeStats.
// Derived differences remain available through abilitySourceDetails.
const EFFECT_SET_LINES={
    leather:['四件套裝：AC－3'],bone:['三件套裝：AC－2、HP＋10'],
    dk:['四件套裝：AC－4、變身真‧死亡騎士'],silver:['四件套裝：AC－3'],
    oasis:['四件套裝：AC－3'],gnome:['三件套裝：AC－1、HP＋5'],
    mage:['兩件套裝：MP＋50、MP 恢復＋1'],kurt:['四件套裝：AC－4、變身真‧克特'],
    steel:['五件套裝：AC－2、固定減傷＋2'],mr:['三件套裝：MR＋5'],guard:['三件套裝：AC－1'],
    kinglord:['四件套裝：魅力＋3、HP／MP 各＋30、HP／MP 恢復各＋10'],
    demon:['四件套裝：AC－2、HP 恢復＋5、變身惡魔'],
    darkelf:['三件套裝：力量－2、敏捷＋2、AC－3、HP 恢復－2、MP 恢復－7、變身高等黑暗精靈'],
    orin:['兩件套裝：六項屬性各＋1、AC－5、HP＋50'],
    icequeen_charm:['三件套裝：力量／魅力各＋2、AC－5、HP＋100、MP 恢復＋4、水屬性抗性＋20'],
    frost:['三件套裝：體質＋3、AC－5、HP＋100、HP 恢復＋8、MP 恢復＋4、MR＋15、水屬性抗性＋20'],
    bluepirate:['四件套裝：智力＋1、AC－1、HP＋10'],
    emperor:['五件套裝：AC－20、HP＋100、MP＋20、HP 恢復＋10、攻擊速度＋30%、近／遠距離傷害各＋5'],
    priest:['五件套裝：AC－50、MR＋50、HP＋300、MP 恢復＋30、近／遠／魔法爆擊率各＋5%、近／遠／魔法爆擊傷害各＋50%']
};
function effectSetName(code) {
    const extra={orin:'歐林西瑪套裝',icequeen_charm:'冰之女王魅力套裝',frost:'寒冰套裝',bluepirate:'藍海賊套裝',emperor:'真．冥皇套裝',priest:'司祭苦行套裝'};
    return Object.values(DB.sets).find(s=>s.items?.some(id=>DB.items[id]?.set===code))?.n||extra[code]||code;
}
function effectStatsLines(delta) {
    const units={meleeCrit:' 個百分點',rangedCrit:' 個百分點',magicCrit:' 個百分點',meleeCritDmg:' 個百分點',rangedCritDmg:' 個百分點',magicCritDmg:' 個百分點',aspd:' 秒',castSeconds:' 秒',moveSpeedPct:' 個百分點',potionBonus:' 個百分點',damageReductionPct:' 個百分點'};
    const names={...EFFECT_STAT_NAMES,aspd:'攻擊間隔',castSeconds:'施法間隔',moveSpeedPct:'移動速度',potionBonus:'藥水恢復量',damageReductionPct:'承受傷害減少',extraMp:'原始額外 SP',petGearDmg:'寵物裝備傷害加值',petGearHit:'寵物裝備命中加值',skillFlat:'寵物技能固定加值',resNone:'無屬性抗性',meleeCritDmg:'近距離爆擊傷害',rangedCritDmg:'遠距離爆擊傷害',magicCritDmg:'魔法爆擊傷害'};
    return Object.entries(delta).filter(([k,v])=>names[k]&&typeof v==='number'&&Math.abs(v)>.0001).map(([k,v])=>names[k]+' '+(v>0?'+':'')+effectNumber(v)+(units[k]||''));
}
function effectItemConditions(item,actor,kind='player') {
    const d=DB.items[item.id];if(!d)return [];
    const hp=actor.curHp??actor.hp??0,mp=actor.mp||0,wpn=DB.items[actor.eq?.wpn?.id],poly=actor._setPoly||actor.buffs?.poly>0&&actor.poly;
    // Conditional abilities are listed only while their actor-side condition holds.
    const gates=[['滿血施法',hp>=(actor.mhp||1)],['瀕危急救',hp<(actor.mhp||1)*.2],['魔力枯竭回復',mp<(actor.mmp||1)*.15],['背水爆擊',d.critDmgLowHp&&hp<d.critDmgLowHp.hp],['裝備近戰武器時',wpn&&!wpn.ranged&&!wpn.isBow],['變身時',poly],['握劍強化',actor.eq?.wpn&&getWeaponTags(actor.eq.wpn.id).some(t=>['單手劍','雙手劍'].includes(t))]];
    const root=player;let labels;
    try{player=actor;labels=itemEffectLabels(item);}finally{player=root;}
    for(const [key,name]of Object.entries({freeze:'冰凍',stun:'暈眩',paralyze:'麻痺',sleep:'睡眠',slow:'緩速',poison:'中毒',burn:'灼燒',blind:'闇盲',silence:'沉默',stone:'石化'})){const cap=key[0].toUpperCase()+key.slice(1);if(d['imm'+cap])labels.push('免疫'+name+'（限原生支援此免疫的異常判定）');if(d[key+'Resist'])labels.push(name+'抵抗 +'+d[key+'Resist']+' 個百分點（與其他來源相加，最高 100%）');}
    if(d.abnormalResist)labels.push('異常抵抗 +'+d.abnormalResist+' 個百分點（與各類抵抗相加，最高 100%）');
    if(d.extraAtk)labels.push('額外一般攻擊 +'+d.extraAtk+' 次（沿用原生攻擊判定）');
    if(d.skillDmgMult)for(const [id,mult]of Object.entries(d.skillDmgMult))labels.push((DB.skills[id]?.n||id)+'傷害 ×'+mult+'（僅指定技能）');
    if(d.raceDr)labels.push('受到'+d.raceDr.race+'傷害減少 '+d.raceDr.pct+'%（物理／魔法，乘算）');
    if(d.expBonus)labels.push('經驗獲得量 +'+d.expBonus+'%');
    if(d.goldBonus)labels.push('金幣獲得量 +'+d.goldBonus+'%');
    if(d.potionBonus&&!d.relic)labels.push('藥水恢復量 +'+d.potionBonus+'%');
    if(kind==='ally'){const unsupported=['快速再生','魔力枯竭回復','瀕危急救'];if(d.slot!=='doll')unsupported.push('治癒藥水恢復量','藥水恢復量');labels=labels.filter(line=>!unsupported.some(prefix=>line.startsWith(prefix)));}
    labels=labels.filter(line=>!/(?:^唯一|^裝備限制|^臂甲|命中時|命中疊加|命中附加|命中後|攻擊時|受擊|每.*秒.*觸發|對滿血|滿血斬殺|專攻|剋星|斬殺|觸發|機率|連射|雙擊|重擊|施放|施法代價)/.test(line)&&gates.every(([prefix,on])=>!line.startsWith(prefix)||on));
    return [...new Set(labels)];
}
function effectEntries(actor,kind,owner,snapshot) {
    const entries=[],add=(id,name,source,lines,seconds=null)=>entries.push({id,name,source,lines,seconds});
    const minion=kind!=='player'&&kind!=='ally',buffs=effectPreview(actor,kind,owner).actor.buffs||{};
    for(const [id,seconds]of Object.entries(buffs))if(seconds>0){
        if(DB.skills[id]?.summon&&!actor.summon&&!actor.charmed)continue;
        if(id==='poly'&&actor._setPoly)continue;
        if(id==='haste'&&Object.keys(buffs).some(k=>DB.skills[k]?.haste&&buffs[k]>0))continue;
        const info=effectInfo(id);add('buff:'+id,info.name,id==='sk_set_dragonscion'?'龍血套裝觸發':effectBuffStage(id,actor)===6?'魔法／共享增益（未記錄施放者）':effectBuffStage(id,actor)===5?'藥水／變身':'狀態觸發增益',info.lines,seconds);
    }
    if(actor._mercPermanentPotions){add('merc:haste','常駐加速','隊友常駐藥水',effectInfo('haste').lines);const id=['knight','dragon','warrior','royal'].includes(actor.cls)?'brave':actor.cls==='mage'?'cautious':actor.cls==='elf'?'elfcookie':null;if(id)add('merc:'+id,effectInfo(id).name,'隊友常駐藥水',effectInfo(id).lines);}
    const auraIds=TEAM_AURA_SKILLS.concat(['sk_illu_golem','sk_illu_avatar','sk_illu_ogre','sk_illu_lich']);
    for(const id of new Set(auraIds)){
        const providers=[player,...(player.allies||[])].filter(a=>a&&a!==actor&&!a.dead&&!a._downed&&a.buffs?.[id]>0);
        if(!providers.length||actor._downed||!_teamAuraHas(id,actor))continue;
        if(buffs[id]>0)continue;
        const info=effectInfo(id),seconds=Math.max(...providers.map(a=>a.buffs[id]));
        add('aura:'+id,info.name,'光環：'+providers.map(a=>a._allyName||a.name||'隊友').join('、'),info.lines,seconds);entries[entries.length-1].skill=id;
    }
    for(const [id,ticks]of Object.entries(_supStatuses(actor)||{}))if(ticks>0&&PLAYER_DEBUFF_NAME[id])add('status:'+id,PLAYER_DEBUFF_NAME[id],'異常狀態',effectInfo(id).lines,ticks/10);
    if(!actor._downed)for(const [id,h]of Object.entries(player.hots||{}))if(h.ticksLeft>0)add('hot:'+id,effectInfo(id).name,'持續恢復（施放時快照）',['每 '+effectNumber((h.interval||0)/10)+' 秒依原持續治療快照恢復；不套一般自然恢復限制。'],Math.max(0,((h.ticksLeft-1)*(h.interval||0)+(h.cd||0))/10));
    if(!minion){
        const runtime={
            _spellbladeUntil:{name:'魔劍增幅',on:DB.items[actor.eq?.wpn?.id]?.spellbladeBuff,lines:['近距離傷害與命中加值各 +'+spellbladeMeleeBonus(actor._spellbladeTier)+'（依已施放法術階級；需持續裝備魔劍）']},
            _golemMrDebuffUntil:{name:'高崙印記',on:DB.items[actor.eq?.helm?.id]?.golemMarkDebuff,lines:['魔防 MR -100；需持續裝備高崙的生命印記。']},
            _eyePetrifyUntil:{name:'地龍魔眼',on:true,lines:['額外傷害、額外命中與原始 ER 各 +5。']},
            _stoneEssUntil:{name:'石化精髓',on:true,lines:['固定減傷 +50、MR +50；依原生受擊路徑另計。']},
            _crushFuryUntil:{name:'粉碎狂熱',on:kind==='player',lines:['攻擊速度 +20%，與其他攻速乘算。']},
            _fangFuryUntil:{name:'利牙狂熱',on:kind==='player',lines:['攻擊速度 +'+(DB.items[actor.eq?.wpn?.id]?.critFuryHaste?.pct||30)+'%，與其他攻速乘算。']}
        };
        for(const [field,e]of Object.entries(runtime))if(e.on&&actor[field]>state.ticks)add('runtime:'+field,e.name,'已觸發的裝備效果',e.lines,(actor[field]-state.ticks)/10);
        const clan=snapshot.clanBuff;if(clan)add('clan','血盟 Buff',clan.name+' Lv.'+clan.level,['啟用中；依血盟等級提供加成。每小時扣除貢獻續費，停用或貢獻不足時失效。',...effectStatsLines(snapshot.stages[4].delta)]);
        if(actor.eq?.wpn?.id==='relic_bk_lance'&&actor.eq?.shield?.id==='relic_guard_towershield')add('combo:lance-shield','長槍／塔盾組合','黑騎士的精銳長槍＋鎧衛隊的漆黑塔盾',['近距離傷害加值 +15；格檔重擊 100%／一般 100%，成功時物理傷害減半。']);
        const counts={},seen=new Set();
        for(const [slot,item]of Object.entries(actor.eq||{}))if(item){
            const d=DB.items[item.id];if(!d)continue;
            if(d.set&&!['wpn','offwpn'].includes(slot)&&!seen.has(item.id)){counts[d.set]=(counts[d.set]||0)+1;seen.add(item.id);}
            const lines=effectItemConditions(item,actor,kind);
            if(lines.length)add('equip:'+slot,d.n,'裝備（強化／祝福／遠古／屬性／願望已計入）',lines);
        }
        for(const [code,count]of Object.entries(counts))if(count>=EFFECT_SET_THRESHOLDS[code]){
            add('set:'+code,effectSetName(code),'套裝 '+count+' 件（門檻 '+EFFECT_SET_THRESHOLDS[code]+' 件）',EFFECT_SET_LINES[code]);
        }
        const sh={};for(const r of SHERINE_REMAINS){const e=actor.eq?.[r.id];if(e?.seteff){const g=e.seteff.slice(0,2);sh[g]=(sh[g]||0)+1;}}
        for(const [group,count]of Object.entries(sh))if(count>=2)add('remains:'+group,group+' '+Math.min(5,count)+'/5','遺骸套裝',(SHERINE_SET_TEXT[group]||[]).filter((_,i)=>count>=[2,3,5][i]));
        if(actor._setPoly)add('set-poly','變身：'+actor._setPoly.n,'裝備／套裝變身',effectInfo('poly').lines);
        if(actor.mastery){const m=MASTERY_DATA[actor.cls]?.list?.[actor.mastery];add('mastery',m?.n||'精通','常駐技能',[m?.d||m?.desc||'依目前職業精通與裝備條件生效。']);}
        const permanent=effectPermanentLines(actor);if(permanent.length)add('permanent','圖鑑常駐','常駐加成',permanent);
        for(const id of actor.skills||[])if(DB.skills[id]?.type==='passive'){const without=effectPreview(actor,kind,owner,7,copy=>{copy.skills=copy.skills.filter(s=>s!==id);}).stats;const lines=effectStatsLines(effectDelta(snapshot.total,without));if(lines.length)add('passive:'+id,DB.skills[id].n,'被動技能',lines.concat(effectInfo(id).lines));}
    }
    return entries;
}
function effectStatusHtml(snapshot) {
    return '<span data-effect-summary tabindex="0" role="button">狀態</span>：<span data-effect-list>'+snapshot.entries.map(e=>'<span tabindex="0" role="button" data-effect-key="'+partyEscape(e.id)+'">'+partyEscape(e.name)+'</span>').join(' / ')+'</span>';
}
function syncEffectStatus(host,actor,kind,owner=player) {
    const snapshot=effectDetailsSnapshot(actor,kind,owner);
    let summary=host.querySelector('[data-effect-summary]'),list=host.querySelector('[data-effect-list]');
    if(!summary){host.innerHTML=effectStatusHtml({...snapshot,entries:[]});summary=host.querySelector('[data-effect-summary]');list=host.querySelector('[data-effect-list]');}
    const nodes=new Map([...list.querySelectorAll('[data-effect-key]')].map(n=>[n.dataset.effectKey,n]));
    const keep=new Set(snapshot.entries.map(e=>e.id));for(const [id,node]of nodes)if(!keep.has(id))node.remove();
    for(const entry of snapshot.entries){const node=nodes.get(entry.id);if(node&&node.textContent!==entry.name)node.textContent=entry.name;}
    const ids=snapshot.entries.map(e=>e.id).join('|');
    if(list.dataset.effectKeys!==ids){const children=[];for(const e of snapshot.entries){if(children.length)children.push(document.createTextNode(' / '));let n=nodes.get(e.id);if(!n){n=document.createElement('span');n.tabIndex=0;n.setAttribute('role','button');n.dataset.effectKey=e.id;}n.textContent=e.name;children.push(n);}if(!children.length)children.push(document.createTextNode('正常'));list.replaceChildren(...children);list.dataset.effectKeys=ids;}
}
function partyAbilityNumber(snapshot, keys, suffix = '', seconds = false, buff = false) {
    const data = buff ? snapshot.delta : snapshot.total;
    if (!keys.some(k => typeof snapshot.total[k] === 'number')) return '—';
    let value = keys.reduce((n,k)=>n+(Number(data[k])||0),0);
    if (seconds && snapshot.kind !== 'ally' && snapshot.kind !== 'player') value /= 10;
    value = Math.round(value*100)/100;
    return (buff && value > 0 ? '+' : '') + value + suffix;
}
function partyAbilityValue(snapshot, keys, suffix = '', seconds = false) {
    const total = partyAbilityNumber(snapshot, keys, suffix, seconds);
    const buff = partyAbilityNumber(snapshot, keys, '', seconds, true);
    const label = '（'+buff.replace(/^\+/, '＋').replace(/^-/, '−')+'）';
    const raw=parseFloat(buff),lower=keys.some(k=>['ac','aspd','atkItv','castSeconds','mpKillInterval'].includes(k));
    return '<span data-ability-total>'+total+'</span><small class="'+(raw&&(lower?raw>0:raw<0)?'ability-buff-unfavorable':'')+'" data-ability-buff'+(parseFloat(buff)===0||buff==='—'?' hidden':'')+' aria-label="額外加成 '+buff+'">'+label+'</small>';
}
function fitPartyAbilityValues() {
    for (const field of document.querySelectorAll('#party-inspector [data-ability-field],#tab-stats [data-ability-field]')) {
        field.style.fontSize = '';
        const total = field.querySelector('[data-ability-total]'), buff = field.querySelector('[data-ability-buff]');
        if (!total || !buff) continue;
        const width = total.getBoundingClientRect().width + (buff.hidden ? 0 : buff.getBoundingClientRect().width);
        const available = field.getBoundingClientRect().width - 4 * getUiScale();
        if (width > available && available > 0) field.style.fontSize = (parseFloat(getComputedStyle(field).fontSize) * available / width) + 'px';
    }
}
const ABILITY_STAT_FIELDS = {str:['str'],dex:['dex'],con:['con'],int:['int'],wis:['wis'],cha:['cha'],mdmg:['meleeDmg','extraDmg'],mhit:['meleeHit','extraHit'],
        'mcrit-p':['meleeCrit'],mcritdmg:['meleeCritDmg'],rdmg:['rangedDmg','extraDmg'],rhit:['rangedHit','extraHit'],rcrit:['rangedCrit'],rcritdmg:['rangedCritDmg'],er:['er'],hpr:['hpR'],potion:['potionBonus'],dr:['dr'],movespeed:['moveSpeedPct'],spd:['aspd'],mgdmg:['magicDmg'],'mhit-mag':['magicHit'],sp:['extraMp'],mcrit:['magicCrit'],mgcritdmg:['magicCritDmg'],mpr:['mpR'],mpreduce:['mpReduce'],mpkill:['mpKillInterval'],mr:['mr'],resnone:['resNone'],resfire:['resFire'],reswater:['resWater'],reswind:['resWind'],researth:['resEarth']};
function partyPetBonusHtml(snapshot,actor) {
    const d=snapshot.total,definition=PET_BOOK[actor.form];
    const fields={mdmg:['flat','petGearDmg','petCharmDmg','petAuraDmg','petStatusDmg'],mhit:['hit','petGearHit','petCharmHit','petAuraHit','petPartnerHit','petStatusHit'],mgdmg:['skillFlat','petAuraMagicDmg'],spd:['atkItv'],mr:['mr'],dr:['dr'],er:['er']};
    const row=(key,label,suffix='')=>'<dt>'+label+'</dt><dd data-ability-field="'+key+'" data-ability-keys="'+fields[key].join(',')+'" data-ability-label="'+label+'" tabindex="0" role="button">'+partyAbilityValue(snapshot,fields[key],suffix,key==='spd')+'</dd>';
    const magic=(definition.sk||[]).filter(skill=>skill.kind==='magic');
    const skills=magic.length?'<h3>魔法技能</h3><dl class="party-stats pet-ability-stats">'+row('mgdmg','技能傷害加值')+'<dt>技能間隔</dt><dd>'+effectNumber(d.castItv/10)+'s</dd></dl><p>'+magic.map(skill=>partyEscape(skill.n)+'：'+skill.d[0]+'D'+skill.d[1]).join('、')+'（魔法必中）</p>':'';
    return '<section id="party-bonus-window" data-pet-ability><h3>寵物能力</h3><dl class="party-stats pet-ability-stats"><dt>普攻骰值</dt><dd>1D'+effectNumber(d.dice)+'</dd>'+row('mdmg','物理傷害加值')+row('mhit','命中加值')+row('spd','攻擊間隔','s')+'<dt>普攻傷害倍率</dt><dd>×'+effectNumber((d.damageMult||1)*(d.attackMult||1))+'</dd>'+row('mr','魔防 MR')+row('dr','固定減傷')+row('er','迴避 ER','%')+'</dl>'+skills+abilityBonusNotesHtml(snapshot)+'<p>普攻命中依等級差與目標 AC 計算；實際傷害另計目標減免與技能效果。</p></section>';
}
function partyBonusHtml(snapshot,actor=null) {
    if(snapshot.kind==='pet')return partyPetBonusHtml(snapshot,actor);
    const shell = document.querySelector('#tab-stats .ability-window-shell').cloneNode(true);
    shell.querySelectorAll('button,.ability-respec-overlay,.ability-hidden-values').forEach(e=>e.remove());
    const fields = {...ABILITY_STAT_FIELDS,spd:snapshot.kind==='pet'?['atkItv']:['aspd']};
    for(const e of shell.querySelectorAll('[id]')) {
        const key=e.id.replace('dt-','');e.removeAttribute('id');
        if(!fields[key])continue;
        const suffix=['mcrit-p','mcritdmg','rcrit','rcritdmg','mcrit','mgcritdmg','er','potion','movespeed','mpreduce'].includes(key)?'%':['spd','mpkill'].includes(key)?'s':'';
        e.dataset.abilityLabel=['str','dex','con','int','wis','cha'].includes(key)?EFFECT_STAT_NAMES[key]:(e.parentElement.querySelector('span')?.textContent||key);
        e.innerHTML=partyAbilityValue(snapshot,fields[key],suffix,key==='spd');e.dataset.abilityField=key;
        e.querySelector('[data-ability-total]').toggleAttribute('data-panacea',(actor?.panacea?.[key]||0)>0);e.tabIndex=0;e.setAttribute('role','button');e.setAttribute('aria-label',e.dataset.abilityLabel+' 總能力 '+e.querySelector('[data-ability-total]').textContent+'，額外加成 '+e.querySelector('[data-ability-buff]').textContent);
    }
    shell.style.width='100%';shell.style.maxWidth='none';
    shell.querySelector('.ability-buffs').innerHTML=abilityBonusNotesHtml(snapshot);
    return '<section id="party-bonus-window"><h3>總能力與額外加成</h3><div class="party-art-scroll">'+shell.outerHTML+'</div></section>';
}
function abilityBonusNotesHtml(snapshot,prefix='party') {
    return '<div class="party-ability-vitals"><span>防禦 AC <strong id="'+prefix+'-ability-ac" data-ability-field="ac" data-ability-label="防禦 AC" tabindex="0" role="button">'+partyAbilityValue(snapshot,['ac'])+'</strong></span><span>HP 上限 <strong data-ability-field="mhp" data-ability-label="HP 上限" tabindex="0" role="button">'+partyAbilityValue(snapshot,['mhp'])+'</strong></span><span>MP 上限 <strong data-ability-field="mmp" data-ability-label="MP 上限" tabindex="0" role="button">'+partyAbilityValue(snapshot,['mmp'])+'</strong></span></div>'+(prefix==='party'?effectStatusHtml(snapshot):'')+'<p>括號為基礎以外的額外加成；攻擊間隔與 AC 越低越有利。</p>';
}
let playerAbilityCache=null;
function refreshPlayerAbility() {
    const tab=document.getElementById('tab-stats');
    if(!tab || tab.classList.contains('hidden'))return;
    const signature=effectSignature(player,'player');
    if(!playerAbilityCache || playerAbilityCache.actor!==player || playerAbilityCache.signature!==signature) {
        playerAbilityCache={actor:player,signature,snapshot:partyBonusSnapshot(player,'player')};
    }
    const snapshot=playerAbilityCache.snapshot;
    let changed=false;
    for(const [key,keys]of Object.entries(ABILITY_STAT_FIELDS)) {
        const e=document.getElementById('dt-'+key);if(!e)continue;
        if(e.dataset.abilityField!==key)e.dataset.abilityField=key;
        if(e._abilityTextChanged){changed=true;e._abilityTextChanged=false;}
        if(['str','dex','con','int','wis','cha'].includes(key) && (_respec || (player.bonus||0)>0))continue;
        let totalNode=e.querySelector('[data-ability-total]');
        const total=key==='spd'?effectNumber(snapshot.total.aspd)+'s':(totalNode||e).textContent;
        const html=partyAbilityValue(snapshot,keys,'',key==='spd');
        if(e._abilityHtml!==html || !totalNode){
            e.innerHTML=html;e._abilityHtml=html;totalNode=e.querySelector('[data-ability-total]');changed=true;
        }
        if(totalNode.textContent!==total){totalNode.textContent=total;changed=true;}
        const panacea=(player.panacea?.[key]||0)>0;
        if(totalNode.hasAttribute('data-panacea')!==panacea)totalNode.toggleAttribute('data-panacea',panacea);
    }
    const notes=document.getElementById('player-ability-notes'),html=abilityBonusNotesHtml(snapshot,'player-bonus');
    if(notes._abilityHtml!==html){notes.innerHTML=html;notes._abilityHtml=html;changed=true;}
    const layoutKey=tab.clientWidth+':'+document.documentElement.clientWidth+':'+getUiScale();
    if(changed || tab._abilityLayoutKey!==layoutKey){fitPartyAbilityValues();tab._abilityLayoutKey=layoutKey;}
}

function abilitySourceDetails(actor,kind,owner=player) {
    const snapshot=effectDetailsSnapshot(actor,kind,owner),sources=[];
    // Each source is removed at its own category stage, so a category's sources add up to that category.
    const add=(stage,name,omit)=>sources.push({stage,name,stats:omit?effectPreview(actor,kind,owner,stage,omit).stats:null});
    if(kind==='player'||kind==='ally'){
        for(const [key,name]of Object.entries({cardDex:'卡片圖鑑',equipDex:'裝備圖鑑',miscDex:'道具圖鑑'}))if(Object.keys(player[key]||{}).length)add(1,name,copy=>{copy[key]={};});
        if(actor.mastery)add(1,MASTERY_DATA[actor.cls]?.list?.[actor.mastery]?.n||'精通',copy=>{copy.mastery=null;});
        for(const id of actor.skills||[])if(DB.skills[id]?.type==='passive')add(1,DB.skills[id].n,copy=>{copy.skills=copy.skills.filter(s=>s!==id);});
    }
    for(const [slot,item]of Object.entries(actor.eq||{}))if(item)add(2,getItemFullName({...item,en:0}).replace(/<[^>]+>/g,''),copy=>{delete copy.eq[slot];});
    for(const e of snapshot.entries){
        if(e.id.startsWith('set:'))add(3,e.name,copy=>{copy._effectOmitSet=e.id.slice(4);});
        else if(e.id.startsWith('remains:')||e.id.startsWith('combo:'))add(3,e.name);
        else if(e.id==='clan')add(4,snapshot.clanBuff.name+' Lv.'+snapshot.clanBuff.level);
        else if(e.id.startsWith('merc:'))add(5,e.name);
        else if(e.id.startsWith('buff:')){const id=e.id.slice(5);add(effectBuffStage(id,actor),e.name,copy=>{delete copy.buffs[id];});}
        else if(e.id.startsWith('aura:'))add(6,e.name,(copy,others)=>{for(const a of others)delete a.buffs[e.skill];});
        else if(e.id.startsWith('status:')||e.id.startsWith('runtime:'))add(7,e.name);
    }
    return {snapshot,sources};
}
function abilitySourceHtml(details,actor,kind,key,keys,seconds=false) {
    const s=details.snapshot,scale=seconds&&s.kind!=='ally'&&s.kind!=='player'?10:1;
    const round=v=>Math.round(v*100)/100,value=data=>round(keys.reduce((n,k)=>n+(Number(data[k])||0),0)/scale);
    const lower=keys.some(k=>['ac','aspd','atkItv','castSeconds','mpKillInterval'].includes(k)),signed=v=>(v>0?'+':'')+effectNumber(v);
    const row=(type,label,amount,name='',item=false)=>'<div data-ability-line="'+type+'"'+(item?' data-ability-item':'')+(type==='extra'&&(lower?amount>0:amount<0)?' class="ability-buff-unfavorable"':'')+'><span>'+partyEscape(label)+'</span><b>'+(amount==null?'':type==='extra'||label!=='初始點數'&&label!=='基礎'?signed(amount):effectNumber(amount))+'</b><em>'+partyEscape(name)+'</em></div>';
    const rows=[],base=value(s.stages[0].total);let mixed=false;
    if(['str','dex','con','int','wis','cha'].includes(key)&&(kind==='player'||kind==='ally')){
        const points=actor.base?.[key]||0,alloc=actor.alloc?.[key]||0,panacea=actor.panacea?.[key]||0,rest=round(base-points-alloc-panacea);
        rows.push(row('base','初始點數',points));
        if(alloc)rows.push(row('base','升級配點',alloc));
        if(panacea)rows.push(row('panacea','萬能藥',panacea));
        if(rest)rows.push(row('base','職業／等級',rest));
    } else rows.push(row('base','基礎',base));
    for(let i=1;i<s.stages.length;i++){
        const delta=round(value(s.stages[i].total)-value(s.stages[i-1].total));if(!delta)continue;
        const own=details.sources.filter(x=>x.stage===i).map(x=>({name:x.name,delta:x.stats?round(value(s.stages[i].total)-value(x.stats)):null})).filter(x=>x.delta!==0);
        if(own.length===1){rows.push(row('extra',EFFECT_STAGES[i],delta,own[0].name));continue;}
        rows.push(row('extra',EFFECT_STAGES[i],delta,own.length>1?'（小計）':''));
        for(const x of own)rows.push(row('extra','',x.delta,x.name,true));
        if(own.length>1&&own.every(x=>x.delta!=null)&&round(own.reduce((n,x)=>n+x.delta,0))!==delta)mixed=true;
    }
    return rows.join('')+(mixed?'<p data-ability-note>※ 部分效果互斥／乘算，單項不能直接相加</p>':'');
}
(function(){
    const tip=document.createElement('div');tip.id='party-ability-tip';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.appendChild(tip);
    let target=null,signature='',actorAtOpen=null,roleAtOpen=null,pointer=null;
    function hide(){tip.hidden=true;target=null;signature='';}
    // Follows the pointer like the equipment tooltip (lower right, flipped at edges); keyboard focus anchors it under the field.
    function place(e){
        const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight;
        tip.style.maxWidth=screenToUiPx(Math.min(430,width-24));tip.style.maxHeight=screenToUiPx(height-24);
        tip.style.left=tip.style.top='0px';   // measure at the origin: a fixed box near the right edge is squeezed narrower
        const b=tip.getBoundingClientRect();let x,y;
        if(pointer){x=pointer.x+16;y=pointer.y+16;if(x+b.width>width-6)x=pointer.x-16-b.width;if(y+b.height>height-6)y=pointer.y-16-b.height;}
        else{const r=e.getBoundingClientRect();x=r.left;y=r.bottom+8;}
        tip.style.left=screenToUiPx(Math.max(4,Math.min(width-b.width-4,x)));tip.style.top=screenToUiPx(Math.max(4,Math.min(height-b.height-4,y)));
    }
    function show(event){
        const e=event.target.closest('#party-inspector [data-ability-field],#tab-stats [data-ability-field],#tab-stats [id^="dt-"],#st-ac,#st-mr');
        const key=e?.dataset.abilityField||e?.id.replace('dt-','').replace('st-',''),keys=e?.dataset.abilityKeys?e.dataset.abilityKeys.split(','):ABILITY_STAT_FIELDS[key]||(['ac','mhp','mmp'].includes(key)?[key]:null);
        if(!e||!keys)return;
        if(event.type==='focusin'&&!e.matches(':focus-visible'))return;   // mouse focus: the pointer already drives the tip
        if(event.type)pointer=event.type==='focusin'||event.type==='click'&&!event.detail?null:{x:event.clientX,y:event.clientY};
        let actor=player,kind='player',owner=player;
        if(e.closest('#party-inspector')){const panel=document.getElementById('party-inspector');actor=partyMemberById(panel.dataset.kind,panel.dataset.id);kind=panel.dataset.kind;owner=kind==='merc-summon'?(player.allies||[]).find(a=>String(a._slot)===panel.dataset.id)||player:actor?._necroSkeleton?_necroOwnerByKey(actor._necroOwnerKey)||player:player;if(!actor)return;}
        if(!event.type&&target&&(actorAtOpen!==actor||roleAtOpen!==player)){hide();return;}
        actorAtOpen=actor;roleAtOpen=player;
        const next=effectSignature(actor,kind,owner);
        if(target===e&&signature===next){place(e);return;}
        signature=next;
        const statKeys=kind==='pet'&&key==='spd'?['atkItv']:keys,details=abilitySourceDetails(actor,kind,owner),s=details.snapshot;
        const label=e.dataset.abilityLabel||EFFECT_STAT_NAMES[key]||e.parentElement.querySelector('span')?.textContent||key;
        const conversion=key==='sp'?'原始智力 SP '+getIntExtraMp(s.total.int||0)+' → 有效 '+magicIntSp(s.total)+'；其他 SP '+magicItemSp(s.total):key==='er'?'原始 ER '+s.total.rawEr+' → 有效 '+s.total.er+'%':key.startsWith('res')?'原始抗性 '+effectNumber(s.total[keys[0]])+' → 有效 '+effResistPct(s.total[keys[0]])+'%（'+(keys[0]==='resNone'?'僅無屬性魔法傷害':'對應屬性傷害')+'）':'';
        const total=e.querySelector('[data-ability-total]')?.textContent||partyAbilityNumber(s,statKeys,'',key==='spd'),extra=partyAbilityNumber(s,statKeys,'',key==='spd',true);
        const raw=parseFloat(extra),lower=statKeys.some(k=>['ac','aspd','atkItv','castSeconds','mpKillInterval'].includes(k));
        const header='<strong>'+partyEscape(label+' '+total)+(raw?'<span data-ability-extra'+((lower?raw>0:raw<0)?' class="ability-buff-unfavorable"':'')+'>（額外 '+partyEscape(extra)+'）</span>':'')+'</strong>';
        target=e;tip.innerHTML=header+(conversion?'<p>'+partyEscape(conversion)+'</p>':'')+abilitySourceHtml(details,actor,kind,key,statKeys,key==='spd');tip.hidden=false;
        place(e);
    }
    document.addEventListener('click',e=>{hide();show(e);});
    document.addEventListener('focusin',show);document.addEventListener('mouseover',show);
    document.addEventListener('mousemove',e=>{if(target&&pointer&&target.contains(e.target)){pointer={x:e.clientX,y:e.clientY};place(target);}});
    document.addEventListener('mouseout',e=>{if(target&&!target.contains(e.relatedTarget))hide();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tip.hidden){hide();e.preventDefault();}});
    document.addEventListener('scroll',event=>{if(target&&(event.target===document||event.target.contains?.(target)))hide();},true);setInterval(()=>{if(target){if(!target.isConnected||!target.checkVisibility())hide();else show({target});}},250);
    document.addEventListener('DOMContentLoaded',()=>{for(const [key]of Object.entries(ABILITY_STAT_FIELDS)){const e=document.getElementById('dt-'+key);if(e){e.tabIndex=0;e.setAttribute('role','button');e.setAttribute('aria-label',(EFFECT_STAT_NAMES[key]||e.parentElement.querySelector('span')?.textContent||key)+'：查看加成來源');}}});
})();
// AC and active set bonuses shown under the equipment canvas; each row stays on one line with a full title.
function equipmentSummaryHtml(actor,kind,owner=player) {
    const snapshot=effectDetailsSnapshot(actor,kind,owner);
    const rows=snapshot.entries.filter(e=>e.id.startsWith('set:')||e.id.startsWith('remains:')||e.id.startsWith('combo:')).map(e=>{
        const text=e.lines.filter(line=>!line.startsWith('目前穿著達生效門檻')).join('、');
        return '<p data-equipment-set="'+partyEscape(e.id)+'" title="'+partyEscape(e.name+'：'+text)+'"><strong>'+partyEscape(e.name)+'</strong>：'+partyEscape(text)+'</p>';
    });
    const morph=snapshot.entries.find(e=>e.id==='set-poly');
    if(morph)rows.push('<p data-equipment-set="set-poly" title="'+partyEscape(morph.name)+'">'+partyEscape(morph.name)+'</p>');
    return '<strong data-equipment-ac>防禦 AC '+effectNumber(snapshot.total.ac)+'</strong>'+rows.join('');
}
function effectPermanentLines(actor) {
    const root=player,copy=effectActorCopy(actor),lines=[];
    try {
        player=copy;for(const key of ['cardDex','equipDex','miscDex'])copy[key]=root[key]||{};
        for(const region of CARD_REGIONS){const tier=cardRegionTier(region.key);if(tier>0)lines.push('卡片圖鑑·'+region.name+'：'+(EFFECT_STAT_NAMES[region.stat]||'負重上限')+' +'+region.vals[tier-1]+'（'+tier+' 階）');}
        for(const c of EQUIP_CATEGORIES)if(equipCatComplete(c.key)&&EQUIP_CAT_BONUS[c.key])lines.push('裝備圖鑑·'+c.name+'：'+EQUIP_CAT_BONUS[c.key].label);
        for(const c of MISC_CATEGORIES)if(miscCatComplete(c.key)&&MISC_CAT_BONUS[c.key])lines.push('道具圖鑑·'+c.name+'：'+MISC_CAT_BONUS[c.key].label);
        return lines;
    } finally {player=root;}
}
