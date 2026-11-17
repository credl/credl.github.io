/* ---------- Page control: any HTML page inside a component, connected through postMessage ----------
   The page (n.src) runs in a sandboxed <iframe>. A small bridge script is added to it when the form is exported/previewed:
     page -> component: DOM events picked by the rules n.ev ([["click #save", "save_clicked"], ...]) arrive as 'pageevent' events on the control;
                        the page can also call fbEmit(name, data) itself.
     component -> page: control.pageCall('fn', ...args), pageRun('js code'), pageGet('a.b'), pageSet('a.b', value) - all return Promises.
   The runtime half (PGRT) listens in the exported page. Importing a page (import.js) fills n.src/n.ev and writes the component code that forwards the events. */

/** Script added to the page. __R__ = the event rules [domEvent, selector, name]. */
const PGBR = `(function(){
var R=__R__;
function P(m){m.fb='pg';parent.postMessage(m,'*')}
function cl(v){try{return JSON.parse(JSON.stringify(v===undefined?null:v))}catch(x){return String(v)}}
function walk(p){var s=String(p).split('.'),k=s.pop();return{o:s.reduce(function(o,q){return o[q]},window),k:k}}
window.fbEmit=function(n,d){P({t:'ev',name:String(n),data:cl(d)})};
R.forEach(function(r){document.addEventListener(r[0],function(e){
var t=e.target&&e.target.closest?e.target.closest(r[1]):null;if(!t)return;
if(r[0]==='submit')e.preventDefault();
P({t:'ev',name:r[2],data:{type:e.type,id:t.id||'',name:t.name||'',tag:(t.tagName||'').toLowerCase(),text:(t.textContent||'').trim().slice(0,200),value:t.value===undefined?null:t.value,checked:t.checked===undefined?null:t.checked,key:e.key||null,x:e.clientX==null?null:e.clientX,y:e.clientY==null?null:e.clientY}})},true)});
window.addEventListener('message',function(e){
var m=e.data;if(e.source!==parent||!m||m.fb!=='pg')return;
if(m.t==='hello'){P({t:'ready'});return}
var out,err;
try{
if(m.t==='call'){var a=walk(m.fn);out=a.o[a.k].apply(a.o,m.args||[])}
else if(m.t==='run')out=(0,eval)(m.code);
else if(m.t==='get'){var g=walk(m.path);out=g.o[g.k]}
else if(m.t==='set'){var s=walk(m.path);s.o[s.k]=m.value}
}catch(x){err=String(x&&x.message||x)}
Promise.resolve(out).then(function(v){P({t:'ret',id:m.id,value:cl(v),err:err})},function(x){P({t:'ret',id:m.id,err:String(x&&x.message||x)})})});
P({t:'ready'});
})();`;

/** Runtime for the exported page: routes messages of the page frames to their control and offers pageCall/pageRun/pageGet/pageSet. */
const PGRT = `(function(){var seq=0,pend={};
function frameOf(w){var a=document.querySelectorAll('.c.page>iframe');for(var i=0;i<a.length;i++)if(a[i].contentWindow===w)return a[i]}
window.addEventListener('message',function(e){var m=e.data;if(!m||m.fb!=='pg')return;var f=frameOf(e.source);if(!f)return;var el=f.parentNode;
if(m.t==='ready'){if(!el.$ready){el.$ready=true;(el.$q||[]).splice(0).forEach(function(x){f.contentWindow.postMessage(x,'*')});el.dispatchEvent(new CustomEvent('pageready'))}}
else if(m.t==='ev')el.dispatchEvent(new CustomEvent('pageevent',{detail:{name:m.name,data:m.data}}));
else if(m.t==='ret'){var p=pend[m.id];if(p){delete pend[m.id];m.err?p.rej(new Error(m.err)):p.res(m.value)}}});
function send(el,m){return new Promise(function(res,rej){m.fb='pg';m.id=++seq;pend[m.id]={res:res,rej:rej};if(el.$ready)el.querySelector('iframe').contentWindow.postMessage(m,'*');else(el.$q=el.$q||[]).push(m)})}
document.querySelectorAll('.c.page').forEach(function(el){
var f=el.querySelector('iframe'),hi=function(){try{f.contentWindow.postMessage({fb:'pg',t:'hello'},'*')}catch(x){}};
f.addEventListener('load',hi);hi();
el.pageCall=function(fn){return send(el,{t:'call',fn:fn,args:[].slice.call(arguments,1)})};
el.pageRun=function(code){return send(el,{t:'run',code:String(code)})};
el.pageGet=function(path){return send(el,{t:'get',path:path})};
el.pageSet=function(path,v){return send(el,{t:'set',path:path,value:v})}})})();
`;

