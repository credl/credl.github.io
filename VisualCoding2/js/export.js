/* ---------- export ---------- */
/**
 * Generates the complete standalone HTML page for the active form.
 * D is the optional debug context (see debug.js): with it, a debug runtime is embedded, the code is instrumented (js-instrument.js)
 * and the scopes are registered with the debugger.
 * P = probe mode (used by IntelliSense, see intellisense.js): the form's own code is not included; instead the page exposes
 * window.$scope(expr), which evaluates an expression in the scope the code would run in, and window.$vars (the variable names of that scope).
 * Components still run their code, so their instances are real. Nothing throws in probe mode.
 * E = real export: the page also carries its source (see sourceTag in import.js), so it can be imported as a component later.
 * Throws {errors: [...]} if the JavaScript code of the form or one of its components has a syntax error.
 */
function gen(D, P, E) {
    // xid maps every node id to a unique, valid DOM id (derived from the control name).
    xid = new Map();
    const used = new Set();
    walk(root, n => {
        if (n === root)
            return;
        let b = (n.name || n.type).replace(/[^\w$]/g, '_');
        if (/^\d/.test(b))
            b = '_' + b;
        let s = b,
            i = 2;
        while (used.has(s))
            s = b + (i++);
        used.add(s);
        xid.set(n.id, s);
    });
    // Keeps user scripts from ending the generated <script> element early.
    const safe = c => String(c).replace(/<\/script/gi, '<\\/script');
    // js collects the page script (the code of the form and of the component instances is appended below).
    let js = '';
    // props = property definitions of the component instances, sc = the instances' code (innermost components first).
    const props = [],
        sc = [];
    let needsVB = false;
    /**
     * Wraps the JavaScript of one scope (the form or a component instance) for the page. The code itself is included unchanged:
     * it runs in a function scope where every control is a variable holding its DOM element, `form` is the form's element
     * and emit(name, detail) fires an event on it. Syntax errors are reported (with the component name prefixed) instead of exporting a broken page.
     * In debug mode the scope is registered with the debugger.
     */
    const run = (R, pre, self, nm, key, doc) => {
        const code = R.code || '',
            lang = LanguageRegistry.get(R.language || 'javascript'),
            compiled = lang.compile(code, { root: R, selfId: self, ids: idMap(R, pre || '') }),
            errs = P ? [] : compiled.errors;
        if (lang.runtimeKind === 'vb') needsVB = true;
        if (P && R !== root && compiled.errors.length) return '';
        if (errs.length) throw { errors: errs.map(e => ({ line: e.line, msg: (nm ? '[' + nm + '] ' : '') + e.msg })) };
        // Debug mode: the code is instrumented (see js-instrument.js) and the scope is registered with the debugger.
        let ins = null, debugCode = compiled.js;
        if (D) {
            const debugContext = { root: R, selfId: self, ids: idMap(R, pre || ''), key, doc };
            const prepared = lang.prepareDebug(lang.debugSource(code, compiled), debugContext);
            const adapted = lang.debugScope(prepared, debugContext);
            ins = adapted.info;
            debugCode = adapted.code;
            D.scopes[key] = { R, self, doc, ...adapted.scope };
            D.src[doc] = code;
        }
        if (!code.trim() && !(P && R === root))
            return '';
        // One variable per control (skipped for names that are not valid variable names, those stay reachable with $('name')).
        const m = idMap(R, ''),
            vars = [];
        walk(R, n => {
            const b = m.get(n.id);
            if (n !== R && okId(b))
                vars.push(`${b} = $('${pre + b}')`);
        });
        const rn = R.name,
            alias = okId(rn) && !vars.some(v => v.startsWith(rn + ' ')) ? `const ${rn} = form;\n` : '';
        if (P && R === root)
            return `(function (form) {\n${vars.length ? 'const ' + vars.join(',\n    ') + ';\n' : ''}${alias}const emit = (name, detail) => form.dispatchEvent(new CustomEvent(name, { detail }));\n` +
                `window.$vars = ${JSON.stringify(['form', 'emit', '$'].concat(vars.map(v => v.split(' ')[0]), alias ? [rn] : []))};\nwindow.$scope = function ($s) { return eval($s); };\n})($('app'));\n\n`;
        const head = `(function (form) {\n${vars.length ? 'const ' + vars.join(',\n    ') + ';\n' : ''}${alias}` +
            `const emit = (name, detail) => form.dispatchEvent(new CustomEvent(name, { detail }));\n`;
        // Debug: the code runs in an async function (its hooks await the debugger); the scopes run one after the other through the queue $q.
        if (D && lang.runtimeKind === 'vb') return `(function(){\n${safe(debugCode)}\n})();\n`; 
        if (D)
            return `$q.push(function () {\nreturn ${head}return (async function () {\nconst $f = $fe(${JSON.stringify(key)}, ${JSON.stringify(doc)}, 0, ${JSON.stringify(nm || R.name || '(main)')});\ntry {\n${safe(debugCode)}\n} finally { $fx($f); }\n}).call(form);\n})($('${self || 'app'}'));\n});\n\n`;
        return head + `(function () {\n${safe(compiled.js)}\n}).call(form);\n})($('${self || 'app'}'));\n\n`;
    };
    /**
     * For every component instance below R (recursively): emits its property values and its code.
     * Nested components come first, so an outer component can use them as soon as its own code runs.
     */
    const emit = (R, ids) => walk(R, n => {
        if (n.type !== 'comp')
            return;
        const C = docOf(n.ref);
        if (!C)
            return;
        const id = ids.get(n.id),
            cids = idMap(C.root, id + '__');
        props.push(`$props($('${id}'), ${JSON.stringify(pvOf(n, C))});\n`);
        emit(C.root, cids);
        sc.push(run(C.root, id + '__', id, C.root.name, id, C.id));
    });
    if (P && (root.props || []).length)
        props.push(`$props($('app'), ${JSON.stringify(Object.fromEntries(root.props.filter(p => /^[A-Za-z_$][\w$]*$/.test(p[0])).map(p => [p[0], p[1]])))});\n`);
    emit(root, xid);
    const top = run(root, '', null, '', 'main', cur.id);
    // Assemble the script: debugger runtime (debug only), component helpers, component code, form code (debug: queued, started by $run()).
    if (D || props.length || hasPage(usedDocs(cur)) || top || sc.some(Boolean) || needsVB)
        js = (D ? dbgRuntime(D) : '') + (needsVB ? (D ? VBRT.replace('var $q=[],$fn={};', 'var $q=window.$q||[],$fn={};') : VBRT) : '') + (hasPage(usedDocs(cur)) ? PGRT : '') + (props.length ? RT + props.join('') + '\n' : '') + sc.join('') + top + (needsVB && !D ? '$q.splice(0).forEach(function(f){f()});\n' : '') + (D ? '$run();\n' : '');
    // HTML of the form's controls (indented for readability).
    const body = root.kids.map(k => node(k, { ed: 0, own: true, d: 1, ids: xid })).join('\n  ');
    // Page template. The script end tag is written as <\/script> so it can live inside the editor's own script.
    const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(root.text || 'Form')}</title>
