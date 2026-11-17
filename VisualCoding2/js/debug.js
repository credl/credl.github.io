/* ---------- debugger ----------
   A debug run executes an instrumented copy of the JavaScript (instrument.js): every statement is preceded by `await $d($f, line, $e => eval($e))`,
   every function with hooks is async and registers a call-stack frame ($fe / $fx). The runtime below lives inside the preview iframe and talks
   to this window via postMessage: it pauses at breakpoints / `debugger` statements / while stepping, and evaluates expressions (locals, watches)
   through the eval closure captured at each statement, so they can be read in any frame of the call stack.
   The window.$dbg state, $fe, $fx, $d, $q and $run are the interface between the generated page (export.js) and this file. */
/* runs INSIDE the preview iframe (serialised with toString) */
/**
 * The debug runtime. It is serialised with toString() and runs inside the preview iframe,
 * so it must not use any variable from this file.
 * bp = breakpoint map "docId:line" -> 1, mode = start mode ('run' | 'into').
 * It sends ready / paused / idle / error / evr messages to the editor and receives bp / pause / resume / ev.
 */
function dbgRT(bp, mode) {
    // Shared state: call stack of frames {k: scope key, d: doc id, i: function index, fn: name, l: line, ev: eval closure},
    // step depth, resume callback (res) + the promise others wait on while paused (gate), pause request flag (pr).
    var D = window.$dbg = { bp: bp, mode: mode, stack: [], depth: 0, res: null, gate: null, pr: 0 };
    // Sends a message to the editor window.
    var post = function (m) {
        m.dbg = 1;
        try {
            parent.postMessage(m, '*');
        }
        catch (e) { }
    };
    // Short text of a value for the panels (objects are shown one level deep).
    var prev = function (v, d) {
        var t = typeof v;
        try {
            if (v === undefined)
                return 'undefined';
            if (v === null)
                return 'null';
            if (t === 'string') {
                var s = v.length > 200 ? v.slice(0, 200) + '…' : v;
                return JSON.stringify(s);
            }
            if (t === 'bigint')
                return v + 'n';
            if (t === 'function')
                return 'ƒ ' + (v.name || '(anonymous)') + '()';
            if (t !== 'object')
                return String(v);
            if (v instanceof Element)
                return '<' + v.tagName.toLowerCase() + (v.id ? '#' + v.id : '') + '>';
            if (v instanceof Error)
                return String(v);
            if (v instanceof Date)
                return isNaN(v) ? 'Invalid Date' : v.toISOString();
            if (v instanceof RegExp)
                return String(v);
            if (Array.isArray(v))
                return d > 0 ? 'Array(' + v.length + ')' : 'Array(' + v.length + ') [' + v.slice(0, 8).map(function (x) { return prev(x, d + 1); }).join(', ') + (v.length > 8 ? ', …' : '') + ']';
            if (v instanceof Map || v instanceof Set)
                return v.constructor.name + '(' + v.size + ')';
            var c = v.constructor && v.constructor.name && v.constructor.name !== 'Object' ? v.constructor.name + ' ' : '';
            if (d > 0)
                return c + '{…}';
            var k = Object.keys(v);
            return c + '{' + k.slice(0, 6).map(function (x) { return x + ': ' + prev(v[x], d + 1); }).join(', ') + (k.length > 6 ? ', …' : '') + '}';
        }
        catch (e) {
            return '[' + t + ']';
        }
    };
    // Serialises a value for display in the editor: type (for the colour) + text.
    var ser = function (v) {
        var t = typeof v;
        return { y: v === undefined || v === null ? 'empty' : t === 'bigint' ? 'number' : t, s: prev(v, 0) };
    };
    // Function entry and exit maintain the call stack; an empty stack means the app is idle.
    window.$fe = function (k, d, i, n) {
        var f = { k: k, d: d, i: i, fn: n, l: 0, ev: null };
        D.stack.push(f);
        return f;
    };
    window.$fx = function (f) {
        var x = D.stack.lastIndexOf(f);
        if (x >= 0)
            D.stack.splice(x, 1);
        if (!D.stack.length) {
            // stepping ends with the handler: the next event runs freely
            if (D.mode === 'over' || D.mode === 'out')
                D.mode = 'run';
            if (!D.res)
                post({ t: 'idle' });
        }
    };
    // Called before every statement: remembers its position and eval closure, then decides whether to stop.
    // The returned promise stays pending until the editor sends "resume".
    window.$d = function (f, l, ev, force) {
        f.l = l;
        f.ev = ev;
        // Everything else that runs while the debugger is paused waits as well.
        if (D.res)
            return D.gate;
        // Why stop: pause request, `debugger` statement, breakpoint or stepping (into = any statement, over = not deeper than where we started, out = shallower).
        var why = '';
        if (D.pr) {
            D.pr = 0;
            why = 'pause';
        }
        else if (force)
            why = 'debugger';
        else if (D.bp[f.d + ':' + l])
            why = 'breakpoint';
        else if (D.mode === 'into')
            why = 'step';
        else if (D.mode === 'over' && D.stack.length <= D.depth)
            why = 'step';
        else if (D.mode === 'out' && D.stack.length < D.depth)
            why = 'step';
        if (!why)
            return;
        D.mode = 'run';
        // Stop here: report the call stack and wait for "resume".
        D.gate = new Promise(function (r) {
            D.res = r;
        });
        post({
            t: 'paused',
            why: why,
            stack: D.stack.map(function (x) {
                return { fn: x.fn, k: x.k, d: x.d, l: x.l, i: x.i };
            })
        });
        return D.gate;
    };
    // The scopes (form, component instances) run one after the other, like the plain export runs them in order.
    // 'load' listeners are held back until all of them have run: in a normal run the page script finishes before the load event,
    // while a paused / stepping debug run would let the load event overtake it.
    var loaded = document.readyState === 'complete',
        done = false,
        held = [],
        add = window.addEventListener;
    var fire = function (fn) {
        setTimeout(function () {
            var e = new Event('load');
            try {
                var r = typeof fn === 'function' ? fn.call(window, e) : fn.handleEvent(e);
                if (r && r.catch)
                    r.catch(function (x) { post({ t: 'error', msg: String(x && x.message || x) }); });
            }
            catch (x) {
                post({ t: 'error', msg: String(x && x.message || x) });
            }
        }, 0);
    };
    add.call(window, 'load', function () {
        loaded = true;
    });
    window.addEventListener = function (t, fn) {
        if (t === 'load' && fn && (loaded || !done)) {
            if (done)
                fire(fn);
            else
                held.push(fn);
            return;
        }
        return add.apply(this, arguments);
    };
    window.$q = [];
    window.$run = async function () {
        for (var i = 0; i < window.$q.length; i++) {
            try {
                await window.$q[i]();
            }
            catch (e) {
                post({ t: 'error', msg: String(e && e.message || e) });
            }
        }
        done = true;
        held.forEach(function (fn) {
            if (loaded)
                fire(fn);
            else
                add.call(window, 'load', fn);
        });
        held = [];
    };
    // Messages from the editor: new breakpoints, pause request, resume (with step mode) and
    // requests to evaluate expressions (locals, watches) in a stack frame.
    addEventListener('message', function (e) {
        var m = e.data;
        if (e.source !== parent || !m || !m.dbg)
            return;
        if (m.t === 'bp')
            D.bp = m.bp;
        else if (m.t === 'pause')
            D.pr = 1;
        else if (m.t === 'resume') {
            D.mode = m.mode;
            D.depth = D.stack.length;
            var r = D.res;
            D.res = null;
            if (r)
                r();
        }
        else if (m.t === 'ev') {
            var f = D.stack[m.frame],
                out = [];
            m.js.forEach(function (j) {
                try {
                    if (!f || !f.ev)
                        throw new Error('no frame');
                    out.push({ ok: 1, v: ser(f.ev(j)) });
                }
                catch (x) {
                    out.push({ ok: 0, e: String(x && x.message || x), ref: x instanceof ReferenceError });
                }
            });
            post({ t: 'evr', rid: m.rid, vals: out });
        }
    });
    // Report runtime errors to the editor.
    addEventListener('error', function (e) {
        post({ t: 'error', msg: String(e.message || 'Error') });
    });
    addEventListener('unhandledrejection', function (e) {
        post({ t: 'error', msg: String(e.reason && e.reason.message || e.reason) });
    });
    // Tell the editor the runtime is ready (it answers with the current breakpoints).
    post({ t: 'ready' });
}
/**
 * Returns the code that embeds the debug runtime in a generated page: dbgRT's source called with the breakpoints and start mode.
 */
