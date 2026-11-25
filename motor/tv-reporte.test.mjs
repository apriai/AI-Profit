// Pruebas del reporte en TradingView. No abre órdenes ni se conecta al gráfico.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PAGE, diaFarm } from './colchon.mjs';
import {
  MODULO, TITULO, GRUPO, ESTILO, ESPERAS_MS, ARCHIVO,
  rootOf, cierresDeFills, planDibujo, pasosDibujo, expresionDibujo, expresionDibujo as expr, expresionQuitar,
  reducirPosiciones, eventoDesdeGranja, createReporte, textoDuracion, textoPnl, colorPnl, horaET,
  READ_EXEC_JS, READ_CHARTS_JS, JS_ESCUCHA, chartBloquea, esTransitorio,
  diaCalendarioNY, cierresDelDia, idsAQuitar, cruzarFinTrade, leerFinTrades,
} from './tv-reporte.mjs';

const PROHIBIDO = /placeOrder|modifyOrder|editPositionBrackets|closePosition|cancelOrder|createEditOrderContext|setCurrentAccount|removeAllShapes|setSymbol/;
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); pass++; };

const u = s => Date.parse(`2026-11-06T${s}-05:00`);
const CUENTA = 'LFE000000000014';
const fill = (id, side, qty, price, time, symbol = 'CME_MINI:MNQZ2026') => ({ id, side, qty, price, time, symbol });

function muestra() {
  const entryMs = u('09:33:37'), exitMs = u('09:33:50');
  return {
    entryMs, exitMs,
    ex: [
      fill('old-e', 1, 1, 27000, u('08:00:00')),
      fill('old-x', -1, 1, 27010, u('08:00:04')),
      fill('e1', 1, 8, 27179.25, entryMs),
      fill('x1', -1, 8, 27139.5, exitMs),
    ],
    aviso: {
      cerrado: true, side: 'long', symbol: 'MNQ', entrada: 27179.25, cuenta: CUENTA, accountId: '99', qty: 8,
      abiertaEn: new Date(entryMs).toISOString(), cerradaEn: new Date(exitMs).toISOString(),
      slVisto: 27139.75, tpVisto: 27218.75, direccion: 'COMPRA',
    },
  };
}

