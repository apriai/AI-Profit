// Prueba en el box: página falsa de TradingView (API interna simulada) + controlador real.
import { readAccounts, createColchon, apiDriver } from 'file:///C:/Users/USUARIO/OneDrive/Escritorio/TradingLink/colchon.mjs';
import { STRATEGIES } from 'file:///C:/Users/USUARIO/OneDrive/Escritorio/TradingLink/strategies.mjs'; import { buildReport, etDay } from 'file:///C:/Users/USUARIO/OneDrive/Escritorio/TradingLink/colchon.mjs'; import fs from 'node:fs'; import { lockUsdFor, triggerUsdFor, breakEvenFor } from 'file:///C:/Users/USUARIO/OneDrive/Escritorio/TradingLink/colchon.mjs';
// Las pruebas 1-20 se escribieron con los parámetros anteriores de «Día mínimo + colchón» ($150 netos, disparo +$10, 20 MNQ por defecto):
// se fijan aquí para conservar esa cobertura del motor; los valores actuales se comprueban al final (21).
const FC = { reads: 1, ms: 0 }; // pruebas antiguas: flat a la primera lectura vacía (la guarda de flat real se prueba aparte)
const DMC = STRATEGIES['dia-minimo-colchon'].params, DMC_NEW = { ...DMC };
Object.assign(DMC, { NET_USD: 150, TRIGGER_EXTRA_USD: 10 }); delete DMC.DEFAULT_QTY;
export function fakePage({ acct = 'Paper Trading', broker = 'Paper', symbol = 'CME_MINI:NQ1!', accounts = null, accType = 'demo', reject = null, tv = null } = {}) {
  const hist = [];
  let px = 20000, nid = 1; const orders = [], positions = [];
  const accs = accounts || [{ id: '1', name: acct, type: accType, title: broker + ' Trading' }]; let cur = accs.find(a => a.name === acct)?.id || accs[0].id;
  const ab = { _brokerMetainfo: { id: broker, title: broker + ' Trading' },
    accountManagerInfo: () => ({ summary: [{ text: 'Account Balance', wValue: { value: () => (accs.find(a => a.id === cur).bal ?? 100000) } }, { text: 'Equity', wValue: { value: () => (accs.find(a => a.id === cur).bal ?? 100000) } }, { text: 'Profit', wValue: { value: () => 0 } }] }),
    currentAccount: () => cur, async accountsMetainfo() { return accs.map(a => ({ ...a })); }, setCurrentAccount(id) { setTimeout(() => { cur = id; }, 30); },
    async positions() { positions.forEach(p => { p.lastPrice = px; p.pl = (px - p.avgPrice) * p.side * (/MNQ/.test(p.symbol) ? 2 : 20) * p.qty; });
      for (const p of [...positions]) { const so = orders.find(o => o.type === 3), tp = orders.find(o => o.type === 1); if ((so && (p.side === 1 ? px <= so.stopPrice : px >= so.stopPrice)) || (tp && (p.side === 1 ? px >= tp.limitPrice : px <= tp.limitPrice))) { positions.splice(positions.indexOf(p), 1); orders.length = 0; } } return positions.map(p => ({ ...p, stopLoss: (orders.find(o => o.type === 3) || {}).stopPrice, takeProfit: (orders.find(o => o.type === 1) || {}).limitPrice })); },
    async editPositionBrackets(id, b) { if (globalThis.__lag) { setTimeout(() => this.editPositionBrackets.call(this, id, b), globalThis.__lag); globalThis.__lag = 0; return true; } const p = positions.find(q => q.id === id); if (!p) return false; const so = orders.find(o => o.type === 3); if (b.stopLoss != null && ((p.side === 1 && b.stopLoss >= px) || (p.side === -1 && b.stopLoss <= px))) return false; if (so) so.stopPrice = b.stopLoss; const ti = orders.findIndex(o => o.type === 1); if (b.takeProfit == null && ti >= 0) orders.splice(ti, 1); else if (ti >= 0) orders[ti].limitPrice = b.takeProfit; },
    async ordersHistory() { return hist; },
    async placeOrder(o) { if (reject) { hist.push({ id: 'R' + nid++, symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 5, message: { text: reject } }); return {}; } const p = { id: 'P' + nid++, symbol: o.symbol, side: o.side, qty: o.qty, avgPrice: px + (globalThis.__slip || 0), lastPrice: px }; positions.push(p);
      orders.push({ id: 'S' + nid++, parentId: p.id, parentType: 2, symbol: o.symbol, side: -o.side, type: 3, status: 6, qty: o.qty, stopPrice: o.stopLoss }, { id: 'T' + nid++, parentId: p.id, parentType: 2, symbol: o.symbol, side: -o.side, type: 1, status: 6, qty: o.qty, limitPrice: o.takeProfit }); return {}; },
    async modifyOrder(o) { if (o.parentId != null) { globalThis.__modFail = (globalThis.__modFail || 0) + 1; return false; } const x = orders.find(q => q.id === o.id); if ((o.side === -1 && o.stopPrice >= px) || (o.side === 1 && o.stopPrice <= px)) return false; Object.assign(x, o); return true; },
    async orderById(id) { return orders.find(q => q.id === id) || null; },
    async closePosition(id) { positions.splice(positions.findIndex(p => p.id === id), 1); orders.length = 0; return true; } };
  if (tv) { // forma Tradovate: unrealizedPl sin pl, hijos SL/TP solo en ab.orders(), sin brackets de posición, símbolo fechado
    const plain = ab.positions; ab._brokerMetainfo.id = 'Tradovate';
    ab.positions = async () => { if (globalThis.__posThrow) { globalThis.__posThrow--; throw new Error('transitorio'); } if (globalThis.__posEmpty) { globalThis.__posEmpty--; return []; }
      return (await plain.call(ab)).map(p => { const q = { ...p, unrealizedPl: p.pl }; delete q.pl; delete q.stopLoss; delete q.takeProfit; if (globalThis.__noPl) delete q.unrealizedPl; return q; }); };
    ab.accountMetainfo = () => ({ config: { supportPositionBrackets: false } }); ab.orders = async () => orders.filter(o => o.status === 6).map(o => ({ ...o }));
    ab.editPositionBrackets = async () => { globalThis.__epb = (globalThis.__epb || 0) + 1; return false; };
    ab.modifyOrder = async o => { globalThis.__modCalls = (globalThis.__modCalls || 0) + 1; if (globalThis.__apiHang) { const late = globalThis.__apiLateMs; if (late) setTimeout(() => { const x = orders.find(q => q.id === o.id); if (x) x.stopPrice = o.stopPrice; }, late); return new Promise(() => {}); }
      const x = orders.find(q => q.id === o.id); if (!x) return false; if (x.type === 1) { (globalThis.__tpMods ||= []).push(o.id); x.limitPrice = o.limitPrice; } else x.stopPrice = o.stopPrice; return true; };
    ab.symbolInfo = async sy => { if (tv.symFail || /1!$/.test(sy)) throw new Error('unknown ' + sy); return { name: sy }; };
    ab.createEditOrderContext = async ({ order }) => ({ send: async () => { globalThis.__uiCalls = (globalThis.__uiCalls || 0) + 1; (globalThis.__uiOrders ||= []).push(order.id); if (globalThis.__uiBroken) throw new Error('ui rota'); const x = orders.find(q => q.id === order.id); if (x) x.stopPrice = order.stopPrice; return true; } }); }
  const win = { TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => orders.filter(o => o.status === 6 && !(tv && o.parentId != null)) } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ mainSeries: () => ({ symbol: () => symbol, symbolInfo: () => ({ front_contract: (/MNQ/.test(symbol) ? 'MNQ' : 'NQ') + 'Z2026' }), bars: () => ({ last: () => ({ value: [0, 0, 0, 0, globalThis.__chartPx ?? px] }) }) }) }) } }) } } };
  let fgv = false; const doc = { get visibilityState() { return fgv ? 'visible' : 'hidden'; }, hasFocus: () => fgv, querySelector: s => /accountName/.test(s) ? { innerText: accs.find(a => a.id === cur).name } : null };
  win.performance = globalThis.performance; const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, doc, performance);
  return { evaluate, setPx: v => { px = v; }, orders, positions, cur: () => cur, setCur: id => { cur = id; }, setFg: v => { fgv = v; } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
// 1) Paper: abre, sube a +$170, mueve SL a entrada+3.75, cierra
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); ok(r.ok && k.status().mode === 'paper', 'paper: inicia y abre bracket');
  ok(pg.orders[0].stopPrice === 19985 && pg.orders[1].limitPrice === 20040, `bracket SL 19985 / TP 20040 (${pg.orders[0].stopPrice}/${pg.orders[1].limitPrice})`);
  pg.setPx(20004.25); await sleep(200); ok(!k.status().locked, 'a +$170 (2 NQ) no mueve'); 
  pg.setPx(20004.5); await sleep(300); ok(k.status().locked && pg.orders[0].stopPrice === 20004.25, `a +$180 SL -> 20004.25 (${pg.orders[0].stopPrice})`);
  pg.setPx(20010); await sleep(200); ok(pg.orders[0].stopPrice === 20004.25, 'no vuelve a mover (una vez)');
  await k.stop({ flatten: true }); ok(pg.positions.length === 0 && k.status().state === 'stopped', 'stop + flatten');
  console.log(k.status().log.join('\n')); }
