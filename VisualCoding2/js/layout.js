/* ---------- IDE-style windows ----------
   Every panel (Toolbox, UI tree, Properties, Code, Preview, Debugger) can float (move + resize on all 8 edges) or dock to
   any side of the editor. A docked side ("zone": left / right / top / bottom) holds any number of LANES next to each other,
   and every lane stacks any number of panels. There is no maximum size for a docked lane or panel.
   Panels are never re-parented (an iframe would reload and lose the running app / debugger state): they are absolutely
   positioned from the layout state below. State is remembered in localStorage. */
(function () {
    // m = the <main> grid holding all panels, key = localStorage key of the layout, Z = zones (l = left, r = right, t = top, b = bottom),
    // V(z) = true for the vertical zones (left/right), EDGE = distance in px from the editor edge that counts as "at the edge" while dragging,
    // NEAR = distance in px from an edge of the designer or of a docked window within which dropping docks the dragged panel (further inside it stays floating),
    // MINC = smallest width/height that is always kept for the editor itself.
    const m = $('main'),
        key = 'fb-layout3',
        Z = ['l', 'r', 't', 'b'],
        V = z => z === 'l' || z === 'r',
        EDGE = 28,
        NEAR = 40,
        MINC = 60;
    // PN = panel elements by name (data-p attribute), all = their names in document order.
    const PN = {},
        all = [];
    document.querySelectorAll('.pn[data-p]').forEach(p => {
        PN[p.dataset.p] = p;
        all.push(p.dataset.p);
    });
    const WIN = { code: 1, pv: 1, dbg: 1 }; /* closable windows */
    // Default dock size per panel (w for left/right lanes, h for top/bottom lanes).
    const DEF = {
        tools: { w: 150, h: 150 },
        designer: { w: 760, h: 560 },
        tree: { w: 290, h: 220 },
        props: { w: 290, h: 220 },
        code: { w: 600, h: 340 },
        pv: { w: 520, h: 340 },
        dbg: { w: 760, h: 320 }
    };
    const FL0 = { code: [660, 520], pv: [520, 560], dbg: [940, 620] }; /* default floating size when first opened */
    // Layout state S: z = lanes per zone ({sz: size in px, p: names of the panels stacked in the lane}), wt = relative size of a panel within its lane,
    // fl = floating panels ({x, y, w, h}), pf = remembered dock size per panel, zo = stacking order of floating panels (last = in front).
    let S = {
        z: { l: [{ sz: 150, p: ['tools'] }], r: [{ sz: 620, p: ['tree', 'props', 'code', 'pv', 'dbg'] }], t: [], b: [] },
        wt: { tree: 170, props: 190, code: 300, pv: 260, dbg: 360 },
        fl: {},
        pf: {},
        zo: [],
        center: true
    };
    /* ----- state: load, migrate the old single-stack layout, sanitise ----- */
    try {
        const o = JSON.parse(localStorage.getItem(key));
        if (o && o.z)
            S = o;
        else {
            const q = JSON.parse(localStorage.getItem('fb-layout2'));
            if (q && q.ord && q.sz) {
                S.z = {};
                Z.forEach(z => S.z[z] = (q.ord[z] || []).length ? [{ sz: q.sz[z] || 200, p: q.ord[z].slice() }] : []);
                S.wt = q.wt || S.wt;
                S.fl = q.fl || {};
            }
        }
    }
    catch (e) { }
    // Sanitise the state (it may come from an old or damaged storage entry): fix missing parts, drop unknown, duplicate or invalid entries.
    S.fl = S.fl || {};
    S.wt = S.wt || {};
    S.pf = S.pf || {};
    S.zo = Array.isArray(S.zo) ? S.zo : [];
    S.open = S.open || {};
    window.layoutReopenCode = !!S.open.code; /* main.js reopens the code window after the project is loaded */
    S.z = S.z || {};
    S.center = S.center !== false;
    // seen = panels that are already placed in a lane.
    const seen = new Set();
    Z.forEach(z => {
        S.z[z] = (Array.isArray(S.z[z]) ? S.z[z] : []).map(L => ({
            sz: +L.sz > 0 ? +L.sz : 200,
            p: (L.p || []).filter(id => PN[id] && !S.fl[id] && !seen.has(id) && seen.add(id))
        })).filter(L => L.p.length);
    });
    Object.keys(S.fl).forEach(id => {
        const f = S.fl[id];
        if (!PN[id] || seen.has(id) || !f || ![f.x, f.y, f.w, f.h].every(isFinite))
            delete S.fl[id];
    });
    S.zo = S.zo.filter(id => S.fl[id]);
    // Panels that are not placed anywhere (e.g. after a layout migration) are docked: the toolbox left, everything else right.
    // The designer has its own central docking position.
    all.forEach(id => {
        if (id !== 'designer' && !seen.has(id) && !S.fl[id]) {
            const z = id === 'tools' ? 'l' : 'r';
            if (S.z[z].length)
                S.z[z][0].p.push(id);
            else
                S.z[z].push({ sz: DEF[id].w, p: [id] });
        }
    });
    /**
     * Stores the layout in localStorage (best effort).
     */
    const save = () => {
        try {
            localStorage.setItem(key, JSON.stringify(S));
        }
        catch (x) { }
    };
    /**
     * True if the panel is visible (not a closed window).
     */
    const vis = id => !PN[id].hidden;
    /**
     * Remembered dock size of a panel, created from the defaults on first use.
     */
    const pf = id => S.pf[id] || (S.pf[id] = { ...DEF[id] });
    /**
     * Where a panel is: 'f' (floating), a zone letter, or null (not placed, e.g. a closed window).
     */
    const placed = id => id === 'designer' && S.center ? 'c' : S.fl[id] ? 'f' : Z.find(z => S.z[z].some(L => L.p.includes(id))) || null;
    /**
     * The lane that contains the panel, or null.
     */
    const laneOf = id => {
        for (const z of Z)
            for (const L of S.z[z])
                if (L.p.includes(id))
                    return L;
        return null;
    };
    /**
     * Average relative size of the other visible panels in lane L; the starting size for a panel that joins the lane.
     */
    const avgW = (L, id) => {
        const o = L.p.filter(x => x !== id && vis(x)).map(x => S.wt[x] || 1);
        return o.length ? o.reduce((a, b) => a + b, 0) / o.length : 1;
    };
    const out = (id, r, x, y) => ({
        x,
        y,
        w: Math.max(r.width, WIN[id] ? 420 : 200),
        h: Math.min(Math.max(r.height, WIN[id] ? 280 : 120), innerHeight - 120)
    }); /* floating rect for a panel leaving its dock */
    /**
     * Keeps a floating panel inside the browser window (minimum size 200x120, part of the title bar always reachable).
     */
    const clampF = f => {
        f.w = Math.max(200, Math.min(f.w, innerWidth));
        f.h = Math.max(120, Math.min(f.h, innerHeight));
        f.x = Math.max(-(f.w - 80), Math.min(f.x, innerWidth - 80));
        f.y = Math.max(0, Math.min(f.y, innerHeight - 40));
    };
    /* ----- layout: state -> rectangles (relative to <main>) ----- */
    // Computed layout: R = rectangle of every docked panel (relative to <main>), LN = lanes with their rectangles,
    // K = scale factors used when the window is too small for the lanes, ZG = total size of each zone.
    let R = {},
        LN = [],
        K = { x: 1, y: 1 },
        ZG = { l: 0, r: 0, t: 0, b: 0 };
    /**
     * Positions all visible floating panels in their stacking order.
     */
    function placeF() {
        for (const id of all) {
            const f = S.fl[id];
            if (!f || !vis(id))
                continue;
            clampF(f);
            const p = PN[id],
                s = p.style;
            p.classList.add('fl');
            s.left = f.x + 'px';
            s.top = f.y + 'px';
            s.width = f.w + 'px';
            s.height = f.h + 'px';
            s.zIndex = 20 + Math.max(0, S.zo.indexOf(id));
        }
    }
    /**
     * Computes the layout (state -> rectangles) and applies it: zone sizes become the grid tracks of <main>,
     * lanes are split into panel rectangles, docked panels are positioned absolutely; then floating panels and resize handles are updated.
     */
    function layout() {
        const W = m.clientWidth,
            H = m.clientHeight;
        LN = [];
        R = {};
        // tot = summed lane size per zone (only lanes that contain a visible panel).
        const tot = {};
        for (const z of Z) {
            tot[z] = 0;
            for (const L of S.z[z])
                if (L.p.some(vis))
                    tot[z] += L.sz;
        }
        /* window got smaller than the lanes need: squeeze them proportionally (the stored sizes stay) so nothing ever overflows */
        const kx = tot.l + tot.r > Math.max(0, W - MINC) ? Math.max(0, W - MINC) / (tot.l + tot.r) : 1,
            ky = tot.t + tot.b > Math.max(0, H - MINC) ? Math.max(0, H - MINC) / (tot.t + tot.b) : 1;
        K = { x: kx, y: ky };
        // Zone sizes in px after scaling; hm = height left for the left/right zones between the top and bottom zones.
        const zl = Math.round(tot.l * kx),
            zr = Math.round(tot.r * kx),
            zt = Math.round(tot.t * ky),
            zb = Math.round(tot.b * ky),
            hm = Math.max(0, H - zt - zb);
        ZG = { l: zl, r: zr, t: zt, b: zb };
        if (S.center && !S.fl.designer) {
            const p = PN.designer, r = { x: zl, y: zt, w: Math.max(0, W - zl - zr), h: Math.max(0, H - zt - zb) };
            R.designer = { ...r, z: 'c', L: null };
            Object.assign(p.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
            p.classList.remove('fl');
        }
        m.style.gridTemplateColumns = zl + 'px minmax(0,1fr) ' + zr + 'px';
        m.style.gridTemplateRows = zt + 'px minmax(0,1fr) ' + zb + 'px';
        // Splits a lane into its panels' rectangles according to their relative sizes (S.wt).
        const lane = (z, L, x, y, w, h) => {
            const ids = L.p.filter(vis),
                v = V(z),
                len = v ? h : w,
                tw = ids.reduce((s, id) => s + (S.wt[id] || 1), 0) || 1;
            let acc = 0,
                e0 = 0;
            LN.push({ z, L, ids, x, y, w, h });
            ids.forEach((id, i) => {
                acc += S.wt[id] || 1;
                const e1 = i === ids.length - 1 ? len : Math.round(len * acc / tw),
                    r = v ? { x, y: y + e0, w, h: e1 - e0 } : { x: x + e0, y, w: e1 - e0, h };
                r.z = z;
                r.L = L;
                R[id] = r;
                e0 = e1;
            });
        };
        // Positions of the lanes along a zone: [lane, start, size] for every lane with a visible panel.
        const seg = (z, k, off) => {
            let c = 0;
            const o = [];
            for (const L of S.z[z]) {
                if (!L.p.some(vis))
                    continue;
                const a = Math.round(off + c);
                c += L.sz * k;
                o.push([L, a, Math.round(off + c) - a]);
            }
            return o;
        };
        // Left/right zones span the height between top and bottom zones, top/bottom zones span the full width.
        seg('l', kx, 0).forEach(([L, a, w]) => lane('l', L, a, zt, w, hm));
        seg('r', kx, W - zr).forEach(([L, a, w]) => lane('r', L, a, zt, w, hm));
        seg('t', ky, 0).forEach(([L, a, h]) => lane('t', L, 0, a, W, h));
        seg('b', ky, H - zb).forEach(([L, a, h]) => lane('b', L, 0, a, W, h));
        // Apply the rectangles to the docked panels (floating ones are positioned by placeF()).
        for (const id in R) {
            const p = PN[id],
                r = R[id],
                s = p.style;
            if (S.fl[id])
                continue;
            p.classList.remove('fl');
            s.zIndex = '';
            s.left = r.x + 'px';
            s.top = r.y + 'px';
            s.width = r.w + 'px';
            s.height = r.h + 'px';
        }
        placeF();
        handles();
    }
    /* ----- drag helper: keeps iframes from swallowing the pointer, shows the right cursor ----- */
    const dr = (e, cur, mv, up) => {
        const d = document.documentElement;
        d.classList.add('dnd');
        d.style.setProperty('--dc', cur);
        drag(e, mv, ev => {
            d.classList.remove('dnd');
            if (up)
                up(ev);
        });
    };
    /* ----- resize handles between lanes / between stacked panels ----- */
    const dh = document.createElement('div');
    dh.id = 'dh';
    m.append(dh);
    /**
     * Rebuilds the invisible resize handles: one at the inner edge of every lane and one between stacked panels.
     */
    function handles() {
        // mk creates a handle element with CSS position/size st and the pointerdown handler fn.
        const out = [],
            mk = (cls, st, fn) => {
                const e = document.createElement('div');
                e.className = 'hd ' + cls;
                Object.assign(e.style, st);
                e.addEventListener('pointerdown', fn);
                out.push(e);
            };
        for (const a of LN) {
            const { z, x, y, w, h } = a,
                v = V(z);
            /* the lane's inner edge: resizes the whole lane (no maximum) */
            mk(
                v ? 'hv' : 'hh',
                v
                    ? { left: (z === 'l' ? x + w : x) - 3 + 'px', top: y + 'px', height: h + 'px' }
                    : { top: (z === 't' ? y + h : y) - 3 + 'px', left: x + 'px', width: w + 'px' },
                e => laneDrag(e, a)
            );
            /* separators between panels stacked inside the lane */
            for (let i = 1; i < a.ids.length; i++) {
                const A = R[a.ids[i - 1]],
                    B = R[a.ids[i]];
                mk(
                    v ? 'hh' : 'hv',
                    v
                        ? { left: A.x + 'px', width: A.w + 'px', top: B.y - 3 + 'px' }
                        : { top: A.y + 'px', height: A.h + 'px', left: B.x - 3 + 'px' },
                    e => stackDrag(e, a, i)
                );
            }
        }
        dh.replaceChildren(...out);
    }
    /**
     * Drag on a lane's inner edge: resizes the whole lane. The other lanes of the same orientation
     * shrink to make room (down to a minimum) and grow back when dragged back.
     */
    function laneDrag(e, a) {
        if (e.button)
            return;
        e.preventDefault();
        LN.forEach(b => b.L.sz *= K[V(b.z) ? 'x' : 'y']); /* make a squeezed layout concrete before resizing */
        // Start state of the drag: z = zone, L = lane, mn = minimum lane size, s0 = start size, c0 = start pointer position,
        // sg = direction of growth, oth = the other lanes of that orientation (start size and smallest size fl),
        // flo = their summed minimum, ex = how much they can give up, avail = space available for all lanes, mx = largest size of this lane.
        const z = a.z,
            v = V(z),
            L = a.L,
            mn = v ? 60 : 48,
            s0 = L.sz,
            c0 = v ? e.clientX : e.clientY,
            sg = z === 'l' || z === 't' ? 1 : -1,
            oth = LN.filter(b => b !== a && V(b.z) === v).map(b => ({ L: b.L, base: b.L.sz, fl: Math.min(b.L.sz, mn) })),
            flo = oth.reduce((s, o) => s + o.fl, 0),
            ex = oth.reduce((s, o) => s + o.base - o.fl, 0),
            avail = (v ? m.clientWidth : m.clientHeight) - MINC,
            mx = Math.max(mn, avail - flo);
        /* No maximum: the lane may take everything except a sliver of the editor; the other lanes make room by shrinking (and grow back when you drag back) */
        dr(e, v ? 'col-resize' : 'row-resize', ev => {
            const d = Math.max(mn, Math.min(mx, s0 + sg * ((v ? ev.clientX : ev.clientY) - c0)));
            L.sz = d;
            const f = ex > 0 ? Math.max(0, Math.min(1, (avail - d - flo) / ex)) : 1;
            oth.forEach(o => o.L.sz = o.fl + (o.base - o.fl) * f);
            layout();
        }, () => {
            LN.forEach(b => b.L.p.forEach(id => pf(id)[V(b.z) ? 'w' : 'h'] = b.L.sz));
            save();
        });
    }
    /**
     * Drag on the separator between the stacked panels i-1 and i of lane a: moves size from one to the other (each keeps at least 48 px).
     */
    function stackDrag(e, a, i) {
        if (e.button)
            return;
        e.preventDefault();
        const v = V(a.z),
            A = a.ids[i - 1],
            B = a.ids[i],
            sz = id => v ? R[id].h : R[id].w,
            sa = sz(A),
            sb = sz(B),
            c0 = v ? e.clientY : e.clientX;
        a.ids.forEach(id => S.wt[id] = sz(id));
        dr(e, v ? 'row-resize' : 'col-resize', ev => {
            const d = Math.max(48 - sa, Math.min(sb - 48, (v ? ev.clientY : ev.clientX) - c0));
            S.wt[A] = sa + d;
            S.wt[B] = sb - d;
            layout();
        }, save);
    }
    /* ----- structure changes ----- */
    /**
     * Remembers the panel's current docked size, so it comes back at that size when docked again.
     */
    const remember = id => {
        const r = R[id];
        if (r && r.z !== 'c')
            pf(id)[V(r.z) ? 'w' : 'h'] = V(r.z) ? r.w : r.h;
    };
    /**
     * Removes a panel from the floating list and from every lane (lanes left empty disappear).
     */
    const detach = id => {
        if (id === 'designer') S.center = false;
        delete S.fl[id];
        S.zo = S.zo.filter(x => x !== id);
        Z.forEach(z => {
            S.z[z].forEach(L => L.p = L.p.filter(x => x !== id));
            S.z[z] = S.z[z].filter(L => L.p.length);
        });
    };
    /**
     * Brings a floating panel to the front.
     */
    const front = id => {
        if (!S.fl[id] || S.zo[S.zo.length - 1] === id)
            return;
        S.zo = S.zo.filter(x => x !== id);
        S.zo.push(id);
        placeF();
    };
    /**
     * Turns a docked panel into a floating one with rectangle r.
     */
    const undock = (id, r) => {
        remember(id);
        detach(id);
        S.fl[id] = r;
        S.zo.push(id);
        layout();
        save();
    };
    /**
     * Creates a new lane in zone z, at index `at` (default: the outermost position), containing the panel,
     * with the panel's remembered size.
     */
    const newLane = (z, id, at) => {
        const v = V(z);
        S.z[z].splice(
            at == null ? (z === 'l' || z === 't' ? 0 : S.z[z].length) : at,
            0,
            { sz: Math.max(v ? 80 : 60, pf(id)[v ? 'w' : 'h']), p: [id] }
        );
    };
    /**
     * Docks a floating panel at drop target t (see hit()): stacked into an existing lane (t.k === 's') or as a new lane.
     */
    function dock(id, t) {
        delete S.fl[id];
        S.zo = S.zo.filter(x => x !== id);
        if (t.k === 'c' && id === 'designer') {
            detach(id);
            S.center = true;
        }
        else if (t.k === 's') {
            const l = t.L.p;
            l.splice(l.indexOf(t.ref) + (t.after ? 1 : 0), 0, id);
            S.wt[id] = avgW(t.L, id);
        }
        else
            newLane(t.z, id, t.at);
        layout();
        save();
    }
    /* ----- drop targets while dragging a window ----- */
    // pvw = preview rectangle that shows where the dragged panel would land.
    const pvw = document.createElement('div');
    pvw.id = 'dzp';
    pvw.hidden = true;
    document.body.append(pvw);
    /**
     * Finds the drop target under screen position (x, y) while panel id is dragged.
     * Returns {k: 'l' (new lane) | 's' (stack into a lane), z, at / ref / after, r: preview rectangle in viewport coordinates} or null.
     */
    function hit(id, x, y) {
        const mr = m.getBoundingClientRect();
        if (x < mr.left || x > mr.right || y < mr.top || y > mr.bottom)
            return null;
        const px = x - mr.left,
            py = y - mr.top,
            W = mr.width,
            H = mr.height,
            vp = r => ({ l: mr.left + r.x, t: mr.top + r.y, w: r.w, h: r.h });
        if (id === 'designer' && !S.center && px >= ZG.l && px <= W - ZG.r && py >= ZG.t && py <= H - ZG.b)
            return { k: 'c', r: vp({ x: ZG.l, y: ZG.t, w: W - ZG.l - ZG.r, h: H - ZG.t - ZG.b }) };
        let q = null;
        for (const k in R) {
            const r = R[k];
            if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
                q = k;
                break;
            }
        }
        // ed = the nearest editor edge, if the pointer is within EDGE px of it.
        const ed = [[px, 'l'], [W - px, 'r'], [py, 't'], [H - py, 'b']].filter(a => a[0] < EDGE).sort((a, b) => a[0] - b[0])[0];
        /* at the very edge of the editor: a new lane on the outside of that side */
        if (ed && !(q && R[q].z === ed[1])) {
            const z = ed[1],
                v = V(z),
                s = Math.max(60, Math.min(pf(id)[v ? 'w' : 'h'], (v ? W : H) / 2)),
                mid = Math.max(0, H - ZG.t - ZG.b),
                r = z === 'l'
                    ? { x: 0, y: ZG.t, w: s, h: mid }
                    : z === 'r'
                    ? { x: W - s, y: ZG.t, w: s, h: mid }
                    : z === 't'
                    ? { x: 0, y: 0, w: W, h: s }
                    : { x: 0, y: H - s, w: W, h: s };
            return { k: 'l', z, at: z === 'l' || z === 't' ? 0 : S.z[z].length, r: vp(r) };
        }
        if (!q)
            return null;
        /* over the designer: the nearest designer edge decides the side; the new lane goes right next to the designer (innermost position) */
        if (q === 'designer') {
            const d = R.designer,
                nd = [[px - d.x, 'l'], [d.x + d.w - px, 'r'], [py - d.y, 't'], [d.y + d.h - py, 'b']].sort((a, b) => a[0] - b[0])[0];
            // Only close to a designer edge: further inside the panel stays floating.
            if (nd[0] >= NEAR)
                return null;
            const z = nd[1],
                v = V(z),
                s = Math.max(60, Math.min(pf(id)[v ? 'w' : 'h'], (v ? d.w : d.h) / 2));
            return {
                k: 'l',
                z,
                at: z === 'l' || z === 't' ? S.z[z].length : 0,
                r: vp(z === 'l'
                    ? { x: d.x, y: d.y, w: s, h: d.h }
                    : z === 'r'
                    ? { x: d.x + d.w - s, y: d.y, w: s, h: d.h }
                    : z === 't'
                    ? { x: d.x, y: d.y, w: d.w, h: s }
                    : { x: d.x, y: d.y + d.h - s, w: d.w, h: s })
            };
        }
        /* over a docked window: its nearest edge decides between "stack with it" and "new lane beside it" */
        const r = R[q],
            nr = [[px - r.x, 'l'], [r.x + r.w - px, 'r'], [py - r.y, 't'], [r.y + r.h - py, 'b']].sort((a, b) => a[0] - b[0])[0];
        // Only close to an edge of the docked window: further inside the panel stays floating.
        if (nr[0] >= NEAR)
            return null;
        const z = r.z,
            v = V(z),
            L = r.L,
            dn = nr[1],
            after = dn === 'r' || dn === 'b',
            stack = v ? (dn === 't' || dn === 'b') : (dn === 'l' || dn === 'r');
        if (stack)
            return {
                k: 's',
                z,
                L,
                ref: q,
                after,
                r: vp(v ? { x: r.x, y: after ? r.y + r.h / 2 : r.y, w: r.w, h: r.h / 2 } : { x: after ? r.x + r.w / 2 : r.x, y: r.y, w: r.w / 2, h: r.h })
            };
        const a = LN.find(b => b.L === L),
            at = S.z[z].indexOf(L) + (after ? 1 : 0),
            s = Math.max(60, Math.min(pf(id)[v ? 'w' : 'h'], v ? a.w : a.h));
        return {
            k: 'l',
            z,
            at,
            r: vp(v ? { x: after ? a.x + a.w - s : a.x, y: a.y, w: s, h: a.h } : { x: a.x, y: after ? a.y + a.h - s : a.y, w: a.w, h: s })
        };
    }
    /**
     * Drags a panel by its title bar: after a few pixels it becomes floating and follows the pointer,
     * the drop target preview is shown, and on release the panel docks there (or stays floating).
     */
    function startDrag(id, e) {
        const x0 = e.clientX,
            y0 = e.clientY;
        let on = false,
            t = null,
            gx = 0,
            gy = 0;
        front(id);
        dr(e, 'grabbing', ev => {
            if (!on) {
                if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5)
                    return;
                on = true;
                const r = PN[id].getBoundingClientRect();
                if (S.fl[id]) {
                    gx = x0 - S.fl[id].x;
                    gy = y0 - S.fl[id].y;
                }
                else {
                    gx = Math.min(x0 - r.left, 160);
                    gy = Math.min(y0 - r.top, 14);
                    undock(id, out(id, r, x0 - gx, y0 - gy));
                }
                PN[id].classList.add('dg');
            }
            const f = S.fl[id];
            f.x = ev.clientX - gx;
            f.y = ev.clientY - gy;
            placeF();
            t = hit(id, ev.clientX, ev.clientY);
            pvw.hidden = !t;
            if (t) {
                const s = pvw.style;
                s.left = t.r.l + 'px';
                s.top = t.r.t + 'px';
                s.width = t.r.w + 'px';
                s.height = t.r.h + 'px';
            }
        }, () => {
            pvw.hidden = true;
            PN[id].classList.remove('dg');
            if (!on)
                return;
            if (t)
                dock(id, t);
            else
                save();
        });
    }
    /**
     * Resizes a floating panel by dragging handle d (n, ne, e, se, s, sw, w, nw); minimum size 200x120.
     */
    function startResize(id, d, e) {
        const f = S.fl[id];
        if (!f || e.button)
            return;
        e.preventDefault();
        e.stopPropagation();
        front(id);
        const o = { ...f },
            x0 = e.clientX,
            y0 = e.clientY,
            cur = d === 'n' || d === 's'
                ? 'ns-resize'
                : d === 'e' || d === 'w'
                ? 'ew-resize'
                : d === 'nw' || d === 'se'
                ? 'nwse-resize'
                : 'nesw-resize';
        dr(e, cur, ev => {
            const dx = ev.clientX - x0,
                dy = ev.clientY - y0;
            if (d.includes('e'))
                f.w = Math.max(200, o.w + dx);
            if (d.includes('s'))
                f.h = Math.max(120, o.h + dy);
            if (d.includes('w')) {
                const w = Math.max(200, o.w - dx);
                f.x = o.x + o.w - w;
                f.w = w;
            }
            if (d.includes('n')) {
                const h = Math.max(120, o.h - dy);
                f.y = o.y + o.h - h;
                f.h = h;
            }
            placeF();
        }, () => {
            pf(id).w = f.w;
            pf(id).h = f.h;
            save();
        });
    }
    /* ----- opening / closing the windows (Code, Preview, Debugger) ----- */
    /**
     * Opens a closable window. The first time it floats in the middle of the screen (each one a little offset); a docked window stays docked.
     */
    function openWin(id) {
        const p = PN[id];
        p.hidden = false;
        S.open[id] = 1;
        if (!placed(id)) {
            const [w, h] = FL0[id],
                n = S.zo.length;
            S.fl[id] = {
                x: Math.round((innerWidth - w) / 2) + n * 22,
                y: Math.round((innerHeight - h) / 3) + n * 22,
                w: Math.min(w, innerWidth - 40),
                h: Math.min(h, innerHeight - 60)
            };
            S.zo.push(id);
        }
        else if (S.fl[id])
            front(id);
        else {
            const L = laneOf(id);
            if (L)
                S.wt[id] = avgW(L, id);
        }
        layout();
        save();
    }
    /**
     * Closes a window and fires its 'close' event.
     */
    function closeWin(id) {
        const p = PN[id];
        if (p.hidden)
            return;
        p.hidden = true;
        S.open[id] = 0;
        layout();
        save();
        p.dispatchEvent(new Event('close'));
    }
    /* the old <dialog> API keeps working: el.open / el.show() / el.showModal() / el.close() + the 'close' event */
    for (const id in WIN) {
        const p = PN[id];
        Object.defineProperty(p, 'open', { get: () => !p.hidden });
        p.show = p.showModal = () => openWin(id);
        p.close = () => closeWin(id);
    }
    /* ----- dock menu ----- */
    // dm = popup menu with the dock options, mid = panel the menu belongs to.
    const dm = document.createElement('div');
    dm.id = 'dm';
    dm.hidden = true;
    let mid = null;
    dm.innerHTML = [['c', 'Dock center'], ['l', 'Dock left'], ['r', 'Dock right'], ['t', 'Dock top'], ['b', 'Dock bottom'], ['f', 'Float']].map(([k, t]) => `<button data-k="${k}">${t}</button>`).join('');
    document.body.append(dm);
    // Menu choice: "Float", or dock the panel as a new lane at the chosen side.
    dm.addEventListener('click', e => {
        const k = e.target.dataset.k;
        if (!k || !mid)
            return;
        dm.hidden = true;
        if (k === 'c' && mid === 'designer') {
            if (S.fl[mid]) dock(mid, { k: 'c' });
            else if (!S.center) { remember(mid); detach(mid); S.center = true; layout(); save(); }
            return;
        }
        if (k === 'f') {
            if (!S.fl[mid]) {
                const r = PN[mid].getBoundingClientRect();
                undock(mid, out(mid, r, r.left + 24, r.top + 24));
            }
            return;
        }
        remember(mid);
        detach(mid);
        newLane(k, mid);
        layout();
        save();
    });
    // A click anywhere else closes the menu.
    addEventListener('pointerdown', e => {
        if (!dm.hidden && !e.target.closest('#dm,.dk'))
            dm.hidden = true;
    }, true);
    /* ----- wire every panel: title bar = drag handle, menu button, close button, 8 resize handles for the floating state ----- */
    for (const id of all) {
        const p = PN[id],
            h = p.querySelector('.sh'),
            b = document.createElement('button'),
            cl = h.querySelector('.cl');
        b.className = 'dk';
        b.type = 'button';
        b.textContent = '⋮';
        b.title = 'Dock options (or drag the title bar to move / dock)';
        b.setAttribute('aria-label', 'Dock options');
        cl ? h.insertBefore(b, cl) : h.append(b);
        b.addEventListener('click', () => {
            mid = id;
            const r = b.getBoundingClientRect();
            dm.style.left = Math.max(4, Math.min(r.left, innerWidth - 150)) + 'px';
            dm.style.top = r.bottom + 2 + 'px';
            dm.hidden = false;
        });
        if (cl)
            cl.addEventListener('click', () => closeWin(id));
        h.addEventListener('pointerdown', e => {
            if (e.button || e.target.closest('button,select,input,label,a'))
                return;
            e.preventDefault();
            startDrag(id, e);
        });
        for (const d of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
            const r = document.createElement('div');
            r.className = 'rh ' + d;
            r.addEventListener('pointerdown', e => startResize(id, d, e));
            p.append(r);
        }
        p.addEventListener('pointerdown', () => front(id), true);
    }
    // Re-layout whenever the editor area changes size, and once at start-up.
    for (const id in WIN)
        if (S.open[id] === 0)
            PN[id].hidden = true; /* windows closed in the last session stay closed (the default is open) */
    new ResizeObserver(layout).observe(m);
    layout();
    addEventListener('pagehide', save); /* flush the layout when the page is left */
})();
