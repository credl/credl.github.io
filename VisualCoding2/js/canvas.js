/* ---------- canvas interaction ---------- */
// lastSlot = slot of a component instance that was clicked last, hov = element currently highlighted as the drop target.
let lastSlot = null,
    hov = null;
/* the slot of an instance that receives inserts (last clicked slot, else the first) */
const curSlot = n => n && n.type === 'comp'
    ? (slotNames(n).includes(lastSlot) ? lastSlot : slotNames(n)[0])
    : undefined;
/* highlight the deepest container under the pointer = where an insert would land */
function hover(cx, cy) {
    if (hov) {
        hov.classList.remove('hov');
        hov = null;
    }
    if (cx == null)
        return;
    const t = containerAt(cx, cy, []),
        el = cEl(t.n, t.slot);
    if (el) {
        el.classList.add('hov');
        hov = el;
    }
}
/**
 * Finds the deepest container under the screen position (cx, cy) that can take children: a container control or a component slot.
 * Nodes in `ex` (and their descendants) are skipped so a dragged node can't be dropped into itself. Falls back to the form.
 */
function containerAt(cx, cy, ex) {
    for (const el of document.elementsFromPoint(cx, cy)) {
        const id = el.dataset && el.dataset.id;
        if (!id)
            continue;
        const n = G(id);
        if (!n || !(isC(n) || el.dataset.slot) || ex.some(x => x === n || contains(x, n)))
            continue;
        return { n, el, slot: el.dataset.slot };
    }
    return { n: root, el: $('#form') };
}
/**
 * Creates a control of the given type at the (snapped) screen position inside container t, selects it and returns it.
 */
function place(type, cx, cy, t) {
    const r = t.el.getBoundingClientRect(),
        n = mk(type, sn(cx - r.left), sn(cy - r.top));
    if (t.slot)
        n.slot = t.slot;
    t.n.kids.push(n);
    n.name = uname(type);
    sel = [n.id];
    return n;
}
/**
 * The selected nodes without those that have a selected ancestor (moving the ancestor already moves them).
 */
function tops() {
    return sel.filter(i => i !== 'root').map(G).filter(n => n && !sel.some(j => j !== n.id && G(j) && contains(G(j), n)));
}
/**
 * Toggles an id in the selection (Shift/Ctrl/Cmd + click). An empty selection means the form.
 */
function toggle(id) {
    sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel.filter(x => x !== 'root'), id];
    if (!sel.length)
        sel = ['root'];
}
/**
 * Generic pointer drag: calls mv on every move and up once on release; the listeners are removed again afterwards.
 */
function drag(e, mv, up) {
    const m = ev => mv(ev),
        u = ev => {
            removeEventListener('pointermove', m);
            removeEventListener('pointerup', u);
            up(ev);
        };
    addEventListener('pointermove', m);
    addEventListener('pointerup', u);
}
// With a tool armed, highlight the container under the pointer.
stage.addEventListener('pointermove', e => {
    if (armed && !e.buttons)
        hover(e.clientX, e.clientY);
});
stage.addEventListener('pointerleave', () => hover());
// Pointer down on the canvas, in order: resize handle -> resize; armed tool -> place a control; double click -> open code/component;
// form background or Alt -> rubber band; otherwise select and start moving.
stage.addEventListener('pointerdown', e => {
    hover();
    if (e.button)
        return;
    e.preventDefault();
    if (document.activeElement)
        document.activeElement.blur();
    const h = e.target.dataset && e.target.dataset.h;
    if (h) {
        startResize(e, h);
        return;
    }
    if (armed) {
        push();
        const type = armed,
            n = place(type, e.clientX, e.clientY, containerAt(e.clientX, e.clientY, []));
        armed = null;
        if (type.startsWith('comp:')) {
            render(1);
            return;
        }
        // Start as a tiny box and let the user drag out the size; a plain click falls back to the default size (see startResize).
        n.w = n.h = 8;
        render(1);
        startResize(e, 'se', T[type]);
        return;
    }
    const el = e.target.closest('[data-id]'),
        id = el ? el.dataset.id : 'root';
    lastSlot = el && el.dataset.slot || null;
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    // Double click = second press within 400 ms and 6 px of the first one, on the same element.
    const now = Date.now();
    if (now - lastDown.t < 400
        && lastDown.id === id
        && Math.abs(e.clientX - lastDown.x) < 6
        && Math.abs(e.clientY - lastDown.y) < 6
        && !add) {
        lastDown = { t: 0 };
        dblOpen(el, id);
        return;
    }
    lastDown = { t: now, id, x: e.clientX, y: e.clientY };
    // Press on the form background, Alt, or an unselected container/slot -> rubber band inside that container.
    // A press on an already selected container moves it (click to select, release, press again to move).
    const nd = G(id),
        cont = !!el && !!nd && (isC(nd) || !!el.dataset.slot);
    if (id === 'root' || e.altKey || (cont && !sel.includes(id))) {
        startMarquee(e, add, id);
        return;
    }
    // Shift/Ctrl/Cmd toggles the control in the selection. A plain press on an unselected control selects it.
    // On an already selected control the selection is kept for now, so a group can be moved;
    // `collapse` reduces it to this control on release if nothing was dragged.
    let collapse = null;
    if (add) {
        toggle(id);
        render(1);
        if (!sel.includes(id))
            return;
    }
    else if (!sel.includes(id)) {
        sel = [id];
        render(1);
    }
    else {
        collapse = id;
        drawOv();
    }
    if (id === 'root')
        return;
    startMove(e, collapse);
});
// Click on the form's title bar selects the form.
$('#ttl').addEventListener('pointerdown', e => {
    sel = ['root'];
    render(1);
});
/* double click is detected here (the editor re-renders on press, so the browser's own dblclick never fires):
   controls and the form open the code window; component instances open the component */
