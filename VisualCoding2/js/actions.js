/* ---------- actions ---------- */
const ACTIONS_BUILD = '20261115c';
/**
 * Gives a pasted node and all its descendants fresh ids and unique names.
 */
function reid(n) {
    n.id = newId();
    n.name = uname(n.type);
    n.kids.forEach(reid);
}
// Toolbar actions. The header's click handler (below) calls the one named in a button's data-a attribute.
// Project-level save state is compared against a stable serialisation of every component and its breakpoints.
let projectFileName = null;
// The project filename is remembered together with the autosave, so Save after a restart does not ask for a name again.
function setProjectName(n) {
    projectFileName = n || null;
    try { n ? localStorage.setItem('fb-projectname', n) : localStorage.removeItem('fb-projectname'); } catch (e) { }
}
let savedProjectState = '';
function projectObject() {
    return { fb: 2, docs: docs.map(d => ({ id: d.id, root: d.root, bp: d.bp || [] })), active: cur && cur.id };
}
function projectState() { return JSON.stringify(projectObject().docs); }
function hasUnsavedChanges() { return !!savedProjectState && projectState() !== savedProjectState; }
function confirmDiscard() {
    return !hasUnsavedChanges() || confirm('This project has unsaved changes. Discard them?');
}
function markProjectSaved() { savedProjectState = projectState(); }
/* ---- backend storage: appId = id of the app on the server (null = not saved yet), appName = its name ---- */
let appId = null, appName = null, saving = false, openList = [];
function setApp(id, name) {
    appId = id || null;
    appName = name || null;
    try {
        appId ? localStorage.setItem('fb-appid', appId) : localStorage.removeItem('fb-appid');
        appName ? localStorage.setItem('fb-appname', appName) : localStorage.removeItem('fb-appname');
    } catch (e) { }
    document.title = (appName ? appName + ' - ' : '') + 'Form Builder';
}
// Non-blocking success/failure message (bottom right); a popover, so it also shows above open dialogs.
let toastT;
function notify(msg, ok = true) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = ok ? 'ok' : 'err';
    try { t.hidePopover(); t.showPopover(); } catch (e) { }
    clearTimeout(toastT);
    toastT = setTimeout(() => { try { t.hidePopover(); } catch (e) { } }, ok ? 3000 : 7000);
}
// Saves the project to the backend. Asks for a name when the app is new (or when asNew is set = "Save as").
async function saveApp(asNew) {
    if (saving)
        return;
    let name = appName;
    if (asNew || !appId || !name) {
        name = prompt('Name of this app (saved in your account, not as a file):', appName || docs[0].root.name || 'app1');
        if (name == null || !name.trim())
            return;
        name = name.trim();
    }
    const btn = document.querySelector('[data-a="save"]'),
        state = projectState(),
        p = Api.pack();
    saving = true;
    btn.disabled = true;
    notify('Saving "' + name + '" to the backend...');
    try {
        const id = asNew ? null : appId;
        let r;
        try {
            r = await Api.saveApp(id, name, p);
        }
        catch (e) {
            // The stored app is gone or belongs to another account: store the project as a new app instead.
            if (id && e.status === 404)
                r = await Api.saveApp(null, name, p);
            else
                throw e;
        }
        setApp(r.id, r.name);
        savedProjectState = state;
        notify('Saved "' + r.name + '" to the backend.');
    }
    catch (e) {
        notify('Saving to the backend failed: ' + e.message, false);
    }
    finally {
        saving = false;
        btn.disabled = false;
    }
}
// Fresh browser without a local draft: opens the last used (else the newest) app from the backend, unless the user already started editing.
async function loadLatestApp() {
    try {
        const apps = await Api.listApps();
        if (!apps.length || hasUnsavedChanges())
            return;
        const last = +localStorage.getItem('fb-appid'),
            a = apps.find(x => x.id === last) || apps.reduce((m, x) => x.id > m.id ? x : m);
        loadProject(Api.unpack(a));
        setApp(a.id, a.name);
        markProjectSaved();
    }
    catch (e) { /* best effort: the demo project stays */ }
}
/* ---- real file handles (File System Access API): the opened/saved file is remembered across sessions and overwritten on Save ---- */
const FS = typeof showSaveFilePicker === 'function' && typeof showOpenFilePicker === 'function';
const FTYPES = [{ description: 'Form project', accept: { 'application/json': ['.json'] } }];
let fileHandle = null;
function idb(mode, fn) {
    return new Promise((res, rej) => {
        const r = indexedDB.open('fb-files', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('h');
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
            const tx = r.result.transaction('h', mode),
                q = fn(tx.objectStore('h'));
            tx.oncomplete = () => res(q && q.result);
            tx.onerror = () => rej(tx.error);
        };
    });
}
const storeHandle = h => idb('readwrite', s => h ? s.put(h, 'project') : s.delete('project')).catch(() => { });
const loadHandle = () => idb('readonly', s => s.get('project')).catch(() => null);
function setHandle(h) {
    fileHandle = h || null;
    storeHandle(fileHandle);
    if (h)
        setProjectName(h.name);
}
async function writeHandle(h, data) {
    let p = await h.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted')
        p = await h.requestPermission({ mode: 'readwrite' });
    if (p !== 'granted')
        throw new DOMException('Permission denied', 'NotAllowedError');
    const w = await h.createWritable();
    await w.write(data);
    await w.close();
}
// Save: overwrites the known file (handle) without asking; asks the file picker only when there is no file yet (asNew forces it).
async function saveProject(name, asNew) {
    const data = JSON.stringify(projectObject(), null, 1);
    if (FS) {
        try {
            if (!fileHandle && !asNew)
                fileHandle = await loadHandle();
            let h = asNew ? null : fileHandle;
            if (!h) {
                h = await showSaveFilePicker({ suggestedName: name || projectFileName || 'form-project.json', types: FTYPES });
                setHandle(h);
            }
            await writeHandle(h, data);
            setProjectName(h.name);
            markProjectSaved();
            notify('Saved to file "' + h.name + '".');
            return;
        }
        catch (e) {
            if (e && e.name === 'AbortError')
                return;
            /* blocked (e.g. inside a frame) or write failed: fall back to a download below */
        }
    }
    if (await saveFile(name, data, 'application/json')) {
        setProjectName(name);
        markProjectSaved();
        notify('Downloaded "' + name + '".');
    }
}
const A = {
    // New component: adds an empty document and switches to its tab.
    new() {
        useDoc(addDoc(newRoot('app' + (docN + 1))));
    },
    // New project: discard the current project only after explicit confirmation.
    newProject() {
        if (!confirmDiscard()) return;
        docs = []; cur = null; docN = 0; setProjectName(null); setHandle(null); setApp(null, null);
        useDoc(addDoc(newRoot('app1')));
        markProjectSaved();
    },
    // Open: lists the apps stored in the backend; choosing one loads it (see the #olist listener below). "Open file" is the local .json variant.
    async open() {
        const info = $('#oinfo');
        $('#olist').innerHTML = '';
        info.textContent = 'Loading...';
        $('#od').showModal();
        try {
            openList = (await Api.listApps()).sort((a, b) => b.id - a.id);
            info.textContent = openList.length ? '' : 'No saved apps yet.';
            $('#olist').innerHTML = openList.map(a => `<button type="button" class="b app" data-app="${a.id}"><span>${esc(a.name)}</span><em>#${a.id}</em></button>`).join('');
        }
        catch (e) {
            info.textContent = 'Could not load apps: ' + e.message;
            notify('Loading apps from the backend failed: ' + e.message, false);
        }
    },
    // Open file: shows the file picker (the change listener of #file, further down, loads the file).
    async openFile() {
        if (!confirmDiscard())
            return;
        if (FS) {
            try {
                const [h] = await showOpenFilePicker({ types: FTYPES });
                loadProject(JSON.parse(await (await h.getFile()).text()));
                setHandle(h);
                setApp(null, h.name.replace(/\.json$/i, ''));
                markProjectSaved();
                notify('Opened file "' + h.name + '".');
                return;
            }
            catch (e) {
                if (e && e.name === 'AbortError')
                    return;
                if (e instanceof SyntaxError || e === 0)
                    return notify('This file is not a Form Builder project.', false);
            }
        }
        $('#file').click();
    },
    // Save: stores the app in the backend (an unnamed app asks for a name first).
    save() {
        saveApp(false);
    },
    // Save as: always asks for a name and stores the project as a new app.
    saveAs() {
        saveApp(true);
    },
    // Save file: overwrites the known .json file without asking; asks for a file only when there is none yet.
    saveFile() {
        if (!projectFileName) try { projectFileName = localStorage.getItem('fb-projectname') || null; } catch (e) { }
        saveProject(projectFileName || 'form-project.json');
    },
    // Save file as: always asks for a new file name.
    saveFileAs() {
        if (FS)
            return saveProject(projectFileName || 'form-project.json', true);
        const name = prompt('Save project as:', projectFileName || 'form-project.json');
        if (name == null || !name.trim()) return;
        const fileName = /\.json$/i.test(name.trim()) ? name.trim() : name.trim() + '.json';
        saveProject(fileName);
    },
    // Undo/redo: move the current state to the opposite stack and restore the other one.
    undo() {
        if (!undo.length)
            return;
        redo.push(snapshot());
        load(undo.pop());
    },
    redo() {
        if (!redo.length)
            return;
        undo.push(snapshot());
        load(redo.pop());
    },
    // Copy: stores deep copies of the selected top-level nodes plus where they came from
    // (document, parent, slot and on-screen position), so paste can keep their position.
    copy() {
        const l = tops();
        if (l.length) {
            clip = l.map(n => JSON.parse(JSON.stringify(n)));
            clipSrc = l.map(n => ({
                d: cur.id,
                p: idx.get(n.id).p.id,
                s: n.slot || '',
                a: (e => e ? org(e) : null)(nEl(n))
            }));
            clipCut = 0;
            pasteN = {};
        }
    },
    // Cut = copy, then delete.
    cut() {
        A.copy();
        clipCut = 1;
        A.del();
    },
    // Paste. Target: the selected component instance (into its slot), the selected container, or else the parent of the selection.
    paste() {
        if (!clip.length)
            return;
        const q = P(),
            inst = sel.length === 1 && q.type === 'comp',
            p = inst ? q : sel.length === 1 && isC(q) ? q : (idx.get(sel[0])?.p || root),
            sl = inst
                ? (slotNames(q).includes(lastSlot) ? lastSlot : slotNames(q)[0])
                : p.type === 'comp'
                ? q.slot
                : undefined;
        // A component instance without a slot can't take children.
        if (p.type === 'comp' && !sl)
            return;
        // Skip nodes that would make a component contain itself.
        const ok = clip.map((c, i) => [c, clipSrc[i]]).filter(([c]) => {
            let f = 1;
            walk(c, n => {
                if (n.type === 'comp' && docOf(n.ref) && uses(docOf(n.ref), cur))
                    f = 0;
            });
            return f;
        });
        if (!ok.length)
            return;
        push();
        // k0 counts earlier pastes into the same target, so repeated pastes cascade by 16 px.
        const tk = cur.id + '|' + p.id + '|' + (sl || ''),
            k0 = pasteN[tk] || 0;
        pasteN[tk] = k0 + 1;
        const ids = [];
        /* keep the ABSOLUTE position in the form (offset by the new parent's origin); nudge only when it would land on its own original (same parent, not cut) or on an earlier paste */
        const pa = org(cEl(p, sl) || $('#form'));
        ok.forEach(([c, s]) => {
            const n = JSON.parse(JSON.stringify(c)),
                o = 16 * (k0 + (!clipCut && s && s.d === cur.id && s.p === p.id && s.s === (sl || '') ? 1 : 0));
            if (s && s.a) {
                n.x = Math.round(s.a.x - pa.x) + o;
                n.y = Math.round(s.a.y - pa.y) + o;
            }
            else {
                if (typeof n.x === 'number')
                    n.x += o;
                if (typeof n.y === 'number')
                    n.y += o;
            }
            n.slot = sl;
            p.kids.push(n);
            reid(n);
            ids.push(n.id);
        });
        sel = ids;
        render(1);
    },
    // Duplicate = copy + paste.
    dup() {
        A.copy();
        A.paste();
    },
    // Delete: removes the selected top-level nodes; the selection falls back to the parent of the first one.
    del() {
        const l = tops();
        if (!l.length)
            return;
        push();
        const first = idx.get(l[0].id).p;
        l.forEach(n => {
            const p = idx.get(n.id).p;
            p.kids.splice(p.kids.indexOf(n), 1);
        });
        sel = [first.id];
        render(1);
    },
    // To front: moving a node to the end of its parent's list draws it on top.
    front() {
        const l = tops();
        if (!l.length)
            return;
        push();
        l.forEach(n => {
            const p = idx.get(n.id).p;
            p.kids.splice(p.kids.indexOf(n), 1);
            p.kids.push(n);
        });
        render(1);
    },
    // To back: moving a node to the start of its parent's list draws it below the others.
    back() {
        const l = tops();
        if (!l.length)
            return;
        push();
        l.reverse().forEach(n => {
            const p = idx.get(n.id).p;
            p.kids.splice(p.kids.indexOf(n), 1);
            p.kids.unshift(n);
        });
        render(1);
    },
    // Export HTML: shows the generated page in the export dialog.
    exp() {
        try {
            $('#code').value = gen(null, null, true);
            $('#ex').showModal();
        }
        catch (x) {
            showErr(x);
        }
    },
    // Code: opens the code window.
    code() {
        openCode();
    },
    // Debug: starts the debugger.
    dbg() {
        startDebug();
    },
    // Preview: generates the page and runs it in the preview window.
    pv() {
        try {
            const h = gen();
            $('#fr').replaceWith(freshFrame(h));
            $('#pv').show();
        }
        catch (x) {
            showErr(x);
        }
    }
};
// Toolbar: run the action named in the button's data-a attribute.
document.querySelector('header').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (b)
        A[b.dataset.a]();
});
/**
 * Creates the sandboxed iframe used for preview and debugging, optionally with page content h.
 * A fresh frame is used on every run so no old scripts keep running.
 */
