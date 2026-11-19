// La señal suena cada vez que el círculo aparece en la vela en curso, y no toca órdenes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { decidirToque, exprSenal, crearAlgoTv, ALGO_NOMBRE, PINE_DIR, barraEnMs, duracionMarcoMs } from './pine-algo.mjs';

assert.equal(duracionMarcoMs('5'), 5 * 60 * 1000);
assert.equal(duracionMarcoMs('30S'), 30 * 1000);
assert.equal(duracionMarcoMs('1H'), 3600000);
assert.equal(duracionMarcoMs('1D'), 86400000);
assert.equal(duracionMarcoMs('W'), 7 * 86400000);
assert.equal(duracionMarcoMs('M'), 30 * 86400000);
assert.equal(duracionMarcoMs('raro'), null);

const est = { barra: null, alcista: false, bajista: false };
const barra = 1700000000;
const dentro = b => barraEnMs(b) + 5000;
const en = (extra = {}) => {
  const b = extra.barra != null ? extra.barra : barra;
  const ahora = extra.ahora != null ? extra.ahora : dentro(b);
  return { ok: true, visible: true, enGrafico: 1, alcista: false, bajista: false, resolucion: '1', simbolo: 'MNQ1!', ...extra, barra: b, ahora };
};
assert.equal(decidirToque(est, en({ alcista: true })).tocar, false, 'la primera lectura solo reanuda');
assert.equal(est.alcista, true);
assert.equal(decidirToque(est, en({ alcista: true })).tocar, false, 'si el círculo sigue, no se repite');
assert.equal(decidirToque(est, en()).tocar, false, 'si se apaga no suena');
assert.equal(decidirToque(est, en({ alcista: true })).tocar, true, 'si vuelve en la misma vela, suena otra vez');
assert.equal(decidirToque(est, en({ alcista: true })).tocar, false);
assert.equal(decidirToque(est, en()).tocar, false);
assert.equal(decidirToque(est, en({ alcista: true })).tocar, true, 'otro apagado y encendido en la misma vela también suena');
assert.equal(decidirToque(est, en({ bajista: true })).lado, 'bajista', 'el otro círculo, al aparecer, también suena');
assert.equal(decidirToque(est, en({ barra: barra + 60, alcista: true })).tocar, true, 'la vela siguiente empieza de cero');
assert.equal(decidirToque(est, { ok: true, visible: false, enGrafico: 1, barra: barra + 120, alcista: true }).tocar, false, 'oculto no suena');
assert.equal(decidirToque(est, { ok: true, visible: true, enGrafico: 0, barra: barra + 120, alcista: true }).tocar, false, 'sin estudio no suena');
assert.equal(decidirToque(est, { ok: false, visible: true, enGrafico: 1, barra: barra + 180, alcista: true }).tocar, false, 'un fallo del gráfico no suena');
assert.equal(decidirToque(est, en({ barra: barra + 60, alcista: true })).tocar, false, 'el fallo no cuenta como que el círculo se apagó');
assert.equal(decidirToque(est, en({ barra, resolucion: '5', simbolo: 'MNQ1!', alcista: true })).tocar, false, 'cambiar de marco con el círculo ya encendido no suena');
assert.equal(decidirToque(est, en({ barra: barra - 120, resolucion: '5', simbolo: 'MNQ1!', alcista: true, ahora: dentro(barra) })).tocar, false, 'una barra más vieja no suena');
assert.equal(est.alcista, false, 'la vela pasada no deja el círculo marcado');
assert.equal(est.barra, null, 'la vela pasada no se queda como la vela actual');
{
  const viva5 = barra + 300, a5 = dentro(viva5);
  assert.equal(decidirToque(est, en({ barra: viva5, resolucion: '5', simbolo: 'MNQ1!', alcista: true, ahora: a5 })).tocar, false, 'tras el cambio, la primera lectura estable no suena todavía');
  assert.equal(decidirToque(est, en({ barra: viva5, resolucion: '5', simbolo: 'MNQ1!', alcista: true, ahora: a5 + 1100 })).tocar, true, 'un segundo en la misma vela en vivo ya puede sonar');
}
assert.equal(decidirToque(new Set(), en({ alcista: true })).tocar, false, 'un estado que no es objeto no rompe');

