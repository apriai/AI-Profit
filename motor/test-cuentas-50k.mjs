import { getStrategy, listStrategies, STRATEGY_ORDER, DEFAULT_STRATEGY } from './strategies.mjs';
import { accountPlanSize, paramsForAccount, rulesFor, PLANS, maxQtyFor } from './account-size.mjs';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); failed++; }
  else console.log('ok ', msg);
}

const a25 = { name: 'LFE02500000000019', inicio: 25000, startOfDay: 25000 };
const a50 = { name: 'LFE05000000000099', inicio: 50000, startOfDay: 50000 };
assert(accountPlanSize(a25) === '25K', 'detecta 25K por LFE025');
assert(accountPlanSize(a50) === '50K', 'detecta 50K por LFE050');
assert(accountPlanSize({ name: 'LFE05000000000099', inicio: 25000 }) === '50K', 'LFE050 gana aunque inicio sea 25000');
assert(accountPlanSize({ name: 'LFE02500000000019', startOfDay: 50000 }) === '25K', 'LFE025 no cambia por startOfDay crecido');
assert(accountPlanSize({ start: 50000 }) === '50K', 'start 50000 sin id → 50K');
assert(accountPlanSize({ name: 'LFF05000000000099' }) === '50K', 'detecta 50K por LFF050');
assert(accountPlanSize({ name: 'Flex 50K demo' }) === '50K', 'detecta token 50K');

const r25 = rulesFor(a25), r50 = rulesFor(a50);
assert(r25.start === 25000 && r25.dd === 1000 && r25.dailyLoss === 600 && r25.profitTarget === 1250, 'reglas 25K');
assert(r25.lockTriggerOver === 1100 && r25.lockFloorOver === 100, 'trail/lock 25K');
assert(r50.start === 50000 && r50.dd === 2000 && r50.dailyLoss === 1200 && r50.profitTarget === 3000, 'reglas 50K oficiales');
assert(r50.lockTriggerOver === 2100 && r50.lockFloorOver === 100, 'trail oficial 52,100 y lock +100');
assert(r25.start - r25.dd === 24000, 'piso inicial 25K = 24,000');
assert(r50.start - r50.dd === 48000, 'piso inicial 50K = 48,000');
assert(r25.maxMicros === 20 && r25.maxMinis === 2, 'techo 25K 2 minis / 20 micros');
assert(r50.maxMicros === 40 && r50.maxMinis === 4, 'techo 50K 4 minis / 40 micros');
assert(maxQtyFor('MNQ', a25) === 20 && maxQtyFor('NQ', a25) === 2, 'eval 25K tope 20/2');
assert(maxQtyFor('MNQ', a50) === 40 && maxQtyFor('NQ', a50) === 4, 'eval 50K tope 40/4');
assert(maxQtyFor('MNQ', { ...a25, balance: 27000 }) === 20, 'eval 25K no escala por beneficio');
assert(maxQtyFor('MNQ', { ...a50, balance: 53000 }) === 40, 'eval 50K no escala por beneficio');
assert(maxQtyFor('MNQ', {}) === 20, 'sin cuenta = techo 25K');
const f25 = { name: 'LFF02500000000019', type: 'funded', start: 25000, inicio: 25000 };
const f50 = { name: 'LFF05000000000099', type: 'funded', start: 50000, inicio: 50000 };
assert(maxQtyFor('MNQ', f25) === 20 && maxQtyFor('MNQ', f50) === 40, 'fondeada sin saldo = techo');
assert(maxQtyFor('MNQ', { ...f25, balance: 25000 }) === 10, 'fondeada 25K saldo 25000 -> 10');
assert(maxQtyFor('MNQ', { ...f25, balance: 26099 }) === 10, 'fondeada 25K saldo 26099 -> 10');
assert(maxQtyFor('MNQ', { ...f25, balance: 26100 }) === 20, 'fondeada 25K saldo 26100 -> 20');
assert(maxQtyFor('MNQ', { ...f25, totalPnl: 1099 }) === 10, 'fondeada 25K +1099 -> 10');
assert(maxQtyFor('MNQ', { ...f25, totalPnl: 1100 }) === 20, 'fondeada 25K +1100 -> 20');
assert(maxQtyFor('MNQ', { ...f50, balance: 50000 }) === 20, 'fondeada 50K <1000 -> 20');
assert(maxQtyFor('MNQ', { ...f50, balance: 51000 }) === 30, 'fondeada 50K 1000 -> 30');
assert(maxQtyFor('MNQ', { ...f50, balance: 51999 }) === 30, 'fondeada 50K 1999 -> 30');
assert(maxQtyFor('MNQ', { ...f50, balance: 52000 }) === 40, 'fondeada 50K 2000 -> 40');
assert(maxQtyFor('NQ', { ...f50, totalPnl: 1500 }) === 3, 'fondeada 50K NQ 1500 -> 3');
assert(maxQtyFor('NQ', { ...f25, totalPnl: 0 }) === 1, 'fondeada 25K NQ 0 -> 1');
assert(maxQtyFor('NQ', { ...f25, totalPnl: 1100 }) === 2, 'fondeada 25K NQ +1100 -> 2');
assert(DEFAULT_STRATEGY === 'evaluacion-simple', 'default sigue Evaluación');
assert(getStrategy('evaluacion-simple').params.DEFAULT_QTY.MNQ === 8, 'Evaluación default 8 MNQ');
assert(STRATEGY_ORDER.includes('dos-disparos'), 'incluye dos-disparos');