function freshFrame(h) {
    const f = document.createElement('iframe');
    f.id = 'fr';
    f.setAttribute('sandbox', 'allow-scripts allow-modals');
    if (h)
        f.srcdoc = h;
    return f;
}
// Dialogs close via any [data-close] element or a click on the backdrop (outside the dialog box).
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
    const r = d.getBoundingClientRect();
    if (e.target.closest('[data-close]')
        || (e.target === d
        && (e.clientX < r.left
        || e.clientX > r.right
        || e.clientY < r.top
        || e.clientY > r.bottom)))
        d.close();
}));
// Preview window: Refresh button; the frame is replaced by an empty one on close, which stops the running app.
$('#pvR').onclick = () => A.pv();
$('#pv').addEventListener('close', () => $('#fr').replaceWith(freshFrame('')));
// Export dialog: Download and Copy buttons (Copy falls back to execCommand without Clipboard API).
$('#exDl').onclick = () => saveFile(((root.name || 'page').replace(/[^\w.-]/g, '_').replace(/^index$/i, 'page') || 'page') + '.html', $('#code').value, 'text/html');
$('#exCp').onclick = async () => {
    try {
        await navigator.clipboard.writeText($('#code').value);
    }
    catch (e) {
        $('#code').select();
        document.execCommand('copy');
    }
    $('#exCp').textContent = 'Copied';
    setTimeout(() => $('#exCp').textContent = 'Copy', 1200);
};
// Project file picker: loads the chosen JSON file as the project.
$('#file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f)
        return;
    const r = new FileReader();
    r.onload = () => {
        try {
            loadProject(JSON.parse(r.result));
            setHandle(null);
            setProjectName(f.name);
            setApp(null, f.name.replace(/\.json$/i, ''));
            markProjectSaved();
            notify('Opened file "' + f.name + '".');
        }
        catch (x) {
            notify('This file is not a Form Builder project.', false);
        }
    };
    r.readAsText(f);
    e.target.value = '';
});
// Open dialog: clicking an app loads it.
$('#olist').addEventListener('click', e => {
    const b = e.target.closest('[data-app]'),
        a = b && openList.find(x => x.id === +b.dataset.app);
    if (!a || !confirmDiscard())
        return;
    try {
        loadProject(Api.unpack(a));
        setHandle(null);
        setApp(a.id, a.name);
        markProjectSaved();
        $('#od').close();
        notify('Opened "' + a.name + '" from the backend.');
    }
    catch (x) {
        notify('This app could not be loaded (invalid data).', false);
    }
});
// Ctrl+S saves to the backend, also while typing in the code window.
addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !window.RUNONLY) {
        e.preventDefault();
        A.save();
    }
});
// "Snap to grid" checkbox: toggles snapping and the grid display.
$('#snap').addEventListener('change', e => {
    snapOn = e.target.checked;
    $('#form').classList.toggle('grid', snapOn);
});
// Global keyboard shortcuts. Inactive while typing in a field, with a dialog open or inside a floating window.
// Ctrl+Z/Y undo/redo, Ctrl+C/X/V/D copy/cut/paste/duplicate, Ctrl+A select all siblings, Delete, Escape (deselect),
// F7 code window, Alt+Left/Right switch component tab, arrow keys nudge the selection (Shift = 8 px).
addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
        || document.querySelector('dialog[open]')
        || (e.target.closest
        && e.target.closest('.win')))
        return;
    const m = e.ctrlKey || e.metaKey,
        k = e.key.toLowerCase();
    if (m && k === 'z') {
        e.preventDefault();
        e.shiftKey ? A.redo() : A.undo();
    }
    else if (m && k === 'y') {
        e.preventDefault();
        A.redo();
    }
    else if (m && k === 'c')
        A.copy();
    else if (m && k === 'x') {
        e.preventDefault();
        A.cut();
    }
    else if (m && k === 'v') {
        e.preventDefault();
        A.paste();
    }
    else if (m && k === 'd') {
        e.preventDefault();
        A.dup();
    }
    else if (m && k === 'a') {
        e.preventDefault();
        const p = idx.get(sel[0])?.p || root;
        sel = p.kids.map(c => c.id);
        if (!sel.length)
            sel = ['root'];
        render(1);
    }
    else if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        A.del();
    }
    else if (k === 'escape') {
        armed = null;
        sel = ['root'];
        drawTools();
        render(1);
    }
    else if (k === 'f7') {
        e.preventDefault();
        A.code();
    }
    else if (e.altKey && /^arrow(left|right)$/.test(k)) {
        e.preventDefault();
        const t = docs[docs.indexOf(cur) + (k === 'arrowright' ? 1 : -1)];
        t && useDoc(t);
    }
    // Arrow keys: nudge the selection. Positions that are CSS strings are first read back from the DOM as numbers.
    else if (k.startsWith('arrow')) {
        const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k],
            s = e.shiftKey ? 8 : 1,
            l = tops();
        e.preventDefault();
        if (!l.length)
            return;
        pushC();
        l.forEach(n => {
            n.x = (typeof n.x === 'number' ? n.x : nEl(n).offsetLeft) + d[0] * s;
            n.y = (typeof n.y === 'number' ? n.y : nEl(n).offsetTop) + d[1] * s;
        });
        drawForm();
        drawOv();
        syncGeom();
    }
});
/* ---------- components (tabs) ---------- */
/**
 * Loads a project object: either the current format ({docs, active}) or a single old-style form.
 * Throws if the data doesn't look like a project.
 */