// HERO 3:10:50 PM ET, marco de 5 min: 2:45 y 3:00 ya cerraron. La vela en vivo es la de 3:10.
{
  const b245 = 1795107900, b300 = 1795108800, b310 = 1795109400;
  const ahora = barraEnMs(b310) + 50 * 1000;
  const e = { barra: null, alcista: false, bajista: false };
  const lec = (b, extra) => ({ ok: true, visible: true, enGrafico: 1, simbolo: 'CME_MINI:MNQZ2026', resolucion: '5', barra: b, ahora, alcista: true, bajista: false, ...extra });
  assert.equal(decidirToque(e, { ...lec(b310, { resolucion: '1', alcista: false }) }).tocar, false);
  assert.equal(decidirToque(e, lec(b245)).tocar, false, 'reanudar en 2:45 no suena');
  assert.equal(decidirToque(e, lec(b300)).pasada, true, 'la vela de 3:00 ya está cerrada');
  assert.equal(decidirToque(e, lec(b300)).tocar, false);
  assert.equal(e.alcista, false, 'la vela pasada no bloquea la de las 3:10');
  const a310 = barraEnMs(b310) + 50 * 1000;
  assert.equal(decidirToque(e, lec(b310, { ahora: a310 })).tocar, false, 'la vela en vivo espera a quedarse quieta');
  assert.equal(decidirToque(e, lec(b310, { ahora: a310 + 1100 })).tocar, true, 'ya estable, el círculo encendido suena');
  assert.equal(decidirToque(e, lec(b310, { ahora: a310 + 1200, alcista: false })).tocar, false);
  assert.equal(decidirToque(e, lec(b310, { ahora: a310 + 1300 })).tocar, true, 'al volver a encenderse en la misma vela suena otra vez');
  assert.equal(decidirToque(e, lec(b310, { ahora: a310 + 1400, simbolo: 'CME_MINI:NQZ2026' })).tocar, false, 'cambiar de símbolo no suena');
}

function pagina(estudio, visible) {
  const study = estudio || {
    id: () => 's1',
    metaInfo: () => ({
      description: 'Profito Algoritmo',
      plots: [{ id: 'plot_0', type: 'line' }, { id: 'plot_1', type: 'line' }, { id: 'plot_2', type: 'bar_colorer' }],
      styles: { plot_0: { title: 'Alcista' }, plot_1: { title: 'Bajista' } },
    }),
    data: () => ({ bars: () => ({ last: () => ({ index: 4, value: [barra, 21000.25, NaN, 1] }) }) }),
    isVisible: () => visible !== false,
    properties: () => ({ visible: { value: () => visible !== false } }),
  };
  const chart = {
    getAllStudies: () => visible === 'fuera' ? [] : [{ id: 's1', name: 'Profito Algoritmo' }],
    getStudyById: () => ({ isVisible: () => visible !== false }),
    resolution: () => '1',
    symbol: () => 'CME_MINI:MNQ1!',
  };
  const ctx = {
    window: {
      TradingViewApi: {
        activeChart: () => chart,
        _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ model: () => ({ dataSources: () => visible === 'fuera' ? [] : [study] }) }) } }) },
      },
    },
  };
  vm.createContext(ctx);
  return vm.runInContext(exprSenal({ nombre: ALGO_NOMBRE }), ctx);
}

const viva = pagina(null, true);
assert.equal(viva.ok, true);
assert.equal(viva.visible, true);
assert.equal(viva.alcista, true);
assert.equal(viva.bajista, false);
assert.equal(viva.barra, barra);
assert.equal(viva.resolucion, '1');
assert.equal(viva.simbolo, 'CME_MINI:MNQ1!');
assert.equal(pagina(null, false).visible, false);
assert.equal(pagina(null, 'fuera').enGrafico, 0);
const roto = {
  id: () => 's1',
  metaInfo: () => { throw new Error('interno'); },
  data: () => { throw new Error('interno'); },
  isVisible: () => true,
};
assert.equal(pagina(roto, true).ok, true);
assert.equal(pagina(roto, true).alcista, false);

