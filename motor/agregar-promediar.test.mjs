import assert from 'node:assert/strict';
import { compute, money } from './agregar-promediar.mjs';
import { createColchon } from './colchon.mjs';

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
      llamadas.push({ op: 'market', ...req });
      if (req.sl != null || req.tp != null || req.stopLoss != null) throw new Error('el mercado no lleva bracket');
      const avg = (st.qty * st.entry + req.addQty * 20960) / (st.qty + req.addQty);
      st.qty += req.addQty;
      st.entry = avg;
      return { ok: true, qty: st.qty, avg, price: st.price };
    },
    async reemplazarBracket(req) {
      llamadas.push({ op: 'replace', ...req });
      if (req.qty != null && req.qty > st.qty) throw new Error('stop más grande que la posición');
      if (fallaBracket) return { ok: false, err: 'verificacion', stops: 0, tps: 0, qty: st.qty };
      st.stop = req.sl;
      st.tp = req.tp;
      return { ok: true, qty: st.qty, stops: 1, tps: 1 };
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
  reemplazarBracket: req => b.reemplazarBracket(req),
  flatten: () => b.flatten(),
  ticker: null,
}));

const abierto = await k.start({ side: 'long', symbol: 'MNQ', qty: 5, accountId: 'p1', accountName: 'Practice Demo' });
assert.equal(abierto.ok, true, abierto.err);
const r = await k.add({ addQty: 5 });
assert.equal(r.ok, true, r.err);
assert.deepEqual(b.llamadas.map(x => x.op), ['market', 'replace']);
assert.equal(b.llamadas[0].addQty, 5);
assert.equal(b.llamadas[0].sl, undefined);
assert.equal(b.llamadas[1].tradeSymbol, 'MNQH6');
assert.ok(Math.abs(b.llamadas[1].sl - 20955.25) < 1e-6, 'un solo SL recalculado');
assert.ok(Math.abs(b.llamadas[1].tp - 21060.25) < 1e-6, 'un solo TP recalculado');
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
  reemplazarBracket: req => real.reemplazarBracket(req),
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
  reemplazarBracket: req => fallo.reemplazarBracket(req),
  flatten: () => fallo.flatten(),
  ticker: null,
}));
const abiertoFallo = await kFallo.start({ side: 'long', symbol: 'MNQ', qty: 5, accountId: 'r2', accountName: 'LFE0TEST000026' });
assert.equal(abiertoFallo.ok, true, abiertoFallo.err);
const mal = await kFallo.add({ addQty: 5 });
assert.equal(mal.ok, false);
assert.equal(mal.err, 'Sin SL/TP, ponlos a mano');
assert.equal(kFallo.status().alerta, 'Sin SL/TP, ponlos a mano');
assert.equal(fallo.llamadas.filter(x => x.op === 'replace').length, 2, 'un reintento del bracket');
assert.equal(fallo.cerro(), false, 'un fallo no cierra la posición');
assert.equal(kFallo.status().qty, 10);
await kFallo.stop({ flatten: false });

console.log('agregar-promediar ok');
