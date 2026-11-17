/* ---------- code window ---------- */
// Help text shown in the code window while no error message is displayed.
const HINT = ''; 
/**
 * Shows the result of a code check below the editor: "No errors." or one line per error.
 */
function showErrs(e) {
    const p = $('#cerr');
    p.className = e.length ? 'bad' : '';
    p.textContent = e.length ? e.map(a => 'Line ' + a.line + ': ' + a.msg).join('\n') : 'No syntax errors.';
}
/**
 * Handles an error thrown by gen(): code errors (with .errors) are displayed in the code window, anything else is rethrown.
 */
function showErr(x) {
    if (!x || !x.errors)
        throw x;
    openCode();
    showErrs(x.errors);
}
/**
 * Fills the Event dropdown with the events of the object selected in the Object dropdown.
 */
function fillEv() {
    const n = G($('#co').value) || root;
    $('#ce').innerHTML = '<option value="">Event…</option>' + currentLanguage().events(n).map(e => `<option>${e}</option>`).join('');
}
/**
 * Makes sure an addEventListener call for <Object>/<event> exists in the code (adds an empty listener at the end if missing)
 * and puts the cursor into it: into the new body line, or onto the existing listener's line.
 */
function insertStub(n, ev) {
    const ta = $('#vb'),
        lang = currentLanguage(),
        stub = lang.createEventStub(n, ev),
        found = lang.findEventStub(ta.value, n, ev);
    let made = false, at = found ? found.index : -1;
    if (at < 0) {
        const base = ta.value.replace(/\s*$/, '') + (ta.value.trim() ? '\n\n' : '');
        ta.value = base + stub;
        root.code = ta.value;
        persist();
        at = base.length;
        made = true;
    }
    const eol = ta.value.indexOf('\n', at),
        pos = made ? eol + 5 : eol;
    gutDraw();
    ta.focus();
    ta.setSelectionRange(pos, pos);
    ta.scrollTop = Math.max(0, (ta.value.slice(0, pos).split('\n').length - 4) * 19.5);
}
/**
 * Opens the code window for the current form. With a control n it jumps to (and creates if needed) that control's default event.
 */
function openCode(n) {
    ['ac', 'ac-vb', 'sg', 'sg-vb'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
    const objs = [];
    walk(root, c => objs.push(c));
    $('#vb').value = root.code || '';
    $('#vb').placeholder = currentLanguage().getPlaceholder();
    gutDraw();
    $('#co').innerHTML = objs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if (n)
        $('#co').value = n.id;
    fillEv();
    const p = $('#cerr');
    p.className = 'note';
    p.textContent = currentLanguage().getHint();
    if (!$('#cd').open)
        $('#cd').showModal();
    cwDoc = cur;
    if (n)
        insertStub(n, currentLanguage().defaultEvent(n));
    else
        $('#vb').focus();
}
// Choosing an object refreshes its event list; choosing an event inserts or jumps to its listener.
$('#co').onchange = fillEv;
$('#ce').onchange = () => {
    const n = G($('#co').value);
    if (n && $('#ce').value)
        insertStub(n, $('#ce').value);
    $('#ce').value = '';
};
// "Check" button: checks the syntax and shows the errors without running anything.
$('#cChk').onclick = () => {
    root.code = $('#vb').value;
    showErrs(currentLanguage().validate(root.code, { root }));
};
// Typing: take one undo snapshot per typing session (dirty flag, reset on change), store the code and autosave.
$('#vb').addEventListener('input', e => {
    if (!dirty) {
        push();
        dirty = true;
    }
    root.code = e.target.value;
    persist();
});
$('#vb').addEventListener('change', () => {
    dirty = false;
});
// Tab inserts four spaces instead of moving the focus.
$('#vb').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    ');
    }
});
/* the code window is non-modal now: follow component switches, undo/redo and renamed controls */
// The document whose code the window currently shows (to detect tab switches).
let cwDoc = null;
/**
 * Keeps an open code window in sync with the model after a redraw: reloads the code after a component switch, undo or redo,
 * and refreshes the object list (renamed or added controls).
 */
function syncCode() {
    if (!$('#cd').open)
        return;
    const ta = $('#vb'),
        so = $('#co'),
        v = so.value,
        objs = [];
    walk(root, c => objs.push(c));
    const h = objs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const sw = cwDoc !== cur;
    cwDoc = cur;
    if (ta.value !== (root.code || '')) {
        ta.value = root.code || '';
        gutDraw();
    }
    if (so.innerHTML !== h || sw) {
        so.innerHTML = h;
        so.value = objs.some(c => c.id === v) ? v : objs[0].id;
        fillEv();
    }
    if (sw) {
        const p = $('#cerr');
        p.className = '';
        p.textContent = currentLanguage().getHint();
    }
}
