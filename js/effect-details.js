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
    const image=e.icon?'<img src="assets/state-icons/'+encodeURIComponent(e.icon)+'.jpg" alt="'+partyEscape(name)+'" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>'+partyEscape(name)+'</span>':'<span>'+partyEscape(name)+'</span>';
    return '<button type="button" class="effect-icon" data-'+type+'="'+partyEscape(id)+'" data-effect-id="'+partyEscape(id)+'" data-effect-seconds="'+(seconds==null?'':seconds)+'" data-effect-source="'+partyEscape(source)+'" aria-label="'+partyEscape(name)+' '+time+'">'+image+'<small>'+time+'</small></button>';
}
(function(){
    const tip=document.createElement('div');tip.id='effect-tooltip';tip.className='game-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
    let target=null;
    function hide(){tip.hidden=true;if(target)target.removeAttribute('aria-describedby');target=null;}
    function render(){
        if(!target?.isConnected || !target.getClientRects().length){hide();return;}
        const e=effectInfo(target.dataset.effectId),sec=target.dataset.effectSeconds;
        tip.innerHTML='<strong>'+partyEscape(e.name)+'</strong><p>'+partyEscape(target.dataset.effectSource||'自身')+' · '+(sec===''?'常駐':Math.ceil(Number(sec)||0)+' 秒')+'</p><div>'+e.lines.map(p=>'<p>'+partyEscape(p)+'</p>').join('')+'</div>';
        if(!e.lines.length)tip.querySelector('div').textContent='目前生效中；此效果沒有固定數值加成。';
        tip.hidden=false;target.setAttribute('aria-describedby',tip.id);
        const z=getUiScale(),r=target.getBoundingClientRect();tip.style.maxWidth=Math.max(120,Math.min(340,(innerWidth-24)/z))+'px';
        const b=tip.getBoundingClientRect(),x=Math.max(8,Math.min(r.left,innerWidth-b.width-8));let y=r.bottom+8;if(y+b.height>innerHeight-8)y=Math.max(8,r.top-b.height-8);
        tip.style.left=screenToUiPx(x);tip.style.top=screenToUiPx(y);
    }
    function open(e){const node=e.target.closest('[data-effect-id]');if(!node)return;target=node;render();}
    document.addEventListener('mouseover',open);document.addEventListener('focusin',open);
    document.addEventListener('mouseout',e=>{if(target && !target.contains(e.relatedTarget))hide();});
    document.addEventListener('focusout',e=>{if(target && !target.contains(e.relatedTarget))hide();});
    document.addEventListener('click',e=>{const node=e.target.closest('[data-effect-id]');if(node){target=node;render();}else hide();});
    document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('#party-inspector [data-ability-field]')){e.preventDefault();e.target.closest('[data-ability-field]').click();}if(e.key==='Escape'&&!tip.hidden){e.preventDefault();hide();}});
    document.addEventListener('scroll',()=>{if(target)render();},true);setInterval(()=>{if(target)render();},250);
})();
// Recompute isolated copies: the live actor, timers and shared progress stay untouched.
function effectActorCopy(value, seen = new WeakMap()) {
    if (typeof value === 'function') return undefined;
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const copy = Array.isArray(value) ? [] : {}; seen.set(value, copy);
    for (const [key, item] of Object.entries(value)) { const next = effectActorCopy(item, seen); if (next !== undefined) copy[key] = next; }
    return copy;
}
function partyAbilityStats(actor, stats) {
    const result={...stats,er:effResistPct(stats.er||0),aspd:Math.max(.1,stats.aspd||.1),
        potionBonus:getConPotionPct(stats.con||0)+(DB.items[actor.eq?.doll?.id]?.potionBonus||0),
        mpKillInterval:wisMpRegenIntervalTicks(stats.wis||0)/10};
    const root=player;
    try {player=actor;result.moveSpeedPct=playerEffectiveMoveSpeedPct();}
    finally {player=root;}
    return result;
}
function partyBonusSnapshot(actor,kind,owner=player) {
    const root=player,flag=_recomputingAlly,minion=kind!=='ally';
    function derive(withBuffs) {
        const copy=effectActorCopy(actor),others=[root,...(root.allies||[])].filter(a=>a!==actor).map(a=>effectActorCopy(a));
        if(!withBuffs){copy.buffs={};copy._fangFuryUntil=0;copy._crushFuryTicks=0;copy._fangFuryTicks=0;copy.hots={};copy._mercPermanentPotions=false;copy._spellbladeUntil=0;copy._crushFuryUntil=0;copy._eyePetrifyUntil=0;for(const a of others){a.buffs={};a.hots={};}}
        copy.allies=others;copy.cardDex=structuredClone(root.cardDex||{});copy.equipDex=structuredClone(root.equipDex||{});copy.miscDex=structuredClone(root.miscDex||{});copy.relicDex=structuredClone(root.relicDex||{});
        try {
            player=copy;_recomputingAlly=!minion;
            let d;
            if(kind==='ally') {recomputeStats();d={...copy.d,mhp:copy.mhp,mmp:copy.mmp};const aura=teamIlluAura(copy);if(aura){d.extraDmg+=(aura.ed||0);d.extraHit+=(aura.eh||0);d.magicDmg+=(aura.md||0);d.meleeDmg+=(aura.mel||0);}const rm=royalAllyMult();d.mhp=Math.floor(d.mhp*rm);d.mmp=Math.floor(d.mmp*rm);d.castSeconds=castIntervalTicks(copy,false)/10;d=partyAbilityStats(copy,d);}
            else {player={...root,buffs:withBuffs?root.buffs:{},allies:others.filter(a=>accountRoleId(a)!==accountRoleId(root))};d=kind==='pet'?petDerive(copy):kind==='guard'?guardDerive(copy):_sumDeriveAny(copy,owner);d={...d,mhp:_supMhp(copy),mmp:(copy.mmp||0)+(d?.mmpBonus||0)};if(typeof d.er==='number')d.er=effResistPct(d.er);}
            d.ac=(d.ac||0)-teamAcBonus(copy,minion)+((kind==='ally'||kind==='pet')&&(_supStatuses(copy)?.disease||0)>0?8:0);
            d.damageReductionPct=(1-teamDmgReduceMult(minion)*(minion?1:avatarSelfDmgReduceMult(copy)))*100;
            return d;
        } finally {player=root;_recomputingAlly=flag;}
    }
    const calculated=derive(true),base=derive(false),delta={};for(const [k,v]of Object.entries(calculated))if(typeof v==='number'&&typeof base[k]==='number')delta[k]=Math.round((v-base[k])*100)/100;
    for(const key of Object.keys(EFFECT_FLAG_NAMES))if(calculated[key]&&!base[key])delta[key]=true;
    const total=kind==='ally'?{...partyAbilityStats(actor,actor.d),mhp:actor.mhp,mmp:actor.mmp,ac:(actor.d.ac||0)-teamAcBonus(actor)+((_supStatuses(actor)?.disease||0)>0?8:0),castSeconds:castIntervalTicks(actor,false)/10,damageReductionPct:(1-avatarSelfDmgReduceMult(actor))*100}:calculated;
    return {total,delta,kind};
}
function partyAbilityNumber(snapshot, keys, suffix = '', seconds = false, buff = false) {
    const data = buff ? snapshot.delta : snapshot.total;
    if (!keys.some(k => typeof snapshot.total[k] === 'number')) return '—';
    let value = keys.reduce((n,k)=>n+(Number(data[k])||0),0);
    if (seconds && snapshot.kind !== 'ally') value /= 10;
    value = Math.round(value*100)/100;
    return (buff && value > 0 ? '+' : '') + value + suffix;
}
function partyAbilityValue(snapshot, keys, suffix = '', seconds = false) {
    const total = partyAbilityNumber(snapshot, keys, suffix, seconds);
    const buff = partyAbilityNumber(snapshot, keys, suffix, seconds, true);
    const label = '（'+buff.replace(/^\+/, '＋').replace(/^-/, '−')+'）';
    return '<span data-ability-total>'+total+'</span><small data-ability-buff'+(parseFloat(buff)===0||buff==='—'?' hidden':'')+' aria-label="Buff 加成 '+buff+'">'+label+'</small>';
}
function fitPartyAbilityValues() {
    for (const field of document.querySelectorAll('#party-inspector [data-ability-field]')) {
        field.style.fontSize = '';
        const total = field.querySelector('[data-ability-total]'), buff = field.querySelector('[data-ability-buff]');
        const width = total.getBoundingClientRect().width + (buff.hidden ? 0 : buff.getBoundingClientRect().width);
        const available = field.getBoundingClientRect().width - 4 * getUiScale();
        if (width > available && available > 0) field.style.fontSize = (parseFloat(getComputedStyle(field).fontSize) * available / width) + 'px';
    }
}
function partySummaryHtml(snapshot,actor,live) {
    const values=[['HP','hp',Math.floor(_supHp(actor))+' / '+Math.floor(_supMhp(actor))],['MP','mp',live.mmp?Math.floor(actor.mp||0)+' / '+Math.floor(live.mmp):'—'],['防禦 AC','ac',live.ac],['魔防 MR','mr',live.d.mr||0],['固定減傷','dr',live.d.dr||0],['迴避率','er',snapshot.total.er==null?'—':snapshot.total.er+'%']];
    return '<div class="party-summary">'+values.map(([n,k,v])=>'<div class="party-summary-cell"><span>'+n+'</span><strong id="party-'+k+'" data-party-summary="'+k+'">'+v+'</strong></div>').join('')+'</div>';
}
function partyBonusHtml(snapshot) {
    const shell = document.querySelector('#tab-stats .ability-window-shell').cloneNode(true);
    shell.querySelectorAll('button,.ability-respec-overlay,.ability-hidden-values').forEach(e=>e.remove());
    const fields = {str:['str'],dex:['dex'],con:['con'],int:['int'],wis:['wis'],cha:['cha'],mdmg:['meleeDmg','extraDmg'],mhit:['meleeHit','extraHit'],
        'mcrit-p':['meleeCrit'],mcritdmg:['meleeCritDmg'],rdmg:['rangedDmg','extraDmg'],rhit:['rangedHit','extraHit'],rcrit:['rangedCrit'],rcritdmg:['rangedCritDmg'],er:['er'],hpr:['hpR'],potion:['potionBonus'],dr:['dr'],movespeed:['moveSpeedPct'],spd:snapshot.kind==='pet'?['atkItv']:['aspd'],mgdmg:['magicDmg'],'mhit-mag':['magicHit'],sp:['extraMp'],mcrit:['magicCrit'],mgcritdmg:['magicCritDmg'],mpr:['mpR'],mpreduce:['mpReduce'],mpkill:['mpKillInterval'],mr:['mr'],resnone:['resNone'],resfire:['resFire'],reswater:['resWater'],reswind:['resWind'],researth:['resEarth']};
    for(const e of shell.querySelectorAll('[id]')) {
        const key=e.id.replace('dt-','');e.removeAttribute('id');
        if(!fields[key])continue;
        const suffix=['mcrit-p','mcritdmg','rcrit','rcritdmg','mcrit','mgcritdmg','er','potion','movespeed','mpreduce'].includes(key)?'%':['spd','mpkill'].includes(key)?'s':'';
        e.dataset.abilityLabel=['str','dex','con','int','wis','cha'].includes(key)?EFFECT_STAT_NAMES[key]:(e.parentElement.querySelector('span')?.textContent||key);
        e.innerHTML=partyAbilityValue(snapshot,fields[key],suffix,key==='spd');e.dataset.abilityField=key;e.tabIndex=0;e.setAttribute('role','button');e.setAttribute('aria-label',e.dataset.abilityLabel+' 總能力 '+e.querySelector('[data-ability-total]').textContent+'，Buff 加成 '+e.querySelector('[data-ability-buff]').textContent);
    }
    shell.style.width='100%';shell.style.maxWidth='none';
    const flags=data=>Object.entries(EFFECT_FLAG_NAMES).filter(([key])=>data[key]).map(([,n])=>n).join('、');
    shell.querySelector('.ability-buffs').innerHTML='<div class="party-ability-vitals"><span>防禦 AC <strong id="party-ability-ac">'+partyAbilityValue(snapshot,['ac'])+'</strong></span><span>HP 上限 <strong>'+partyAbilityValue(snapshot,['mhp'])+'</strong></span><span>MP 上限 <strong>'+partyAbilityValue(snapshot,['mmp'])+'</strong></span></div><p class="party-total-flags">總能力：'+partyEscape(flags(snapshot.total)||'無額外免疫')+'</p><p class="party-buff-flags">Buff 加成：'+partyEscape(flags(snapshot.delta)||'無額外免疫')+'</p><p>數值後的綠色括號為 Buff 加成。攻擊間隔與 AC 越低越有利。</p>';
    return '<section id="party-bonus-window"><h3>總能力與 Buff 加成</h3><div class="party-art-scroll">'+shell.outerHTML+'</div></section>';
}

(function(){
    const tip=document.createElement('div');tip.id='party-ability-tip';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.appendChild(tip);
    function show(event){const e=event.target.closest('#party-inspector [data-ability-field]');if(!e)return;tip.textContent=e.getAttribute('aria-label');tip.hidden=false;const r=e.getBoundingClientRect(),b=tip.getBoundingClientRect();tip.style.left=screenToUiPx(Math.max(8,Math.min(innerWidth-b.width-8,r.left)));tip.style.top=screenToUiPx(Math.max(8,Math.min(innerHeight-b.height-8,r.bottom+8)));}
    document.addEventListener('click',e=>{if(e.target.closest('#party-inspector [data-ability-field]'))show(e);else tip.hidden=true;});
    document.addEventListener('focusin',show);document.addEventListener('mouseover',show);
    document.addEventListener('mouseout',e=>{if(e.target.closest('[data-ability-field]'))tip.hidden=true;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tip.hidden){tip.hidden=true;e.preventDefault();}});
})();