function banco(dir, opt = {}) {
  const sleeps = [];
  const reads = [];
  const charts = [];
  const draws = [];
  const quits = [];
  const state = {
    ex: opt.ex || [],
    charts: opt.charts || [{ index: 0, symbol: 'CME_MINI:MNQ1!', active: true }],
    failRead: 0, failChart: 0, drawThrow: 0, drawRes: null,
  };
  const rep = createReporte({
    dir,
    now: opt.now || (() => u('09:34:00')),
    sleep: ms => { sleeps.push(ms); return Promise.resolve(); },
    readExec: async () => {
      reads.push(1);
      if (opt.orden) opt.orden.push('leer');
      if (state.readGate) await state.readGate;
      if (opt.orden) opt.orden.push('leido');
      if (state.failRead) { state.failRead--; throw new Error('ECONNREFUSED'); }
      if (state.noApi) return { error: 'no-api' };
      const ex = typeof state.ex === 'function' ? state.ex(reads.length) : state.ex;
      return { cuenta: CUENTA, accountId: '99', ex };
    },
    readCharts: async () => {
      charts.push(1);
      if (state.failChart) { state.failChart--; throw new Error('sin chart'); }
      return typeof state.charts === 'function' ? state.charts(charts.length) : state.charts;
    },
    draw: async (plan, chart) => {
      draws.push({ plan, chart });
      if (opt.orden) opt.orden.push('dibujar');
      if (state.drawThrow) { state.drawThrow--; throw new Error('cdp cortado'); }
      if (state.drawRes) return state.drawRes;
      const n = pasosDibujo(plan).filter(p => p.op === 'shape' || p.op === 'multipoint').length;
      return { ok: true, ids: Array.from({ length: n }, (_, i) => `id${draws.length}-${i}`), save: { method: 'TradingViewApi.saveChartToServer', called: true, layoutId: 'L1' } };
    },
    quitar: async (pedido) => {
      quits.push(pedido);
      if (opt.orden) opt.orden.push('quitar');
      if (state.quitarThrow) { state.quitarThrow--; throw new Error('sin tv'); }
      if (state.quitarRes) return typeof state.quitarRes === 'function' ? state.quitarRes(pedido) : state.quitarRes;
      return { ok: true, removed: (pedido.ids || []).slice(), via: pedido.ids && pedido.ids.length ? 'ids' : null, save: { method: 'TradingViewApi.saveChartToServer', called: true, layoutId: 'L1' } };
    },
    leerEventos: opt.leerEventos || (() => []),
    raizOcupada: opt.raizOcupada,
    activo: opt.activo,
    log() {},
  });
  return { rep, sleeps, reads, charts, draws, quits, state };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tv-reporte-'));

// --- estilo aprobado (muestra del 6 nov 2026) ---
{
  const s = muestra();
  const trips = cierresDeFills(s.ex, { cuenta: CUENTA, accountId: '99' });
  eq(trips.length, 2);
  const t = trips.find(x => x.entryIds.includes('e1'));
  eq(t.pnl, -636);
  eq(t.qty, 8);
  eq(t.entry, 27179.25);
  eq(t.exit, 27139.5);
  eq(textoDuracion(t.entryMs, t.exitMs), 'Duration: 13s');
  eq(horaET(t.entryMs), '09:33:37');
  eq(textoPnl(-636), '-$636');
  eq(textoPnl(-514.5), '-$514.5');
  eq(textoPnl(0), '+$0');
  eq(colorPnl(-636), '#ef5350');
  eq(colorPnl(12), '#26a69a');
  const plan = planDibujo({ ...t, n: 1, sl: 27139.75, tp: 27218.75 });
  eq(plan.estilo, ESTILO);
  eq(plan.grupo, 'reporte');
  eq(plan.titulo, TITULO);
  eq(plan.arrow.shape, 'arrow_up');
  eq(plan.arrow.color, '#2962ff');
  eq(plan.arrow.time, Math.round(t.entryMs / 1000));
  eq(plan.arrow.price, 27179.25);
  eq(plan.info.time, Math.round(t.exitMs / 1000) + 360);
  eq(plan.pnl.time, plan.info.time);
  eq(plan.info.price, 27139.5);
  eq(plan.pnl.price, 27139.5);
  eq(plan.pnl.text, '\n\n-$636');
  eq(plan.pnl.color, '#ef5350');
  ok(plan.info.text.startsWith('#1 LONG x8 09:33:37 ET ..014\nDuration: 13s\n\n '), plan.info.text);
  ok(!plan.info.text.includes(CUENTA), 'la cuenta completa no va en el dibujo');
  eq(plan.line.color, '#ef5350');
  eq(plan.line.points[1].time, Math.round(t.exitMs / 1000));
  eq(plan.position.shape, 'long_position');
  eq(plan.position.points[1].time, Math.round(t.exitMs / 1000) + 300);
  eq(plan.position.stopLevel, 158);
  eq(plan.position.profitLevel, 158);
  eq(plan.position.qty, 8);
  const pasos = pasosDibujo(plan);
  ok(pasos.some(p => p.op === 'frente') && pasos.some(p => p.op === 'nombre' && p.title === GRUPO) && pasos.some(p => p.op === 'guardar'));
  ok(pasos.every(p => !p.opts || p.opts.disableSave !== true));
  const js = expresionDibujo(plan, 0);
  ok(js.includes('sendToBack') && js.includes('bringToFront'));
  ok(js.includes('saveChartToServer') && js.includes('reporte'));
  ok(js.includes('removeEntity') && js.includes('intento<2'), 'el reintento de formas es interno a la misma llamada');
  ok(!js.includes('getAllShapes') && !js.includes('removeAllShapes') && !js.includes('createGroupFromSelection'));
  ok(!PROHIBIDO.test(js));
  const malLado = planDibujo({ ...t, side: 'short', n: 2, pnl: 40, sl: 27100, tp: 27200 });
  eq(malLado.arrow.shape, 'arrow_down');
  eq(malLado.position, null, 'SL/TP del lado equivocado: sin caja');
  const sinSl = planDibujo({ ...t, n: 3, sl: null, tp: 27218.75 });
  eq(sinSl.position, null);
  eq(textoDuracion(0, 61000), 'Duration: 1m 01s');
}

// --- un cierre en vivo dibuja una vez; el historial del mismo paquete no ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex });
  ok(b.reads.length === 0, 'al crear el módulo no se leen fills');
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'dibujado');
  eq(b.draws.length, 1);
  eq(b.draws[0].plan.arrow.price, 27179.25);
  eq(b.sleeps.length, 0, 'con fills y chart listos no hay espera');
  ok(typeof r.ms === 'number');
  const otra = await b.rep.alCerrar(s.aviso);
  eq(otra.status, 'ya');
  eq(b.draws.length, 1, 'el aviso repetido no redibuja');
  b.state.charts = []; // el usuario borró los dibujos; el chart mock ya no importa: no se vuelve a llamar
  const b2 = banco(dir, { ex: s.ex });
  const r2 = await b2.rep.alCerrar(s.aviso);
  eq(r2.status, 'ya');
  eq(b2.draws.length, 0, 'reiniciar no recrea un reporte, aunque el usuario lo haya borrado');
  const apagado = banco(tmp(), { ex: s.ex, activo: () => false });
  const noDibuja = await apagado.rep.alCerrar(s.aviso);
  eq(noDibuja.status, 'apagado');
  eq(apagado.draws.length, 0, 'con el interruptor en No no se dibuja');
  eq(apagado.reads.length, 0, 'apagado no lee fills');
  const guardado = JSON.parse(fs.readFileSync(path.join(dir, ARCHIVO), 'utf8'));
  eq(guardado.modulo, MODULO);
  ok(!JSON.stringify(guardado).includes(CUENTA), 'el json de estado no guarda la cuenta completa');
}

