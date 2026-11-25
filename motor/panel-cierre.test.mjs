// El panel sale de «abierta» cuando el servidor ya no está running.
// __tlSumNew solo decide la celebración, no si se cierra el panel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('./colchon-src/colchon-ui.html', import.meta.url), 'utf8');
const start = html.indexOf('async function poll(){clearTimeout(pollT);if(!on)return;let sigue');
const end = html.indexOf('function showSummary', start);
assert.ok(start > 0 && end > start, 'hay poll del panel');
const src = html.slice(start, end);
assert.equal(src.includes('if(!window.__tlSumNew||window.__tlSumNew(sm)){showSummary'), false, 'el resumen ya no depende de __tlSumNew');
assert.match(src, /showSummary\(propio\)/);
assert.match(src, /window\.__tlCelebrate/);
assert.match(src, /catch\(e\)\{sigue=phase==="running"\}/);
assert.match(ui, /catch\(e\)\{sigue=phase==="running"\}/);
assert.match(src, /sm\.inicio===s\.startedAt/);
assert.match(ui, /sm\.inicio===s\.startedAt/);
assert.equal(ui.includes('sm.fin!==lastSum){lastSum=sm.fin;showSummary'), false, 'la fuente tampoco congela el panel por lastSum');

const fin = '2026-11-20T19:52:41.969Z';
const resumen = { direccion: 'VENTA', fin, motivo: 'Posición cerrada', pnlFinalUSD: 15.5 };

function mundo(sumNew) {
  const g = {
    on: true,
    phase: 'running',
    pollT: 0,
    lastSum: null,
    esperaResumen: 0,
    Date,
    shown: [],
    celebrated: [],
    scheduled: 0,
    live: { style: { display: 'block' }, innerHTML: 'abierta', querySelector: () => null },
    liveRun: () => 'viva',
    setPhase(p) { g.phase = p; if (p === 'off' || p === 'summary') g.live.style.display = 'none'; },
    showSummary(m) { g.shown.push(m); g.setPhase('summary'); g.live.style.display = 'block'; },
    clearTimeout() {},
    setTimeout(fn) { g.scheduled++; g.next = fn; return 1; },
    window: {
      __tlSumNew: sumNew,
      __tlCelebrate(sm) { g.celebrated.push(sm); },
    },
    J: async () => { throw new Error('J no definido'); },
  };
  vm.createContext(g);
  g.correr = () => vm.runInContext(`(async()=>{ ${src}; await poll(); })()`, g);
  return g;
}

const visto = { t: 0 };
function sumNewCompartido(sm) {
  const t = Date.parse(sm && sm.fin);
  const nuevo = t > visto.t;
  if (t > visto.t) visto.t = t;
  return nuevo;
}

const a = mundo(sumNewCompartido);
a.J = async (url) => url.endsWith('/summary') ? resumen : { state: 'done', summary: resumen };
await a.correr();
assert.equal(a.shown.length, 1, 'la primera ventana muestra el resumen');
assert.equal(a.celebrated.length, 1, 'la primera ventana celebra');
assert.equal(a.phase, 'summary');
assert.equal(a.scheduled, 0, 'ya no sigue el sondeo de la operación abierta');

const b = mundo(sumNewCompartido);
b.J = async (url) => url.endsWith('/summary') ? resumen : { state: 'done', summary: resumen };
await b.correr();
assert.equal(b.shown.length, 1, 'la segunda ventana también sale de abierta');
assert.equal(b.celebrated.length, 0, 'la segunda ventana no repite el sonido');
assert.equal(b.phase, 'summary');

const manual = mundo(() => false);
manual.J = async (url) => url.endsWith('/summary') ? { ok: false } : { state: 'done', summary: resumen };
await manual.correr();
assert.equal(manual.shown.length, 1, 'el cierre manual usa el summary del estado');
assert.equal(manual.shown[0].fin, fin);
assert.equal(manual.celebrated.length, 0);

const vacio = mundo(() => true);
vacio.J = async () => ({ state: 'idle' });
await vacio.correr();
assert.equal(vacio.shown.length, 0);
assert.equal(vacio.phase, 'running', 'sin resumen todavía espera');
assert.equal(vacio.scheduled, 1);
vacio.Date = { now: () => vacio.esperaResumen + 16000 };
vacio.scheduled = 0;
await vacio.correr();
assert.equal(vacio.phase, 'off', 'pasados ~15 s sin resumen, el panel se cierra');
assert.equal(vacio.live.style.display, 'none');

const inicio = '2026-11-20T19:52:19.000Z';
const previo = { direccion: 'COMPRA', fin: '2026-11-20T19:51:00.000Z', inicio: '2026-11-20T19:51:00.000Z', pnlFinalUSD: 217 };
const este = { direccion: 'VENTA', fin: '2026-11-20T19:52:41.969Z', inicio, pnlFinalUSD: -101 };
const tarde = mundo(() => true);
let listo = false;
tarde.J = async (url) => {
  if (String(url).endsWith('/summary')) return listo ? este : previo;
  return { state: 'done', summary: null, startedAt: inicio };
};
await tarde.correr();
assert.equal(tarde.shown.length, 0, 'no muestra el trade anterior');
assert.equal(tarde.phase, 'running');
assert.equal(tarde.scheduled, 1);
listo = true;
tarde.scheduled = 0;
await tarde.correr();
assert.equal(tarde.shown.length, 1);
assert.equal(tarde.shown[0].pnlFinalUSD, -101);
assert.equal(tarde.phase, 'summary');

const red = mundo(() => true);
red.J = async () => { throw new Error('timeout'); };
await red.correr();
assert.equal(red.shown.length, 0);
assert.equal(red.phase, 'running', 'un fallo de red no cierra la operación');
assert.equal(red.scheduled, 1, 'vuelve a preguntar');

const mudo = mundo(() => true);
mudo.J = async () => ({ ok: false, err: 'red' });
await mudo.correr();
assert.equal(mudo.phase, 'running');
assert.equal(mudo.scheduled, 1, 'una respuesta sin estado se reintenta');

assert.match(src, /pnlFinalAprox&&window\.__tlRefrescarAprox/);
assert.match(html, /window\.__tlRefrescarAprox=function/);
const refSrc = html.slice(html.indexOf('window.__tlRefrescarAprox=function'), html.indexOf('// El pill "Agente"'));
assert.doesNotMatch(refSrc, /__tlCelebrate/);
const gref = {
  phase: 'summary', on: true, shown: [],
  showSummary(m) { gref.shown.push(m); },
  setTimeout(fn) { gref.next = fn; return 1; },
  Date, J: async () => gref.resp,
};
vm.createContext(gref);
gref.window = gref;
gref.base = { fin, pnlFinalAprox: true, pnlFinalUSD: 10 };
gref.resp = { fin, pnlFinalAprox: true, pnlFinalUSD: 10 };
vm.runInContext(refSrc + '\n__tlRefrescarAprox(base);', gref);
await new Promise(r => setTimeout(r, 0));
await gref.next();
assert.equal(gref.shown.length, 0, 'mientras sigue aproximado no repinta');
gref.resp = { fin, pnlFinalAprox: false, pnlFinalUSD: 0.5 };
await gref.next();
assert.equal(gref.shown.length, 1);
assert.equal(gref.shown[0].pnlFinalUSD, 0.5);

console.log('panel-cierre ok');
