// Control types whose own HTML element carries the id/attributes (everything else is wrapped in a <div class="c ..."> that gets them).
const INNER = ['button', 'textbox', 'textarea', 'checkbox', 'radio', 'select', 'slider', 'image', 'canvas', 'frame'];
/**
 * Normalizes the URL of a WebFrame: only http(s) is allowed (no javascript:/data: URLs); without a scheme "https://" is assumed.
 * Returns '' for an empty or unusable value.
 */
const frameUrl = u => {
    u = String(u ?? '').trim();
    if (!u)
        return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(u))
        return /^https?:\/\//i.test(u) ? u : '';
    return /^\/\//.test(u) ? 'https:' + u : 'https://' + u;
};
/**
 * Converts a size/position value to CSS: empty -> "auto", plain numbers -> "px", anything else is passed through escaped (e.g. "50%").
 */
const U = v => v == null || v === '' ? 'auto' : typeof v === 'number' || /^-?\d*\.?\d+$/.test(v) ? v + 'px' : esc(v);
/**
 * True if the container's own CSS makes it a grid/flex container. Its children then take part in that layout:
 * they are rendered position:relative without left/top (absolutely positioned children are ignored by grid and flex).
 */
const isFlow = n => !(window.FB && FB.flow === false) && (n.css || []).some(p => String(p[0]).trim().toLowerCase() === 'display' && /^(inline-)?(grid|flex)$/i.test(String(p[1]).trim()));
/**
 * The properties of a component (R = its root/form node) as CSS custom properties, e.g. "--prop-columns:3;--prop-gap:10px;".
 * Instance values (n.pv, stored lowercase) override the defaults. Inside the component they are usable as var(--prop-columns, 3). The prefix keeps them apart from CSS variables the component defines itself (--left, --top, ...).
 */
const pvVars = (R, n) => (window.FB && FB.propVars === false ? [] : (R && R.props) || [])
    .filter(p => /^[A-Za-z_]\w*$/.test(String(p[0])))
    .map(p => [String(p[0]).toLowerCase(), ((n && n.pv) || {})[String(p[0]).toLowerCase()] ?? p[1]])
    .filter(([, v]) => v != null && String(v) !== '')
    .map(([k, v]) => `--prop-${k}:${esc(String(v))};`).join('');
/** Normalizes user HTML (closes open tags, drops stray end tags) by parsing and re-serializing it in an inert <template>. */
const normHtml = s => { const t = document.createElement('template'); t.innerHTML = String(s ?? ''); return t.innerHTML; };
/* ---------- control markup (shared by editor + export) ----------
   c = {ed, own, d, I, outer}: own = nodes belong to the doc being edited/exported;
   I/outer = set while expanding a component instance (for its container fills). */
/**
 * Builds the HTML markup of one control (and, recursively, its children).
 * Used by the editor canvas and by the export, which is why `c.ed` switches editor-only attributes on and off.
 */
