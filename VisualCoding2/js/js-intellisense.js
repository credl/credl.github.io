/* ---------- IntelliSense for the code window (JavaScript) ----------
   Nothing is hard coded about controls, the DOM or JavaScript objects: the suggestions come from reflection on live objects.
   A hidden "probe" page (gen(null, true), see export.js) is the form's real exported page, loaded in an iframe, without the form's own code:
   the controls are real DOM elements, components have run their code, and window.$scope(expr) evaluates an expression in exactly the scope
   the code runs in. So
   - after "expr."      expr is evaluated in the probe, and the members of the resulting object are listed by walking its prototype chain
                        (Object.getOwnPropertyNames + the live values: functions become methods, null on* members become events)
   - otherwise          the variables of the scope ($vars, evaluated live), the probe window's globals, names declared in the code, keywords
   - event parameters   in addEventListener('click', function (event) ...) "event" is a real event of the matching type, created in the probe
   - inside a string    $('...') / getElementById('...') list the ids of the probe's elements, addEventListener('...') the events of the target
   - after "(" or ","   a hint with the called function's parameters (read from its live source), the current one in bold
   Names the code declares itself (let x = ...) are not live (the code is never run here): their initialiser is evaluated instead, when it can be.
   Typing "." or two letters opens the list, Ctrl+Space opens it anywhere. Up/Down choose, Enter or Tab accept, Esc closes. */