// 2) Short con MNQ
{ const pg = fakePage({ symbol: 'CME_MINI:MNQ1!' }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'short', symbol: 'MNQ', qty: 20 }); ok(pg.orders[0].stopPrice === 20015 && pg.positions[0].qty === 20, 'short 20 MNQ SL 20015');
  pg.setPx(19994.75); await sleep(300); ok(pg.orders[0].stopPrice === 19995.5, `short 20 MNQ (disparo $190): SL -> 19995.5 (${pg.orders[0].stopPrice})`); await k.stop({ flatten: true }); }
// 3) Lucid bloqueada
for (const a of ['LFE00000000000000', 'LFF00000000000000']) { const pg = fakePage({ acct: a, broker: 'Tradovate' }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, ignoreClock: true, flatConfirm: FC, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log' });
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); ok(!r.ok && r.blocked && pg.positions.length === 0, `bloqueada ${a}, 0 órdenes`); }
// 4) Chart en otro símbolo -> no abre
{ const pg = fakePage({ symbol: 'CME_MINI:ES1!' }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, ignoreClock: true, flatConfirm: FC, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log' });
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); ok(!r.ok && pg.positions.length === 0, 'chart ES: no abre (' + r.err + ')'); }

// 5) TP alcanzado -> resumen
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); pg.setPx(20005); await sleep(200); pg.setPx(20041); await sleep(300);
  const sm = k.summary(); ok(sm && sm.motivo === 'Take profit' && sm.pnlFinalUSD === 1600 && sm.latencia && sm.latencia.metodo === 'api' && sm.latencia.modificarMs != null && sm.latencia.confirmarMs != null, 'TP -> resumen con latencia ' + JSON.stringify(sm && sm.latencia)); }
