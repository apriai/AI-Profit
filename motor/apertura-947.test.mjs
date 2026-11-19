// Apertura 0.10.26: precio vivo, fill que sí se llenó, dos lecturas, tiempos y pausa del panel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { apiDriver, bracketSeguro, createColchon, detallePrecio, frenaEscaneo, js, lineaLatencia, lineaPrecio, lineaTiempos, precioEntrada, ptsFor, roundTick, PANEL_PAUSA_MS } from './colchon.mjs';
import { manejar } from './rutas-api.mjs';

const slPts = ptsFor(600, 'MNQ', 20);
const tpPts = ptsFor(104, 'MNQ', 20);
assert.equal(slPts, 15);
assert.equal(tpPts, 2.5);
const barra = 27724.25;
const fill = 27727.75;
const tpDelCierre = roundTick(barra + tpPts);
assert.equal(tpDelCierre, 27726.75, 'el cierre de la vela dejaba el TP por debajo del fill');
assert.ok(tpDelCierre < fill);
assert.equal(precioEntrada('long', { bid: 27727.5, ask: fill, last: 27727.5, bar: barra }), fill);
assert.equal(precioEntrada('short', { bid: 27727.5, ask: fill }), 27727.5);
assert.equal(precioEntrada('long', { bar: barra }), null, 'sin bid/ask no se usa el cierre de la vela');
const bueno = bracketSeguro('long', fill, slPts, tpPts, barra);
assert.equal(bueno.recalculado, true);
assert.equal(bueno.takeProfit, roundTick(fill + tpPts));
assert.equal(bueno.stopLoss, roundTick(fill - slPts));
assert.ok(bueno.takeProfit > fill && bueno.stopLoss < fill);
assert.equal(bracketSeguro('long', fill, 0, tpPts, barra), null);
assert.equal(bracketSeguro('short', 100, 15, 2.5, 130).takeProfit, 97.5);
assert.ok(bracketSeguro('short', 100, 15, 2.5, 130).stopLoss > 100);
assert.equal(lineaTiempos({ clickServidor: 12.2, preparar: 40, cotizacion: 8, snapshot: 20, placeOrder: 90, posicion: 1100, total: 1300 }),
  'TIEMPOS: click→servidor 12 ms · preparar 40 ms · cotización 8 ms · snapshot 20 ms · placeOrder 90 ms · posición 1100 ms · total 1300 ms');
assert.equal(lineaLatencia(480, 110), 'LATENCIA: envío 480 ms · confirmación 110 ms');
assert.equal(PANEL_PAUSA_MS, 8000);
const ahora = 1_000_000;
assert.equal(frenaEscaneo({ pausa: false, panelHasta: ahora + 1000, operando: false, ahora, lastFull: 0, fullMs: 1 }).full, false);
assert.equal(frenaEscaneo({ pausa: false, panelHasta: ahora - 1, operando: false, ahora, lastFull: 0, fullMs: 1 }).full, true);
assert.equal(frenaEscaneo({ pausa: true, panelHasta: ahora + 1000, operando: false, ahora, lastFunded: 0, fullMs: 1 }).funded, false);
assert.equal(frenaEscaneo({ pausa: true, panelHasta: 0, operando: true, ahora, lastFunded: 0, fullMs: 1 }).funded, false);
assert.equal(frenaEscaneo({ pausa: true, panelHasta: 0, operando: false, ahora, lastFunded: 0, fullMs: 1 }).funded, true);

const src = fs.readFileSync(new URL('./colchon.mjs', import.meta.url), 'utf8');
const pagina = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const link = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(src, /log\(lineaLatencia\(lat\.modificarMs, lat\.confirmarMs\)\)/);
assert.match(src, /type: 2, qty, stopLoss: br\.stopLoss, takeProfit: br\.takeProfit/);
const go = pagina.slice(pagina.indexOf('async function go(side)'), pagina.indexOf('function latHTML'));
assert.doesNotMatch(go, /\/api\/colchon\/check/);
assert.match(go, /Elige una cuenta/);
assert.match(go, /accountName:sa\.name/);
assert.match(go, /tClick/);
assert.match(go, /needConfirm/);
assert.match(pagina, /\/api\/colchon\/panel/);
assert.match(pagina, /pulsoPanel\(false\)/);
assert.match(link, /frenaEscaneo/);
assert.match(link, /pulsoPanel/);
assert.match(js.cotizacion, /q\.ask/);
assert.doesNotMatch(js.cotizacion, /placeOrder/);
assert.doesNotMatch(js.preparar('1', 'Paper Trading', 'MNQ'), /placeOrder/);

