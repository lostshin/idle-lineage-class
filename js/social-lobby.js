// The lobby is a view of social data, never a hunting map or a player snapshot restore.
const socialLobby = (() => {
    const $ = id => document.getElementById(id);
    let active = false, session = null, mine = null, selected = null, preview = null;
    let poll = null, requestEpoch = 0, view = 'online', offset = 0, nextPage = null, commentsBefore = null;
    let failures = 0, busy = false, editorActor = null, requestId = null;
    let visitorsSignature = '', popupReturnFocus = null, commentRows = [];
    let campGuests = [], selfGreeting = 0, greetingTimer = null;
    let presenceTimer = null, presencePending = null, loginPending = null, disconnected = false, presenceFailures = 0;
    let campServerTime = 0, campReceivedAt = 0;
    const avatarRows = [['王子','公主'],['男騎士','女騎士'],['男妖精','女妖精'],['男法師','女法師'],['男黑暗妖精','女黑暗妖精'],['男龍騎士','女龍騎士'],['男幻術士','女幻術士'],['男戰士','女戰士']];
    const defaultAvatar = {royal:'王子',knight:'男騎士',elf:'男妖精',mage:'男法師',dark:'男黑暗妖精',dragon:'男龍騎士',illusion:'男幻術士',warrior:'男戰士'};
    // Sample generated rows at their measured foot baseline, without clipping adjacent classes.
    const poseRows = {standing:[18.4555,114.0586,212.8185,309.3236,407.6325,502.7847,599.2897,691.2852],kneeling:[4.9267,105.4904,203.3484,303.9121,406.2796,505.0395,605.1522,703.9121]};
    const requests = new Set();
    const base = () => ($('social-lobby-api')?.content || '').replace(/\/$/, '');
    const live = () => active && !document.hidden && !$('game-screen').classList.contains('hidden');
    const playing = () => player.cls && !$('game-screen').classList.contains('hidden');
    const currentMap = () => HIDDEN_AREA_NAMES[mapState.current] || mapEntryOf(mapState.current)?.t || '';
    const currentActor = () => ({name:String(player.name || '冒險者').slice(0,12),cls:player.cls,avatar:player.avatar || defaultAvatar[player.cls]});
    const campNow = () => campServerTime + Math.max(0,performance.now()-campReceivedAt);
    const status = message => { $('lobby-status').textContent = message; $('lobby-status').hidden = !message; };

    function node(tag, value, className) {
        const el = document.createElement(tag);
        if (value !== undefined) el.textContent = value;
        if (className) el.className = className;
        return el;
    }
    function button(label, action) {
        const el = node('button', label); el.type = 'button'; el.addEventListener('click', () => perform(action)); return el;
    }
    async function api(path, method = 'GET', data) {
        const apiBase = base();
        if (!apiBase) throw Error('大廳尚未開放連線，你可以先預覽自己的名片。');
        const url = new URL(apiBase);
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw Error('大廳連線設定不正確。');
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
        const viewRequest = !['/auth/guest','/presence','/me'].includes(path);
        if (viewRequest) requests.add(controller);
        const headers = {};
        if (session) headers.Authorization = 'Bearer ' + session.token;
        if (data !== undefined) headers['Content-Type'] = 'application/json';
        try {
            const response = await fetch(apiBase + '/v1' + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
            const result = await response.json();
            if (!response.ok) {
                if (response.status === 401) { session = null; mine = null; updateAuth(); }
                throw Error(result.error || '大廳暫時無法連線。');
            }
            return result;
        } finally { clearTimeout(timeout); requests.delete(controller); }
    }
    async function perform(action) {
        if (busy) return;
        busy = true;
        $('social-lobby')?.setAttribute('aria-busy', 'true');
        try { await action(); }
        catch (error) { if (active) status(error.name === 'AbortError' ? '連線已中斷，請稍後再試。' : error.message); }
        finally { busy = false; $('social-lobby')?.setAttribute('aria-busy', 'false'); }
    }
    function heartbeat() {
        if (!presencePending) presencePending = sendHeartbeat().finally(() => { presencePending = null; });
        return presencePending;
    }
    async function sendHeartbeat() {
        clearTimeout(presenceTimer);
        try {
            if (!playing() || disconnected) return;
            if (!session) { mount(); await login(true); }
            if (!session || !playing()) return;
            const result = await api('/presence', 'POST', { actor:currentActor(), map: mine?.published && mine.card.shareMap ? currentMap() : '', page:onlinePresence.page });
            onlinePresence.update(result.siteOnlineCount);
            presenceFailures = 0;
        } catch (error) { presenceFailures++; onlinePresence.unavailable(); if (active) status(error.message); }
        finally { presenceTimer = setTimeout(heartbeat, Math.min(300000, 30000 * 2 ** presenceFailures)); }
    }
    function stop() {
        clearTimeout(poll); poll = null;
        clearTimeout(greetingTimer); greetingTimer = null;
        requestEpoch++;
        for (const request of requests) request.abort();
    }
    function updateAuth() {
        $('lobby-login').hidden = !!session;
        $('lobby-logout').hidden = !session;
        $('lobby-delete-account').hidden = !session;
        $('lobby-withdraw').hidden = !mine?.published;
        $('lobby-publish').disabled = !session || !preview;
        $('lobby-comment-send').disabled = !session;
        $('lobby-auth-state').textContent = session ? '以訪客身分連線中' : '不需註冊，使用此瀏覽器的訪客身分';
    }
    function mount() {
        if ($('social-lobby')) return;
        const root = node('section'); root.id = 'social-lobby'; root.hidden = true; root.setAttribute('aria-label', '冒險者大廳');
        root.innerHTML = `
            <section id="lobby-common" aria-label="肝膽相照">
                <div id="lobby-scene">
                    <div class="lobby-fire-glow" aria-hidden="true"></div>
                    <div class="lobby-campfire" role="img" aria-label="中央燃燒的營火">
                        <div class="lobby-campfire-flame"><img class="lobby-campfire-strip" src="assets/ui/lobby-campfire-v1.webp" alt="" draggable="false"></div>
                        <div class="lobby-campfire-base"><img src="assets/ui/lobby-campfire-v1.webp" alt="" draggable="false"></div>
                    </div>
                    <div id="lobby-seats"></div>
                    <div class="lobby-camp-controls"><span id="lobby-camp-count" hidden></span><span id="lobby-status" role="status" aria-live="polite" hidden></span><div><button id="lobby-roster" type="button">旅人</button><button id="lobby-greet" type="button">打招呼</button><button id="lobby-exit" type="button">返回冒險</button></div></div>
                    <dialog id="lobby-popup" aria-label="冒險者名片">
                        <section id="lobby-editor" class="lobby-paper" aria-label="編輯公開名片" hidden>
                            <div class="lobby-section-heading"><h3>我的名片</h3><button id="lobby-editor-close" type="button" aria-label="關閉名片編輯">×</button></div>
                            <nav id="lobby-editor-tabs" aria-label="名片設定"><button type="button" data-editor-tab="basic" aria-pressed="true">基本</button><button type="button" data-editor-tab="sharing" aria-pressed="false">展示</button><button type="button" data-editor-tab="manage" aria-pressed="false">管理</button></nav>
                            <div id="lobby-editor-form">
                                <div data-editor-page="basic"><label>代表角色<select id="lobby-role"></select></label><label>自我介紹<textarea id="lobby-intro" maxlength="200" rows="2" placeholder="想和大家聊些什麼？"></textarea></label><p class="lobby-note">在線外觀跟隨目前角色；介紹、裝備與地圖仍由你選擇公開。</p></div>
                                <div data-editor-page="sharing" hidden><fieldset><legend>公開內容</legend><label><input id="lobby-share-class" type="checkbox" checked>職業／外觀</label><label><input id="lobby-share-level" type="checkbox">等級</label><label><input id="lobby-share-progress" type="checkbox">進度</label><label><input id="lobby-share-equipment" type="checkbox">裝備</label><label><input id="lobby-share-map" type="checkbox">目前地圖（遊戲開啟時更新）</label></fieldset><label>攻略進度<input id="lobby-progress" maxlength="100" placeholder="例如：攻略象牙塔七樓"></label><label>展示一件裝備<select id="lobby-equipment"></select></label></div>
                                <div data-editor-page="manage" hidden><p id="lobby-auth-state"></p><p class="lobby-note">訪客身分跟著這個瀏覽器；清除網站資料後無法自動找回。</p><div class="lobby-actions"><button id="lobby-login" type="button">連接大廳</button><button id="lobby-logout" type="button" hidden>中斷連線</button><button id="lobby-withdraw" type="button" hidden>下架名片</button><button id="lobby-delete-account" type="button" hidden>刪除大廳資料</button></div></div>
                            </div>
                            <div id="lobby-preview-text" class="lobby-card-preview" aria-label="公開名片預覽" hidden></div>
                            <div class="lobby-actions"><button id="lobby-preview" type="button">預覽公開內容</button><button id="lobby-preview-back" type="button" hidden>繼續編輯</button><button id="lobby-publish" type="button" disabled hidden>發布名片</button></div>
                        </section>
                        <section id="lobby-card-detail" class="lobby-paper" aria-label="冒險者名片" hidden>
                            <div class="lobby-section-heading"><h3>冒險者名片</h3><button id="lobby-detail-close" type="button" aria-label="關閉名片">×</button></div>
                            <div id="lobby-detail-body"></div><div class="lobby-actions"><button id="lobby-edit" type="button" hidden>編輯名片</button><button id="lobby-favorite" type="button">收藏</button><button id="lobby-open-comments" type="button">留言</button><button id="lobby-suspend" type="button" hidden>停權</button></div>
                        </section>
                        <section id="lobby-comment-panel" class="lobby-paper" aria-label="名片留言" hidden>
                            <div class="lobby-section-heading"><h3>旅人留言</h3><button id="lobby-comment-close" type="button">返回名片</button></div>
                            <div id="lobby-comment-read"><div id="lobby-comments" tabindex="0" aria-label="旅人留言清單"></div><div class="lobby-actions"><button id="lobby-comments-latest" type="button">更新留言</button><button id="lobby-comments-more" type="button" hidden>載入較早留言</button><button id="lobby-write-comment" type="button">寫留言</button></div></div>
                            <div id="lobby-comment-compose" hidden><label>留言<textarea id="lobby-comment" maxlength="300" rows="3" placeholder="打聲招呼"></textarea></label><div class="lobby-actions"><button id="lobby-compose-back" type="button">返回留言</button><button id="lobby-comment-send" type="button">送出</button></div></div>
                        </section>
                        <section id="lobby-roster-panel" class="lobby-paper" aria-label="旅人名冊" hidden>
                            <div class="lobby-section-heading"><h3 id="lobby-list-title">旅人名冊</h3><button id="lobby-roster-close" type="button" aria-label="關閉名冊">×</button></div>
                            <div class="lobby-actions"><button id="lobby-view-online" type="button" aria-pressed="true">在線玩家</button><button id="lobby-view-favorites" type="button" aria-pressed="false">我的收藏</button><button id="lobby-refresh" type="button">重新整理</button></div>
                            <div id="lobby-visitors"></div><div class="lobby-actions"><button id="lobby-previous" type="button" hidden>上一頁</button><button id="lobby-more" type="button" hidden>下一頁</button></div>
                        </section>
                    </dialog>
                </div>
            </section>`;
        $('map-view-panel').appendChild(root);
        $('lobby-greet').onclick = () => perform(greet);
        $('lobby-roster').onclick = () => perform(async () => { showSection('roster-panel'); if (session) await refresh(); else await login(); });
        $('lobby-roster-close').onclick = () => showSection('common');
        $('lobby-popup').addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); showSection('common'); } });
        for (const button of root.querySelectorAll('[data-editor-tab]')) button.onclick = () => editorPage(button.dataset.editorTab);
        $('lobby-preview-back').onclick = invalidatePreview;
        $('lobby-open-comments').onclick = () => perform(async () => { showSection('comment-panel'); showCommentComposer(false); await loadComments(); });
        $('lobby-write-comment').onclick = () => showCommentComposer(true);
        $('lobby-compose-back').onclick = () => showCommentComposer(false);
        $('lobby-comment-close').onclick = () => showSection('card-detail');
        $('lobby-comments-latest').onclick = () => perform(() => loadComments());
        $('lobby-exit').onclick = () => close();
        $('lobby-login').onclick = () => perform(login);
        $('lobby-logout').onclick = () => perform(async () => {
            await api('/auth/logout', 'POST', {}); disconnected = true; session = null; mine = null; stop(); updateAuth(); clearVisitors(); status('已中斷連線。再次連接仍使用此瀏覽器的訪客身分。');
        });
        $('lobby-edit').onclick = () => perform(edit);
        $('lobby-editor-close').onclick = () => showSection('common');
        $('lobby-detail-close').onclick = () => { selected = null; showSection('common'); };
        $('lobby-role').onchange = () => { chooseActor(); invalidatePreview(); };
        $('lobby-editor').addEventListener('input', invalidatePreview);
        $('lobby-preview').onclick = () => perform(makePreview);
        $('lobby-publish').onclick = () => perform(publish);
        $('lobby-withdraw').onclick = () => perform(async () => {
            if (!mine || !confirm('下架後，其他玩家就無法查看這張名片。確定下架？')) return;
            await api('/me/card', 'DELETE', { version: mine.version }); await loadMine(); showSection('common'); await refresh(); status('名片已下架。');
        });
        $('lobby-delete-account').onclick = () => perform(async () => {
            if (!confirm('確定刪除此訪客的名片、收藏與你留下的留言？本機角色存檔不受影響。')) return;
            await api('/me', 'DELETE', { confirm: true }); disconnected = true; session = null; mine = null; localStorage.removeItem('lineage_social_lobby_device_v1'); stop(); clearVisitors(); updateAuth(); showSection('common'); status('社交資料已刪除，本機角色保留。');
        });
        $('lobby-refresh').onclick = () => perform(async () => { failures = 0; if (session) await refresh(); else await login(); });
        for (const name of ['online', 'favorites']) $('lobby-view-' + name).onclick = () => perform(async () => { view = name; offset = 0; await refresh(); });
        $('lobby-more').onclick = () => perform(async () => { offset = nextPage; await refresh(); });
        $('lobby-previous').onclick = () => perform(async () => { offset = Math.max(0, offset - 3); await refresh(); });
        $('lobby-favorite').onclick = () => perform(async () => {
            if (!selected) return;
            await api('/cards/' + selected.id + '/favorite', selected.favorite ? 'DELETE' : 'PUT', {});
            selected.favorite = !selected.favorite; $('lobby-favorite').textContent = selected.favorite ? '取消收藏' : '收藏名片';
        });
        $('lobby-comments-more').onclick = () => perform(() => loadComments(true));
        $('lobby-comment').addEventListener('input', () => { requestId = null; });
        $('lobby-comment-send').onclick = () => perform(async () => {
            if (!selected || !$('lobby-comment').value.trim()) return;
            requestId ||= crypto.randomUUID();
            await api('/cards/' + selected.id + '/comments', 'POST', { text: $('lobby-comment').value.trim(), requestId });
            $('lobby-comment').value = ''; requestId = null; await loadComments(); showCommentComposer(false); status('留言已送出。');
        });
        $('lobby-suspend').onclick = () => perform(async () => {
            if (!selected || !confirm('確定停權此社交帳號？')) return;
            await api('/admin/users/' + selected.id + '/suspend', 'POST', {}); selected = null; showSection('common'); await refresh();
        });
        updateAuth();
    }
    function clearVisitors() {
        visitorsSignature = '';
        $('lobby-visitors').replaceChildren(node('p', '連接大廳後，看看今天有哪些冒險者來歇腳。', 'lobby-empty'));
        campGuests = []; renderCamp(); $('lobby-more').hidden = true; $('lobby-previous').hidden = true;
    }
    function renderCamp() {
        const host = $('lobby-seats'); if (!host) return;
        const guests = [{id:'self',actor:currentActor(),self:true,greetingAt:selfGreeting}, ...campGuests.filter(item => item.id !== session?.user.id && campNow()-item.lastSeen < 120000).slice(0,8)];
        const positions = [[50,80],[31,73],[69,73],[14,53],[86,53],[25,33],[75,33],[41,24],[59,24]];
        const keep = new Set(); let greetingRemaining = 0;
        for (const [index, item] of guests.entries()) {
            keep.add(item.id);
            let seat = [...host.children].find(el => el.dataset.campId === item.id);
            if (!seat) {
                seat = button('', () => item.self ? ownCard() : detail(item.id)); seat.className = 'lobby-seat'; seat.dataset.campId = item.id;
                if (item.self) seat.dataset.self = 'true';
                const sprite = node('span', undefined, 'lobby-camper-sprite'), image = node('img');
                image.src = 'assets/ui/lobby-campers-v1.webp'; image.alt = ''; image.draggable = false; sprite.appendChild(image);
                seat.append(node('span','嗨，旅人！','lobby-greeting'),sprite,node('span','','lobby-seat-name')); host.appendChild(seat);
            }
            const actor = item.actor;
            const fallback = defaultAvatar[actor.cls] || '男騎士';
            const avatar = avatarRows.some(row => row.includes(actor.avatar)) ? actor.avatar : fallback;
            const row = avatarRows.findIndex(row => row.includes(avatar)), column = avatarRows[row].indexOf(avatar)*2;
            const sprite = seat.querySelector('.lobby-camper-sprite'); sprite.dataset.avatar = avatar;
            const pose = ['seated','standing','kneeling'][_seedHash(item.id+'|'+avatar)%3]; sprite.dataset.pose = pose;
            sprite.firstChild.src = 'assets/ui/' + (pose === 'seated' ? 'lobby-campers-v1.webp' : 'lobby-'+pose+'-v1.webp');
            sprite.firstChild.style.left = (-column*100)+'%'; sprite.firstChild.style.top = (-(poseRows[pose]?.[row] ?? row*100))+'%';
            seat.style.left = positions[index][0]+'%'; seat.style.top = positions[index][1]+'%'; seat.style.zIndex = positions[index][1];
            seat.querySelector('.lobby-seat-name').textContent = actor.name + (item.self ? '（你）' : '');
            seat.setAttribute('aria-label', item.self ? '我的代表角色：'+actor.name : '查看 '+actor.name+' 的名片');
            if (item.greetingAt > (item.self ? Date.now() : campNow())-10000 && seat.dataset.greetingAt !== String(item.greetingAt)) {
                seat.dataset.greetingAt = String(item.greetingAt); seat.dataset.greetingUntil = String(Date.now()+3000);
            }
            const remaining = Number(seat.dataset.greetingUntil || 0)-Date.now();
            seat.classList.toggle('is-greeting',remaining>0);
            if (remaining>0) greetingRemaining = Math.max(greetingRemaining,remaining);
        }
        for (const seat of [...host.children]) if (!keep.has(seat.dataset.campId)) seat.remove();
        $('lobby-camp-count').textContent = guests.length === 1 ? '你在營火旁歇腳' : '營火旁 · '+guests.length+' 位旅人';
        clearTimeout(greetingTimer); greetingTimer = active && greetingRemaining>0 ? setTimeout(renderCamp,greetingRemaining+30) : null;
    }
    async function greet() {
        if (Date.now()-selfGreeting < 10000) return;
        selfGreeting = Date.now(); renderCamp();
        if (session) {
            await api('/greeting','POST',{});
            status('');
        } else status('');
    }
    function editorPage(name) {
        for (const page of $('lobby-editor-form').children) page.hidden = page.dataset.editorPage !== name;
        for (const tab of $('lobby-editor-tabs').children) tab.setAttribute('aria-pressed', String(tab.dataset.editorTab===name));
    }
    function showSection(name) {
        const popup = $('lobby-popup');
        for (const key of ['editor', 'card-detail', 'comment-panel', 'roster-panel']) $('lobby-' + key).hidden = key !== name;
        if (name === 'common') {
            popup.close();
            if (popupReturnFocus?.isConnected && popupReturnFocus.getClientRects().length) popupReturnFocus.focus({preventScroll:true});
            popupReturnFocus = null;
        } else if (!popup.open) {
            popupReturnFocus = document.activeElement;
            popup.show();
        }
        if (name !== 'common') $('lobby-' + name).querySelector('button')?.focus({preventScroll:true});
        $('social-lobby').classList.toggle('lobby-motion-paused', document.hidden || name !== 'common');
    }
    function open() {
        mount(); if (active) return;
        // Keep the native map selector truthful for teleport, revive and tick consumers.
        setMapSelectors(mapState.current);
        active = true; requestEpoch++; $('social-lobby').hidden = false;
        $('map-view-panel').classList.add('social-lobby-open');
        $('map-category').value = 'social_lobby';
        const room = node('option', '肝膽相照'); room.value = mapState.current;
        $('map-select').replaceChildren(room); $('map-select').dataset.lobbyRoom = 'gandan';
        _vfxClearAll(); showSection('common'); updateAuth();
        renderCamp();
        if (session) perform(async () => { await loadMine(); await heartbeat(); await refresh(); });
        else { clearVisitors(); status(base() ? '連接大廳中…' : '大廳尚未開放連線'); if (base()) perform(login); }
    }
    function close(restore = true) {
        if (!active) return;
        active = false; stop(); selected = null; preview = null;
        $('lobby-popup').close(); delete $('map-select').dataset.lobbyRoom;
        for (const el of $('lobby-seats').querySelectorAll('.is-greeting')) el.classList.remove('is-greeting');
        $('social-lobby').hidden = true; $('map-view-panel').classList.remove('social-lobby-open');
        if (restore) { setMapSelectors(mapState.current); renderMobs(); $('map-category').focus({ preventScroll: true }); }
    }
    function renderCard(host, item) {
        host.replaceChildren();
        const card = item.card;
        if (card.avatar || card.cls) host.appendChild(partyPortraitNode({ cls: card.cls || 'knight', avatar: card.avatar, eq: {} }, 'ally', 44, 64));
        host.appendChild(node('h3', card.name));
        const cls = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精', dragon: '龍騎士', illusion: '幻術士', warrior: '戰士' };
        if (card.cls || card.level) host.appendChild(node('p', [cls[card.cls], card.level && 'Lv.' + card.level].filter(Boolean).join(' · '), 'lobby-card-meta'));
        if (card.intro) host.appendChild(node('p', card.intro));
        if (card.progress) host.appendChild(node('p', '冒險近況：' + card.progress));
        if (card.equipment) host.appendChild(node('p', '展示裝備：' + card.equipment.name));
        if (item.currentMap) host.appendChild(node('p', '目前地圖：' + item.currentMap, 'lobby-card-meta'));
        host.appendChild(node('small', item.presence ? '目前在線角色，尚未發布名片。' : '玩家分享的單機快照' + (item.updatedAt ? ' · ' + new Date(item.updatedAt).toLocaleString('zh-TW') : '')));
    }
    async function loadMine() {
        const connection = session, result = await api('/me');
        if (session !== connection) return;
        mine = result.card; session.user = result.user; updateAuth(); renderCamp();
    }
    async function refresh() {
        if (!live() || !session) return;
        clearTimeout(poll); poll = null;
        const epoch = requestEpoch, listingView = view, listingOffset = offset;
        try {
            const result = await api(view === 'online' ? '/players?offset=' + offset : '/cards?view=favorites&offset=' + offset);
            const camp = view === 'online' && offset === 0 ? result : await api('/players?offset=0');
            if (epoch !== requestEpoch || !live() || view !== listingView || offset !== listingOffset) return;
            campServerTime = camp.serverTime; campReceivedAt = performance.now();
            campGuests = camp.players; renderCamp(); onlinePresence.update(camp.siteOnlineCount);
            const rows = view === 'online' ? result.players : result.cards;
            const signature = JSON.stringify({ view, offset, cards: rows.map(({greetingAt, ...item}) => ({ ...item, lastSeen: !!item.lastSeen && campNow() - item.lastSeen < 120000 })) });
            const list = $('lobby-visitors');
            if (signature !== visitorsSignature) {
                visitorsSignature = signature; list.replaceChildren();
                for (const item of rows.slice(0,3)) {
                    const el = button('', () => detail(item.id, item.actor ? item : null)); el.dataset.cardId = item.id; el.className = 'lobby-visitor';
                    const title = node('strong', (item.actor || item.card).name), when = item.lastSeen && campNow() - item.lastSeen < 120000 ? '在線' : '離線';
                    el.append(title, node('span', item.card?.intro || '來交換一段冒險故事吧'), node('small', when)); list.appendChild(el);
                }
                if (!rows.length) list.appendChild(node('p', view === 'favorites' ? '還沒有收藏的公開名片。' : '目前沒有其他在線的冒險者。', 'lobby-empty'));
            }
            nextPage = rows.length>3 ? offset+3 : result.next; $('lobby-more').hidden = nextPage === null; $('lobby-previous').hidden = offset === 0;
            for (const name of ['online', 'favorites']) $('lobby-view-' + name).setAttribute('aria-pressed', String(view === name));
            $('lobby-list-title').textContent = view === 'favorites' ? '收藏的冒險者' : '在線的冒險者';
            failures = 0;
            status('');
        } catch (error) { if (epoch !== requestEpoch || !active) return; failures++; onlinePresence.unavailable(); status(error.name === 'AbortError' ? '連線已中斷。' : error.message); }
        if (epoch === requestEpoch && live() && session) { clearTimeout(poll); poll = setTimeout(pollRefresh, Math.min(300000, 5000 * 2 ** failures)); }
    }
    function pollRefresh() {
        poll = null;
        if (!live() || !session) return;
        if (busy) { poll = setTimeout(pollRefresh, 1000); return; }
        refresh();
    }
    async function detail(id, onlineActor = null) {
        const epoch = requestEpoch, guest = onlineActor || campGuests.find(item => item.id === id);
        const result = guest?.hasCard === false ? {id,card:guest.actor,presence:true} : await api('/cards/' + id);
        if (epoch !== requestEpoch || !active) return;
        selected = result; renderCard($('lobby-detail-body'), result); showSection('card-detail');
        $('lobby-edit').hidden = id !== session.user.id;
        $('lobby-favorite').hidden = !!result.presence || id === session.user.id;
        $('lobby-open-comments').hidden = !!result.presence;
        $('lobby-favorite').textContent = result.favorite ? '取消收藏' : '收藏名片';
        $('lobby-suspend').hidden = !session.user.admin || id === session.user.id;
        $('lobby-comment').value = ''; requestId = null; $('lobby-detail-close').focus({ preventScroll: true });
    }
    function ownCard() {
        selected = mine?.published ? {...mine,id:session.user.id} : null;
        const card = mine?.card || {name:player.name || '冒險者',cls:player.cls,avatar:player.avatar};
        renderCard($('lobby-detail-body'), {card,updatedAt:mine?.updatedAt,currentMap:card.shareMap ? currentMap() : ''});
        $('lobby-edit').hidden = false; $('lobby-favorite').hidden = true; $('lobby-suspend').hidden = true;
        $('lobby-open-comments').hidden = !selected;
        showSection('card-detail');
    }
    async function loadComments(append = false) {
        if (!selected) return;
        const id = selected.id, epoch = requestEpoch;
        const result = await api('/cards/' + id + '/comments' + (append && commentsBefore ? '?before=' + commentsBefore : ''));
        if (epoch !== requestEpoch || selected?.id !== id) return;
        const host = $('lobby-comments'), top = host.scrollTop, height = host.scrollHeight;
        commentRows = (append ? result.comments.concat(commentRows) : result.comments).sort((a,b) => a.id-b.id);
        commentsBefore = result.next; renderComments();
        host.scrollTop = append ? top + host.scrollHeight - height : host.scrollHeight;
    }
    function renderComments() {
        const host = $('lobby-comments'); host.replaceChildren();
        for (const item of commentRows) {
            const row = node('article'); row.append(node('strong',item.author),node('p',item.text),node('small',new Date(item.createdAt).toLocaleString('zh-TW')));
            if(item.canDelete) row.appendChild(button('刪除',async()=>{await api('/comments/'+item.id,'DELETE',{});await loadComments();}));host.appendChild(row);
        }
        if (!commentRows.length) host.appendChild(node('p','還沒有人留言。'));
        $('lobby-comments-more').hidden = commentsBefore===null;
    }
    function showCommentComposer(show) {
        $('lobby-comment-read').hidden = show; $('lobby-comment-compose').hidden = !show;
        if (show) $('lobby-comment').focus({preventScroll:true});
    }
    async function edit() {
        if (session) await loadMine();
        if (!active) return;
        const select = $('lobby-role'); select.replaceChildren(node('option', '目前角色：' + (player.name || '無名'))); select.firstChild.value = 'current';
        for (let slot = 1; slot <= visibleSaveSlotMax(); slot++) {
            if (String(slot) === String(currentSlot)) continue;
            const summary = slotSummary(slot);
            if (summary?.cls) { const option = node('option', '角色 ' + slot + '：' + (summary.name || summary.n || '冒險者')); option.value = String(slot); select.appendChild(option); }
        }
        $('lobby-intro').value = mine?.card.intro || ''; $('lobby-progress').value = mine?.card.progress || '';
        $('lobby-share-class').checked = mine ? !!mine.card.cls : true;
        $('lobby-share-level').checked = !!mine?.card.level; $('lobby-share-progress').checked = !!mine?.card.progress; $('lobby-share-equipment').checked = !!mine?.card.equipment;
        $('lobby-share-map').checked = !!mine?.card.shareMap;
        chooseActor(); invalidatePreview(); editorPage('basic'); showSection('editor'); updateAuth();
    }
    function chooseActor() {
        editorActor = $('lobby-role').value === 'current' ? player : _roleReadSavePlayer($('lobby-role').value);
        const select = $('lobby-equipment'); select.replaceChildren(node('option', '不展示裝備')); select.firstChild.value = '';
        for (const [slot, item] of Object.entries(editorActor?.eq || {})) {
            if (!item || !DB.items[item.id]) continue;
            const fragment = node('span'); fragment.innerHTML = getItemFullName({ ...item, cnt: 1 });
            const option = node('option', fragment.textContent); option.value = slot; select.appendChild(option);
        }
    }
    function invalidatePreview() {
        preview = null; $('lobby-preview-text').hidden = true; $('lobby-publish').disabled = true; $('lobby-publish').hidden = true;
        $('lobby-editor-form').hidden = false; $('lobby-editor-tabs').hidden = false; $('lobby-preview').hidden = false; $('lobby-preview-back').hidden = true;
    }
    function makePreview() {
        if (!editorActor?.cls) throw Error('此角色無法讀取，請重新選擇。');
        const card = { name: String(editorActor.name || '無名').slice(0, 12), intro: $('lobby-intro').value.trim() };
        card.shareMap = $('lobby-share-map').checked;
        if ($('lobby-share-class').checked) { card.cls = editorActor.cls; card.avatar = editorActor.avatar; }
        if ($('lobby-share-level').checked) card.level = editorActor.lv;
        if ($('lobby-share-progress').checked) card.progress = $('lobby-progress').value.trim();
        if ($('lobby-share-equipment').checked) {
            const selectedOption = $('lobby-equipment').selectedOptions[0];
            if (!$('lobby-equipment').value) throw Error('請選擇一件要展示的裝備。');
            card.equipment = { name: selectedOption.textContent };
        }
        preview = card; renderCard($('lobby-preview-text'), { card }); $('lobby-preview-text').hidden = false;
        $('lobby-editor-form').hidden = true; $('lobby-editor-tabs').hidden = true; $('lobby-preview').hidden = true; $('lobby-preview-back').hidden = false; $('lobby-publish').hidden = false; updateAuth();
    }
    async function publish() {
        if (!session || !preview) return;
        const result = await api('/me/card', 'PUT', { card: preview, version: mine?.version || 0 });
        mine = { card: preview, version: result.version, published: true }; preview = null; updateAuth();
        await heartbeat();
        if (active) { showSection('common'); await refresh(); }
    }
    async function login(background = false) {
        disconnected = false;
        if (!loginPending) loginPending = connect().finally(() => { loginPending = null; });
        await loginPending;
        if (!background && active && session) { await heartbeat(); await refresh(); }
    }
    async function connect() {
        if (!base()) throw Error('大廳尚未開放連線，你可以先預覽自己的名片。');
        const key = 'lineage_social_lobby_device_v1';
        let deviceKey = localStorage.getItem(key);
        if (!/^[a-f0-9]{64}$/.test(deviceKey || '')) {
            deviceKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(key, deviceKey); deviceKey = localStorage.getItem(key);
            if (!deviceKey) throw Error('無法保存訪客身分；請允許此網站儲存資料後再試。');
        }
        const result = await api('/auth/guest', 'POST', { deviceKey });
        if (!playing() || disconnected) return;
        setSession(result); await loadMine();
    }
    function setSession(value) { session = value; updateAuth(); renderCamp(); }
    document.addEventListener('visibilitychange', () => { if (!active) return; $('social-lobby').classList.toggle('lobby-motion-paused', document.hidden || $('lobby-popup').open); if (document.hidden) stop(); else { renderCamp(); if (session) refresh(); } });
    window.addEventListener('pagehide', () => { clearTimeout(presenceTimer); close(false); });
    window.addEventListener('pageshow', heartbeat);
    presenceTimer = setTimeout(heartbeat, 30000);
    window.addEventListener('online', () => { heartbeat().then(() => { if (live() && session) refresh(); }); });
    new MutationObserver(() => { if (playing()) heartbeat(); }).observe($('game-screen'), {attributes:true,attributeFilter:['class']});
    document.addEventListener('pointerdown', event => { const popup = $('lobby-popup'); if (active && popup.open && !popup.contains(event.target) && !event.target.closest('#cdd-pop')) showSection('common'); });
    document.addEventListener('keydown', event => { if (!active || event.key !== 'Escape') return; if ($('lobby-popup').open) { event.preventDefault(); showSection('common'); } else if (!document.querySelector('dialog[open]')) close(); });
    return { open, close, isOpen: () => active, isPolling: () => poll !== null, setSession };
})();
