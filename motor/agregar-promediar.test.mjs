import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compute, money } from './agregar-promediar.mjs';
import { createColchon, js } from './colchon.mjs';

const base = {
  symbol: 'MNQ', plan: '25K', comm: 1, qty: 5, avg: 21000, sl: 20950, tp: 21160,
  addQty: 5, ddlLeft: 600, ddLeft: 1000, riskMode: 'keep', tpMode: 'keep',
};

const uno = compute({ ...base, side: 'long', addPrice: 20960, live: 20960 });
assert.equal(uno.ok, true, uno.errors && uno.errors.join(' | '));
assert.ok(Math.abs(uno.avgExact - 20980) < 1e-6);
assert.ok(Math.abs(uno.sl - 20955.25) < 1e-6);
assert.ok(Math.abs(uno.tp - 21060.25) < 1e-6);
assert.equal(money(uno.currentRisk), 505);
assert.equal(money(uno.realRisk), 505);
assert.equal(money(uno.realTarget), 1595);
assert.equal(uno.against, true);
assert.ok(uno.realRisk <= uno.currentRisk + 0.009);

const dos = compute({ ...base, side: 'long', addPrice: 21040, live: 21040 });
assert.equal(dos.ok, true, dos.errors && dos.errors.join(' | '));
assert.equal(dos.favor, true);
assert.ok(Math.abs(dos.avgExact - 21020) < 1e-6);
assert.equal(money(dos.realRisk), 505);
assert.equal(money(dos.realTarget), 1595);

const corto = compute({ ...base, side: 'short', sl: 21050, tp: 20840, addPrice: 21040, live: 21040 });
assert.equal(corto.ok, true, corto.errors && corto.errors.join(' | '));
assert.equal(corto.against, true);
assert.ok(Math.abs(corto.sl - 21044.75) < 1e-6);
assert.ok(Math.abs(corto.tp - 20939.75) < 1e-6);

const tope = compute({ ...base, side: 'long', qty: 18, addQty: 5, addPrice: 20960, live: 20960 });
assert.equal(tope.ok, false);
assert.ok(tope.errors.some(e => /tope Lucid/.test(e)));

const tocado = compute({
  ...base, side: 'long', addQty: 2, addPrice: 20960, live: 20960,
  riskMode: 'custom', customRisk: 401, tpMode: 'custom', customTp: 1600,
});
assert.equal(tocado.ok, false);
assert.ok(money(tocado.realRisk) <= 401);
assert.ok(tocado.errors.some(e => /ya estaría tocado/.test(e)));

const pasa = compute({ ...base, side: 'long', addPrice: 20960, live: 20960, ddlLeft: 100, ddLeft: 200 });
assert.equal(pasa.ok, true, pasa.errors && pasa.errors.join(' | '));
assert.ok(pasa.realRisk > 100);
assert.ok(pasa.warnings.includes('Este SL se pasa de tu daily loss'));
assert.ok(pasa.warnings.includes('Este SL se pasa de tu drawdown'));
assert.equal(pasa.errors.some(e => /daily loss|drawdown/.test(e)), false);
const granja = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(granja, /Este SL se pasa de tu daily loss/);
assert.match(granja, /Este SL se pasa de tu drawdown/);
assert.match(granja, /addWarn/);