// 6) API falla -> fallback UI, latencias separadas
{ const pg = fakePage(); const ev = async e => { if ((e.includes('20004.25') && e.includes('editPositionBrackets'))) { await sleep(5); throw new Error('api caída'); } return pg.evaluate(e); };
  const ui = { async modifyStop(price) { await sleep(30); pg.orders.forEach(o => { if (o.type === 3) o.stopPrice = price; }); return 'ok'; } };
  const k = createColchon(apiDriver(ev, ui, null, { rereadMs: 100 }), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); pg.setPx(20009); await sleep(1300); const l = k.status().latency;
  ok(l && l.metodo === 'ui' && l.apiIntentoMs != null && l.uiMs >= 25 && l.apiError, 'fallback UI: ' + JSON.stringify(l)); await k.stop({ flatten: true }); }
// 7) cantidad configurable
{ const pg = fakePage({ symbol: 'CME_MINI:MNQ1!' }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  for (const [s, q] of [['MNQ', 21], ['NQ', 3], ['MNQ', 0], ['MNQ', 2.5]]) { const r = await k.start({ side: 'long', symbol: s, qty: q }); ok(!r.ok && pg.orders.length === 0, `rechaza ${q} ${s}: ${r.err}`); }
  const r = await k.start({ side: 'long', symbol: 'MNQ' }); await sleep(150); const o = pg.orders, sl = o.find(x => x.type === 3), tp = o.find(x => x.type === 1);
  ok(r.ok && k.status().qty === 20 && sl.stopPrice === 19985 && tp.limitPrice === 20040, `por defecto 20 MNQ: SL ${sl && sl.stopPrice} TP ${tp && tp.limitPrice}`);
  pg.setPx(20004.5); await sleep(200); ok(sl.stopPrice === 19985, 'a +$180 (20 MNQ) no mueve'); pg.setPx(20004.75); await sleep(300);
  ok(pg.orders.find(x => x.type === 3).stopPrice === 20004.5, `a +$190 SL -> 20004.5 (+$180) (${pg.orders.find(x => x.type === 3).stopPrice})`); await k.stop({ flatten: true }); }

// 8) Paper real: modifyOrder sobre hijo de bracket falla -> usa editPositionBrackets y conserva el TP
{ const pg = fakePage(); globalThis.__modFail = 0; const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); pg.setPx(20009); await sleep(300); const l = k.status().latency, tp = pg.orders.find(o => o.type === 1);
  ok(pg.orders.find(o => o.type === 3).stopPrice === 20004.25 && l.via === 'editPositionBrackets' && tp && tp.limitPrice === 20040 && globalThis.__modFail === 0, `editPositionBrackets: SL 20004.25, TP conservado ${tp && tp.limitPrice}, modifyOrder fallidos ${globalThis.__modFail}`); await k.stop({ flatten: true }); }

// 9) editPositionBrackets devuelve true pero TradingView tarda: sondeo; si tarda >1.5 s no llama modifyOrder; salida por stop del colchón -> resumen correcto
{ const pg = fakePage(); globalThis.__modFail = 0; globalThis.__lag = 400; const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); pg.setPx(20009); await sleep(900); const l = k.status().latency;
  ok(l && l.via === 'editPositionBrackets' && l.confirmarMs >= 350 && k.status().locked && globalThis.__modFail === 0, `lag 400 ms: confirmar ${l && l.confirmarMs} ms, modifyOrder ${globalThis.__modFail}`); await k.stop({ flatten: true }); }
{ const pg = fakePage(); globalThis.__modFail = 0; globalThis.__lag = 2500; const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); pg.setPx(20009); await sleep(3200); pg.setPx(20003); await sleep(400); const sm = k.summary();
  ok(globalThis.__modFail === 0 && sm && sm.motivo === 'Stop loss' && sm.colchonMovido === true && sm.slColchon === 20004.25 && sm.pnlFinalUSD === 170 && sm.colchonUSD === 170, `lag 2.5 s: sin modifyOrder (${globalThis.__modFail}), resumen ${sm && sm.motivo} ${sm && sm.pnlFinalUSD} colchón ${sm && sm.colchonMovido}`); }
// 10) duración
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); await sleep(300); pg.setPx(20009); await sleep(300); pg.setPx(20041); await sleep(300); const sm = k.summary();
  ok(sm && sm.duracionSeg >= 0.5 && sm.duracionSeg < 1.2 && sm.colchonTrasSeg >= 0.2 && sm.colchonTrasSeg < sm.duracionSeg && /ET$/.test(sm.abiertaET), `duración ${sm && sm.duracionSeg} s, colchón a los ${sm && sm.colchonTrasSeg} s, ${sm && sm.abiertaET} → ${sm && sm.cerradaET}`); }

// 11) cuentas: lista, cambio verificado, bloqueo de Lucid/real
{ const A = [{ id: '10', name: 'paper trading', type: 'demo', title: 'Paper Trading' }, { id: '11', name: 'PRUEBA', type: 'demo', title: 'Paper Trading' }, { id: '12', name: 'LFE0000000000', type: 'demo', title: 'Paper Trading' }, { id: '13', name: 'Real', type: 'live', title: 'Paper Trading' }];
  const pg = fakePage({ acct: 'paper trading', accounts: A }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const l = await k.accounts(); ok(l.ok && l.accounts.length === 4 && l.accounts.find(a => a.id === '10').current && l.accounts.filter(a => a.allowed).map(a => a.id).join() === '10,11', 'lista cuentas: permitidas ' + l.accounts.filter(a => a.allowed).map(a => a.name).join(','));
  for (const id of ['12', '13', '99']) { const r = await k.start({ side: 'long', symbol: 'NQ', qty: 1, accountId: id }); ok(!r.ok && pg.orders.length === 0 && pg.cur() === '10', `cuenta ${id} rechazada sin cambiar ni operar: ${r.err}`); }
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 1, accountId: '11' }); await sleep(150);
  ok(r.ok && pg.cur() === '11' && k.status().account.name === 'PRUEBA' && pg.orders.length === 2, 'cambia a PRUEBA (verificada) y luego abre'); await k.stop({ flatten: true }); }