/** [domEvent, selector, name] for one row of n.ev ("click #save" -> "save_clicked"); null when the row is incomplete. */
const pageRule = r => { const m = /^\s*([\w-]+)\s+(.+?)\s*$/.exec(r[0] || ''); return m && String(r[1] || '').trim() ? [m[1], m[2], String(r[1]).trim()] : null; };
/** The complete document of a Page control as it runs in the exported page: bridge script (and optional <base>) inserted at the start of the head. */
function pageDoc(n) {
    const rules = (n.ev || []).map(pageRule).filter(Boolean),
        add = (n.base ? `<base href="${esc(n.base)}">` : '') + '<script>' + PGBR.replace('__R__', () => JSON.stringify(rules).replace(/</g, '\\u003c')) + '<\/script>',
        s = String(n.src || '');
    for (const re of [/<head(?:\s[^>]*)?>/i, /<html(?:\s[^>]*)?>/i, /^\s*<!doctype[^>]*>/i]) {
        const m = re.exec(s);
        if (m)
            return s.slice(0, m.index + m[0].length) + add + s.slice(m.index + m[0].length);
    }
    return add + s;
}
/** True if the document d (or a component it uses) contains a Page control: the runtime is only included then. */
const hasPage = ds => [...ds].some(d => { let f = false; walk(d.root, n => { if (n.type === 'page') f = true; }); return f; });

/** Finds the interactive elements of a page and returns rules [{event, selector, name}] for them (used when a page is imported). */
function autoRules(text) {
    const d = new DOMParser().parseFromString(text, 'text/html'),
        out = [],
        used = new Set(),
        cnt = {},
        esc1 = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&')),
        uniq = q => { try { return d.querySelectorAll(q).length === 1; } catch (e) { return false; } },
        sel = el => {
            if (el.id && uniq('#' + esc1(el.id)))
                return '#' + esc1(el.id);
            const nm = el.getAttribute('name'),
                tg = el.tagName.toLowerCase();
            if (nm && uniq(`${tg}[name="${nm.replace(/"/g, '\\"')}"]`))
                return `${tg}[name="${nm.replace(/"/g, '\\"')}"]`;
            const parts = [];
            for (let e = el; e && e.nodeType === 1 && e !== d.body; e = e.parentElement) {
                if (e.id && uniq('#' + esc1(e.id))) {
                    parts.unshift('#' + esc1(e.id));
                    return parts.join(' > ');
                }
                const sib = [...e.parentElement.children].filter(c => c.tagName === e.tagName),
                    t = e.tagName.toLowerCase();
                parts.unshift(sib.length > 1 ? `${t}:nth-of-type(${sib.indexOf(e) + 1})` : t);
            }
            return 'body > ' + parts.join(' > ');
        },
        nameOf = (el, ev) => {
            const t = el.tagName.toLowerCase();
            let b = (el.id || el.getAttribute('name') || '').replace(/[^\w]/g, '_');
            if (!b)
                b = t + (cnt[t] = (cnt[t] || 0) + 1);
            let nm = b + '_' + ev,
                i = 2;
            while (used.has(nm))
                nm = b + i++ + '_' + ev;
            used.add(nm);
            return nm;
        },
        push = (el, ev) => { if (out.length < 80) out.push({ event: ev, selector: sel(el), name: nameOf(el, ev) }); };
    d.querySelectorAll('button,input,select,textarea,form,[onclick],[role=button],a[id]').forEach(el => {
        const t = el.tagName.toLowerCase(),
            ty = (el.getAttribute('type') || 'text').toLowerCase();
        if (t === 'form')
            push(el, 'submit');
        else if (t === 'select')
            push(el, 'change');
        else if (t === 'textarea') {
            push(el, 'input');
            push(el, 'change');
        }
        else if (t === 'input') {
            if (['hidden'].includes(ty))
                return;
            if (['button', 'submit', 'reset', 'image'].includes(ty))
                push(el, 'click');
            else if (['checkbox', 'radio', 'file', 'color', 'date', 'datetime-local', 'time', 'month', 'week'].includes(ty))
                push(el, 'change');
            else if (ty === 'range') {
                push(el, 'input');
                push(el, 'change');
            }
            else {
                push(el, 'input');
                push(el, 'change');
            }
        }
        else
            push(el, 'click');
    });
    return out;
}
/** Code of the component that wraps an imported page: forwards the page's events as component events and exposes the calls into the page. */
function pageCode(rules, ctl) {
    const names = [...new Set(rules.map(r => r.name))];
    return `// Generated by "Import component". Connects the imported page (${ctl}) with this component.
// Events of the page become events of this component: instance.addEventListener('name', e => e.detail)
// The rules are listed in the properties of ${ctl} ("Page events"); the page itself can also call fbEmit(name, data).
${ctl}.addEventListener('pageevent', function (e) {
    var d = e.detail.data;
    switch (e.detail.name) {
${names.map(n => `        case '${n}': emit('${n}', d); break;`).join('\n')}
        default: emit(e.detail.name, d);
    }
});
${ctl}.addEventListener('pageready', function () { emit('ready'); });

// Calls into the page (all return a Promise): instance.pageCall('fn', arg, ...), pageRun('js code'), pageGet('a.b'), pageSet('a.b', value)
form.pageCall = function () { return ${ctl}.pageCall.apply(${ctl}, arguments); };
form.pageRun = function (code) { return ${ctl}.pageRun(code); };
form.pageGet = function (path) { return ${ctl}.pageGet(path); };
form.pageSet = function (path, value) { return ${ctl}.pageSet(path, value); };
`;
}
