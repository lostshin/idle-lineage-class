// Device-specific column widths. Combat and character state remain untouched.
(function () {
    const key = 'lineage_column_layout_v1', game = document.getElementById('game-screen');
    const left = document.getElementById('col-left'), center = document.getElementById('col-center'), right = document.getElementById('col-right');
    let prefs = null, drag = null;
    try { const value = JSON.parse(_lsGet(key)); if (value && Number.isFinite(value.left) && Number.isFinite(value.right) && value.left > 0 && value.right > 0 && value.left + value.right < 1) prefs = value; } catch (e) {}
    const control = document.createElement('div'); control.className = 'column-layout-controls';
    control.innerHTML = '<span>三欄寬度</span><small>拖曳欄界調整</small><button type="button" class="btn" id="column-layout-reset">重設</button><output id="column-layout-status" role="status"></output>';
    document.querySelector('#tab-automation > div').appendChild(control);
    const handles = ['left','right'].map(side => {
        const node = document.createElement('div'); node.className = 'column-resizer'; node.dataset.columnResizer = side;
        node.tabIndex = 0; node.setAttribute('role','separator'); node.setAttribute('aria-orientation','vertical');
        node.setAttribute('aria-label', side === 'left' ? '調整左欄寬度' : '調整右欄寬度'); node.title = '拖曳調整欄寬；左右方向鍵也可調整';
        node.setAttribute('aria-controls', side === 'left' ? 'col-left col-center' : 'col-center col-right'); game.appendChild(node); return node;
    });
    function bounds() {
        const style = getComputedStyle(game), gap = parseFloat(style.columnGap) || 0;
        const available = game.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - gap * 2;
        const defaultLeft = Math.max(220, Math.min(300, innerWidth * .18)), defaultRight = Math.max(320, Math.min(380, innerWidth * .24));
        return {available, minLeft:220, minRight:300, minCenter:Math.min(804, available-defaultLeft-defaultRight), defaultLeft, defaultRight};
    }
    function position() {
        const z = getUiScale(), host = game.getBoundingClientRect(), a = left.getBoundingClientRect(), b = center.getBoundingClientRect(), c = right.getBoundingClientRect();
        for (const node of handles) {
            const x = node.dataset.columnResizer === 'left' ? (a.right + b.left)/2 : (b.right+c.left)/2;
            node.style.left = screenToUiPx(x-host.left-5*z); node.style.top = screenToUiPx(a.top-host.top);
            node.style.height = screenToUiPx(Math.max(0,host.bottom-a.top-16*z));
            const width = (node.dataset.columnResizer==='left'?a.width:c.width)/z;
            node.setAttribute('aria-valuenow',String(Math.round(width))); node.setAttribute('aria-valuetext',Math.round(width)+' 像素');
        }
    }
    function apply() {
        const desktop = innerWidth >= 1200 && !document.body.classList.contains('m-mobile');
        for (const node of handles) node.hidden = !desktop; control.hidden = !desktop;
        if (!desktop) { game.style.removeProperty('--game-left-width'); game.style.removeProperty('--game-right-width'); return; }
        if (!game.clientWidth) return;
        const b = bounds();
        let l = Math.max(b.minLeft,prefs?prefs.left*b.available:b.defaultLeft), r = Math.max(b.minRight,prefs?prefs.right*b.available:b.defaultRight);
        const budget = b.available-b.minCenter;
        if (l+r>budget) { const extra = l-b.minLeft+r-b.minRight, ratio = Math.max(0,(budget-b.minLeft-b.minRight)/extra); l=b.minLeft+(l-b.minLeft)*ratio; r=b.minRight+(r-b.minRight)*ratio; }
        game.style.setProperty('--game-left-width',l+'px'); game.style.setProperty('--game-right-width',r+'px');
        for (const node of handles) { node.setAttribute('aria-valuemin',String(node.dataset.columnResizer==='left'?b.minLeft:b.minRight)); node.setAttribute('aria-valuemax',String(Math.floor(budget-(node.dataset.columnResizer==='left'?r:l)))); }
        position();
    }
    function persist() {
        const saved = _lsSet(key,JSON.stringify(prefs)) === true;
        document.getElementById('column-layout-status').textContent = saved ? '' : '欄寬已套用，但未儲存。';
        return saved;
    }
    function change(side,width) {
        const b=bounds(),z=getUiScale();let l=left.getBoundingClientRect().width/z,r=right.getBoundingClientRect().width/z;
        if(side==='left')l=Math.max(b.minLeft,Math.min(b.available-b.minCenter-r,width));
        else r=Math.max(b.minRight,Math.min(b.available-b.minCenter-l,width));
        prefs={left:l/b.available,right:r/b.available};apply();window.dispatchEvent(new Event('resize'));
    }
    for (const node of handles) {
        node.addEventListener('pointerdown',e=>{if(e.button!==0)return;const side=node.dataset.columnResizer;drag={side,id:e.pointerId,x:e.clientX,width:(side==='left'?left:right).getBoundingClientRect().width/getUiScale()};node.setPointerCapture(e.pointerId);e.preventDefault();});
        node.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;change(drag.side,drag.width+(e.clientX-drag.x)/getUiScale()*(drag.side==='left'?1:-1));});
        for(const type of ['pointerup','pointercancel'])node.addEventListener(type,()=>{if(!drag)return;drag=null;persist();});
        node.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const side=node.dataset.columnResizer,width=(side==='left'?left:right).getBoundingClientRect().width/getUiScale();change(side,width+(e.key==='ArrowRight'?16:-16)*(side==='left'?1:-1));persist();});
    }
    window.gameLayout={apply,reset(){prefs=null;apply();window.dispatchEvent(new Event('resize'));return persist();}};
    document.getElementById('column-layout-reset').onclick=()=>gameLayout.reset();
    addEventListener('resize',apply);new MutationObserver(apply).observe(game,{attributes:true,attributeFilter:['class']});apply();
})();
