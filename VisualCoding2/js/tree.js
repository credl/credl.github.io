/* ---------- tree ---------- */
// UI tree panel. dragId = node being dragged, zone = drop position on the hovered row (in / before / after), zrow = that row.
const tree = $('#tree');
// Drag state for reordering nodes in the tree.
let dragId = null,
    zone = null,
    zrow = null;
/**
 * Removes the drop-zone highlight from the hovered tree row.
 */
const clearZ = () => {
    if (zrow)
        zrow.className = zrow.className.replace(/ z(in|before|after)/g, '');
    zrow = null;
};
// Click: the arrow folds/unfolds a node, any other click selects (Shift/Ctrl/Cmd adds to the selection).
tree.addEventListener('click', e => {
    const r = e.target.closest('.tr');
    if (!r)
        return;
    const id = r.dataset.id;
    if (e.target.closest('.tg')) {
        if (G(id)?.kids.length) {
            fold.has(id) ? fold.delete(id) : fold.add(id);
            drawTree();
        }
        return;
    }
    lastSlot = null;
    if (e.shiftKey || e.ctrlKey || e.metaKey)
        toggle(id);
    else
        sel = [id];
    drawOv();
    drawTree();
    drawProps();
});
// Keyboard: Left/Right fold/unfold the focused row, Enter/Space selects it.
tree.addEventListener('keydown', e => {
    const r = e.target.closest('.tr'),
        id = r && r.dataset.id;
    if (r && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && G(id)?.kids.length) {
        e.preventDefault();
        e.key === 'ArrowLeft' ? fold.add(id) : fold.delete(id);
        drawTree();
        const t = tree.querySelector(`[data-id="${id}"]`);
        if (t)
            t.focus();
        return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.target.click();
    }
});
// Drag and drop in the tree: moves a node into a container or before/after another node.
tree.addEventListener('dragstart', e => {
    const r = e.target.closest('.tr');
    if (!r)
        return;
    dragId = r.dataset.id;
    e.dataTransfer.setData('text/plain', 'tree');
    e.dataTransfer.effectAllowed = 'move';
});
// While dragging over a row: the upper/lower quarter means before/after, the middle means "inside" (containers only).
// A node can't be dropped onto itself or onto its own descendants.
tree.addEventListener('dragover', e => {
    if (!dragId)
        return;
    const r = e.target.closest('.tr');
    clearZ();
    if (!r)
        return;
    const t = G(r.dataset.id),
        d = G(dragId);
    if (!t || !d || t === d || contains(d, t))
        return;
    const b = r.getBoundingClientRect(),
        y = (e.clientY - b.top) / b.height;
    zone = t === root ? 'in' : canIn(t) && y > .25 && y < .75 ? 'in' : y < .5 ? 'before' : 'after';
    zrow = r;
    r.classList.add('z' + zone);
    e.preventDefault();
});
// Drop: moves the node, keeps its on-screen position by converting it to coordinates relative to the new parent.
tree.addEventListener('drop', e => {
    if (!zrow || !dragId)
        return;
    e.preventDefault();
    const t = G(zrow.dataset.id),
        n = G(dragId),
        a = org(nEl(n)),
        p = idx.get(n.id).p;
    push();
    p.kids.splice(p.kids.indexOf(n), 1);
    let np,
        pos,
        sl;
    if (zone === 'in') {
        np = t;
        pos = t.kids.length;
        sl = t.type === 'comp' ? slotNames(t)[0] : undefined;
    }
    else {
        np = idx.get(t.id).p;
        pos = np.kids.indexOf(t) + (zone === 'after' ? 1 : 0);
        sl = np.type === 'comp' ? t.slot : undefined;
    }
    const na = org(cEl(np, sl) || $('#form'));
    np.kids.splice(pos, 0, n);
    n.slot = sl;
    n.x = a.x - na.x;
    n.y = a.y - na.y;
    clearZ();
    dragId = null;
    sel = [n.id];
    render(1);
});
tree.addEventListener('dragend', () => {
    clearZ();
    dragId = null;
});
