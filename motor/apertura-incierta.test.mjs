// La orden a mercado sale CON el stop y el objetivo, calculados con el bid/ask de ahora.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { apiDriver, bracketEntrada, bracketsSeguros, createColchon, encolarSiOcupado, js, liberarPrueba, planAlAbrir, reintentaEvaluate, stepsFor, acctGuard } from './colchon.mjs';
import { getStrategy } from './strategies.mjs';

process.env.COLCHON_FILL_MS = '400';
process.env.COLCHON_DUDA_MS = '700';

function pagina(opts = {}) {
  const book = opts.book || { front: 'MNQZ2026', bid: (opts.live ?? 27727.75) - 0.25, ask: opts.live ?? 27727.75, live: opts.live ?? 27727.75, chart: opts.chart ?? 27720 };
  if (!book.account) book.account = '1';
  let px = book.live, nid = 1, lecturas = 0;
  const positions = opts.positions || [], orders = [], hist = [], execs = [], placed = [], closes = [], reduces = [];
  const ab = {
    _brokerMetainfo: { id: opts.broker || 'paper', title: 'Paper Trading' },
    currentAccount: () => book.account,
    accountMetainfo: () => (opts.noPB ? { config: { supportPositionBrackets: false } } : {}),
    async accountsMetainfo() { return [{ id: '1', name: 'Paper Trading', type: 'demo' }]; },
    async symbolInfo(sy) {
      if (opts.symFail && /1!$/.test(sy)) throw new Error('no');
      if (book.front && !String(sy).includes(book.front) && /1!$/.test(sy)) throw new Error('continuo');
      if (book.solo && !String(sy).includes(book.solo)) throw new Error('vencido ' + sy);
      return { name: sy };
    },
    async positions() {
      lecturas++;
      if (opts.throwAlways || (opts.throwN && lecturas <= opts.throwN)) throw new Error('tv ocupado');
      if (opts.revealAt && lecturas < opts.revealAt) return [];
      return positions.filter(p => p && Number(p.qty) !== 0).map(p => ({ ...p, lastPrice: px }));
    },
    async orders() { return orders.filter(o => o.status === 6).map(o => ({ ...o })); },
    async ordersHistory() { return hist.map(o => ({ ...o })); },
    async allExecutions() { return execs.map(x => ({ ...x })); },
    async executions() { return execs.map(x => ({ ...x })); },
    async placeOrder(o) {
      placed.push({ ...o });
      if (o.type === 1 || o.type === 3) {
        const id = (o.type === 3 ? 'S' : 'T') + nid++;
        orders.push({ id, parentId: o.parentId || null, symbol: o.symbol, side: o.side, type: o.type, status: 6, qty: o.qty, stopPrice: o.stopPrice ?? null, limitPrice: o.limitPrice ?? null });
        return { orderId: id };
      }
      if (opts.reject) {
        const id = 'R' + nid++;
        hist.push({ id, symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 5, message: { text: 'rechazada' } });
        return { orderId: id };
      }
      if (positions.length && o.side === -positions[0].side) {
        if (opts.closeFail) return false;
        const p = positions[0];
        const q = Math.min(o.qty, Math.abs(Number(p.qty)));
        const id = 'C' + nid++;
        const exitPx = px;
        reduces.push({ qty: q, price: exitPx, orderId: id });
        hist.push({ id, parentId: null, symbol: p.symbol, type: 2, side: o.side, qty: q, status: 2 });
        execs.push({ id: id + 'e', orderId: id, symbol: p.symbol, side: o.side, qty: q, price: exitPx, time: Date.now() });
        p.qty -= q;
        if (p.qty <= 0) positions.splice(positions.indexOf(p), 1);
        return { orderId: id };
      }
      const id = 'M' + nid++;
      hist.push({ id, symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 2 });
      execs.push({ id: id + 'e', orderId: id, symbol: o.symbol, side: o.side, qty: o.qty, price: opts.fillPx ?? px, time: Date.now() });
      if (opts.alreadyFlat) {
        const xid = 'X' + nid++;
        hist.push({ id: xid, parentId: id, symbol: o.symbol, type: 1, side: -o.side, qty: o.qty, status: 2 });
        execs.push({ id: xid + 'e', orderId: xid, parentId: id, symbol: o.symbol, side: -o.side, qty: o.qty, price: opts.exitPx ?? px, time: Date.now() });
        return { orderId: id };
      }
      const q = opts.partialQty ?? o.qty;
      const pid = 'P' + nid++;
      positions.push({ id: pid, symbol: o.symbol, side: o.side, qty: q, avgPrice: opts.fillPx ?? px, lastPrice: px });
      if (!opts.noChildren && o.stopLoss != null) orders.push({ id: 'S' + nid++, parentId: id, symbol: o.symbol, side: -o.side, type: 3, status: 6, qty: q, stopPrice: o.stopLoss });
      if (!opts.noChildren && o.takeProfit != null) orders.push({ id: 'T' + nid++, parentId: id, symbol: o.symbol, side: -o.side, type: 1, status: 6, qty: q, limitPrice: o.takeProfit });
      return { orderId: id };
    },
    async editPositionBrackets(id, b) {
      if (opts.noPB) return false;
      const p = positions.find(q => q.id === id); if (!p) return false;
      let so = orders.find(o => o.type === 3 && o.parentId != null);
      if (b.stopLoss != null) { if (so) so.stopPrice = b.stopLoss; else orders.unshift({ id: 'S' + nid++, parentId: p.id, symbol: p.symbol, side: -p.side, type: 3, status: 6, qty: p.qty, stopPrice: b.stopLoss }); }
      let tp = orders.find(o => o.type === 1 && o.parentId != null);
      if (b.takeProfit != null) { if (tp) tp.limitPrice = b.takeProfit; else orders.push({ id: 'T' + nid++, parentId: p.id, symbol: p.symbol, side: -p.side, type: 1, status: 6, qty: p.qty, limitPrice: b.takeProfit }); }
      return true;
    },
    async modifyOrder(o) {
      const x = orders.find(q => q.id === o.id); if (!x) return false;
      if (o.stopPrice != null) x.stopPrice = o.stopPrice;
      if (o.limitPrice != null) x.limitPrice = o.limitPrice;
      return true;
    },
    async closePosition(id) { closes.push(id); const i = positions.findIndex(p => p.id === id); if (i >= 0) positions.splice(i, 1); orders.length = 0; return true; },
  };
  const win = { TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => orders.filter(o => o.status === 6) } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ mainSeries: () => ({
      symbol: () => 'CME_MINI:MNQ1!',
      symbolInfo: () => ({ front_contract: book.front }),
      quotes: () => ({ bid: book.bid, ask: book.ask }),
      bars: () => ({ last: () => ({ value: [0, 0, 0, 0, book.chart] }) }),
    }) }) } }) } } };
  const doc = { visibilityState: 'hidden', hasFocus: () => false, querySelector: s => /accountName/.test(s) ? { innerText: 'Paper Trading' } : null };
  win.performance = globalThis.performance;
  const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, doc, performance);
  return { evaluate, placed, positions, orders, closes, reduces, ab, book, hist };
}

