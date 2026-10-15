// ===== 可拖曳共用倉庫視窗（資料操作沿用 js/12-npc-quests.js）=====
(function () {
    let drag = null, sizing = null;
    function el(id) { return document.getElementById(id); }

    window.warehouseWindowIsOpen = function () {
        const win = el('warehouse-window');
        return !!win && !win.classList.contains('hidden');
    };

    window.openWarehouseWindow = function () {
        const win = el('warehouse-window');
        const content = el('warehouse-window-content');
        if (!win || !content) return;
        win.classList.remove('hidden');
        win.setAttribute('aria-hidden', 'false');
        fitWindow();
        if (typeof renderWarehouseNPC === 'function') renderWarehouseNPC(content);
    };

    window.closeWarehouseWindow = function () {
        const win = el('warehouse-window');
        if (!win) return;
        win.classList.add('hidden');
        win.setAttribute('aria-hidden', 'true');
        drag = sizing = null;
    };

    function fitWindow() {
        const frame = el('warehouse-window-frame');
        if (!warehouseWindowIsOpen() || !frame || !frame.style.width && frame.style.transform !== 'none') return;
        const r = frame.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        const width = Math.min(r.width, vw - 16), height = Math.min(r.height, vh - 16);
        if (frame.style.width) { frame.style.width = screenToUiPx(width); frame.style.height = screenToUiPx(height); }
        frame.style.left = screenToUiPx(Math.max(8, Math.min(vw - width - 8, r.left)));
        frame.style.top = screenToUiPx(Math.max(8, Math.min(vh - height - 8, r.top)));
        frame.style.transform = 'none';
    }

    function resizeFrame(side, r, dx, dy) {
        const frame = el('warehouse-window-frame'), scale = getUiScale();
        const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        const minWidth = Math.min(760 * scale, vw - 16), minHeight = Math.min(480 * scale, vh - 16);
        const left = side.includes('w') ? Math.max(8, Math.min(r.right - minWidth, r.left + dx)) : r.left;
        const right = side.includes('e') ? Math.min(vw - 8, Math.max(r.left + minWidth, r.right + dx)) : r.right;
        const top = side.includes('n') ? Math.max(8, Math.min(r.bottom - minHeight, r.top + dy)) : r.top;
        const bottom = side.includes('s') ? Math.min(vh - 8, Math.max(r.top + minHeight, r.bottom + dy)) : r.bottom;
        frame.style.width = screenToUiPx(right - left);
        frame.style.height = screenToUiPx(bottom - top);
        frame.style.left = screenToUiPx(left);
        frame.style.top = screenToUiPx(top);
        frame.style.aspectRatio = 'auto';
        frame.style.transform = 'none';
    }

    function init() {
        const frame = el('warehouse-window-frame');
        const handle = el('warehouse-window-drag');
        const close = el('warehouse-window-close');
        if (!frame || !handle || !close) return;
        close.onclick = closeWarehouseWindow;

        for (const side of ['n','s','e','w','ne','nw','se','sw']) {
            const edge = document.createElement('div');
            edge.dataset.warehouseResize = side;
            edge.className = 'warehouse-resize-edge';
            edge.tabIndex = 0;
            edge.setAttribute('role', 'separator');
            edge.setAttribute('aria-label', '調整倉庫視窗大小');
            edge.title = '拖曳邊界調整大小；方向鍵也可調整';
            frame.appendChild(edge);
            edge.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                fitWindow(); drag = null;
                sizing = { id: event.pointerId, side, x: event.clientX, y: event.clientY, r: frame.getBoundingClientRect() };
                edge.setPointerCapture(event.pointerId);
                event.preventDefault();
            });
            edge.addEventListener('pointermove', function (event) {
                if (!sizing || sizing.id !== event.pointerId) return;
                resizeFrame(sizing.side, sizing.r, event.clientX - sizing.x, event.clientY - sizing.y);
            });
            for (const type of ['pointerup','pointercancel','lostpointercapture']) edge.addEventListener(type, function (event) {
                if (sizing?.id === event.pointerId) sizing = null;
            });
            edge.addEventListener('keydown', function (event) {
                const delta = { ArrowLeft: [-24,0], ArrowRight: [24,0], ArrowUp: [0,-24], ArrowDown: [0,24] }[event.key];
                if (!delta) return;
                event.preventDefault(); fitWindow();
                resizeFrame(side, frame.getBoundingClientRect(), delta[0] * getUiScale(), delta[1] * getUiScale());
            });
        }

        handle.addEventListener('pointerdown', function (event) {
            if (event.target.closest('button, input, select')) return;
            const rect = frame.getBoundingClientRect();
            drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
            handle.setPointerCapture(event.pointerId);
            // 🗑️ 移除 classList.add('is-dragging')：三份樣式表(style/floating-ui/tailwind-built)皆無此選擇器、亦無任何 JS 讀取 → 純無效果的狀態標記。
            event.preventDefault();
        });
        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.id !== event.pointerId) return;
            const maxX = Math.max(0, document.documentElement.clientWidth - frame.getBoundingClientRect().width);
            const maxY = Math.max(0, document.documentElement.clientHeight - frame.getBoundingClientRect().height);
            frame.style.left = screenToUiPx(Math.max(0, Math.min(maxX, event.clientX - drag.dx)));
            frame.style.top = screenToUiPx(Math.max(0, Math.min(maxY, event.clientY - drag.dy)));
            frame.style.transform = 'none';
        });
        function stop(event) {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;   // 🗑️ 同上：原 classList.remove('is-dragging') 一併移除
        }
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
        addEventListener('resize', fitWindow);
        addEventListener('ui-scale-change', fitWindow);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
