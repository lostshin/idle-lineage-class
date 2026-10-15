// ===== 嵌入式雙頁角色裝備面板 =====
// 🗑️ v3.5.87 整區刪除浮動視窗殘骸（用戶拍板）：本面板自 v3.5.x 起恆為嵌入模式（init 無條件加
//    equipment-window-embedded、全專案無 remove/toggle），原「可拖曳浮動視窗」的拖曳三件套、關閉鈕、
//    側欄清單（renderSidePanel/openEquipmentSidePanel/closeEquipmentSidePanel/plainItemName）、
//    closeEquipmentWindow、fitEquipmentWindowToViewport 非嵌入分支——共約 150 行永不可達死碼全數移除。
// Share the teammate backdrop and static creation portrait; no animation timer.
// 本面板保留：雙頁裝備格(renderSlots·第 2 頁＝席琳遺骸欄) ＋ 負重%(renderStats)。
(function () {
    const PAGE_SLOTS = [
        [
            { k: 'helm',    x: 50.0, y: 15.81, w: 19.67, h: 8.82 },
            { k: 'ear1',    x: 19.4, y: 18.01, w: 19.67, h: 8.82 },
            { k: 'ear2',    x: 80.1, y: 18.01, w: 19.67, h: 8.82 },
            { k: 'amulet',  x: 50.0, y: 33.46, w: 19.67, h: 8.82 },
            { k: 'gloves',  x: 19.4, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'cloak',   x: 80.1, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'tshirt',  x: 50.0, y: 42.77, w: 19.67, h: 8.82 },
            { k: 'wpn',     x: 19.4, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'shield', alt: 'offwpn', x: 80.1, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'armor',   x: 50.0, y: 52.08, w: 19.67, h: 8.82 },
            { k: 'ring1',   x: 19.4, y: 58.46, w: 19.67, h: 8.82 },
            { k: 'ring2',   x: 80.1, y: 58.46, w: 19.67, h: 8.82 },
            { k: 'belt',    x: 50.0, y: 63.36, w: 19.67, h: 8.82 },
            { k: 'ring3',   x: 19.4, y: 67.77, w: 19.67, h: 8.82 },
            { k: 'ring4',   x: 80.1, y: 67.77, w: 19.67, h: 8.82 },
            { k: 'shin',    x: 50.0, y: 72.67, w: 19.67, h: 8.82 },
            { k: 'boots',   x: 50.0, y: 81.99, w: 19.67, h: 8.82 },
            { k: 'doll',    x: 19.4, y: 80.76, w: 19.67, h: 8.82 },
            { k: 'arrow',   x: 80.1, y: 80.76, w: 19.67, h: 8.82 }
        ],
        [
            { k: 'eye',       x: 19.4, y: 15.81, w: 19.67, h: 8.82 },   // 🐉 v3.7.57 魔眼欄（第二頁空白處·限 1·地龍之魔眼）
            { k: 'rem_eye',   x: 50.0, y: 15.81, w: 19.67, h: 8.82 },
            { k: 'rem_blood', x: 80.1, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'rem_scale', x: 50.0, y: 52.08, w: 19.67, h: 8.82 },
            { k: 'rem_bone',  x: 19.4, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'rem_fang',  x: 80.1, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'rem_heart', x: 50.0, y: 63.36, w: 19.67, h: 8.82 },
            { k: 'rem_flesh', x: 50.0, y: 81.99, w: 19.67, h: 8.82 },
            { k: 'rem_claw',  x: 19.4, y: 44.98, w: 19.67, h: 8.82 }
        ]
    ];

    const EQUIPMENT_BACKDROP_URL = 'assets/ui/party-equipment-backdrop-v2-4x3.png';
    // Compact sockets matching the approved reference; the tight centre column may end just below the artwork.
    // Narrow columns keep this ratio; height-limited fits stop shrinking once sockets reach 50px.
    const EQUIPMENT_SOCKET_RATIO = .16, EQUIPMENT_SOCKET_GAP = .015, EQUIPMENT_SOCKET_MIN = 50;
    function equipmentLayout(width, pageIndex) {
        // Sockets stay proportional to the artwork so narrow canvases shrink instead of overlapping.
        const scale = getUiScale(), size = width * EQUIPMENT_SOCKET_RATIO, gap = width * EQUIPMENT_SOCKET_GAP;
        const spare = Math.max(0, width - size * 3), edge = Math.min(gap, spare / 4);
        const gapX = Math.min(gap, Math.max(0, (spare - edge * 2) / 2)), gapY = gap;
        const artHeight = width * 4 / 3, slots = [], bottoms = [0, 0, 0];
        for (const pos of [...PAGE_SLOTS[pageIndex]].sort((a, b) => a.y - b.y)) {
            const column = pos.x < 35 ? 0 : pos.x > 65 ? 2 : 1;
            let x = width * pos.x / 100;
            if (column === 0) x = Math.max(size / 2 + edge, Math.min(x, width / 2 - size - gapX));
            if (column === 2) x = Math.min(width - size / 2 - edge, Math.max(x, width / 2 + size + gapX));
            const y = Math.max(artHeight * pos.y / 100, size / 2 + edge, bottoms[column] + gapY + size / 2);
            bottoms[column] = y + size / 2;
            slots.push({ k: pos.k, alt: pos.alt, x, y });
        }
        return { width, height: Math.max(artHeight, ...bottoms.map(y => y + 36 / scale)), size, slots };
    }
    // Widest canvas whose laid-out height fits; the fixed control band makes height non-linear, so bisect.
    // Below the width where sockets reach 50px the canvas stops shrinking and its container scrolls.
    function fitEquipmentWidth(width, height, pageIndex) {
        const high = Math.max(1, width), floor = Math.min(high, EQUIPMENT_SOCKET_MIN / getUiScale() / EQUIPMENT_SOCKET_RATIO);
        if (equipmentLayout(high, pageIndex).height <= height) return high;
        let low = floor, top = high;
        if (equipmentLayout(low, pageIndex).height > height) return low;
        for (let i = 0; i < 20; i++) {
            const mid = (low + top) / 2;
            if (equipmentLayout(mid, pageIndex).height <= height) low = mid; else top = mid;
        }
        return low;
    }
    function positionEquipmentSlots(host, width, pageIndex) {
        const layout = equipmentLayout(width, pageIndex);
        for (const slot of host.querySelectorAll('[data-equipment-slot]')) {
            const pos = layout.slots.find(p => p.k === slot.dataset.equipmentSlot || p.alt === slot.dataset.equipmentSlot || (p.k === 'armor' && slot.dataset.equipmentSlot === 'arm'));
            slot.style.left = pos.x + 'px'; slot.style.top = pos.y + 'px';
            slot.style.width = layout.size + 'px'; slot.style.height = layout.size + 'px';
        }
        return layout;
    }
    let page = 0;

    function el(id) { return document.getElementById(id); }

    const EQUIPMENT_TEMPLATE_CLASS = {
        royal: '王族', knight: '騎士', mage: '法師', elf: '妖精',
        dark: '黑妖', illusion: '幻術', dragon: '龍騎', warrior: '戰士'
    };
    function equipmentTemplateUrl(actor = player) {
        const cls = actor ? EQUIPMENT_TEMPLATE_CLASS[actor.cls] : '';
        if (!cls) return 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.png') + '?v=20260713';
        const avatar = String(actor?.avatar || '');
        const female = avatar.startsWith('女') || avatar === '公主';   // 👑 v3.6.01 王族性別直接看 avatar：舊制以 bloodPledge 推斷，血盟改版後創角不再自動入盟、陣營又隨盟主而非自己 → 公主未入盟/入王子盟會誤判為男
        return 'public/assets/login/EQ%20UI/' + encodeURIComponent((female ? '女' : '男') + cls + '.png') + '?v=20260713';
    }
    function syncEquipmentBackground() {
        const background = el('equipment-window-frame')?.querySelector('.equipment-window-bg');
        if (!background) return;
        const src = EQUIPMENT_BACKDROP_URL;
        if (background.getAttribute('src') !== src) background.src = src;
    }

    // 🗑️ v3.5.84 移除 18 欄數值（等級/經驗/HP/MP/AC/萬能藥/PK/六維/四屬性抗/ER）：
    //    那批座標是「上一版角色卡版型」留下的百分比，現行底圖（public/assets/login/EQ UI/<性別><職業>.png）
    //    已改成純裝備格版型、上面沒有任何欄位標籤。這些數值在「能力」分頁本來就有完整顯示；
    //    PVP 的真實指標是性向值 alignmentValue，單一顯示點在 js/10 的 PVP 面板，勿在此重複。
    function renderSummary() {
        const summary = el('equipment-window-summary');
        if (!summary || typeof equipmentSummaryHtml !== 'function') return;
        const html = equipmentSummaryHtml(player, 'player');
        if (summary.innerHTML !== html) summary.innerHTML = html;
    }
    function renderStats() {
        if (typeof player === 'undefined' || !player || !player.d) return;
        const d = player.d;
        renderSummary();
        const weight = el('equipment-window-weight');
        if (weight) {
            const weightPct = Math.max(0, Math.round(Number(d.weightPct) || 0));
            const loadTier = Math.max(0, Math.min(3, Number(d.loadTier) || 0));
            weight.textContent = `負重 ${weightPct} %`;
            weight.dataset.loadTier = String(loadTier);
            weight.setAttribute('aria-label', `目前負重 ${weightPct}%`);
        }
    }

    // Share the original slot artwork and badges with read-only teammate views.
    function createEquipmentVisualSlot(item, pos) {
        const data = item && DB.items[item.id];
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'equipment-visual-slot' + (item ? ' is-filled' : ' is-empty');
        slot.style.cssText = `left:${pos.x}%;top:${pos.y}%;width:${pos.w}%;height:${pos.h}%;`;
        if (item && data) {
            const img = document.createElement('img');
            img.src = getIconUrl(data);
            img.alt = data.n || pos.k;
            img.draggable = false;
            img.onerror = function () { this.style.display = 'none'; };
            // 裝備框沿用背包／舊裝備欄的統一圖示光效：祝福金光、遠古紫光、屬性光、遺物與傳說皆由單一判定處理。
            if (typeof getGlowClass === 'function') {
                const glowClass = getGlowClass(item, data);
                if (glowClass) img.classList.add(...glowClass.split(/\s+/).filter(Boolean));
            }
            slot.appendChild(img);
            if ((data.type === 'wpn' || data.type === 'arm' || data.type === 'acc') && !data.isArrow) {
                const equipped = document.createElement('span');
                equipped.className = 'equipment-slot-equipped';
                equipped.textContent = 'E';
                equipped.setAttribute('aria-hidden', 'true');
                slot.appendChild(equipped);
            }
            if ((Number(item.en) || 0) > 0) {
                const badge = document.createElement('span');
                badge.className = 'equipment-slot-enhance';
                badge.textContent = '+' + capEn(item.en, data);
                slot.appendChild(badge);
            } else if ((item.cnt || 1) > 1) {
                const count = document.createElement('span');
                count.className = 'equipment-slot-count';
                count.textContent = (item.cnt || 1).toLocaleString();
                slot.appendChild(count);
            }
            slot.classList.add('tip-host');
        } else {
            slot.title = '尚未裝備';
        }
        return slot;
    }
    window.equipmentView = { pages: PAGE_SLOTS, templateUrl: equipmentTemplateUrl, createSlot: createEquipmentVisualSlot, backdropUrl: EQUIPMENT_BACKDROP_URL, layout: equipmentLayout, positionSlots: positionEquipmentSlots, fitWidth: fitEquipmentWidth };

    function renderSlots() {
        if (typeof player === 'undefined' || !player || !player.eq) return;
        const host = el('equipment-window-slots');
        host.innerHTML = '';
        if (page === 0) {
            const figure = document.createElement('div');
            figure.className = 'party-paperdoll-figure';
            figure.setAttribute('aria-hidden', 'true');
            const key = loadStartKeyFromSummary({ avatar: player.avatar, rawCls: player.cls });
            const image = document.createElement('img');
            image.src = loadFrameSrc(key, loadFirstFrame(key));
            image.alt = ''; image.draggable = false;
            figure.appendChild(image); host.appendChild(figure);
        }
        PAGE_SLOTS[page].forEach(pos => {
            const actualKey = pos.alt && player.eq[pos.alt] ? pos.alt : pos.k;
            const item = player.eq[actualKey];
            const data = item && typeof DB !== 'undefined' && DB.items[item.id];
            const slot = createEquipmentVisualSlot(item, pos);
            slot.appendChild(partyEquipmentDefault(player, pos));
            slot.dataset.equipmentSlot = actualKey;
            if (item && data) {
                slot.setAttribute('data-tip-uid', item.uid);
                slot.setAttribute('data-tip-src', 'eq');
                slot.onclick = function () { openModal(item, true, actualKey); };
                slot.ondblclick = function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    unequipItem(actualKey);
                };
            }
            host.appendChild(slot);
        });
        const pageOne = el('equipment-window-prev');
        const pageTwo = el('equipment-window-next');
        pageOne.disabled = false;
        pageTwo.disabled = false;
        pageOne.classList.toggle('active', page === 0);
        pageTwo.classList.toggle('active', page === 1);
        pageOne.setAttribute('aria-pressed', page === 0 ? 'true' : 'false');
        pageTwo.setAttribute('aria-pressed', page === 1 ? 'true' : 'false');
    }

    function fitEquipmentWindowToViewport() {
        const frame = el('equipment-window-frame');
        const win = el('equipment-window');
        if (!frame || !win || win.classList.contains('hidden')) return;
        const host = el('tab-content-panel');
        if (!host) return;
        if (matchMedia('(max-width: 768px)').matches) {
            const mobileHeight = Math.ceil(host.clientWidth * 4 / 3) + 36;
            host.style.setProperty('--equipment-panel-height', mobileHeight + 'px');
        }
        const summary = el('equipment-window-summary');
        const frameWidth = fitEquipmentWidth(win.clientWidth || host.clientWidth, (win.clientHeight || host.clientHeight) - (summary ? summary.offsetHeight : 0), page);
        const layout = positionEquipmentSlots(el('equipment-window-slots'), frameWidth, page);
        win.style.inset = '0';
        win.style.width = '100%';
        win.style.height = '100%';
        frame.style.setProperty('width', frameWidth + 'px', 'important');
        frame.style.setProperty('height', layout.height + 'px');
        frame.style.setProperty('--equipment-controls-top', (layout.height - 28 / getUiScale()) + 'px');
    }

    // AC and set rows follow buffs between equipment changes; refit only when their height changes.
    window.refreshEquipmentSummary = function () {
        const win = el('equipment-window'), summary = el('equipment-window-summary');
        if (!win || !summary || win.classList.contains('hidden')) return;
        const height = summary.offsetHeight;
        renderSummary();
        if (summary.offsetHeight !== height) fitEquipmentWindowToViewport();
    };

    window.refreshEquipmentWindow = function () {
        const win = el('equipment-window');
        if (!win || win.classList.contains('hidden')) return;
        syncEquipmentBackground();
        renderStats();
        renderSlots();
        fitEquipmentWindowToViewport();
    };

    window.setEquipmentPanelEmbedded = function (visible) {
        const win = el('equipment-window');
        if (!win) return;
        const host = el('tab-content-panel');
        if (host) {
            if (win.parentElement !== host) host.appendChild(win);
            host.classList.toggle('equipment-panel-host', visible);
            if (!visible || !matchMedia('(max-width: 768px)').matches) host.style.removeProperty('--equipment-panel-height');
            else host.style.setProperty('--equipment-panel-height', (Math.ceil(host.clientWidth * 4 / 3) + 36) + 'px');
        }
        win.classList.add('equipment-window-embedded');
        win.classList.toggle('hidden', !visible);
        win.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (!visible) return;
        if (matchMedia('(max-width: 768px)').matches) {
            const scroller = el('game-screen');
            if (scroller && host) {
                const scrollerRect = scroller.getBoundingClientRect();
                const hostRect = host.getBoundingClientRect();
                if (hostRect.bottom > scrollerRect.bottom) scroller.scrollTop += (hostRect.bottom - scrollerRect.bottom) / getUiScale() + 8;
                if (hostRect.top < scrollerRect.top) scroller.scrollTop -= (scrollerRect.top - hostRect.top) / getUiScale() + 8;
            }
        }
        refreshEquipmentWindow();
        fitEquipmentWindowToViewport();
        requestAnimationFrame(fitEquipmentWindowToViewport);
    };

    // 🗑️ 移除 window.openEquipmentWindow／window.toggleEquipmentWindow：
    //   v3.5.87 砍掉整組浮動視窗開關流程後兩者已零呼叫點（js/*.js、index.html/test.html 的 inline onclick、css/ 全域 Grep 皆無）。
    //   目前唯一活著的入口＝js/10-ui-tabs.js 直接呼叫 window.setEquipmentPanelEmbedded(布林)。

    function init() {
        const frame = el('equipment-window-frame');
        if (!frame) return;
        const win = el('equipment-window');
        if (win) win.classList.add('equipment-window-embedded');
        const background = frame.querySelector('.equipment-window-bg');
        if (background) syncEquipmentBackground();
        el('equipment-window-prev').setAttribute('aria-label', '裝備第 1 頁');
        el('equipment-window-next').setAttribute('aria-label', '裝備第 2 頁');
        el('equipment-window-prev').textContent = '裝備 1';
        el('equipment-window-next').textContent = '裝備 2';
        el('equipment-window-prev').onclick = function () { page = 0; refreshEquipmentWindow(); };
        el('equipment-window-next').onclick = function () { page = 1; refreshEquipmentWindow(); };
        window.addEventListener('resize', fitEquipmentWindowToViewport);
        const gameScroller = el('game-screen');
        if (gameScroller) gameScroller.addEventListener('scroll', fitEquipmentWindowToViewport, { passive: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