const ok = (c, m) => { if (!c) { console.error('FAIL ' + m); process.exitCode = 1; } else console.log('PASS ' + m); };
const dormir = ms => new Promise(r => setTimeout(r, ms));

ok(reintentaEvaluate(js.enviar({ root: 'MNQ', side: 1, qty: 1, slPts: 15, tpPts: 2.5, accountId: '1', symbol: 'CME_MINI:MNQZ2026', front: 'MNQZ2026' }), new Error('WebSocket disconnect')) === false, 'la llamada de la orden no se reintenta ni por desconexión');
ok(reintentaEvaluate(js.enviar({ root: 'MNQ', side: 1, qty: 1, slPts: 15, tpPts: 2.5, accountId: '1', symbol: 'CME_MINI:MNQZ2026', front: null }), new Error('Timeout')) === false, 'la llamada de la orden no se reintenta por tiempo agotado');
ok(!/placeOrder/.test(js.preparar('MNQ', 'MNQZ2026')) && reintentaEvaluate(js.preparar('MNQ', 'MNQZ2026'), new Error('WebSocket disconnect')) === true, 'la lectura previa no lleva placeOrder y sí se puede reintentar');

const piso = bracketEntrada({ side: 'long', bid: 99.75, ask: 100, slPts: 15, tpPts: 0.25 });
ok(piso.ok && piso.tp === 101.75 && piso.sl === 85, 'un objetivo corto queda al menos 8 ticks más allá del bid (' + JSON.stringify(piso) + ')');
const malo = bracketEntrada({ side: 'long', bid: 99.75, ask: 100, slPts: 0.25, tpPts: 2.5 });
ok(!malo.ok, 'si el stop quedaría del lado malo, no se envía');
const corto = bracketEntrada({ side: 'short', bid: 100, ask: 100.25, slPts: 15, tpPts: 2.5 });
ok(corto.ok && corto.sl === 115 && corto.tp === 97.5, 'en corto el stop sale del bid y el objetivo queda delante del ask (' + JSON.stringify(corto) + ')');

