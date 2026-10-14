// Reuse the original sprite and alpha bounds in roster rows and equipment headers.
function companionDisplayForm(actor) {
    return String(actor._v2form || actor.form || actor.n || '').replace(/^(夥伴|召喚)：/, '').replace(/(?: ×\d+| Lv\.\d+)$/, '');
}
function companionSpriteForm(actor) {
    if (actor.formGfx) return actor.formGfx;
    const name = companionDisplayForm(actor), spirit = /^(?:強力)?([水火風地])之精靈(王)?$/.exec(name);
    if (actor.skId === 'sk_elf_summon' || actor.skId === 'sk_elf_summon2' || spirit) {
        const element = SPIRIT_ELE_ZH[actor.ele] || (spirit && spirit[1]);
        if (element) return (actor._king || (spirit && spirit[2]) ? '強力' : '') + element + '屬性精靈';
    }
    return name;
}
function summonDisplayName(actor, owner) {
    return (owner._allyName || _clanRoleDisplayName(owner)) + '·' + companionDisplayForm(actor);
}
function partyStatusText(actor) {
    const statuses = actor?.statuses || actor?._statuses || {};
    return [['stun','暈眩'],['freeze','冰凍'],['stone','石化'],['paralyze','麻痺'],['sleep','沉睡'],['silence','沉默'],['magicseal','魔封'],['poison','中毒'],['burn','灼燒'],['scald','燙傷'],['bleed','出血'],['slowAtk','緩速'],['weaken','弱化'],['disease','疾病'],['blind','目盲'],['potionFrost','藥水霜化'],['foulWater','汙濁之水']].filter(([key])=>statuses[key]>0).map(([,name])=>name).join('·');
}
function partyPortraitNode(actor,kind,width=32,height=48) {
    const avatars={royal:'王子',knight:'男騎士',mage:'男法師',elf:'女妖精',dark:'男黑暗妖精',dragon:'男龍騎士',illusion:'男幻術士',warrior:'男戰士'};
    let src;
    if(kind==='ally') {
        const avatar=CLASS_BATTLE_ANIM.has(actor.avatar)?actor.avatar:avatars[actor.cls];
        const form=_classForm({...actor,avatar,_faceD:2},false);
        src=form?form.base+form.wpn+'_idle_0.png':'';
    }else src='assets/anim/'+encodeURIComponent(_animDir(companionSpriteForm(actor)))+'/d6/idle_0.png';
    const image=document.createElement('span');image.className='party-roster-portrait';image.style.width=width+'px';image.style.height=height+'px';
    if(src){const img=document.createElement('img');img.src=src;img.alt='';img.setAttribute('onerror','this.hidden=true');const b=PARTY_PORTRAIT_BOUNDS[decodeURIComponent(src)];if(b){const scale=Math.min(width/b[4],height/b[5]);img.style.cssText='position:absolute;max-width:none;max-height:none;width:'+b[0]*scale+'px;height:'+b[1]*scale+'px;left:'+((width-b[4]*scale)/2-b[2]*scale)+'px;top:'+((height-b[5]*scale)/2-b[3]*scale)+'px;';}image.appendChild(img);}
    return image;
}
// Decorate native team rows; keep all existing actor ids, bars and controls.
function decoratePartyRoster(host) {
    const types={ally:'隊友',pet:'寵物',summon:'召喚','merc-summon':'召喚',guard:'護衛'};
    for(const row of Array.from(host.children)) {
        const button=row.querySelector('[data-party-kind]');
        if(!button){if(row.querySelector('button,input')||row.textContent.includes('等待'))row.classList.add('party-roster-note');else row.remove();continue;}
        const kind=button.dataset.partyKind,actor=partyMemberById(kind,button.dataset.partyId);
        if(!actor)continue;
        const portrait=row.querySelector('img');if(portrait)portrait.remove();
        const body=document.createElement('div');body.className='party-roster-body';body.append(...Array.from(row.childNodes));
        let exp=body.querySelector('.ally-exp-bar');
        if(kind==='pet'&&!actor._downed){
            const text=Array.from(body.querySelectorAll('span')).find(e=>!e.children.length&&/^EXP /.test(e.textContent));if(text)text.remove();
            const pct=Math.min(100,Math.max(0,(actor.exp||0)/petExpReq(actor.lv)*100));
            exp=document.createElement('div');exp.className='bar-bg ally-exp-bar';exp.innerHTML='<div class="bar-fill bg-yellow-500" style="width:'+pct+'%"></div><div class="bar-text">'+pct.toFixed(1)+'%</div>';
        }
        {
            const oldHeading=button.parentElement;
            const head=document.createElement('div');head.className='party-roster-heading';head.appendChild(button);
            if(kind==='pet')button.textContent=actor.form;
            if(kind==='ally'||kind==='pet') {
                const status=body.querySelector('[id^="squad-status-"]')||document.createElement('span');
                status.className='party-roster-status';status.textContent=partyStatusText(actor);status.title=status.textContent;head.appendChild(status);
            }
            const badge=body.querySelector('.party-class');if(badge)head.appendChild(badge);
            for(const node of oldHeading.querySelectorAll('span'))if(!node.children.length&&/^Lv\./.test(node.textContent.trim()))node.remove();
            if(exp&&exp.parentElement===oldHeading)body.appendChild(exp);
            if(!oldHeading.textContent.trim()&&!oldHeading.querySelector('button,input,.bar-bg'))oldHeading.remove();
            if(actor.lv&&kind!=='summon'&&kind!=='merc-summon'){const lv=document.createElement('span');lv.className='party-roster-level';lv.textContent='Lv.'+actor.lv;head.appendChild(lv);}
            body.prepend(head);
            if(kind==='summon'||kind==='merc-summon'||kind==='guard'){const bar=body.querySelector('.bar-bg');if(bar){bar.title='HP';bar.classList.add('compact-team-bar');}}
        }
        for(const node of Array.from(body.children))if(!node.id&&!node.textContent.trim()&&!node.querySelector('button,input,.bar-bg'))node.remove();
        if(exp)body.appendChild(exp);
        row.className='party-roster-row';row.style.cssText='';row.dataset.rosterKind=kind;
        if(actor._downed)row.classList.add('is-downed');
        row.replaceChildren();
        const tag=document.createElement('span');tag.className='party-roster-kind';tag.textContent=types[kind];row.appendChild(tag);
        const image=partyPortraitNode(actor,kind);
        row.append(image,body);
    }
}

