// La apertura no puede decir "no se llenó" si el bróker sí llenó, ni cerrar la posición por esa duda.
import assert from 'node:assert/strict';
import { apiDriver, bracketsSeguros, createColchon, js, planAlAbrir, stepsFor } from './colchon.mjs';
import { getStrategy } from './strategies.mjs';

process.env.COLCHON_FILL_MS = '350';

function pagina(opts = {}) {
  const live = opts.live ?? 27727.75;
  const chart = opts.chart ?? 27720;
  let px = live, nid = 1, lecturas = 0;
  const positions = [], orders = [], hist = [], execs = [], placed = [], closes = [];
  const ab = {
    _brokerMetainfo: { id: 'paper', title: 'Paper Trading' },
    currentAccount: () => '1',
    async accountsMetainfo() { return [{ id: '1', name: 'Paper Trading', type: 'demo' }]; },
    async symbolInfo(sy) { if (opts.symFail && /1!$/.test(sy)) throw new Error('no'); return { name: sy }; },
    async positions() {
      lecturas++;
      if (opts.throwAlways || (opts.throwN && lecturas <= opts.throwN)) throw new Error('tv ocupado');
      if (opts.revealAt && lecturas < opts.revealAt) return [];
      return positions.filter(p => p && Number(p.qty) !== 0).map(p => ({ ...p, lastPrice: px }));
    },
    async orders() { return orders.filter(o => o.status === 6).map(o => ({ ...o })); },
    async ordersHistory() { return hist; },
    async allExecutions() { return execs; },
    async executions() { return execs; },
    async placeOrder(o) {
      placed.push({ ...o });
      if (o.type === 1 || o.type === 3) {
        const id = (o.type === 3 ? 'S' : 'T') + nid++;
        orders.push({ id, parentId: o.parentId, symbol: o.symbol, side: o.side, type: o.type, status: 6, qty: o.qty, stopPrice: o.stopPrice ?? null, limitPrice: o.limitPrice ?? null });
        return { orderId: id };
      }
      if (opts.reject) { hist.push({ id: 'R' + nid++, symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 5, message: { text: 'rechazada' } }); return {}; }
      const through = o.takeProfit != null && (o.side === 1 ? o.takeProfit <= px : o.takeProfit >= px);
      const id = 'M' + nid++;
      hist.push({ id, symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 2 });
      execs.push({ id: id + 'e', symbol: o.symbol, side: o.side, qty: o.qty, price: px, time: Date.now() });
      if (through || opts.alreadyFlat) {
        execs.push({ id: id + 'x', symbol: o.symbol, side: -o.side, qty: o.qty, price: opts.exitPx ?? px, time: Date.now() });
        return { orderId: id };
      }
      positions.push({ id: 'P' + nid++, symbol: o.symbol, side: o.side, qty: o.qty, avgPrice: opts.fillPx ?? px, lastPrice: px });
      return { orderId: id };
    },
    async editPositionBrackets(id, b) {
      const p = positions.find(q => q.id === id); if (!p) return false;
      if (b.stopLoss != null) orders.unshift({ id: 'S' + nid++, parentId: p.id, symbol: p.symbol, side: -p.side, type: 3, status: 6, qty: p.qty, stopPrice: b.stopLoss });
      if (b.takeProfit != null) orders.push({ id: 'T' + nid++, parentId: p.id, symbol: p.symbol, side: -p.side, type: 1, status: 6, qty: p.qty, limitPrice: b.takeProfit });
      return true;
    },
    async closePosition(id) { closes.push(id); const i = positions.findIndex(p => p.id === id); if (i >= 0) positions.splice(i, 1); orders.length = 0; return true; },
  };
  const win = { TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => orders.filter(o => o.status === 6) } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ mainSeries: () => ({ symbol: () => 'CME_MINI:MNQ1!', symbolInfo: () => ({ front_contract: 'MNQZ2026' }), bars: () => ({ last: () => ({ value: [0, 0, 0, 0, chart] }) }) }) }) } }) } } };
  const doc = { visibilityState: 'hidden', hasFocus: () => false, querySelector: s => /accountName/.test(s) ? { innerText: 'Paper Trading' } : null };
  win.performance = globalThis.performance;
  const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, doc, performance);
  return { evaluate, placed, positions, orders, closes, ab };
}

