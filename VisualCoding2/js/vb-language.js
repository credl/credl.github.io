/* ---------- VB_BUILTINS-style language -> JS ---------- */
/**
 * Runtime library, kept as a string and embedded into every exported page that has code.
 * $q = queue of start-up handlers, $raise / $f / $fn = component events and public functions, $pv / $gp / $sp / $pw = component property values,
 * VB_BUILTINS = built-in VB_BUILTINS functions (Len, Left, Mid, ...), $p = reads/writes control properties (Text, Value, Caption, ...), $m = control methods (SetFocus, Clear, AddItem, RemoveItem).
 * (It is string content and must stay as it is: the exported page runs it as written.)
 */
const VBRT = `var $q=[],$fn={};function $later(f){$q.push(f)}
async function $raise(i,n,a){var e=new CustomEvent(n,{detail:a});document.getElementById(i).dispatchEvent(e);if(e.$p)await Promise.all(e.$p)}
function $f(i,n){return $fn[i+'.'+n]}
var $pv={},$pw={};
function $gp(i,n){var v=($pv[i]||{})[n];if(v==null){var e=document.getElementById(i);if(e&&n in e)v=e[n];else return''}if(typeof v!=='string')return v;return v.trim()!==''&&!isNaN(v)?+v:v==='true'?true:v==='false'?false:v}
async function $sp(i,n,v){var e=document.getElementById(i);if(!$pv[i]||!(n in $pv[i])){if(e)e[n]=v;return}($pv[i]=($pv[i]||{}))[n]=v;var w=$pw[i+'.'+n];if(w)await w()}
var _vbcrlf=String.fromCharCode(10),_vbtab=String.fromCharCode(9),_vbokonly=0,_vbinformation=64,_vbexclamation=48,_vbcritical=16,_vbkeyleft=37,_vbkeyup=38,_vbkeyright=39,_vbkeydown=40,_vbkeyspace=32,_vbkeyreturn=13,_vbkeyescape=27,_vbkeyback=8,_vbkeytab=9;
function $kp(e){return[8,9,13,27,32,37,38,39,40].indexOf(e.keyCode)>=0&&!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)}
var $ti,$tf;
const VB_BUILTINS={len:s=>String(s).length,left:(s,n)=>String(s).slice(0,n),right:(s,n)=>n>0?String(s).slice(-n):'',mid:(s,a,n)=>String(s).substr(a-1,n==null?1e9:n),ucase:s=>String(s).toUpperCase(),lcase:s=>String(s).toLowerCase(),trim:s=>String(s).trim(),val:s=>parseFloat(s)||0,int:Math.floor,fix:Math.trunc,abs:Math.abs,sgn:Math.sign,sqr:Math.sqrt,rnd:()=>Math.random(),round:(x,n)=>Math.round(x*Math.pow(10,n||0))/Math.pow(10,n||0),instr:(a,b)=>String(a).indexOf(b)+1,replace:(s,a,b)=>String(s).split(a).join(b),space:n=>' '.repeat(n),str:String,cstr:String,cint:Math.round,clng:Math.round,cdbl:Number,chr:String.fromCharCode,asc:s=>String(s).charCodeAt(0),now:()=>new Date().toLocaleString(),timer:()=>Date.now()/1000,msgbox:s=>alert(s),starttimer:ms=>{clearInterval($ti);$ti=setInterval(()=>{if($tf)$tf()},Math.max(10,ms||50))},stoptimer:()=>clearInterval($ti)};
const $c=e=>e.type==='checkbox'||e.type==='radio'?e.nextElementSibling:e.classList.contains('groupbox')?e.querySelector('.lg'):e.classList.contains('panel')?document.createElement('span'):e;
function $p(id,p,v){
 const e=document.getElementById(id),w=e.closest('.c')||e,k=e.type,cb=k==='checkbox'||k==='radio',inp=/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName),set=arguments.length>2;
 if(!p)p=cb?'checked':k==='range'?'value':inp?'text':'caption';
 if(p==='text'&&!inp)p='caption';
 if(e.id==='app'&&p==='caption'){if(set)document.title=v;return document.title}
 switch(p){
  case'text':if(set)e.value=v;return e.value;
  case'value':if(set){if(cb)e.checked=!!v;else e.value=v}return cb?e.checked:k==='range'?+e.value:e.value;
  case'caption':if(set)$c(e).textContent=v;return $c(e).textContent;
  case'checked':if(set)e.checked=!!v;return e.checked;
  case'enabled':if(set)e.disabled=!v;return!e.disabled;
  case'visible':if(set)w.style.display=v?'':'none';return w.style.display!=='none';
  case'left':case'top':case'width':case'height':if(set){w.style[p]=v+'px';if(e.getContext&&(p==='width'||p==='height'))e[p]=v}return parseFloat(w.style[p]);
  case'backcolor':if(set){w.style.background=v;w.classList.add('hasbg')}return w.style.background;
  case'forecolor':if(set)w.style.color=v;return w.style.color;
  case'fontsize':if(set)w.style.fontSize=v+'px';return parseFloat(w.style.fontSize)||14;
  case'listindex':if(set)e.selectedIndex=v;return e.selectedIndex;
  case'tooltip':if(set)w.title=v;return w.title;
  case'drawcolor':{const s=$cs[e.id]||($cs[e.id]={c:'#000',w:1});if(set)s.c=v;return s.c}
  case'linewidth':{const s=$cs[e.id]||($cs[e.id]={c:'#000',w:1});if(set)s.w=v;return s.w}
  case'mousex':return($ms[e.id]||{x:0}).x;
  case'mousey':return($ms[e.id]||{y:0}).y;
 }
 throw new Error('Unknown property '+p);
}
var $cs={},$ms={};
function $g(e){var s=$cs[e.id]||($cs[e.id]={c:'#000',w:1}),g=e.getContext('2d');g.strokeStyle=g.fillStyle=s.c;g.lineWidth=s.w;g.font='14px system-ui,sans-serif';g.textBaseline='top';return g}
['pointerdown','pointermove','pointerup'].forEach(function(t){document.addEventListener(t,function(e){var c=e.target;if(c&&c.tagName==='CANVAS'){var r=c.getBoundingClientRect();$ms[c.id]={x:Math.round((e.clientX-r.left)*c.width/r.width),y:Math.round((e.clientY-r.top)*c.height/r.height)}}},true)});
function $m(id,m,a,b,c,d){const e=document.getElementById(id);
 if(e.getContext){const g=$g(e);switch(m){
  case'clear':g.clearRect(0,0,e.width,e.height);return;
  case'drawline':g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke();return;
  case'drawrect':g.strokeRect(a,b,c,d);return;
  case'fillrect':g.fillRect(a,b,c,d);return;
  case'drawcircle':g.beginPath();g.arc(a,b,c,0,7);g.stroke();return;
  case'fillcircle':g.beginPath();g.arc(a,b,c,0,7);g.fill();return;
  case'drawtext':g.fillText(a,b,c);return;
  case'setpixel':g.fillRect(a,b,1,1);return}}
 if(m==='setfocus')e.focus();else if(m==='clear')e.value='';else if(m==='additem')e.add(new Option(a));else if(m==='removeitem')e.remove(a)}
`;
/**
 * Names of the built-in VB_BUILTINS functions (implemented by `VB_BUILTINS` in the runtime above).
 */