<style>
html,body{margin:0;height:100%;background:${esc(root.bg || '#fff')}}
body{display:flex;justify-content:center;overflow:auto}
${CSS}
${(pvVars(root) + allCss(root)).trim() ? '#app{' + pvVars(root) + allCss(root) + '}' : ''}
</style>
</head>
<body>
<div class="f" id="app" style="width:${U(root.w)};height:${U(root.h)};${root.bg ? 'background:' + esc(root.bg) + ';' : ''}${root.fg ? 'color:' + esc(root.fg) + ';' : ''}${root.fs ? 'font-size:' + (+root.fs) + 'px;' : ''}">
  ${body}
</div>
${E ? sourceTag() : ''}<script>
const $ = id => document.getElementById(id);
${js}<\/script>
</body>
</html>
`;
    // The id map is only valid during generation.
    xid = null;
    return out;
}
/**
 * Saves a file: through the host's download API when there is one (a declined save does nothing),
 * otherwise through a temporary download link.
 */
async function saveFile(name, data, mime) {
    try {
        const d = window.claude ? await claude.use('downloads') : null;
        if (d) {
            await d.save({ filename: name, data });
            return true;
        }
    }
    catch (e) {
        if (e && e.code === 'declined')
            return false;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    return true;
}
/* DOM ids for one component scope: every instance gets its own prefix, so instances never collide */
function idMap(R, pre) {
    const m = new Map(),
        u = new Set();
    walk(R, n => {
        if (n === R)
            return;
        let b = (n.name || n.type).replace(/[^\w$]/g, '_');
        if (/^\d/.test(b))
            b = '_' + b;
        let s = b,
            i = 2;
        while (u.has(s))
            s = b + (i++);
        u.add(s);
        m.set(n.id, pre + s);
    });
    return m;
}
/* initial property values of one instance: component defaults overridden by the instance's own values (names keep their case; instance values are stored lowercase) */
function pvOf(n, C) {
    const o = {};
    (C.root.props || []).forEach(p => {
        if (p[0] && /^[A-Za-z_$][\w$]*$/.test(p[0]))
            o[p[0]] = (n.pv || {})[p[0].toLowerCase()] ?? p[1];
    });
    return o;
}