// 12) orden rechazada (sin margen) tras cambiar de cuenta -> error claro, sin vigilar nada
{ const A = [{ id: '10', name: 'paper trading', type: 'demo', title: 'Paper Trading' }, { id: '11', name: 'lore', type: 'demo', title: 'Paper Trading' }];
  const pg = fakePage({ acct: 'paper trading', accounts: A, reject: 'Not enough funds to complete the order.' }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const t0 = Date.now(); const r = await k.start({ side: 'short', symbol: 'NQ', qty: 1, accountId: '11' });
  ok(!r.ok && /RECHAZADA/.test(r.err) && /Not enough funds/.test(r.err) && pg.cur() === '11' && k.status().state === 'error' && k.summary().motivo === 'Error', 'rechazo detectado: ' + r.err + ` (${Date.now() - t0} ms)`); }
// 13) la cuenta cambia en mitad de la prueba -> deja de vigilar sin cerrar nada
{ const A = [{ id: '10', name: 'paper trading', type: 'demo', title: 'Paper Trading' }, { id: '11', name: 'lore', type: 'demo', title: 'Paper Trading' }];
  const pg = fakePage({ acct: 'paper trading', accounts: A }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 1, accountId: '10' }); await sleep(150); pg.setCur('11'); await sleep(800);
  ok(r.ok && k.status().state === 'error' && /cambió/.test(k.status().error) && pg.positions.length === 1, 'cambio de cuenta a mitad: ' + k.status().state + ' pos=' + pg.positions.length + ' ' + k.status().error); }

// 14) saldos de todas las cuentas por API (sin clics), vuelve a la cuenta original; no recorre si hay posición
{ const A = [{ id: 'D1', name: 'LFE00000000000000', type: 'demo', title: 'Tradovate', bal: 24376 }, { id: 'D2', name: 'LFE00000000000000', type: 'demo', title: 'Tradovate', bal: 24577.5 }];
  const pg = fakePage({ acct: 'LFE00000000000000', accounts: A });
  const r1 = await readAccounts({ all: false, evaluate: pg.evaluate }); ok(r1.accounts.length === 1 && r1.accounts[0].balance === 24376, 'solo la activa: ' + JSON.stringify(r1.accounts.map(a => a.balance)));
  const r2 = await readAccounts({ all: true, evaluate: pg.evaluate }); const b = Object.fromEntries(r2.accounts.map(a => [a.name, a.balance]));
  ok(b.LFE00000000000000 === 24577.5 && b.LFE00000000000000 === 24376 && pg.cur() === 'D1', `todas: 0013=${b.LFE00000000000000} (−$${25000 - b.LFE00000000000000}), vuelve a ${pg.cur()}`);
  pg.positions.push({ id: 'P', symbol: 'CME_MINI:MNQ1!', side: 1, qty: 1, avgPrice: 20000 }); const r3 = await readAccounts({ all: true, evaluate: pg.evaluate });
  ok(r3.busy && r3.accounts.length === 1 && pg.cur() === 'D1', 'con posición abierta no cambia de cuenta'); }
// 15) estrategias: registro, por defecto, id desconocido rechazado, nombre en estado/resumen
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const l = k.strategies(); ok(l.default === 'dia-minimo-colchon' && l.strategies.length === 4 && l.strategies[2].id === 'evaluacion-simple' && l.strategies[3].id === 'prueba-be' && l.strategies[0].name === 'Día mínimo + colchón' && l.strategies[1].id === 'evaluacion', 'registro: ' + l.strategies.map(x => x.name).join());
  const bad = await k.start({ side: 'long', symbol: 'NQ', qty: 2, strategyId: 'xyz' }); ok(!bad.ok && /desconocida/.test(bad.err) && pg.orders.length === 0, 'id desconocido rechazado: ' + bad.err);
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); await sleep(150); pg.setPx(20004.5); await sleep(300); pg.setPx(20041); await sleep(300); const sm = k.summary();
  ok(r.ok && k.status().strategy.id === 'dia-minimo-colchon' && sm.estrategia === 'Día mínimo + colchón' && sm.colchonUSD === 170 && sm.disparoUSD === 180 && sm.pnlFinalUSD === 1600 && /\[Día mínimo \+ colchón\]/.test(k.status().log.join('\n')), 'estrategia por defecto en estado, log y resumen'); }
// 16) Evaluación: escalones en orden, solo hacia arriba, una vez cada uno
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2, strategyId: 'evaluacion' }); await sleep(150);
  const so = () => pg.orders.find(o => o.type === 3).stopPrice, tp = pg.orders.find(o => o.type === 1).limitPrice;
  ok(r.ok && so() === 19984.25 && tp === 20015.75, `bracket evaluación 2 NQ: SL ${so()} TP ${tp}`);
  pg.setPx(20003.5); await sleep(200); ok(so() === 19984.25, 'a +$140 no mueve');
  pg.setPx(20003.75); await sleep(250); ok(so() === 20002.5 && k.status().step === 1, `paso 1 (+$150): SL ${so()}`);
  pg.setPx(20003); await sleep(200); ok(so() === 20002.5 && k.status().step === 1, 'retrocede: no baja ni repite');
  pg.setPx(20006.25); await sleep(250); ok(so() === 20005 && k.status().step === 2, `paso 2 (+$250): SL ${so()}`);
  pg.setPx(20008.75); await sleep(250); ok(so() === 20007.5 && k.status().step === 3, `paso 3 (+$350): SL ${so()}`);
  pg.setPx(20012); await sleep(200); ok(so() === 20007.5 && k.status().pasos.length === 3, 'no hay más pasos'); 
  pg.setPx(20007); await sleep(300); const sm = k.summary();
  ok(sm && sm.estrategia === 'Trailing stop loss - Evaluación' && sm.pasos.map(p => p.paso).join() === '1,2,3' && sm.pasos.every(p => p.enSeg != null) && sm.motivo === 'Stop loss' && sm.pnlFinalUSD === 300, `resumen: pasos ${sm && sm.pasos.map(p => p.paso + '@' + p.enSeg + 's').join(' ')} · ${sm && sm.motivo} ${sm && sm.pnlFinalUSD}`); }
