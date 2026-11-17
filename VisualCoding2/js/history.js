/**
 * Serialises the active form tree; one snapshot is one undo step.
 */
const snapshot = () => JSON.stringify(root);
/**
 * Saves the current state on the undo stack (at most 100 steps) and clears the redo stack.
 */
function push() {
    undo.push(snapshot());
    if (undo.length > 100)
        undo.shift();
    redo = [];
}
/**
 * Like push(), but for continuous actions (e.g. arrow-key nudging): only saves a step
 * if at least 700 ms have passed since the last one, so a burst of changes undoes in one go.
 */
function pushC() {
    const t = Date.now();
    if (t - lastP > 700)
        push();
    lastP = t;
}
/**
 * Restores a state from an undo/redo snapshot: replaces the root, rebuilds the index
 * and drops selected ids that no longer exist.
 */
function load(s) {
    setRoot(JSON.parse(s));
    fixUid();
    reindex();
    sel = sel.filter(i => idx.has(i));
    if (!sel.length)
        sel = ['root'];
    render(1);
}
// Timer handle for the debounced autosave.
let st;
/**
 * Autosaves the whole project (all documents) to localStorage after 400 ms of quiet.
 * Does nothing in run-only mode.
 */
function persist() {
    if (window.RUNONLY)
        return;
    clearTimeout(st);
    st = setTimeout(() => {
        try {
            localStorage.setItem('fb-project2', JSON.stringify({
                docs: docs.map(d => ({ id: d.id, root: d.root, bp: d.bp })),
                active: cur && cur.id
            }));
        }
        // Storage can be full or blocked: autosave is best-effort, so ignore the error.
        catch (e) { }
    }, 400);
}