const lejos = bracketsSeguros('long', 27720, 27727.75, 15, 2.5);
ok(lejos.tp == null && lejos.sl === 27705, 'un objetivo calculado con la vela, ya cruzado, no se arma');

{ const pg = pagina({ chart: 27720, live: 27727.75 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  const mkt = pg.placed.find(o => o.type === 2);
  ok(pg.positions.length === 1 && pg.closes.length === 0 && pg.reduces.length === 0, 'la posición sigue abierta (' + r + ')');
  ok(mkt && mkt.stopLoss === 27712.75 && mkt.takeProfit === 27730.25, 'la orden a mercado lleva SL y TP del ask, no del cierre de la vela');
  ok(String(r).startsWith('ok') && !String(r).includes('no se llenó'), 'no dice que no se llenó');
  const sl = pg.orders.find(o => o.type === 3), tp = pg.orders.find(o => o.type === 1);
  ok(sl && sl.stopPrice === 27712.75 && tp && tp.limitPrice === 27730.25 && sl.parentId && tp.parentId === sl.parentId, 'SL y TP nacen ligados a la orden de entrada'); }

{ const book = { front: 'MNQZ2026', bid: 27727.5, ask: 27727.75, live: 27727.75, chart: 27720 };
  const pg = pagina({ book });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'short', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  const mkt = pg.placed.find(o => o.type === 2);
  ok(mkt && mkt.side === -1 && mkt.stopLoss === 27742.5 && mkt.takeProfit === 27725 && String(r).startsWith('ok'), 'corto: SL y TP van en la misma orden (' + r + ')'); }

{ const ya = [{ id: 'P0', symbol: 'CME_MINI:MNQZ2026', side: 1, qty: 5, avgPrice: 27000, lastPrice: 27727.75 }];
  const pg = pagina({ positions: ya });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.length === 0 && /ya hay posicion/.test(String(r)) && ya[0].qty === 5, 'si ya hay posición, no se envía (' + r + ')'); }

{ const ya = [{ id: 'P0', symbol: 'CME_MINI:MNQZ2026', side: -1, qty: 4, avgPrice: 28000, lastPrice: 27727.75 }];
  const pg = pagina({ positions: ya });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.length === 0 && ya.length === 1 && ya[0].qty === 4 && /ya hay posicion/.test(String(r)), 'una posición al otro lado tampoco se toca (' + r + ')'); }

{ const pg = pagina({ partialQty: 10 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.filter(o => o.type === 2).length === 1 && pg.positions[0] && pg.positions[0].qty === 10 && /Llenado parcial/.test(String(r)), 'el llenado parcial no manda otra orden (' + r + ')'); }

{ const pg = pagina();
  const d = apiDriver(pg.evaluate);
  const a = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  pg.positions.splice(0); pg.orders.splice(0);
  const b = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(String(a).startsWith('ok') && String(b).startsWith('ok') && pg.placed.filter(o => o.type === 2).length === 2, 'dos trades en el mismo driver: dos órdenes, no una repetida');
  ok(d.lastOpen() && d.lastOpen().orderId && d.lastOpen().orderId !== 'M1', 'la segunda apertura no hereda el id de la primera'); }

{ const pg = pagina({ noPB: true, broker: 'Tradovate' });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.filter(o => o.type === 3 || o.type === 1).length === 0 && pg.orders.some(o => o.type === 3) && String(r).startsWith('ok'), 'Tradovate: el bracket nace en la orden de entrada, sin órdenes sueltas (' + r + ')'); }

