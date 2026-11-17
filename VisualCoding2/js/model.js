/* ---------- model: project = docs (components); `root` is the active doc's root ---------- */
// Ids of tree nodes that are folded (collapsed) in the UI tree.
const fold = new Set();
// Editor state:
// uid/docN = counters for node and document ids, docs = all open documents (components, shown as tabs),
// cur = active document, root = its root node, idx = id -> {node, parent} lookup,
// sel = selected ids (last one = primary), clip/clipSrc/clipCut/pasteN = clipboard bookkeeping,
// armed = toolbox type waiting to be placed, snapOn = snap to grid,
// undo/redo = history stacks, lastP = time of the last coalesced undo step,
// xid = node id -> export name (only set while exporting).
let uid = 0,
    docs = [],
    cur = null,
    docN = 0,
    root,
    idx = new Map(),
    sel = ['root'],
    clip = [],
    clipSrc = [],
    clipCut = 0,
    pasteN = {},
    armed = null,
    snapOn = true,
    undo = [],
    redo = [],
    lastP = 0,
    xid = null;
/**
 * Creates a new unique node id.
 */
const newId = () => 'n' + (++uid);
/**
 * True if the node can contain children (the form itself or a container control such as Panel/GroupBox).
 */
const isC = n => n.type === 'form' || !!T[n.type].c;
/**
 * Depth-first walk: calls f for the node and then for all its descendants.
 */
const walk = (n, f) => {
    f(n);
    n.kids.forEach(k => walk(k, f));
};
/**
 * True if node b is somewhere below node a.
 */
const contains = (a, b) => a.kids.some(k => k === b || contains(k, b));
/**
 * Looks up a node by id.
 */
const G = id => idx.get(id)?.n;
/**
 * The primary selection (the last selected node), or the root if nothing is selected.
 */
const P = () => G(sel[sel.length - 1]) || root;
/**
 * Rebuilds the id -> {node, parent} lookup for the active document.
 */
function reindex() {
    idx.clear();
    (function w(n, p) {
        idx.set(n.id, { n, p });
        n.kids.forEach(k => w(k, n));
    })(root, null);
}
/* geometry comes from the DOM so nodes inside component containers work too */
/**
 * DOM element of a node on the canvas (the form element for the root).
 */
const nEl = n => n === root ? $('#form') : $('#form').querySelector(`[data-id="${n.id}"]:not([data-slot])`);
/**
 * DOM element that receives children of a node: the slot element of a component instance if a slot name is given, else the node's own element.
 */
const cEl = (n, s) => s
    ? $('#form').querySelector(`[data-id="${n.id}"][data-slot="${window.CSS.escape(s)}"]`)
    : nEl(n);
/**
 * Position of an element relative to the stage (the editing canvas area).
 */
const org = el => {
    const r = el.getBoundingClientRect(),
        s = $('#stage').getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top };
};
/**
 * Position of a node relative to the stage.
 */
const abs = n => org(nEl(n) || $('#form'));
/* components */
/**
 * Finds a document (component) by id.
 */
const docOf = id => docs.find(d => d.id === id);
/**
 * True if document d uses document t, directly or indirectly (through nested component instances).
 * Used to prevent circular component references.
 */
const uses = (d, t, seen = new Set()) => {
    if (d === t)
        return true;
    if (seen.has(d))
        return false;
    seen.add(d);
    let f = false;
    walk(d.root, n => {
        if (n.type === 'comp') {
            const c = docOf(n.ref);
            if (c && uses(c, t, seen))
                f = true;
        }
    });
    return f;
};
/**
 * Names of the slots (containers) a component instance's document exposes.
 */
const slotNames = i => {
    const r = [],
        c = docOf(i.ref);
    if (c)
        walk(c.root, n => {
            if (n.type === 'slot')
                r.push(n.name);
        });
    return r;
};
/**
 * True if a node can receive children: a container control, or a component instance that exposes at least one slot.
 */
const canIn = t => isC(t) || (t.type === 'comp' && slotNames(t).length > 0);
/**
 * Adds a new document with the given root node to the project (state includes its own undo/redo/selection).
 */
function addDoc(r) {
    const d = { id: 'd' + (++docN), root: r, undo: [], redo: [], sel: ['root'] };
    docs.push(d);
    return d;
}
/**
 * Switches the editor to another document: saves the old one's history and selection, loads the new one's and redraws.
 */