let lastDown = { t: 0 };
function dblOpen(el, id) {
    const n = G(id);
    if (!n || (el && el.dataset.slot))
        return;
    if (n.type === 'comp') {
        if (docOf(n.ref))
            useDoc(docOf(n.ref));
    }
    else
        openCode(n);
}
/**
 * Moves the selected controls with the pointer (snapped to the grid). On release, controls dropped onto a different
 * container are re-parented and keep their on-screen position. `collapse`: id to select on release if the pointer never moved.
 */
function startMove(e, collapse) {
    const list = tops(),
        o = list.map(n => ({ n, x: n.x, y: n.y })),
        x0 = e.clientX,
        y0 = e.clientY;
    let moved = false,
        tgt = { n: root };
    drag(e, ev => {
        const dx = ev.clientX - x0,
            dy = ev.clientY - y0;
        // Ignore tiny movements (click jitter). The first real move takes the undo snapshot and
        // reads CSS-string positions back from the DOM as numbers.
        if (!moved) {
            if (Math.abs(dx) + Math.abs(dy) < 3)
                return;
            moved = true;
            push();
            o.forEach(s => {
                const el = nEl(s.n);
                if (typeof s.x !== 'number')
                    s.x = el.offsetLeft;
                if (typeof s.y !== 'number')
                    s.y = el.offsetTop;
            });
        }
        o.forEach(s => {
            s.n.x = sn(s.x + dx);
            s.n.y = sn(s.y + dy);
        });
        tgt = containerAt(ev.clientX, ev.clientY, list);
        drawForm();
        drawOv();
        syncGeom();
        // Highlight the container the controls would land in, if it differs from their current parent.
        if (tgt.n !== idx.get(list[0].id).p || tgt.slot !== list[0].slot) {
            const el = cEl(tgt.n, tgt.slot);
            el && el.classList.add('drop');
        }
    }, () => {
        if (!moved) {
            if (collapse) {
                sel = [collapse];
                render(1);
            }
            return;
        }
        // On release: re-parent controls dropped on another container, converting their position to the new parent's coordinates.
        const ta = org(cEl(tgt.n, tgt.slot) || $('#form'));
        list.forEach(n => {
            const a = org(nEl(n)),
                p = idx.get(n.id).p;
            if (p !== tgt.n || n.slot !== tgt.slot) {
                p.kids.splice(p.kids.indexOf(n), 1);
                tgt.n.kids.push(n);
                n.slot = tgt.slot;
                n.x = sn(a.x - ta.x);
                n.y = sn(a.y - ta.y);
            }
        });
        render(1);
    });
}
/* rubber band: starts on the form background, or (Alt) inside any container; limited to that container; selects its direct children it touches */
// The rubber-band rectangle element.
const mq = document.createElement('div');
mq.id = 'mq';
function startMarquee(e, add, id) {
    const t = e.altKey || id !== 'root' ? containerAt(e.clientX, e.clientY, []) : { n: root },
        ce = cEl(t.n, t.slot) || $('#form'),
        cr = ce.getBoundingClientRect(),
        sr = stage.getBoundingClientRect(),
        base = add ? sel.filter(i => i !== 'root') : [],
        cl = (v, a, b) => Math.max(a, Math.min(b, v)),
        x0 = cl(e.clientX, cr.left, cr.right),
        y0 = cl(e.clientY, cr.top, cr.bottom),
        kids = t.n.kids.filter(k => t.n.type !== 'comp' || k.slot === t.slot);
    let moved = false;
    drag(e, ev => {
        const x = cl(ev.clientX, cr.left, cr.right),
            y = cl(ev.clientY, cr.top, cr.bottom),
            l = Math.min(x0, x),
            tp = Math.min(y0, y),
            r = Math.max(x0, x),
            b = Math.max(y0, y);
        if (!moved) {
            if (r - l + b - tp < 4)
                return;
            moved = true;
            stage.append(mq);
        }
        mq.style.cssText = `left:${l - sr.left}px;top:${tp - sr.top}px;width:${r - l}px;height:${b - tp}px`;
        const hit = kids.filter(k => {
            const q = nEl(k)?.getBoundingClientRect();
            return q && q.left < r && q.right > l && q.top < b && q.bottom > tp;
        }).map(k => k.id);
        sel = [...new Set([...base, ...hit])];
        if (!sel.length)
            sel = [add || t.n === root ? 'root' : t.n.id];
        drawOv();
    }, () => {
        mq.remove();
        if (!moved) {
            if (add)
                toggle(id);
            else
                sel = [id];
        }
        render(1);
    });
}
/* resize the whole multi-selection: scale every top-level element about the group box */
function startGroupResize(e, d) {
    // G0 = start box of the whole selection (stage coordinates), list = the top-level controls with their start geometry.
    const G0 = gbox();
    if (!G0)
        return;
    const list = tops().map(n => {
        const el = nEl(n),
            a = org(el);
        return { n, a, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    }),
        x0 = e.clientX,
        y0 = e.clientY;
    let did = false;
    drag(e, ev => {
        const dx = ev.clientX - x0,
            dy = ev.clientY - y0;
        if (!did) {
            if (Math.abs(dx) + Math.abs(dy) < 3)
                return;
            did = true;
            push();
        }
        // L/Tp/R/B = left, top, right, bottom of the group box; the dragged edges follow the pointer (snapped).
        let L = G0.x,
            Tp = G0.y,
            R = G0.x + G0.w,
            B = G0.y + G0.h;
        if (d.includes('e'))
            R = sn(R + dx);
        if (d.includes('w'))
            L = sn(L + dx);
        if (d.includes('s'))
            B = sn(B + dy);
        if (d.includes('n'))
            Tp = sn(Tp + dy);
        // Minimum size 8 px: the dragged edge stops and the opposite edge stays where it is.
        if (R - L < 8) {
            d.includes('w') ? L = R - 8 : R = L + 8;
        }
        if (B - Tp < 8) {
            d.includes('n') ? Tp = B - 8 : B = Tp + 8;
        }
        // Scale factors of the group box; every control is scaled (position and size) about it.
        const sx = (R - L) / G0.w,
            sy = (B - Tp) / G0.h;
        list.forEach(s => {
            s.n.w = Math.max(4, Math.round(s.w * sx));
            s.n.h = Math.max(4, Math.round(s.h * sy));
            s.n.x = Math.round(s.x + (L + (s.a.x - G0.x) * sx - s.a.x));
            s.n.y = Math.round(s.y + (Tp + (s.a.y - G0.y) * sy - s.a.y));
        });
        drawForm();
        drawOv();
        syncGeom();
    }, () => render(1));
}
/**
 * Resizes the selected control by dragging handle d (compass direction: n, ne, e, se, s, sw, w, nw).
 * With several controls selected the group resize is used instead. `def` is set for a freshly placed control:
 * if it is never dragged, the control gets its default size.
 */
function startResize(e, d, def) {
    if (sel.length > 1 && !def)
        return startGroupResize(e, d);
    const prim = G(sel[sel.length - 1]),
        list = [prim],
        o = new Map(),
        x0 = e.clientX,
        y0 = e.clientY;
    let did = false;
    drag(e, ev => {
        const dx = ev.clientX - x0,
            dy = ev.clientY - y0;
        if (!did) {
            if (Math.abs(dx) + Math.abs(dy) < 3)
                return;
            did = true;
            if (!def)
                push();
            list.forEach(n => {
                const el = nEl(n);
                o.set(n, { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
            });
        }
        list.forEach(n => {
            const q = o.get(n);
            let L = q.x,
                Tp = q.y,
                R = q.x + q.w,
                B = q.y + q.h;
            if (d.includes('e'))
                R = sn(R + dx);
            if (d.includes('w'))
                L = sn(L + dx);
            if (d.includes('s'))
                B = sn(B + dy);
            if (d.includes('n'))
                Tp = sn(Tp + dy);
            if (R - L < 8) {
                d.includes('w') ? L = R - 8 : R = L + 8;
            }
            if (B - Tp < 8) {
                d.includes('n') ? Tp = B - 8 : B = Tp + 8;
            }
            if (/[ew]/.test(d)) {
                n.x = L;
                n.w = R - L;
            }
            if (/[ns]/.test(d)) {
                n.y = Tp;
                n.h = B - Tp;
            }
        });
        drawForm();
        drawOv();
        syncGeom();
    }, () => {
        if (!did && def) {
            prim.w = def.w;
            prim.h = def.h;
        }
        render(1);
    });
}