function dbgRuntime(D) {
    return '(' + dbgRT.toString() + ')(' + JSON.stringify(D.bp) + ',' + JSON.stringify(D.mode) + ');\n';
}
/* ---------- breakpoints (stored per component/doc as a list of line numbers) ---------- */
/**
 * Breakpoint list (line numbers) of a document; created on demand.
 */
const bpOf = d => d.bp || (d.bp = []);
const vbIdsFor = r => { const m = new Map(), used = new Set(); walk(r, n => { if (n === r) return; let b = (n.name || n.type).replace(/[^\w$]/g, '_'); if (/^\d/.test(b)) b = '_' + b; let v = b, i = 2; while (used.has(v)) v = b + (i++); used.add(v); m.set(n.id, v); }); return m; };
/**
 * All breakpoints of all documents as a map "docId:line" -> 1, the form the runtime expects.
 */
const bpMap = () => {
    const m = {};
    docs.forEach(d => bpOf(d).forEach(l => m[d.id + ':' + l] = 1));
    return m;
};
/* lines that hold an executable statement (the only places a breakpoint can stop): the lines the instrumenter puts a hook on */
function validLines(d, code) {
    try {
        const src = code == null ? d.root.code || '' : code;
        return LanguageRegistry.get(d.root.language || 'javascript').breakableLines(src, { root: d.root, ids: vbIdsFor(d.root), key: 'x', doc: d.id });
    }
    catch (e) {
        return [];
    }
}
/* toggle; returns false when the line has no executable statement */
function toggleBp(d, l, code) {
    const a = bpOf(d),
        i = a.indexOf(l);
    if (i >= 0) {
        a.splice(i, 1);
    }
    else {
        if (!validLines(d, code).includes(l))
            return false;
        a.push(l);
        a.sort((x, y) => x - y);
    }
    persist();
    syncBps();
    return true;
}
/* keep breakpoints attached to their statements while the code is edited */
function shiftBps(d, a, b) {
    const bp = bpOf(d);
    if (!bp.length || a === b)
        return;
    // Find the changed region: common prefix p and common suffix q of the old text a and the new text b.
    let p = 0;
    const m = Math.min(a.length, b.length);
    while (p < m && a[p] === b[p])
        p++;
    let q = 0;
    while (q < m - p && a[a.length - 1 - q] === b[b.length - 1 - q])
        q++;
    const rm = a.slice(p, a.length - q),
        ad = b.slice(p, b.length - q),
        rl = rm.split('\n').length - 1,
        al = ad.split('\n').length - 1;
    if (rl === al)
        return;
    // rl / al = number of lines removed / added. Breakpoints after the change move by the difference,
    // those inside removed lines are dropped.
    const l0 = a.slice(0, p).split('\n').length,
        st = p === 0 || a[p - 1] === '\n';
    d.bp = bp.map(l => {
        if (!rl) {
            const th = st ? l0 - 1 : l0;
            return l > th ? l + al : l;
        }
        if (st && !al && rm.endsWith('\n'))
            return l < l0 ? l : l < l0 + rl ? null : l - rl;
        if (l <= l0)
            return l;
        if (l <= l0 + rl)
            return l <= l0 + al ? l : null;
        return l + al - rl;
    }).filter(x => x != null);
    persist();
    syncBps();
}
/* ---------- gutter next to the code editor ---------- */
// Text of the code editor at the last redraw (the "old" text for shiftBps()).
let vbPrev = '';
/**
 * Redraws the line-number gutter (with breakpoint markers) and the syntax highlighting layer.
 */
