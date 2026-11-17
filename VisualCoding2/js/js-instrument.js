/* ---------- debugger instrumentation: plain JavaScript in, JavaScript with statement hooks out ----------
   The browser offers no API to pause and inspect code that the page runs itself, so a debug run executes an instrumented copy of the code:
     - before every statement a hook is inserted:      await $d($f, line, $e => eval($e));
       ($f = frame of the running function; the direct eval inside the arrow reads every variable that is visible at that statement,
        which is how locals and watch expressions are evaluated)
     - every function that contains hooks becomes `async` and its body is wrapped:   const $f = $fe(...); try { ... } finally { $fx($f) }
     - calls of such functions by their plain name are awaited:   foo(1)  ->  (await foo(1)),  so stepping over a call really waits for it
   Nothing else is changed and no line break is added or removed, so line numbers stay the same.
   This is a tokenizer plus a small statement-level state machine, not a full parser. Where the structure is unclear, the code is left alone;
   the result is syntax-checked and, if it does not parse, the run falls back to the original code without hooks.
   Known limits (all only affect where the debugger can stop, never what the program does):
     - callbacks given to sort / map / forEach / filter / ... stay synchronous (no hooks inside them), because they cannot be awaited
     - object-literal / class methods, generators and getters stay synchronous
     - braceless bodies (`if (x) y();`) are covered by the hook of the `if` line
   The tokenizer is also used by validLines() (debug.js) to tell which lines accept a breakpoint. */
/**
 * Splits JavaScript source into tokens {k, v, s, e, l, nl}: kind (w = word, num, str, tpl* = template pieces, rx = regular expression, p = punctuator),
 * text, start / end offset, line of the start (1-based) and whether a line break came before it.
 * Template literals are split at their ${ } holes: tpl (whole), tplS (up to the first ${), tplM (} ... ${) and tplE (} ... closing quote).
 */