// --- borrado explícito: la segunda vida del proceso no mira los ids ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex });
  await b.rep.alCerrar(s.aviso);
  const ids = b.rep.estado().handled;
  const key = Object.keys(ids)[0];
  ids[key].ids = []; // alguien borró las formas en TradingView
  const b2 = banco(dir, { ex: s.ex });
  await b2.rep.alCerrar(s.aviso);
  eq(b2.draws.length, 0);
  ok(!b2.reads.length || b2.draws.length === 0);
}

// --- sin TradingView: transitorio, se reintenta y luego dibuja una vez ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex });
  b.state.failRead = 10;
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'omitido');
  eq(r.razon, 'TradingView no disponible');
  eq(r.transitorio, true);
  eq(b.draws.length, 0);
  eq(b.sleeps, [350, 800, 2000, 5000]);
  eq(ESPERAS_MS, [0, 350, 800, 2000, 5000]);
  ok(esTransitorio('TradingView no disponible') && esTransitorio('sin fills del cierre'));
  ok(!esTransitorio('simbolo distinto') && !esTransitorio('dibujo no confirmado'));
  const guardado1 = JSON.parse(fs.readFileSync(path.join(dir, ARCHIVO), 'utf8'));
  ok(!Object.keys(guardado1.handled || {}).length, 'un fallo transitorio no queda en handled');
  ok(Object.keys(guardado1.pending || {}).length === 1, 'queda pendiente para reintentar');
  ok(!JSON.stringify(guardado1).includes(CUENTA), 'el pendiente no guarda la cuenta completa');
  const antes = b.reads.length;
  eq(antes, 5);
  const r2 = await b.rep.alCerrar(s.aviso);
  eq(r2.status, 'omitido');
  eq(r2.transitorio, true);
  ok(b.reads.length > antes, 'un segundo aviso vuelve a intentar si fue transitorio');
  eq(b.draws.length, 0);
  b.state.failRead = 0;
  const rOk = await b.rep.alCerrar(s.aviso);
  eq(rOk.status, 'dibujado');
  eq(b.draws.length, 1);
  const b2 = banco(dir, { ex: s.ex });
  const r3 = await b2.rep.alCerrar(s.aviso);
  eq(r3.status, 'ya');
  eq(b2.draws.length, 0, 'una vez dibujado, reiniciar no recrea');
}