function gutDraw() {
    const ta = $('#vb'),
        g = $('#vbg'),
        n = ta.value.split('\n').length,
        bp = new Set(bpOf(cur));
    let h = '';
    for (let i = 1; i <= n; i++)
        h += `<div class="gl${bp.has(i) ? ' bp' : ''}" data-l="${i}">${i}</div>`;
    g.innerHTML = h + '<div class="gpad"></div>';
    g.scrollTop = ta.scrollTop;
    vbPrev = ta.value;
    hiDraw();
}
/* syntax highlighting: a coloured copy of the code sits behind the transparent-text textarea */
function hiDraw() {
    const ta = $('#vb'),
        h = $('#vbh');
    h.innerHTML = currentLanguage().highlight(ta.value) + '\n';
    h.scrollTop = ta.scrollTop;
    h.scrollLeft = ta.scrollLeft;
}
// Keep gutter and highlight layer scrolled together with the textarea.
$('#vb').addEventListener('scroll', () => {
    const t = $('#vb');
    $('#vbg').scrollTop = t.scrollTop;
    $('#vbh').scrollTop = t.scrollTop;
    $('#vbh').scrollLeft = t.scrollLeft;
});
// Typing: move the breakpoints along with the code, then redraw the gutter.
$('#vb').addEventListener('input', () => {
    shiftBps(cur, vbPrev, $('#vb').value);
    gutDraw();
});
// Clicking a line number toggles a breakpoint; lines without an executable statement show a hint instead.
$('#vbg').addEventListener('click', e => {
    const r = e.target.closest('[data-l]');
    if (!r)
        return;
    const ok = toggleBp(cur, +r.dataset.l, $('#vb').value);
    gutDraw();
    if (!ok) {
        const p = $('#cerr');
        p.className = '';
        p.textContent = 'Line ' + r.dataset.l + ' has no statement a breakpoint can stop at (blank / comment / continuation line, or inside a callback of sort, map, forEach, ... or a method of an object or class).';
    }
});
// "Debug" button of the code window.
$('#cDbg').onclick = () => startDebug();
/* ---------- debugger window ---------- */
// State of the debugger window: D = debug context of the current run (scopes, sources, ...), state = idle | running | paused,
// stack = frames reported by the runtime, sel = selected frame, doc = document shown in the code view,
// watches = watch expressions, rid/pend = pending evaluation requests, last = values at the previous stop (to mark changes),
// msg = status text.
const DB = {
    D: null,
    state: 'idle',
    stack: [],
    sel: 0,
    doc: null,
    watches: [],
    rid: 0,
    rv: 0,
    pend: {},
    last: {},
    msg: ''
};
// The watch expressions are kept between sessions.
try {
    DB.watches = JSON.parse(localStorage.getItem('fb-watches') || '[]').filter(w => typeof w === 'string');
}
catch (e) { }
// Keywords for the syntax highlighting (JavaScript).
const KW = new Set('async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield'.split(' '));
/**
 * Syntax highlighting for JavaScript source: comments, strings (incl. template literals), numbers and keywords become <span>s.
 * Works on a whole text, so block comments and template literals can span lines.
 */