// Observe opaque sprite pixels without adding hit boxes over the battle controls.
(function () {
    const pixels = new WeakMap();
    const fileGroups = new Map();
    let tooltip, active, activeMap, pointer, watchFrame = 0;
    window.registerMapHitMasks = async function (group, packed) {
        const bytes = Uint8Array.from(atob(packed), c => c.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
        fileGroups.set(group, await new Response(stream).json());
        if (pointer) move(pointer);
    };
    function fileMask(image) {
        const match = /\/assets\/(anim|classanim|morphanim)\/([^/]+)\/(.+)$/.exec(decodeURIComponent(new URL(image.src).pathname));
        if (!match) return null;
        const family = match[1] === 'anim' ? match[2] : match[2].replace(/(?:d[0-7]|2|F)$/, '');
        const group = match[1] + '/' + family;
        if (!fileGroups.has(group)) {
            fileGroups.set(group, null);
            const script = document.createElement('script');
            script.src = 'assets/map-hit-masks/' + match[1] + '/' + encodeURIComponent(family) + '.js';
            script.onload = () => script.remove();
            script.onerror = () => { fileGroups.set(group, {}); script.remove(); };
            document.head.appendChild(script);
        }
        const data = fileGroups.get(group);
        return data?.masks?.[data.frames[match[2] + '/' + match[3]]];
    }
    function hide() {
        active = null;
        cancelAnimationFrame(watchFrame); watchFrame = 0;
        if (tooltip) tooltip.hidden = true;
    }
    function opaqueAt(image, x, y) {
        const rect = image.getBoundingClientRect();
        if (!image.complete || !image.naturalWidth || !rect.width || !rect.height || x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return false;
        let cache = pixels.get(image);
        if (!cache || cache.src !== image.src) {
            if (location.protocol === 'file:') {
                const mask = fileMask(image);
                if (!mask) return false;
                cache = {src:image.src, bits:atob(mask[2]), stride:Math.ceil(mask[0] / 8)};
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d', {willReadFrequently:true});
                ctx.drawImage(image, 0, 0);
                cache = {src:image.src, data:ctx.getImageData(0, 0, canvas.width, canvas.height).data};
            }
            pixels.set(image, cache);
        }
        const px = Math.floor((x - rect.left) / rect.width * image.naturalWidth);
        const py = Math.floor((y - rect.top) / rect.height * image.naturalHeight);
        return cache.bits ? !!(cache.bits.charCodeAt(py * cache.stride + (px >> 3)) & (128 >> (px & 7))) : cache.data[(py * image.naturalWidth + px) * 4 + 3] > 0;
    }
    function watch() {
        watchFrame = 0;
        if (!active) return;
        if (!active.isConnected || !active.checkVisibility() || mapState.current !== activeMap) { hide(); return; }
        tooltip.textContent = active.dataset.mapName;
        watchFrame = requestAnimationFrame(watch);
    }
    function move(event) {
        pointer = {clientX:event.clientX, clientY:event.clientY};
        const battle = document.getElementById('battle-view');
        if (!battle || !battle.checkVisibility() || !battle.contains(document.elementFromPoint(event.clientX, event.clientY))) { hide(); return; }
        const images = Array.from(battle.querySelectorAll('img[data-map-name]')).reverse();
        let image;
        for (const candidate of images) {
            if (candidate.checkVisibility() && opaqueAt(candidate, event.clientX, event.clientY)) { image = candidate; break; }
        }
        if (!image) { hide(); return; }
        if (!tooltip) {
            tooltip = document.createElement('div'); tooltip.id = 'map-name-tooltip';
            tooltip.setAttribute('role', 'tooltip'); document.body.appendChild(tooltip);
        }
        active = image; activeMap = mapState.current;
        tooltip.textContent = image.dataset.mapName; tooltip.hidden = false;
        tooltip.style.maxWidth = screenToUiPx(innerWidth - 16);
        const rect = tooltip.getBoundingClientRect();
        tooltip.style.left = screenToUiPx(Math.max(8, Math.min(event.clientX + 12, innerWidth - rect.width - 8)));
        tooltip.style.top = screenToUiPx(Math.max(8, Math.min(event.clientY + 16, innerHeight - rect.height - 8)));
        if (!watchFrame) watchFrame = requestAnimationFrame(watch);
    }
    document.addEventListener('pointermove', move, {passive:true});
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) { pointer = null; hide(); } });
    function clearPointer() { pointer = null; hide(); }
    document.addEventListener('scroll', clearPointer, true);
    window.addEventListener('blur', clearPointer);
    window.addEventListener('resize', clearPointer);
})();
