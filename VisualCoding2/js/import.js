/* ---------- import: exported pages and project files as components ----------
   Every page made with "Export HTML" carries its source (the form and the components it uses) in <script type="application/json" id="fb-source">.
   "Import component" reads that block and adds the documents to the open project, so the exported page can be placed like any other component.
   Pages without the block (other tools, older exports) are wrapped in a Page control (page.js): their buttons/inputs/forms become component events and the component can call into the page.
   A project .json file adds all of its documents. */

/** Source block that is embedded in exported pages (the active document and the components it uses; same compact format as the app links). */
function sourceTag() {
    const p = { fbx: 1, a: cur.id, d: [...usedDocs(cur)].map(d => ({ i: d.id, r: slim(d.root) })) };
    return '<script type="application/json" id="fb-source">' + JSON.stringify(p).replace(/</g, '\\u003c') + '<\/script>\n';
}
/** Documents stored in an exported page, or null when the page has no source block. */
function readSource(text) {
    const el = new DOMParser().parseFromString(text, 'text/html').getElementById('fb-source');
    if (!el)
        return null;
    const p = JSON.parse(el.textContent);
    if (!p || !Array.isArray(p.d))
        throw new Error('The source block of this page is damaged.');
    return { active: p.a, docs: p.d.map(d => ({ id: d.i, root: fat(d.r, { n: 0 }) })) };
}
/** Documents of a project .json file (or of a single saved form). */
function readProject(text) {
    const o = JSON.parse(text),
        l = o.docs || [{ root: o }];
    if (!l.length || !l.every(d => d.root && d.root.type === 'form' && Array.isArray(d.root.kids)))
        throw new Error('This is not a form project file.');
    return { active: o.active, docs: l.map((d, i) => ({ id: d.id || 'i' + i, root: d.root })) };
}
/** A page without source (not made by this tool): a component with a Page control. The page's buttons/inputs/forms are turned into component events (see page.js). */
function wrapPage(text, base) {
    const dp = new DOMParser().parseFromString(text, 'text/html'),
        app = dp.getElementById('app'),
        px = v => /^\d+(\.\d+)?px$/.test(v || '') ? parseFloat(v) : 0,
        ctl = 'webpage',
        rules = autoRules(text);
    let nm = base.replace(/[^\w]/g, '_') || 'page';
    if (/^\d/.test(nm))
        nm = '_' + nm;
    const r = newRoot(nm);
    r.w = px(app && app.style.width) || 640;
    r.h = px(app && app.style.height) || 420;
    r.text = dp.title || base;
    r.kids.push(mk('page', 0, 0, {
        name: ctl,
        w: '100%',
        h: '100%',
        src: text,
        ev: rules.map(x => [x.event + ' ' + x.selector, x.name])
    }));
    r.code = pageCode(rules, ctl);
    return { active: 'p0', docs: [{ id: 'p0', root: r }], rules: rules.length };
}
/**
 * Adds documents to the open project: new document ids, new node ids, component references re-pointed inside the imported set,
 * unique component names. Returns the new documents (the first one is the main document).
 */
function mergeDocs(p) {
    p.docs.forEach(d => legacyCode(d.root));
    docN = Math.max(docN, ...docs.map(d => +String(d.id).slice(1) || 0));
    const map = new Map(),
        made = [];
    // The main document goes first, so it is the one the toolbox and the message name.
    const order = p.docs.slice().sort((a, b) => (b.id === p.active) - (a.id === p.active));
    order.forEach(d => {
        const x = addDoc(d.root);
        x.bp = [];
        map.set(d.id, x.id);
        made.push(x);
    });
    fixUid();
    made.forEach(x => walk(x.root, n => {
        if (n !== x.root)
            n.id = newId();
        if (n.type === 'comp')
            n.ref = map.get(n.ref) || '';
    }));
    // The imported app is ONE control: the main document stays public, the documents it uses (directly or indirectly) are private,
    // i.e. not listed in the toolbox (still open as tabs). Documents of a project file that the main one does not use stay public.
    const dep = usedDocs(made[0]);
    made.forEach(x => {
        if (x === made[0])
            delete x.root.priv;
        else if (dep.has(x))
            x.root.priv = true;
    });
    // Component names must differ from the ones already in the project (the old name is replaced in the component's code too).
    const taken = new Set(docs.filter(d => !made.includes(d)).map(d => d.root.name));
    made.forEach(x => {
        const o = x.root.name;
        let nm = o,
            i = 2;
        while (taken.has(nm))
            nm = o + i++;
        taken.add(nm);
        if (nm !== o) {
            x.root.name = nm;
            if (/^[A-Za-z_]\w*$/.test(o))
                x.root.code = (x.root.code || '').replace(new RegExp('(?<![\\w$.])' + o + '(?![\\w$])', 'g'), nm);
        }
    });
    return made;
}
// "Import component" button: pick a file, merge it.
A.imp = () => $('#impf').click();
$('#impf').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f)
        return;
    try {
        const text = await f.text(),
            base = f.name.replace(/\.[^.]+$/, '');
        let p, how = '';
        if (/^\s*[{[]/.test(text))
            p = readProject(text);
        else {
            p = readSource(text);
            if (!p) {
                p = wrapPage(text, base);
                how = ' It is a page without source: it runs inside the component, its ' + p.rules + ' buttons/inputs/forms are forwarded as component events (see "Page events" on its Page control), and instance.pageCall/pageRun/pageGet/pageSet reach into it.';
            }
        }
        const made = mergeDocs(p);
        render(1);
        notify('Imported "' + made[0].root.name + '"' + '. Find it under Components in the toolbox.' + (made.some(x => x.root.priv) ? ' The ' + made.filter(x => x.root.priv).length + ' component(s) it uses were added as private: hidden in the toolbox, still open as tabs (property "Private" of the form).' : '') + how);
    }
    catch (x) {
        notify('Could not import: ' + (x && x.message || 'unknown file format'), false);
    }
});
