/* ---------- toolbox (controls + components usable in the active one) ---------- */
/**
 * Markup of one toolbox button: type key t, glyph g, label l; highlighted while it is the armed tool.
 */
const btn = (t, g, l) => `<button class="tb${armed === t ? ' on' : ''}" data-t="${t}" draggable="true"><span>${g}</span>${esc(l)}</button>`;
/**
 * Redraws the toolbox: the Select tool, all control types and the components that may be placed in the active document
 * (a component can't contain itself, so ones that already use the current document are left out;
 * private components - dependencies of an imported app, see mergeDocs - are not offered, they stay reachable as tabs).
 */
function drawTools() {
    let h = `<button class="tb${armed ? '' : ' on'}" data-t=""><span>▸</span>Select</button>`;
    for (const k in T)
        if (k !== 'comp')
            h += btn(k, T[k].g, T[k].l);
    const cs = docs.filter(d => d !== cur && !uses(d, cur) && !d.root.priv);
    if (cs.length)
        h += '<div class="sh">Components</div>' + cs.map(d => btn('comp:' + d.id, '◫', d.root.name)).join('');
    $('#tb').innerHTML = h;
    $('#stage').classList.toggle('armed', !!armed);
}
// Click: arm the tool (a second click on it disarms), so the next click or drag on the form places a control.
$('#tb').addEventListener('click', e => {
    const b = e.target.closest('.tb');
    if (!b)
        return;
    armed = b.dataset.t && armed !== b.dataset.t ? b.dataset.t : null;
    drawTools();
});
// Double click: add the control directly to the selected container (or the form), at a cascading offset.
$('#tb').addEventListener('dblclick', e => {
    const b = e.target.closest('.tb');
    if (!b || !b.dataset.t)
        return;
    armed = null;
    push();
    const p = P();
    // Decide the target container c (and slot sl for component instances): the selected container/instance,
    // else the parent of the current selection.
    let c,
        sl;
    if (sel.length === 1 && p.type === 'comp' && slotNames(p).length) {
        c = p;
        sl = curSlot(p);
    }
    else if (sel.length === 1 && isC(p))
        c = p;
    else {
        c = idx.get(sel[0])?.p || root;
        if (c.type === 'comp') {
            sl = p.slot || slotNames(c)[0];
            if (!sl)
                c = root;
        }
    }
    // Offset of 16px steps (wrapping after 10) so repeated inserts don't land exactly on top of each other.
    const o = 16 + (c.kids.length % 10) * 16,
        n = mk(b.dataset.t, o, o);
    if (c.type === 'comp')
        n.slot = sl;
    c.kids.push(n);
    n.name = uname(b.dataset.t);
    sel = [n.id];
    render(1);
});
// Dragging a tool: the type key travels as plain text; the drop is handled on the stage below.
$('#tb').addEventListener('dragstart', e => {
    const b = e.target.closest('.tb');
    if (!b || !b.dataset.t) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData('text/plain', b.dataset.t);
    e.dataTransfer.effectAllowed = 'copy';
});
// The editing stage; the drag-over/leave/drop handlers highlight the container under the pointer and place the dropped control.
const stage = $('#stage');
stage.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
        if (!dragId)
            hover(e.clientX, e.clientY);
    }
});
stage.addEventListener('dragleave', e => {
    if (!stage.contains(e.relatedTarget))
        hover();
});
stage.addEventListener('drop', e => {
    const t = e.dataTransfer.getData('text/plain');
    if (!T[t.split(':')[0]])
        return;
    e.preventDefault();
    hover();
    push();
    place(t, e.clientX, e.clientY, containerAt(e.clientX, e.clientY, []));
    render(1);
});