const VB_VBN = new Set('len left right mid ucase lcase trim val int fix abs sgn sqr rnd round instr replace space str cstr cint clng cdbl chr asc now timer msgbox starttimer stoptimer'.split(' '));
/**
 * VB_BUILTINS event name -> DOM event name.
 */
const VB_EVT = {
    click: 'click',
    dblclick: 'dblclick',
    change: 'change',
    gotfocus: 'focus',
    lostfocus: 'blur',
    load: 'load',
    timer: 'timer',
    keydown: 'keydown',
    keyup: 'keyup',
    mousedown: 'pointerdown',
    mousemove: 'pointermove',
    mouseup: 'pointerup'
};
// Control properties and methods that VB_BUILTINS code may use.
const VB_PROPS = 'text value caption checked enabled visible left top width height backcolor forecolor fontsize listindex tooltip drawcolor linewidth mousex mousey'.split(' ');
const VB_METH = 'setfocus clear additem removeitem drawline drawrect fillrect drawcircle fillcircle drawtext setpixel'.split(' ');
// VB_NUMT = numeric VB_BUILTINS types (initialised with 0), vbInputT = control types that have an input value.
const VB_NUMT = ['integer', 'long', 'single', 'double', 'currency', 'byte'],
    vbInputT = ['textbox', 'textarea', 'select', 'slider'];
/**
 * Default event of a control, as in VB_BUILTINS: Load for the form, Change for input controls, otherwise Click.
 */
const vbDefEv = n => n.type === 'form'
    ? 'Load'
    : n.type === 'comp'
    ? (vbEvList(n)[0] || 'Click')
    : vbInputT.includes(n.type)
    ? 'Change'
    : 'Click';
/**
 * The events a control offers in the code window's event dropdown.
 */
const vbEvList = n => {
    if (n.type === 'form')
        return ['Load', 'Timer', 'KeyDown', 'KeyUp'];
    if (n.type === 'comp')
        return compInfo(n).ev.map(e => e[0].toUpperCase() + e.slice(1));
    const r = ['Click', 'DblClick'];
    if (n.type === 'canvas')
        r.push('MouseDown', 'MouseMove', 'MouseUp');
    if (vbInputT.includes(n.type) || ['checkbox', 'radio'].includes(n.type))
        r.push('Change');
    if (vbInputT.includes(n.type) || ['button', 'checkbox', 'radio'].includes(n.type))
        r.push('GotFocus', 'LostFocus', 'KeyDown', 'KeyUp');
    return r;
};
/**
 * Maps the node vbIds of the active form to unique DOM vbIds (same naming rules as the export); used to check the code.
 */
