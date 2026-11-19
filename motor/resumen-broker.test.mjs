// El resumen usa el mismo P&L que la fila del historial, y el motivo sale del precio de salida.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiDriver, createColchon } from './colchon.mjs';
import { cierreDesdeEjecuciones } from './pnl-sesion.mjs';

const entrada = 26807.25, salida = 26808, openAt = 1_700_000_000_000;
const ex = [
  { id: 'e1', symbol: 'CME_MINI:MNQZ2026', price: entrada, qty: 1, side: 1, time: openAt },
  { id: 'e2', symbol: 'CME_MINI:MNQZ2026', price: salida, qty: 1, side: -1, time: openAt + 5000 },
];
const cierre = cierreDesdeEjecuciones(ex, { openAt, side: 'long', cuenta: 'Paper Trading', cuentaBroker: 'Paper Trading' });
assert.equal(cierre.salida, salida);
assert.equal(cierre.pnlBruto, 1.5);
assert.equal(cierre.pnl, 0.5, 'la fila del historial resta $1 de comisión cuando el bróker no la manda');
assert.equal(cierreDesdeEjecuciones(ex, { openAt, side: 'long', cuenta: 'Paper Trading', cuentaBroker: 'Otra' }), null);
assert.equal(cierreDesdeEjecuciones(ex, { openAt, side: 'short', cuenta: 'Paper Trading', cuentaBroker: 'Paper Trading' }), null);

function pagina(st) {
  const orders = [], positions = [];
  const ab = {
    _brokerMetainfo: { id: 'Paper', title: 'Paper Trading' },
    currentAccount: () => '1',
    async accountsMetainfo() { return [{ id: '1', name: 'Paper Trading', type: 'demo' }]; },
    setCurrentAccount() {},
    async positions() {
      if (!st.vivo) return [];
      return positions.map(p => ({ ...p, pl: st.pl, lastPrice: st.bar, avgPrice: st.ask, stopLoss: (orders.find(o => o.type === 3) || {}).stopPrice, takeProfit: (orders.find(o => o.type === 1) || {}).limitPrice }));
    },
    async orders() { return st.vivo ? orders.filter(o => o.status === 6).map(o => ({ ...o })) : []; },
    async ordersHistory() { return []; },
    async allExecutions() { return []; },
    async symbolInfo(sy) { return { name: sy }; },
    async placeOrder(o) {
      const id = 'P1';
      positions.push({ id, symbol: o.symbol, side: o.side, qty: o.qty, avgPrice: st.ask });
      orders.push({ id: 'S' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 3, status: 6, qty: o.qty, stopPrice: o.stopLoss });
      orders.push({ id: 'T' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 1, status: 6, qty: o.qty, limitPrice: o.takeProfit });
      return { orderId: id };
    },
    async editPositionBrackets(_id, b) {
      const so = orders.find(o => o.type === 3);
      if (so && b && b.stopLoss != null) so.stopPrice = b.stopLoss;
      const to = orders.find(o => o.type === 1);
      if (to && b && b.takeProfit != null) to.limitPrice = b.takeProfit;
      return true;
    },
    async modifyOrder(o) { const x = orders.find(q => q.id === o.id); if (x) Object.assign(x, o); return true; },
    async closePosition() { st.vivo = false; positions.length = 0; orders.length = 0; return true; },
  };
  const win = {
    TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => st.vivo ? orders.filter(o => o.status === 6) : [] } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ symbol: () => 'CME_MINI:MNQ1!', _chartWidget: { model: () => ({ mainSeries: () => ({ symbol: () => 'CME_MINI:MNQ1!', symbolInfo: () => ({ front_contract: 'MNQZ2026' }), quotes: () => ({ bid: st.ask - 0.25, ask: st.ask, last: st.ask }), bars: () => ({ last: () => ({ value: [0, 0, 0, 0, st.bar] }) }) }) }) } }) } },
  };
  const doc = { get visibilityState() { return 'hidden'; }, hasFocus: () => false, querySelector: s => /accountName/.test(s) ? { innerText: 'Paper Trading' } : null };
  const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, doc, performance);
  return { evaluate, orders };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-resumen-'));
async function correr(st, hook, extra = {}) {
  const pg = pagina(st);
  const logFile = path.join(tmp, 'r-' + Math.random().toString(16).slice(2) + '.log');
  let llamadas = 0;
  const k = createColchon(apiDriver(pg.evaluate), {
    pollMs: 40, logFile, ignoreClock: true, noTicks: true, flatConfirm: { reads: 1, ms: 0 },
    realAllowFile: path.join(tmp, 'no.json'), fuente: { modo: 'broker', frescoMs: 2000, pollMs: 40 },
    pnlFinalBroker: async (q) => { llamadas++; return hook(q, llamadas); },
    ...extra,
  });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'prueba-be', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.ok, true, r.err);
  let texto = '';
  for (let i = 0; i < 40 && !texto.includes('paso 1/'); i++) { await new Promise(z => setTimeout(z, 50)); texto = fs.readFileSync(logFile, 'utf8'); }
  assert.match(texto, /paso 1\//, texto);
  st.pl = 14;
  await new Promise(z => setTimeout(z, 200));
  st.vivo = false;
  for (let i = 0; i < 160 && !k.summary(); i++) await new Promise(z => setTimeout(z, 50));
  const sm = k.summary();
  if (!sm) throw new Error(k.status().state + '\n' + fs.readFileSync(logFile, 'utf8'));
  return sm;
}

{
  const sm = await correr({ pl: 20, bar: 26814.25, ask: entrada, vivo: true }, (q, n) => n < 2 ? null : cierreDesdeEjecuciones(ex.map(x => ({ ...x, time: x.time === openAt ? q.openAt : q.openAt + 5000 })), { openAt: q.openAt, side: q.side, cuenta: q.cuenta, cuentaBroker: q.cuenta }));
  assert.equal(sm.pnlFinalUSD, cierre.pnl);
  assert.notEqual(sm.pnlFinalUSD, 14);
  assert.equal(sm.pnlFinalAprox, false);
  assert.equal(sm.motivo, 'Stop loss');
  assert.equal(sm.entrada, entrada);
}

{
  const sm = await correr({ pl: 20, bar: 26814.25, ask: entrada, vivo: true }, () => null, { cierreEsperaMs: 400 });
  assert.equal(sm.pnlFinalUSD, 14);
  assert.equal(sm.pnlFinalAprox, true);
  assert.equal(sm.motivo, 'Posición cerrada');
}

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const btn = html.slice(html.indexOf('[data-stop]").onclick'), html.indexOf('[data-stop]").onclick') + 160);
assert.match(btn, /flatten:true/);
assert.doesNotMatch(btn, /confirm\(/);

console.log('resumen-broker ok');