function broker({ fallaBracket = false } = {}) {
  const st = { qty: 5, entry: 21000, price: 20960, stop: 20950, tp: 21160 };
  const llamadas = [];
  let cerro = false;
  return {
    st, llamadas,
    cerro: () => cerro,
    position() {
      return { side: 'long', qty: st.qty, entry: st.entry, price: st.price, stop: st.stop, raw: { takeProfit: st.tp }, pnl: -400 };
    },
    async agregarMercado(req) {
      llamadas.push({ op: 'market', symbol: req.tradeSymbol, side: req.side, type: 2, qty: req.addQty, stopLoss: req.sl, takeProfit: req.tp, parentId: req.parentId, parentType: req.parentType });
      if (req.sl == null || req.tp == null) throw new Error('el mercado lleva bracket');
      if (req.parentId != null || req.parentType != null) throw new Error('parentId no viaja en la orden');
      const avg = (st.qty * st.entry + req.addQty * st.price) / (st.qty + req.addQty);
      st.qty += req.addQty;
      st.entry = avg;
      return { ok: true, qty: st.qty, avg, price: st.price, viejos: ['S0', 'T0'] };
    },
    async alinearBracket(req) {
      llamadas.push({ op: 'alinear', ...req });
      if (req.qty != null) throw new Error('no se cambia la cantidad');
      if (fallaBracket) return { ok: false, err: 'verificacion', stops: 2, tps: 2, qty: st.qty };
      st.stop = req.sl;
      st.tp = req.tp;
      return { ok: true, qty: st.qty, stops: 2, tps: 2 };
    },
    async flatten() { cerro = true; return 'ok'; },
  };
}

const b = broker();
const k = createColchon(() => ({
  kind: 'api',
  account: async () => ({ name: 'Practice Demo', broker: 'Tradovate Practice' }),
  accountId: async () => 'p1',
  preparar: async () => ({ accountId: 'p1', name: 'Practice Demo', brokerId: 'paper', tradeSymbol: 'MNQH6' }),
  cotizacion: async () => ({ bid: 20959.75, ask: 20960, last: 20960, leido: Date.now() }),
  position: async () => b.position(),
  stop: async () => b.st.stop,
  working: async () => [],
  openBracket: async () => 'ok market',
  agregarMercado: req => b.agregarMercado(req),
  alinearBracket: req => b.alinearBracket(req),
  flatten: () => b.flatten(),
  ticker: null,
}));

const abierto = await k.start({ side: 'long', symbol: 'MNQ', qty: 5, accountId: 'p1', accountName: 'Practice Demo' });
assert.equal(abierto.ok, true, abierto.err);
const r = await k.add({ addQty: 5 });
assert.equal(r.ok, true, r.err);
assert.deepEqual(b.llamadas.map(x => x.op), ['market', 'alinear']);
assert.equal(b.llamadas[0].type, 2);
assert.equal(b.llamadas[0].qty, 5);
assert.equal(b.llamadas[0].parentId, undefined);
assert.ok(Math.abs(b.llamadas[0].stopLoss - 20955.25) < 1e-6, 'el mercado lleva el SL nuevo');
assert.ok(Math.abs(b.llamadas[0].takeProfit - 21060.25) < 1e-6, 'el mercado lleva el TP nuevo');
assert.deepEqual(b.llamadas[1].viejos, ['S0', 'T0']);
assert.equal(b.llamadas[1].qty, undefined);
assert.ok(Math.abs(b.llamadas[1].sl - 20955.25) < 1e-6, 'el bracket viejo va al mismo SL');
assert.ok(Math.abs(b.llamadas[1].tp - 21060.25) < 1e-6, 'el bracket viejo va al mismo TP');
assert.equal(r.qty, 10);
assert.equal(k.status().qty, 10);
assert.equal(b.cerro(), false);
await k.stop({ flatten: false });

const real = broker();
const fallo = broker({ fallaBracket: true });
const kReal = createColchon(() => ({
  kind: 'api',
  account: async () => ({ name: 'LFE0TEST000026', broker: 'Tradovate' }),
  accountId: async () => 'r1',
  preparar: async () => ({ accountId: 'r1', name: 'LFE0TEST000026', brokerId: 'tradovate', tradeSymbol: 'MNQH6' }),
  cotizacion: async () => ({ bid: 20959.75, ask: 20960, last: 20960, leido: Date.now() }),
  position: async () => real.position(),
  stop: async () => real.st.stop,
  working: async () => [],
  openBracket: async () => 'ok market',
  agregarMercado: req => real.agregarMercado(req),
  alinearBracket: req => real.alinearBracket(req),
  flatten: () => real.flatten(),
  ticker: null,
}));
const abiertoReal = await kReal.start({ side: 'long', symbol: 'MNQ', qty: 5, accountId: 'r1', accountName: 'LFE0TEST000026' });
assert.equal(abiertoReal.ok, true, abiertoReal.err);
assert.equal(kReal.status().mode, 'real');
const enReal = await kReal.add({ addQty: 1 });
assert.equal(enReal.ok, true, enReal.err);
assert.equal(real.llamadas[0].op, 'market');
assert.equal(real.cerro(), false);
await kReal.stop({ flatten: false });

