// Reuse the original sprite and alpha bounds in roster rows and equipment headers.
function partyPortraitNode(actor,kind,width=32,height=48) {
    const avatars={royal:'王子',knight:'男騎士',mage:'男法師',elf:'女妖精',dark:'男黑暗妖精',dragon:'男龍騎士',illusion:'男幻術士',warrior:'男戰士'};
    let src;
    if(kind==='ally') {
        const avatar=CLASS_BATTLE_ANIM.has(actor.avatar)?actor.avatar:avatars[actor.cls];
        const form=_classForm({...actor,avatar,_faceD:2},false);
        src=form?form.base+form.wpn+'_idle_0.png':'';
    }else src='assets/anim/'+encodeURIComponent(_animDir(actor.formGfx||actor.form||actor.n||''))+'/d6/idle_0.png';
    const image=document.createElement('span');image.className='party-roster-portrait';image.style.width=width+'px';image.style.height=height+'px';
    if(src){const img=document.createElement('img');img.src=src;img.alt='';img.setAttribute('onerror','this.hidden=true');const b=PARTY_PORTRAIT_BOUNDS[decodeURIComponent(src)];if(b){const scale=Math.min(width/b[4],height/b[5]);img.style.cssText='position:absolute;max-width:none;max-height:none;width:'+b[0]*scale+'px;height:'+b[1]*scale+'px;left:'+((width-b[4]*scale)/2-b[2]*scale)+'px;top:'+((height-b[5]*scale)/2-b[3]*scale)+'px;';}image.appendChild(img);}
    return image;
}
// Decorate native team rows; keep all existing actor ids, bars and controls.
function decoratePartyRoster(host) {
    const types={ally:'隊友',pet:'寵物',summon:'召喚','merc-summon':'召喚',guard:'護衛'};
    let groupTimer='';
    for(const row of Array.from(host.children)) {
        const button=row.querySelector('[data-party-kind]');
        if(!button){if(row.querySelector('button,input')||row.textContent.includes('等待'))row.classList.add('party-roster-note');else{groupTimer=row.querySelector('.text-slate-400')?.textContent.trim()||'';row.remove();}continue;}
        const kind=button.dataset.partyKind,actor=partyMemberById(kind,button.dataset.partyId);
        if(!actor)continue;
        const portrait=row.querySelector('img');if(portrait)portrait.remove();
        const body=document.createElement('div');body.className='party-roster-body';body.append(...Array.from(row.childNodes));
        let exp=body.querySelector('.ally-exp-bar');
        if(kind==='pet'&&!actor._downed){
            const text=Array.from(body.querySelectorAll('span')).find(e=>!e.children.length&&/^EXP /.test(e.textContent));if(text)text.remove();
            const input=body.querySelector('input[onchange*="petSetPotPct"]');if(input){const control=input.closest('span');control.classList.add('party-roster-action');body.appendChild(control);}
            const pct=Math.min(100,Math.max(0,(actor.exp||0)/petExpReq(actor.lv)*100));
            exp=document.createElement('div');exp.className='bar-bg ally-exp-bar';exp.innerHTML='<div class="bar-fill bg-yellow-500" style="width:'+pct+'%"></div><div class="bar-text">'+pct.toFixed(1)+'%</div>';
        }
        {
            const oldHeading=button.parentElement;
            const head=document.createElement('div');head.className='party-roster-heading';head.appendChild(button);
            if(kind==='pet')button.textContent=actor.form;
            const badge=body.querySelector('.party-class');if(badge)head.appendChild(badge);
            for(const node of oldHeading.querySelectorAll('span'))if(!node.children.length&&/^Lv\./.test(node.textContent.trim()))node.remove();
            if(exp&&exp.parentElement===oldHeading)body.appendChild(exp);
            if(!oldHeading.textContent.trim()&&!oldHeading.querySelector('button,input,.bar-bg'))oldHeading.remove();
            if(actor.lv){const lv=document.createElement('span');lv.className='party-roster-level';lv.textContent='Lv.'+actor.lv;head.appendChild(lv);}
            if(kind==='summon'&&groupTimer){const remain=document.createElement('span');remain.className='party-roster-level';remain.title='召喚剩餘時間';remain.textContent=groupTimer;head.appendChild(remain);}
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