// 17) salto de varios disparos de golpe -> escalón más alto válido
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'short', symbol: 'NQ', qty: 2, strategyId: 'evaluacion' }); await sleep(150);
  pg.setPx(19991); await sleep(300); const s1 = pg.orders.find(o => o.type === 3).stopPrice;
  ok(s1 === 19992.5 && k.status().step === 3 && k.status().pasos.length === 1 && k.status().pasos[0].paso === 3 && k.status().pasos[0].saltados === 2, `short +$360 de golpe: directo al paso 3, saltando 2 (SL ${s1})`);
  pg.setPx(19985); await sleep(300); ok(pg.orders.find(o => o.type === 3).stopPrice === 19992.5 && k.status().pasos.length === 1, 'después no mueve más'); await k.stop({ flatten: true }); }
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2, strategyId: 'evaluacion' }); await sleep(150); pg.setPx(20010); await sleep(300);
  ok(pg.orders.find(o => o.type === 3).stopPrice === 20007.5 && k.status().pasos.length === 1 && k.status().pasos[0].paso === 3 && k.status().step === 3, 'long +$400 de golpe: directo al paso 3'); await k.stop({ flatten: true }); }
// 18) carrera real (10:22 AM): la lectura de todas las cuentas de la granja está en curso cuando arranca la prueba
{ const A = [{ id: '10', name: 'PRUEBA', type: 'demo', title: 'Paper Trading' }, { id: '11', name: 'Financistad', type: 'demo', title: 'Paper Trading' }, { id: '12', name: 'lore', type: 'demo', title: 'Paper Trading' }];
  const pg = fakePage({ acct: 'PRUEBA', accounts: A }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const rd = readAccounts({ all: true, evaluate: pg.evaluate }); await sleep(100);   // la granja empieza a recorrer cuentas
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2, accountId: '10' }); await rd;
  const rd2 = await readAccounts({ all: true, evaluate: pg.evaluate });             // otra lectura completa durante la prueba: no debe cambiar de cuenta
  await sleep(200); pg.setPx(20004.5); await sleep(400);
  ok(r.ok && !rd2.full && pg.cur() === '10' && k.status().state === 'running' && !k.status().error && pg.orders.find(o => o.type === 3).stopPrice === 20004.25,
    `prueba espera a la lectura, la granja no cambia de cuenta durante la prueba, SL movido (${k.status().error || 'sin error'})`); await k.stop({ flatten: true }); }
// 19) estrategia sin escalones (Evaluación simple): nunca mueve el SL, termina en TP
{ const pg = fakePage(); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'NQ', qty: 2, strategyId: 'evaluacion-simple' }); const sl0 = pg.orders.find(o => o.type === 3).stopPrice;
  ok(r.ok && k.status().steps.length === 0, 'cero escalones: arranca sin escalones');
  for (const px of [20004, 20008, 20012]) { pg.setPx(px); await sleep(200); }
  const slNow = pg.orders.find(o => o.type === 3).stopPrice; pg.setPx(20016); await sleep(500); const sm = k.summary();
  ok(slNow === sl0 && !k.status().error && sm && sm.estrategia === 'Evaluación' && sm.pasosTotal === 0 && sm.pasos.length === 0 && sm.colchonUSD == null && !sm.colchonMovido && /take profit|^tp$/i.test(sm.motivo),
    `cero escalones: SL fijo (${sl0}→${slNow}), TP, resumen sin pasos (${sm && sm.motivo})`); }
// 20) lectura de todas las cuentas solo con TradingView en segundo plano
{ const A = [{ id: '10', name: 'PRUEBA', type: 'demo', title: 'Paper Trading' }, { id: '11', name: 'Financistad', type: 'demo', title: 'Paper Trading' }, { id: '12', name: 'lore', type: 'demo', title: 'Paper Trading' }];
  const pg = fakePage({ acct: 'PRUEBA', accounts: A }); pg.setFg(true);
  const r1 = await readAccounts({ all: true, evaluate: pg.evaluate });
  ok(r1.visible && r1.accounts.length === 1 && pg.cur() === '10', `TV en primer plano: no cambia de cuenta, solo lee la activa (${r1.accounts.length})`);
  pg.setFg(false); const r2 = await readAccounts({ all: true, evaluate: pg.evaluate });
  ok(!r2.visible && r2.accounts.length === 3 && pg.cur() === '10', `TV minimizado: lee las 3 cuentas y vuelve a la original (${r2.accounts.length}, ${pg.cur()})`);
  const p3 = readAccounts({ all: true, evaluate: pg.evaluate }); await sleep(300); pg.setFg(true); const r3 = await p3;
  ok(r3.aborted && pg.cur() === '10' && r3.final === '10', `TV pasa a primer plano a mitad: corta y vuelve a la original (${r3.accounts.length} leídas)`); }