function fakePage() {
  const hist = [], execs = [], ordenes = [], stops = [], positions = [];
  let px = 20000, cur = '1', cierres = 0;
  const accs = [{ id: '1', name: 'Paper Trading', type: 'demo' }, { id: '2', name: 'Paper Dos', type: 'demo' }];
  const ab = {
    _brokerMetainfo: { id: 'Paper', title: 'Paper Trading' },
    currentAccount: () => cur,
    async accountsMetainfo() { return accs.map(a => ({ ...a })); },
    setCurrentAccount(id) { setTimeout(() => { cur = String(id); }, 30); },
    async positions() {
      if (globalThis.__mostrarEn && ordenes.length && Date.now() < globalThis.__mostrarEn) return [];
      return positions.map(p => ({ ...p, pl: (px - p.avgPrice) * p.side * (/MNQ/.test(p.symbol) ? 2 : 20) * p.qty, stopLoss: (stops.find(o => o.type === 3) || {}).stopPrice, takeProfit: (stops.find(o => o.type === 1) || {}).limitPrice }));
    },
    async orders() { return stops.filter(o => o.status === 6).map(o => ({ ...o })); },
    async ordersHistory() { return hist.map(o => ({ ...o })); },
    async allExecutions() { if (globalThis.__execThrow) throw new Error('fallo-ejecuciones'); return execs.map(x => ({ ...x })); },
    async symbolInfo(sy) { if (/ES/.test(sy)) throw new Error('no'); return { name: sy }; },
    async placeOrder(o) {
      ordenes.push({ ...o });
      if (globalThis.__rechazo) { hist.push({ id: 'R1', symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 5, time: Date.now(), message: { text: 'Not enough funds' } }); return {}; }
      if (globalThis.__trabajando) {
        hist.push({ id: 'W1', symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 6, time: Date.now() });
        execs.push({ id: 'E1', symbol: o.symbol, side: o.side, qty: o.qty, price: 10, time: Date.now() });
        execs.push({ id: 'E2', symbol: o.symbol, side: -o.side, qty: o.qty, price: 9, time: Date.now() });
        return { orderId: 'W1' };
      }
      if (globalThis.__muda) return { orderId: 'Z1' };
      if (globalThis.__cerrarYa) {
        execs.push({ id: 'NEW1', symbol: o.symbol, side: o.side, qty: o.qty, price: 27727.75, time: Date.now() });
        execs.push({ id: 'NEW2', symbol: o.symbol, side: -o.side, qty: o.qty, price: 27726.75, time: Date.now() });
        hist.push({ id: 'M1', symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 2, time: Date.now(), avgPrice: 27727.75 });
        return { orderId: 'M1' };
      }
      if (globalThis.__mostrarEnMs) globalThis.__mostrarEn = Date.now() + globalThis.__mostrarEnMs;
      const id = 'P' + ordenes.length;
      positions.push({ id, symbol: o.symbol, side: o.side, qty: o.qty, avgPrice: px });
      stops.push({ id: 'S' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 3, status: 6, qty: o.qty, stopPrice: o.stopLoss });
      stops.push({ id: 'T' + id, parentId: id, symbol: o.symbol, side: -o.side, type: 1, status: 6, qty: o.qty, limitPrice: o.takeProfit });
      hist.push({ symbol: o.symbol, type: 2, side: o.side, qty: o.qty, status: 6, time: Date.now() });
      return { orderId: id };
    },
    async editPositionBrackets(id, b) { const so = stops.find(o => o.type === 3); if (so && b.stopLoss != null) so.stopPrice = b.stopLoss; return true; },
    async modifyOrder(o) { const x = stops.find(q => q.id === o.id); if (x) Object.assign(x, o); return true; },
    async closePosition() { cierres++; positions.length = 0; stops.length = 0; return true; },
  };
  const win = {
    TradingView: { bottomWidgetBar: { _widgetControllers: new Map([['paper_trading', { _trading: { activeBroker: () => ab, _ordersService: { activeOrders: () => stops.filter(o => o.status === 6) } } }]]) } },
    TradingViewApi: { _activeChartWidgetWV: { value: () => ({ symbol: () => globalThis.__sym || 'CME_MINI:MNQ1!', _chartWidget: { model: () => ({ mainSeries: () => ({ symbol: () => globalThis.__sym || 'CME_MINI:MNQ1!', symbolInfo: () => ({ front_contract: 'MNQZ2026' }), quotes: () => (globalThis.__sinCota ? {} : { bid: globalThis.__bid ?? px - 0.25, ask: globalThis.__ask ?? px, last: globalThis.__last ?? px, askTime: globalThis.__askTime ?? null, bidTime: globalThis.__bidTime ?? null, lastTime: globalThis.__lastTime ?? null }), bars: () => ({ last: () => ({ value: [0, 0, 0, 0, globalThis.__bar ?? px] }) }) }) }) } }) } },
  };
  const doc = {
    get visibilityState() { return 'hidden'; },
    hasFocus: () => false,
    querySelector: s => /accountName/.test(s) ? { get innerText() { return accs.find(a => a.id === cur).name; } } : null,
  };
  const evaluate = async expr => new Function('window', 'document', 'performance', 'return (' + expr + ')')(win, doc, performance);
  return { evaluate, ordenes, execs, hist, cierres: () => cierres, setPx: v => { px = v; } };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-947-'));
const logFile = path.join(tmp, 'colchon.log');
const allow = path.join(tmp, 'no-allow.json');
function limpiar() { for (const k of ['__cerrarYa', '__rechazo', '__sinCota', '__mostrarEn', '__mostrarEnMs', '__ask', '__bid', '__bar', '__sym', '__askTime', '__execThrow', '__muda', '__trabajando']) delete globalThis[k]; }
function motor(pg, extra = {}) {
  const marcas = [];
  const ev = async expr => { marcas.push(expr.includes('placeOrder') ? 'place' : expr.includes('symbolInfo') ? 'preparar' : expr.includes('q.ask') ? 'cotizacion' : expr.includes('ordersHistory') ? 'visto' : 'otro'); return pg.evaluate(expr); };
  const k = createColchon(apiDriver(ev), { pollMs: 40, logFile, ignoreClock: true, noTicks: true, flatConfirm: { reads: 1, ms: 0 }, realAllowFile: allow, fuente: { modo: 'broker', frescoMs: 5000, pollMs: 40 }, fillWaitMs: 800, ...extra });
  return { k, marcas };
}
function antesDeOrden(marcas) {
  const i = marcas.indexOf('place');
  return (i < 0 ? marcas : marcas.slice(0, i)).filter(x => x !== 'otro');
}

assert.match(pagina, /p==="aviso"/);
assert.match(go, /r\.closed/);
assert.match(go, /setPhase\("aviso"/);
assert.match(pagina, /else if\(p==="aviso"\)\{setAwake\(false\);card\.innerHTML=`<div class=h>Se llenó y se cerró<\/div>/);
assert.match(pagina, /phase==="aviso"&&setPhase\("off"\),6000/);
const aviso = pagina.slice(pagina.indexOf('else if(p==="aviso")'), pagina.indexOf('else if(p==="blocked")'));
assert.doesNotMatch(aviso, /Bloqueado/);
assert.doesNotMatch(aviso, /Todas las cuentas Lucid/);
const marca = 1_700_000_000_000;
assert.equal(detallePrecio('long', { ask: fill, askTime: marca - 250, bid: fill - 0.25 }, marca).fuente, 'ask');
assert.equal(detallePrecio('long', { ask: fill, askTime: marca - 250, bid: fill - 0.25 }, marca).edadMs, 250);
assert.equal(detallePrecio('long', { bid: fill }).fuente, 'lado opuesto');
assert.equal(detallePrecio('short', { ask: fill }).fuente, 'lado opuesto');
assert.equal(lineaPrecio({ fuente: 'ask', precio: fill, edadMs: 40, recalculado: true }), `PRECIO: ask ${fill} · edad 40 ms · recalculado sí`);

limpiar();
{
  const pg = fakePage(); globalThis.__ask = 27727.75; globalThis.__bid = 27727.5; globalThis.__bar = 27700; globalThis.__askTime = Date.now() - 180; pg.setPx(27727.75);
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 20, strategyId: 'evaluacion-simple', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() - 15 });
  assert.equal(r.ok, true, r.err);
  assert.deepEqual(antesDeOrden(marcas), ['preparar', 'cotizacion']);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
  assert.equal(pg.ordenes[0].takeProfit, 27743.5);
  assert.equal(pg.ordenes[0].stopLoss, 27712);
  assert.equal(pg.ordenes[0].type, 2);
  assert.equal(pg.cierres(), 0);
  const texto = fs.readFileSync(logFile, 'utf8');
  assert.match(texto, /TIEMPOS: click→servidor \d+ ms · preparar \d+ ms · cotización \d+ ms · snapshot \d+ ms · placeOrder \d+ ms · posición \d+ ms · total \d+ ms/);
  assert.match(texto, /PRECIO: ask 27727\.75 · edad \d+ ms · recalculado sí/);
  await k.stop({ flatten: false });
}

limpiar();
{
  const pg = fakePage(); globalThis.__cerrarYa = true; globalThis.__ask = 27727.75; globalThis.__bar = 27724.25; pg.setPx(27727.75);
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'evaluacion-simple', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.filled, true);
  assert.equal(r.closed, true);
  assert.match(r.err, /se llenó y se cerró: entrada 27727\.75 salida 27726\.75/);
  assert.doesNotMatch(r.err, /no se llenó/);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
  assert.equal(pg.cierres(), 0);
  assert.equal(k.status().state === 'running', false);
}

limpiar();
{
  const pg = fakePage(); globalThis.__sinCota = true;
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.ok, false);
  assert.match(r.err, /precio vivo/);
  assert.equal(marcas.includes('place'), false);
  assert.equal(pg.ordenes.length, 0);
}

limpiar();
{
  const pg = fakePage(); globalThis.__rechazo = true; globalThis.__ask = 20000;
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.match(r.err, /RECHAZADA/);
  assert.match(r.err, /Not enough funds/);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
}

limpiar();
{
  const pg = fakePage(); globalThis.__mostrarEnMs = 350; globalThis.__ask = 20000;
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'evaluacion-simple', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.ok, true, r.err);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
  assert.equal(pg.cierres(), 0);
  await k.stop({ flatten: false });
}

limpiar();
{
  const pg = fakePage(); globalThis.__ask = 20000;
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '2', accountName: 'Paper Dos', tClick: Date.now() });
  assert.equal(r.ok, true, r.err);
  assert.deepEqual(antesDeOrden(marcas), ['preparar', 'cotizacion']);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
  await k.stop({ flatten: false });
}

limpiar();
{
  const pg = fakePage(); globalThis.__mostrarEnMs = 700; globalThis.__ask = 20000;
  const { k, marcas } = motor(pg, { fillWaitMs: 120, adoptMs: 2500 });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, strategyId: 'evaluacion-simple', accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.ok, true, r.err);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
  assert.equal(k.status().state, 'running');
  await k.stop({ flatten: false });
}
limpiar();
{
  const pg = fakePage(); globalThis.__muda = true; globalThis.__ask = 20000;
  pg.execs.push({ id: 'V1', symbol: 'CME_MINI:MNQ1!', side: 1, qty: 1, price: 1, time: 0 });
  pg.execs.push({ id: 'V2', symbol: 'CME_MINI:MNQ1!', side: -1, qty: 1, price: 2 });
  const { k, marcas } = motor(pg, { fillWaitMs: 150, adoptMs: 200 });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.notEqual(r.closed, true);
  assert.doesNotMatch(String(r.err), /se llenó y se cerró/);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
}
limpiar();
{
  const pg = fakePage(); globalThis.__cerrarYa = true; globalThis.__ask = 27727.75; globalThis.__bar = 27724.25;
  pg.execs.push({ id: 'OLD1', symbol: 'CME_MINI:MNQ1!', side: 1, qty: 1, price: 1, time: Date.now() });
  pg.execs.push({ id: 'OLD2', symbol: 'CME_MINI:MNQ1!', side: -1, qty: 1, price: 2, time: Date.now() });
  const { k } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.equal(r.closed, true);
  assert.match(r.err, /entrada 27727\.75 salida 27726\.75/);
  assert.doesNotMatch(r.err, /entrada 1/);
}
limpiar();
{
  const pg = fakePage(); globalThis.__rechazo = true; globalThis.__ask = 20000;
  pg.execs.push({ id: 'OLD1', symbol: 'CME_MINI:MNQ1!', side: 1, qty: 1, price: 10, time: Date.now() });
  pg.execs.push({ id: 'OLD2', symbol: 'CME_MINI:MNQ1!', side: -1, qty: 1, price: 9, time: Date.now() });
  const { k, marcas } = motor(pg);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.match(r.err, /RECHAZADA/);
  assert.doesNotMatch(String(r.err), /se llenó y se cerró/);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
}
limpiar();
{
  const pg = fakePage(); globalThis.__trabajando = true; globalThis.__ask = 20000;
  const { k, marcas } = motor(pg, { fillWaitMs: 80, adoptMs: 350 });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.match(r.err, /sigue en el bróker/);
  assert.doesNotMatch(String(r.err), /se llenó y se cerró/);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
}
limpiar();
{
  const pg = fakePage(); globalThis.__execThrow = true; globalThis.__muda = true; globalThis.__ask = 20000;
  const { k, marcas } = motor(pg, { fillWaitMs: 120, adoptMs: 200 });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '1', accountName: 'Paper Trading', tClick: Date.now() });
  assert.notEqual(r.closed, true);
  assert.match(String(r.err), /No pude leer las ejecuciones/);
  assert.match(fs.readFileSync(logFile, 'utf8'), /No pude leer las ejecuciones: fallo-ejecuciones/);
  assert.equal(marcas.filter(x => x === 'place').length, 1);
}
limpiar();
{
  let n = 0;
  const k = createColchon(apiDriver(async () => { n++; throw new Error('no debía leer TradingView'); }), { logFile, ignoreClock: true, realAllowFile: allow, noTicks: true });
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: '9', accountName: 'LFE02500000000001', confirmReal: false, tClick: Date.now() });
  assert.equal(r.needConfirm, true);
  assert.match(r.err, /falta confirmación/);
  assert.equal(n, 0);
  const r2 = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, tClick: Date.now() });
  assert.match(r2.err, /Elige una cuenta/);
  assert.equal(n, 0);
}

const llamadas = [];
const srv = http.createServer((q, r) => manejar(q, r, {
  propiasH: () => false, negocioH: () => false,
  vistaPrevia: { aplicar: async () => ({}) },
  colchon: { status: () => ({ state: 'idle' }), start: async () => ({ ok: true }), stop: async () => ({ ok: true }), summary: () => null, strategies: () => [], accounts: async () => ({}), check: async () => ({}) },
  colchonCFG: {}, DIR: tmp, state: { accounts: {} }, buildReport: () => '', diaFarm: () => '2026-11-19', maskId: s => s, detalleTrade: () => ({ ok: true }),
  lastFull: () => 0, lastBusy: () => Date.now(), quietMs: () => 1000, metricasDe: async () => ({}), tradesDe: async () => [], conexion: async () => ({}),
  orders: { DRY_RUN: true, bot: { get: () => false, set: v => v }, request: () => ({ ok: true }), confirm: async () => ({ ok: true }), cancel: () => true },
  algoTv: () => ({ estado: () => ({}), fijar: async () => ({}) }), textoVersion: () => '0.10.26', ROOT: tmp, HTML: path.join(tmp, 'no.html'),
  pulsoPanel: abierto => { llamadas.push(abierto); return abierto ? Date.now() + 8000 : 0; },
  panelAbierto: () => llamadas[llamadas.length - 1] === true,
}));
await new Promise(res => srv.listen(0, '127.0.0.1', res));
const puerto = srv.address().port;
async function post(ruta, cuerpo) {
  const r = await fetch(`http://127.0.0.1:${puerto}/${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  return r.json();
}
const abierto = await post('api/colchon/panel', { abierto: true });
assert.equal(abierto.ok, true);
assert.equal(abierto.abierto, true);
assert.deepEqual(llamadas, [true]);
const cerrado = await post('api/colchon/panel', { abierto: false });
assert.equal(cerrado.abierto, false);
srv.close();

console.log('apertura-947 ok');
