/* ---------- properties panel ---------- */
// Label of the main text field per control type.
const txtL = {
    button: 'Text',
    label: 'Text',
    checkbox: 'Text',
    radio: 'Text',
    groupbox: 'Caption',
    form: 'Title',
    textbox: 'Value',
    textarea: 'Value',
    slider: 'Value'
};
/**
 * Lists the editable properties of a node as [key, label, kind] entries.
 * kind: text | num | dim (number or CSS size such as "50%") | bool | color | area.
 */
function fields(n) {
    const t = n.type,
        f = [['name', 'Name', 'text']];
    if (t !== 'form')
        f.push(['x', 'Left', 'dim'], ['y', 'Top', 'dim']);
    f.push(['w', 'Width', 'dim'], ['h', 'Height', 'dim']);
    if (txtL[t])
        f.push(['text', txtL[t], 'text']);
    if (t === 'textbox' || t === 'textarea')
        f.push(['ph', 'Placeholder', 'text']);
    if (t === 'select')
        f.push(['opts', 'Options (one per line)', 'area']);
    if (t === 'image')
        f.push(['src', 'Image URL', 'text']);
    if (t === 'html')
        f.push(['html', 'HTML', 'area']);
    if (t === 'page')
        f.push(['src', 'Page HTML', 'area'], ['base', 'Base URL (relative links)', 'text']);
    if (t === 'frame')
        f.push(['url', 'Website URL', 'text']);
    if (t === 'radio')
        f.push(['group', 'Group', 'text']);
    if (t === 'checkbox' || t === 'radio')
        f.push(['checked', 'Checked', 'bool']);
    if (t !== 'form' && t !== 'slot' && t !== 'comp' && t !== 'canvas' && t !== 'html' && t !== 'page' && t !== 'frame' && !isC(n))
        f.push(['disabled', 'Disabled', 'bool']);
    if (t === 'form')
        f.push(['priv', 'Private (hide in toolbox)', 'bool']);
    f.push(['bg', 'Background', 'color'], ['fg', 'Text color', 'color'], ['fs', 'Font size', 'num']);
    return f;
}
/**
 * Returns v if it is a #rrggbb color, otherwise white (the value the native color picker can show).
 */
const hex = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff';
/**
 * Redraws the properties panel for the primary selection.
 */
function drawProps() {
    const n = P();
    let h = `<div class="pt">${esc(n.name)} <span>${n.type === 'form' ? 'Form' : T[n.type].l}${sel.length > 1 ? ' (+' + (sel.length - 1) + ' selected)' : ''}</span></div>`;
    for (const [k, l, t] of fields(n)) {
        const v = n[k] ?? '';
        if (t === 'bool')
            h += `<label class="chk"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}>${l}</label>`;
        else if (t === 'area')
            h += `<label class="col">${l}<textarea data-k="${k}" rows="${k === 'html' || k === 'src' ? 10 : 4}" spellcheck="false">${esc(v)}</textarea></label>`;
        else
            h += `<label class="row">${l}<input data-k="${k}" type="${t === 'num' ? 'number' : 'text'}" value="${esc(v)}"${t === 'color' ? ' placeholder="inherit"' : ''}>${t === 'color' ? `<input type="color" class="cp" data-k="${k}" value="${hex(v)}">` : ''}</label>`;
    }
    const activeLang = LanguageRegistry.get(n.type === 'form' ? (n.language || 'javascript') : (root.language || 'javascript'));
    const languageOptions = LanguageRegistry.all().map(lang => `<option value="${esc(lang.id)}"${activeLang.id === lang.id ? ' selected' : ''}>${esc(lang.label)}</option>`).join('');
    h += (n.type === 'form' ? `<label class="row">Code language<select data-language>${languageOptions}</select></label>` : '') + `<p class="hint">Events use ${esc(activeLang.label)} code.</p><button class="pb" data-code>Edit code…</button>` + (n.type === 'form' ? ' <button class="pb" data-css>Edit CSS…</button>' : '');
    // Disabled hint about scripts, kept for reference.
    if (0)
        h += '<p class="hint">Scripts run in the exported page. Use <code>$(\'name\')</code> to reach any control, e.g. <code>$(\'textbox1\').value</code>.</p>';
    h += kvHtml(n);
    $('#props').innerHTML = h;
}
/**
 * Refreshes the geometry fields (x, y, w, h) while moving or resizing on the canvas, except the one being typed in.
 */