function hlAll(src) {
    const re = /(\/\*[\s\S]*?(?:\*\/|$))|(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?)|(\b\d[\w.]*)|([A-Za-z_$][\w$]*)/g;
    let o = '',
        last = 0,
        m;
    while ((m = re.exec(src))) {
        o += esc(src.slice(last, m.index));
        last = re.lastIndex;
        o += m[1] || m[2]
            ? `<span class="yc">${esc(m[0])}</span>`
            : m[3]
            ? `<span class="ys">${esc(m[3])}</span>`
            : m[4]
            ? `<span class="yn">${esc(m[4])}</span>`
            : KW.has(m[5])
            ? `<span class="yk">${esc(m[5])}</span>`
            : esc(m[5]);
    }
    return o + esc(src.slice(last));
}
/**
 * Highlighting of a single line (used by the debugger's code view).
 */
const hl = s => hlAll(s) || '&nbsp;';
/**
 * Name of a document (component) by id.
 */
const docName = id => {
    const d = docOf(id);
    return d ? d.root.name : id;
};
/**
 * Source code of a document as it was when the debug run started (else the current code).
 */
const srcOf = id => DB.D && DB.D.src[id] != null ? DB.D.src[id] : (docOf(id) ? docOf(id).root.code || '' : '');
// The iframe that runs the app being debugged.
const dframe = () => $('#dfr');
/**
 * Sends a message to the debug iframe.
 */
const dpost = m => {
    const f = dframe();
    if (f && f.contentWindow) {
        m.dbg = 1;
        f.contentWindow.postMessage(m, '*');
    }
};
/**
 * Sends the current breakpoints to the running app and refreshes the breakpoint list and the gutter.
 */
