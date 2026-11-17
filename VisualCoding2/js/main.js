/* ---------- start ---------- */
window.MAIN_BUILD = '20261115c';
// A URL like "#app=<data>" is a shared app link: run it directly, without the editor (see urlexp.js).
const AP = /^#app=(.+)$/.exec(location.hash);
if (AP) {
    window.RUNONLY = 1;
    runUrl(AP[1]);
}
else
    // Otherwise restore the last project from localStorage (the older storage key is the fallback).
    // With nothing stored, `throw 0` jumps into the catch below.
    try {
        const s = localStorage.getItem('fb-project2') || localStorage.getItem('fb-project');
        if (!s)
            throw 0;
        loadProject(JSON.parse(s));
        projectFileName = localStorage.getItem('fb-projectname') || null;
        // Remember which backend app the local draft belongs to.
        setApp(+localStorage.getItem('fb-appid') || null, localStorage.getItem('fb-appname'));
        if (FS)
            loadHandle().then(h => { if (h) { fileHandle = h; projectFileName = h.name; } });
    }
    // Nothing (valid) stored: start with a fresh project containing the demo form.
    catch (e) {
        docs = [];
        cur = null;
        docN = 0;
        demo();
        useDoc(addDoc(root));
        // Nothing stored locally: continue with the user's apps from the backend, if there are any.
        loadLatestApp();
    }
// Treat the restored local autosave or initial demo as the starting point for this editing session.
if (!window.RUNONLY) markProjectSaved();
if (!window.RUNONLY && window.layoutReopenCode) openCode();