function node(n, c) {
    // Per-node values: type, editor flag, disabled attribute, escaped text and, for component instances, the component's document.
    const t = n.type,
        ed = c.ed,
        dis = n.disabled ? ' disabled' : '',
        v = esc(n.text),
        cd = t === 'comp' ? docOf(n.ref) : null;
    // Inline style: geometry plus optional background, text color and font size.
    let s = (c.flow ? 'position:relative;' : `left:${U(n.x)};top:${U(n.y)};`) + `width:${U(n.w)};height:${U(n.h)};`;
    if (n.bg)
        s += `background:${esc(n.bg)};`;
    if (n.fg)
        s += `color:${esc(n.fg)};`;
    if (n.fs)
        s += `font-size:${+n.fs}px;`;
    // A component instance carries its property values as --prop-* custom properties.
    if (cd)
        s += pvVars(cd.root, n);
    // Exported pages get element ids (names); the editor uses data-id instead.
    const nm = !ed ? c.ids.get(n.id) : '';
    let I = nm ? ` id="${nm}"` : '';
    // W = attributes of the wrapper <div>; I = attributes of the inner element.
    let W = ed ? (c.own ? ` data-id="${n.id}"` : '') : (['label', 'panel', 'groupbox', 'comp', 'slot', 'html', 'page'].includes(t) ? I : ''),
        inner = '';
    // User-defined HTML attributes (`ax`, only valid names, never id/style), custom CSS (`cx`), plus the attribute string `at` and extra class names `cls`.
    const ax = (n.attrs || []).filter(p => /^[A-Za-z_:][\w:.-]*$/.test(p[0]) && !['id', 'style'].includes(p[0].toLowerCase())),
        wr = !INNER.includes(t),
        cx = (n.css || []).filter(p => /^[\w-]+$/.test(p[0]) && p[1] !== '').map(p => p[0] + ':' + esc(p[1]) + ';').join(''),
		// own = an exported single-element control: it carries its own position/size/class (no wrapper div)
		own = !ed && ['button', 'textbox', 'textarea', 'select', 'slider', 'canvas'].includes(t),
		at = ax.filter(p => !((wr || own) && p[0].toLowerCase() === 'class')).map(p => ` ${p[0]}="${esc(p[1])}"`).join(''),
		cls = wr || own ? ax.filter(p => p[0].toLowerCase() === 'class').map(p => ' ' + esc(p[1])).join('') : '';
    // Wrapper-only types take the custom attributes and styles on the wrapper, all others on their inner element.
    if (wr) {
        W += at;
        s += cx;
    }
	else if (own) {
		I += at + ` class="c ${t}${n.bg ? ' hasbg' : ''}${cls}" style="${s}${cx}"`;
	}
    else
        I += at + (cx ? ` style="${cx}"` : '');
    // Inner markup per control type.
    switch (t) {
        case 'button':
            inner = `<button${I}${dis}>${v}</button>`;
            break;
        case 'label':
            inner = v;
            break;
        case 'textbox':
            inner = `<input type="text"${I} value="${v}" placeholder="${esc(n.ph)}"${dis}>`;
            break;
        case 'textarea':
            inner = `<textarea${I} placeholder="${esc(n.ph)}"${dis}>${v}</textarea>`;
            break;
        case 'checkbox':
            inner = `<label><input type="checkbox"${I}${n.checked ? ' checked' : ''}${dis}><span>${v}</span></label>`;
            break;
        case 'radio':
            inner = `<label><input type="radio"${I} name="${esc(n.group)}"${n.checked ? ' checked' : ''}${dis}><span>${v}</span></label>`;
            break;
        case 'select':
            inner = `<select${I}${dis}>${String(n.opts || '').split('\n').map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
            break;
        case 'slider':
            inner = `<input type="range"${I} value="${esc(n.text)}"${dis}>`;
            break;
        case 'image':
            inner = n.src ? `<img${I} src="${esc(n.src)}" alt="">` : `<div class="ph"${I}></div>`;
            break;
        case 'canvas':
            inner = `<canvas${I} width="${+n.w || 300}" height="${+n.h || 150}"></canvas>`;
            break;
        case 'groupbox':
            inner = `<span class="lg">${v}</span>`;
            break;
        // WebFrame: another website in an iframe. Editor: only a placeholder with the URL (nothing is loaded while designing).
        // Export/preview: the real site; the iframe itself carries the control's name, so frame1.src = '...' works as usual.
        case 'frame': {
            const u = frameUrl(n.url);
            inner = ed
                ? `<div class="ph fr"${I}>${u ? esc(u) : 'WebFrame: set the website URL'}</div>`
                : `<iframe${I}${u ? ` src="${esc(u)}"` : ''} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals" allow="fullscreen" allowfullscreen referrerpolicy="no-referrer-when-downgrade" loading="lazy"></iframe>`;
            break;
        }
        // Custom HTML. Editor: shown in a sandboxed iframe (no scripts or event handlers can run inside the IDE, broken markup cannot leak out).
        // Export/preview: inserted into the page as real HTML (scripts run); it is re-serialized first so unbalanced tags cannot break the page.
        case 'html':
            inner = ed
                ? `<iframe class="hx" sandbox tabindex="-1" style="border:0;width:100%;height:100%;background:transparent" srcdoc="${esc('<style>body{margin:0;font:14px/1.3 system-ui,sans-serif}</style>' + (n.html || ''))}"></iframe>`
                : `<div class="hx">${normHtml(n.html)}</div>`;
            break;
        // Page: any HTML page in a sandboxed iframe. Editor: static (scripts blocked). Export: with the bridge of page.js (events out, calls in).
        case 'page':
            inner = ed
                ? `<iframe sandbox tabindex="-1" srcdoc="${esc(n.src || '')}"></iframe>`
                : `<iframe sandbox="allow-scripts allow-forms allow-modals allow-popups" srcdoc="${esc(pageDoc(n))}"></iframe>`;
            break;
        // A slot is the container a component exposes; when the component is expanded, the instance's children for this slot are rendered inside.
        case 'slot': {
            const o = c.I;
            if (o && ed && c.outer.own)
                W = ` data-id="${o.id}" data-slot="${esc(n.name)}"`;
            inner = (ed ? `<span class="sl">${esc(n.name)}</span>` : '') + (o ? o.kids.filter(k => k.slot === n.name).map(k => node(
                k,
                { ...c.outer, flow: isFlow(n) }
            )).join('') : '');
            break;
        }
        // A component instance renders the component's own form (and its children) inside a nested box.
        case 'comp': {
            const r = cd ? cd.root : {},
                ci = cd && !ed ? idMap(r, nm + '__') : null;
            inner = cd
                ? `<div class="c ci" style="left:0;top:0;width:100%;height:100%;background:${esc(r.bg || '#fff')};${r.fg ? 'color:' + esc(r.fg) + ';' : ''}${r.fs ? 'font-size:' + (+r.fs) + 'px;' : ''}">${r.kids.map(k => node(k, { ed, own: false, d: 0, I: n, outer: c, ids: ci })).join('')}</div>`
                : '<div class="ph"></div>';
            break;
        }
    }
	if (own)
		return inner;
    // Children are rendered indented, so the exported HTML stays readable. Components and slots draw their children themselves.
    const pad = '\n' + '  '.repeat(c.d + 1);
    const kids = (t === 'comp' || t === 'slot' || !n.kids.length)
        ? ''
        : pad + n.kids.map(k => node(k, { ...c, d: c.d + 1, flow: isFlow(n) })).join(pad) + '\n' + '  '.repeat(c.d);
    return `<div${W} class="c ${t}${n.bg ? ' hasbg' : ''}${cls}" style="${s}">${inner}${kids}</div>`;
}