function syncBps() {
    if (DB.state !== 'idle')
        dpost({ t: 'bp', bp: bpMap() });
    if ($('#dbg').open)
        dbgBpList();
    if ($('#cd').open)
        gutDraw();
}
/**
 * Switches the debugger state (idle | running | paused): enables/disables the toolbar buttons and updates the status text.
 */
function setState(s, msg) {
    DB.state = s;
    DB.msg = msg || '';
    const p = s === 'paused',
        r = s === 'running';
    $('#dC').disabled = !p;
    $('#dI').disabled = !p;
    $('#dO').disabled = !p;
    $('#dU').disabled = !p;
    $('#dP').disabled = !r;
    $('#dS').disabled = s === 'idle';
    $('#dblk').hidden = !p;
    const t = p
        ? 'Paused' + (DB.why === 'breakpoint' ? ' at breakpoint' : DB.why === 'step' ? '' : ' (requested)')
        : r
        ? 'Running'
        : 'Stopped';
    const st = $('#dst');
    st.className = s;
    st.textContent = msg || t;
}
/**
 * Creates the sandboxed iframe that runs the app being debugged.
 */
function mkFrame(h) {
    const f = document.createElement('iframe');
    f.id = 'dfr';
    f.setAttribute('sandbox', 'allow-scripts allow-modals');
    f.srcdoc = h;
    return f;
}
/**
 * Starts a debug run: generates the page with debug hooks, fills the code view and starts the app in a fresh frame.
 * With "Break at start" checked it stops at the first statement.
 */
function startDebug() {
    const D = {
        scopes: {},
        src: {},
        bp: bpMap(),
        mode: $('#dBrk').checked ? 'into' : 'run',
        main: cur.id
    };
    let h;
    try {
        h = gen(D);
    }
    catch (x) {
        return showErr(x);
    }
    DB.D = D;
    DB.stack = [];
    DB.sel = 0;
    DB.last = {};
    DB.doc = null;
    $('#dbg').show();
    const ids = Object.keys(D.src);
    $('#ddoc').innerHTML = ids.map(i => `<option value="${i}">${esc(docName(i))}</option>`).join('');
    showDoc(D.main in D.src ? D.main : ids[0]);
    dframe().replaceWith(mkFrame(h));
    renderPanels();
    setState('running');
    if (D.mode === 'into')
        $('#dst').textContent = 'Starting…';
    // a scope whose code could not be instrumented still runs, but without breakpoints
    if (Object.values(D.scopes).some(x => !x.info.ok && (x.R.code || '').trim()))
        setState('running', 'Running - some code could not be prepared for debugging, breakpoints there are ignored');
}
/**
 * Stops the run by replacing the frame with an empty one.
 */
function stopDebug(msg) {
    const f = dframe();
    if (f)
        f.replaceWith(mkFrame(''));
    DB.stack = [];
    DB.pend = {};
    setState('idle', msg);
    markLine();
    renderPanels();
}
/**
 * Continues after a pause. mode: run | into | over | out.
 */
function resume(mode) {
    if (DB.state !== 'paused')
        return;
    setState('running');
    markLine(true);
    dpost({ t: 'resume', mode });
}
/* code view */
/**
 * Shows a document's source in the debugger's code view (line numbers, breakpoint markers).
 */
function showDoc(id) {
    DB.doc = id;
    if ($('#ddoc').value !== id)
        $('#ddoc').value = id;
    const bp = new Set(bpOf(docOf(id) || {})),
        lines = srcOf(id).split('\n');
    $('#dcode').innerHTML = lines.map((t, i) => `<div class="dl${bp.has(i + 1) ? ' bp' : ''}" data-l="${i + 1}"><i class="dn">${i + 1}</i><s class="dm"></s><span class="dt">${hl(t)}</span></div>`).join('');
    markLine();
}
/**
 * Marks the current line of the selected stack frame (the innermost frame differently from callers),
 * switching documents and scrolling the line into view if necessary.
 */