function syncGeom() {
    const n = P();
    document.querySelectorAll('#props input[data-k]').forEach(i => {
        if (i !== document.activeElement && ['x', 'y', 'w', 'h'].includes(i.dataset.k))
            i.value = n[i.dataset.k];
    });
}
// dirty = an undo snapshot was already taken for the current edit; it is reset when the field commits (change event).
let dirty = false;
// Typing in a property field: validate and convert the value, apply it to all selected controls and redraw.
// A rename only applies to the primary selection (names must stay unique); the form itself can't be moved.
$('#props').addEventListener('input', e => {
    const k = e.target.dataset.k;
    if (!k)
        return;
    let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    // Numeric fields: ignore invalid numbers and sizes below 4; controls may also use CSS sizes such as "50%".
    if (['x', 'y', 'w', 'h', 'fs'].includes(k)) {
        if (v === '' && k === 'fs')
            v = '';
        else if (k !== 'fs' && isNaN(+v) && String(v).trim())
            v = String(v).trim();
        else {
            v = +v;
            if (isNaN(v))
                return;
            if ((k === 'w' || k === 'h') && v < 4)
                return;
        }
    }
    if (!dirty) {
        push();
        dirty = true;
    }
    for (const id of sel) {
        const n = G(id);
        if (!n || (k === 'name' && id !== sel[sel.length - 1]) || (n.type === 'form' && (k === 'x' || k === 'y')))
            continue;
        n[k] = v;
    }
    if (e.target.classList.contains('cp'))
        e.target.previousElementSibling.value = v;
    drawForm();
    drawOv();
    drawTree();
    if (k === 'name' || k === 'priv') {
        drawTabs();
        drawTools();
    }
});
// Name before editing, needed to rename references in the code afterwards.
let nameBefore = '';
$('#props').addEventListener('focusin', e => {
    if (e.target.dataset.k === 'name')
        nameBefore = P().name;
});
// Field committed (change): ends the edit session. After a rename the old name is also replaced in the form's JavaScript code
// (whole identifier, case-sensitive, not after a dot).
$('#props').addEventListener('change', e => {
    dirty = false;
    // data-language is an empty-valued HTML attribute, so dataset.language is "".
    // Test for attribute presence rather than truthiness; otherwise the selection is silently ignored.
    if (e.target.hasAttribute('data-language')) {
        push();
        root.language = e.target.value;
        persist();
        drawProps();
        if ($('#cd').open) openCode();
        return;
    }
    if (e.target.dataset.k === 'name') {
        const o = nameBefore,
            nw = P().name,
            ok = /^[A-Za-z_]\w*$/;
        if (o !== nw && ok.test(o) && ok.test(nw))
            root.code = (root.code || '').replace(new RegExp('(?<![\\w$.])' + o + '(?![\\w$])', 'g'), nw);
        nameBefore = nw;
    }
});
// Buttons of the panel: open the code window or the CSS dialog.
$('#props').addEventListener('click', e => {
    if (e.target.dataset.code !== undefined)
        openCode(P());
    if (e.target.dataset.css !== undefined) {
        $('#cssv').value = root.css || '';
        $('#csd').showModal();
        $('#cssv').focus();
    }
});
// CSS dialog: edits the form's custom CSS and applies it live.
$('#cssv').addEventListener('input', e => {
    if (!dirty) {
        push();
        dirty = true;
    }
    root.css = e.target.value;
    drawForm();
});
$('#cssv').addEventListener('change', () => {
    dirty = false;
});
$('#cssv').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
    }
});
/* ---------- free-form attribute / CSS lists, component properties ---------- */
// Suggestion lists (datalists) for HTML attribute names and CSS property names.
const ATTRS = 'accesskey alt aria-label aria-describedby autocomplete autofocus class cols contenteditable dir draggable hidden href inputmode lang list max maxlength min minlength multiple name pattern placeholder readonly required role rows size spellcheck src step tabindex target title type value wrap'.split(' ');
const CSSP = 'align-items background background-color border border-color border-radius border-width box-shadow color cursor display flex font-family font-size font-style font-weight gap justify-content letter-spacing line-height margin opacity outline overflow padding text-align text-decoration text-transform transform transition white-space z-index'.split(' ');
/**
 * HTML of the key/value editors: component properties (for the form), the instance's own property values (for component instances),
 * HTML attributes and CSS style.
 */