function loadProject(o) {
    const l = o.docs || [{ root: o }];
    if (!l.length || !l.every(d => d.root && d.root.type === 'form' && Array.isArray(d.root.kids)))
        throw 0;
    // Code saved before JavaScript handlers existed is VB-style: keep it as a comment (see legacyCode).
    l.forEach(d => legacyCode(d.root));
    if (o.docs) {
        docs = [];
        cur = null;
        docN = 0;
        l.forEach(d => {
            const x = addDoc(d.root);
            // bp = breakpoint line numbers of the document's code (only valid integers are kept).
            x.bp = Array.isArray(d.bp) ? d.bp.filter(Number.isInteger) : [];
            if (d.id) {
                x.id = d.id;
                docN = Math.max(docN, +String(d.id).slice(1) || 0);
            }
        });
    }
    else
        addDoc(o);
    useDoc(o.docs ? docs.find(d => d.id === o.active) || docs[0] : docs[docs.length - 1]);
}
/**
 * Closes a component tab after confirmation. Refused while other components still contain instances of it.
 */
function closeDoc(d) {
    const by = docs.filter(o => o !== d && uses(o, d));
    if (by.length)
        return alert('"' + d.root.name + '" is used inside: ' + by.map(o => o.root.name).join(', ') + '. Remove those instances first.');
    if (!confirm('Close and delete "' + d.root.name + '"?'))
        return;
    const i = docs.indexOf(d);
    docs.splice(i, 1);
    if (!docs.length)
        addDoc(newRoot('app1'));
    if (d === cur) {
        cur = null;
        useDoc(docs[Math.min(i, docs.length - 1)]);
    }
    else
        render(1);
}
// Tab bar: "new" button, close buttons and switching between components.
$('#tabs').addEventListener('click', e => {
    if (e.target.closest('[data-new]'))
        return A.new();
    const x = e.target.closest('[data-x]');
    if (x)
        return closeDoc(docOf(x.dataset.x));
    const t = e.target.closest('[data-d]'),
        d = t && docOf(t.dataset.d);
    if (d && d !== cur)
        useDoc(d);
});
// Reorder tabs by dragging: the marker shows whether the tab lands before or after the tab under the pointer.
{
    let dragId = null;
    const clr = () => document.querySelectorAll('#tabs .dl,#tabs .dr').forEach(t => t.classList.remove('dl', 'dr'));
    $('#tabs').addEventListener('dragstart', e => {
        const t = e.target.closest && e.target.closest('.tab[data-d]');
        if (!t) return;
        dragId = t.dataset.d;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragId);
    });
    $('#tabs').addEventListener('dragover', e => {
        const t = e.target.closest('.tab[data-d]');
        if (!dragId || !t) return;
        e.preventDefault();
        clr();
        if (t.dataset.d === dragId) return;
        const r = t.getBoundingClientRect();
        t.classList.add(e.clientX < r.left + r.width / 2 ? 'dl' : 'dr');
    });
    $('#tabs').addEventListener('drop', e => {
        const t = e.target.closest('.tab[data-d]');
        e.preventDefault();
        if (!dragId || !t || t.dataset.d === dragId) return clr();
        const r = t.getBoundingClientRect(),
            after = e.clientX >= r.left + r.width / 2,
            from = docOf(dragId),
            to = docOf(t.dataset.d);
        clr();
        if (!from || !to) return;
        docs.splice(docs.indexOf(from), 1);
        docs.splice(docs.indexOf(to) + (after ? 1 : 0), 0, from);
        drawTabs();
        persist();
    });
    $('#tabs').addEventListener('dragend', () => { dragId = null; clr(); });
}