function markLine(running) {
    const c = $('#dcode');
    c.querySelectorAll('.cur,.cs').forEach(e => e.classList.remove('cur', 'cs'));
    const fr = DB.state === 'paused' && !running ? DB.stack[DB.sel] : null;
    if (!fr)
        return;
    if (fr.d !== DB.doc && docOf(fr.d))
        showDoc(fr.d);
    const row = fr.d === DB.doc && c.querySelector(`[data-l="${fr.l}"]`);
    if (!row)
        return;
    row.classList.add(DB.sel === DB.stack.length - 1 ? 'cur' : 'cs');
    const top = row.offsetTop - c.clientHeight / 2 + row.offsetHeight / 2;
    if (row.offsetTop < c.scrollTop || row.offsetTop + row.offsetHeight > c.scrollTop + c.clientHeight)
        c.scrollTop = Math.max(0, top);
}
// Document dropdown; clicking a line number in the code view toggles a breakpoint.
$('#ddoc').onchange = () => showDoc($('#ddoc').value);
$('#dcode').addEventListener('click', e => {
    const r = e.target.closest('.dm,.dn');
    if (!r)
        return;
    const row = r.parentNode,
        l = +row.dataset.l,
        d = docOf(DB.doc);
    if (!d)
        return;
    if (!toggleBp(d, l, srcOf(DB.doc))) {
        $('#dst').textContent = 'No executable statement on line ' + l;
        setTimeout(() => {
            if ($('#dst').textContent.startsWith('No exec'))
                setState(DB.state, DB.msg);
        }, 1800);
        return;
    }
    row.classList.toggle('bp', bpOf(d).includes(l));
});
/* panels */
/**
 * Renders one evaluation result as HTML: the value or the error message.
 */
const fmt = r => r.ok
    ? `<span class="v ${r.v.y}" title="${esc(r.v.s)}">${esc(r.v.s)}</span>`
    : r.ref && /before initiali[sz]ation/.test(r.e)
    ? '<span class="v empty">(not initialized)</span>'
    : `<span class="v err" title="${esc(r.e)}">${esc(r.e)}</span>`;
/**
 * Asks the runtime to evaluate JavaScript expressions in the selected frame.
 * Resolves with the results, or with "no answer" after 2.5 s.
 */
function evalFrame(js, localCount = 0) {
    const fr = DB.stack[DB.sel], sc = fr && DB.D && DB.D.scopes[fr.k];
    if (sc) js = LanguageRegistry.get(sc.R.language || 'javascript').translateWatchExpressions(js, localCount, { root: sc.R, selfId: sc.self, ids: sc.ids });
    return new Promise(res => {
        if (!js.length || DB.state !== 'paused')
            return res([]);
        const rid = ++DB.rid;
        DB.pend[rid] = res;
        dpost({ t: 'ev', rid, frame: DB.sel, js });
        setTimeout(() => {
            if (DB.pend[rid]) {
                delete DB.pend[rid];
                res(js.map(() => ({ ok: 0, e: 'no answer' })));
            }
        }, 2500);
    });
}
/**
 * The variable groups of a stack frame, nearest first: [{g: label, v: [names]}]. They come from the instrumenter's scan of the source
 * (parameters and let / const / var / function / class / catch names of the function, of the functions around it and of the top level).
 */
function frameVars(fr) {
    const sc = DB.D.scopes[fr.k],
        fns = sc && sc.info ? sc.info.fns : [],
        seen = new Set(),
        out = [];
    let i = fr.i,
        first = true;
    while (i >= 0 && fns[i]) {
        const f = fns[i],
            v = f.vars.filter(n => !seen.has(n));
        v.forEach(n => seen.add(n));
        out.push({ g: f.parent < 0 ? 'Module level' : first ? 'Locals' : 'Closure: ' + f.name, v });
        first = false;
        i = f.parent;
    }
    return out;
}
/**
 * Fills the Locals and Watches panels for the selected frame: the variables of the function, of the enclosing functions and of the top level,
 * and the watch expressions (any JavaScript expression, evaluated in the frame). Values that changed since the last stop are highlighted.
 */