// --- no-api y fills que llegan tarde: transitorio, luego dibuja; reconnect reintenta pendientes ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: [] });
  b.state.noApi = true;
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'omitido');
  eq(r.razon, 'TradingView no disponible');
  eq(r.transitorio, true);
  eq(r.fills, 0);
  b.state.noApi = false;
  const rFills = await b.rep.alCerrar(s.aviso);
  eq(rFills.status, 'omitido');
  eq(rFills.razon, 'sin fills del cierre');
  eq(rFills.transitorio, true);
  eq(rFills.fills, 0);
  eq(b.draws.length, 0);
  const b2 = banco(dir, { ex: s.ex });
  const flush = await b2.rep.reintentarPendientes();
  eq(flush.n, 1);
  eq(flush.resultados[0].status, 'dibujado');
  eq(b2.draws.length, 1);
  const flush2 = await b2.rep.reintentarPendientes();
  eq(flush2.n, 0);
  eq(flush2.resultados.length, 0);
  eq(b2.draws.length, 1, 'el reintento posterior no duplica el dibujo');
}

// --- símbolo distinto: no dibuja y no espera a que el usuario cambie el chart ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex, charts: [{ index: 0, symbol: 'CME_MINI:NQ1!', active: true }] });
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'omitido');
  eq(r.razon, 'simbolo distinto');
  eq(b.draws.length, 0);
  eq(b.sleeps.length, 0);
  eq(chartBloquea([{ symbol: '' }], 'MNQ').retry, true);
  eq(chartBloquea([{ symbol: 'CME_MINI:NQ1!' }], 'MNQ').retry, false);
}

// --- chart vacío y luego listo, dentro del mismo cierre ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex });
  b.state.charts = n => n < 2 ? [{ index: 0, symbol: '', active: true }] : [{ index: 0, symbol: 'CME_MINI:MNQ1!', active: true }];
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'dibujado');
  eq(b.draws.length, 1);
  eq(b.sleeps, [350]);
}

// --- la llamada de dibujo que se corta no se repite ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex });
  b.state.drawThrow = 1;
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'omitido');
  eq(r.razon, 'dibujo no confirmado');
  eq(b.draws.length, 1);
  await b.rep.alCerrar(s.aviso);
  eq(b.draws.length, 1);
}

// --- formas a medias: se recuerdan y no se añaden más ---
{
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex });
  b.state.drawRes = { ok: false, partial: true, ids: ['solo-flecha'], error: 'corte' };
  const r = await b.rep.alCerrar(s.aviso);
  eq(r.status, 'parcial');
  eq(b.draws.length, 1);
  await b.rep.alCerrar(s.aviso);
  eq(b.draws.length, 1);
}

// --- intento fallido de la granja y posición que no cerró ---
{
  const dir = tmp();
  const b = banco(dir, { ex: muestra().ex });
  const r = await b.rep.alCerrar({ cerrado: false, reason: 'error', symbol: 'MNQ', side: 'long' });
  eq(r.status, 'ignorado');
  eq(b.reads.length, 0);
  eq(eventoDesdeGranja({ cerrado: true, reason: 'error' }), null);
  const abiertos = [fill('e', 1, 2, 100, u('09:40:00'))];
  eq(cierresDeFills(abiertos).length, 0);
  eq(cierresDeFills([fill('a', 1, 2, 100, u('09:40:00'), 'CME_MINI:MNQZ2026'), fill('a', 1, 2, 100, u('09:40:00'))]).length, 0);
}

// --- escala, cruce por cero, corto manual, P&L exacto ---
{
  const t0 = u('10:00:00');
  const escala = cierresDeFills([
    fill('a', 1, 2, 100, t0), fill('b', 1, 2, 102, t0 + 1000), fill('c', -1, 4, 101, t0 + 5000),
  ]);
  eq(escala.length, 1);
  eq(escala[0].qty, 4);
  eq(escala[0].entry, 101);
  eq(escala[0].pnl, 0);
  const cruce = cierresDeFills([fill('a', 1, 2, 100, t0), fill('b', -1, 5, 110, t0 + 2000)]);
  eq(cruce.length, 1);
  eq(cruce[0].qty, 2);
  eq(cruce[0].pnl, 40);
  const corto = cierresDeFills([
    { id: 's', symbol: 'CME_MINI:NQZ2026', side: -1, qty: 1, price: 100, time: t0 },
    { id: 'b', symbol: 'CME_MINI:NQZ2026', side: 1, qty: 1, price: 90, time: t0 + 7000 },
  ], { cuenta: 'PAPER1' });
  eq(corto[0].side, 'short');
  eq(corto[0].pnl, 200);
  eq(textoDuracion(corto[0].entryMs, corto[0].exitMs), 'Duration: 7s');
  const plan = planDibujo({ ...corto[0], n: 1, sl: 110, tp: 80 });
  eq(plan.arrow.shape, 'arrow_down');
  eq(plan.pnl.color, '#26a69a');
  eq(plan.pnl.text, '\n\n+$200');
  eq(plan.position.shape, 'short_position');
  eq(plan.position.stopLevel, 40);
  eq(plan.position.profitLevel, 80);
  eq(cierresDeFills([{ id: 'z', symbol: 'NYMEX:CLZ2026', side: 1, qty: 1, price: 70, time: t0 }, { id: 'y', symbol: 'NYMEX:CLZ2026', side: -1, qty: 1, price: 71, time: t0 + 1000 }]).length, 0);
}