const ids = ['evaluacion-simple', 'evaluacion', 'dia-minimo-colchon', 'rascacielo', 'prueba-be', 'dos-disparos'];
const rows = {};
for (const id of ids) {
  const raw = getStrategy(id);
  assert(!!raw, id + ' existe');
  const p25 = paramsForAccount(raw.params, a25);
  const p50 = paramsForAccount(raw.params, a50);
  assert(p25 === raw.params, id + ' 25K devuelve el mismo objeto');
  assert(p25.SL_USD * 2 === p50.SL_USD && p25.TP_USD * 2 === p50.TP_USD, id + ' SL/TP ×2');
  if (raw.params.NET_USD != null) assert(p50.NET_USD === raw.params.NET_USD * 2, id + ' NET_USD ×2');
  if (raw.params.TRIGGER_EXTRA_USD != null) assert(p50.TRIGGER_EXTRA_USD === raw.params.TRIGGER_EXTRA_USD * 2, id + ' TRIGGER_EXTRA ×2');
  if (Array.isArray(raw.params.STEPS)) {
    raw.params.STEPS.forEach((s, i) => {
      if (s.trigger != null) assert(p50.STEPS[i].trigger === s.trigger * 2, id + ' step ' + (i + 1) + ' trigger ×2');
      if (s.lock != null) assert(p50.STEPS[i].lock === s.lock * 2, id + ' step ' + (i + 1) + ' lock ×2');
      if (s.lockTicks != null) assert(p50.STEPS[i].lockTicks === s.lockTicks, id + ' lockTicks sin cambiar');
    });
  }
  if (raw.params.DEFAULT_QTY && raw.params.DEFAULT_QTY.MNQ != null) {
    assert(p50.DEFAULT_QTY.MNQ === raw.params.DEFAULT_QTY.MNQ, id + ' qty MNQ no se escala');
  }
  rows[id] = {
    '25K': { SL: p25.SL_USD, TP: p25.TP_USD, STEPS: p25.STEPS || null, NET: p25.NET_USD ?? null, TRIG: p25.TRIGGER_EXTRA_USD ?? null },
    '50K': { SL: p50.SL_USD, TP: p50.TP_USD, STEPS: p50.STEPS || null, NET: p50.NET_USD ?? null, TRIG: p50.TRIGGER_EXTRA_USD ?? null },
  };
}

const be = getStrategy('prueba-be');
assert(be.params.STEPS[0].trigger === 15 && paramsForAccount(be.params, a50).STEPS[0].trigger === 30, 'Fast BE trigger 15→30');
assert(paramsForAccount(be.params, a50).STEPS[0].lockTicks === 3, 'Fast BE lockTicks = 3');

const propia = { SL_USD: 400, TP_USD: 800, STEPS: [{ trigger: 100, lock: 50 }], DEFAULT_QTY: { MNQ: 8, NQ: 1 } };
const pp = paramsForAccount(propia, a50);
assert(pp.SL_USD === 800 && pp.TP_USD === 1600 && pp.STEPS[0].trigger === 200 && pp.STEPS[0].lock === 100, 'propias se escalan ×2');

assert(listStrategies().some(s => s.id === 'dos-disparos'), 'listStrategies incluye dos-disparos');

