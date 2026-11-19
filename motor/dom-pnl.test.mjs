// El beneficio del DOM puede disparar un paso entre lecturas del gráfico, y la foto previa al envío no se queda colgada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiDriver, createColchon, js, pnlDomDeTick, pnlDomUsd, ptsFor, roundTick, SNAPSHOT_MS, stepsFor } from './colchon.mjs';
import { getStrategy } from './strategies.mjs';

assert.equal(pnlDomUsd('$20.00'), 20);
assert.equal(pnlDomUsd('−$12.50'), -12.5);
assert.equal(pnlDomUsd('($4.25)'), -4.25);
assert.equal(pnlDomUsd('1,234.50'), 1234.5);
assert.equal(pnlDomUsd('0'), null);
assert.equal(pnlDomUsd('$0.00'), null);
assert.equal(pnlDomUsd(''), null);
assert.equal(pnlDomUsd('Profit'), null);
const cuenta = { entry: 20000, symbol: 'MNQ', account: { name: 'Paper Trading' } };
assert.equal(pnlDomDeTick({ txt: '$20.00', cuenta: 'Paper Trading', simbolo: 'MNQ' }, cuenta), 20);
assert.equal(pnlDomDeTick({ txt: '$20.00', cuenta: 'Otra', simbolo: 'MNQ' }, cuenta), null);
assert.equal(pnlDomDeTick({ txt: '$20.00', cuenta: 'Paper Trading', simbolo: 'NQ' }, cuenta), null);
assert.equal(pnlDomDeTick({ txt: '$0.00', cuenta: 'Paper Trading', simbolo: 'MNQ' }, cuenta), null);
assert.equal(pnlDomDeTick('$20.00', cuenta), null);
assert.equal(SNAPSHOT_MS, 300);

function pagina() {
  const orders = [], positions = [], stops = [];
  let px = 20000, colocadas = 0;
  const ab = {
    _brokerMetainfo: { id: 'Paper', title: 'Paper Trading' },
    currentAccount: () => '1',
    async accountsMetainfo() { return [{ id: '1', name: 'Paper Trading', type: 'demo' }]; },
    setCurrentAccount() {},
    async positions() { const fill = globalThis.__fill ?? px; return positions.map(p => ({ ...p, pl: globalThis.__pl ?? 0, lastPrice: fill, avgPrice: fill, stopLoss: (orders.find(o => o.type === 3) || {}).stopPrice, takeProfit: (orders.find(o => o.type === 1) || {}).limitPrice })); },
    async orders() { return orders.filter(o => o.status === 6).map(o => ({ ...o })); },
    async ordersHistory() { if (globalThis.__histHang && !globalThis.__histYa) { globalThis.__histYa = true; return new Promise(() => {}); } return []; },
    async allExecutions() { if (globalThis.__execHang && !globalThis.__execYa) { globalThis.__execYa = true; return new Promise(() => {}); } return []; },
    async symbolInfo(sy) { return { name: sy }; },
    async placeOrder(o) {
      colocadas++;
      if (globalThis.__sinPos) return { orderId: 'P' + colocadas };
      const id = 'P' + colocadas;
      positions.push({ id, symbol: o.symbol, side: o.side, qty: o.qty, avgPrice: globalThis.__fill ?? px });
      orders.push({ id: 'S' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 3, status: 6, qty: o.qty, stopPrice: o.stopLoss });
      orders.push({ id: 'T' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 1, status: 6, qty: o.qty, limitPrice: o.takeProfit });
      return { orderId: id };
    },
    async editPositionBrackets(_id, b) { const so = orders.find(o => o.type === 3); if (so && b && b.stopLoss != null) { so.stopPrice = b.stopLoss; stops.push(b.stopLoss); } const to = orders.find(o => o.type === 1); if (to && b && b.takeProfit != null) to.limitPrice = b.takeProfit; return true; },
    async modifyOrder(o) { const x = orders.find(q => q.id === o.id); if (x) Object.assign(x, o); return true; },
    async closePosition() { positions.length = 0; return true; },
  };
  const win = {
    TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => orders.filter(o => o.status === 6) } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ symbol: () => 'CME_MINI:MNQ1!', _chartWidget: { model: () => ({ mainSeries: () => ({ symbol: () => 'CME_MINI:MNQ1!', symbolInfo: () => ({ front_contract: 'MNQZ2026' }), quotes: () => ({ bid: px - 0.25, ask: px, last: px }), bars: () => ({ last: () => ({ value: [0, 0, 0, 0, px] }) }) }) }) } }) } },
  };
  const doc = { get visibilityState() { return 'hidden'; }, hasFocus: () => false, querySelector: s => /accountName/.test(s) ? { innerText: 'Paper Trading' } : null };
  const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, doc, performance);
  return { evaluate, orders, stops, colocadas: () => colocadas };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-dom-'));
const logFile = path.join(tmp, 'colchon.log');
let tick = null;
const ticker = { async start(_root, fn) { tick = fn; return { ok: true, fuentes: ['b:dom'] }; }, async stop() { tick = null; } };