// --- manual: solo la transición en vivo; reconexión no repone ---
{
  const abierto = { cuenta: CUENTA, accountId: '99', symbol: 'CME_MINI:MNQZ2026', side: 'long', qty: 8, entry: 27179.25, sl: 27139.75, tp: 27218.75 };
  let r = reducirPosiciones({ open: {} }, { reconexion: true, lecturaOk: true, positions: [abierto], cierres: [abierto], at: u('09:33:00') });
  eq(r.eventos.length, 0, 'la foto al conectar no es un cierre');
  r = reducirPosiciones(r.mem, { reconexion: false, lecturaOk: true, positions: [abierto], at: u('09:33:10') });
  eq(r.eventos.length, 0, 'un fill parcial que deja la posición abierta no dibuja');
  r = reducirPosiciones(r.mem, { reconexion: false, lecturaOk: false, positions: [], cierres: [abierto], at: u('09:33:50') });
  eq(r.eventos.length, 0, 'una lectura fallida no se toma como cierre');
  const memAbierta = r.mem;
  r = reducirPosiciones(memAbierta, { reconexion: true, lecturaOk: true, positions: [], at: u('09:40:00') });
  eq(r.eventos.length, 0, 'al reconectar, si ya está plano, no se recupera el cierre');
  r = reducirPosiciones(memAbierta, { reconexion: false, lecturaOk: true, positions: [], at: u('09:33:50') });
  eq(r.eventos.length, 1);
  eq(r.eventos[0].origen, 'manual');
  eq(r.eventos[0].slVisto, 27139.75);
  const dir = tmp();
  const s = muestra();
  const b = banco(dir, { ex: s.ex, raizOcupada: () => 'MNQ' });
  b.rep.onPosicion({ reconexion: false, lecturaOk: true, positions: [], cierres: [], at: s.exitMs });
  b.rep.onPosicion({ reconexion: false, lecturaOk: true, positions: [abierto], at: s.entryMs });
  b.rep.onPosicion({ reconexion: false, lecturaOk: true, positions: [], at: s.exitMs });
  eq(b.draws.length, 0, 'mientras la granja opera ese símbolo, la escucha no dibuja');
  const b3 = banco(dir + '-m', { ex: s.ex });
  b3.rep.onPosicion({ reconexion: true, lecturaOk: true, positions: [abierto], at: s.entryMs });
  b3.rep.onPosicion({ reconexion: false, lecturaOk: true, positions: [], at: s.exitMs });
  await new Promise(r => setImmediate(r));
  eq(b3.draws.length, 1, 'el cierre manual en vivo sí se dibuja');
  eq(b3.draws[0].plan.position.stopLevel, 158);
  b3.rep.resetMemoria();
  b3.rep.onPosicion({ reconexion: true, lecturaOk: true, positions: [], cierres: [abierto], at: s.exitMs + 60000 });
  await new Promise(r => setImmediate(r));
  eq(b3.draws.length, 1, 'la reconexión no crea otro dibujo');
}