const kFallo = createColchon(() => ({
  kind: 'api',
  account: async () => ({ name: 'LFE0TEST000026', broker: 'Tradovate' }),
  accountId: async () => 'r2',
  preparar: async () => ({ accountId: 'r2', name: 'LFE0TEST000026', brokerId: 'tradovate', tradeSymbol: 'MNQH6' }),
  cotizacion: async () => ({ bid: 20959.75, ask: 20960, last: 20960, leido: Date.now() }),
  position: async () => fallo.position(),
  stop: async () => fallo.st.stop,
  working: async () => [],
  openBracket: async () => 'ok market',
  agregarMercado: req => fallo.agregarMercado(req),
  alinearBracket: req => fallo.alinearBracket(req),
  flatten: () => fallo.flatten(),
  ticker: null,
}));
const abiertoFallo = await kFallo.start({ side: 'long', symbol: 'MNQ', qty: 5, accountId: 'r2', accountName: 'LFE0TEST000026' });
assert.equal(abiertoFallo.ok, true, abiertoFallo.err);
const mal = await kFallo.add({ addQty: 5 });
assert.equal(mal.ok, false);
assert.equal(mal.err, 'Revisa SL/TP en Tradovate');
assert.equal(kFallo.status().alerta, 'Revisa SL/TP en Tradovate');
assert.equal(fallo.llamadas.filter(x => x.op === 'market').length, 1, 'el mercado no se reenvía');
assert.equal(fallo.llamadas.filter(x => x.op === 'alinear').length, 2, 'un reintento del precio');
assert.equal(fallo.cerro(), false, 'un fallo no cierra la posición');
assert.equal(kFallo.status().qty, 10);
assert.notEqual(kFallo.status().sinProteccion, true);
await kFallo.stop({ flatten: false });

assert.equal(js.reemplazarBracket, undefined);
const mercadoSrc = js.agregarMercado({ root: 'MNQ', tradeSymbol: 'CME_MINI:MNQH6', side: 'long', addQty: 5, sl: 20955.25, tp: 21060.25 });
assert.match(mercadoSrc, /stopLoss:SL,takeProfit:TP/);
assert.doesNotMatch(mercadoSrc, /cancelOrder|parentType/);
const alinearSrc = js.alinearBracket({ root: 'MNQ', sl: 20955.25, tp: 21060.25, viejos: ['S0', 'T0'] });
assert.match(alinearSrc, /modifyOrder/);
assert.doesNotMatch(alinearSrc, /cancelOrder|placeOrder/);
assert.doesNotMatch(js.modify('MNQ', 1), /cancelOrder|placeOrder/);
assert.doesNotMatch(js.modifyTp('MNQ', 1), /cancelOrder|placeOrder/);

