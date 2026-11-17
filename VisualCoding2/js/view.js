/* ---------- rendering ---------- */
// Snaps a value to the 8px grid (when snapping is on) or just rounds it.
const sn = v => snapOn ? Math.round(v / 8) * 8 : Math.round(v);
/**
 * Redraws the whole editor: canvas, selection overlay, tree, tabs, toolbox and (if p) the properties panel,
 * and syncs the code window. This is called after every model change.
 */
function render(p) {
    reindex();
    drawForm();
    drawOv();
    drawTree();
    drawTabs();
    drawTools();
    if (p)
        drawProps();
    syncCode();
}
/**
 * Collects the custom CSS of a form and, recursively, of every component it uses (each component only once).
 */
function allCss(R, seen = new Set()) {
    let s = R.css ? `/* ${R.name} */\n${R.css}\n` : '';
    walk(R, n => {
        if (n.type === 'comp' && !seen.has(n.ref)) {
            seen.add(n.ref);
            const c = docOf(n.ref);
            if (c)
                s += allCss(c.root, seen);
        }
    });
    return s;
}
/**
 * CSS size of the form in the editor. Numbers are pixels; a percentage ("100%") refers to the visible designer area
 * (the stage has no fixed size itself, so the browser could not resolve it); other CSS sizes are passed through.
 */
function formPx(v, horizontal) {
    const m = /^\s*(\d*\.?\d+)\s*%\s*$/.exec(String(v));
    const a = document.querySelector('.designer-content');
    if (!m || !a)
        return U(v);
    const cs = getComputedStyle(a),
        foot = a.querySelector('.foot'),
        avail = horizontal
            ? a.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
            : a.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
                - $('#ttl').offsetHeight - (foot ? foot.offsetHeight + 12 : 0);
    return Math.max(8, Math.round(avail * parseFloat(m[1]) / 100)) + 'px';
}
// Percent sizes follow the designer area: redraw when it changes (window or side panels resized).
if (window.ResizeObserver && document.querySelector('.designer-content'))
    new ResizeObserver(() => {
        if (root && /%/.test('' + root.w + root.h)) {
            drawForm();
            drawOv();
        }
    }).observe(document.querySelector('.designer-content'));
/**
 * Redraws the form on the canvas: applies the root's size and colors, renders all controls, updates the title bar and autosaves.
 */
function drawForm() {
    $('#us').textContent = `#form{${pvVars(root)}${allCss(root)}}`;
    const f = $('#form');
    f.style.width = formPx(root.w, 1);
    f.style.height = formPx(root.h, 0);
    f.style.backgroundColor = root.bg || '';
    f.style.color = root.fg || '';
    f.style.fontSize = root.fs ? root.fs + 'px' : '';
    f.innerHTML = root.kids.map(k => node(k, { ed: 1, own: true, d: 0 })).join('');
    $('#ttl').textContent = root.text || 'Form';
    $('#ttl').classList.toggle('on', sel.includes('root'));
    persist();
}
// bounding box (stage coords) of the whole multi-selection
/* bounding box (stage coords) of the whole multi-selection */
function gbox() {
    let x0 = 1e9,
        y0 = 1e9,
        x1 = -1e9,
        y1 = -1e9;
    for (const id of sel) {
        const n = G(id),
            e = n && n !== root && nEl(n);
        if (!e)
            continue;
        const a = org(e);
        x0 = Math.min(x0, a.x);
        y0 = Math.min(y0, a.y);
        x1 = Math.max(x1, a.x + e.offsetWidth);
        y1 = Math.max(y1, a.y + e.offsetHeight);
    }
    return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
/**
 * Redraws the selection overlay: a box (with resize handles if exactly one control is selected) per selected control,
 * the "insert here" marker for the active slot of a component instance, and a group box when several are selected.
 */
function drawOv() {
    let h = '';
    const one = sel.length === 1;
    for (const id of sel) {
        const n = G(id);
        if (!n)
            continue;
        const a = abs(n);
        h += `<div class="sb" style="left:${a.x}px;top:${a.y}px;width:${(nEl(n) || n).offsetWidth || n.w}px;height:${(nEl(n) || n).offsetHeight || n.h}px">`;
        if (one)
            for (const d of (id === 'root' ? ['e', 's', 'se'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']))
                h += `<i class="h h-${d}" data-h="${d}"></i>`;
        h += '</div>';
    }
    if (one) {
        const n = G(sel[0]),
            s = curSlot(n),
            el = s && cEl(n, s);
        if (el) {
            const a = org(el);
            h += `<div class="sb ss" style="left:${a.x}px;top:${a.y}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px"><i class="st">insert here</i></div>`;
        }
    }
    if (!one) {
        const r = gbox();
        if (r) {
            h += `<div class="sb gb" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">`;
            for (const d of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'])
                h += `<i class="h h-${d}" data-h="${d}"></i>`;
            h += '</div>';
        }
    }
    $('#ov').innerHTML = h;
}
/**
 * Redraws the UI tree: one row per node, indented by depth; folded nodes hide their children
 * and are marked if a hidden child is selected.
 */
function drawTree() {
    let h = '';
    (function w(n, d) {
        const cd = n.type === 'comp' && docOf(n.ref),
            lb = n.type === 'form' ? 'Form' : cd ? cd.root.name : T[n.type].l;
        const hk = n.kids.length > 0,
            cl = hk && fold.has(n.id),
            hs = cl && sel.some(i => i !== n.id && G(i) && contains(n, G(i)));
        h += `<div class="tr${sel.includes(n.id) ? ' on' : hs ? ' hs' : ''}" data-id="${n.id}" tabindex="0" draggable="${n.id !== 'root'}" style="padding-left:${8 + d * 14}px"><span class="tg"${hk ? ' title="Collapse / expand"' : ''}>${hk ? cl ? '▸' : '▾' : ''}</span><span class="g">${n.type === 'form' ? '▣' : T[n.type].g}</span><b>${esc(n.name)}</b><em>${esc(lb)}${n.slot ? ' → ' + esc(n.slot) : ''}</em></div>`;
        if (!cl)
            n.kids.forEach(k => w(k, d + 1));
    })(root, 0);
    $('#tree').innerHTML = h;
}
/**
 * Redraws the document tabs (one per component) plus the "new" button.
 */
function drawTabs() {
    $('#tabs').innerHTML = docs.map(d => `<div class="tab${d === cur ? ' on' : ''}" draggable="true" data-d="${d.id}"${d.root.priv ? ' title="Private component (not listed in the toolbox)"' : ''}><span${d.root.priv ? ' style="opacity:.65;font-style:italic"' : ''}>${esc(d.root.name)}</span><button data-x="${d.id}" aria-label="Close component">×</button></div>`).join('') + '<button class="tab add" data-new title="New component">+</button>';
}