const ok = (c, m) => { if (!c) { console.error('FAIL ' + m); process.exitCode = 1; } else console.log('PASS ' + m); };

const lejos = bracketsSeguros('long', 27720, 27727.75, 15, 2.5);
ok(lejos.tp == null && lejos.sl === 27705, 'un objetivo calculado con la vela, ya cruzado por el precio vivo, no se arma (' + JSON.stringify(lejos) + ')');
const real = bracketsSeguros('long', 27727.75, 27727.75, 15, 2.5);
ok(real.sl === 27712.75 && real.tp === 27730.25, 'desde el fill, SL 15 pts y TP 2.5 pts (' + JSON.stringify(real) + ')');

{ const pg = pagina({ chart: 27720, live: 27727.75 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  const mkt = pg.placed.find(o => o.type === 2);
  ok(pg.positions.length === 1 && pg.closes.length === 0, 'precio de la vela lejos del fill: la posición sigue abierta y no se aplana (' + r + ')');
  ok(mkt && mkt.stopLoss == null && mkt.takeProfit == null, 'la orden a mercado no lleva stop ni objetivo');
  ok(!String(r).includes('no se llenó') && String(r).startsWith('ok'), 'no dice que no se llenó');
  const sl = pg.orders.find(o => o.type === 3), tp = pg.orders.find(o => o.type === 1);
  ok(sl && sl.stopPrice === 27712.75 && tp && tp.limitPrice === 27730.25, `SL/TP salen del fill 27727.75, no de la vela (${sl && sl.stopPrice}/${tp && tp.limitPrice})`); }

{ const pg = pagina({ revealAt: 3 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.positions.length === 1 && pg.closes.length === 0 && String(r).startsWith('ok') && !String(r).includes('no se llenó'), 'la posición aparece tarde y se adopta (' + r + ')'); }

{ const pg = pagina({ alreadyFlat: true, exitPx: 27726.75 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.closes.length === 0 && pg.placed.filter(o => o.type !== 2).length === 0, 'si ya está cerrada no se manda otra orden ni un cierre');
  ok(String(r).includes('sí se llenó') && !String(r).includes('no se llenó'), 'no dice que no se llenó cuando el fill existe (' + r + ')'); }

{ const pg = pagina({ throwAlways: true });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.closes.length === 0 && !String(r).includes('no se llenó') && /no se cierra nada/i.test(String(r)), 'lectura rota: no afirma que no hubo fill y no cierra (' + r + ')'); }

{ const pg = pagina({ reject: true });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.positions.length === 0 && pg.closes.length === 0 && /no se llenó/.test(String(r)) && /RECHAZADA/.test(String(r)), 'un rechazo sí es no se llenó (' + r + ')'); }

{ const pg = pagina({ chart: 27720, live: 27727.75 });
  const k = createColchon(apiDriver(pg.evaluate), { pollMs: 40, logFile: '/tmp/apertura-incierta.log', ignoreClock: true, flatConfirm: { reads: 3, ms: 1000 }, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 20, strategyId: 'rascacielo' });
  ok(r.ok && k.status().state === 'running' && pg.positions.length === 1 && pg.closes.length === 0, 'Rascacielo 20 MNQ arranca sobre la posición real (' + (r.err || k.status().error || 'ok') + ')');
  const sl = pg.orders.find(o => o.type === 3), tp = pg.orders.find(o => o.type === 1);
  ok(sl && sl.stopPrice === 27712.75 && tp && tp.limitPrice === 27730.25, `el objetivo de $104 queda a 2.5 pts del fill, no de la vela (${tp && tp.limitPrice})`);
  assert.doesNotMatch(js.fill('MNQ', 1, 1, 'CME_MINI:MNQZ2026', 200), /closePosition/);
  assert.doesNotMatch(js.adopt('MNQ', 15, 2.5), /closePosition/);
  await k.stop({ flatten: false });
  ok(pg.positions.length === 1 && pg.closes.length === 0, 'detener sin aplanar no llama a closePosition'); }

const pasosEval = stepsFor('MNQ', 8, getStrategy('evaluacion').params);
const enPaso = planAlAbrir({ side: 'long', entry: 20000, price: 20012.5, steps: pasosEval, slPts: 39.5, tpPts: 39.5, usdPerPoint: 16 });
ok(enPaso.stepIndex === 0 && enPaso.sl === 20000 && enPaso.nextStep === 1 && enPaso.tpPlace === 20039.5 && !enPaso.tpReached, 'con +$200 el stop nace en el paso 1 (entrada), no en el stop inicial (' + JSON.stringify(enPaso) + ')');
const salto = planAlAbrir({ side: 'long', entry: 20000, price: 20031.25, steps: pasosEval, slPts: 39.5, tpPts: 39.5, usdPerPoint: 16 });
ok(salto.step && salto.step.n === 3 && salto.sl === 20012.5 && salto.nextStep === 3 && salto.locked, 'si el precio ya está en el paso 3, el stop nace ahí (' + JSON.stringify({ n: salto.step && salto.step.n, sl: salto.sl }) + ')');
const cruzado = planAlAbrir({ side: 'long', entry: 100, price: 105, steps: [{ n: 1, triggerUsd: 1, lockUsd: 20, lockPts: 20 }], slPts: 10, tpPts: 50, usdPerPoint: 1 });
ok(cruzado.stepIndex == null && cruzado.sl === 90 && cruzado.sl < 105, 'un stop de escalón ya cruzado no se pone; queda el inicial si aún es válido (' + cruzado.sl + ')');
const objetivo = planAlAbrir({ side: 'long', entry: 27727.75, price: 27740, steps: [], slPts: 15, tpPts: 2.5, usdPerPoint: 40 });
ok(objetivo.tpReached && objetivo.tp === 27730.25 && objetivo.sl == null, 'si el precio ya pasó el objetivo, el plan no arma un stop del lado malo');

{ const pg = pagina({ chart: 20000, live: 20012.5, fillPx: 20000 });
  const k = createColchon(apiDriver(pg.evaluate), { pollMs: 40, logFile: '/tmp/apertura-paso.log', ignoreClock: true, flatConfirm: { reads: 3, ms: 1000 }, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 8, strategyId: 'evaluacion' });
  await new Promise(z => setTimeout(z, 250));
  const sl = pg.orders.find(o => o.type === 3);
  ok(r.ok && k.status().step === 1 && sl && sl.stopPrice === 20000 && pg.closes.length === 0, `el stop queda en el paso 1 y la gestión sigue desde ahí (step ${k.status().step}, SL ${sl && sl.stopPrice})`);
  ok(k.status().pasos && k.status().pasos[0] && k.status().pasos[0].paso === 1, 'el paso 1 queda anotado al abrir');
  await k.stop({ flatten: false }); }

{ const pg = pagina({ chart: 27720, live: 27740, fillPx: 27727.75 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5, steps: [] });
  ok(pg.closes.length === 1 && pg.positions.length === 0 && pg.orders.every(o => o.type !== 3), 'objetivo ya pasado: un solo cierre a mercado, sin stop del lado malo (' + r + ')');
  ok(String(r).includes('objetivo ya pasado') && !String(r).includes('no se llenó'), 'el cierre es el objetivo, no un fallo de fill'); }

if (process.exitCode) process.exit(process.exitCode);
console.log('apertura-incierta ok');