// 21) parámetros actuales: $100 netos, disparo = colchón + $15 (a tick), 10 MNQ por defecto, probabilidad necesaria
{ for (const k of Object.keys(DMC)) delete DMC[k]; Object.assign(DMC, DMC_NEW);
  const got = [['MNQ', 10], ['MNQ', 20], ['NQ', 2]].map(([y, q]) => `${lockUsdFor(y, q, DMC)}/${triggerUsdFor(y, q, DMC)}`).join(' ');
  ok(got === '115/130 130/150 120/140', `Día mínimo: colchón/disparo 10 MNQ, 20 MNQ, 2 NQ = ${got}`);
  const be = [breakEvenFor('MNQ', 10, DMC).pct, breakEvenFor('MNQ', 10, STRATEGIES['evaluacion'].params).pct, breakEvenFor('MNQ', 10, STRATEGIES['evaluacion-simple'].params).pct].join(' ');
  ok(be === '85.7 86.3 50', `probabilidad necesaria: Día mínimo / Trailing / Evaluación = ${be}`);
  const pg = fakePage({ symbol: 'CME_MINI:MNQ1!' }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'MNQ' }); await sleep(150); const sl0 = pg.orders.find(o => o.type === 3).stopPrice, e = k.status().entry;
  ok(r.ok && k.status().qty === 10, `cantidad por defecto de Día mínimo: ${k.status().qty} MNQ`);
  pg.setPx(e + 6.25); await sleep(300); const nm = pg.orders.find(o => o.type === 3).stopPrice;   // +$125 < $130: no mueve
  pg.setPx(e + 6.5); await sleep(400); const mv = pg.orders.find(o => o.type === 3).stopPrice;    // +$130: protege +$115 (5.75 pts)
  await k.stop({ flatten: true }); await sleep(200); const sm = k.summary();
  ok(nm === sl0 && mv === e + 5.75 && sm && sm.probabilidadNecesaria && sm.probabilidadNecesaria.pct === 85.7, `10 MNQ: a +$125 no mueve, a +$130 SL ${mv} (entrada+5.75), resumen ${sm && JSON.stringify(sm.probabilidadNecesaria)}`); }

// ===== Actualización Tradovate (sección 5) + PRUEBA BE =====
const LOG = 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', EVF = 'C:/Users/USUARIO/AppData/Local/Temp/colchon-eventos.jsonl', G = ['__noPl', '__chartPx', '__modCalls', '__apiHang', '__apiLateMs', '__uiCalls', '__uiOrders', '__uiBroken', '__epb', '__posEmpty', '__posThrow'];
const resetG = () => G.forEach(k => { delete globalThis[k]; }); const evs = t => { try { return fs.readFileSync(EVF, 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x)).filter(x => !t || x.type === t); } catch { return []; } };
const TVA = { acct: 'DEMO123', broker: 'Tradovate', symbol: 'CME_MINI:MNQ1!', tv: {} };
// 22) PRUEBA BE en forma Tradovate: unrealizedPl sin pl, stop hijo solo en ab.orders(), supportPositionBrackets:false -> modifyOrder; MNQ1! -> MNQZ2026
{ resetG(); const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(150); const e = k.status().entry, so = pg.orders.find(o => o.type === 3), tp = pg.orders.find(o => o.type === 1);
  ok(r.ok && k.status().qty === 10 && pg.positions[0] && pg.positions[0].symbol === 'CME_MINI:MNQZ2026', `Tradovate: orden con contrato fechado ${pg.positions[0] && pg.positions[0].symbol}, 10 MNQ por defecto`);
  ok(so.stopPrice === e - 31.5 && tp.limitPrice === e + 31.5, `PRUEBA BE: bracket SL ${so.stopPrice} / TP ${tp.limitPrice} (±$630 = 31.5 pts)`);
  ok(k.status().sl === e - 31.5, `stop hijo leído solo desde ab.orders(): ${k.status().sl}`);
  pg.setPx(e + 0.5); await sleep(300); ok(so.stopPrice === e - 31.5 && k.status().pnl === 10, `+$10 (P&L ${k.status().pnl} vía ${k.status().fuenteLider}): no mueve`);
  pg.setPx(e + 0.75); await sleep(500); ok(so.stopPrice === e && globalThis.__modCalls >= 1 && !globalThis.__epb, `+$15: SL a la entrada ${so.stopPrice} con modifyOrder (${globalThis.__modCalls}), nunca editPositionBrackets (${globalThis.__epb || 0})`);
  pg.setPx(e + 5); await sleep(300); pg.setPx(e + 1); await sleep(300); ok(so.stopPrice === e && globalThis.__modCalls === 1, 'una sola vez, nunca hacia atrás');
  await k.stop({ flatten: true }); const sm = k.summary(); ok(sm && sm.estrategia === 'PRUEBA BE' && sm.pasos.length === 1 && sm.pasos[0].protegeUSD === 0, 'resumen PRUEBA BE: 1 paso, protege $0');
  ok(breakEvenFor('MNQ', 10, STRATEGIES['prueba-be'].params).pct === 50, 'probabilidad mostrada PRUEBA BE = 50% (630 / (630 + 630))'); resetG(); }
