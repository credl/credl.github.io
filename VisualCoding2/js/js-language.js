/* ---------- event handler code: plain JavaScript ----------
   Every form / component has one JavaScript source (root.code). It is NOT translated: the export embeds it as written.
   Each source runs in its own function scope in which
     - every control is a variable named like the control (button1, textbox1, ...), holding the real DOM element,
     - `form` is the form's element (for a component: the element of the component instance),
     - emit(name, detail) fires a DOM CustomEvent on `form` (used by components to raise events).
   Event handlers are ordinary addEventListener calls. */

/**
 * Small runtime for component instances, embedded into exported pages that contain component instances.
 * $props(el, values) turns the component's declared properties into real properties of the instance element:
 * reading gives the (number/boolean-converted) value, writing stores it and fires a "propchange" event ({name, value}) on the element.
 * (It is string content and must stay as it is: the exported page runs it as written.)
 */
const RT = `function $props(el,v){Object.keys(v).forEach(function(k){var x=$conv(v[k]),l=k.toLowerCase();function d(nm){Object.defineProperty(el,nm,{enumerable:nm===k,configurable:true,get:function(){return x},set:function(n){x=$conv(n);${window.FB&&FB.propVars===false?'':"el.style.setProperty('--prop-'+l,x);"}if(window.$pv&&window.$pv[el.id])window.$pv[el.id][l]=x;el.dispatchEvent(new CustomEvent('propchange',{detail:{name:k,value:x}}));var w=window.$pw&&window.$pw[el.id+'.'+l];if(w)Promise.resolve(w()).catch(function(e){console.error(e)})}})}d(k);if(l!==k)d(l)})}
function $conv(v){if(typeof v!=='string')return v;return v.trim()!==''&&!isNaN(v)?+v:v==='true'?true:v==='false'?false:v}
`;
/**
 * JavaScript words that cannot be used as a variable name (such controls are still reachable through $('name')),
 * plus the names the scope itself defines.
 */
const JSRES = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await arguments eval undefined NaN Infinity form emit'.split(' '));
/**
 * True if s can be declared as a variable.
 */
const okId = s => /^[A-Za-z_$][\w$]*$/.test(s) && !JSRES.has(s);
/**
 * Variable names of the controls of one form/component: node id -> name (same naming rules as the export, without any prefix).
 */
const ids = () => idMap(root, '');
/**
 * How the code refers to a control: its variable if it has one, otherwise $('name').
 */
const refOf = (n, m) => {
    const b = m.get(n.id);
    return b && okId(b) ? b : `$('${b}')`;
};
/**
 * DOM events a control offers in the code window's event dropdown (names as used with addEventListener).
 * The form offers the page events (load = window, keydown / keyup = document); a component instance offers the events its component emits.
 */
const inputT = ['textbox', 'textarea', 'select', 'slider'];
const evList = n => {
    if (n.type === 'form')
        return ['load', 'keydown', 'keyup'];
    if (n.type === 'comp')
        return compInfo(n).ev;
    const r = ['click', 'dblclick'];
    if (n.type === 'canvas')
        r.push('pointerdown', 'pointermove', 'pointerup');
    if (inputT.includes(n.type))
        r.push('input');
    if (inputT.includes(n.type) || ['checkbox', 'radio'].includes(n.type))
        r.push('change');
    if (inputT.includes(n.type) || ['button', 'checkbox', 'radio'].includes(n.type))
        r.push('focus', 'blur', 'keydown', 'keyup');
    return r;
};
/**
 * Default event of a control: load for the form, input / change for input controls, otherwise click.
 */
const defEv = n => n.type === 'form'
    ? 'load'
    : n.type === 'comp'
    ? (evList(n)[0] || 'click')
    : n.type === 'select'
    ? 'change'
    : inputT.includes(n.type)
    ? 'input'
    : 'click';
/**
 * The listener skeleton the code window inserts for an object + event:
 * {head: text to search for to find an existing listener (regex source), text: the new listener}.
 */