function vbIds() {
    const m = new Map(),
        u = new Set();
    walk(root, n => {
        if (n === root)
            return;
        let b = (n.name || n.type).replace(/[^\w$]/g, '_');
        if (/^\d/.test(b))
            b = '_' + b;
        let s = b,
            i = 2;
        while (u.has(s))
            s = b + (i++);
        u.add(s);
        m.set(n.id, s);
    });
    return m;
}
/**
 * Splits one line of VB_BUILTINS code into tokens: strings (t 's'), numbers ('n'), identifiers ('i', lowercase in .l) and operators ('o').
 * Throws a string for unexpected characters.
 */
function vbTokenize(s) {
    const out = [],
        re = /\s*(?:("(?:[^"]|"")*")|(\d+\.?\d*)|([A-Za-z_]\w*)|(<>|<=|>=|[-+*\/^&=<>(),.:]))/y;
    re.lastIndex = 0;
    while (!/^\s*$/.test(s.slice(re.lastIndex))) {
        const at = re.lastIndex,
            m = re.exec(s);
        if (!m)
            throw 'Unexpected character "' + s.slice(at).trim()[0] + '"';
        out.push(m[1] ? { t: 's', v: m[1] } : m[2] ? { t: 'n', v: m[2] } : m[3] ? { t: 'i', v: m[3], l: m[3].toLowerCase() } : { t: 'o', v: m[4] });
    }
    return out;
}
/**
 * Removes a trailing ' comment from a line (quotes inside strings are respected).
 */
function vbStrip(l) {
    let q = false;
    for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"')
            q = !q;
        else if (c === "'" && !q)
            return l.slice(0, i);
    }
    return l;
}
/**
 * Translates VB_BUILTINS-style code to JavaScript.
 * code = the VB_BUILTINS source, X = node id -> DOM id, R = the form/component root the code belongs to,
 * selfId = id of the component instance (null for the main form), dbg = debug context {k, d}: adds debug hooks.
 * Returns {js, errors: [{line, msg}], fnAt (line -> procedure, debug only), fnVars / modVars (variables for the debugger),
 * expr(src) (translates a single expression, used for watches)}.
 */
