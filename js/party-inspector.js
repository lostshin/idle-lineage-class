// Read live combat actors without changing their state or interrupting combat.
function partyEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function partyNameButton(kind, id, name, className = '') {
    return `<button type="button" class="party-name ${className}" data-party-kind="${kind}" data-party-id="${partyEscape(id)}" title="查看即時狀態" aria-controls="party-inspector">${partyEscape(name)}</button>`;
}
(function () {
    const panel = document.createElement('aside');
    panel.id = 'party-inspector'; panel.className = 'panel'; panel.hidden = true;
    panel.setAttribute('aria-label', '隊友即時狀態'); panel.setAttribute('role','region');
    panel.innerHTML = '<header class="panel-header"><strong id="party-title">隊友狀態</strong><button type="button" id="party-inspector-close" class="btn" aria-label="關閉隊友狀態">關閉 ✕</button></header><label class="party-opacity-control">不透明度 <input id="party-opacity" type="range" min="30" max="100" step="5" value="100"><output id="party-opacity-value" for="party-opacity">100%</output></label><div id="party-details"></div><footer class="party-window-footer"><small>拖曳右下角調整大小</small><button id="party-resize" type="button" aria-label="調整隊友視窗大小" title="拖曳調整大小；方向鍵也可調整">↘</button></footer>';
    document.body.appendChild(panel);
    let selected = null, owner = null, timer = null, signature = '', returnFocus = null, drag = null, moved = false, userSize = null, sizing = null;
    document.getElementById('party-opacity').addEventListener('input', event => {
        panel.style.opacity = Number(event.target.value) / 100;
        document.getElementById('party-opacity-value').textContent = event.target.value + '%';
    });
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
            document.getElementById('party-details').innerHTML = '<p class="party-empty">此隊友已離隊或已消失。</p>';
            clearInterval(timer); timer = null; return;
        }
        const minion = selected.kind !== 'ally';
        const summonOwner = selected.kind === 'merc-summon' ? (player.allies || []).find(a => String(a._slot) === selected.id) : actor._necroSkeleton ? _necroOwnerByKey(actor._necroOwnerKey) || player : player;
        const d = selected.kind === 'pet' ? petDerive(actor) || {} : selected.kind === 'guard' ? guardDerive(actor) : minion ? _sumDeriveAny(actor, summonOwner) : actor.d || {};
        const statuses = _supStatuses(actor) || {};
        const ac = (d.ac || 0) - teamAcBonus(actor, minion) + ((selected.kind === 'ally' || selected.kind === 'pet') && statuses.disease > 0 ? 8 : 0);
        const debuffs = Object.entries(statusNames).filter(([key]) => statuses[key] > 0).map(([key, name]) => effectRow(key, name, secondsText(statuses[key] / 10), 'status')).join('') || '<li class="party-empty">目前沒有異常狀態</li>';
        const name = selected.kind === 'ally' ? actor._allyName || '隊友' : actor.form || actor.n || '隊友';
        const mmp = selected.kind === 'pet' ? (actor.mmp || 0) + (d.mmpBonus || 0) : actor.mmp || 0;
        const condition = actor._downed || _supHp(actor) <= 0 ? '倒地' : DB.towns[mapState.current] ? '就緒' : '戰鬥中';
        const bonus = partyBonusSnapshot(actor, selected.kind, summonOwner);
        const html = `<p class="party-caption">Lv.${actor.lv || 1} · <span id="party-condition">${condition}</span> · 即時更新</p>
            <h3>生效增益</h3><ul class="party-effects">${buffsFor(actor, minion)}</ul>
            <h3>異常狀態</h3><ul class="party-effects party-debuffs">${debuffs}</ul>${partySummaryHtml(bonus,actor,{ac,d,mmp})}${partyBonusHtml(bonus)}`;
        document.getElementById('party-title').textContent = name;
        if (html !== signature) {
            const details = document.getElementById('party-details'), draft = document.createElement('div'); draft.innerHTML = html;
            const focused = document.activeElement, scroll = details.scrollTop, artwork = details.querySelector('.party-art-scroll'), artScroll = {x:artwork?.scrollLeft||0,y:artwork?.scrollTop||0};
            for (const node of draft.querySelectorAll('[data-party-control]')) {
                const old = Array.from(details.querySelectorAll('[data-party-control]')).find(e => e.dataset.partyControl === node.dataset.partyControl);
                if (old) { for (const a of node.attributes) old.setAttribute(a.name, a.value); if(old.tagName==='SELECT')old.value=node.value;else old.textContent = node.textContent; node.replaceWith(old); }
            }
            for (const node of draft.querySelectorAll('[data-effect-id]')) {
                const old = Array.from(details.querySelectorAll('[data-effect-id]')).find(e => e.dataset.effectId === node.dataset.effectId && e.dataset.effectSource === node.dataset.effectSource);
                if (old) { old.dataset.effectSeconds = node.dataset.effectSeconds; old.setAttribute('aria-label', node.getAttribute('aria-label')); old.querySelector('small').textContent = node.querySelector('small').textContent; node.replaceWith(old); }
            }
            for(const node of draft.querySelectorAll('[data-ability-field]')) {
                const old=details.querySelector('[data-ability-field="'+node.dataset.abilityField+'"]');
                if(old){for(const a of node.attributes)old.setAttribute(a.name,a.value);old.innerHTML=node.innerHTML;node.replaceWith(old);}
            }
            details.replaceChildren(...draft.childNodes); details.scrollTop = scroll;
            const nextArtwork=details.querySelector('.party-art-scroll');if(nextArtwork){nextArtwork.scrollLeft=artScroll.x;nextArtwork.scrollTop=artScroll.y;}
            if (focused?.isConnected && details.contains(focused)) focused.focus({preventScroll:true});
            signature = html;
            fitPartyAbilityValues();
        }
    }
    function close() {
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
        panel.style.height=userSize?screenToUiPx(Math.max(Math.min(240*z,maxHeight),Math.min(maxHeight,userSize.height*z))):'';
        const size=panel.getBoundingClientRect();
        const beside=anchor.right+12, below=anchor.bottom+12;
        const x=beside+size.width<=innerWidth-8?beside:anchor.left;
        const y=beside+size.width<=innerWidth-8?anchor.top:below;
        panel.style.left=screenToUiPx(Math.max(8,Math.min(innerWidth-size.width-8,!reset&&moved?r.left:x)));
        panel.style.top=screenToUiPx(Math.max(8,Math.min(innerHeight-size.height-8,!reset&&moved?r.top:y)));
        fitPartyAbilityValues();
    }
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
    const resize=panel.querySelector('#party-resize');
    function resizePanel(width,height) {
        const z=getUiScale();
        userSize={width:Math.max(Math.min(320,(innerWidth-16)/z),Math.min((innerWidth-16)/z,width/z)),height:Math.max(Math.min(240,(innerHeight-16)/z),Math.min((innerHeight-16)/z,height/z))};
        moved=true;positionPanel();
    }
    resize.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        const r=panel.getBoundingClientRect();sizing={id:e.pointerId,x:e.clientX,y:e.clientY,width:r.width,height:r.height};
        resize.setPointerCapture(e.pointerId);e.preventDefault();
    });
    resize.addEventListener('pointermove',e=>{
        if(!sizing||sizing.id!==e.pointerId)return;
        resizePanel(sizing.width+e.clientX-sizing.x,sizing.height+e.clientY-sizing.y);
    });
    for(const type of ['pointerup','pointercancel'])resize.addEventListener(type,()=>sizing=null);
    resize.addEventListener('keydown',e=>{
        const delta={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];
        if(!delta)return;e.preventDefault();const r=panel.getBoundingClientRect();resizePanel(r.width+delta[0],r.height+delta[1]);
    });
    new ResizeObserver(fitPartyAbilityValues).observe(panel);
    addEventListener('resize',()=>positionPanel());
    addEventListener('ui-scale-change',()=>positionPanel());
    addEventListener('scroll',()=>{if(!moved)positionPanel();},{passive:true});
    window.positionPartyInspector=positionPanel;
    document.getElementById('party-inspector-close').addEventListener('click', close);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented && !panel.hidden) close(); });
    window.refreshPartyInspector = refresh;
    window.openPartyInspector = function (kind, id, button = document.activeElement) {
        returnFocus = button; selected = {kind, id:String(id)}; owner = player; signature = ''; moved = false;
        panel.hidden = false;document.getElementById('party-details').scrollTop=0;clearInterval(timer); refresh();
        if (selected) { timer = setInterval(refresh, 250); document.getElementById('party-inspector-close').focus({preventScroll:true}); positionPanel(true); }
    };
    document.getElementById('squad-panel').addEventListener('click', event => {
        const button = event.target.closest('[data-party-kind]'); if (!button) return;
        openPartyInspector(button.dataset.partyKind, button.dataset.partyId, button);
    });
})();