/* ---------- context menu (Cut / Copy / Paste) for the designer and the UI tree ---------- */
{
    const cm = document.createElement('div');
    cm.id = 'cm';
    cm.hidden = true;
    cm.innerHTML = [['cut', 'Cut', 'Ctrl+X'], ['copy', 'Copy', 'Ctrl+C'], ['paste', 'Paste', 'Ctrl+V'], ['del', 'Delete', 'Del']]
        .map(([a, t, k]) => `<button type="button" data-cm="${a}"><span>${t}</span><kbd>${k}</kbd></button>`).join('');
    document.body.append(cm);
    const hide = () => { cm.hidden = true; };
    // Opens the menu at the pointer; Cut/Copy/Delete need a selected control (not just the form), Paste needs something on the clipboard.
    const show = e => {
        e.preventDefault();
        cm.querySelectorAll('[data-cm=cut],[data-cm=copy],[data-cm=del]').forEach(b => b.disabled = !tops().length);
        cm.querySelector('[data-cm=paste]').disabled = !clip.length;
        cm.hidden = false;
        cm.style.left = Math.max(4, Math.min(e.clientX, innerWidth - cm.offsetWidth - 4)) + 'px';
        cm.style.top = Math.max(4, Math.min(e.clientY, innerHeight - cm.offsetHeight - 4)) + 'px';
    };
    cm.addEventListener('click', e => {
        const b = e.target.closest('button[data-cm]');
        if (!b || b.disabled)
            return;
        hide();
        A[b.dataset.cm]();
    });
    cm.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('pointerdown', e => { if (!cm.hidden && !e.target.closest('#cm')) hide(); }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }, true);
    addEventListener('blur', hide);
    addEventListener('resize', hide);
    // Designer: a right click on an unselected control selects it first; on the form background it selects the form (paste target).
    $('#stage').addEventListener('contextmenu', e => {
        if (armed)
            return;
        const el = e.target.closest('[data-id]'),
            id = el ? el.dataset.id : 'root';
        lastSlot = el && el.dataset.slot || null;
        if (!sel.includes(id) || id === 'root') {
            sel = [id];
            render(1);
        }
        show(e);
    });
    // UI tree: same, on the rows.
    $('#tree').addEventListener('contextmenu', e => {
        const r = e.target.closest('.tr');
        if (r && !sel.includes(r.dataset.id)) {
            lastSlot = null;
            sel = [r.dataset.id];
            drawOv();
            drawTree();
            drawProps();
        }
        show(e);
    });
}
