// ===== 可拖曳共用倉庫視窗（資料操作沿用 js/12-npc-quests.js）=====
(function () {
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
    };

    function fitClassicWindow(frame, minWidth, minHeight) {
        const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, scale = getUiScale();
        const r = frame.getBoundingClientRect(), sized = frame.dataset.windowSized === 'true';
        const warehouse = frame.id === 'warehouse-window-frame';
        const defaultHeight = warehouse ? 600 * scale : Math.max(vh * .88, minHeight * scale);
        const height = Math.min(sized ? r.height : defaultHeight, vh - 16);
        const style = getComputedStyle(frame), border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const sidebar = warehouse ? 0 : parseFloat(style.getPropertyValue('--guild-sidebar-width'));
        const artWidth = warehouse ? 0 : equipmentView.fitWidth(Math.max(1,(vw - 16) / scale - border - sidebar), Math.max(1,height / scale - border), 0);
        const defaultWidth = warehouse ? 830 * scale : Math.max((artWidth + border + sidebar) * scale, minWidth * scale);
        const width = Math.min(sized ? r.width : defaultWidth, vw - 16);
        const moved = sized || frame.dataset.windowMoved === 'true';
        frame.style.width = screenToUiPx(width); frame.style.height = screenToUiPx(height);
        frame.style.left = screenToUiPx(moved ? Math.max(8, Math.min(vw - width - 8, r.left)) : (vw - width) / 2);
        frame.style.top = screenToUiPx(moved ? Math.max(8, Math.min(vh - height - 8, r.top)) : (vh - height) / 2);
        frame.style.transform = 'none';
    }

    function fitWindow() {
        const frame = el('warehouse-window-frame');
        if (!warehouseWindowIsOpen() || !frame) return;
        fitClassicWindow(frame, 760, 480);
    }

    function resizeFrame(frame, side, r, dx, dy) {
        const scale = getUiScale();
        frame.dataset.windowSized = 'true';
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

    window.bindClassicWindowDrag = function (frame, handle) {
        let drag = null;
        function move(x, y) {
            const r = frame.getBoundingClientRect();
            frame.style.left = screenToUiPx(Math.max(8, Math.min(document.documentElement.clientWidth - r.width - 8, x)));
            frame.style.top = screenToUiPx(Math.max(8, Math.min(document.documentElement.clientHeight - r.height - 8, y)));
            frame.style.transform = 'none';
        }
        handle.addEventListener('pointerdown', function (event) {
            if (event.button !== 0 || event.target.closest('button, input, select')) return;
            frame.dataset.windowMoved = 'true';
            const rect = frame.getBoundingClientRect();
            drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        handle.addEventListener('pointermove', function (event) {
            if (drag?.id === event.pointerId) move(event.clientX - drag.dx, event.clientY - drag.dy);
        });
        for (const type of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(type, function (event) {
            if (drag?.id === event.pointerId) drag = null;
        });
        function fitMoved() {
            if (frame.dataset.windowMoved !== 'true' || !frame.checkVisibility()) return;
            const r = frame.getBoundingClientRect();
            move(r.left, r.top);
        }
        addEventListener('resize', fitMoved);
        addEventListener('ui-scale-change', fitMoved);
    };

    window.bindClassicWindow = function (frame, handle, close, isOpen, onClose, kind) {
        let sizing = null;
        function fitWindow() { if (isOpen()) fitClassicWindow(frame, 760, 480); }
        close.onclick = onClose;

        for (const side of ['n','s','e','w','ne','nw','se','sw']) {
            const edge = document.createElement('div');
            edge.dataset[kind + 'Resize'] = side;
            edge.className = 'warehouse-resize-edge';
            edge.tabIndex = 0;
            edge.setAttribute('role', 'separator');
            edge.setAttribute('aria-label', '調整視窗大小');
            edge.title = '拖曳邊界調整大小；方向鍵也可調整';
            frame.appendChild(edge);
            edge.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                fitWindow();
                sizing = { id: event.pointerId, side, x: event.clientX, y: event.clientY, r: frame.getBoundingClientRect() };
                edge.setPointerCapture(event.pointerId);
                event.preventDefault();
            });
            edge.addEventListener('pointermove', function (event) {
                if (!sizing || sizing.id !== event.pointerId) return;
                resizeFrame(frame, sizing.side, sizing.r, event.clientX - sizing.x, event.clientY - sizing.y);
            });
            for (const type of ['pointerup','pointercancel','lostpointercapture']) edge.addEventListener(type, function (event) {
                if (sizing?.id === event.pointerId) sizing = null;
            });
            edge.addEventListener('keydown', function (event) {
                const delta = { ArrowLeft: [-24,0], ArrowRight: [24,0], ArrowUp: [0,-24], ArrowDown: [0,24] }[event.key];
                if (!delta) return;
                event.preventDefault(); fitWindow();
                resizeFrame(frame, side, frame.getBoundingClientRect(), delta[0] * getUiScale(), delta[1] * getUiScale());
            });
        }

        bindClassicWindowDrag(frame, handle);
        addEventListener('resize', fitWindow);
        addEventListener('ui-scale-change', fitWindow);
        return fitWindow;
    };

    function init() {
        const frame = el('warehouse-window-frame');
        if (frame) bindClassicWindow(frame, el('warehouse-window-drag'), el('warehouse-window-close'), warehouseWindowIsOpen, closeWarehouseWindow, 'warehouse');
        bindClassicWindowDrag(el('town-interaction-container'), el('town-interaction-header'));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
