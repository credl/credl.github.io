/**
 * Shorthand for document.querySelector.
 */
const $ = s => document.querySelector(s);
/**
 * Escapes a value for safe use in HTML text and attribute values (null/undefined become an empty string).
 */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