const expr = exprSenal();
for (const no of ['placeOrder', 'setCurrentAccount', 'activeBroker', 'orders(', '/order']) {
  assert.equal(expr.includes(no), false, 'la lectura no toca ' + no);
}
assert.match(expr, /alcista/);
assert.match(expr, /bajista/);
assert.match(expr, /getAllStudies/);
assert.match(expr, /getStudyById/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'senal-algo-'));
const lineas = [];
let n = 0;
const tLive = barraEnMs(barra) + 5000;
const base = { ok: true, visible: true, enGrafico: 1, resolucion: '1', simbolo: 'MNQ1!', ahora: tLive };
const tv = crearAlgoTv({
  dir,
  pineDir: PINE_DIR,
  log: (...a) => lineas.push(a.join(' ')),
  evaluar: async () => {
    n++;
    if (n === 1) return { ...base, barra, alcista: true, bajista: false };
    if (n === 2) return { ...base, barra, alcista: false, bajista: false };
    if (n === 3) return { ...base, barra, alcista: true, bajista: false };
    if (n === 4) return { ...base, barra, alcista: true, bajista: false };
    if (n === 5) return { ...base, barra: barra + 60, ahora: barraEnMs(barra + 60) + 5000, alcista: true, bajista: false };
    if (n === 6) throw new Error('chart interno');
    if (n === 7) return { ...base, resolucion: '5', barra: barra - 500, ahora: tLive, alcista: true, bajista: false };
    if (n === 8) return { ...base, resolucion: '5', barra: barra - 800, ahora: tLive, alcista: true, bajista: false };
    if (n === 9) return { ...base, resolucion: '5', barra: barra + 300, ahora: barraEnMs(barra + 300) + 5000, alcista: true, bajista: false };
    return { ...base, resolucion: '5', barra: barra + 300, ahora: barraEnMs(barra + 300) + 5000 + 1100, alcista: true, bajista: false };
  },
});
const uno = await tv.oirSenal();
assert.equal(uno.senal.seq, 0, 'la primera lectura no suena');
const dos = await tv.oirSenal();
assert.equal(dos.senal.seq, 0, 'apagarse no suma otro aviso');
const tres = await tv.oirSenal();
assert.equal(tres.senal.seq, 1, 'reaparecer en la misma vela suma otro aviso');
assert.equal(tres.senal.lado, 'alcista');
const cuatro = await tv.oirSenal();
assert.equal(cuatro.senal.seq, 1, 'seguir encendido no suma otro aviso');
const cinco = await tv.oirSenal();
assert.equal(cinco.senal.seq, 2, 'la vela nueva vuelve a sonar');
const seis = await tv.oirSenal();
assert.equal(seis.senal.seq, 2, 'un fallo no tira el motor ni suena');
const siete = await tv.oirSenal();
assert.equal(siete.senal.seq, 2, 'cambiar de marco con el círculo encendido en una barra vieja no suena');
const ocho = await tv.oirSenal();
assert.equal(ocho.senal.seq, 2, 'una barra anterior a la ya vista no suena');
const nueve = await tv.oirSenal();
assert.equal(nueve.senal.seq, 2, 'la primera lectura del marco nuevo, aunque sea la vela en vivo, espera');
const diez = await tv.oirSenal();
assert.equal(diez.senal.seq, 3, 'un segundo después, en la misma vela en vivo, suena');
assert.ok(lineas.some(l => l.includes('marco reanudado') && l.includes('1') && l.includes(String(barra))));
assert.ok(lineas.some(l => l.includes(`barra ${barra}`) && l.includes('1') && l.includes('alcista')));
assert.ok(lineas.some(l => l.includes(`barra ${barra + 60}`) && l.includes('alcista')));
assert.ok(lineas.some(l => l.includes('vela pasada ignorada')));
assert.equal(lineas.filter(l => l.includes('marco reanudado')).length, 2);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const motor = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(html, /function playSenalAlgo\(\)/);
assert.match(html, /window\.playSenalAlgo=playSenalAlgo/);
assert.match(html, /frequency\.setValueAtTime\(700/);
assert.match(html, /exponentialRampToValueAtTime\(1400, now\+0\.06\)/);
assert.match(html, /frequency\.setValueAtTime\(900, now\+0\.11\)/);
assert.match(html, /exponentialRampToValueAtTime\(1900, now\+0\.17\)/);
assert.match(html, /exponentialRampToValueAtTime\(1700, now\+0\.22\)/);
assert.match(html, /frequency\.setValueAtTime\(2600, now\+0\.15\)/);
assert.match(html, /exponentialRampToValueAtTime\(2626, now\+0\.27\)/);
assert.match(html, /tl_sonido_algo/);
assert.match(html, /id="tlSenalAlgo"/);
assert.match(html, /setInterval\(leer, 1500\)/);
const buy = html.indexOf('data-s=long');
assert.equal(html.slice(buy, buy + 400).includes('playSenalAlgo'), false, 'BUY no llama al sonido de la señal');
assert.match(motor, /setInterval\(oirSenal, 1500\)/);
assert.match(motor, /setInterval\(verOjos, 30000\)/);
assert.doesNotMatch(fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8'), /playSenalAlgo|oirSenal/);

console.log('senal-algo ok');
