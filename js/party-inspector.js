// Read live combat actors without changing their state or interrupting combat.
function partyEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function partyNameButton(kind, id, name, className = '') {
    return `<button type="button" class="party-name ${className}" data-party-kind="${kind}" data-party-id="${partyEscape(id)}" title="${partyEscape(name)} · 查看即時狀態" aria-controls="party-inspector">${partyEscape(name)}</button>`;
}
function partyClassBadge(actor) {
    const name = CLAN_CLASS_NAMES[actor.cls];
    return name ? '<span class="party-class" data-party-class="'+partyEscape(actor.cls)+'">（'+partyEscape(name)+'）</span>' : '';
}
function partyEquipmentWeightHtml(actor,kind) {
    if(kind!=='ally')return '';
    const d=actor.d||{},pct=Math.max(0,Math.floor(Number(d.weightPct)||0)),tier=Math.max(0,Math.min(3,Number(d.loadTier)||0));
    const amount=Number.isFinite(d.weightCurrent)&&Number.isFinite(d.weightLimit)?d.weightCurrent.toLocaleString()+' / '+d.weightLimit.toLocaleString()+' · ':'';
    const effect=tier>=2?'一般攻擊間隔×'+(tier===2?2:3)+'；施法與自然恢復不受負重限制。':'一般攻擊、施法與自然恢復不受負重限制。';
    return '<div class="party-equipment-weight" data-load-tier="'+tier+'"><strong>負重 '+amount+pct+'%</strong><span data-weight-effect>'+effect+'</span></div>';
}
function partyEquipmentDefault(actor,pos) {
    const node=document.createElement('span');node.className='party-equipment-slot-default';node.dataset.equipmentDefault=pos.k;node.setAttribute('aria-hidden','true');
    if(pos.k==='eye'||pos.k.startsWith('rem_')){
        const data=DB.items[pos.k==='eye'?'acc_earth_dragon_eye':pos.k];
        if(data){const image=document.createElement('img');image.src=getIconUrl(data);image.alt='';image.draggable=false;node.appendChild(image);}
    }else{
        node.style.backgroundImage='url("'+equipmentView.templateUrl(actor)+'")';
        node.style.backgroundSize=(10000/pos.w)+'% '+(10000/pos.h)+'%';
        node.style.backgroundPosition=((pos.x-pos.w/2)/(100-pos.w)*100)+'% '+((pos.y-pos.h/2)/(100-pos.h)*100)+'%';
    }
    return node;
}
function partyEquipmentHtml(actor,kind,id,page=0) {
    const frame=document.createElement('div');frame.className='party-equipment-frame'+(page?'':' party-paperdoll');
    const toolbar=document.createElement('div');toolbar.className='party-equipment-toolbar';toolbar.appendChild(partyPortraitNode(actor,kind,24,32));
    const caption=document.createElement('span');caption.className='party-equipment-page-label';caption.title='懸浮或點選裝備查看資訊';caption.textContent=page?'特殊裝備':'一般裝備';toolbar.appendChild(caption);
    const host=document.createElement('div');host.className='equipment-window-slots';frame.appendChild(host);
    const backdrop=document.createElement('img');backdrop.className='party-equipment-backdrop';backdrop.src=equipmentView.backdropUrl;backdrop.alt='';backdrop.draggable=false;host.appendChild(backdrop);
    if(!page){
        const figure=document.createElement('div');figure.className='party-paperdoll-figure';figure.setAttribute('aria-hidden','true');
        if(kind==='ally'){
            const key=loadStartKeyFromSummary({avatar:actor.avatar,rawCls:actor.cls}),image=document.createElement('img');
            image.src=loadFrameSrc(key,loadFirstFrame(key));image.alt='';image.draggable=false;figure.appendChild(image);
        }else figure.appendChild(partyPortraitNode(actor,kind,96,144));
        host.appendChild(figure);
    }
    for(const pos of equipmentView.pages[page]) {
        const key=kind==='pet'&&pos.k==='armor'?'arm':pos.alt&&actor.eq?.[pos.alt]?pos.alt:pos.k;
        const item=actor.eq?.[key],slot=equipmentView.createSlot(item,pos);
        slot.appendChild(partyEquipmentDefault(actor,pos));
        slot.dataset.equipmentSlot=key;
        const label=kind==='pet'&&key==='arm'?'寵物防具':kind==='pet'&&key==='wpn'?'寵物武器':ALLY_EQUIP_SLOT_NAME[key]||key;
        const name=item&&DB.items[item.id]?_withAllyEquipmentContext(effectActorCopy(actor),()=>getItemFullName(item).replace(/<[^>]*>/g,'')):'';
        const slotLabel=document.createElement('span');slotLabel.className='party-equipment-label';slotLabel.textContent=label;slot.appendChild(slotLabel);
        slot.setAttribute('aria-label',label+' · '+(name||'尚未裝備'));
        if(!item)slot.title=label+' · 尚未裝備';
        if(item&&DB.items[item.id]){slot.dataset.tipUid=item.uid||key;slot.dataset.tipSrc='party';slot.dataset.tipPartyKind=kind;slot.dataset.tipPartyId=id;slot.removeAttribute('title');}
        host.appendChild(slot);
    }
    for(let i=0;i<2;i++) {
        const button=document.createElement('button');button.type='button';button.className='btn party-equipment-page';button.textContent='裝備 '+(i+1);button.dataset.partyEquipmentPage=i;button.setAttribute('aria-label','裝備第 '+(i+1)+' 頁');button.setAttribute('aria-pressed',String(page===i));toolbar.appendChild(button);
    }
    return '<div class="party-equipment-stage">'+toolbar.outerHTML+partyEquipmentWeightHtml(actor,kind)+frame.outerHTML+'</div>'+(!Object.values(actor.eq||{}).some(Boolean)?'<p class="party-empty">目前沒有裝備。</p>':'');
}
(function () {
    const panel = document.createElement('aside');
    panel.id = 'party-inspector'; panel.className = 'panel'; panel.hidden = true;
    panel.setAttribute('aria-label', '隊友即時狀態'); panel.setAttribute('role','region');
    panel.innerHTML = '<header class="panel-header"><strong id="party-title">隊友狀態</strong><button type="button" id="party-inspector-close" class="btn" aria-label="關閉隊友狀態">關閉 ✕</button></header><nav class="party-tabs" role="tablist" aria-label="隊友資訊分頁"><button type="button" id="party-tab-ability" role="tab" class="btn" aria-controls="party-details" aria-selected="true">能力</button><button type="button" id="party-tab-equipment" role="tab" class="btn" aria-controls="party-details" aria-selected="false">裝備</button></nav><div id="party-details" role="tabpanel" aria-labelledby="party-tab-ability"></div>';
    document.body.appendChild(panel);
    const setting=document.createElement('label');setting.className='party-opacity-control';
    setting.innerHTML='隊友視窗不透明度 <input id="party-opacity" type="range" min="30" max="100" step="5" value="100"><output id="party-opacity-value" for="party-opacity">100%</output>';
    document.querySelector('#tab-automation > div').appendChild(setting);
    let selected = null, owner = null, timer = null, signature = '', returnFocus = null, drag = null, moved = false, userSize = null, sizing = null, opacity=100;
    let currentTab='ability',equipmentPage=0;
    function selectTab(tab){panel.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));currentTab=tab;signature='';document.getElementById('party-details').scrollTop=0;refresh();positionPanel();}
    document.getElementById('party-tab-ability').onclick=()=>selectTab('ability');
    document.getElementById('party-tab-equipment').onclick=()=>selectTab('equipment');
    const prefKey='lineage_party_window_v1';
    const minPanelHeight=400;   // keeps the 4:3 equipment canvas large enough for readable sockets
    try { const p=JSON.parse(_lsGet(prefKey));if(p){if(Number.isFinite(p.width)&&p.width>=240&&Number.isFinite(p.height)&&p.height>=160)userSize={width:p.width,height:p.height};if(Number.isFinite(p.opacity))opacity=Math.max(30,Math.min(100,p.opacity));}}catch(e){}
    function applyOpacity(){panel.style.opacity=opacity/100;document.getElementById('party-opacity').value=opacity;document.getElementById('party-opacity-value').textContent=opacity+'%';}
    function persist(){const saved=_lsSet(prefKey,JSON.stringify({...userSize,opacity}))===true;document.getElementById('party-window-status').textContent=saved?'':'隊友視窗設定未儲存，請重試。';}
    const status=document.createElement('output');status.id='party-window-status';status.setAttribute('role','status');setting.after(status);
    document.getElementById('party-opacity').addEventListener('input',event=>{opacity=Number(event.target.value);applyOpacity();persist();});applyOpacity();
    const statusNames = {...PLAYER_DEBUFF_NAME, sleep:'沉睡', bleed:'出血', slowAtk:'攻速緩慢', armorBreak:'破壞盔甲', bind:'束縛', cleave:'切割'};
    function findMember(kind, id) {
        const allies = (player.allies || []).filter(Boolean);
        if (kind === 'ally') return allies.find(a => String(a._slot) === id);
        if (kind === 'pet') return petsOutList().find(p => String(p.uid) === id);
        if (kind === 'summon') return summonV2List().concat(necroSkeletonList()).find(s => String(s.uid) === id);
        if (kind === 'merc-summon') return allies.find(a => String(a._slot) === id)?.summon;
        if (kind === 'guard') return guardV2List().find(g => String(g.uid) === id);
        return null;
    }
    window.partyMemberById=findMember;
    function secondsText(value) { return Math.ceil(value) + ' 秒'; }
    function nameFor(key) { return DB.skills[key]?.n || BUFF_NAMES[key] || PET_LURES[key]?.n || '其他增益'; }
    function effectRow(key, name, time, type = 'buff', source = '自身') {
        return effectIconHtml(key, time === '常駐' || time === '職業常駐' ? null : parseFloat(time), source, type);
    }
    function buffsFor(actor, minion) {
        const rows = [], seen = new Set();
        for (const [key, value] of Object.entries(actor.buffs || {})) {
            if (!(value > 0)) continue;
            rows.push(effectRow(key, nameFor(key), secondsText(value))); seen.add(key);
        }
        if (actor._equipHaste && !seen.has('haste')) rows.push(effectRow('equip-haste', '裝備加速', '常駐'));
        if (actor._mercPermanentPotions) {
            rows.push(effectRow('merc-haste', '加速', '職業常駐', 'buff', '職業常駐'));
            const potion = ['knight','dragon','warrior','royal'].includes(actor.cls) ? 'brave' : actor.cls === 'mage' ? 'cautious' : actor.cls === 'elf' ? 'elfcookie' : '';
            if (potion) rows.push(effectRow('merc-'+potion, nameFor(potion), '職業常駐', 'buff', '職業常駐'));
        }
        if (!actor._downed) {
            const auraIds = TEAM_AURA_SKILLS.concat(minion ? ['sk_illu_golem','sk_illu_avatar','sk_illu_ogre','sk_illu_lich'] : []);
            const providers = [player, ...(player.allies || [])].filter(a => a && a !== actor && !a._downed && !a.dead);
            for (const key of auraIds) {
                if (seen.has(key) || !_teamAuraHas(key, actor)) continue;
                const duration = Math.max(0, ...providers.map(a => a.buffs?.[key] || 0));
                rows.push(effectRow(key, nameFor(key)+'（隊友提供）', secondsText(duration), 'buff', '隊友提供')); seen.add(key);
            }
            for (const [key, hot] of Object.entries(player.hots || {})) {
                if (hot.ticksLeft > 0 && !seen.has(key)) rows.push(effectRow(key, nameFor(key)+'（持續回復）', secondsText(((hot.ticksLeft - 1) * (hot.interval || 0) + (hot.cd || 0)) / 10)));
            }
        }
        return rows.join('') || '<li class="party-empty">目前沒有增益</li>';
    }
    function refresh() {
        if (!selected) return;
        if (owner !== player || !player.cls || document.getElementById('game-screen').classList.contains('hidden')) { close(); return; }
        const actor = findMember(selected.kind, selected.id);
        if (!actor) {
            panel.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));
            document.getElementById('party-details').innerHTML = '<p class="party-empty">此隊友已離隊或已消失。</p>';
            clearInterval(timer); timer = null; return;
        }
        const minion = selected.kind !== 'ally';
        const summonOwner = selected.kind === 'merc-summon' ? (player.allies || []).find(a => String(a._slot) === selected.id) : actor._necroSkeleton ? _necroOwnerByKey(actor._necroOwnerKey) || player : player;
        const statuses = _supStatuses(actor) || {};
        const debuffs = Object.entries(statusNames).filter(([key]) => statuses[key] > 0).map(([key, name]) => effectRow(key, name, secondsText(statuses[key] / 10), 'status')).join('') || '<li class="party-empty">目前沒有異常狀態</li>';
        const name = selected.kind === 'ally' ? actor._allyName || '隊友' : actor.form || actor.n || '隊友';
        const condition = actor._downed || _supHp(actor) <= 0 ? '倒地' : DB.towns[mapState.current] ? '就緒' : '戰鬥中';
        const bonus = currentTab==='ability'?partyBonusSnapshot(actor, selected.kind, summonOwner):null;
        const html = currentTab==='equipment' ? partyEquipmentHtml(actor,selected.kind,selected.id,equipmentPage) : `<p class="party-caption">Lv.${actor.lv || 1} · <span id="party-condition">${condition}</span> · 即時更新</p>
            <h3>生效增益</h3><ul class="party-effects">${buffsFor(actor, minion)}</ul>
            <h3>異常狀態</h3><ul class="party-effects party-debuffs">${debuffs}</ul>${partyBonusHtml(bonus)}`;
        for(const tab of ['ability','equipment']){const button=document.getElementById('party-tab-'+tab);button.setAttribute('aria-selected',String(currentTab===tab));button.tabIndex=currentTab===tab?0:-1;}
        document.getElementById('party-details').setAttribute('aria-labelledby','party-tab-'+currentTab);
        document.getElementById('party-title').textContent = name + (actor.cls && CLAN_CLASS_NAMES[actor.cls] ? '（'+CLAN_CLASS_NAMES[actor.cls]+'）' : '');
        if (html !== signature) {
            const details = document.getElementById('party-details'), draft = document.createElement('div'); draft.innerHTML = html;
            const focused = document.activeElement, scroll = details.scrollTop, artwork = details.querySelector('.party-art-scroll'), artScroll = {x:artwork?.scrollLeft||0,y:artwork?.scrollTop||0};
            let hoveredSlot=null;
            for(const node of draft.querySelectorAll('[data-equipment-slot]')) {
                const old=details.querySelector('[data-equipment-slot="'+node.dataset.equipmentSlot+'"]');
                if(old){if(old.matches(':hover'))hoveredSlot=old;for(const a of Array.from(old.attributes))old.removeAttribute(a.name);for(const a of node.attributes)old.setAttribute(a.name,a.value);old.replaceChildren(...node.childNodes);node.replaceWith(old);}
            }
            for (const node of draft.querySelectorAll('[data-party-control]')) {
                const old = Array.from(details.querySelectorAll('[data-party-control]')).find(e => e.dataset.partyControl === node.dataset.partyControl);
                if (old) { for (const a of node.attributes) old.setAttribute(a.name, a.value); if(old.tagName==='SELECT')old.value=node.value;else old.textContent = node.textContent; node.replaceWith(old); }
            }
            for (const node of draft.querySelectorAll('[data-effect-id]')) {
                const old = Array.from(details.querySelectorAll('[data-effect-id]')).find(e => e.dataset.effectId === node.dataset.effectId && e.dataset.effectSource === node.dataset.effectSource);
                if (old) { old.dataset.effectSeconds = node.dataset.effectSeconds; old.setAttribute('aria-label', node.getAttribute('aria-label')); old.querySelector('small').textContent = node.querySelector('small').textContent; old.className=node.className; node.replaceWith(old); }
            }
            for(const node of draft.querySelectorAll('[data-ability-field]')) {
                const old=details.querySelector('[data-ability-field="'+node.dataset.abilityField+'"]');
                if(old){for(const a of node.attributes)old.setAttribute(a.name,a.value);old.innerHTML=node.innerHTML;node.replaceWith(old);}
            }
            details.replaceChildren(...draft.childNodes); details.scrollTop = scroll;
            const nextArtwork=details.querySelector('.party-art-scroll');if(nextArtwork){nextArtwork.scrollLeft=artScroll.x;nextArtwork.scrollTop=artScroll.y;}
            if (focused?.isConnected && details.contains(focused)) focused.focus({preventScroll:true});
            signature = html;
            fitPartyAbilityValues();fitEquipment();
            if(hoveredSlot){if(hoveredSlot.dataset.tipSrc==='party')showEquipmentTip({target:hoveredSlot});else panel.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));}
        }
    }
    panel.addEventListener('click',event=>{
        const pageButton=event.target.closest('[data-party-equipment-page]');
        if(pageButton){panel.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));equipmentPage=Number(pageButton.dataset.partyEquipmentPage);signature='';refresh();return;}
        showEquipmentTip(event);
    });
    panel.addEventListener('focusin',showEquipmentTip);
    function showEquipmentTip(event){
        const slot=event.target.closest('[data-tip-src="party"]');if(!slot)return;
        const r=slot.getBoundingClientRect();slot.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
    }
    function fitEquipment(){
        const details=document.getElementById('party-details'),frame=details.querySelector('.party-equipment-frame');if(!frame)return;
        const style=getComputedStyle(details),paddingX=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight);
        const canvasWidth=Math.max(1,details.clientWidth-paddingX),layout=equipmentView.positionSlots(frame.querySelector('.equipment-window-slots'),canvasWidth,equipmentPage),canvasHeight=layout.height;
        frame.style.setProperty('--party-equipment-height',canvasHeight+'px');
        frame.style.setProperty('--party-equipment-canvas-width',canvasWidth+'px');
        frame.style.setProperty('--party-equipment-canvas-height',canvasHeight+'px');
        const portrait=frame.querySelector('.party-paperdoll-figure .party-roster-portrait');
        if(portrait)portrait.style.transform='scale('+Math.min(canvasWidth*.88/96,canvasHeight*.83/144)+')';
    }
    function close() {
        panel.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));
        const currentButton = selected && Array.from(document.querySelectorAll('button[data-party-kind]')).find(b => b.dataset.partyKind === selected.kind && b.dataset.partyId === selected.id);
        panel.hidden = true; selected = null; owner = null; signature = '';
        clearInterval(timer); timer = null;
        if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
        else if (currentButton?.getClientRects().length) currentButton.focus();
        else document.getElementById('st-class').focus();
    }
    function positionPanel(reset=false) {
        if(panel.hidden)return;
        const narrow=innerWidth<769,z=getUiScale(),r=panel.getBoundingClientRect(),maxWidth=innerWidth-16,maxHeight=innerHeight-16;
        const width=Math.max(Math.min(320*z,maxWidth),Math.min(maxWidth,userSize?userSize.width*z:narrow?maxWidth:520*z));
        panel.style.width=screenToUiPx(width);
        const anchor=document.getElementById('squad-panel').getBoundingClientRect();
        const aligned=!narrow&&anchor.right+12+panel.getBoundingClientRect().width<=innerWidth-8&&anchor.top>=8&&anchor.top<innerHeight-240;
        panel.style.maxHeight=screenToUiPx(userSize?maxHeight:Math.min(maxHeight,innerHeight*(narrow?.60:.82),aligned&&!moved?innerHeight-anchor.top-8:innerHeight));
        panel.style.height=userSize?screenToUiPx(Math.max(Math.min(minPanelHeight*z,maxHeight),Math.min(maxHeight,userSize.height*z))):'';
        const size=panel.getBoundingClientRect();
        const beside=anchor.right+12, below=anchor.bottom+12;
        const x=beside+size.width<=innerWidth-8?beside:anchor.left;
        const y=beside+size.width<=innerWidth-8?anchor.top:below;
        panel.style.left=screenToUiPx(Math.max(8,Math.min(innerWidth-size.width-8,!reset&&moved?r.left:x)));
        panel.style.top=screenToUiPx(Math.max(8,Math.min(innerHeight-size.height-8,!reset&&moved?r.top:y)));
        fitPartyAbilityValues();fitEquipment();
    }
    panel.querySelector('.party-tabs').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();selectTab(currentTab==='ability'?'equipment':'ability');document.getElementById('party-tab-'+currentTab).focus();}});
    const header=panel.querySelector('header');
    header.addEventListener('pointerdown',e=>{
        if(e.target.closest('button,select,input')||e.button!==0)return;
        const r=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);e.preventDefault();
    });
    header.addEventListener('pointermove',e=>{
        if(!drag||drag.id!==e.pointerId)return;
        moved=true;const r=panel.getBoundingClientRect();panel.style.left=screenToUiPx(Math.max(8,Math.min(innerWidth-r.width-8,e.clientX-drag.x)));panel.style.top=screenToUiPx(Math.max(8,Math.min(innerHeight-r.height-8,e.clientY-drag.y)));
    });
    for(const type of ['pointerup','pointercancel'])header.addEventListener(type,()=>drag=null);
    function resizePanel(width,height,x,y) {
        const z=getUiScale();
        const w=Math.max(Math.min(320*z,innerWidth-16),Math.min(innerWidth-16,width)),h=Math.max(Math.min(minPanelHeight*z,innerHeight-16),Math.min(innerHeight-16,height));
        userSize={width:w/z,height:h/z};moved=true;
        panel.style.left=screenToUiPx(Math.max(8,Math.min(innerWidth-w-8,x)));panel.style.top=screenToUiPx(Math.max(8,Math.min(innerHeight-h-8,y)));positionPanel();
    }
    for(const side of ['n','e','s','w','ne','nw','se','sw']) {
        const edge=document.createElement('div');edge.dataset.partyResize=side;edge.className='party-resize-edge';edge.tabIndex=0;edge.setAttribute('role','separator');edge.setAttribute('aria-label','調整隊友視窗大小');edge.title='拖曳邊界調整大小；方向鍵也可調整';if(side==='se')edge.id='party-resize';panel.appendChild(edge);
        edge.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=panel.getBoundingClientRect();sizing={id:e.pointerId,side,x:e.clientX,y:e.clientY,r};edge.setPointerCapture(e.pointerId);e.preventDefault();});
        edge.addEventListener('pointermove',e=>{if(!sizing||sizing.id!==e.pointerId)return;const {r,side}=sizing,dx=e.clientX-sizing.x,dy=e.clientY-sizing.y;const w=r.width+(side.includes('w')?-dx:side.includes('e')?dx:0),h=r.height+(side.includes('n')?-dy:side.includes('s')?dy:0);resizePanel(w,h,side.includes('w')?r.right-Math.max(Math.min(320*getUiScale(),innerWidth-16),Math.min(innerWidth-16,w)):r.left,side.includes('n')?r.bottom-Math.max(Math.min(minPanelHeight*getUiScale(),innerHeight-16),Math.min(innerHeight-16,h)):r.top);});
        for(const type of ['pointerup','pointercancel'])edge.addEventListener(type,()=>{if(sizing){sizing=null;persist();}});
        edge.addEventListener('keydown',e=>{const d={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(!d)return;e.preventDefault();const r=panel.getBoundingClientRect();resizePanel(r.width+d[0],r.height+d[1],r.left,r.top);persist();});
    }
    let resizeFrame=0;
    new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;fitPartyAbilityValues();fitEquipment();if(!panel.hidden)positionPanel();});}).observe(panel);
    addEventListener('resize',()=>positionPanel());
    addEventListener('ui-scale-change',()=>positionPanel());
    addEventListener('scroll',()=>{if(!moved)positionPanel();},{passive:true});
    window.positionPartyInspector=positionPanel;
    document.getElementById('party-inspector-close').addEventListener('click', close);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented && !panel.hidden) close(); });
    window.refreshPartyInspector = refresh;
    window.openPartyInspector = function (kind, id, button = document.activeElement) {
        currentTab='ability';equipmentPage=0;returnFocus = button; selected = {kind, id:String(id)}; owner = player; signature = ''; moved = false;
        panel.dataset.kind=kind;panel.dataset.id=String(id);
        panel.hidden = false;document.getElementById('party-details').scrollTop=0;clearInterval(timer); refresh();
        if (selected) { timer = setInterval(refresh, 250); document.getElementById('party-inspector-close').focus({preventScroll:true}); positionPanel(true); }
    };
    document.getElementById('squad-panel').addEventListener('click', event => {
        const button = event.target.closest('[data-party-kind]'); if (!button) return;
        openPartyInspector(button.dataset.partyKind, button.dataset.partyId, button);
    });
})();