function pagina() {
  const pos = { id: 'POS', symbol: 'CME_MINI:MNQH6', side: 1, qty: 5, avgPrice: 21000, lastPrice: 20960 };
  const ordenes = [
    { id: 'S0', parentId: 'OSO0', symbol: 'CME_MINI:MNQH6', side: -1, type: 3, status: 6, qty: 5, stopPrice: 20950 },
    { id: 'T0', parentId: 'OSO0', symbol: 'CME_MINI:MNQH6', side: -1, type: 1, status: 6, qty: 5, limitPrice: 21160 },
  ];
  const enviadas = [];
  const cambios = [];
  let cierres = 0, canceles = 0, fallaPrecio = false;
  const ab = {
    _brokerMetainfo: { id: 'tradovate', title: 'Tradovate', configFlags: { supportPositionBrackets: false } },
    currentAccount: () => 'r1',
    async positions() { return [{ ...pos }]; },
    async orders() { return ordenes.filter(o => o.status === 6).map(o => ({ ...o })); },
    async placeOrder(o) {
      enviadas.push({ ...o });
      if (o.parentId != null || o.parentType != null) throw new Error('parent no es campo de la orden');
      if (o.type !== 2 || o.stopLoss == null || o.takeProfit == null) throw new Error('falta el bracket');
      const antes = pos.qty;
      pos.avgPrice = (antes * pos.avgPrice + o.qty * pos.lastPrice) / (antes + o.qty);
      pos.qty += o.qty;
      const id = 'ADD' + enviadas.length;
      ordenes.push({ id: 'S' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 3, status: 6, qty: o.qty, stopPrice: o.stopLoss });
      ordenes.push({ id: 'T' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 1, status: 6, qty: o.qty, limitPrice: o.takeProfit });
      return { orderId: id };
    },
    async modifyOrder(o) {
      const x = ordenes.find(q => q.id === o.id);
      if (!x) return false;
      if (o.qty != null && o.qty !== x.qty) throw new Error('cambió la cantidad');
      cambios.push({ id: o.id, qty: o.qty, stopPrice: o.stopPrice, limitPrice: o.limitPrice });
      if (fallaPrecio && (o.id === 'S0' || o.id === 'T0')) return false;
      if (o.stopPrice != null) x.stopPrice = o.stopPrice;
      if (o.limitPrice != null) x.limitPrice = o.limitPrice;
      return true;
    },
    async cancelOrder() { canceles++; throw new Error('no se cancela'); },
    async closePosition() { cierres++; throw new Error('no se cierra'); },
  };
  const win = {
    TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => ordenes.filter(o => o.status === 6) } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ mainSeries: () => ({ bars: () => ({ last: () => ({ value: [0, 0, 0, 0, pos.lastPrice] }) }) }) }) } }) } },
  };
  const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, { visibilityState: 'hidden', hasFocus: () => false, querySelector: () => null }, performance);
  return { evaluate, pos, ordenes, enviadas, cambios, cierres: () => cierres, canceles: () => canceles, fallar() { fallaPrecio = true; } };
}

{
  const pg = pagina();
  const puesto = await pg.evaluate(js.agregarMercado({ root: 'MNQ', tradeSymbol: 'CME_MINI:MNQH6', side: 'long', addQty: 5, sl: 20955.25, tp: 21060.25 }));
  assert.equal(puesto.ok, true, puesto.err);
  assert.equal(puesto.qty, 10);
  assert.deepEqual(puesto.viejos, ['S0', 'T0']);
  assert.equal(pg.enviadas.length, 1);
  assert.equal(pg.enviadas[0].type, 2);
  assert.equal(pg.enviadas[0].qty, 5);
  assert.equal(pg.enviadas[0].stopLoss, 20955.25);
  assert.equal(pg.enviadas[0].takeProfit, 21060.25);
  assert.equal(pg.enviadas[0].parentId, undefined);
  const nuevoStop = pg.ordenes.find(o => o.id === 'SADD1');
  const nuevoTp = pg.ordenes.find(o => o.id === 'TADD1');
  assert.equal(nuevoStop.qty, 5);
  assert.equal(nuevoTp.qty, 5);
  const visto = await pg.evaluate(js.alinearBracket({ root: 'MNQ', sl: 20955.25, tp: 21060.25, viejos: puesto.viejos }));
  assert.equal(visto.ok, true, JSON.stringify(visto));
  assert.equal(visto.stops, 2);
  assert.equal(visto.tps, 2);
  assert.equal(pg.ordenes.find(o => o.id === 'S0').stopPrice, 20955.25);
  assert.equal(pg.ordenes.find(o => o.id === 'T0').limitPrice, 21060.25);
  assert.equal(pg.ordenes.find(o => o.id === 'S0').qty, 5);
  assert.ok(pg.cambios.every(c => c.qty === 5));
  assert.ok(pg.cambios.every(c => c.id === 'S0' || c.id === 'T0'));
  assert.equal(pg.cierres(), 0);
  assert.equal(pg.canceles(), 0);
  const movido = await pg.evaluate(js.modify('MNQ', 20970));
  assert.equal(movido.ok, true, JSON.stringify(movido));
  assert.equal(movido.n, 2);
  assert.ok(pg.ordenes.filter(o => o.type === 3).every(o => o.stopPrice === 20970 && o.qty === 5));
  const tpMov = await pg.evaluate(js.modifyTp('MNQ', 21080));
  assert.equal(tpMov.ok, true, JSON.stringify(tpMov));
  assert.equal(tpMov.n, 2);
  assert.ok(pg.ordenes.filter(o => o.type === 1).every(o => o.limitPrice === 21080 && o.qty === 5));
  assert.equal(pg.cierres(), 0);
  assert.equal(pg.canceles(), 0);
}