function kvHtml(n) {
    const row = (kv, dl, a, b) => (n[kv] || []).map((p, i) => `<div class="kv"><input type="text"${dl ? ` list="${dl}"` : ''} data-kv="${kv}" data-i="${i}" data-f="0" value="${esc(p[0])}" placeholder="${a}"><input type="text" data-kv="${kv}" data-i="${i}" data-f="1" value="${esc(p[1])}" placeholder="${b}"><button class="pb" data-kvdel="${kv}" data-i="${i}" title="Remove">×</button></div>`).join('') + `<button class="pb" data-kvadd="${kv}">+ Add</button>`;
    if (n.type === 'form')
        return `<div class="pt">Component properties <span>name, default</span></div>` + row('props', '', 'name', 'default');
    let h = '';
    const d = n.type === 'comp' && docOf(n.ref);
    if (d && (d.root.props || []).some(p => p[0]))
        h += `<div class="pt">${esc(d.root.name)} properties</div>` + d.root.props.filter(p => p[0]).map(p => `<label class="pvr">${esc(p[0])}<input type="text" data-pv="${esc(p[0].toLowerCase())}" value="${esc((n.pv || {})[p[0].toLowerCase()] ?? p[1])}"></label>`).join('');
    if (n.type === 'page')
        h += `<div class="pt">Page events <span>event selector, component event</span></div>` + row('ev', '', 'click #save', 'save_clicked');
    return h + `<div class="pt">HTML attributes</div>` + row(
        'attrs',
        'dl-a',
        'attribute',
        'value'
    ) + `<div class="pt">CSS style</div>` + row(
        'css',
        'dl-c',
        'property',
        'value'
    ) + `<datalist id="dl-a">${ATTRS.map(a => `<option>${a}</option>`).join('')}</datalist><datalist id="dl-c">${CSSP.map(a => `<option>${a}</option>`).join('')}</datalist>`;
}
// Editing key/value rows (attributes, CSS, component properties) and property values of component instances.
$('#props').addEventListener('input', e => {
    const t = e.target.dataset;
    if (t.kv) {
        const n = P();
        if (!dirty) {
            push();
            dirty = true;
        }
        (n[t.kv] || (n[t.kv] = []))[+t.i][+t.f] = e.target.value;
        drawForm();
        drawOv();
    }
    else if (t.pv !== undefined) {
        const n = P();
        if (!dirty) {
            push();
            dirty = true;
        }
        (n.pv = n.pv || {})[t.pv] = e.target.value;
        drawForm();
        drawOv();
    }
});
// Add / delete buttons of the key/value lists.
$('#props').addEventListener('click', e => {
    const b = e.target.closest('[data-kvadd],[data-kvdel]');
    if (!b)
        return;
    const n = P(),
        kv = b.dataset.kvadd || b.dataset.kvdel;
    push();
    if (b.dataset.kvadd)
        (n[kv] || (n[kv] = [])).push(['', '']);
    else
        n[kv].splice(+b.dataset.i, 1);
    render(1);
    const l = document.querySelectorAll(`#props [data-kv="${kv}"][data-f="0"]`);
    if (b.dataset.kvadd && l.length)
        l[l.length - 1].focus();
});