function stubOf(n, ev) {
    const t = n.type === 'form' ? (ev === 'load' ? 'window' : 'document') : refOf(n, ids()),
        re = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
        re: '(?<![\\w$.])' + re(t) + '\\s*\\.\\s*addEventListener\\(\\s*([\'"`])' + re(ev) + '\\1',
        text: `${t}.addEventListener('${ev}', function (event) {\n    \n});\n`
    };
}
/**
 * Checks the syntax of a source without running it. Returns [{line, msg}] (empty = no errors).
 * The code is put into a throw-away <script> as the body of a function that is never called, so the browser parses it
 * and reports the exact line of a syntax error. If scripts cannot be added (content security policy), the Function constructor
 * still tells whether the code is valid (without a line).
 */
function checkJS(code) {
    let err = null;
    const on = e => {
        err = err || e;
        e.preventDefault();
    };
    window.addEventListener('error', on);
    const s = document.createElement('script');
    s.text = 'window.$chk=1;(function (form, emit) {\n' + code + '\n});';
    window.$chk = 0;
    try {
        document.head.appendChild(s);
    }
    catch (x) { }
    s.remove();
    window.removeEventListener('error', on);
    const ran = window.$chk;
    delete window.$chk;
    const n = code.split(/\r?\n/).length;
    if (err)
        return [{ line: Math.min(Math.max(err.lineno - 1, 1), n), msg: String(err.message).replace(/^(?:Uncaught\s+)?(?:SyntaxError:\s*)?(?:Failed to execute [^:]*:\s*)?/, '') }];
    if (ran)
        return [];
    try {
        new Function('form', 'emit', code);
    }
    catch (e) {
        if (e instanceof SyntaxError)
            return [{ line: n, msg: e.message }];
    }
    return [];
}
/**
 * Moves old VB-style code (from projects saved before JavaScript handlers) out of the way: it is kept as a comment, so nothing is lost
 * and the page still has valid JavaScript. Roots get js = 1 once they hold JavaScript.
 */
function legacyCode(r) {
    // Old JS projects carry js:1; the original VB project format did not.
    if (!r.language) r.language = r.js === 1 ? 'javascript' : 'vb';
    delete r.js;
}


/* ---------- JavaScript language service ---------- */
const JS_HINT = `Plain JavaScript - exported as written. Controls are DOM elements named after the controls. Use addEventListener for events. Debugging supports breakpoints, stepping, locals and watches.`;
const JS_PLACEHOLDER = `button1.addEventListener('click', function (event) {\n    label1.textContent = 'Hello, ' + textbox1.value;\n});`;
class JavaScriptLanguage extends LanguageService {
    constructor() { super('javascript', 'JavaScript'); this.intellisenseProvider = 'javascript-reflection'; this.debuggerKind = 'javascript'; this.runtimeKind = null; }
    getHint() { return JS_HINT; }
    getPlaceholder() { return JS_PLACEHOLDER; }
    events(node) { return evList(node); }
    defaultEvent(node) { return defEv(node); }
    createEventStub(node, event) { return stubOf(node, event).text; }
    findEventStub(source, node, event) { return new RegExp(stubOf(node, event).re).exec(source); }
    componentInterface(source, props = []) {
        const f = re => [...new Set([...String(source).matchAll(re)].map(m => m[1]))];
        return { ev: f(/\bemit\s*\(\s*['"`]([\w$-]+)['"`]/g), pub: f(/(?<![\w$.])form\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g).filter(x => !props.includes(x)), props };
    }
    validate(source) { return checkJS(source); }
    compile(source) { return { js: source, errors: checkJS(source) }; }
    highlight(source) { return hlAll(source) || '&nbsp;'; }
    prepareDebug(source, context) { const info = instrument(source, context); return { code: info.code, info }; }
    debugScope(prepared) { return { code: prepared.code, info: prepared.info, scope: { info: prepared.info } }; }
    breakableLines(source, context) { return instrument(source, context).lines; }
}

LanguageRegistry.register(new JavaScriptLanguage());