{
  const pg = pagina();
  pg.fallar();
  const puesto = await pg.evaluate(js.agregarMercado({ root: 'MNQ', tradeSymbol: 'CME_MINI:MNQH6', side: 'long', addQty: 2, sl: 20960, tp: 21080 }));
  assert.equal(puesto.ok, true, puesto.err);
  const visto = await pg.evaluate(js.alinearBracket({ root: 'MNQ', sl: 20960, tp: 21080, viejos: puesto.viejos }));
  assert.equal(visto.ok, false);
  assert.equal(pg.ordenes.find(o => o.id === 'S0').stopPrice, 20950);
  assert.equal(pg.ordenes.find(o => o.id === 'S0').qty, 5);
  assert.equal(pg.ordenes.find(o => o.type === 3 && o.id !== 'S0').qty, 2);
  assert.equal(pg.cierres(), 0);
  assert.equal(pg.canceles(), 0);
}

{
  let abierta = true;
  let flats = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-agregar-'));
  const kFlat = createColchon(() => ({
    kind: 'api',
    account: async () => ({ name: 'Practice Demo', broker: 'Tradovate Practice' }),
    preparar: async () => ({ accountId: 'p1', name: 'Practice Demo', brokerId: 'paper', tradeSymbol: 'MNQH6' }),
    cotizacion: async () => ({ bid: 20959.75, ask: 20960, last: 20960, leido: Date.now() }),
    position: async () => abierta ? { side: 'long', qty: 5, entry: 21000, price: 20960, stop: 20950, raw: { takeProfit: 21160 }, pnl: 0 } : null,
    stop: async () => 20950,
    working: async () => abierta ? [] : [
      { id: 's1', type: 3, parentId: 'a', status: 6 },
      { id: 's2', type: 3, parentId: 'b', status: 6 },
      { id: 't1', type: 1, parentId: 'a', status: 6 },
      { id: 't2', type: 1, parentId: 'b', status: 6 },
    ],
    openBracket: async () => 'ok market',
    flatten: async () => { flats++; return 'ok'; },
    ticker: null,
  }), { pollMs: 30, logFile: path.join(tmp, 'c.log'), ignoreClock: true, noTicks: true, flatConfirm: { reads: 2, ms: 0 } });
  const arranco = await kFlat.start({ side: 'long', symbol: 'MNQ', qty: 5, accountId: 'p1', accountName: 'Practice Demo' });
  assert.equal(arranco.ok, true, arranco.err);
  await new Promise(r => setTimeout(r, 120));
  abierta = false;
  await new Promise(r => setTimeout(r, 250));
  assert.equal(kFlat.status().state, 'running', 'varios brackets no dan la posición por cerrada');
  assert.equal(flats, 0);
  await kFlat.stop({ flatten: false });
}

console.log('agregar-promediar ok');