function vbTranslate(code, X, R = root, selfId, dbg) {
    // Translation state: names = control name (lowercase) -> {DOM id, node}, userSubs = names of the code's own Subs/Functions,
    // subs = the same in order, errs = collected errors, st = stack of open blocks, evs / pubs = declared events / public members,
    // props = custom properties of this component, hasP = does this control have such a custom property?
    const names = new Map(),
        userSubs = new Set(),
        subs = [],
        errs = [],
        st = [],
        evs = new Set(),
        pubs = new Set(),
        props = new Set((R.props || []).map(p => String(p[0]).toLowerCase()).filter(Boolean)),
        hasP = (c, p) => c.n.type === 'comp'
            ? compInfo(c.n).props.includes(p)
            : !!selfId && c.n === R && props.has(p);
    // curFn = name of the Function being translated (assigning to that name sets the return value), u = counter for temporary variables,
    // out = generated code, wmode = translating a watch expression (calling Subs is not allowed there).
    let curFn = null,
        u = 0,
        out = '',
        wmode = false;
    // aw = 'await ' in debug mode (procedures are async there), fnVars / modVars = variables per procedure / at module level,
    // fnAt = line -> procedure.
    const aw = dbg ? 'await ' : '',
        fnVars = {},
        fnAt = {},
        modVars = [];
    // curV = variable list of the procedure being translated, curFname = its name.
    let curV = null,
        curFname = '';
    // Register all controls by their lowercase name. "Me" and "Form" refer to the root.
    walk(R, n => names.set(n.name.toLowerCase(), { id: n === R ? (selfId || 'app') : X.get(n.id), n }));
    names.set('me', { id: selfId || 'app', n: R });
    names.set('form', { id: selfId || 'app', n: R });
    // E raises a translation error (a plain string, caught per line below).
    const E = m => {
        throw m;
    };
    // Index of the ")" that matches the "(" at token i.
    const mt = (tk, i) => {
        let d = 0;
        for (let j = i; j < tk.length; j++) {
            if (tk[j].v === '(')
                d++;
            else if (tk[j].v === ')' && !--d)
                return j;
        }
        return tk.length - 1;
    };
    // Records a variable for the debugger's variable panel; f = explicitly declared (Dim or parameter), so it is local
    // even if a module-level variable has the same name.
    const addV = (v, l, f) => {
        const a = curV || modVars;
        if (a.some(x => x.l === l) || (!f && modVars.some(x => x.l === l)))
            return;
        a.push({ v, l });
    };
    // Splits a token list at top-level commas.
    const split = tk => {
        const r = [[]];
        let d = 0;
        for (const t of tk) {
            if (t.v === '(')
                d++;
            if (t.v === ')')
                d--;
            if (t.v === ',' && !d)
                r.push([]);
            else
                r[r.length - 1].push(t);
        }
        return r;
    };
    /**
     * Translates an expression: VB_BUILTINS names and operators become JavaScript (control properties via $p / $gp, built-ins via VB_BUILTINS.,
     * And / Or / Not / Mod, & = string concatenation, = becomes ==, <> becomes !=, ^ becomes **).
     * In debug mode calls of the code's own Subs/Functions are awaited.
     */
    function ex(tk) {
        let o = '';
        // cl = token indexes where an opened "(await " has to be closed again.
        const cl = new Set();
        for (let i = 0; i < tk.length; i++) {
            const t = tk[i],
                nx = tk[i + 1];
            if (t.t === 's')
                o += JSON.stringify(t.v.slice(1, -1).replace(/""/g, '"'));
            else if (t.t === 'n')
                o += t.v;
            else if (t.t === 'i') {
                const c = names.get(t.l);
                if (c) {
                    if (nx && nx.v === '.') {
                        const p = tk[i + 2];
                        if (!p || p.t !== 'i')
                            E('Property name expected after "."');
                        if (hasP(c, p.l)) {
                            o += `$gp("${c.id}","${p.l}")`;
                            i += 2;
                            continue;
                        }
                        if (compInfo(c.n).pub.some(x => x.toLowerCase() === p.l)) {
                            if (wmode)
                                E('Watches cannot call Subs or Functions');
                            const q = tk[i + 3],
                                pa = q && q.v === '(';
                            if (dbg) {
                                o += '(await ';
                                if (pa)
                                    cl.add(mt(tk, i + 3));
                            }
                            o += `$f("${c.id}","${p.l}")` + (pa ? '' : '()') + (dbg && !pa ? ')' : '');
                            i += 2;
                            continue;
                        }
                        if (!VB_PROPS.includes(p.l))
                            E('Unknown property "' + p.v + '"');
                        o += `$p("${c.id}","${p.l}")`;
                        i += 2;
                    }
                    else
                        o += `$p("${c.id}","")`;
                }
                else if (selfId && props.has(t.l) && !(nx && nx.v === '.'))
                    o += `$gp("${selfId}","${t.l}")`;
                else if (nx && nx.v === '.')
                    E('Unknown control "' + t.v + '"');
                else if (t.l === 'and')
                    o += '&&';
                else if (t.l === 'or')
                    o += '||';
                else if (t.l === 'not')
                    o += '!';
                else if (t.l === 'mod')
                    o += '%';
                else if (t.l === 'true' || t.l === 'false')
                    o += t.l;
                else if (VB_VBN.has(t.l) && !userSubs.has(t.l))
                    o += 'VB_BUILTINS.' + t.l + (nx && nx.v === '(' ? '' : '()');
                else if (userSubs.has(t.l)) {
                    if (wmode)
                        E('Watches cannot call Subs or Functions');
                    const pa = nx && nx.v === '(';
                    if (dbg) {
                        o += '(await ';
                        if (pa)
                            cl.add(mt(tk, i + 1));
                    }
                    o += '_' + t.l + (pa ? '' : '()') + (dbg && !pa ? ')' : '');
                }
                else
                    o += '_' + t.l;
            }
            else {
                const v = t.v;
                if (v === '.' || v === ':')
                    E('Unexpected "' + v + '"');
                o += v === '=' ? '==' : v === '<>' ? '!=' : v === '&' ? '+""+' : v === '^' ? '**' : v;
                if (cl.has(i))
                    o += ')';
            }
        }
        return o;
    }
    // Translates a comma-separated argument list.
    const args = tk => tk.length ? split(tk).map(ex).join(',') : '';
    /**
     * Translates one simple statement: assignments (variables, control and component properties), calls of Subs and methods,
     * Dim / Const, Return, Exit and RaiseEvent.
     */
    function stmt(tk) {
        const f = tk[0],
            l = f.l;
        if (f.t !== 'i')
            E('Statement expected');
        if (l === 'set' || l === 'call')
            return stmt(tk.slice(1));
        if (l === 'return') {
            if (!curFn)
                E('"Return" is only allowed inside a Function (declare it with Public Function)');
            return `return ${tk.length > 1 ? ex(tk.slice(1)) : '$r'};`;
        }
        if (l === 'raiseevent') {
            const n = tk[1];
            if (!n || n.t !== 'i')
                E('Event name expected');
            if (![...evs].some(x => x.toLowerCase() === n.l))
                E('Event "' + n.v + '" is not declared (Public Event ' + n.v + '(...))');
            const r = tk.slice(2);
            return `${aw}$raise(${JSON.stringify(selfId || 'app')},${JSON.stringify([...evs].find(x => x.toLowerCase() === n.l))},[${r.length && r[0].v === '(' && r[r.length - 1].v === ')' ? args(r.slice(1, -1)) : args(r)}]);`;
        }
        if (l === 'exit') {
            const w = tk[1] && tk[1].l;
            return w === 'sub'
                ? 'return;'
                : w === 'function'
                ? 'return $r;'
                : ['for', 'do', 'while'].includes(w)
                ? 'break;'
                : E('Exit what? (Sub, Function, For, Do)');
        }
        if (l === 'dim' || l === 'static')
            return 'var ' + split(tk.slice(1)).map(p => {
                if (!p[0] || p[0].t !== 'i')
                    E('Variable name expected');
                addV(p[0].v, p[0].l, true);
                const ai = p.findIndex(t => t.l === 'as'),
                    ty = ai > 0 && p[ai + 1] ? p[ai + 1].l : '';
                return '_' + p[0].l + (VB_NUMT.includes(ty) ? '=0' : ty === 'string' ? '=""' : ty === 'boolean' ? '=false' : '');
            }).join(',') + ';';
        if (l === 'const')
            return 'var ' + split(tk.slice(1)).map(p => {
                if (p.length < 3 || p[1].v !== '=')
                    E('Expected: Const NAME = value');
                addV(p[0].v, p[0].l, true);
                return '_' + p[0].l + '=' + ex(p.slice(2));
            }).join(',') + ';';
        const c = names.get(l);
        if (c) {
            if (tk[1] && tk[1].v === '.') {
                const p = tk[2];
                if (!p || p.t !== 'i')
                    E('Property or method name expected');
                if (tk[3] && tk[3].v === '=' && hasP(c, p.l))
                    return `${aw}$sp("${c.id}","${p.l}",${ex(tk.slice(4))});`;
                if (tk[3] && tk[3].v === '=') {
                    if (!VB_PROPS.includes(p.l))
                        E('Unknown property "' + p.v + '"');
                    return `$p("${c.id}","${p.l}",${ex(tk.slice(4))});`;
                }
                if (compInfo(c.n).pub.some(x => x.toLowerCase() === p.l)) {
                    const r = tk.slice(3);
                    return `${aw}$f("${c.id}","${p.l}")(${r.length && r[0].v === '(' && r[r.length - 1].v === ')' ? args(r.slice(1, -1)) : args(r)});`;
                }
                if (!VB_METH.includes(p.l))
                    E('Unknown method "' + p.v + '"');
                const ma = tk.slice(3);
                return `$m("${c.id}","${p.l}"${ma.length ? ',' + (ma[0].v === '(' && ma[ma.length - 1].v === ')' ? args(ma.slice(1, -1)) : args(ma)) : ''});`;
            }
            if (tk[1] && tk[1].v === '=')
                return `$p("${c.id}","",${ex(tk.slice(2))});`;
            E('Unexpected text after "' + f.v + '"');
        }
        if (selfId && props.has(l) && tk[1] && tk[1].v === '=')
            return `${aw}$sp("${selfId}","${l}",${ex(tk.slice(2))});`;
        if (tk[1] && tk[1].v === '=') {
            if (l !== curFn)
                addV(f.v, l);
            return (l === curFn ? '$r' : '_' + l) + '=' + ex(tk.slice(2)) + ';';
        }
        if (tk[1] && tk[1].t === 'o' && tk[1].v !== '(')
            E('Statement not understood');
        const nm = VB_VBN.has(l) && !userSubs.has(l) ? 'VB_BUILTINS.' + l : '_' + l;
        const a = tk.length === 1
            ? ''
            : tk[1].v === '(' && tk[tk.length - 1].v === ')'
            ? args(tk.slice(2, -1))
            : args(tk.slice(1));
        return `${nm[0] === '_' ? aw : ''}${nm}(${a});`;
    }
    /**
     * Translates one line: block structures (Sub/Function, If, Select Case, For, While, Do/Loop and their ends) open and close entries
     * on the block stack `st`, everything else goes to stmt().
     */
    function line(tk) {
        const f = tk[0],
            l = f.l;
        if ((l === 'private'
            || l === 'public')
            && tk[1]
            && ['sub', 'function', 'dim', 'const', 'event'].includes(tk[1].l))
            return line(tk.slice(1));
        if (!st.length && !['sub', 'function', 'dim', 'const', 'event'].includes(l))
            E('Statements must be inside a Sub or Function');
        if (l === 'event')
            return '';
        const top = st[st.length - 1];
        if (l === 'sub' || l === 'function') {
            if (st.length)
                E('Sub and Function cannot be nested');
            const nm = tk[1];
            if (!nm || nm.t !== 'i')
                E('Name expected after ' + f.v);
            curV = fnVars[nm.l] = [];
            curFname = nm.v;
            const ps = [];
            for (let i = 2; i < tk.length; i++) {
                const t = tk[i];
                if (t.l === 'as')
                    i++;
                else if (t.t === 'i' && !['byval', 'byref', 'optional'].includes(t.l)) {
                    ps.push('_' + t.l);
                    addV(t.v, t.l, true);
                }
            }
            if (l === 'function')
                curV.push({ v: nm.v, l: nm.l, js: '$r' });
            curFn = l === 'function' ? nm.l : null;
            st.push({
                k: l,
                c: dbg
                    ? (l === 'function' ? 'return $r;}finally{$fx($frame)}}' : '}finally{$fx($frame)}}')
                    : (l === 'function'
                    ? 'return $r;}'
                    : '}')
            });
            const frameIndex = Object.keys(fnVars).length - 1;
            return (dbg ? 'async ' : '') + `function _${nm.l}(${ps.join(',')}){` + (l === 'function' ? 'var $r;' : '') + (dbg ? `var $frame=$fe(${JSON.stringify(dbg.k)},${JSON.stringify(dbg.d)},${frameIndex},${JSON.stringify(nm.v)});try{` : '');
        }
        if (l === 'end') {
            const w = tk[1] && tk[1].l;
            if (!top || top.k !== w)
                E('"End ' + (tk[1] ? tk[1].v : '') + '" does not match an open block');
            st.pop();
            if (w === 'function')
                curFn = null;
            if (w === 'sub' || w === 'function') {
                curV = null;
                curFname = '';
            }
            return top.c;
        }
        if (l === 'if') {
            const ti = tk.findIndex(t => t.l === 'then');
            if (ti < 2)
                E('"Then" expected');
            const c = ex(tk.slice(1, ti)),
                rest = tk.slice(ti + 1);
            if (!rest.length) {
                st.push({ k: 'if', c: '}' });
                return `if(${c}){`;
            }
            const ei = rest.findIndex(t => t.l === 'else');
            return `if(${c}){${stmt(ei < 0 ? rest : rest.slice(0, ei))}}` + (ei < 0 ? '' : `else{${stmt(rest.slice(ei + 1))}}`);
        }
        if (l === 'elseif') {
            if (!top || top.k !== 'if')
                E('"ElseIf" without "If"');
            const ti = tk.findIndex(t => t.l === 'then');
            if (ti < 2)
                E('"Then" expected');
            return `}else if(${ex(tk.slice(1, ti))}){`;
        }
        if (l === 'else') {
            if (!top || top.k !== 'if')
                E('"Else" without "If"');
            return '}else{';
        }
        if (l === 'select') {
            if (!(tk[1] && tk[1].l === 'case'))
                E('Expected: Select Case value');
            const v = '$sc' + (++u);
            st.push({ k: 'select', c: '}}', v });
            return `{var ${v}=${ex(tk.slice(2))};if(false){`;
        }
        if (l === 'case') {
            if (!top || top.k !== 'select')
                E('"Case" outside Select Case');
            if (tk[1] && tk[1].l === 'else')
                return '}else{';
            const v = top.v;
            return `}else if(${split(tk.slice(1)).map(p => {
                const ti = p.findIndex(t => t.l === 'to');
                return p[0] && p[0].l === 'is' ? `${v}${ex([p[1]])}${ex(p.slice(2))}` : ti > 0 ? `${v}>=${ex(p.slice(0, ti))}&&${v}<=${ex(p.slice(ti + 1))}` : `${v}==${ex(p)}`;
            }).join('||')}){`;
        }
        if (l === 'for') {
            const eq = tk.findIndex(t => t.v === '='),
                to = tk.findIndex(t => t.l === 'to'),
                sp = tk.findIndex(t => t.l === 'step');
            if (eq !== 2 || to < 0 || tk[1].t !== 'i')
                E('Expected: For i = a To b [Step s]');
            const v = '_' + tk[1].l,
                n = ++u;
            addV(tk[1].v, tk[1].l);
            st.push({ k: 'for', c: '}}' });
            return `{var $e${n}=${ex(tk.slice(to + 1, sp < 0 ? undefined : sp))},$s${n}=${sp < 0 ? 1 : ex(tk.slice(sp + 1))};for(${v}=${ex(tk.slice(eq + 1, to))};$s${n}>0?${v}<=$e${n}:${v}>=$e${n};${v}+=$s${n}){`;
        }
        if (l === 'next' || l === 'wend') {
            const k = l === 'next' ? 'for' : 'while';
            if (!top || top.k !== k)
                E('"' + f.v + '" without "' + (k === 'for' ? 'For' : 'While') + '"');
            st.pop();
            return top.c;
        }
        if (l === 'while') {
            st.push({ k: 'while', c: '}' });
            return `while(${ex(tk.slice(1))}){`;
        }
        if (l === 'do') {
            const w = tk[1] && tk[1].l;
            if (w === 'while' || w === 'until') {
                st.push({ k: 'dow' });
                const c = ex(tk.slice(2));
                return w === 'while' ? `while(${c}){` : `while(!(${c})){`;
            }
            st.push({ k: 'dop' });
            return 'do{';
        }
        if (l === 'loop') {
            if (!top || (top.k !== 'dow' && top.k !== 'dop'))
                E('"Loop" without "Do"');
            st.pop();
            const w = tk[1] && tk[1].l;
            if (top.k === 'dow') {
                if (w)
                    E('Put the condition on the "Do" line');
                return '}';
            }
            if (!w)
                return '}while(true);';
            const c = ex(tk.slice(2));
            return w === 'while' ? `}while(${c});` : `}while(!(${c}));`;
        }
        return stmt(tk);
    }
    // Pass 1: collect all Sub/Function names, so calls are recognised even before the definition.
    const lines = code.split(/\r?\n/);
    lines.forEach(l => {
        const m = /^\s*(?:(?:public|private)\s+)?(?:sub|function)\s+(\w+)/i.exec(l);
        if (m) {
            userSubs.add(m[1].toLowerCase());
            subs.push(m[1].toLowerCase());
        }
    });
    // Pass 2: collect declared events and public Subs/Functions.
    lines.forEach(l => {
        const m = /^\s*(?:public\s+|private\s+)?event\s+(\w+)/i.exec(l);
        if (m)
            evs.add(m[1]);
        const q = /^\s*public\s+(?:sub|function)\s+(\w+)/i.exec(l);
        if (q)
            pubs.add(q[1].toLowerCase());
    });
    // Pass 3: vbTranslate line by line. Errors are collected per line, so all of them are reported at once.
    lines.forEach((raw, i) => {
        try {
            if (/^\s*rem(\s|$)/i.test(raw))
                return;
            const s = vbStrip(raw);
            if (!s.trim())
                return;
            const tk = vbTokenize(s),
                fnb = curFname,
                j = line(tk);
            if (j) {
                let k = tk[0].l;
                if ((k === 'private' || k === 'public') && tk[1])
                    k = tk[1].l;
                // Debug mode: executable lines get a hook (await $d(...)) so the debugger can stop there.
                const hook = dbg && ((st.length && !['sub', 'function', 'end', 'else', 'elseif', 'case', 'event', 'dim', 'static', 'const'].includes(k)) || (k === 'end' && tk[1] && ['sub', 'function'].includes(tk[1].l)));
                if (hook)
                    fnAt[i + 1] = fnb || curFname;
                out += (hook ? `await $d($frame,${i + 1},function(n){return eval(n)});` : '') + j + '\n';
            }
        }
        catch (x) {
            errs.push({ line: i + 1, msg: typeof x === 'string' ? x : x.message });
        }
    });
    if (st.length)
        errs.push({
            line: lines.length,
            msg: 'Block not closed ("' + st[st.length - 1].k + '" without its end)'
        });
    // Registration code: Sub Control_Event procedures are wired to the DOM events of their controls (or to component events),
    // Form_Load runs at start-up, Property_Change reacts to property writes, public members are published in $fn.
    let reg = '';
    for (const s of subs) {
        const k = s.lastIndexOf('_');
        if (k < 1)
            continue;
        const c = names.get(s.slice(0, k)),
            ev = s.slice(k + 1);
        if (!c)
            continue;
        if (compInfo(c.n).ev.some(x => String(x).toLowerCase() === ev)) {
            reg += `document.getElementById("${c.id}").addEventListener("${compInfo(c.n).ev.find(x => String(x).toLowerCase() === ev) || ev}",function(e){${dbg ? 'var p=' : ''}_${s}.apply(null,e.detail||[]);${dbg ? '(e.$p=e.$p||[]).push(p)' : ''}});\n`;
            continue;
        }
        if (!VB_EVT[ev])
            continue;
        if (c.n === R) {
            if (ev === 'load')
                reg += '$later(_' + s + ');\n';
            else if (ev === 'timer')
                reg += '$tf=_' + s + ';\n';
            // Form_KeyDown(KeyCode) / Form_KeyUp(KeyCode): the whole page listens; arrows, Space, Enter, Esc do not scroll or click buttons
            else if ((ev === 'keydown' || ev === 'keyup') && !selfId)
                reg += `document.addEventListener("${ev}",function(e){if($kp(e))e.preventDefault();_${s}(e.keyCode)});\n`;
        }
        else if (ev === 'keydown' || ev === 'keyup')
            reg += `document.getElementById("${c.id}").addEventListener("${ev}",function(e){_${s}(e.keyCode)});\n`;
        else if (ev !== 'load') {
            const dom = ev === 'change' && ['textbox', 'textarea', 'slider'].includes(c.n.type) ? 'input' : VB_EVT[ev];
            reg += `document.getElementById("${c.id}").addEventListener("${dom}",_${s});\n`;
        }
    }
    if (selfId)
        for (const p of props)
            if (subs.includes(p + '_change'))
                reg += `$pw[${JSON.stringify(selfId + '.' + p)}]=_${p}_change;\n$later(_${p}_change);\n`;
    if (selfId)
        for (const p of pubs)
            reg += `$fn[${JSON.stringify(selfId + '.' + p)}]=_${p};\n`;
    return {
        js: code.trim() ? out + reg : '',
        errors: errs,
        fnAt,
        fnVars,
        modVars,
        expr: src => {
            wmode = true;
            try {
                return ex(vbTokenize(src));
            }
            finally {
                wmode = false;
            }
        }
    };
}


