/* ---------- language service architecture ----------
   Every editor language implements the same contract. JavaScript is the identity target;
   other languages compile to JavaScript but retain their own source/editor services. */
class LanguageService {
    constructor(id, label) { this.id = id; this.label = label; }
    getHint() { return ''; }
    getPlaceholder() { return ''; }
    events(node) { return []; }
    defaultEvent(node) { return this.events(node)[0] || ''; }
    createEventStub(node, event) { return ''; }
    validate(source, context) { return []; }
    compile(source, context) { return { js: source, errors: [] }; }
    highlight(source) { return escapeHtml(source); }
    completions(context) { return []; }
    // Identity compilation is the neutral default; languages opt into their own debugger adapter.
    debugSource(source, compiled) { return compiled.js; }
    prepareDebug(source, context = {}) { const compiled = this.compile(source, context); return { code: compiled.js, info: { code: compiled.js, lines: [] } }; }
    breakableLines(source, context = {}) { return this.prepareDebug(source, context).info.lines || []; }
    getIntellisenseProvider() { return this.intellisenseProvider || null; }
    findEventStub(source, node, event) { return null; }
    componentInterface(source, props = []) { return { ev: [], pub: [], props }; }
    debugScope(prepared, context = {}) {
        const info = prepared.info || {};
        return { code: prepared.code, info, scope: { info } };
    }
    translateWatchExpressions(expressions) { return expressions; }
}
const escapeHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
class LanguageRegistry {
    static #items = new Map();
    static register(language) {
        if (!(language instanceof LanguageService)) throw new TypeError('Invalid language service');
        if (!/^[a-z][a-z0-9-]*$/.test(language.id)) throw new TypeError('Language id must be a stable lowercase identifier');
        if (this.#items.has(language.id)) throw new Error(`Language already registered: ${language.id}`);
        this.#items.set(language.id, language);
        return language;
    }
    static get(id) { return this.#items.get(id) || this.#items.get('javascript'); }
    static all() { return [...this.#items.values()]; }
}
const currentLanguage = () => LanguageRegistry.get(root?.language || 'javascript');