async function renderVals() {
    const fr = DB.stack[DB.sel];
    if (!fr || DB.state !== 'paused' || !DB.D || !DB.D.scopes[fr.k]) {
        $('#dloc').innerHTML = '<div class="hint">Not paused.</div>';
        $('#dwv').innerHTML = watchRows([]);
        return;
    }
    const sc = DB.D.scopes[fr.k],
        rv = ++DB.rv,
        gr = frameVars(fr),
        names = gr.flatMap(x => x.v),
        rs = await evalFrame(names.concat(DB.watches), names.length);
    // a newer request (another frame selected, next stop) has taken over
    if (DB.state !== 'paused' || rv !== DB.rv)
        return;
    const prev = DB.last,
        next = {};
    let i = 0,
        h = '';
    gr.forEach(x => {
        let rows = '';
        x.v.forEach(n => {
            const r = rs[i++];
            // names of other blocks of the function that are not in scope here are left out
            if (!r || (!r.ok && r.ref && !/before initiali[sz]ation/.test(r.e)))
                return;
            const k = fr.fn + '|' + x.g + '|' + n,
                t = r.ok ? r.v.s : '!' + r.e;
            next[k] = t;
            const label = sc && sc.varLabels && sc.varLabels[n] || n;
            rows += `<div class="vr${prev[k] != null && prev[k] !== t ? ' chg' : ''}"><b>${esc(label)}</b>${fmt(r)}</div>`;
        });
        if (rows)
            h += (gr.length > 1 || x.g !== 'Locals' ? `<div class="vg">${esc(x.g)}</div>` : '') + rows;
    });
    DB.last = next;
    $('#dloc').innerHTML = h || '<div class="hint">No variables in this function yet. Declare them with let / const / var.</div>';
    $('#dwv').innerHTML = watchRows(DB.watches.map((w, j) => ({ w, r: rs[names.length + j] })));
}
/**
 * HTML rows of the watch list (with remove buttons) for the evaluation results l.
 */
function watchRows(l) {
    const m = Object.fromEntries(l.map(x => [x.w, x.r]));
    const fr = DB.stack[DB.sel], lang = fr && docOf(fr.d)?.root.language || root.language || 'javascript';
    const hint = lang === 'vb' ? 'Type a VB expression below, e.g. Count + 1 or TextBox1.Value' : 'Type a JavaScript expression below, e.g. textbox1.value or items.length * 2';
    return DB.watches.map((w, i) => `<div class="vr"><b title="${esc(w)}">${esc(w)}</b>${m[w] ? fmt(m[w]) : '<span class="v empty">-</span>'}<button class="x" data-wx="${i}" aria-label="Remove watch">×</button></div>`).join('') || `<div class="hint">${hint}</div>`;
}
/**
 * Draws the call stack, innermost frame first.
 */
function dbgStack() {
    $('#dstk').innerHTML = DB.stack.length
        ? DB.stack.map((f, i) => `<div class="vr sk${i === DB.sel ? ' on' : ''}" data-f="${i}"><b>${i === DB.stack.length - 1 ? '▶ ' : ''}${esc(f.fn)}</b><span class="v empty">${esc(docName(f.d))}:${f.l}</span></div>`).reverse().join('')
        : '<div class="hint">Not paused.</div>';
}
/**
 * Draws the breakpoint list across all components.
 */
function dbgBpList() {
    const l = docs.flatMap(d => bpOf(d).map(n => ({ d, n })));
    $('#dbpl').innerHTML = l.length ? l.map(({ d, n }) => {
        const t = (srcOf(d.id).split('\n')[n - 1] || '').trim();
        return `<div class="vr sk" data-bd="${d.id}" data-bl="${n}"><b><span class="dot"></span>${esc(d.root.name)}:${n}</b><span class="v empty">${esc(t)}</span><button class="x" data-bx="1" aria-label="Remove breakpoint">×</button></div>`;
    }).join('') : '<div class="hint">Click the gutter next to a line to set a breakpoint.</div>';
}
/**
 * Redraws stack, breakpoint list and variable panels.
 */