const pnlFromStart = (bal, acc) => Math.round((bal - rulesFor(acc).start) * 100) / 100;
assert(pnlFromStart(24478.5, a25) === -521.5, 'P&L desde 25,000');
assert(pnlFromStart(49800, a50) === -200, 'P&L desde 50,000');

console.log('\n--- Estrategias 25K vs 50K ---');
console.log(JSON.stringify(rows, null, 2));
console.log('\n--- Reglas de cuenta ---');
console.log(JSON.stringify({
  '25K': { ...r25, floor: r25.start - r25.dd, bar: [-r25.dd, r25.dd], listoPorHoy: -r25.dailyLoss, pnlDesdeInicioEjemplo: pnlFromStart(24478.5, a25) },
  '50K': { ...r50, floor: r50.start - r50.dd, bar: [-r50.dd, r50.dd], listoPorHoy: -r50.dailyLoss, pnlDesdeInicioEjemplo: pnlFromStart(49800, a50) },
  diferenciasVsX2: {
    profitTarget: { x2: 2500, oficial: r50.profitTarget },
    lockTriggerOver: { x2: 2200, oficial: r50.lockTriggerOver },
    lockFloorOver: { x2: 200, oficial: r50.lockFloorOver },
  },
}, null, 2));

const texts = {
  'colchon.mjs': fs.readFileSync(path.join(here, 'colchon.mjs'), 'utf8'),
  'tradinglink.mjs': fs.readFileSync(path.join(here, 'tradinglink.mjs'), 'utf8'),
  'tv-vista-previa.mjs': fs.readFileSync(path.join(here, 'tv-vista-previa.mjs'), 'utf8'),
  'orders.mjs': fs.readFileSync(path.join(here, 'orders.mjs'), 'utf8'),
  'Granja-de-Cuentas-v2.html': fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8'),
};
assert(texts['colchon.mjs'].includes('paramsForAccount(strat.params, hint)'), 'colchon escala al abrir');
assert(texts['colchon.mjs'].includes('rulesFor({ id: a.name'), 'colchon publica plan en accounts()');
assert(texts['tradinglink.mjs'].includes('function applyPlan'), 'tradinglink applyPlan');
assert(texts['tradinglink.mjs'].includes('R.start - R.dd'), 'tradinglink piso por plan');
assert(texts['tv-vista-previa.mjs'].includes('paramsForAccount(strat.params'), 'vista previa escala');
assert(texts['tv-vista-previa.mjs'].includes('maxQtyFor(raiz, account'), 'vista previa usa el tope del motor');
assert(texts['orders.mjs'].includes('R.start - R.dd'), 'orders piso por plan');
assert(texts['colchon.mjs'].includes('maxQtyFor'), 'colchon valida qty por plan');
assert(texts['colchon.mjs'].includes('maxMicros: maxQtyFor'), 'colchon publica maxMicros');
assert(texts['orders.mjs'].includes('maxQtyFor(sym, a || {})'), 'orders valida qty por plan');
assert(texts['tradinglink.mjs'].includes('a.maxMicros = maxQtyFor'), 'tradinglink publica maxMicros');
assert(texts['Granja-de-Cuentas-v2.html'].includes('const maxQ='), 'panel maxQ por cuenta');
assert(texts['Granja-de-Cuentas-v2.html'].includes('if(qty>mx)qty=mx'), 'al cambiar cuenta se recorta qty');
assert(texts['Granja-de-Cuentas-v2.html'].includes('profit<1000?20:profit<2000?30:40'), 'panel fallback scaling 50K');
assert(texts['Granja-de-Cuentas-v2.html'].includes('profit<1100?10:20'), 'panel fallback 25K hasta 26100');
assert(texts['Granja-de-Cuentas-v2.html'].includes('dd=n.dd??'), 'Ln usa dd de la cuenta');
assert(texts['Granja-de-Cuentas-v2.html'].includes('dayPn<=-lim0'), 'Listo por hoy usa dailyLoss');
assert(texts['Granja-de-Cuentas-v2.html'].includes('e.ddLeft/(e.dd||1e3)*100'), 'barra DD usa e.dd');
assert(texts['Granja-de-Cuentas-v2.html'].includes('const scaleP='), 'preview SPf escala');
assert(texts['Granja-de-Cuentas-v2.html'].includes('accountName:a.name||accPlan().name'), 'preview envía cuenta');
assert(texts['Granja-de-Cuentas-v2.html'].includes('totalPnl:a.totalPnl'), 'preview envía el beneficio para la etapa');
assert(texts['Granja-de-Cuentas-v2.html'].includes('function textoCuentaHtml()'), 'selector arma el texto');
assert(texts['Granja-de-Cuentas-v2.html'].includes('scaleP(s.params, sc)'), 'el texto usa la misma escala que la orden');
assert(!texts['Granja-de-Cuentas-v2.html'].includes('En 50K el motor duplica los dólares guardados.'), 'el editor no avisa que duplica');
assert(texts['Granja-de-Cuentas-v2.html'].includes('__tlPropia.syncSize'), 'al cambiar de cuenta se refresca el editor');
assert(texts['Granja-de-Cuentas-v2.html'].includes('sl:model.sl,tp:model.tp'), 'el editor guarda la base, no el doble');
assert(!texts['Granja-de-Cuentas-v2.html'].includes('strDesc=()=>esc(((strs||[]).find(x=>x.id===stratId)||{short:""}).short)'), 'el selector ya no pega el short fijo');