// --- dos cierres distintos sí; el mismo id de fill no se duplica ---
{
  const dir = tmp();
  const t1 = u('11:00:00'), t2 = u('11:05:00');
  const ex = [
    fill('a', 1, 1, 100, t1), fill('b', -1, 1, 101, t1 + 3000),
    fill('c', 1, 1, 200, t2), fill('d', -1, 1, 198, t2 + 9000),
  ];
  const b = banco(dir, { ex, charts: [{ index: 0, symbol: 'CME_MINI:MNQ1!', active: true }] });
  const aviso = (ms, entrada, close) => ({ cerrado: true, side: 'long', symbol: 'MNQ', entrada, cuenta: CUENTA, accountId: '99', abiertaEn: new Date(ms).toISOString(), cerradaEn: new Date(close).toISOString(), slVisto: entrada - 10, tpVisto: entrada + 10 });
  eq((await b.rep.alCerrar(aviso(t1, 100, t1 + 3000))).status, 'dibujado');
  eq((await b.rep.alCerrar(aviso(t2, 200, t2 + 9000))).status, 'dibujado');
  eq(b.draws.length, 2);
  eq(b.draws[1].plan.pnl.text, '\n\n-$4');
  eq(textoDuracion(t2, t2 + 9000), 'Duration: 9s');
  await Promise.all([b.rep.alCerrar(aviso(t1, 100, t1 + 3000)), b.rep.alCerrar(aviso(t2, 200, t2 + 9000))]);
  eq(b.draws.length, 2);
}

// --- el enganche no bloquea y no hay barrido programado ---
{
  const col = fs.readFileSync(new URL('./colchon.mjs', import.meta.url), 'utf8');
  ok(col.includes('setImmediate(() => { Promise.resolve(h(aviso)).catch(() => {}); })'));
  ok(!col.includes('await h(aviso)') && !col.includes('await opts.onCierre'));
  const tl = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
  ok(tl.includes("attachReporte") && tl.includes('colchonHooks.onCierre'));
  ok(!/setInterval\([^)]*reporte/.test(tl));
  ok(tl.includes('alPrender') && tl.includes('alApagar') && tl.includes('antes !== out.on'));
  ok(tl.indexOf('alPrender') > tl.indexOf('attachReporte') + 400, 'el barrido no corre al arrancar');
  ok(!tl.slice(tl.indexOf('attachReporte'), tl.indexOf('attachReporte') + 500).includes('alPrender'));
  const page = PAGE + '\n' + READ_EXEC_JS(PAGE) + '\n' + READ_CHARTS_JS + '\n' + JS_ESCUCHA(PAGE);
  ok(!PROHIBIDO.test(page), 'las lecturas no envían órdenes');
  eq(expr && MODULO, 'tv-reporte');
  ok(rootOf('CME_MINI:MNQ1!') === 'MNQ' && rootOf('CME_MINI:NQ1!') === 'NQ' && rootOf('CME_MINI:MESZ2026') === 'MES');
  const execJs = READ_EXEC_JS('');
  ok(execJs.includes('CME_MINI:MNQZ2026') && execJs.includes('CME_MINI:NQZ2026'), 'el lector pide los contratos fechados, como brokerExecs');
  ok(execJs.includes('_activeChartWidgetWV'), 'el fallback de símbolo coincide con brokerExecs');
  ok(execJs.includes("return {error:'no-api'}"));

}