try {
(() => {
    const ta = $('#vb'),
        wrap = $('#vbw');
    if (!ta || !wrap)
        return;
    const sty = document.createElement('style');
    sty.id = 'acStyle';
    sty.textContent = `
#ac{position:absolute;z-index:8;min-width:240px;max-width:460px;background:var(--pn);color:var(--ink);border:1px solid var(--ln);border-radius:4px;box-shadow:0 6px 20px #0004;font:12px/1.4 ui-monospace,Consolas,monospace}
#ac .al{max-height:212px;overflow-y:auto}
#ac .ai{display:flex;align-items:center;gap:6px;padding:1px 8px 1px 4px;cursor:pointer;white-space:nowrap}
#ac .ai.on{background:var(--acs)}
#ac .an{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}#ac .an b{font-weight:700}
#ac .ad{flex:none;color:var(--mut);font-size:11px;margin-left:14px;max-width:190px;overflow:hidden;text-overflow:ellipsis}
#ac .ak{flex:none;width:16px;height:16px;text-align:center;font:700 10px/16px system-ui,sans-serif;font-style:normal;border-radius:3px;color:#fff;background:#677085}
#ac .ak.method,#ac .ak.function{background:#8a3ab9}#ac .ak.property{background:#0b6bcb}#ac .ak.variable{background:#12807c}
#ac .ak.control{background:#1f8a4c}#ac .ak.class{background:#c4690c}#ac .ak.event{background:#a87000}#ac .ak.keyword{background:#677085}
#sg{position:absolute;z-index:9;max-width:520px;background:var(--pn);color:var(--ink);border:1px solid var(--ln);border-radius:4px;box-shadow:0 4px 14px #0004;font:12px/1.4 ui-monospace,Consolas,monospace;padding:3px 8px;white-space:pre-wrap}
#sg b{color:var(--ac);font-weight:700;text-decoration:underline}#sg .sd{display:block;color:var(--mut);font-size:11px}
`;
    document.head.append(sty);
    const box = document.createElement('div'),
        sg = document.createElement('div');
    box.id = 'ac';
    box.hidden = true;
    sg.id = 'sg';
    sg.hidden = true;
    wrap.append(box, sg);
    const KIND = { method: 'ƒ', property: '◆', variable: 'v', control: '▣', class: 'C', event: '⚡', keyword: 'k', function: 'ƒ' };
    const IDENT = /^[A-Za-z_$][\w$]*$/;
    // Runs f and returns its result, or undefined if it throws (reflection on foreign objects can always throw).
    const safe = f => {
        try {
            return f();
        }
        catch (e) { }
    };
    /* ---------- the probe: the real page in a hidden iframe ---------- */
    let P = null;
    /**
     * Promise of the probe window, matching the current form. The iframe is only rebuilt when the generated page changed.
     */
    function probe() {
        let html = null;
        try {
            html = gen(null, true);
        }
        catch (e) {
            xid = null;
        }
        if (html == null)
            return P ? P.ready : Promise.resolve(null);
        if (P && P.html === html)
            return P.ready;
        if (P)
            P.frame.remove();
        const f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        f.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:700px;border:0;visibility:hidden;pointer-events:none';
        const ready = new Promise(res => {
            f.onload = () => res(f.contentWindow && f.contentWindow.$scope ? f.contentWindow : null);
        });
        P = { html, frame: f, ready };
        f.srcdoc = html;
        document.body.append(f);
        return ready;
    }
    /* ---------- reflection helpers (all on objects of the probe's realm, W = its window) ---------- */
    let W = null;
    const ctorName = v => v === null ? 'null' : v === undefined ? 'undefined' : typeof v === 'function' ? 'function' : typeof v === 'object' ? (safe(() => v.constructor.name) || 'object') : typeof v;
    // Parameter list of a function, read from its source ("" for native functions, whose parameter names are not available).
    const paramsOf = f => {
        const src = safe(() => Function.prototype.toString.call(f)) || '';
        if (/\{\s*\[native code\]\s*\}\s*$/.test(src))
            return null;
        const m = /^(?:async\s+)?(?:function\b[^(]*)?\(([^)]*)\)/.exec(src) || /^(?:async\s+)?([\w$]+)\s*=>/.exec(src);
        return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
    };
    /**
     * The members of a live value, found by walking its prototype chain: [{name, kind, detail, depth}].
     * Primitives are boxed. Functions are methods, members that are null and start with "on" are events.
     */
    function members(v) {
        if (v == null)
            return [];
        const o = (typeof v === 'object' || typeof v === 'function') ? v : W.Object(v),
            out = new Map();
        let p = o,
            depth = 0;
        while (p && p !== W.Object.prototype && depth < 12) {
            const own = safe(() => W.Object.getOwnPropertyNames(p)) || [];
            for (const k of own) {
                if (out.has(k) || k === 'constructor' || !IDENT.test(k))
                    continue;
                let val,
                    got = true;
                try {
                    val = o[k];
                }
                catch (e) {
                    got = false;
                }
                let kind = 'property',
                    detail = '';
                if (got && typeof val === 'function') {
                    kind = 'method';
                    const ps = paramsOf(val);
                    detail = ps ? '(' + ps.join(', ') + ')' : '(' + (val.length ? val.length + ' arg' + (val.length > 1 ? 's' : '') : '') + ')';
                }
                else if (got && val === null && /^on[a-z]/.test(k))
                    kind = 'event';
                else if (got)
                    detail = ctorName(val);
                out.set(k, { name: k, kind, detail, depth });
            }
            p = safe(() => W.Object.getPrototypeOf(p));
            depth++;
        }
        return [...out.values()];
    }
    /**
     * Creates a real event of the type a listener for `ev` on `target` receives, inside the probe:
     * the browser's own event for click / focus / blur where it can be triggered, otherwise an instance of the event class whose name
     * best matches the event name (found by scanning the probe's constructors), otherwise a plain Event. It is dispatched once, so target is set.
     */
    function mkEvent(target, ev) {
        if (!target || typeof target.addEventListener !== 'function')
            return null;
        let got = null;
        const l = e => got = got || e;
        target.addEventListener(ev, l);
        safe(() => ev === 'click' ? target.click() : ev === 'focus' ? target.focus() : ev === 'blur' ? target.blur() : 0);
        if (!got) {
            let best = null,
                bs = 2;
            for (const n of safe(() => W.Object.getOwnPropertyNames(W)) || []) {
                if (!/.Event$/.test(n) || typeof W[n] !== 'function')
                    continue;
                const b = n.slice(0, -5).toLowerCase();
                let i = 0;
                while (i < b.length && i < ev.length && b[i] === ev[i])
                    i++;
                if (i > bs) {
                    bs = i;
                    best = n;
                }
            }
            const e = (best && safe(() => new W[best](ev, { bubbles: false }))) || new W.Event(ev);
            safe(() => target.dispatchEvent(e));
        }
        target.removeEventListener(ev, l);
        return got;
    }
    /* ---------- reading the code around the caret ---------- */
    /**
     * Lexical state at the end of `s`: inside a string (with its start and quote), a comment, or code; plus the open brackets
     * ({ch, pos, commas}) of the code part.
     */
    function scan(s) {
        const st = [];
        let i = 0,
            state = 'code',
            q = '',
            at = 0;
        while (i < s.length) {
            const c = s[i],
                d = s[i + 1];
            if (state === 'code') {
                if (c === '/' && d === '/') {
                    state = 'line';
                    i++;
                }
                else if (c === '/' && d === '*') {
                    state = 'block';
                    i++;
                }
                else if (c === '"' || c === "'" || c === '`') {
                    state = 'str';
                    q = c;
                    at = i;
                }
                else if ('([{'.includes(c))
                    st.push({ ch: c, pos: i, commas: 0 });
                else if (')]}'.includes(c))
                    st.pop();
                else if (c === ',' && st.length)
                    st[st.length - 1].commas++;
            }
            else if (state === 'line') {
                if (c === '\n')
                    state = 'code';
            }
            else if (state === 'block') {
                if (c === '*' && d === '/') {
                    state = 'code';
                    i++;
                }
            }
            else if (c === '\\')
                i++;
            else if (c === q || (c === '\n' && q !== '`'))
                state = 'code';
            i++;
        }
        return { state, q, at, st };
    }
    /**
     * The expression that ends at index `end` of s (identifiers, dots, calls, indexes, optional chaining), or ''.
     */
    function exprEnd(s, end) {
        let i = end;
        while (i > 0) {
            const c = s[i - 1];
            if (/[\w$]/.test(c))
                i--;
            else if (c === '.') {
                i--;
                if (s[i - 1] === '?')
                    i--;
            }
            else if (c === ')' || c === ']') {
                let d = 0,
                    j = i - 1;
                for (; j >= 0; j--) {
                    if (')]'.includes(s[j]))
                        d++;
                    else if ('([' .includes(s[j]) && !--d)
                        break;
                }
                if (j < 0)
                    return '';
                i = j;
            }
            else if (c === '"' || c === "'" || c === '`') {
                const j = s.lastIndexOf(c, i - 2);
                if (j < 0)
                    return '';
                i = j;
                break;
            }
            else if (/\s/.test(c)) {
                let k = i - 1;
                while (k > 0 && /\s/.test(s[k - 1]))
                    k--;
                if (s[k - 1] === '.' || s[i] === '.')
                    i = k;
                else
                    break;
            }
            else
                break;
        }
        return s.slice(i, end).trim();
    }
    // Names the code declares: variables, functions, classes and parameters (not scoped; the whole text counts).
    function declared(code) {
        const out = new Map();
        const add = (n, k) => IDENT.test(n) && !out.has(n) && out.set(n, k);
        for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g))
            add(m[1], 'variable');
        for (const m of code.matchAll(/\b(?:function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/g))
            add(m[1], m[0][0] === 'c' ? 'class' : 'function');
        for (const m of code.matchAll(/\bfunction\s*\*?\s*[\w$]*\s*\(([^)]*)\)|\(([^()]*)\)\s*=>|\b([A-Za-z_$][\w$]*)\s*=>/g))
            (m[1] || m[2] || m[3] || '').split(',').forEach(p => add(p.replace(/=.*$/, '').replace(/^\.\.\./, '').trim(), 'variable'));
        return out;
    }
    // The initialiser of a variable the code declares (the rest of its line up to ";"), or ''.
    const initOf = (code, name) => {
        const m = new RegExp('\\b(?:const|let|var)\\s+' + name.replace(/\$/g, '\\$') + '\\s*=\\s*([^;\\n]+)').exec(code);
        return m ? m[1].trim() : '';
    };
    /**
     * Evaluates `expr` in the probe's scope. Unknown names fall back to their declaration in the code:
     * a parameter of an addEventListener callback becomes a real event of that type, a declared variable its evaluated initialiser.
     * Returns {ok, v}.
     */
    function resolve(expr, code) {
        if (!expr)
            return { ok: 0 };
        const head = /^[A-Za-z_$][\w$]*/.exec(expr),
            tail = head ? expr.slice(head[0].length) : '',
            apply = base => ({ ok: 1, v: tail ? new W.Function('$b', 'return $b' + tail)(base) : base });
        try {
            if (head && !W.$vars.includes(head[0])) {
                const ev = eventParam(code, head[0]);
                if (ev)
                    return apply(ev);
                const init = initOf(code, head[0]);
                if (init)
                    return apply(W.$scope('(' + init + ')'));
            }
            return { ok: 1, v: W.$scope(expr) };
        }
        catch (e) {
            return { ok: 0 };
        }
    }
    // If `name` is the parameter of an addEventListener callback that encloses the end of `code`: that callback's event object.
    function eventParam(code, name) {
        const re = /\.\s*addEventListener\(\s*(['"`])([\w:-]+)\1\s*,\s*(?:async\s+)?(?:function\s*[\w$]*\s*\(\s*([\w$]+)|\(\s*([\w$]+)|([\w$]+)\s*=>)/g;
        let m,
            hit = null;
        while ((m = re.exec(code)))
            if ((m[3] || m[4] || m[5]) === name)
                hit = m;
        if (!hit)
            return null;
        const t = resolve(exprEnd(code, hit.index), '');
        return t.ok ? mkEvent(t.v, hit[2]) : null;
    }
    /* ---------- building the suggestions ---------- */
    /**
     * Items for the caret position in `before` (the text up to the caret): {start, items, member} or null.
     */
    function suggest(before, code, manual) {
        const sc = scan(before);
        if (sc.state === 'line' || sc.state === 'block')
            return null;
        if (sc.state === 'str') {
            const prefix = /[\w$:-]*$/.exec(before)[0],
                pre = before.slice(0, sc.at),
                start = before.length - prefix.length;
            if (/(?:\$|getElementById)\s*\(\s*$/.test(pre))
                return { start, items: [...W.document.querySelectorAll('[id]')].map(e => ({ name: e.id, kind: 'control', detail: e.tagName.toLowerCase() })) };
            const m = /\.\s*(?:addEventListener|removeEventListener)\s*\(\s*$/.exec(pre);
            if (m) {
                const t = resolve(exprEnd(pre, m.index), before),
                    items = members(t.ok ? t.v : null).filter(x => x.kind === 'event').map(x => ({ name: x.name.slice(2), kind: 'event', detail: 'event' }));
                // Events a component instance emits (read from its code, they are custom events and not members of anything).
                const nm = exprEnd(pre, m.index),
                    node = nm && [...ids().entries()].map(([id, b]) => [G(id), b]).find(([n, b]) => b === nm && n && n.type === 'comp');
                if (node)
                    compInfo(node[0]).ev.forEach(e => items.push({ name: e, kind: 'event', detail: 'emitted by the component' }));
                return { start, items };
            }
            return null;
        }
        const mm = /(\??\.)\s*([\w$]*)$/.exec(before);
        if (mm) {
            const ex = exprEnd(before, mm.index),
                t = /^\d[\d.]*$/.test(ex) ? { ok: 0 } : resolve(ex, before);
            if (!t.ok)
                return null;
            return { start: before.length - mm[2].length, member: true, items: members(t.v).map(x => ({ ...x, detail: x.detail })) };
        }
        const pm = /([A-Za-z_$][\w$]*)?$/.exec(before)[0];
        if (!manual && pm.length < 2)
            return null;
        // not after a dot that could not be resolved, and not while declaring a name
        if (/(?:\b(?:const|let|var|function|class)\s+|\.\s*)[\w$]*$/.test(before))
            return null;
        const items = new Map(),
            add = (name, kind, detail, depth) => !items.has(name) && IDENT.test(name) && items.set(name, { name, kind, detail, depth });
        W.$vars.forEach(v => add(v, v === 'form' || v === '$' || v === 'emit' ? 'variable' : 'control', ctorName(safe(() => W.$scope(v))), 0));
        declared(code).forEach((k, n) => add(n, k, 'declared in the code', 0));
        KW.forEach(k => add(k, 'keyword', '', 3));
        for (const n of safe(() => W.Object.getOwnPropertyNames(W)) || []) {
            if (!IDENT.test(n) || (n[0] === '$' && n.length > 1) || /^on[a-z]/.test(n))
                continue;
            const v = safe(() => W[n]);
            add(n, typeof v === 'function' ? (/^[A-Z]/.test(n) ? 'class' : 'function') : 'variable', ctorName(v), 2);
        }
        return { start: before.length - pm.length, items: [...items.values()] };
    }
    // Filters by what was typed and sorts: prefix matches first, then substring and subsequence matches; events last, near members before distant ones.
    function rank(items, prefix) {
        const p = prefix.toLowerCase(),
            sub = (n, p) => {
                let i = 0;
                for (const c of n)
                    if (c === p[i])
                        i++;
                return i === p.length;
            },
            sc = n => {
                const l = n.toLowerCase();
                return !p || l.startsWith(p) ? 0 : l.includes(p) ? 1 : sub(l, p) ? 2 : 9;
            };
		return items.map(x => ({ x, s: sc(x.name) })).filter(a => a.s < 9)
            .sort((a, b) => a.s - b.s || (a.x.kind === 'event') - (b.x.kind === 'event') || (a.x.depth || 0) - (b.x.depth || 0) || (a.x.name < b.x.name ? -1 : 1))
            .map(a => a.x).slice(0, 300);
    }
    /* ---------- popup ---------- */
    let st = null,
        sel = 0,
        seq = 0,
        mute = false;
    const caretXY = () => {
        const cs = getComputedStyle(ta),
            c = document.createElement('canvas').getContext('2d');
        c.font = cs.font;
        const cw = c.measureText('M').width,
            lh = parseFloat(cs.lineHeight) || 19.5,
            lines = ta.value.slice(0, ta.selectionStart).split('\n'),
            last = lines[lines.length - 1];
        let col = 0;
        for (const ch of last)
            col += ch === '\t' ? 4 - col % 4 : 1;
        return {
            x: ta.offsetLeft + parseFloat(cs.paddingLeft) + col * cw - ta.scrollLeft,
            y: ta.offsetTop + parseFloat(cs.paddingTop) + (lines.length - 1) * lh - ta.scrollTop,
            lh
        };
    };
    // Puts el next to the caret (below it, or above when there is no room).
    const put = (el, w) => {
        const c = caretXY();
        el.hidden = false;
        el.style.left = Math.max(0, Math.min(c.x, wrap.clientWidth - (el.offsetWidth || w || 240) - 4)) + 'px';
        const h = el.offsetHeight,
            below = c.y + c.lh + 2;
        el.style.top = (below + h > wrap.clientHeight && c.y - h - 2 > 0 ? c.y - h - 2 : below) + 'px';
    };
    const close = () => {
        st = null;
        box.hidden = true;
        box.innerHTML = '';
        seq++;
    };
    const hideSig = () => sg.hidden = true;
    function draw() {
        if (!st)
            return;
        const e = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])),
            pl = st.prefix.length;
        box.innerHTML = '<div class="al">' + st.list.map((x, i) =>
            `<div class="ai${i === sel ? ' on' : ''}" data-i="${i}"><i class="ak ${x.kind}">${KIND[x.kind] || '?'}</i><span class="an">${x.name.toLowerCase().startsWith(st.prefix.toLowerCase()) ? `<b>${e(x.name.slice(0, pl))}</b>${e(x.name.slice(pl))}` : e(x.name)}</span><span class="ad">${e(x.detail || '')}</span></div>`).join('') + '</div>';
        put(box, 300);
        const on = box.querySelector('.ai.on');
        if (on)
            on.scrollIntoView({ block: 'nearest' });
    }
    function accept(i = sel) {
        if (!st || !st.list[i])
            return;
        const name = st.list[i].name,
            start = st.start,
            end = ta.selectionStart;
        close();
        ta.setSelectionRange(start, end);
        mute = true;
        document.execCommand('insertText', false, name);
        mute = false;
    }
    /**
     * Recomputes the popup for the caret position. manual = Ctrl+Space (also opens on an empty prefix).
     */
    async function refresh(manual) {
        const my = ++seq;
        const w = await probe();
        if (my !== seq || !w)
            return;
        W = w;
        const code = ta.value,
            before = code.slice(0, ta.selectionStart),
            r = safe(() => suggest(before, code, manual));
        if (!r) {
            if (st)
                close();
            return;
        }
        const prefix = before.slice(r.start),
            list = rank(r.items, prefix);
        if (!list.length) {
            close();
            return;
        }
        st = { start: r.start, prefix, list };
        sel = 0;
        draw();
    }
    /* ---------- signature hint ---------- */
    async function sigHelp() {
        const my = ++sgSeq;
        const before = ta.value.slice(0, ta.selectionStart),
            sc = scan(before),
            call = sc.state === 'code' && sc.st.length ? sc.st[sc.st.length - 1] : null;
        // only when the innermost open bracket is a call's "("
        if (!call || call.ch !== '(')
            return hideSig();
        const callee = exprEnd(before, call.pos);
        if (!callee || KW.has(callee) || /^(?:function|catch|if|for|while|switch)$/.test(callee))
            return hideSig();
        const w = await probe();
        if (my !== sgSeq || !w)
            return;
        W = w;
        const code = ta.value;
        let name = callee.replace(/^.*\./, ''),
            ps = null,
            n = 0,
            f = resolve(callee, before);
        if (f.ok && typeof f.v === 'function') {
            ps = paramsOf(f.v);
            n = f.v.length;
            name = f.v.name || name;
        }
        else {
            // a function the code declares itself
            const m = new RegExp('\\bfunction\\s*\\*?\\s*' + callee.replace(/\$/g, '\\$') + '\\s*\\(([^)]*)\\)').exec(code)
                || new RegExp('\\b(?:const|let|var)\\s+' + callee.replace(/\$/g, '\\$') + '\\s*=\\s*(?:async\\s+)?(?:function\\s*\\*?\\s*[\\w$]*\\s*)?\\(([^)]*)\\)').exec(code);
            if (!m)
                return hideSig();
            ps = m[1].split(',').map(s => s.trim()).filter(Boolean);
        }
        const cur = call.commas;
        sg.innerHTML = ps
            ? esc(name) + '(' + ps.map((p, i) => i === cur ? `<b>${esc(p)}</b>` : esc(p)).join(', ') + ')'
            : esc(name) + '(' + (n ? Array.from({ length: Math.max(n, cur + 1) }, (_, i) => i === cur ? '<b>…</b>' : '…').join(', ') : '…') + ')' + '<span class="sd">native function' + (n ? ', ' + n + ' required argument' + (n > 1 ? 's' : '') : '') + '</span>';
        put(sg, 200);
        // keep the hint above the list when both are shown
        if (!box.hidden) {
            const c = caretXY();
            sg.style.top = Math.max(0, c.y - sg.offsetHeight - 2) + 'px';
        }
    }
    let sgSeq = 0;
    /* ---------- events ---------- */
    ta.addEventListener('input', e => {
        if (currentLanguage().getIntellisenseProvider() !== 'javascript-reflection') return;
        if (mute)
            return;
        const t = e.inputType || '';
        if (/^(insert|delete)/.test(t) && !/^insertFromPaste/.test(t))
            refresh(false);
        else
            close();
        sigHelp();
    });
    ta.addEventListener('keyup', e => {
        if (currentLanguage().getIntellisenseProvider() !== 'javascript-reflection') return;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace', 'Delete'].includes(e.key) || (e.key.length === 1 && ')(,'.includes(e.key)))
            sigHelp();
    });
    ta.addEventListener('click', () => {
        if (currentLanguage().getIntellisenseProvider() !== 'javascript-reflection') return;
        close();
        sigHelp();
    });
    ta.addEventListener('keydown', e => {
        if (currentLanguage().getIntellisenseProvider() !== 'javascript-reflection') return;
        const k = e.key;
        if (k === ' ' && e.ctrlKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            refresh(true);
            return;
        }
        if (k === 'Escape' && !sg.hidden && !st) {
            hideSig();
            return;
        }
        if (!st)
            return;
        const go = d => {
            e.preventDefault();
            e.stopImmediatePropagation();
            sel = (sel + d + st.list.length) % st.list.length;
            draw();
        };
        if (k === 'ArrowDown')
            go(1);
        else if (k === 'ArrowUp')
            go(-1);
        else if (k === 'PageDown')
            go(Math.min(8, st.list.length - 1 - sel) || 0);
        else if (k === 'PageUp')
            go(-Math.min(8, sel));
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
        else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k))
            close();
    }, true);
    box.addEventListener('mousedown', e => {
        if (currentLanguage().getIntellisenseProvider() !== 'javascript-reflection') return;
        e.preventDefault();
        const r = e.target.closest('.ai');
        if (r)
            accept(+r.dataset.i);
    });
    ta.addEventListener('blur', () => {
        close();
        hideSig();
    });
    ta.addEventListener('scroll', () => {
        if (currentLanguage().getIntellisenseProvider() !== 'javascript-reflection') return;
        if (st)
            draw();
        if (!sg.hidden)
            sigHelp();
    });
})();
}
catch (err) {
    console.warn('IntelliSense disabled:', err);
}