{
  const pg = pagina();
  const k = createColchon(apiDriver(pg.evaluate, null, ticker), { pollMs: 40, logFile, ignoreClock: true, flatConfirm: { reads: 1, ms: 0 }, realAllowFile: path.join(tmp, 'no.json'), fuente: { modo: 'mas-rapido', frescoMs: 2000, pollMs: 40 } });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'prueba-be', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.ok, true, r.err);
  await new Promise(z => setTimeout(z, 200));
  assert.equal(typeof tick, 'function');
  tick({ k: 'bar', v: 20000, t: Date.now() });
  tick({ k: 'b:dom.Profit', v: { txt: '$40.00', cuenta: 'Otra cuenta', simbolo: 'MNQ' }, t: Date.now() });
  tick({ k: 'b:dom.Profit', v: { txt: '$0.00', cuenta: 'Paper Trading', simbolo: 'MNQ' }, t: Date.now() });
  await new Promise(z => setTimeout(z, 180));
  assert.equal(fs.readFileSync(logFile, 'utf8').includes('(dom)'), false);
  tick({ k: 'bar', v: 20000, t: Date.now() });
  tick({ k: 'b:dom.Profit', v: { txt: '$20.00', cuenta: 'Paper Trading', simbolo: 'MNQ' }, t: Date.now() });
  let visto = false;
  for (let i = 0; i < 20 && !visto; i++) { await new Promise(z => setTimeout(z, 50)); visto = fs.readFileSync(logFile, 'utf8').includes('(dom)'); }
  assert.equal(visto, true, fs.readFileSync(logFile, 'utf8'));
  assert.equal(pg.colocadas(), 1);
  await k.stop({ flatten: false });
}

{
  const pg = pagina();
  globalThis.__execHang = true; globalThis.__histHang = true;
  const t0 = Date.now();
  const expr = js.place({ symbol: 'CME_MINI:MNQ1!', side: 1, type: 2, qty: 1, stopLoss: 19900, takeProfit: 20100 });
  const out = await pg.evaluate(expr);
  const dt = Date.now() - t0;
  delete globalThis.__execHang; delete globalThis.__histHang; delete globalThis.__execYa; delete globalThis.__histYa;
  assert.equal(out.parcial, true);
  assert.equal(out.ok, true);
  assert.equal(pg.colocadas(), 1);
  assert.ok(out.snapMs >= 500 && out.snapMs < 900, 'snapshot ' + out.snapMs);
  assert.ok(dt < 1200, 'tardó ' + dt);
}

{
  const pg = pagina();
  globalThis.__execHang = true; globalThis.__histHang = true; globalThis.__sinPos = true; delete globalThis.__execYa; delete globalThis.__histYa;
  const k = createColchon(apiDriver(pg.evaluate, null, ticker), { pollMs: 40, logFile: path.join(tmp, 'snap.log'), ignoreClock: true, flatConfirm: { reads: 1, ms: 0 }, fillWaitMs: 200, adoptMs: 400, realAllowFile: path.join(tmp, 'no.json') });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'prueba-be', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  delete globalThis.__execHang; delete globalThis.__histHang; delete globalThis.__sinPos; delete globalThis.__execYa; delete globalThis.__histYa;
  assert.equal(r.ok, false);
  assert.equal(pg.colocadas(), 1);
  assert.match(String(r.err), /lectura previa incompleta/);
  assert.doesNotMatch(String(r.err), /no se llenó/);
  assert.match(fs.readFileSync(path.join(tmp, 'snap.log'), 'utf8'), /snapshot \d+ ms/);
}

{
  const pg = pagina();
  const fill = 20010;
  const P = getStrategy('prueba-be').params;
  const paso = stepsFor('MNQ', 1, P)[0];
  const esperado = roundTick(fill + paso.lockPts);
  const peor = roundTick(fill - ptsFor(P.SL_USD, 'MNQ', 1));
  assert.ok(paso.triggerUsd <= 20, 'el P&L de prueba tiene que pasar el disparo');
  assert.ok(esperado > peor);
  globalThis.__fill = fill; globalThis.__pl = 20;
  const logPaso = path.join(tmp, 'paso.log');
  const k = createColchon(apiDriver(pg.evaluate, null, ticker), { pollMs: 40, logFile: logPaso, ignoreClock: true, flatConfirm: { reads: 1, ms: 0 }, realAllowFile: path.join(tmp, 'no.json'), fuente: { modo: 'mas-rapido', frescoMs: 2000, pollMs: 40 } });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'prueba-be', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.ok, true, r.err);
  let texto = '';
  for (let i = 0; i < 30 && !/TIEMPOS: orden paso→ajuste/.test(texto); i++) { await new Promise(z => setTimeout(z, 50)); texto = fs.readFileSync(logPaso, 'utf8'); }
  delete globalThis.__fill; delete globalThis.__pl;
  await k.stop({ flatten: false });
  assert.match(texto, /TIEMPOS: orden paso→ajuste/);
  assert.ok(texto.indexOf('paso 1/') < texto.indexOf('Ajuste por fill'), texto);
  assert.equal(pg.stops[0], esperado, 'stops ' + pg.stops.join(','));
  assert.ok(!pg.stops.includes(peor), 'el reajuste pisó el paso: ' + pg.stops.join(','));
  assert.equal(pg.orders.find(o => o.type === 3).stopPrice, esperado);
}

console.log('dom-pnl ok');