{ const pg = pagina({ reject: true });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.positions.length === 0 && pg.closes.length === 0 && /RECHAZADA/.test(String(r)), 'un rechazo es no se llenó (' + r + ')'); }

{ const pg = pagina({ revealAt: 3 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.positions.length === 1 && String(r).startsWith('ok') && !/no se llenó/.test(String(r)), 'la posición aparece tarde y se adopta (' + r + ')'); }

{ const pg = pagina({ alreadyFlat: true, exitPx: 27726.75 });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.closes.length === 0 && pg.reduces.length === 0 && pg.placed.filter(o => o.type === 2).length === 1, 'si ya está cerrada no se manda otra orden ni un cierre');
  ok(/sí se llenó/.test(String(r)) && !/no se llenó/.test(String(r)), 'ya plana solo con la salida de esta orden (' + r + ')'); }

{ const pg = pagina({ throwAlways: true });
  const r = await apiDriver(pg.evaluate).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.length === 0 && pg.closes.length === 0 && !/no se llenó/.test(String(r)) && /no se cierra nada/i.test(String(r)), 'lectura rota antes de enviar: no se manda nada (' + r + ')'); }

{ const pg = pagina({ noChildren: true });
  const k = createColchon(apiDriver(pg.evaluate), { pollMs: 40, logFile: '/tmp/apertura-stop.log', ignoreClock: true, flatConfirm: { reads: 1, ms: 0 }, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 20, strategyId: 'rascacielo' });
  ok(!r.ok && r.watching && /NO VEO EL STOP/.test(String(r.alerta || k.status().alerta || '')), 'sin stop confirmado no se reporta ok (' + (r.alerta || r.err) + ')');
  await k.stop({ flatten: false });
  ok(pg.closes.length === 0 && pg.positions.length === 1, 'si falta el stop no se cierra la posición'); }

{ const pg = pagina();
  const d = apiDriver(pg.evaluate);
  await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  const vivo = d.lastOpen() && d.lastOpen().orderId;
  pg.ab.positions = async () => { throw new Error('tv ocupado'); };
  const r = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(vivo && d.lastOpen() == null && /no se cierra nada/i.test(String(r)), 'una apertura fallida no deja el resultado anterior (' + r + ')'); }

{ const pg = pagina();
  let abrios = 0;
  const ev = async expr => {
    if (String(expr).includes('ENVIO_APERTURA')) {
      abrios++;
      if (abrios > 1) throw new Error('no debía reenviar');
      await pg.ab.placeOrder({ symbol: 'CME_MINI:MNQZ2026', side: 1, type: 2, qty: 20, stopLoss: 27712.75, takeProfit: 27730.25 });
      throw new Error('WebSocket disconnect');
    }
    return pg.evaluate(expr);
  };
  const d = apiDriver(ev);
  const r = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(abrios === 1 && pg.placed.filter(o => o.type === 2).length === 1, 'la llamada 2 no se reenvía si se corta');
  ok(pg.positions.length === 1 && /No se reenvía/.test(String(d.lastOpen() && d.lastOpen().alerta)) && String(r).startsWith('ok'), 'se adopta la posición que apareció y se avisa (' + (d.lastOpen() && d.lastOpen().alerta) + ')'); }

{ const pg = pagina();
  let lecturas = 0, envios = 0;
  const ev = async expr => {
    const s = String(expr);
    if (s.includes('LECTURA_APERTURA')) { lecturas++; if (lecturas === 1) throw new Error('WebSocket disconnect'); }
    if (s.includes('ENVIO_APERTURA')) envios++;
    return pg.evaluate(expr);
  };
  const r = await apiDriver(ev).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(lecturas === 2 && envios === 1 && pg.placed.filter(o => o.type === 2).length === 1 && String(r).startsWith('ok'), 'si la lectura falla, se reintenta una vez y la orden sale una sola vez (' + lecturas + '/' + envios + ')'); }

{ const book = { front: 'MNQZ2026', bid: 27727.5, ask: 27727.75, live: 27727.75, chart: 27720, account: '1' };
  const pg = pagina({ book });
  const ev = async expr => { if (String(expr).includes('ENVIO_APERTURA')) book.account = '9'; return pg.evaluate(expr); };
  const r = await apiDriver(ev).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.length === 0 && /la cuenta cambió/.test(String(r)), 'si la cuenta cambia entre las dos llamadas, no se envía (' + r + ')'); }