// --- día calendario de Nueva York, medianoche y horario de verano ---
{
  const mediodia = Date.parse('2026-11-25T17:00:00.000Z');
  eq(diaCalendarioNY(mediodia), '2026-11-25');
  const antes = Date.parse('2026-11-25T04:59:59.000Z');
  const justo = Date.parse('2026-11-25T05:00:00.000Z');
  const tarde = Date.parse('2026-11-26T04:59:59.000Z');
  const despues = Date.parse('2026-11-26T05:00:00.000Z');
  eq(diaCalendarioNY(antes), '2026-11-24');
  eq(diaCalendarioNY(justo), '2026-11-25');
  eq(diaCalendarioNY(tarde), '2026-11-25');
  eq(diaCalendarioNY(despues), '2026-11-26');
  const cincoYMedia = Date.parse('2026-11-25T22:30:00.000Z');
  eq(diaCalendarioNY(cincoYMedia), '2026-11-25');
  eq(diaFarm(cincoYMedia), '2026-11-26', 'las 17:30 son de hoy en el calendario y de mañana en la sesión');
  const nocheAnterior = Date.parse('2026-11-25T00:00:00.000Z');
  eq(diaCalendarioNY(nocheAnterior), '2026-11-24');
  eq(diaFarm(nocheAnterior), '2026-11-25', 'las 19:00 de ayer entran en la sesión de hoy, no en el día civil');
  eq(diaCalendarioNY(Date.parse('2026-03-08T04:59:59.000Z')), '2026-03-07');
  eq(diaCalendarioNY(Date.parse('2026-03-08T05:00:00.000Z')), '2026-03-08');
  eq(diaCalendarioNY(Date.parse('2026-03-08T06:59:59.000Z')), '2026-03-08');
  eq(diaCalendarioNY(Date.parse('2026-03-08T07:00:00.000Z')), '2026-03-08');
  eq(diaCalendarioNY(Date.parse('2026-03-09T03:59:59.000Z')), '2026-03-08');
  eq(diaCalendarioNY(Date.parse('2026-03-09T04:00:00.000Z')), '2026-03-09');
  eq(diaCalendarioNY(Date.parse('2026-11-01T03:59:59.000Z')), '2026-10-31');
  eq(diaCalendarioNY(Date.parse('2026-11-01T04:00:00.000Z')), '2026-11-01');
  eq(diaCalendarioNY(Date.parse('2026-11-01T05:30:00.000Z')), '2026-11-01');
  eq(diaCalendarioNY(Date.parse('2026-11-01T06:30:00.000Z')), '2026-11-01');
  eq(diaCalendarioNY(Date.parse('2026-11-02T04:59:59.000Z')), '2026-11-01');
  eq(diaCalendarioNY(Date.parse('2026-11-02T05:00:00.000Z')), '2026-11-02');
  const marcas = [
    { exitMs: antes, symbol: 'a' }, { exitMs: justo, symbol: 'b' }, { exitMs: tarde, symbol: 'c' },
    { exitMs: despues, symbol: 'd' }, { exitMs: cincoYMedia, symbol: 'e' }, { exitMs: nocheAnterior, symbol: 'f' },
  ];
  eq(cierresDelDia(marcas, mediodia).map(t => t.symbol), ['b', 'c', 'e']);
}

// --- no se cortan los fills antes de emparejar; sí se filtra por la hora de salida ---
{
  const ahora = Date.parse('2026-11-25T17:00:00.000Z');
  const entry = Date.parse('2026-11-25T04:30:00.000Z');
  const exit = Date.parse('2026-11-25T05:10:00.000Z');
  const ambos = [fill('e', 1, 1, 100, entry), fill('x', -1, 1, 101, exit)];
  const soloSalida = ambos.filter(f => diaCalendarioNY(f.time) === '2026-11-25');
  eq(cierresDeFills(soloSalida).length, 0, 'cortar los fills antes de emparejar pierde la entrada de ayer');
  const delDia = cierresDelDia(cierresDeFills(ambos, { cuenta: CUENTA, accountId: '99' }), ahora);
  eq(delDia.length, 1);
  eq(delDia[0].entry, 100);
  const ev = { type: 'fin_trade', side: 'long', symbol: 'MNQ', entrada: 100, cuenta: CUENTA, accountId: '99', tamano: '1 MNQ', direccion: 'COMPRA', abiertaEn: new Date(entry).toISOString(), cerradaEn: new Date(exit).toISOString(), slVisto: 90, tpVisto: 110 };
  eq(cruzarFinTrade(delDia[0], [ev]).slVisto, 90);
  eq(cruzarFinTrade(delDia[0], []), null);
  const b = banco(tmp(), { ex: ambos, now: () => ahora, leerEventos: () => [ev] });
  eq(b.reads.length, 0, 'crear el reporte no barre el día');
  const r = await b.rep.alPrender();
  eq(r.status, 'listo');
  eq(r.dibujados, 1);
  eq(b.draws[0].plan.position.stopLevel, 40);
  eq(b.draws[0].plan.position.profitLevel, 40);
  const idsDibujados = r.resultados[0].ids.map(String);
  const otra = await b.rep.alPrender();
  eq(otra.resultados[0].status, 'ya');
  eq(b.draws.length, 1, 'un cierre ya dibujado no se repite');
  const off = await b.rep.alApagar();
  eq(off.status, 'quitado');
  eq(off.n, 1);
  eq(b.quits[0].grupo, GRUPO);
  eq(b.quits[0].ids, idsDibujados);
  eq(Object.values(b.rep.estado().handled)[0].status, 'quitado');
  await b.rep.alPrender();
  eq(b.draws.length, 2, 'al volver a Sí se dibuja otra vez');
}