function jsTokens(src) {
    const T = [],
        n = src.length,
        st = [], // open braces: 'b' = normal brace, 't' = template hole
        PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**'],
        KWRX = /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
    let i = 0,
        line = 1,
        nl = false;
    // True if a "/" at this point starts a regular expression (and not a division).
    const rxOK = () => {
        const p = T[T.length - 1];
        if (!p)
            return true;
        if (p.k === 'w')
            return KWRX.test(p.v);
        if (p.k === 'p')
            return !(p.v === ')' || p.v === ']' || p.v === '}');
        return false;
    };
    const add = (k, s, e) => {
        T.push({ k, v: src.slice(s, e), s, e, l: line, nl });
        nl = false;
    };
    // Reads template text from j up to the closing quote or the next ${; returns the new position.
    const tpl = (j, first) => {
        const s0 = j - 1, // includes the opening ` or the closing }
            l0 = line;
        while (j < n) {
            const c = src[j];
            if (c === '\\') {
                if (src[j + 1] === '\n')
                    line++;
                j += 2;
                continue;
            }
            if (c === '\n')
                line++;
            if (c === '`') {
                T.push({ k: first ? 'tpl' : 'tplE', v: src.slice(s0, j + 1), s: s0, e: j + 1, l: l0, nl });
                nl = false;
                return j + 1;
            }
            if (c === '$' && src[j + 1] === '{') {
                T.push({ k: first ? 'tplS' : 'tplM', v: src.slice(s0, j + 2), s: s0, e: j + 2, l: l0, nl });
                nl = false;
                st.push('t');
                return j + 2;
            }
            j++;
        }
        T.push({ k: first ? 'tpl' : 'tplE', v: src.slice(s0), s: s0, e: n, l: l0, nl });
        return n;
    };
    while (i < n) {
        const c = src[i];
        if (c === '\n') {
            line++;
            nl = true;
            i++;
        }
        else if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === '\u00a0' || c === '\ufeff' || c === '\u2028' || c === '\u2029')
            i++;
        else if (c === '/' && src[i + 1] === '/') {
            while (i < n && src[i] !== '\n')
                i++;
        }
        else if (c === '/' && src[i + 1] === '*') {
            let j = src.indexOf('*/', i + 2);
            j = j < 0 ? n : j + 2;
            for (let k = i; k < j; k++)
                if (src[k] === '\n') {
                    line++;
                    nl = true;
                }
            i = j;
        }
        else if (c === '"' || c === "'") {
            let j = i + 1;
            const l0 = line;
            while (j < n && src[j] !== c && src[j] !== '\n') {
                if (src[j] === '\\') {
                    if (src[j + 1] === '\n')
                        line++;
                    j++;
                }
                j++;
            }
            if (src[j] === c)
                j++;
            T.push({ k: 'str', v: src.slice(i, j), s: i, e: j, l: l0, nl });
            nl = false;
            i = j;
        }
        else if (c === '`') {
            i = tpl(i + 1, true);
        }
        else if (c === '}' && st[st.length - 1] === 't') {
            st.pop();
            i = tpl(i + 1, false);
        }
        else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
            const m = /^(?:0[xXbBoO][\da-fA-F_]+n?|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?n?|\d[\d_]*\.)/.exec(src.slice(i, i + 80));
            const len = m ? m[0].length : 1;
            add('num', i, i + len);
            i += len;
        }
        else if (/[A-Za-z_$#\u0080-\uffff]/.test(c)) {
            let j = i + 1;
            while (j < n && /[\w$\u0080-\uffff]/.test(src[j]))
                j++;
            add('w', i, j);
            i = j;
        }
        else if (c === '/' && rxOK()) {
            let j = i + 1,
                cls = false;
            while (j < n && src[j] !== '\n') {
                if (src[j] === '\\')
                    j++;
                else if (src[j] === '[')
                    cls = true;
                else if (src[j] === ']')
                    cls = false;
                else if (src[j] === '/' && !cls)
                    break;
                j++;
            }
            j++;
            while (j < n && /[a-z]/i.test(src[j]))
                j++;
            add('rx', i, j);
            i = j;
        }
        else {
            const p = PUNCT.find(x => src.startsWith(x, i)) || c;
            if (p === '{')
                st.push('b');
            else if (p === '}')
                st.pop();
            add('p', i, i + p.length);
            i += p.length;
        }
    }
    return T;
}
/* callees whose callback arguments may become async functions (their return value is not used) */
const ASYNC_CB = new Set(['addEventListener', 'removeEventListener', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'queueMicrotask', 'then', 'catch', 'finally', 'Promise', 'requestIdleCallback']);
/* methods that call their callback synchronously and use its result: those callbacks (and functions passed by name) must stay synchronous */
const SYNC_CB = new Set(['sort', 'toSorted', 'map', 'filter', 'forEach', 'reduce', 'reduceRight', 'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'flatMap', 'replace', 'replaceAll', 'from', 'matchAll']);
/* words that start a control statement whose "(...)" is followed by a statement */
const CTRL = new Set(['if', 'for', 'while', 'with', 'switch', 'catch']);
/**
 * Instruments JavaScript source for the debugger (see the comment at the top of this file).
 * o = {key, doc}: scope key and document id that the frames report.
 * Returns {code, lines, fns, ok}: the instrumented code, the lines that accept a breakpoint, a list of the functions {name, vars, parent}
 * (index 0 = the top level of the source) and ok = false when instrumentation had to be skipped (the code is returned unchanged).
 */
function instrument(code, o) {
    o = o || {};
    const plain = { code, lines: [], fns: [{ name: '(main)', vars: [], parent: -1 }], ok: false };
    let r;
    try {
        const T = jsTokens(code),
            pass1 = scanJS(code, T, o, null);
        r = scanJS(code, T, o, pass1.names);
        // The result must still parse as the body of an async function.
        const AF = Object.getPrototypeOf(async function () { }).constructor;
        new AF('$fe', '$fx', '$d', 'form', 'emit', 'const $f=1;try{\n' + r.code + '\n}finally{}');
        r.ok = true;
    }
    catch (e) {
        return plain;
    }
    return r;
}
/**
 * One instrumentation pass. `names` = names of the functions that became async in an earlier pass (null in the first pass):
 * only then calls are wrapped in (await ...).
 */
function scanJS(code, T, o, names) {
    const ins = [], // insertions: {at, text, n}
        lines = new Set(),
        fns = [{ name: '(main)', vars: [], parent: -1, async: true, hooked: new Set() }],
        asyncNames = new Set(),
        syncNames = new Set(),
        braces = [{ kind: 'fn', fn: 0, pd: 0, depth: 0 }],
        parens = [],
        fnStack = [0],
        arrows = [], // expression-bodied arrow functions that are still open: {depth}
        tern = {}, // open "?" per nesting depth
        KEY = JSON.stringify(o.key || 'x'),
        DOC = JSON.stringify(o.doc || 'x');
    let stmt = true, // a statement starts at this token
        depth = 0, // nesting of ( [ { ${
        pend = null, // function whose parameter list or body comes next: {idx, async, decl, gen}
        afterParams = null, // function whose parameter list just closed
        lastParen = null, // paren record closed last
        classHdr = false,
        caseAt = -1, // depth of an open case/default label
        lastColonTern = false,
        seq = 0;
    const add = (at, text) => ins.push({ at, text, n: seq++ });
    const cur = () => fns[fnStack[fnStack.length - 1]];
    const nx = (i, d = 1) => T[i + d];
    // Names the code passes to sort/map/... directly: such functions must stay synchronous.
    T.forEach((t, i) => {
        if (t.k === 'w' && SYNC_CB.has(t.v) && nx(i) && nx(i).v === '(') {
            let j = i + 2,
                d = 0;
            for (; j < T.length; j++) {
                const v = T[j].v;
                if (T[j].k !== 'p' && T[j].k !== 'w')
                    continue;
                if ('([{'.includes(v) && v.length === 1)
                    d++;
                else if (')]}'.includes(v) && v.length === 1) {
                    if (--d < 0)
                        break;
                }
                else if (d === 0 && T[j].k === 'w' && T[j - 1] && (T[j - 1].v === '(' || T[j - 1].v === ',') && nx(j) && (nx(j).v === ',' || nx(j).v === ')'))
                    syncNames.add(v);
            }
        }
    });
    // Binding names in a parameter / declaration list between token indices a and b (exclusive).
    const bindNames = (a, b, into) => {
        for (let j = a; j < b; j++) {
            const t = T[j],
                p = T[j - 1],
                q = T[j + 1];
            if (t.k !== 'w' || !/^[A-Za-z_$]/.test(t.v) || /^(?:true|false|null|undefined|this|new|typeof|void)$/.test(t.v))
                continue;
            if (p && p.k === 'p' && /^(?:\(|,|\{|\[|:|\.\.\.)$/.test(p.v) && q && q.k === 'p' && /^(?:,|\)|=|\}|\])$/.test(q.v) && !(p.v === ':' && false))
                if (!into.includes(t.v))
                    into.push(t.v);
        }
    };
    const addVar = (fnIdx, v) => {
        if (fnIdx >= 0 && !fns[fnIdx].vars.includes(v))
            fns[fnIdx].vars.push(v);
    };
    // Starts a new function record (async only if allowed) and returns its index.
    const newFn = (name, asyn) => {
        fns.push({ name: name || '(anonymous)', vars: [], parent: fnStack[fnStack.length - 1], async: asyn, hooked: new Set() });
        return fns.length - 1;
    };
    // Is a function expression at this position allowed to be async (is its result not used by a native caller)?
    // before = index of the token in front of the function / its parameters.
    const cbOK = before => {
        const p = T[before];
        if (!p)
            return false;
        if (p.v === '=')
            return true;
        if ((p.v === '(' || p.v === ',') && parens.length) {
            const pr = parens[parens.length - 1];
            return !!pr.call && ASYNC_CB.has(pr.call) && (p.v === ',' || pr.open === before);
        }
        return false;
    };
    // Name shown in the call stack for a function expression at `before`.
    const nameFor = before => {
        const p = T[before];
        if (!p)
            return '';
        if (p.v === '=') {
            let j = before - 1,
                s = '';
            while (j >= 0 && ((T[j].k === 'w' && !/^(?:const|let|var)$/.test(T[j].v)) || T[j].v === '.') && s.length < 60) {
                s = T[j].v + s;
                j--;
            }
            return s;
        }
        if ((p.v === '(' || p.v === ',') && parens.length) {
            const pr = parens[parens.length - 1],
                a = T[pr.open + 1],
                f = T[pr.open - 3],
                dot = T[pr.open - 2];
            if (pr.call === 'addEventListener' && a && a.k === 'str')
                return (f && dot && dot.v === '.' && f.k === 'w' ? f.v + ' ' : '') + a.v.slice(1, -1);
            return pr.call ? pr.call + ' callback' : '';
        }
        return '';
    };
    for (let i = 0; i < T.length; i++) {
        const t = T[i],
            p = T[i - 1],
            wasStmt = stmt,
            top = braces[braces.length - 1],
            f = cur();
        stmt = false;
        const here = parens.length === top.pd; // not inside parentheses opened after the current brace
        /* ---- statement hook ---- */
        if (wasStmt && f.async && here && (top.kind === 'fn' || top.kind === 'blk' || top.kind === 'sw') && t.k !== 'tplE' && t.k !== 'tplM') {
            const v = t.v,
                skip = (t.k === 'p' && (v === '}' || v === ';' || v === ')' || v === ']' || v === ',')) ||
                    (t.k === 'w' && (v === 'else' || v === 'catch' || v === 'finally' || v === 'function' || v === 'class' || v === 'case' || v === 'default' ||
                        (v === 'async' && nx(i) && nx(i).v === 'function') || (v === 'while' && top.doWhile)));
            if (!skip && !f.hooked.has(t.l)) {
                f.hooked.add(t.l);
                lines.add(t.l);
                add(t.s, `await $d($f,${t.l},$e=>eval($e)${v === 'debugger' ? ',1' : ''});`);
            }
        }
        /* ---- calls of async functions: wrap in (await ...) ---- */
        if (t.k === 'w' && names && f.async && nx(i) && nx(i).v === '(' && names.has(t.v) && !syncNames.has(t.v) && !/^(?:function|if|for|while|switch|catch|return|typeof|new|super|import)$/.test(t.v)) {
            const pv = p ? p.v : '',
                meth = (top.kind === 'obj' || top.kind === 'cls') && here && (/^(?:\{|,|;|\}|static|async|get|set|\*)$/.test(pv) || (top.kind === 'cls' && t.nl));
            if (!/^(?:\.|\?\.|function|new|class|#)$/.test(pv) && !meth)
                t.wrap = true;
        }
        /* ---- structure ---- */
        if (t.k === 'tplS') {
            depth++;
            braces.push({ kind: 'tpl', pd: parens.length, depth });
            continue;
        }
        if (t.k === 'tplE') {
            braces.pop();
            depth--;
            continue;
        }
        if (t.k === 'tplM')
            continue;
        if (t.k === 'w') {
            const v = t.v;
            if (v === 'function') {
                const asy = p && p.v === 'async',
                    gen = nx(i) && nx(i).v === '*',
                    before = asy ? i - 2 : i - 1,
                    decl = wasStmt || (asy && !!p.wasStmt),
                    nm = nx(i, gen ? 2 : 1),
                    name = nm && nm.k === 'w' && nm.v !== '(' ? nm.v : '';
                let ok = !gen && (decl || cbOK(before));
                if (name && syncNames.has(name))
                    ok = false;
                if (!name && !decl && syncNames.size && T[before] && T[before].v === '=' && T[before - 1] && syncNames.has(T[before - 1].v))
                    ok = false;
                const idx = newFn(name || nameFor(before), ok || asy);
                pend = { idx, decl, gen, asy, ok };
                if (decl && name)
                    addVar(fnStack[fnStack.length - 1], name);
                if (ok && !asy)
                    add(t.s, 'async ');
                const nme = name || (T[before] && T[before].v === '=' && T[before - 1] && T[before - 1].k === 'w' && !(T[before - 2] && T[before - 2].v === '.') ? T[before - 1].v : '');
                if ((ok || asy) && nme && !syncNames.has(nme))
                    asyncNames.add(nme);
            }
            else if (v === 'class') {
                classHdr = true;
                const nm = nx(i);
                if (wasStmt && nm && nm.k === 'w' && nm.v !== 'extends')
                    addVar(fnStack[fnStack.length - 1], nm.v);
                braces.clsDecl = wasStmt;
            }
            else if (v === 'let' || v === 'const' || v === 'var') {
                // find the end of the declaration list
                let j = i + 1,
                    d = 0;
                for (; j < T.length; j++) {
                    const u = T[j];
                    if (u.k === 'p' && (u.v === '(' || u.v === '[' || u.v === '{'))
                        d++;
                    else if (u.k === 'tplS')
                        d++;
                    else if (u.k === 'tplE')
                        d--;
                    else if (u.k === 'p' && (u.v === ')' || u.v === ']' || u.v === '}')) {
                        if (--d < 0)
                            break;
                    }
                    else if (d === 0 && (u.v === ';' || (u.k === 'w' && (u.v === 'of' || u.v === 'in') && T[j - 1] && T[j - 1].v !== ',')))
                        break;
                    else if (d === 0 && j > i + 1 && u.nl && !(T[j - 1].k === 'p' && /^(?:,|=|\+|-|\*|\/|&&|\|\||\?|:|\?\?|\(|\[|\{)$/.test(T[j - 1].v)) && !(u.k === 'p' && /^(?:\+|-|\*|\/|&&|\|\||\?|:|\.|\?\.|\?\?|,)$/.test(u.v)))
                        break;
                }
                const vars = [];
                // bindings: first one right after the keyword and each one after a top-level comma
                let d2 = 0;
                for (let k = i + 1; k < j; k++) {
                    const u = T[k];
                    if (u.k === 'p' && (u.v === '(' || u.v === '[' || u.v === '{'))
                        d2++;
                    else if (u.k === 'p' && (u.v === ')' || u.v === ']' || u.v === '}'))
                        d2--;
                    if (d2 === 0 && (k === i + 1 || (T[k - 1].v === ',' && T[k - 1].k === 'p'))) {
                        if (u.k === 'w')
                            vars.push(u.v);
                        else if (u.v === '[' || u.v === '{') {
                            let e = k,
                                dd = 0;
                            for (; e < j; e++) {
                                if (T[e].v === '[' || T[e].v === '{')
                                    dd++;
                                else if (T[e].v === ']' || T[e].v === '}') {
                                    if (--dd === 0)
                                        break;
                                }
                            }
                            bindNames(k + 1, e + 1, vars);
                        }
                    }
                }
                // function names bound by "name = function / arrow" are handled where the function starts
                vars.forEach(x => addVar(fnStack[fnStack.length - 1], x));
            }
            else if (v === 'case' || v === 'default') {
                if (top.kind === 'sw' && here)
                    caseAt = depth;
            }
            else if (v === 'do')
                top.nextDo = true;
            if (t.wrap)
                add(t.s, '(await ');
            // keep the "statement started before async" fact for `async function`
            if (v === 'async')
                t.wasStmt = wasStmt;
            continue;
        }
        if (t.k !== 'p')
            continue;
        const v = t.v;
        if (v === '(') {
            const pw = p && p.k === 'w' ? p : null,
                rec = { open: i, call: pw && !CTRL.has(pw.v) && !/^(?:function|return|typeof|void|new|in|of|await|yield|case|delete|throw|else|do)$/.test(pw.v) ? pw.v : null, kw: pw && CTRL.has(pw.v) ? pw.v : '', close: pw && pw.wrap ? ')' : '', depth };
            if (pend && !pend.params) {
                pend.params = 1;
                rec.fn = pend;
            }
            else if (pw && (top.kind === 'obj' || top.kind === 'cls') && here && !rec.kw && /^(?:\{|,|;|\}|static|async|get|set|\*)$/.test(T[i - 2] ? T[i - 2].v : '{')) {
                // method of an object literal / class: synchronous function
                const idx = newFn(pw.v, false);
                pend = { idx, decl: false, gen: false, asy: false, ok: false, params: 1 };
                rec.fn = pend;
                rec.call = null;
            }
            parens.push(rec);
            depth++;
            continue;
        }
        if (v === ')') {
            const rec = parens.pop();
            depth--;
            delete tern[depth + 1];
            lastParen = rec || null;
            afterParams = null;
            if (rec) {
                if (rec.close)
                    add(t.e, rec.close);
                if (rec.fn) {
                    bindNames(rec.open, i + 1, fns[rec.fn.idx].vars);
                    afterParams = rec.fn;
                }
                else if (rec.kw === 'catch')
                    bindNames(rec.open, i + 1, fns[fnStack[fnStack.length - 1]].vars);
            }
            // arrows with expression bodies that end here
            while (arrows.length && arrows[arrows.length - 1].depth > depth)
                { arrows.pop(); fnStack.pop(); }
            continue;
        }
        if (v === '[') {
            depth++;
            continue;
        }
        if (v === ']') {
            depth--;
            delete tern[depth + 1];
            while (arrows.length && arrows[arrows.length - 1].depth > depth)
                { arrows.pop(); fnStack.pop(); }
            continue;
        }
        if (v === '=>') {
            // parameters: a parenthesised list (lastParen) or a single identifier
            let ps = i - 1,
                pnames = [];
            if (p && p.v === ')' && lastParen) {
                ps = lastParen.open;
                bindNames(lastParen.open, i, pnames);
            }
            else if (p && p.k === 'w')
                pnames = [p.v];
            const before = ps - 1,
                asy = T[before] && T[before].v === 'async',
                body = nx(i),
                blk = body && body.v === '{',
                nm = nameFor(asy ? before - 1 : before);
            let ok = cbOK(asy ? before - 1 : before);
            const nmv = T[(asy ? before - 1 : before)] && T[(asy ? before - 1 : before)].v === '=' ? (T[(asy ? before - 2 : before - 1)] || {}).v : '';
            if (nmv && syncNames.has(nmv))
                ok = false;
            const idx = newFn(nm, ok || asy);
            pnames.forEach(x => addVar(idx, x));
            if (ok && !asy)
                add(T[ps].s, 'async ');
            if ((ok || asy) && nmv && /^[A-Za-z_$][\w$]*$/.test(nmv) && !(T[(asy ? before - 3 : before - 2)] && T[(asy ? before - 3 : before - 2)].v === '.') && !syncNames.has(nmv))
                asyncNames.add(nmv);
            if (blk)
                pend = { idx, decl: false, gen: false, asy: true, ok: ok || asy, params: 1, arrow: true };
            else {
                // expression body: lives until the enclosing , ; ) ] } at this depth
                fnStack.push(idx);
                arrows.push({ depth: depth, idx });
            }
            afterParams = blk ? pend : null;
            lastParen = null;
            continue;
        }
        if (v === '{') {
            let kind;
            const fnBody = (afterParams && p && (p.v === ')' || (p.v === '=>'))) || (pend && pend.arrow && p && p.v === '=>');
            const fp = pend && pend.arrow && p && p.v === '=>' ? pend : afterParams;
            if (fnBody && fp) {
                kind = 'fn';
                const fr = fns[fp.idx];
                fnStack.push(fp.idx);
                braces.push({ kind, fn: fp.idx, pd: parens.length, depth: depth + 1, decl: fp.decl });
                depth++;
                if (fr.async) {
                    add(t.e, `const $f=$fe(${KEY},${DOC},${fp.idx},${JSON.stringify(fr.name)});try{`);
                    t.fnHead = true;
                }
                pend = null;
                afterParams = null;
                stmt = true;
                continue;
            }
            const pk = p && p.k === 'w' ? p.v : '';
            if (classHdr && (p && (p.k === 'w' || p.v === ')'))) {
                kind = 'cls';
                classHdr = false;
            }
            else if (p && p.v === ')' && lastParen && lastParen.kw === 'switch')
                kind = 'sw';
            else if (p && p.v === ')' && lastParen && !lastParen.fn)
                kind = 'blk';
            else if (/^(?:else|try|finally|do)$/.test(pk))
                kind = 'blk';
            else if (wasStmt)
                kind = 'blk';
            else if (p && p.v === ':' && !lastColonTern && (top.kind === 'sw' || top.kind === 'blk' || top.kind === 'fn'))
                kind = 'blk';
            else
                kind = 'obj';
            braces.push({ kind, pd: parens.length, depth: depth + 1, doWhile: false, isDo: pk === 'do', cdecl: kind === 'cls' ? braces.clsDecl : false });
            depth++;
            if (kind === 'blk' || kind === 'fn')
                stmt = true;
            // method of an object literal / class: its body is a synchronous function
            if (kind === 'blk' && false)
                stmt = true;
            continue;
        }
        if (v === '}') {
            const b = braces.length > 1 ? braces.pop() : top;
            depth--;
            delete tern[depth + 1];
            if (b.kind === 'fn') {
                const fr = fns[b.fn];
                if (fr.async)
                    add(t.s, '}finally{$fx($f)}');
                fnStack.pop();
                stmt = !!b.decl;
            }
            else if (b.kind === 'blk')
                stmt = !b.isDo;
            else if (b.kind === 'sw')
                stmt = true;
            else if (b.kind === 'cls')
                stmt = !!b.cdecl;
            // a do { } while (...) : the "while" must not get a hook
            if (b.kind === 'blk' && b.isDo) {
                const nb = braces[braces.length - 1];
                nb.doWhile = true;
            }
            else if (stmt) {
                const nb = braces[braces.length - 1];
                if (nb)
                    nb.doWhile = false;
            }
            while (arrows.length && arrows[arrows.length - 1].depth > depth)
                { arrows.pop(); fnStack.pop(); }
            continue;
        }
        if (v === ';') {
            if (parens.length === top.pd) {
                stmt = true;
                while (arrows.length && arrows[arrows.length - 1].depth >= depth)
                    { fnStack.pop(); arrows.pop(); }
                top.doWhile = false;
            }
            continue;
        }
        if (v === ',') {
            while (arrows.length && arrows[arrows.length - 1].depth >= depth)
                { fnStack.pop(); arrows.pop(); }
            continue;
        }
        if (v === '?') {
            tern[depth] = (tern[depth] || 0) + 1;
            continue;
        }
        if (v === ':') {
            if (tern[depth] > 0) {
                tern[depth]--;
                lastColonTern = true;
            }
            else {
                lastColonTern = false;
                if (caseAt === depth && top.kind === 'sw') {
                    caseAt = -1;
                    stmt = true;
                }
            }
            continue;
        }
    }
    // Only `ins` is needed from here: apply the insertions.
    let out = '',
        last = 0;
    ins.sort((a, b) => a.at - b.at || a.n - b.n);
    ins.forEach(x => {
        out += code.slice(last, x.at) + x.text;
        last = x.at;
    });
    out += code.slice(last);
    return {
        code: out,
        lines: [...lines].sort((a, b) => a - b),
        fns: fns.map(f => ({ name: f.name, vars: f.vars, parent: f.parent })),
        names: asyncNames
    };
}