function textoEnPagina(strategy, scale) {
  const html = texts['Granja-de-Cuentas-v2.html'];
  const start = html.indexOf('function textoCuentaHtml()');
  const end = html.indexOf('\nconst QS=', start);
  const PV = { MNQ: 2, NQ: 20 }, CR = { MNQ: 1, NQ: 3.5 };
  const ctx = {
    strs: [strategy], stratId: strategy.id, sym: 'MNQ', qty: 8,
    accPlan: () => ({ scale }),
    scaleP: (P, sc) => paramsForAccount(P, { plan: sc === 2 ? '50K' : '25K' }),
    lockU: (y, q, P) => { const t = PV[y] * .25 * q; return Math.round(Math.ceil(((P.NET_USD || 0) + ((P.COMM_RT || CR)[y] || 0) * q + (P.SLIP_TICKS || 0) * t) / t - 1e-9) * t * 100) / 100; },
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start, end) + '\nout = textoCuentaHtml();', ctx);
  return String(ctx.out).replace(/<[^>]+>/g, '\n');
}
const plano = getStrategy('evaluacion-simple');
const t25 = textoEnPagina(plano, 1), t50 = textoEnPagina(plano, 2);
assert(t25.includes('SL −$630') && t25.includes('TP +$630') && !t25.includes('$1,260'), 'texto Evaluación 25K');
assert(t50.includes('SL −$1,260') && t50.includes('TP +$1,260') && !t50.includes('$630'), 'texto Evaluación 50K');
const dd = getStrategy('dos-disparos');
const d25 = textoEnPagina(dd, 1), d50 = textoEnPagina(dd, 2);
assert(d25.includes('SL −$300') && d25.includes('TP +$630') && d25.includes('2 intentos'), 'texto dos disparos 25K');
assert(d50.includes('SL −$600') && d50.includes('TP +$1,260') && !d50.includes('$300'), 'texto dos disparos 50K');
const beTxt = textoEnPagina(getStrategy('prueba-be'), 2);
assert(beTxt.includes('+$30') && beTxt.includes('+3 ticks') && !beTxt.includes('+6 ticks'), 'Fast BE 50K dobla el disparo y deja los ticks');
const ras = textoEnPagina(getStrategy('rascacielo'), 2);
assert(ras.includes('SL −$1,200') && ras.includes('TP +$208'), 'texto Rascacielo 50K');
const col = textoEnPagina(getStrategy('dia-minimo-colchon'), 2);
assert(col.includes('SL −$1,200') && col.includes('TP +$3,200') && col.includes('$200'), 'texto colchón 50K');
const propiaVista = { id: 'propia-abc123', name: 'Mía', propia: true, params: { SL_USD: 400, TP_USD: 800, STEPS: [{ trigger: 100, lock: 50 }] } };
const p25 = textoEnPagina(propiaVista, 1), p50 = textoEnPagina(propiaVista, 2);
assert(p25.includes('SL −$400') && p25.includes('TP +$800') && p25.includes('+$100') && !p25.includes('duplica'), 'propia 25K muestra lo guardado');
assert(p50.includes('SL −$800') && p50.includes('TP +$1,600') && p50.includes('+$200') && !p50.includes('duplica'), 'propia 50K muestra el doble, sin aviso');

if (failed) { console.error('\n' + failed + ' comprobaciones fallaron'); process.exit(1); }
console.log('\nTodas las comprobaciones pasaron.');
