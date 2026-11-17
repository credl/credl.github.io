/* ---------- IntelliSense for the code window (VB-style code) ----------
   Nothing is hard coded per form: the lists are built from the live model every time the popup opens.
   - after "name."   the members of that control: its properties and methods (by control type), for a component instance also its
                     declared properties and "Public Sub/Function" members, for Me / Form the form's own properties
   - after "Sub "    the event procedures that can be written (Button1_Click, Form_Load, ...)
   - after "As "     the data types; after "End " / "Exit " / "RaiseEvent " the matching words
   - otherwise       controls, the code's own Subs / Functions / variables / parameters, built-in functions and keywords
   While you type the arguments of a call - after "(", after "," or after "Name " - a small hint shows the signature with the current
   parameter in bold. Typing "." or two letters opens the popup, Ctrl+Space opens it anywhere. Up/Down choose, Enter or Tab accept, Esc closes. */
try {
(() => {
    const ta = $('#vb'),
        wrap = $('#vbw');
    // Nothing to do (and nothing to break) if the editor's elements are not there.
    if (!ta || !wrap)
        return;
    const sty = document.createElement('style');
    sty.id = 'acStyle';
    sty.textContent = `
/* IntelliSense popup in the code editor (js/intellisense.js) */
#ac{position:absolute;z-index:8;min-width:240px;max-width:460px;background:var(--pn);color:var(--ink);border:1px solid var(--ln);border-radius:4px;box-shadow:0 6px 20px #0004;font:12px/1.4 ui-monospace,Consolas,monospace}
#ac .al{max-height:212px;overflow-y:auto}
#ac .ai{display:flex;align-items:center;gap:6px;padding:1px 8px 1px 4px;cursor:pointer;white-space:nowrap}
#ac .ai.on{background:var(--acs)}
#ac .an{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}#ac .an b{font-weight:700}
#ac .ad{flex:none;color:var(--mut);font-size:11px;margin-left:14px;max-width:170px;overflow:hidden;text-overflow:ellipsis}
#ac .ak{flex:none;width:16px;height:16px;line-height:16px;text-align:center;font:700 10px/16px system-ui,sans-serif;font-style:normal;border-radius:3px;color:#fff;background:#677085}
#ac .ak.method,#ac .ak.function{background:#8a3ab9}#ac .ak.property{background:#0b6bcb}#ac .ak.local,#ac .ak.param{background:#12807c}
#ac .ak.control{background:#1f8a4c}#ac .ak.class{background:#c4690c}#ac .ak.event{background:#a87000}#ac .ak.keyword{background:#677085}
#sg{position:absolute;z-index:9;max-width:520px;background:var(--pn);color:var(--ink);border:1px solid var(--ln);border-radius:4px;box-shadow:0 4px 14px #0004;font:12px/1.4 ui-monospace,Consolas,monospace;padding:3px 8px;white-space:nowrap;pointer-events:none}
#sg b{color:var(--ac);font-weight:700;text-decoration:underline}#sg .sd{display:block;color:var(--mut);font-size:11px;overflow:hidden;text-overflow:ellipsis}
#ac .af{padding:3px 8px;border-top:1px solid var(--ln);color:var(--mut);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
    document.head.append(sty);
    console.info('IntelliSense loaded');
    /* ---------- completion data ---------- */
    const KIND = {
        method: ['ƒ', 'method'], property: ['◆', 'property'], local: ['v', 'variable'], param: ['v', 'parameter'], control: ['▣', 'control'],
        class: ['C', 'type'], event: ['⚡', 'event'], keyword: ['k', 'keyword'], function: ['ƒ', 'function']
    };
    const PN = { text: 'Text', value: 'Value', caption: 'Caption', checked: 'Checked', enabled: 'Enabled', visible: 'Visible', left: 'Left', top: 'Top',
            width: 'Width', height: 'Height', backcolor: 'BackColor', forecolor: 'ForeColor', fontsize: 'FontSize', listindex: 'ListIndex', tooltip: 'ToolTip',
            drawcolor: 'DrawColor', linewidth: 'LineWidth', mousex: 'MouseX', mousey: 'MouseY' },
        MN = { setfocus: 'SetFocus', clear: 'Clear', additem: 'AddItem', removeitem: 'RemoveItem', drawline: 'DrawLine', drawrect: 'DrawRect', fillrect: 'FillRect',
            drawcircle: 'DrawCircle', fillcircle: 'FillCircle', drawtext: 'DrawText', setpixel: 'SetPixel' },
        PD = { text: 'text of the control', value: 'value of the control', caption: 'caption / label text', checked: 'True when ticked', enabled: 'False greys the control out',
            visible: 'False hides the control', left: 'distance from the left edge', top: 'distance from the top edge', width: 'width in pixels', height: 'height in pixels',
            backcolor: 'background colour', forecolor: 'text colour', fontsize: 'font size in pixels', listindex: 'index of the selected item (0 = first)', tooltip: 'text shown on mouse hover',
            drawcolor: 'colour used by the Draw / Fill methods, e.g. "#d00"', linewidth: 'line width of the Draw methods', mousex: 'x of the last mouse / touch event (read-only)', mousey: 'y of the last mouse / touch event (read-only)' },
        MD = { setfocus: 'move the keyboard focus here', clear: 'empty the control', additem: 'AddItem "text"  appends an entry', removeitem: 'RemoveItem index  removes an entry',
        drawline: 'DrawLine x1, y1, x2, y2', drawrect: 'DrawRect x, y, w, h  outline', fillrect: 'FillRect x, y, w, h', drawcircle: 'DrawCircle x, y, r  outline',
        fillcircle: 'FillCircle x, y, r', drawtext: 'DrawText text, x, y', setpixel: 'SetPixel x, y' };
    const BUILTIN = ['Len', 'Left', 'Right', 'Mid', 'UCase', 'LCase', 'Trim', 'Val', 'Int', 'Fix', 'Abs', 'Sgn', 'Sqr', 'Rnd', 'Round', 'InStr', 'Replace', 'Space',
            'Str', 'CStr', 'CInt', 'CLng', 'CDbl', 'Chr', 'Asc', 'Now', 'Timer', 'MsgBox', 'StartTimer', 'StopTimer'],
        BDESC = { Len: 'Len(text)', Left: 'Left(text, n)', Right: 'Right(text, n)', Mid: 'Mid(text, start, [n])', UCase: 'UCase(text)', LCase: 'LCase(text)', Trim: 'Trim(text)',
            Val: 'Val(text)  text to number', Int: 'Int(x)', Fix: 'Fix(x)', Abs: 'Abs(x)', Sgn: 'Sgn(x)', Sqr: 'Sqr(x)', Rnd: 'Rnd()', Round: 'Round(x, [digits])',
            InStr: 'InStr(text, find)', Replace: 'Replace(text, find, with)', Space: 'Space(n)', Str: 'Str(x)', CStr: 'CStr(x)', CInt: 'CInt(x)', CLng: 'CLng(x)', CDbl: 'CDbl(x)',
            Chr: 'Chr(code)', Asc: 'Asc(text)', Now: 'Now()', Timer: 'Timer()', MsgBox: 'MsgBox(text)',
            StartTimer: 'StartTimer(milliseconds)  runs Sub Form_Timer repeatedly', StopTimer: 'StopTimer()  stops Form_Timer' };
    // Parameter names of the control methods, and of the built-ins (taken from their descriptions above).
    const MP = { setfocus: [], clear: [], additem: ['text'], removeitem: ['index'], drawline: ['x1', 'y1', 'x2', 'y2'], drawrect: ['x', 'y', 'width', 'height'],
        fillrect: ['x', 'y', 'width', 'height'], drawcircle: ['x', 'y', 'radius'], fillcircle: ['x', 'y', 'radius'], drawtext: ['text', 'x', 'y'], setpixel: ['x', 'y'] };
    const BP = {};
    BUILTIN.forEach(b => {
        const m = /^\w+\(([^)]*)\)/.exec(BDESC[b] || '');
        BP[b.toLowerCase()] = m ? m[1].split(',').map(x => x.trim()).filter(Boolean) : [];
    });
    const sigStr = it => it.params ? '(' + it.params.join(', ') + ')' : '';
    const KWS = 'Sub Function End If Then Else ElseIf For To Step Next While Wend Do Loop Until Select Case Dim As Const Public Private Exit Return RaiseEvent Event Set Call And Or Not Mod True False Is ByVal ByRef Optional Static'.split(' ');
    const TYPES = 'Integer Long Single Double Currency Byte String Boolean Variant'.split(' ');
    const CONSTS = ['vbCrLf', 'vbTab', 'vbOKOnly', 'vbInformation', 'vbExclamation', 'vbCritical', 'vbKeyLeft', 'vbKeyUp', 'vbKeyRight', 'vbKeyDown', 'vbKeySpace', 'vbKeyReturn', 'vbKeyEscape', 'vbKeyBack', 'vbKeyTab'];
    // Control types for which a member makes no sense are left out (everything else is offered).
    const ONLY = { checked: ['checkbox', 'radio'], listindex: ['select'], additem: ['select'], removeitem: ['select'], clear: ['textbox', 'textarea', 'select', 'canvas'],
        drawcolor: ['canvas'], linewidth: ['canvas'], mousex: ['canvas'], mousey: ['canvas'], drawline: ['canvas'], drawrect: ['canvas'], fillrect: ['canvas'],
        drawcircle: ['canvas'], fillcircle: ['canvas'], drawtext: ['canvas'], setpixel: ['canvas'] };
    const NOFOCUS = ['label', 'panel', 'groupbox', 'image', 'slot', 'form', 'canvas', 'html', 'page'];
    const kindOf = n => n.type === 'form' ? 'Form' : n.type === 'comp' ? (docOf(n.ref)?.root.name || 'Component') : T[n.type]?.l || n.type;
    const CAP = (n, l) => l.length ? l[0].toUpperCase() + l.slice(1) : n;
    // All controls of the active form: lowercase name -> node (the form itself is also reachable as Me / Form).
    function controls() {
        const m = new Map();
        walk(root, n => {
            if (n !== root && n.name)
                m.set(n.name.toLowerCase(), n);
        });
        return m;
    }
    // "Public Sub/Function Name", "Event Name" and the declared properties of a component document, in their original spelling.
    function iface(R) {
        const s = R.code || '',
            pubs = [...s.matchAll(/^\s*public\s+(sub|function)\s+(\w+)\s*(?:\(([^)]*)\))?/gim)].map(m => ({ name: m[2], fn: m[1].toLowerCase() === 'function', params: (m[3] || '').split(',').map(x => x.trim()).filter(Boolean) })),
            evs = [...s.matchAll(/^\s*(?:public\s+)?event\s+(\w+)/gim)].map(m => m[1]),
            props = (R.props || []).map(p => String(p[0] || '')).filter(Boolean);
        return { pubs, evs, props };
    }
    function membersOf(n) {
        const out = [],
            t = n.type,
            add = (name, kind, desc, group, params) => out.push({ name, kind, detail: params ? '(' + params.join(', ') + ')' : kind, desc, group, params });
        if (t === 'comp') {
            const C = docOf(n.ref);
            if (C) {
                const f = iface(C.root);
                f.props.forEach(p => add(p, 'property', 'property of ' + kindOf(n), 0));
                f.pubs.forEach(p => add(p.name, p.fn ? 'function' : 'method', 'Public ' + (p.fn ? 'Function' : 'Sub') + ' of ' + kindOf(n), 0, p.params));
            }
        }
        const gen = t === 'comp' ? ['left', 'top', 'width', 'height', 'visible', 'enabled', 'backcolor', 'forecolor', 'fontsize', 'tooltip']
            : t === 'form' ? ['caption', 'backcolor', 'forecolor', 'fontsize', 'width', 'height', 'left', 'top', 'visible', 'enabled', 'tooltip'] : null;
        PROPS.forEach(p => {
            if (gen ? !gen.includes(p) : ONLY[p] && !ONLY[p].includes(t))
                return;
            add(PN[p] || CAP(p, p), 'property', PD[p] || '', 1);
        });
        if (t === 'form') {
            iface(n).props.forEach(p => add(p, 'property', 'property of this component', 0));
            return out;
        }
        if (t !== 'comp')
            METH.forEach(m => {
                if ((ONLY[m] && !ONLY[m].includes(t)) || (m === 'setfocus' && NOFOCUS.includes(t)))
                    return;
                add(MN[m] || CAP(m, m), 'method', MD[m] || '', 2, MP[m] || []);
            });
        else
            add('SetFocus', 'method', MD.setfocus, 2, []);
        return out;
    }
    // Variables, parameters, Subs and Functions declared anywhere in the code (names are shown as typed).
    function declared(src) {
        const code = src.split('\n').map(l => {
                let q = false;
                for (let i = 0; i < l.length; i++) {
                    if (l[i] === '"')
                        q = !q;
                    else if (l[i] === "'" && !q)
                        return l.slice(0, i);
                }
                return l;
            }),
            vars = new Map(),
            subs = new Map(),
            put = (m, k, name, d) => !m.has(name.toLowerCase()) && m.set(name.toLowerCase(), { name, kind: k, detail: d, group: -1 });
        code.forEach(l => {
            let m = /^\s*(?:(?:public|private)\s+)?(sub|function)\s+(\w+)\s*(?:\(([^)]*)\))?/i.exec(l);
            if (m) {
                put(subs, m[1].toLowerCase() === 'function' ? 'function' : 'method', m[2], m[1].toLowerCase());
                subs.get(m[2].toLowerCase()).params = (m[3] || '').split(',').map(x => x.trim()).filter(Boolean);
                (m[3] || '').split(',').forEach(p => {
                    const q = /^\s*(?:optional\s+)?(?:byval\s+|byref\s+)?(\w+)/i.exec(p);
                    q && put(vars, 'param', q[1], 'parameter');
                });
                return;
            }
            m = /^\s*(?:(?:public|private)\s+)?(?:dim|static|const)\s+(.*)$/i.exec(l);
            if (m)
                m[1].split(',').forEach(p => {
                    const q = /^\s*(\w+)/.exec(p);
                    q && put(vars, 'local', q[1], 'variable');
                });
        });
        // a Function's own name is its return variable; For counters are variables too
        for (const l of code) {
            const m = /^\s*for\s+(?:each\s+)?(\w+)\s*=/i.exec(l);
            m && put(vars, 'local', m[1], 'variable');
        }
        return { vars, subs };
    }
    /**
     * The items to offer for plain words (no dot in front).
     */
    function wordItems(src) {
        const out = [],
            seen = new Set(),
            add = it => {
                const k = it.name.toLowerCase();
                if (!seen.has(k)) {
                    seen.add(k);
                    out.push(it);
                }
            },
            ctl = controls(),
            d = declared(src);
        d.vars.forEach(v => add(Object.assign(v, { desc: v.detail })));
        ctl.forEach(n => add({ name: n.name, kind: 'control', detail: kindOf(n), desc: 'control: ' + kindOf(n), group: -2 }));
        add({ name: 'Me', kind: 'control', detail: 'this form', desc: 'the form / component this code belongs to', group: -2 });
        add({ name: 'Form', kind: 'control', detail: 'this form', desc: 'the form / component this code belongs to', group: -2 });
        iface(root).props.forEach(p => add({ name: p, kind: 'property', detail: 'component property', desc: 'property of this component', group: -2 }));
        d.subs.forEach(s => add(Object.assign(s, { desc: 'Sub / Function in this code', detail: sigStr(s) })));
        BUILTIN.forEach(b => add({ name: b, kind: 'function', detail: sigStr({ params: BP[b.toLowerCase()] }), params: BP[b.toLowerCase()], desc: BDESC[b] || b, group: 1 }));
        CONSTS.forEach(c => add({ name: c, kind: 'property', ro: true, detail: 'constant', desc: 'constant', group: 1 }));
        KWS.forEach(k => add({ name: k, kind: 'keyword', detail: '', desc: 'keyword', group: 2 }));
        return out;
    }
    /**
     * Finds out what to offer at the caret. Returns {start, items, member} or null: `start` = index where the replaced word starts.
     */
    function compute(force) {
        const src = ta.value,
            pos = ta.selectionStart,
            ls = src.lastIndexOf('\n', pos - 1) + 1,
            line = src.slice(ls, pos);
        // inside a string or a comment: nothing
        let q = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"')
                q = !q;
            else if (line[i] === "'" && !q)
                return null;
        }
        if (q || /^\s*rem\b/i.test(line))
            return null;
        const prefix = /\w*$/.exec(line)[0],
            start = pos - prefix.length,
            before = line.slice(0, line.length - prefix.length);
        if (/^\d/.test(prefix))
            return null;
        // member of a control: name.|
        const mm = /(^|[^\w.])([A-Za-z_]\w*)\s*\.$/.exec(before);
        if (/\.$/.test(before)) {
            if (!mm)
                return null;
            const nm = mm[2].toLowerCase();
            let n = controls().get(nm);
            if (!n && (nm === 'me' || nm === 'form' || nm === (root.name || '').toLowerCase()))
                n = root;
            if (!n)
                return null;
            return { start, items: membersOf(n), member: true };
        }
        // special places
        const lc = before.toLowerCase();
        if (/\bas\s+$/.test(lc))
            return { start, member: false, items: TYPES.map(t => ({ name: t, kind: 'class', detail: 'type', desc: 'data type', group: 0 })) };
        if (/\bend\s+$/.test(lc))
            return { start, member: false, items: ['Sub', 'Function', 'If', 'Select'].map(t => ({ name: t, kind: 'keyword', detail: '', desc: 'End ' + t, group: 0 })) };
        if (/\bexit\s+$/.test(lc))
            return { start, member: false, items: ['Sub', 'Function', 'For', 'Do', 'While'].map(t => ({ name: t, kind: 'keyword', detail: '', desc: 'Exit ' + t, group: 0 })) };
        if (/\braiseevent\s+$/.test(lc))
            return { start, member: false, items: iface(root).evs.map(e => ({ name: e, kind: 'event', detail: 'event', desc: 'event declared in this component', group: 0 })) };
        if (/^\s*(?:(?:public|private)\s+)?(?:sub|function)\s+$/.test(lc)) {
            const items = [],
                seen = new Set();
            // event procedures: Button1_Click, Form_Load, ...
            walk(root, n => {
                (n.name || n.type === 'form') && evList(n).forEach(ev => {
                    const nm = (n.type === 'form' ? 'Form' : n.name) + '_' + ev;
                    if (!seen.has(nm.toLowerCase())) {
                        seen.add(nm.toLowerCase());
                        items.push({ name: nm, kind: 'event', detail: 'event procedure', desc: 'event procedure for ' + (n.type === 'form' ? 'the form' : n.name), group: 0 });
                    }
                });
            });
            return { start, items, member: false };
        }
        // declaring a new name (Dim x, Const y, parameters): nothing to complete
        if (/^\s*(?:(?:public|private|static)\s+)*(?:dim|const|static|event)\s+(?:[\w\s]*,\s*)*$/.test(lc) || /^\s*(?:(?:public|private)\s+)?(?:sub|function)\s+\w+\s*\([^)]*$/.test(lc) && !/\bas\s+$/.test(lc))
            return null;
        if (!force && prefix.length < 2)
            return null;
        return { start, items: wordItems(src), member: false };
    }
    /* ---------- ranking ---------- */
    function rank(name, p) {
        if (!p)
            return 0;
        const n = name.toLowerCase();
        if (n.startsWith(p))
            return name.startsWith(p) ? 0 : 1;
        if (n.includes(p))
            return 3;
        const hump = name.replace(/[a-z0-9_]/g, '').toLowerCase();
        return hump.startsWith(p) ? 4 : -1;
    }
    function filter(items, word) {
        const p = word.toLowerCase(),
            r = [];
        for (const it of items) {
            const k = rank(it.name, p);
            if (k >= 0)
                r.push([k, it]);
        }
        r.sort((a, b) => a[0] - b[0] || a[1].group - b[1].group || a[1].name.toLowerCase().localeCompare(b[1].name.toLowerCase()));
        return r.map(x => x[1]).slice(0, 300);
    }
    /* ---------- popup ---------- */
    const box = document.createElement('div'),
        list = document.createElement('div'),
        foot = document.createElement('div');
    box.id = 'ac';
    box.hidden = true;
    list.className = 'al';
    foot.className = 'af';
    box.append(list, foot);
    wrap.append(box);
    // st = {start, all, shown, sel, member} while the popup is open
    let st = null,
        accepting = false;
    function close() {
        st = null;
        box.hidden = true;
    }
    function describe(it) {
        const t = (KIND[it.kind] || ['', it.kind])[1];
        return (it.params ? it.name + sigStr(it) + '  ' : '') + (it.desc && it.desc !== t ? t + '  —  ' + it.desc : t);
    }
    function paint() {
        const p = st.word.toLowerCase();
        list.innerHTML = st.shown.map((it, i) => {
            const k = KIND[it.kind] || ['•', ''],
                n = esc(it.name),
                m = p && it.name.toLowerCase().startsWith(p) ? `<b>${esc(it.name.slice(0, p.length))}</b>${esc(it.name.slice(p.length))}` : n;
            return `<div class="ai${i === st.sel ? ' on' : ''}" data-i="${i}"><i class="ak ${it.kind}">${k[0]}</i><span class="an">${m}</span><span class="ad">${esc(it.detail || '')}</span></div>`;
        }).join('');
        foot.textContent = describe(st.shown[st.sel]);
        const on = list.querySelector('.on');
        on && on.scrollIntoView({ block: 'nearest' });
    }
    // Pixel position (inside #vbw) of the character at index `at`, and the line height.
    function caretXY(at) {
        const cs = getComputedStyle(ta),
            c = caretXY.c || (caretXY.c = document.createElement('canvas').getContext('2d'));
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const cw = c.measureText('0').width,
            lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5,
            tab = parseInt(cs.tabSize) || 4,
            lines = ta.value.slice(0, at).split('\n'),
            last = lines[lines.length - 1];
        let col = 0;
        for (const ch of last)
            col = ch === '\t' ? (Math.floor(col / tab) + 1) * tab : col + 1;
        return {
            lh,
            x: ta.offsetLeft + parseFloat(cs.paddingLeft) + col * cw - ta.scrollLeft,
            y: ta.offsetTop + parseFloat(cs.paddingTop) + (lines.length - 1) * lh - ta.scrollTop
        };
    }
    // Puts `el` next to the character at `at`: below the line, or above it when there is no room (`above` prefers above).
    function placeEl(el, at, above) {
        const { x, y, lh } = caretXY(at);
        el.hidden = false;
        const bw = el.offsetWidth,
            bh = el.offsetHeight;
        let top = above ? y - bh - 2 : y + lh + 2;
        if (above ? top < 0 : top + bh > wrap.clientHeight && y - bh - 2 >= 0)
            top = above ? y + lh + 2 : y - bh - 2;
        el.style.left = Math.max(0, Math.min(x, wrap.clientWidth - bw - 4)) + 'px';
        el.style.top = Math.max(0, top) + 'px';
    }
    const place = () => placeEl(box, st.start, false);
    /**
     * (Re)filters the open session for the word at the caret; closes the popup if nothing matches.
     */
    function show() {
        const word = ta.value.slice(st.start, ta.selectionStart);
        st.word = word;
        st.shown = filter(st.all, word);
        if (!st.shown.length) {
            close();
            return;
        }
        st.sel = 0;
        paint();
        place();
    }
    function open(force) {
        let r;
        try {
            r = compute(force);
        }
        catch (e) {
            console.warn('IntelliSense: completion failed', e);
            r = null;
        }
        if (!r || !r.items.length) {
            close();
            return;
        }
        r.items.sort((a, b) => a.group - b.group || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        st = { start: r.start, all: r.items, member: r.member, str: !!r.str, shown: [], sel: 0, word: '' };
        show();
    }
    function accept(i) {
        const it = st.shown[i == null ? st.sel : i];
        if (!it)
            return;
        const s = st.start;
        close();
        accepting = true;
        ta.focus();
        ta.setSelectionRange(s, ta.selectionStart);
        document.execCommand('insertText', false, it.name);
        accepting = false;
    }
    /* ---------- signature help ---------- */
    const sgBox = document.createElement('div');
    sgBox.id = 'sg';
    sgBox.hidden = true;
    wrap.append(sgBox);
    const hideSig = () => {
        sgBox.hidden = true;
    };
    // Parameters of the procedure `name` (optionally called on control `ctl`), or null if it is not a known procedure.
    function sigOf(name, ctl, src) {
        const nm = name.toLowerCase();
        if (ctl) {
            const c = ctl.toLowerCase();
            let n = controls().get(c);
            if (!n && (c === 'me' || c === 'form' || c === (root.name || '').toLowerCase()))
                n = root;
            const it = n && membersOf(n).find(i => i.params && i.name.toLowerCase() === nm);
            return it ? { name: it.name, params: it.params, desc: it.desc } : null;
        }
        const u = declared(src).subs.get(nm);
        if (u)
            return { name: u.name, params: u.params || [], desc: 'Sub / Function in this code' };
        const b = BUILTIN.find(x => x.toLowerCase() === nm);
        return b ? { name: b, params: BP[nm], desc: BDESC[b] } : null;
    }
    /**
     * Shows (or hides) the parameter hint for the call at the caret: inside "Name(", after "Name " in a command-style call.
     */
    function sigHelp() {
        if (st || document.activeElement !== ta || ta.selectionStart !== ta.selectionEnd)
            return hideSig();
        const src = ta.value,
            pos = ta.selectionStart,
            ls = src.lastIndexOf('\n', pos - 1) + 1,
            raw = src.slice(ls, pos);
        let clean = '',
            q = false;
        for (const ch of raw) {
            if (ch === '"') {
                q = !q;
                clean += ch;
            }
            else if (q)
                clean += ' ';
            else if (ch === "'")
                return hideSig();
            else
                clean += ch;
        }
        if (q || /^\s*(?:(?:public|private)\s+)?(?:sub|function|event|dim|const|static|rem)\b/i.test(clean))
            return hideSig();
        let hit = null;
        const stack = [];
        for (let i = 0; i < clean.length; i++) {
            if (clean[i] === '(')
                stack.push({ i, n: 0 });
            else if (clean[i] === ')')
                stack.pop();
            else if (clean[i] === ',' && stack.length)
                stack[stack.length - 1].n++;
        }
        if (stack.length) {
            const t = stack[stack.length - 1],
                m = /(?:([A-Za-z_]\w*)\s*\.\s*)?([A-Za-z_]\w*)\s*$/.exec(clean.slice(0, t.i));
            hit = m && Object.assign({ idx: t.n }, sigOf(m[2], m[1], src) || { params: null });
        }
        else {
            // command style: "Canvas1.DrawLine 10, 20, ..." (also after "Then" / "Else" / ":")
            const seg = clean.replace(/^.*(?:\bthen\b|\belse\b|:)\s*/i, ''),
                m = /^\s*(?:(?:call|set)\s+)?(?:([A-Za-z_]\w*)\s*\.\s*)?([A-Za-z_]\w*)\s+(.*)$/i.exec(seg);
            if (m && m[3] !== undefined && !/^\s*(=|<>|<=|>=|<|>)/.test(m[3])) {
                let d = 0,
                    n = 0;
                for (const ch of m[3]) {
                    if (ch === '(')
                        d++;
                    else if (ch === ')')
                        d--;
                    else if (ch === ',' && !d)
                        n++;
                }
                hit = Object.assign({ idx: n }, sigOf(m[2], m[1], src) || { params: null });
            }
        }
        if (!hit || !hit.params)
            return hideSig();
        const ps = hit.params,
            body = ps.map((p, i) => i === hit.idx ? `<b>${esc(p)}</b>` : esc(p)).join(', '),
            more = hit.idx >= ps.length && ps.length ? ' <i>(too many arguments)</i>' : '';
        sgBox.innerHTML = `${esc(hit.name)}(${body})${more}` + (hit.desc && hit.desc.indexOf(hit.name) !== 0 ? `<span class="sd">${esc(hit.desc)}</span>` : '');
        placeEl(sgBox, pos, true);
    }
    /* ---------- events ---------- */
    // Whatever goes wrong in here must never get in the way of the editor itself: errors close the popup and are only logged.
    const safe = f => {
        try {
            f();
        }
        catch (err) {
            close();
            console.warn('IntelliSense:', err);
        }
    };
    ta.addEventListener('input', e => safe(() => {
        if (accepting)
            return;
        const t = e.inputType || '';
        if (t !== 'insertText' && t !== 'deleteContentBackward' && t !== 'deleteContentForward') {
            close();
            return;
        }
        if (ta.selectionStart !== ta.selectionEnd) {
            close();
            return;
        }
        const c = e.data,
            trig = t === 'insertText' && !!c && (c === '.' || /\w/.test(c) || c === ' ');
        if (st) {
            // still inside the same word -> only filter again, otherwise start over
            const w = ta.value.slice(st.start, ta.selectionStart);
            if (ta.selectionStart >= st.start && (st.str ? /^[\w.-]*$/ : /^\w*$/).test(w)) {
                show();
                return;
            }
            close();
        }
        if (trig)
            open(false);
    }));
    // The parameter hint follows typing, caret movement and clicks.
    ta.addEventListener('input', () => safe(sigHelp));
    ta.addEventListener('keyup', e => safe(() => {
        if (e.key !== 'Escape')
            sigHelp();
    }));
    ta.addEventListener('mouseup', () => safe(sigHelp));
    ta.addEventListener('focus', () => safe(sigHelp));
    wrap.addEventListener('keydown', e => safe(() => {
        if (e.target !== ta)
            return;
        if (e.ctrlKey && (e.code === 'Space' || e.key === ' ')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            open(true);
            return;
        }
        if (!st) {
            if (e.key === 'Escape' && !sgBox.hidden) {
                e.preventDefault();
                e.stopImmediatePropagation();
                hideSig();
            }
            return;
        }
        const k = e.key,
            go = n => {
                e.preventDefault();
                e.stopImmediatePropagation();
                st.sel = (st.sel + n + st.shown.length) % st.shown.length;
                paint();
            };
        if (e.ctrlKey || e.metaKey || e.altKey)
            return close();
        if (k === 'ArrowDown')
            go(1);
        else if (k === 'ArrowUp')
            go(-1);
        else if (k === 'PageDown')
            go(Math.min(8, st.shown.length - 1 - st.sel) || 1);
        else if (k === 'PageUp')
            go(-Math.min(8, st.sel) || -1);
        else if (k === 'Enter' || k === 'Tab') {
            e.preventDefault();
            e.stopImmediatePropagation();
            accept();
        }
        else if (k === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            close();
        }
        else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End')
            close();
    }), true);
    // Clicking an entry accepts it; the mousedown must not take the focus away from the editor.
    box.addEventListener('mousedown', e => {
        e.preventDefault();
        const r = e.target.closest('.ai');
        r && accept(+r.dataset.i);
    });
    ta.addEventListener('blur', () => {
        close();
        hideSig();
    });
    ta.addEventListener('mousedown', close);
    // Scrolling (also the browser's own scrolling of the caret into view while typing) only moves the popup along.
    ta.addEventListener('scroll', () => safe(() => st ? place() : sigHelp()));
})();
}
catch (err) {
    console.warn('IntelliSense disabled:', err);
}