{ const book = { front: 'MNQZ2026', bid: 27727.5, ask: 27727.75, live: 27727.75, chart: 27720, account: '1' };
  const pg = pagina({ book });
  const ev = async expr => { if (String(expr).includes('ENVIO_APERTURA')) book.front = 'MNQH2027'; return pg.evaluate(expr); };
  const r = await apiDriver(ev).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.length === 0 && /el contrato cambió/.test(String(r)) && /MNQH2027/.test(String(r)), 'si el contrato cambia entre las dos llamadas, no se envía (' + r + ')'); }

{ const pg = pagina();
  const ev = async expr => {
    if (String(expr).includes('ENVIO_APERTURA')) pg.positions.push({ id: 'PX', symbol: 'CME_MINI:MNQZ2026', side: 1, qty: 3, avgPrice: 27000, lastPrice: 27727.75 });
    return pg.evaluate(expr);
  };
  const r = await apiDriver(ev).openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(pg.placed.length === 0 && /ya hay posicion/.test(String(r)) && pg.positions[0].qty === 3, 'si aparece una posición entre las dos llamadas, no se envía (' + r + ')'); }

{ const book = { front: 'MNQZ2026', bid: 27727.5, ask: 27727.75, live: 27727.75, chart: 27720, solo: 'MNQZ2026' };
  const pg = pagina({ book });
  const d = apiDriver(pg.evaluate);
  const a = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  ok(String(a).startsWith('ok') && /MNQZ2026/.test(pg.placed[0].symbol), 'la primera orden usa el contrato del chart (' + pg.placed[0].symbol + ')');
  pg.positions.splice(0); pg.orders.splice(0);
  book.front = 'MNQH2027'; book.solo = 'MNQH2027';
  const b = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5 });
  const sym = pg.placed[pg.placed.length - 1] && pg.placed[pg.placed.length - 1].symbol;
  ok(String(b).startsWith('ok') && /MNQH2027/.test(sym) && !/MNQZ2026/.test(sym), 'si el contrato rodó, no se manda al vencido (' + sym + ')'); }

{ const cola = [];
  let lecturas = 0;
  acctGuard.testActive = true;
  acctGuard.saldoPendiente = false;
  const prev = acctGuard.alLiberar;
  acctGuard.alLiberar = () => {
    const jobs = cola.splice(0);
    for (const j of jobs) j();
    if (acctGuard.saldoPendiente) { acctGuard.saldoPendiente = false; lecturas++; }
  };
  let corrio = false;
  const p = encolarSiOcupado(cola, async () => { corrio = true; return { ok: true }; });
  if (acctGuard.testActive) acctGuard.saldoPendiente = true;
  ok(corrio === false && lecturas === 0 && cola.length === 1, 'durante la orden el saldo y la vista previa quedan en cola');
  liberarPrueba();
  await p;
  ok(corrio === true && lecturas === 1 && cola.length === 0, 'al terminar la orden corre la lectura de saldo que estaba en cola');
  acctGuard.alLiberar = prev;
  acctGuard.testActive = false;
  acctGuard.saldoPendiente = false;
  const tl = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
  ok(tl.includes('acctGuard.saldoPendiente = true') && tl.includes('encolarSiOcupado(vistaCola'), 'el servidor encola saldo y vista previa, no los tira'); }

{ const pg = pagina({ chart: 27720, live: 27727.75 });
  const k = createColchon(apiDriver(pg.evaluate), { pollMs: 40, logFile: '/tmp/apertura-incierta.log', ignoreClock: true, flatConfirm: { reads: 3, ms: 1000 }, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 20, strategyId: 'rascacielo' });
  ok(r.ok && k.status().state === 'running' && pg.positions.length === 1 && pg.closes.length === 0, 'Rascacielo arranca sobre la posición real');
  const sl = pg.orders.find(o => o.type === 3), tp = pg.orders.find(o => o.type === 1);
  ok(sl && sl.stopPrice === 27712.75 && tp && tp.limitPrice === 27730.25, `SL/TP del ask (${sl && sl.stopPrice}/${tp && tp.limitPrice})`);
  assert.doesNotMatch(js.adopt('MNQ', 15, 2.5), /placeOrder/);
  await k.stop({ flatten: false });
  ok(pg.positions.length === 1 && pg.closes.length === 0, 'detener sin aplanar no llama a closePosition'); }

