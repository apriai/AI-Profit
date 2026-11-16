import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
  ALGO_NOMBRE, ALGO_VERSION, FUENTE_PINE, PINE_DIR, crearAlgoTv, esElAlgo, estudiosAlgo, exprAlgo, exprOjos, leerFuente, planAlgo, textoAlgo,
} from './pine-algo.mjs';

const fuente = leerFuente(FUENTE_PINE);
assert.match(fuente, /indicator\("Ai Profit Camp Algo", overlay = true\)/);
assert.match(fuente, /maxCloseW = input\.float\(12\.0, "Mecha Max Cierre %"\)/);
assert.match(fuente, /low - 2 \* syminfo\.mintick/);
assert.match(fuente, /high \+ 2 \* syminfo\.mintick/);
assert.match(fuente, /linewidth = 6/);
assert.equal(ALGO_NOMBRE, 'Ai Profit Camp Algo');
assert.equal(ALGO_VERSION, '1');
assert.equal(esElAlgo('ai profit camp algo'), true);
assert.equal(esElAlgo('  AI PROFIT CAMP ALGO '), true);
assert.equal(esElAlgo('Envolvente M1 Final'), false);
assert.equal(estudiosAlgo([{ name: 'AI PROFIT CAMP ALGO' }, { name: 'VWAP' }]).length, 1);

assert.equal(planAlgo({ enGrafico: 1, versionGuardada: '1' }), 'nada');
assert.equal(planAlgo({ enGrafico: 1, versionGuardada: '' }), 'actualizar');
assert.equal(planAlgo({ enGrafico: 0, versionGuardada: '1' }), 'instalar');
assert.equal(planAlgo({ enGrafico: 2, versionGuardada: '1' }), 'deduplicar');
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'instalado', version: '1' }), 'Algo TradingView: Ai Profit Camp Algo instalado v1');
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'pendiente' }), 'Algo TradingView: Ai Profit Camp Algo pendiente');
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'error' }), 'Algo TradingView: Ai Profit Camp Algo error');

const expr = exprAlgo({ source: fuente, versionGuardada: '', studyIdGuardado: '' });
assert.match(expr, /getAllStudies/);
assert.match(expr, /Ai Profit Camp Algo/);
assert.match(expr, /pine-facade\/save\/new/);
assert.match(expr, /pine-facade\/save\/next/);
assert.doesNotMatch(expr, /placeOrder|modifyOrder|closePosition|editPositionBrackets|cancelOrder|setVisible/);
new vm.Script(expr);
const ojos = exprOjos({ accion: 'fijar', nombre: ALGO_NOMBRE, visible: false });
assert.match(ojos, /setVisible/);
assert.doesNotMatch(ojos, /placeOrder|closePosition/);
new vm.Script(ojos);
assert.match(exprOjos({ nombres: [ALGO_NOMBRE], accion: 'leer' }), /accion==='leer'/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-tv-'));
const vistos = [];
const algo = crearAlgoTv({
  dir,
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    vistos.push(codigo);
    if (codigo.includes('setVisible')) return { ok: true, visible: false, studyId: 's1' };
    return { ok: true, estado: 'instalado', version: '1', enGrafico: 1, visible: true, studyId: 's1', scriptId: 'USER;1', plan: 'instalar' };
  },
  ocupado: () => false,
  log: () => {},
});
assert.match(algo.estado().texto, /Ai Profit Camp Algo pendiente/);
const hecho = await algo.intentar();
assert.match(hecho.texto, /Ai Profit Camp Algo instalado v1/);
assert.match(hecho.texto, /Smart Money Structure instalado v1/);
assert.equal(hecho.algos.length, 2);
const estudios = vistos.filter(c => c.includes('pine-facade/save/new'));
assert.equal(estudios.length, 2);
assert.equal(estudios.filter(c => c.includes('"nombre":"Ai Profit Camp Algo"')).length, 1);
assert.equal(estudios.filter(c => c.includes('"nombre":"Smart Money Structure"')).length, 1);
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'algo-tv.json'), 'utf8')).algos['Ai Profit Camp Algo'].version, '1');
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'algo-tv.json'), 'utf8')).algos['Smart Money Structure'].version, '1');
const sms = leerFuente(path.join(PINE_DIR, 'smart-money-structure.pine'));
assert.match(sms, /indicator\("Smart Money Structure", "Smart Money Structure"/);
assert.match(sms, /\/\/@version=5/);
assert.doesNotMatch(sms, /Findi/);
assert.match(sms, /alertcondition\(eql_alert, 'Equal Lows', 'Equal lows detected'\)/);
const ojo = await algo.fijar('Ai Profit Camp Algo', false);
assert.equal(ojo.ok, true);
assert.equal(ojo.algos[0].visible, false);
assert.equal(vistos.some(c => c.includes('setVisible')), true);

const ocupado = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-ocup-')),
  pineDir: PINE_DIR,
  evaluar: async () => { throw new Error('no debía evaluar'); },
  ocupado: () => true,
});
assert.match((await ocupado.intentar()).texto, /pendiente/);

const caido = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-caido-')),
  pineDir: PINE_DIR,
  evaluar: async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:9222'); },
  ocupado: () => false,
});
assert.match((await caido.intentar()).texto, /pendiente/);
assert.equal((await caido.intentar()).conectado, false);

const fallo = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-fallo-')),
  pineDir: PINE_DIR,
  evaluar: async () => ({ ok: false, estado: 'error', motivo: 'guardar 401' }),
  ocupado: () => false,
});
assert.match((await fallo.intentar()).texto, /error/);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(html, /window\.__tlDia=_pd;const Wo=/);
assert.match(html, /id="tlAlgosBtn"/);
assert.match(html, /id="tlAlgosPanel"/);
assert.match(html, /__tlCard/);
assert.match(html, /__tlTap/);
assert.match(html, /__tlToggle/);
assert.match(html, /\/api\/algo-tv/);
assert.match(server, /q\.method === 'POST'/);
assert.match(server, /algoTv\.fijar/);
assert.match(server, /algoTv\.sincronizar/);
assert.doesNotMatch(fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8'), /pine-algo|Ai Profit Camp Algo/);

console.log('pine-algo ok');