// 23) símbolo: si el bróker no reconoce ninguno -> error y cero órdenes
{ resetG(); const pg = fakePage({ ...TVA, tv: { symFail: true } }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  const r = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(100);
  ok(!r.ok && pg.positions.length === 0 && pg.orders.length === 0, 'símbolo no reconocido: error y 0 órdenes (' + (r.err || '').slice(0, 80) + ')'); }
// 24) sin P&L del bróker -> P&L de la gráfica; evento del bróker más rápido gana; valor imposible se descarta
{ resetG(); globalThis.__noPl = true; const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(150); const e = k.status().entry; pg.setPx(e + 0.75); await sleep(400);
  ok(pg.orders.find(o => o.type === 3).stopPrice === e && k.status().fuenteLider === 'grafica', 'sin unrealizedPl: decide con la gráfica (' + k.status().fuenteLider + ')'); await k.stop({ flatten: true }); resetG(); }
{ resetG(); let push = null; const tk = { async start(root, fn) { push = fn; return { fuentes: ['b:positionUpdate'] }; }, async stop() { push = null; } };
  fs.rmSync(EVF, { force: true }); const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate, null, tk), { pollMs: 1000, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(200); const e = k.status().entry, so = pg.orders.find(o => o.type === 3);
  push({ k: 'b:positionUpdate.unrealizedPl', v: 1e9 }); await sleep(250); ok(so.stopPrice === e - 31.5 && evs('anomalia').some(x => x.kind === 'pnl_imposible'), 'P&L imposible (1e9): anomalía, no mueve');
  pg.setPx(e + 0.25); await sleep(50); const t0 = Date.now(); push({ k: 'b:positionUpdate.unrealizedPl', v: 20 }); while (so.stopPrice !== e && Date.now() - t0 < 2000) await sleep(10);
  ok(so.stopPrice === e && Date.now() - t0 < 400, `evento del bróker +$20 (lectura y chart en $0, poll 1 s) mueve en ${Date.now() - t0} ms`);
  { const t1 = Date.now(); while (!evs('mover_stop').length && Date.now() - t1 < 8000) await sleep(20); }
  ok(evs('fuente_lider').some(x => x.a === 'broker-evento') && evs('intento_stop').length >= 1 && evs('mover_stop').some(x => x.ok), 'eventos fuente_lider / intento_stop / mover_stop ' + JSON.stringify([evs('fuente_lider').map(x=>x.a), evs('intento_stop').length, evs('mover_stop').map(x=>x.ok)]));
  await k.stop({ flatten: true }); resetG(); }
// 25) guarda de flat: lecturas vacías transitorias, error de lectura, hijos SL/TP vivos
{ resetG(); fs.rmSync(EVF, { force: true }); const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: LOG, ignoreClock: true });
  await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(150);
  globalThis.__posEmpty = 2; await sleep(300); ok(k.status().state === 'running' && evs('anomalia').some(x => x.kind === 'lectura_vacia_transitoria'), '2 lecturas vacías: sigue (lectura_vacia_transitoria)');
  globalThis.__posThrow = 4; await sleep(300); ok(k.status().state === 'running', 'positions() falla: transitorio, sigue');
  pg.positions.length = 0; await sleep(1400); ok(k.status().state === 'running' && evs('flat_contador').length >= 1, 'sin posición pero SL/TP vivos: no da flat');
  pg.orders.length = 0; await sleep(1500); ok(k.status().state === 'done' && evs('flat_decidido').length === 1, 'sin posición ni hijos ≥1 s / 3 lecturas: flat (' + k.status().state + ')'); resetG(); }
// 26) cascada del stop: api colgada pero aplica tarde -> relectura; api muerta -> ui interna sobre la MISMA orden; todo falla -> aviso rojo, sin cancelar
{ resetG(); globalThis.__apiHang = 1; globalThis.__apiLateMs = 500; const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate, null, null, { apiWaitMs: 300 }), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(150); const e = k.status().entry; pg.setPx(e + 1); await sleep(3000);
  const l = k.status().latency; ok(pg.orders.find(o => o.type === 3).stopPrice === e && !globalThis.__uiCalls && l && l.intentos.some(x => x.ok), 'api lenta: confirmada en la relectura, sin ui (' + (l && l.intentos.map(x => x.metodo + ':' + x.ok).join(',')) + ')'); await k.stop({ flatten: true }); resetG(); }
{ resetG(); globalThis.__apiHang = 1; const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate, null, null, { apiWaitMs: 300, rereadMs: 200 }), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(150); const e = k.status().entry, so = pg.orders.find(o => o.type === 3), n0 = pg.orders.length; pg.setPx(e + 1); await sleep(3000);
  ok(so.stopPrice === e && globalThis.__uiCalls === 1 && globalThis.__uiOrders[0] === so.id && pg.orders.length === n0 && !k.status().alerta, `api colgada: ui interna sobre la misma orden ${globalThis.__uiOrders && globalThis.__uiOrders[0]} (${so.id}), sin recrear`); await k.stop({ flatten: true }); resetG(); }
{ resetG(); globalThis.__apiHang = 1; globalThis.__uiBroken = true; const pg = fakePage(TVA); const k = createColchon(apiDriver(pg.evaluate, null, null, { apiWaitMs: 300, rereadMs: 200, uiWaitMs: 300 }), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be' }); await sleep(150); const e = k.status().entry, n0 = pg.orders.length; pg.setPx(e + 1); await sleep(3500);
  const a = k.status().alerta || ''; ok(/^NO PUDE MOVER EL STOP: muévelo a mano a /.test(a) && a.includes(String(e)) && /api falló, relectura falló, ui falló/.test(a) && pg.orders.length === n0 && globalThis.__uiCalls === 1, 'todo falla: aviso rojo una vez, nada cancelado (' + a + ')');
  await k.stop({ flatten: true }); resetG(); }
// 27) cuentas reales Lucid: allowlist + ya activa + confirmReal; el motor nunca cambia a una cuenta real
{ resetG(); fs.writeFileSync('C:/Users/USUARIO/AppData/Local/Temp/ra.json', '{"allowAll":true}'); const A = [{ id: '1', name: 'LFE0000000000', type: 'live', title: 'Tradovate' }, { id: '2', name: 'DEMO123', type: 'demo', title: 'Tradovate' }];
  const pg = fakePage({ ...TVA, acct: 'LFE0000000000', accounts: A }); const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC, realAllowFile: 'C:/Users/USUARIO/AppData/Local/Temp/ra.json' });
  const ac = await k.accounts(); const lfe = ac.accounts.find(a => a.id === '1'); ok(lfe && lfe.allowed && lfe.real && /evaluación/.test(lfe.realLabel), 'LFE con allowAll: permitida como REAL (' + (lfe && lfe.realLabel) + ')');
  const r0 = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be', accountId: '1' }); ok(!r0.ok && pg.positions.length === 0, 'real sin confirmReal: bloqueado, 0 órdenes');
  const r1 = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be', accountId: '1', confirmReal: true }); await sleep(150);
  ok(r1.ok && k.status().mode === 'real' && pg.positions.length === 1, 'real activa + confirmReal: arranca en modo real'); await k.stop({ flatten: true });
  pg.setCur('2'); pg.setFg(true); const r2 = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be', accountId: '1', confirmReal: true }); ok(!r2.ok && pg.cur() === '2' && pg.positions.length === 0, 'real no activa con TradingView en primer plano: no cambia (' + (r2.err || '').slice(0, 70) + ')'); pg.setFg(false);
  pg.positions.push({ id: 'X', symbol: 'CME_MINI:NQZ2026', qty: 1, side: 1, avgPrice: 20000 }); const r3b = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be', accountId: '1', confirmReal: true }); ok(!r3b.ok && pg.cur() === '2' && pg.positions.length === 1, 'posición abierta en la cuenta activa: no cambia de cuenta (' + (r3b.err || '').slice(0, 70) + ')'); pg.positions.length = 0;
  const r4 = await k.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be', accountId: '1', confirmReal: true }); await sleep(150); ok(r4.ok && pg.cur() === '1' && k.status().mode === 'real' && pg.positions.length === 1, 'real elegida + confirmReal, sin trades: cambia a LFE (id y nombre) y arranca (' + (r4.err || 'ok') + ')'); await k.stop({ flatten: true });
  const pg2 = fakePage({ ...TVA, acct: 'LFF0000000000', accounts: [{ id: '3', name: 'LFF0000000000', type: 'live', title: 'Tradovate' }] }); const k2 = createColchon(apiDriver(pg2.evaluate), { pollMs: 50, logFile: LOG, ignoreClock: true, flatConfirm: FC, realAllowFile: 'C:/Users/USUARIO/AppData/Local/Temp/no-existe.json' });
  const r3 = await k2.start({ side: 'long', symbol: 'MNQ', strategyId: 'prueba-be', accountId: '3', confirmReal: true }); ok(!r3.ok && pg2.positions.length === 0, 'sin real-allowlist.json: LFF bloqueada'); resetG(); }
