/* ---------- control definitions ---------- */
/**
 * Control definitions, keyed by control type. The values are the defaults for a new control:
 * g = toolbox glyph, l = display label, w/h = default size, c = can contain other controls;
 * all other keys (text, ph, opts, ...) become properties of the new node (see mk()).
 */
const T = {
    button: { g: '▭', l: 'Button', w: 96, h: 30, text: 'Button' },
    label: { g: 'A', l: 'Label', w: 90, h: 22, text: 'Label' },
    textbox: { g: '▯', l: 'TextBox', w: 160, h: 28, text: '', ph: 'Type here' },
    textarea: { g: '▤', l: 'TextArea', w: 180, h: 80, text: '', ph: '' },
    checkbox: { g: '☑', l: 'CheckBox', w: 130, h: 24, text: 'CheckBox', checked: false },
    radio: {
        g: '◉',
        l: 'RadioButton',
        w: 130,
        h: 24,
        text: 'Option',
        group: 'group1',
        checked: false
    },
    select: { g: '▾', l: 'ComboBox', w: 150, h: 28, opts: 'One\nTwo\nThree' },
    slider: { g: '⊸', l: 'Slider', w: 160, h: 24, text: '50' },
    image: { g: '▨', l: 'Image', w: 120, h: 90, src: '' },
    canvas: { g: '✎', l: 'Canvas', w: 240, h: 160 },
    panel: { g: '▢', l: 'Panel', w: 220, h: 150, c: 1, bg: '#eef1f6' },
    groupbox: { g: '⊡', l: 'GroupBox', w: 230, h: 160, c: 1, text: 'GroupBox' },
    html: { g: '‹›', l: 'HTML', w: 200, h: 100, html: '<b>Hello</b> <i>HTML</i>' },
    page: { g: '▣', l: 'Page', w: 320, h: 200, src: '', base: '' },
    frame: { g: '⊕', l: 'WebFrame', w: 320, h: 200, url: '' }
};
// Two pseudo types: a "slot" is a container a component exposes, a "comp" is an instance of another document.
T.slot = { g: '⬚', l: 'Container', w: 200, h: 120 };
T.comp = { g: '◫', l: 'Component', w: 100, h: 100 };
// Keys of T that only describe the toolbox entry and are not copied onto new nodes.
const SKIP = ['g', 'l', 'c'];
/**
 * Base CSS shared by the editor canvas and by exported pages (all controls live inside an element with class "f").
 */
const CSS = `.f{position:relative;overflow:hidden;font:14px/1.3 system-ui,"Segoe UI",sans-serif;color:#1c2230;background:#fff}
.f .c{position:absolute;box-sizing:border-box}
.f .c>button,.f .c>input[type=text],.f .c>textarea,.f .c>select{width:100%;height:100%;box-sizing:border-box;font:inherit;color:inherit}
.f .c>textarea{resize:none}
.f .c>input[type=range]{width:100%;height:100%;margin:0}
.f .c>canvas{display:block;width:100%;height:100%;touch-action:none}
.f .c.canvas{background:#fff;box-shadow:inset 0 0 0 1px #c3cad6}
.f button.c,.f input.c,.f textarea.c,.f select.c{font:inherit;color:inherit}
.f textarea.c{resize:none}
.f canvas.c{display:block;touch-action:none}
.f input[type=range].c{margin:0}
.f .c>img,.f .c>.ph{display:block;width:100%;height:100%;object-fit:cover}
.f .ph{background:repeating-linear-gradient(45deg,#e1e6ee 0 8px,#eef1f6 8px 16px);box-shadow:inset 0 0 0 1px #c3cad6}
.f .c.label{display:flex;align-items:center;white-space:pre-wrap}
.f .c>label{display:flex;align-items:center;gap:6px;height:100%}
.f .c.panel{box-shadow:inset 0 0 0 1px #c3cad6;border-radius:4px;overflow:hidden}
.f .c.groupbox{box-shadow:inset 0 0 0 1px #b4bcc9;border-radius:4px}
.f .c .lg{position:absolute;left:10px;top:-9px;padding:0 4px;background:#fff;white-space:nowrap}
.f .hasbg>.lg{background:inherit}
.f .hasbg>button,.f .hasbg>input[type=text],.f .hasbg>textarea,.f .hasbg>select{background:inherit}
.f .c.slot,.f .c.comp{overflow:hidden}
.f .c.html{overflow:auto}
.f .c.page{overflow:hidden;background:#fff}
.f .c.page>iframe{display:block;width:100%;height:100%;border:0}
.f .c.frame{background:#fff}
.f .c>iframe{display:block;width:100%;height:100%;border:0}
.f .c>.fr{display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:8px;overflow:hidden;text-align:center;word-break:break-all;color:#5b6577;font-size:12px}`;
// Make the editor canvas use these styles as well.
$('#cs').textContent = CSS;