/* ---------- Visual Basic language service ---------- */
const VB_PLACEHOLDER = `Sub Button1_Click()\n    TextBox1.Text = "Hello"\nEnd Sub`;
const VB_HINT = `Visual Basic-style event code. Events: Click, DblClick, Change, GotFocus, LostFocus, Load (Form_Load), Timer (Form_Timer), KeyDown / KeyUp. Properties: Caption, Text, Value, Checked, Enabled, Visible, Left, Top, Width, Height, BackColor, ForeColor, FontSize, ListIndex, ToolTip. Methods: SetFocus, Clear, AddItem. Use Val() to convert text to numbers. Public Event / RaiseEvent and Public Sub/Function are supported for components.`;
class VisualBasicLanguage extends LanguageService {
    constructor() { super('vb', 'Visual Basic'); this.intellisenseProvider = 'vb-symbols'; this.debuggerKind = 'vb-translator'; this.runtimeKind = 'vb'; }
    getHint() { return VB_HINT; }
    getPlaceholder() { return VB_PLACEHOLDER; }
    debugSource(source) { return source; }
    events(node) { return vbEvList(node); }
    defaultEvent(node) { return vbDefEv(node); }
    findEventStub(source, node, event) {
        const nm = (node.type === 'form' ? 'Form' : node.name) + '_' + event;
        const i = String(source).toLowerCase().indexOf(('sub ' + nm).toLowerCase());
        return i < 0 ? null : { index: i };
    }
    componentInterface(source, props = []) {
        const f = re => [...new Set([...String(source).matchAll(re)].map(m => m[1]))];
        return { ev: f(/^\s*(?:public\s+)?event\s+(\w+)/gim), pub: f(/^\s*public\s+(?:sub|function)\s+(\w+)/gim).filter(x => !props.includes(x)), props };
    }
    translateWatchExpressions(expressions, localCount = 0, context = {}) {
        const ids = context.ids || vbIds(), rootNode = context.root || root;
        return expressions.map((x, i) => {
            if (i < localCount) return x;
            try { return vbTranslate('', ids, rootNode, context.selfId, null).expr(x); } catch (e) { return x; }
        });
    }
    debugScope(prepared, context = {}) {
        const result = prepared.info, names = Object.keys(result.fnVars || {});
        const info = { ok: true, code: prepared.code, lines: Object.keys(result.fnAt || {}).map(Number), fns: names.map(n => ({ name: n, parent: -1, vars: (result.fnVars[n] || []).map(v => '_' + v.l).concat((result.modVars || []).map(v => '_' + v.l)) })) };
        const labels = {};
        Object.values(result.fnVars || {}).flat().concat(result.modVars || []).forEach(v => labels['_' + v.l] = v.v);
        return { code: prepared.code, info, scope: { info, fnVars: result.fnVars, modVars: result.modVars, ids: context.ids || vbIds(), varLabels: labels } };
    }
    createEventStub(node, event) {
        const nm = (node.type === 'form' ? 'Form' : node.name) + '_' + event;
        return `Sub ${nm}${/^key(down|up)$/i.test(event) ? '(KeyCode As Integer)' : '()'}\n    \nEnd Sub\n`;
    }
    validate(source, context = {}) { return vbTranslate(source, context.ids || vbIds(), context.root || root, context.selfId, null).errors; }
    compile(source, context = {}) { return vbTranslate(source, context.ids || vbIds(), context.root || root, context.selfId, context.debug || null); }
    highlight(source) {
        const kw = new Set('sub function end if then else elseif for to step next while wend do loop until select case dim as const public private exit return raiseevent event set call and or not mod true false is byval byref optional static rem'.split(' '));
        return String(source).split('\n').map(line => {
            let out = '', i = 0;
            const re = /("(?:[^"]|"")*")|('.*$)|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*/gy;
            while (i < line.length) {
                re.lastIndex = i; const m = re.exec(line);
                if (!m) { out += escapeHtml(line[i++]); continue; }
                out += escapeHtml(line.slice(i,m.index));
                const v=m[0], low=v.toLowerCase();
                const cls=m[1]?'ys':m[2]?'yc':/^\d/.test(v)?'yn':kw.has(low)?'yk':'';
                out += cls ? `<span class="${cls}">${escapeHtml(v)}</span>` : escapeHtml(v); i=re.lastIndex;
                if (m[2]) { out += escapeHtml(line.slice(i)); break; }
            }
            return out || '&nbsp;';
        }).join('\n');
    }
    prepareDebug(source, context = {}) {
        const result = vbTranslate(source, context.ids || vbIds(), context.root || root, context.selfId, { k: context.key, d: context.doc });
        return { code: result.js, info: result };
    }
    breakableLines(source, context = {}) {
        const result = vbTranslate(source, context.ids || vbIds(), context.root || root, null, { k: context.key || 'x', d: context.doc || '' });
        return Object.keys(result.fnAt).map(Number);
    }
}

LanguageRegistry.register(new VisualBasicLanguage());