// 28) informe del día
{ const md = buildReport('C:/Users/USUARIO/AppData/Local/Temp', etDay()); ok(/P&L del bróker vs P&L del chart/.test(md) && /Fuentes de P&L para decidir/.test(md) && /PRUEBA BE/.test(md) && fs.existsSync('C:/Users/USUARIO/AppData/Local/Temp/reportes/' + etDay() + '.md'), 'informe: secciones bróker vs chart, fuentes, y reportes/' + etDay() + '.md'); }

// 30) Ajuste SL/TP al precio real de fill (misma orden, una sola vez, todas las estrategias)
{ for (const [name, tv] of [['paper', null], ['tradovate', {}]]) {
  globalThis.__modCalls = 0; globalThis.__tpMods = []; globalThis.__slip = 2; const pg = fakePage({ symbol: 'CME_MINI:MNQ1!', tv, acct: tv ? 'Paper Trading' : 'Paper Trading' });
  const k = createColchon(apiDriver(pg.evaluate, null, null, { rereadMs: 100 }), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  const sid = 'prueba-be'; const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 10, strategyId: sid }); await sleep(500);
  const sl = pg.orders.find(o => o.type === 3), tp = pg.orders.find(o => o.type === 1), aj = k.status().ajuste, fill = pg.positions[0] && pg.positions[0].avgPrice;
  ok(r.ok && fill === 20002 && aj && aj.ref === 20000 && aj.fill === 20002, `${name}: ajuste registra ref 20000 y fill 20002`);
  ok(aj && aj.slNuevo === aj.slAntes + 2 && aj.tpNuevo === aj.tpAntes + 2 && sl.stopPrice === aj.slNuevo && tp.limitPrice === aj.tpNuevo && aj.ok, `${name}: SL ${aj && aj.slAntes}→${sl.stopPrice}, TP ${aj && aj.tpAntes}→${tp.limitPrice} desde el fill`);
  const ids = pg.orders.map(o => o.id).join(); await sleep(400); ok(pg.orders.map(o => o.id).join() === ids && pg.orders.length === 2, `${name}: mismas órdenes (ids ${ids}), nada cancelado ni recreado`);
  if (tv) ok(globalThis.__tpMods.length === 1, 'tradovate: TP modificado una sola vez (idempotente)');
  globalThis.__slip = 0; await k.stop({}); } }
{ const pg = fakePage(); globalThis.__slip = 0; const k = createColchon(apiDriver(pg.evaluate), { pollMs: 50, logFile: 'C:/Users/USUARIO/AppData/Local/Temp/colchon-test.log', ignoreClock: true, flatConfirm: FC });
  await k.start({ side: 'long', symbol: 'NQ', qty: 2 }); await sleep(250); const aj = k.status().ajuste; ok(aj && aj.nada && aj.ok, 'fill = referencia: sin modificaciones'); await k.stop({}); }
{ const md = buildReport('C:/Users/USUARIO/AppData/Local/Temp', etDay()); ok(/Ajuste SL\/TP al precio real de fill/.test(md) && /fill 20002/.test(md), 'informe: sección del ajuste al fill'); }