function renderPanels() {
    dbgStack();
    dbgBpList();
    renderVals();
}
// Click on a stack frame selects it.
$('#dstk').addEventListener('click', e => {
    const r = e.target.closest('[data-f]');
    if (!r)
        return;
    DB.sel = +r.dataset.f;
    dbgStack();
    markLine();
    renderVals();
});
// Click on a breakpoint entry: the x removes it, anything else jumps to its line.
$('#dbpl').addEventListener('click', e => {
    const r = e.target.closest('[data-bd]');
    if (!r)
        return;
    const d = docOf(r.dataset.bd),
        n = +r.dataset.bl;
    if (!d)
        return;
    if (e.target.closest('[data-bx]')) {
        const a = bpOf(d);
        a.splice(a.indexOf(n), 1);
        persist();
        syncBps();
        if (DB.doc === d.id)
            showDoc(d.id);
        return;
    }
    if (DB.D && r.dataset.bd in DB.D.src) {
        showDoc(d.id);
        const row = $('#dcode').querySelector(`[data-l="${n}"]`);
        if (row)
            $('#dcode').scrollTop = Math.max(0, row.offsetTop - $('#dcode').clientHeight / 2);
    }
});
// Watches: the x removes one, Enter in the input field adds one.
$('#dwv').addEventListener('click', e => {
    const x = e.target.closest('[data-wx]');
    if (!x)
        return;
    DB.watches.splice(+x.dataset.wx, 1);
    saveW();
    renderVals();
});
$('#dwin').addEventListener('keydown', e => {
    if (e.key !== 'Enter')
        return;
    const v = e.target.value.trim();
    if (!v)
        return;
    if (!DB.watches.includes(v))
        DB.watches.push(v);
    e.target.value = '';
    saveW();
    renderVals();
});
/**
 * Saves the watch expressions to localStorage.
 */
function saveW() {
    try {
        localStorage.setItem('fb-watches', JSON.stringify(DB.watches));
    }
    catch (e) { }
}
/* messages from the running preview */
addEventListener('message', e => {
    const f = dframe(),
        m = e.data;
    if (!f || e.source !== f.contentWindow || !m || !m.dbg)
        return;
    if (m.t === 'ready') {
        dpost({ t: 'bp', bp: bpMap() });
    }
    else if (m.t === 'paused') {
        DB.stack = m.stack;
        DB.sel = m.stack.length - 1;
        DB.why = m.why;
        DB.last = DB.last || {};
        setState('paused');
        renderPanels();
        markLine();
    }
    else if (m.t === 'idle') {
        if (DB.state === 'running')
            $('#dst').textContent = 'Running - waiting for events';
    }
    else if (m.t === 'evr') {
        const r = DB.pend[m.rid];
        if (r) {
            delete DB.pend[m.rid];
            r(m.vals);
        }
    }
    else if (m.t === 'error') {
        $('#dst').className = 'error';
        $('#dst').textContent = 'Runtime error: ' + m.msg;
    }
});
/* toolbar, keys, dragging, closing */
$('#dC').onclick = () => resume('run');
$('#dI').onclick = () => resume('into');
$('#dO').onclick = () => resume('over');
$('#dU').onclick = () => resume('out');
$('#dP').onclick = () => {
    if (DB.state === 'running') {
        dpost({ t: 'pause' });
        $('#dst').textContent = 'Will pause at the next statement - click something in the app';
    }
};
$('#dS').onclick = () => stopDebug();
$('#dR').onclick = () => {
    if ($('#dbg').open)
        startDebug();
};
// "Break at start" checkbox, remembered in localStorage.
$('#dBrk').checked = localStorage.getItem('fb-dbrk') === '1';
$('#dBrk').onchange = e => {
    try {
        localStorage.setItem('fb-dbrk', e.target.checked ? '1' : '0');
    }
    catch (x) { }
};
// "Clear all breakpoints" button.
$('#dClr').onclick = () => {
    docs.forEach(d => d.bp = []);
    persist();
    syncBps();
    if (DB.doc)
        showDoc(DB.doc);
};
// Closing the window stops the debugger.
$('#dbg').addEventListener('close', () => {
    stopDebug();
    DB.D = null;
});
// Debugger shortcuts: F5 continue (Shift+F5 stop), F10 step over, F11 step into (Shift+F11 step out).
addEventListener('keydown', e => {
    if (!$('#dbg').open || [...document.querySelectorAll('dialog[open]')].some(d => d.id !== 'dbg'))
        return;
    const k = e.key;
    let a = null;
    if (k === 'F5')
        a = e.shiftKey ? () => stopDebug() : () => resume('run');
    else if (k === 'F10')
        a = () => resume('over');
    else if (k === 'F11')
        a = e.shiftKey ? () => resume('out') : () => resume('into');
    if (a) {
        e.preventDefault();
        a();
    }
});
