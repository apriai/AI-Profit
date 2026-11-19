// La señal suena cada vez que el círculo aparece en la vela en curso, y no toca órdenes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { decidirToque, exprSenal, crearAlgoTv, ALGO_NOMBRE, PINE_DIR } from './pine-algo.mjs';

const est = { barra: null, alcista: false, bajista: false };
const barra = 1700000000;
const en = (extra) => ({ ok: true, visible: true, enGrafico: 1, barra, alcista: false, bajista: false, ...extra });
assert.equal(decidirToque(est, en({ alcista: true })).tocar, true);
assert.equal(decidirToque(est, en({ alcista: true })).tocar, false, 'si el círculo sigue, no se repite');
assert.equal(decidirToque(est, en()).tocar, false, 'si se apaga no suena');
assert.equal(decidirToque(est, en({ alcista: true })).tocar, true, 'si vuelve en la misma vela, suena otra vez');
assert.equal(decidirToque(est, en({ alcista: true })).tocar, false);
assert.equal(decidirToque(est, en({ bajista: true })).lado, 'bajista', 'el otro círculo, al aparecer, también suena');
assert.equal(decidirToque(est, en({ barra: barra + 60, alcista: true })).tocar, true, 'la vela siguiente empieza de cero');
assert.equal(decidirToque(est, { ok: true, visible: false, enGrafico: 1, barra: barra + 120, alcista: true }).tocar, false, 'oculto no suena');
assert.equal(decidirToque(est, { ok: true, visible: true, enGrafico: 0, barra: barra + 120, alcista: true }).tocar, false, 'sin estudio no suena');
assert.equal(decidirToque(est, { ok: false, visible: true, enGrafico: 1, barra: barra + 180, alcista: true }).tocar, false, 'un fallo del gráfico no suena');
assert.equal(decidirToque(est, en({ barra: barra + 60, alcista: true })).tocar, false, 'el fallo no cuenta como que el círculo se apagó');
assert.equal(decidirToque(new Set(), en({ alcista: true })).tocar, false, 'un estado que no es objeto no rompe');

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
let n = 0;
const tv = crearAlgoTv({
  dir,
  pineDir: PINE_DIR,
  evaluar: async () => {
    n++;
    if (n === 1) return { ok: true, visible: true, enGrafico: 1, barra, alcista: true, bajista: false };
    if (n === 2) return { ok: true, visible: true, enGrafico: 1, barra, alcista: false, bajista: false };
    if (n === 3) return { ok: true, visible: true, enGrafico: 1, barra, alcista: true, bajista: false };
    if (n === 4) return { ok: true, visible: true, enGrafico: 1, barra, alcista: true, bajista: false };
    if (n === 5) return { ok: true, visible: true, enGrafico: 1, barra: barra + 60, alcista: true, bajista: false };
    throw new Error('chart interno');
  },
});
const uno = await tv.oirSenal();
assert.equal(uno.senal.seq, 1);
assert.equal(uno.senal.lado, 'alcista');
const dos = await tv.oirSenal();
assert.equal(dos.senal.seq, 1, 'apagarse no suma otro aviso');
const tres = await tv.oirSenal();
assert.equal(tres.senal.seq, 2, 'reaparecer en la misma vela suma otro aviso');
const cuatro = await tv.oirSenal();
assert.equal(cuatro.senal.seq, 2, 'seguir encendido no suma otro aviso');
const cinco = await tv.oirSenal();
assert.equal(cinco.senal.seq, 3, 'la vela nueva vuelve a sonar');
const seis = await tv.oirSenal();
assert.equal(seis.senal.seq, 3, 'un fallo no tira el motor ni suena');

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