function useDoc(d) {
    if (cur) {
        cur.undo = undo;
        cur.redo = redo;
        cur.sel = sel;
    }
    cur = d;
    root = d.root;
    undo = d.undo;
    redo = d.redo;
    sel = d.sel.slice();
    armed = null;
    fixUid();
    render(1);
}
/**
 * Replaces the root node of the active document.
 */
function setRoot(r) {
    root = r;
    cur.root = r;
}
/**
 * Creates a unique default name for a new control (e.g. "button1"), based on its type or on the component's name.
 * The type may be "comp:<docId>" for a component instance.
 */
function uname(type) {
    const [t, r] = type.split(':'),
        used = new Set();
    walk(root, n => used.add(n.name));
    const b = (r && docOf(r) ? docOf(r).root.name : T[t].l).toLowerCase();
    let i = 1;
    while (used.has(b + i))
        i++;
    return b + i;
}
/**
 * Creates a new node of the given type ("type" or "comp:<docId>") at x/y with the type's defaults; `o` overrides properties.
 */
function mk(type, x, y, o) {
    const [ty, ref] = type.split(':'),
        d = T[ty],
        n = { id: newId(), type: ty, x: x || 0, y: y || 0, w: d.w, h: d.h, kids: [] };
    for (const k in d)
        if (!SKIP.includes(k) && k !== 'w' && k !== 'h')
            n[k] = d[k];
    if (ref) {
        n.ref = ref;
        const c = docOf(ref);
        if (c) {
            n.w = c.root.w;
            n.h = c.root.h;
        }
    }
    return Object.assign(n, o || {});
}
/**
 * Creates a node and appends it to the parent p, including a unique name.
 */
function add(p, type, x, y, o) {
    const n = mk(type, x, y, o);
    p.kids.push(n);
    n.name = uname(type);
    return n;
}
/**
 * Creates the root node (the form) of a new document.
 */
function newRoot(nm) {
    return {
        id: 'root',
        type: 'form',
        name: nm || 'form1',
        x: 0,
        y: 0,
        w: 640,
        h: 420,
        text: 'My form',
        bg: '',
        code: '',
        language: 'javascript',
        kids: []
    };
}
/**
 * Re-synchronises the id counter with the highest id in use in any document, so new ids stay unique.
 */
function fixUid() {
    uid = 0;
    [root, ...docs.map(d => d.root)].forEach(r => r && walk(r, n => {
        const m = +String(n.id).slice(1);
        if (m > uid)
            uid = m;
    }));
}
/**
 * Builds the demo project shown on first start: a greeting form with JavaScript event handlers.
 */
function demo() {
    root = newRoot();
    root.text = 'Hello form';
    const g = add(root, 'groupbox', 24, 24, { w: 304, h: 176, text: 'Greeting' });
    add(g, 'label', 16, 32, { text: 'Your name:', w: 80 });
    add(g, 'textbox', 104, 28, { w: 176, ph: 'Type a name' });
    add(g, 'checkbox', 16, 76, { text: 'Shout it', w: 120 });
    add(g, 'button', 16, 120, { text: 'Say hello', w: 112, h: 32 });
    add(root, 'label', 24, 216, { w: 304, h: 30, text: '', fs: 18 });
    add(root, 'image', 352, 24, { w: 256, h: 176 });
    add(root, 'slider', 352, 216, { w: 256 });
    root.code = `button1.addEventListener('click', function (event) {
    let s = 'Hello, ' + textbox1.value + '!';
    if (s === 'Hello, !') s = 'Hello, world!';
    if (checkbox1.checked) s = s.toUpperCase();
    label2.textContent = s;
});

slider1.addEventListener('input', function (event) {
    label2.style.fontSize = (8 + slider1.value / 4) + 'px';
});

// Code outside of a listener runs when the page starts.
label2.textContent = 'Type your name, then press the button.';
`;
    fixUid();
}
/* events and callable members a component declares in its JavaScript: emit('name', ...) raises an event,
   form.name = ... publishes a method (or a property of the component, which is listed separately) */
/**
 * Reads a component instance's interface from the code of its document:
 * ev = emitted events, pub = published members (form.x = ...), props = declared properties.
 */
const compInfo = n => {
    const d = n.type === 'comp' && docOf(n.ref),
        s = d ? d.root.code || '' : '',
        f = re => [...new Set([...s.matchAll(re)].map(m => m[1]))],
        props = d ? (d.root.props || []).map(p => String(p[0])).filter(Boolean) : [];
    return d ? LanguageRegistry.get(d.root.language || 'javascript').componentInterface(s, props) : { ev: [], pub: [], props };
};
