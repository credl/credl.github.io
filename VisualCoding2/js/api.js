/* ---------- backend communication (VisualCodingStorageController) ---------- */
/**
 * Thin client for the backend. Every saved app is one row on the server:
 *   title      -> project name
 *   uiTree     -> JSON of all components (without the code)
 *   actionCode -> JSON map { componentId: code }
 * Login is handled elsewhere; requests just send the session cookie along.
 * config.js is an ES module, so it is loaded with a dynamic import() (works from this classic script).
 */
const Api = (() => {
    let base = null;
    /**
     * Calls an endpoint of the storage controller. Rejects with an Error that carries `status` (0 = backend not reachable).
     */
    async function call(path, body) {
        if (base === null) {
            // config.js may use Vite-only syntax (import.meta.env), which fails when the page is not served by Vite.
            // Then (or without a value) the page and the backend share one origin, so relative URLs are used.
            try { base = (await import('./config.js?t=' + Date.now())).BACKEND_URL; }
            catch (e) { console.warn('config.js could not be loaded, using the page origin as backend:', e); }
            base = typeof base === 'string' ? base.replace(/\/+$/, '') : '';
        }
        const opt = { credentials: 'include' };
        if (body !== undefined) {
            opt.method = 'POST';
            opt.headers = { 'Content-Type': 'application/json' };
            opt.body = JSON.stringify(body);
        }
        const url = `${base}/api/VisualCodingStorage/${path}`;
        let r;
        try {
            r = await fetch(url, opt);
        }
        catch (e) {
            // fetch only rejects when the browser got no usable response. A "no-cors" probe tells the two main cases apart:
            // it still succeeds when the server answers but CORS blocks the page from reading the answer.
            console.error('Backend request failed:', url, e);
            let answered = false;
            try { await fetch(url, { mode: 'no-cors', credentials: 'include' }); answered = true; } catch (x) { }
            throw Object.assign(new Error(!answered
                ? 'The backend is not reachable (' + url + '). Is it running, and is BACKEND_URL correct?'
                : 'The backend (' + url + ') answered, but the browser blocked the response (no usable CORS headers). Possible causes: '
                    + '(1) the origin ' + location.origin + ' is not allowed with credentials; '
                    + '(2) you are not logged in and the cookie auth redirects to a login page instead of answering 401; '
                    + '(3) the endpoint threw an error (e.g. 500). Check this request in the Network tab and the backend log.'), { status: 0 });
        }
        if (!r.ok) {
            const t = await r.text().catch(() => '');
            throw Object.assign(new Error(r.status === 401 ? 'You are not logged in.'
                : t && t.length < 200 ? t : 'Request failed (' + r.status + ').'), { status: r.status });
        }
        return (r.headers.get('content-type') || '').includes('json') ? r.json() : null;
    }
    return {
        build: '20261116a',
        /** All apps of the logged-in user: [{ id, name, uiTree, actionCode }] */
        listApps: () => call('GetApps'),
        /** Creates (id = null) or updates an app; resolves to { id, name }. `p` comes from pack(). */
        saveApp: (id, title, p) => call('UpdateApp', { id: id || null, title, uiTree: p.uiTree, actionCode: p.actionCode }),
        /**
         * Splits the current project into the two strings the backend stores:
         * the component trees (code removed) and the code of every component.
         */
        pack() {
            const o = projectObject(), code = {};
            o.docs = o.docs.map(d => {
                code[d.id] = d.root.code || '';
                return { ...d, root: { ...d.root, code: '' } };
            });
            return { uiTree: JSON.stringify(o), actionCode: JSON.stringify(code) };
        },
        /**
         * Inverse of pack(): turns a backend app into a project object for loadProject().
         */
        unpack(app) {
            const o = JSON.parse(app.uiTree),
                code = app.actionCode ? JSON.parse(app.actionCode) : {};
            (o.docs || []).forEach(d => {
                if (d.root && typeof code[d.id] === 'string')
                    d.root.code = code[d.id];
            });
            return o;
        }
    };
})();
