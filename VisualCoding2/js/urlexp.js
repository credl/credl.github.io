/* ---------- export as URL: project -> pruned JSON -> deflate-raw -> base64url in #app=... ---------- */
/**
 * Encodes bytes as base64url (URL-safe, no padding). Works in 8 KB chunks to stay within the argument limit of String.fromCharCode.
 */
const b64u = u => {
    let s = '';
    for (let i = 0; i < u.length; i += 8192)
        s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
/**
 * Decodes a base64url string back into bytes.
 */
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
/**
 * Runs bytes through a (De)CompressionStream of the given format (S = stream class, m = format) and returns the result bytes.
 */
const pipe = async (u, S, m) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new S(m))).arrayBuffer());
/* drop defaults/empties and node ids (restored on load), kids -> k */
const slim = n => {
    const o = {};
    for (const k in n) {
        const v = n[k];
        if (k === 'id' && v !== 'root')
            continue;
        if (k === 'kids') {
            if (v.length)
                o.k = v.map(slim);
            continue;
        }
        if (v === '' || v === false || v == null || (typeof v === 'object' && !Object.keys(v).length))
            continue;
        o[k] = v;
    }
    return o;
};
/**
 * Inverse of slim(): restores `kids` and gives nodes that lost their id a new one (counter c.n).
 */
const fat = (o, c) => {
    const n = {
        ...o,
        kids: (o.k || []).map(k => fat(k, c))
    };
    delete n.k;
    if (!n.id)
        n.id = 'n' + (++c.n);
    return n;
};
/**
 * Collects document d and every document it uses through component instances (transitively).
 */
function usedDocs(d, s = new Set()) {
    if (s.has(d))
        return s;
    s.add(d);
    walk(d.root, n => {
        if (n.type === 'comp') {
            const c = docOf(n.ref);
            if (c)
                usedDocs(c, s);
        }
    });
    return s;
}
/**
 * Packs the active app and the components it uses into a link payload: JSON -> deflate-raw -> base64url.
 * Prefix "z" = compressed, "r" = stored raw (for browsers without CompressionStream).
 */
async function packApp() {
    const ds = [...usedDocs(cur)],
        p = {
            a: cur.id,
            d: ds.map(d => ({ i: d.id, r: slim(d.root) }))
        },
        u = new TextEncoder().encode(JSON.stringify(p));
    let z = 'z',
        b;
    try {
        b = await pipe(u, CompressionStream, 'deflate-raw');
    }
    catch (e) {
        z = 'r';
        b = u;
    }
    return location.href.replace(/#.*$/, '') + '#app=' + z + b64u(b);
}
/**
 * Inverse of packApp(): decodes a link payload back into a project object.
 */
async function unpackApp(s) {
    let b = unb64u(s.slice(1));
    if (s[0] === 'z')
        b = await pipe(b, DecompressionStream, 'deflate-raw');
    const p = JSON.parse(new TextDecoder().decode(b));
    return {
        fb: 2,
        active: p.a,
        docs: p.d.map(d => ({ id: d.i, root: fat(d.r, { n: 0 }) }))
    };
}
/**
 * Run-only mode for shared links: loads the app, generates the page and shows it full-screen in a sandboxed iframe.
 * Code errors are shown as plain text instead.
 */
async function runUrl(s) {
    try {
        loadProject(await unpackApp(s));
        const h = gen();
        document.title = root.text || 'App';
        document.body.innerHTML = '';
        document.body.style.cssText = 'margin:0;display:block';
        const f = freshFrame(h);
        f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff';
        document.body.append(f);
    }
    catch (x) {
        document.body.textContent = x && x.errors
            ? x.errors.map(e => 'Line ' + e.line + ': ' + e.msg).join('\n')
            : 'This app link is invalid.';
    }
}
/**
 * "Export as URL" action: builds the link and shows it in the dialog.
 */
A.url = async () => {
    try {
        // Generate once first, so code errors are reported before a link is made.
        gen();
    }
    catch (x) {
        return showErr(x);
    }
    const u = await packApp();
    $('#uv').value = u;
    $('#uinfo').textContent = u.length.toLocaleString() + ' characters';
    $('#ud').showModal();
    $('#uv').select();
};
// Copy button (falls back to execCommand where the Clipboard API is unavailable).
$('#uCp').onclick = async () => {
    try {
        await navigator.clipboard.writeText($('#uv').value);
    }
    catch (e) {
        $('#uv').select();
        document.execCommand('copy');
    }
    $('#uCp').textContent = 'Copied';
    setTimeout(() => $('#uCp').textContent = 'Copy', 1200);
};
// Open button: opens the link in a new tab.
$('#uGo').onclick = () => window.open($('#uv').value, '_blank', 'noopener');