const pasosEval = stepsFor('MNQ', 8, getStrategy('evaluacion').params);
const enPaso = planAlAbrir({ side: 'long', entry: 20000, price: 20012.5, steps: pasosEval, slPts: 39.5, tpPts: 39.5, usdPerPoint: 16 });
ok(enPaso.stepIndex === 0 && enPaso.sl === 20000 && enPaso.nextStep === 1 && !enPaso.tpReached, 'con +$200 el stop del plan es el paso 1');
const salto = planAlAbrir({ side: 'long', entry: 20000, price: 20031.25, steps: pasosEval, slPts: 39.5, tpPts: 39.5, usdPerPoint: 16 });
ok(salto.step && salto.step.n === 3 && salto.sl === 20012.5 && salto.locked, 'si el precio ya está en el paso 3, el plan usa ese stop');
const cruzado = planAlAbrir({ side: 'long', entry: 100, price: 105, steps: [{ n: 1, triggerUsd: 1, lockUsd: 20, lockPts: 20 }], slPts: 10, tpPts: 50, usdPerPoint: 1 });
ok(cruzado.stepIndex == null && cruzado.sl === 90, 'un stop de escalón ya cruzado no se pone');
const objetivo = planAlAbrir({ side: 'long', entry: 27727.75, price: 27740, steps: [], slPts: 15, tpPts: 2.5, usdPerPoint: 40 });
ok(objetivo.tpReached && objetivo.sl == null, 'si el precio ya pasó el objetivo, el plan no arma un stop');

{ const book = { front: 'MNQZ2026', bid: 20012.25, ask: 20012.5, live: 20012.5, chart: 20000 };
  const pg = pagina({ book, fillPx: 20000 });
  const k = createColchon(apiDriver(pg.evaluate), { pollMs: 40, logFile: '/tmp/apertura-paso.log', ignoreClock: true, flatConfirm: { reads: 3, ms: 1000 }, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 8, strategyId: 'evaluacion' });
  await dormir(900);
  const sl = pg.orders.find(o => o.type === 3);
  ok(r.ok && k.status().step === 1 && sl && sl.stopPrice === 20000 && pg.closes.length === 0 && pg.placed.filter(o => o.type === 3).length === 0, `el ajuste mueve el stop al paso 1 (step ${k.status().step}, SL ${sl && sl.stopPrice})`);
  await k.stop({ flatten: false }); }

{ const book = { front: 'MNQZ2026', bid: 27739.75, ask: 27740, live: 27740, chart: 27720 };
  const pg = pagina({ book, fillPx: 27727.75 });
  const k = createColchon(apiDriver(pg.evaluate), { pollMs: 40, logFile: '/tmp/apertura-tp.log', ignoreClock: true, flatConfirm: { reads: 1, ms: 0 }, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 20, strategyId: 'rascacielo' });
  const sm = k.summary();
  ok(r.closed === 'tp' && pg.reduces.length === 1 && pg.reduces[0].qty === 20 && pg.reduces[0].price === 27740 && pg.closes.length === 0, 'el objetivo ya pasado cierra solo la cantidad de esta orden, al precio real');
  ok(sm && sm.pnlFinalUSD === 490 && sm.salida === 27740, 'el resumen usa la salida real, no los $104 del objetivo (' + (sm && sm.pnlFinalUSD) + ')'); }

{ const book = { front: 'MNQZ2026', bid: 27739.75, ask: 27740, live: 27740, chart: 27720 };
  const pg = pagina({ book, fillPx: 27727.75, closeFail: true });
  const d = apiDriver(pg.evaluate);
  const r = await d.openBracket({ side: 'long', symbol: 'MNQ', qty: 20, slPts: 15, tpPts: 2.5, steps: [] });
  ok(pg.positions.length === 1 && pg.closes.length === 0 && pg.orders.some(o => o.type === 3) && /no se confirmó/.test(String(d.lastOpen() && d.lastOpen().alerta)) && !d.lastOpen().tpHit, 'si el cierre del objetivo falla, sigue el stop y no se da por cerrado (' + r + ')'); }

if (process.exitCode) process.exit(process.exitCode);
console.log('apertura-incierta ok');