// --- sin TradingView no se marca; el símbolo abierto se salta; la cola no se pisa ---
{
  const ahora = Date.parse('2026-11-25T17:00:00.000Z');
  const entry = Date.parse('2026-11-25T15:00:00.000Z');
  const exit = entry + 4000;
  const ambos = [fill('e', 1, 1, 100, entry), fill('x', -1, 1, 101, exit)];
  const caido = banco(tmp(), { ex: ambos, now: () => ahora });
  caido.state.failRead = 1;
  const malo = await caido.rep.alPrender();
  eq(malo.razon, 'TradingView no disponible');
  eq(Object.keys(caido.rep.estado().handled).length, 0, 'sin conexión no queda marcado como dibujado');
  const nqE = entry + 60000, nqX = nqE + 5000;
  const ex = ambos.concat([
    fill('ne', -1, 1, 200, nqE, 'CME_MINI:NQZ2026'),
    fill('nx', 1, 1, 190, nqX, 'CME_MINI:NQZ2026'),
  ]);
  const b = banco(tmp(), { ex, now: () => ahora, raizOcupada: () => 'MNQ', charts: [{ index: 0, symbol: 'CME_MINI:NQ1!', active: true }] });
  const r = await b.rep.alPrender();
  eq(b.draws.length, 1);
  eq(b.draws[0].plan.root, 'NQ');
  ok(r.resultados.some(x => x.status === 'ocupado' && x.root === 'MNQ'));
  ok(Object.values(b.rep.estado().handled).every(h => h.root !== 'MNQ'));
  b.state.quitarThrow = 1;
  const noQuita = await b.rep.alApagar();
  eq(noQuita.razon, 'TradingView no disponible');
  eq(Object.values(b.rep.estado().handled)[0].status, 'dibujado', 'si no se pudo quitar, sigue marcado');
  eq(idsAQuitar(['1', '2'], [{ id: '9', title: 'mi linea' }, { id: '3', title: 'reporte' }, { id: '4', grupo: 'reporte' }, { id: '1', title: 'otra' }]), ['1', '2', '3', '4']);
  const jsQ = expresionQuitar(['a', 'b']);
  ok(jsQ.includes('removeEntity') && jsQ.includes('getAllShapes') && jsQ.includes('shapesGroupController'));
  ok(!jsQ.includes('removeAllShapes') && !PROHIBIDO.test(jsQ));
  ok(jsQ.includes('if(!id)') && jsQ.includes('saveChartToServer'));
  const dirEv = tmp();
  fs.writeFileSync(path.join(dirEv, 'colchon-eventos.jsonl'), JSON.stringify({ type: 'fin_trade', entrada: 1 }) + '\n' + '{mal\n' + JSON.stringify({ type: 'otra' }) + '\n');
  eq(leerFinTrades(dirEv).length, 1);
  let cur = 0, max = 0;
  const rep = createReporte({
    dir: tmp(), now: () => ahora, sleep: () => Promise.resolve(), log() {},
    readExec: async () => { cur++; max = Math.max(max, cur); await new Promise(r => setTimeout(r, 20)); cur--; return { cuenta: CUENTA, accountId: '99', ex: ambos }; },
    readCharts: async () => [{ index: 0, symbol: 'CME_MINI:MNQ1!', active: true }],
    draw: async () => ({ ok: true, ids: [`q${max}`], save: null }),
    quitar: async () => ({ ok: true, removed: [], via: null }),
  });
  await Promise.all([rep.alPrender(), rep.alPrender()]);
  eq(max, 1, 'dos barridos no leen fills a la vez');
  const orden = [];
  let soltar;
  const gate = new Promise(r => { soltar = r; });
  let on = true;
  const cola = banco(tmp(), { ex: ambos, now: () => ahora, orden, activo: () => on });
  cola.state.readGate = gate;
  const pPrende = cola.rep.alPrender();
  await new Promise(r => setImmediate(r));
  const pApaga = cola.rep.alApagar();
  await new Promise(r => setImmediate(r));
  eq(orden.includes('quitar'), false, 'apagar espera a que termine el barrido en curso');
  eq(orden[0], 'leer');
  on = false;
  soltar();
  const corto = await pPrende;
  await pApaga;
  eq(corto.status, 'apagado');
  eq(cola.draws.length, 0, 'si se apaga mientras lee, no dibuja');
  eq(orden.includes('quitar'), true);
}

console.log(`tv-reporte: ${pass} comprobaciones`);
