// The guild reuses native roster, quest and transactional equipment handlers.
(function () {
    const win = document.createElement('section');
    win.id = 'guild-window'; win.className = 'warehouse-window hidden'; win.setAttribute('aria-hidden', 'true');
    win.innerHTML = '<div id="guild-window-frame" class="warehouse-window-frame" role="dialog" aria-labelledby="guild-title"><header id="guild-window-drag" class="warehouse-window-header"><h2 id="guild-title">傭兵公會</h2><button type="button" id="guild-window-close" class="btn" aria-label="關閉傭兵公會">×</button></header><div id="guild-member-strip" aria-label="選擇出戰隊員"></div><div id="guild-content-host"></div></div>';
    document.getElementById('app-stage').appendChild(win);
    const frame = win.firstElementChild, content = document.getElementById('interaction-content');
    const home = content.parentElement, next = content.nextSibling;
    let selectedRole = '', equipmentRole = '', page = 0, slot = '', category = 'all', search = '', candidate = '', scroll = 0, view = 'roster';
    const isOpen = () => !win.classList.contains('hidden');
    function close() {
        win.classList.add('hidden'); win.setAttribute('aria-hidden', 'true');
        content.classList.remove('guild-content','guild-equipment-content');
        home.insertBefore(content, next);
    }
    const fit = bindClassicWindow(frame, document.getElementById('guild-window-drag'), document.getElementById('guild-window-close'), isOpen, () => view === 'equipment' ? renderAllyNPC(content) : close(), 'guild');
    function mount() {
        if (!isOpen()) {
            closeNpcInteraction();
            win.classList.remove('hidden'); win.setAttribute('aria-hidden', 'false');
            document.getElementById('guild-content-host').appendChild(content); content.classList.add('guild-content');
        }
        fit();
    }
    function setView(nextView) {
        view = nextView;
        frame.classList.toggle('guild-equipment-view', view === 'equipment');
        const back = document.getElementById('guild-window-close');
        back.textContent = view === 'equipment' ? '返回' : '×';
        back.setAttribute('aria-label', view === 'equipment' ? '返回名冊' : '關閉傭兵公會');
        const strip = document.getElementById('guild-member-strip'); strip.replaceChildren(); strip.hidden = view === 'roster';
        const members = player.allies || [];
        if (!members.length) return;
        const select = document.createElement('select'); select.id = 'guild-member-select'; select.setAttribute('aria-label','選擇出戰隊員');
        for (const ally of members) {
            const option = document.createElement('option'); option.value = String(ally._slot);
            option.textContent = (ally._allyName || ally.name || '未命名') + ' · ' + (CLAN_CLASS_NAMES[ally.cls] || '') + ' Lv.' + ally.lv;
            select.appendChild(option);
        }
        select.value = selectedRole;
        select.onchange = () => view === 'quests' ? openAllyQuestManager(select.value) : openAllyEquipmentManager(select.value);
        select.title = select.selectedOptions[0]?.textContent || '';
        for (const direction of [-1,1]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'btn guild-member-step'; button.textContent = direction < 0 ? '‹' : '›';
            button.setAttribute('aria-label',direction < 0 ? '上一名隊員' : '下一名隊員'); button.disabled = members.length < 2;
            button.onclick = () => { const index = Math.max(0,members.findIndex(ally => String(ally._slot) === selectedRole)); const role = members[(index + direction + members.length) % members.length]; if (view === 'quests') openAllyQuestManager(role._slot); else openAllyEquipmentManager(role._slot); };
            strip.appendChild(button); if (direction < 0) strip.appendChild(select);
        }
    }
    function roster() {
        if (!isOpen()) return;
        setView('roster');
        content.classList.remove('guild-equipment-content');
        content.firstElementChild?.classList.add('guild-roster');
        const intro = content.firstElementChild?.firstElementChild;
        if (intro && !intro.querySelector('[data-guild-manage]')) {
            const details = document.createElement('details'), summary = document.createElement('summary');
            summary.textContent = '招募與協力說明'; details.appendChild(summary); intro.before(details); details.appendChild(intro); details.className = 'guild-help';
        }
        for (const row of content.querySelectorAll('[data-guild-roster-role]:not(.guild-roster-empty)')) {
            const sum = slotSummary(row.dataset.guildRosterRole);
            if (!sum) continue;
            const portrait = document.createElement('span'); portrait.className = 'guild-roster-avatar';
            portrait.appendChild(partyPortraitNode({cls:sum.rawCls,avatar:sum.avatar,eq:{}},'ally',36,50)); row.prepend(portrait);
        }
        for (const button of content.querySelectorAll('[onclick^="openAllyEquipmentManager"]')) {
            const match = button.getAttribute('onclick').match(/\('([^']+)'\)/);
            if (match) button.dataset.guildManage = match[1];
        }
    }
    function quests(role) {
        if (!isOpen()) return;
        selectedRole = String(role); setView('quests'); content.classList.remove('guild-equipment-content');
    }
    function slotName(key) { return ALLY_EQUIP_SLOT_NAME[key] || ({eye:'魔眼',rem_eye:'席琳之眼',rem_blood:'席琳之血',rem_scale:'席琳之鱗',rem_bone:'席琳之骨',rem_fang:'席琳之牙',rem_heart:'席琳之心',rem_flesh:'席琳之肉',rem_claw:'席琳之爪'}[key]) || key; }
    function slotMatches(def, key) {
        if (key === 'wpn' || key === 'offwpn') return def.type === 'wpn' && !def.isArrow;
        if (key === 'arrow') return !!def.isArrow;
        if (/^ring[1-4]$/.test(key)) return def.slot === 'ring';
        if (/^ear[12]$/.test(key)) return def.slot === 'ear';
        return def.slot === key;
    }
    function renderEquipment(ctx) {
        mount();
        if (equipmentRole !== ctx.slotN) { page = 0; slot = ''; category = 'all'; search = ''; candidate = ''; scroll = 0; }
        selectedRole = equipmentRole = ctx.slotN; setView('equipment'); content.classList.add('guild-equipment-content');
        const actor = ctx.source;
        const accessoryOpen = _withAllyEquipmentContext(actor, () => [...accessorySlots('ring'), ...accessorySlots('ear')]);
        content.innerHTML = '<div class="guild-equipment"><section class="guild-body"><h3>'+partyEscape(actor.name || '未命名')+' · '+partyEscape(CLAN_CLASS_NAMES[actor.cls] || '')+'</h3><div id="guild-body-scroll"><div id="guild-paperdoll" class="party-equipment-frame"></div></div><div class="guild-pages"><button class="btn" data-guild-page="0">裝備 1</button><button class="btn" data-guild-page="1">裝備 2</button></div></section><section class="guild-inventory"><h3>隊長背包 · 可穿戴裝備</h3><div class="guild-filters"><select id="guild-category" aria-label="裝備分類"><option value="all">全部</option><option value="wpn">武器</option><option value="arm">防具</option><option value="acc">飾品</option></select><input id="guild-search" type="search" placeholder="搜尋裝備" aria-label="搜尋裝備"><button class="btn" id="guild-all-slots">全部部位</button></div><div id="guild-slot-hint"></div><div id="guild-candidates"></div><div class="guild-actions"><div id="guild-current"></div><div id="guild-candidate"></div><button class="btn" id="guild-equip">穿戴</button><button class="btn" id="guild-unequip">卸下</button></div></section></div><p class="guild-footer">裝備由隊長背包提供；卸下或替換後退回背包。變更會立即儲存。</p>';
        const paperdoll = document.getElementById('guild-paperdoll'), slots = document.createElement('div'); slots.className = 'equipment-window-slots'; paperdoll.appendChild(slots);
        slots.appendChild(content.querySelector('.guild-pages'));
        const backdrop = document.createElement('img'); backdrop.className = 'party-equipment-backdrop'; backdrop.src = equipmentView.backdropUrl; backdrop.alt = ''; slots.appendChild(backdrop);
        if (!page) {
            const figure = document.createElement('div'); figure.className = 'party-paperdoll-figure'; figure.setAttribute('aria-hidden','true');
            const image = document.createElement('img'), key = loadStartKeyFromSummary({avatar:actor.avatar,rawCls:actor.cls});
            image.src = loadFrameSrc(key,loadFirstFrame(key)); image.alt = ''; figure.appendChild(image); slots.appendChild(figure);
        }
        for (const pos of equipmentView.pages[page]) {
            const key = pos.alt && actor.eq[pos.alt] ? pos.alt : pos.k, item = actor.eq[key];
            const button = equipmentView.createSlot(item,pos); button.dataset.equipmentSlot = key;
            button.prepend(partyEquipmentDefault(actor,pos));
            const label = document.createElement('span'); label.className = 'party-equipment-label'; label.textContent = ({wpn:'主手',offwpn:'副手',shield:'盾牌',ear1:'耳環1',ear2:'耳環2',ring1:'戒指1',ring2:'戒指2',ring3:'戒指3',ring4:'戒指4',doll:'娃娃',rem_eye:'席琳眼',rem_blood:'席琳血',rem_scale:'席琳鱗',rem_bone:'席琳骨',rem_fang:'席琳牙',rem_heart:'席琳心',rem_flesh:'席琳肉',rem_claw:'席琳爪'}[key]) || slotName(key); button.appendChild(label);
            if (/^(ring[1-4]|ear[12])$/.test(key) && !accessoryOpen.includes(key)) { button.disabled = true; button.classList.add('guild-slot-locked'); }
            button.setAttribute('aria-label',slotName(key)+' · '+(item ? plainName(item) : '尚未裝備'));
            button.title = slotName(key)+' · '+(button.disabled ? '尚未解鎖' : item ? plainName(item) : '尚未裝備');
            button.setAttribute('aria-label', button.title);
            if (item) { button.dataset.tipSrc = 'party'; button.dataset.tipUid = item.uid; button.dataset.tipPartyKind = 'ally'; button.dataset.tipPartyId = ctx.ally._slot; }
            button.onclick = () => { slot = key; category = 'all'; candidate = ''; scroll = 0; document.getElementById('guild-category').value = category; drawCandidates(ctx); };
            slots.appendChild(button);
        }
        for (const button of content.querySelectorAll('[data-guild-page]')) {
            button.setAttribute('aria-pressed', String(Number(button.dataset.guildPage) === page));
            button.onclick = () => { page = Number(button.dataset.guildPage); slot = ''; candidate = ''; scroll = 0; renderEquipment(ctx); };
        }
        document.getElementById('guild-search').value = search;
        document.getElementById('guild-search').addEventListener('input', event => { search = event.target.value; if (!event.isComposing) { scroll = 0; drawCandidates(ctx); } });
        document.getElementById('guild-search').addEventListener('compositionend', event => { search = event.target.value; scroll = 0; drawCandidates(ctx); });
        document.getElementById('guild-category').value = category;
        document.getElementById('guild-category').onchange = event => { category = event.target.value; scroll = 0; drawCandidates(ctx); };
        document.getElementById('guild-all-slots').onclick = () => { slot = ''; scroll = 0; drawCandidates(ctx); };
        document.getElementById('guild-equip').onclick = () => {
            const item = player.inv.find(i => i.uid === candidate); if (!item) return;
            const def = DB.items[item.id], chosen = slot && slotMatches(def, slot) ? slot : undefined;
            // Keep the existing accessory chooser when no particular slot was selected.
            allyEquipItem(ctx.slotN, encodeURIComponent(item.uid), chosen);
        };
        document.getElementById('guild-unequip').onclick = () => { if (slot) allyUnequipItem(ctx.slotN,slot); };
        drawCandidates(ctx); fitEquipment();
    }
    function plainName(item) { return getItemFullName(item).replace(/<[^>]*>/g,''); }
    function drawCandidates(ctx) {
        const list = document.getElementById('guild-candidates'); list.replaceChildren();
        const rows = player.inv.filter(item => {
            const def = DB.items[item.id];
            return def && _allyCanEquipLeaderItem(ctx.source,item) && (!slot || slotMatches(def,slot)) && (category === 'all' || def.type === category) && (!search.trim() || plainName(item).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
        });
        if (!rows.some(item => item.uid === candidate)) candidate = '';
        for (const item of rows) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'btn guild-item tip-host'; button.dataset.guildItem = item.uid; button.dataset.tipSrc = 'inv'; button.dataset.tipUid = item.uid;
            button.setAttribute('aria-pressed',String(candidate === item.uid)); button.setAttribute('aria-label',plainName(item));
            const icon = document.createElement('span'); icon.className = 'guild-item-icon'; icon.innerHTML = '<img src="'+partyEscape(getIconUrl(DB.items[item.id]))+'" alt="">'+inventoryIconBadges(item,DB.items[item.id]);
            const label = document.createElement('span'); label.className = 'guild-item-name'; label.textContent = plainName(item); label.title = label.textContent;
            button.append(icon,label); button.onclick = () => { candidate = item.uid; for (const b of list.children) b.setAttribute('aria-pressed',String(b === button)); updateActions(ctx); };
            list.appendChild(button);
        }
        if (!rows.length) { const empty = document.createElement('p'); empty.className = 'guild-empty'; empty.textContent = '沒有符合條件的可穿戴裝備。'; list.appendChild(empty); }
        list.scrollTop = scroll; list.onscroll = () => { scroll = list.scrollTop; };
        document.getElementById('guild-slot-hint').textContent = slot ? '部位：'+slotName(slot) : '全部部位 · 點選左側部位可篩選';
        for (const button of content.querySelectorAll('[data-equipment-slot]')) button.setAttribute('aria-pressed',String(button.dataset.equipmentSlot === slot));
        updateActions(ctx);
    }
    function updateActions(ctx) {
        const equipped = slot && ctx.source.eq[slot], item = player.inv.find(i => i.uid === candidate);
        document.getElementById('guild-current').textContent = slot ? '目前 '+slotName(slot)+'：'+(equipped ? plainName(equipped) : '尚未裝備') : '請點選部位或候選裝備';
        document.getElementById('guild-candidate').textContent = '候選：'+(item ? plainName(item) : '尚未選擇');
        document.getElementById('guild-equip').disabled = !item;
        document.getElementById('guild-unequip').disabled = !equipped;
    }
    function fitEquipment() {
        if (!isOpen() || view !== 'equipment') return;
        const area = document.getElementById('guild-body-scroll'), paperdoll = document.getElementById('guild-paperdoll'); if (!area || !paperdoll) return;
        // Preserve the original artwork and socket coordinates, filling the left pane width.
        const width = area.clientWidth;
        const layout = equipmentView.positionSlots(paperdoll.firstElementChild,width,page);
        paperdoll.style.setProperty('--guild-equipment-controls-top',layout.controlsTop+'px');
        paperdoll.style.setProperty('--party-equipment-height',layout.height+'px');
        paperdoll.style.setProperty('--party-equipment-canvas-height',layout.height+'px');
        paperdoll.style.setProperty('--party-equipment-canvas-width',width+'px');
    }
    new ResizeObserver(fitEquipment).observe(frame);
    window.guildWindow = {isOpen,close,roster,quests,renderEquipment,open() { mount(); renderAllyNPC(content); }};
})();
