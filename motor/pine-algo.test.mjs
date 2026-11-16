import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
  ALGO_NOMBRE, ALGO_VERSION, FUENTE_PINE, PINE_DIR, crearAlgoTv, esElAlgo, estudiosAlgo, exprAlgo, exprMirar, exprOjos, formasEstudio, insertarEstudio, leerFuente, mismoEstudioId, planAlgo, textoAlgo, textoMotivo,
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
const idCamp = 'script$user;4637f0d246f54b92a991cbfa83a7f992';
const idSms = 'script$user;c372e364a273408e83cec7ca380539ca';
assert.equal(formasEstudio(idCamp)[0], 'USER;4637f0d246f54b92a991cbfa83a7f992');
assert.equal(formasEstudio(idSms)[0], 'USER;c372e364a273408e83cec7ca380539ca');
assert.equal(mismoEstudioId(idCamp, 'USER;4637f0d246f54b92a991cbfa83a7f992'), true);
assert.equal(mismoEstudioId('PUB;abc', 'script$pub;abc'), true);
assert.equal(mismoEstudioId('STD;abc', 'Script$STD;abc'), true);
assert.equal(formasEstudio('script$future;abc123')[0], 'FUTURE;abc123');
function grafico35() {
  const llamadas = [];
  const chart = {
    _chartWidget: {
      model() {
        return {
          createStudyInserter(desc) {
            llamadas.push(desc);
            return {
              async insert(fn) {
                await fn({ inputs: {} });
                if (desc.type !== 'pine' || desc.pineVersion !== 'last' || desc.pineId !== 'USER;4637f0d246f54b92a991cbfa83a7f992') {
                  throw new Error('bad descriptor ' + JSON.stringify(desc));
                }
                return { id: () => 'd9IHvG' };
              },
            };
          },
        };
      },
    },
    async createStudy(e) {
      llamadas.push(e);
      if (typeof e !== 'string') throw new Error('Failed to create study');
      if (String(e).toLowerCase() === 'bollinger bands') return 'bb-id';
      throw new Error('unexpected study id:' + e);
    },
  };
  return { chart, llamadas };
}
const metaJson = { id: 'Script$USER;4637f0d246f54b92a991cbfa83a7f992@tv-scripting-101', description: 'Ai Profit Camp Algo' };
const roto = grafico35();
await assert.rejects(() => roto.chart.createStudy(metaJson), /Failed to create study/);
await assert.rejects(() => roto.chart.createStudy('Ai Profit Camp Algo'), /unexpected study id/);
await assert.rejects(() => roto.chart.createStudy(idCamp), /unexpected study id/);
const bueno = grafico35();
assert.equal(await insertarEstudio(bueno.chart, idCamp, 'Ai Profit Camp Algo'), 'd9IHvG');
assert.deepEqual(bueno.llamadas[0], { type: 'pine', pineId: 'USER;4637f0d246f54b92a991cbfa83a7f992', pineVersion: 'last' });
assert.equal(bueno.llamadas.some(x => typeof x === 'string' || (x && x.description)), false);
assert.equal(await insertarEstudio(grafico35().chart, metaJson.id, 'Ai Profit Camp Algo'), 'd9IHvG');
const bandas = grafico35();
assert.equal(await insertarEstudio(bandas.chart, 'STD;BB', 'Bollinger Bands'), 'bb-id');
assert.match(textoMotivo('unexpected study id:' + idCamp), /Lo reintento/);
assert.match(textoMotivo('sin-broker'), /Lo reintento/);
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'instalado', version: '1' }), 'Algo TradingView: Ai Profit Camp Algo instalado v1');
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'pendiente' }), 'Algo TradingView: Ai Profit Camp Algo pendiente');
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'instalando' }), 'Algo TradingView: Ai Profit Camp Algo instalando');
assert.equal(textoAlgo({ nombre: 'Ai Profit Camp Algo', estado: 'error' }), 'Algo TradingView: Ai Profit Camp Algo error');

const expr = exprAlgo({ source: fuente, versionGuardada: '', studyIdGuardado: '' });
assert.match(expr, /getAllStudies/);
assert.match(expr, /Ai Profit Camp Algo/);
assert.match(expr, /pine-facade\/save\/new/);
assert.match(expr, /pine-facade\/save\/next/);
assert.doesNotMatch(expr, /placeOrder|modifyOrder|closePosition|editPositionBrackets|cancelOrder|setCurrentAccount|setSymbol|activeBroker|paper_trading|positions\(|activeOrders|sin-broker|sin-posiciones/);
assert.match(expr, /formasEstudio/);
assert.match(expr, /createStudyInserter/);
assert.match(expr, /type: 'pine'/);
assert.match(expr, /function pineIdDe/);
assert.doesNotMatch(expr, /insertStudy\(/);
assert.match(exprAlgo({ source: 'x', nombre: 'Smart Money Algo', anterior: 'Smart Money Structure' }), /Smart Money Structure/);
new vm.Script(expr);
const mira = exprMirar({ nombre: ALGO_NOMBRE, studyId: 's1' });
assert.match(mira, /"mirar":true/);
assert.doesNotMatch(mira, /pine-facade|createStudy|setVisible|placeOrder|activeBroker|setSymbol|setCurrentAccount/);
new vm.Script(mira);
const ojos = exprOjos({ accion: 'fijar', nombre: ALGO_NOMBRE, visible: false });
assert.match(ojos, /setVisible/);
assert.doesNotMatch(ojos, /placeOrder|closePosition|activeBroker|positions\(|activeOrders|setCurrentAccount|setSymbol/);
new vm.Script(ojos);
assert.match(exprOjos({ nombres: [ALGO_NOMBRE], accion: 'leer' }), /accion==='leer'/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-tv-'));
const vistos = [];
let algo;
algo = crearAlgoTv({
  dir,
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    vistos.push(codigo);
    if (codigo.includes('"mirar":true')) return { ok: true, mirar: true, enGrafico: 0, visible: null, studyId: '' };
    if (codigo.includes('"accion":"fijar"')) return { ok: true, visible: false, studyId: 's1' };
    assert.equal(algo.estado().fase, 'instalando');
    assert.equal(algo.estado().algos.some(a => a.estado === 'instalando'), true);
    return { ok: true, estado: 'instalado', version: '1', enGrafico: 1, visible: true, studyId: 's1', scriptId: 'USER;1', plan: 'instalar' };
  },
  log: () => {},
});
assert.match(algo.estado().texto, /Ai Profit Camp Algo pendiente/);
const hecho = await algo.intentar();
assert.match(hecho.texto, /Ai Profit Camp Algo instalado v1/);
assert.equal(hecho.fase, 'listos');
assert.match(hecho.texto, /Smart Money Algo instalado v1/);
assert.equal(hecho.algos.length, 2);
const estudios = vistos.filter(c => c.includes('pine-facade/save/new'));
assert.equal(estudios.length, 2);
assert.equal(estudios.filter(c => c.includes('"nombre":"Ai Profit Camp Algo"')).length, 1);
assert.equal(estudios.filter(c => c.includes('"nombre":"Smart Money Algo"')).length, 1);
assert.match(estudios.find(c => c.includes('Smart Money Algo')), /formasEstudio/);
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'algo-tv.json'), 'utf8')).algos['Ai Profit Camp Algo'].version, '1');
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'algo-tv.json'), 'utf8')).algos['Smart Money Algo'].version, '1');
const sms = leerFuente(path.join(PINE_DIR, 'smart-money-algo.pine'));
assert.match(sms, /indicator\("Smart Money Algo", "Smart Money Algo"/);
assert.doesNotMatch(sms, /indicator\("Smart Money Structure"/);
assert.match(sms, /\/\/@version=5/);
assert.doesNotMatch(sms, /Findi/);
assert.match(sms, /alertcondition\(eql_alert, 'Equal Lows', 'Equal lows detected'\)/);
const ojo = await algo.fijar('Ai Profit Camp Algo', false);
assert.equal(ojo.ok, true);
assert.equal(ojo.algos[0].visible, false);
assert.notEqual(ojo.fase, 'instalando');
assert.equal(vistos.some(c => c.includes('setVisible')), true);

const enTrade = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-trade-')),
  pineDir: PINE_DIR,
  evaluar: async (codigo) => codigo.includes('"mirar":true')
    ? { ok: true, mirar: true, enGrafico: 0, visible: null, studyId: '' }
    : { ok: true, estado: 'instalado', version: '1', enGrafico: 1, visible: false, studyId: 's9', scriptId: 'USER;9', plan: 'instalar' },
});
const durante = await enTrade.intentar();
assert.match(durante.texto, /Ai Profit Camp Algo instalado v1/);
assert.equal(durante.algos.find(a => a.nombre === 'Ai Profit Camp Algo').visible, false);

const caido = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-caido-')),
  pineDir: PINE_DIR,
  evaluar: async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:9222'); },
});
assert.match((await caido.intentar()).texto, /pendiente/);
assert.equal((await caido.intentar()).conectado, false);

let fallo;
fallo = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-fallo-')),
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    if (codigo.includes('"mirar":true')) return { ok: true, mirar: true, enGrafico: 0, visible: null, studyId: '' };
    assert.equal(fallo.estado().fase, 'instalando');
    return { ok: false, estado: 'error', motivo: 'guardar 401' };
  },
});
const mal = await fallo.intentar();
assert.match(mal.texto, /pendiente/);
assert.equal(mal.fase, null);
assert.equal(mal.algos.every(a => a.estado === 'pendiente'), true);

const dirYa = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-ya-'));
fs.writeFileSync(path.join(dirYa, 'algo-tv.json'), JSON.stringify({ algos: {
  'Ai Profit Camp Algo': { estado: 'instalado', version: '1', visible: true, studyId: 's1' },
  'Smart Money Algo': { estado: 'instalado', version: '1', visible: false, studyId: idSms },
} }));
const vistosYa = [];
const ya = crearAlgoTv({
  dir: dirYa,
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    vistosYa.push(codigo);
    if (!codigo.includes('"mirar":true')) throw new Error('no debía guardar');
    const oculto = codigo.includes('Smart Money Algo');
    return { ok: true, mirar: true, enGrafico: 1, visible: !oculto, studyId: oculto ? 's2' : 's1' };
  },
});
const quieto = await ya.intentar();
assert.equal(quieto.fase, null);
assert.equal(vistosYa.some(c => c.includes('pine-facade')), false);
assert.equal(quieto.algos.find(a => a.nombre === 'Smart Money Algo').visible, false);

const dirVisto = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-visto-'));
const vistosVisto = [];
const visto = crearAlgoTv({
  dir: dirVisto,
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    vistosVisto.push(codigo);
    if (codigo.includes('"mirar":true')) {
      const camp = codigo.includes('Ai Profit Camp Algo');
      return { ok: true, mirar: true, enGrafico: camp ? 1 : 0, visible: camp ? true : null, studyId: camp ? 'd9IHvG' : '', viejos: 0 };
    }
    assert.match(codigo, /Smart Money Algo/);
    assert.doesNotMatch(codigo, /"nombre":"Ai Profit Camp Algo"/);
    return { ok: true, estado: 'instalado', visible: true, studyId: idSms, scriptId: idSms, plan: 'instalar' };
  },
});
const vistoHecho = await visto.intentar();
assert.equal(vistoHecho.algos.find(a => a.nombre === 'Ai Profit Camp Algo').estado, 'instalado');
assert.equal(JSON.parse(fs.readFileSync(path.join(dirVisto, 'algo-tv.json'), 'utf8')).algos['Ai Profit Camp Algo'].studyId, 'd9IHvG');
assert.equal(vistosVisto.filter(c => c.includes('createStudyInserter') && c.includes('"nombre":"Ai Profit Camp Algo"')).length, 0);

const migraDir = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-migra-'));
fs.writeFileSync(path.join(migraDir, 'algo-tv.json'), JSON.stringify({ algos: {
  'Ai Profit Camp Algo': { estado: 'instalado', version: '1', visible: true, studyId: idCamp },
} }));
let migra;
const vistosMigra = [];
migra = crearAlgoTv({
  dir: migraDir,
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    vistosMigra.push(codigo);
    if (codigo.includes('"mirar":true')) {
      if (codigo.includes('Smart Money Algo')) return { ok: true, mirar: true, enGrafico: 0, visible: null, studyId: '', viejos: 1, visibleViejo: false };
      return { ok: true, mirar: true, enGrafico: 1, visible: true, studyId: idCamp, viejos: 0, visibleViejo: null };
    }
    assert.equal(migra.estado().fase, 'instalando');
    assert.match(codigo, /Smart Money Structure/);
    assert.match(codigo, /USER;c372e364a273408e83cec7ca380539ca|formasEstudio/);
    return { ok: true, estado: 'instalado', visible: false, studyId: idSms, scriptId: idSms, plan: 'migrar' };
  },
});
const migrado = await migra.intentar();
assert.equal(migrado.fase, 'listos');
assert.equal(migrado.algos.find(a => a.nombre === 'Smart Money Algo').visible, false);
assert.equal(migrado.algos.every(a => a.estado === 'instalado'), true);

let rechazo;
rechazo = crearAlgoTv({
  dir: fs.mkdtempSync(path.join(os.tmpdir(), 'algo-id-')),
  pineDir: PINE_DIR,
  evaluar: async (codigo) => {
    if (codigo.includes('"mirar":true')) return { ok: true, mirar: true, enGrafico: 0, visible: null, studyId: '', viejos: 0 };
    assert.equal(rechazo.estado().fase, 'instalando');
    return { ok: false, estado: 'error', motivo: 'unexpected study id:' + idCamp };
  },
});
const malId = await rechazo.intentar();
assert.equal(malId.fase, null);
assert.match(malId.texto, /pendiente/);
assert.match(malId.texto, /no aceptó el id del estudio/);
assert.match(malId.algos[0].motivo, /unexpected study id:script\$user;4637f0d246f54b92a991cbfa83a7f992/);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(html, /window\.__tlDia=_pd;const Wo=/);
assert.match(html, /id="tlAlgosBtn"/);
assert.match(html, /id="tlAlgosPanel"/);
assert.match(html, /__tlCard/);
assert.match(html, /__tlTap/);
assert.match(html, /__tlToggle/);
assert.match(html, /\/api\/algo-tv/);
assert.match(html, /id="tlAlgoAviso"/);
assert.match(html, /class="cola"/);
assert.match(html, /anclarAviso/);
assert.ok(html.indexOf('id="tlAlgosBtn"') < html.indexOf('id="tlAlgoAviso"'));
assert.match(html, /Instalando los algoritmos en tu TradingView\. Tarda de 1 a 2 minutos\. Es normal que veas moverse el gráfico y el editor de Pine\./);
assert.match(html, /Algoritmos listos/);
assert.match(html, /j\.fase === 'instalando'/);
assert.match(server, /q\.method === 'POST'/);
assert.match(server, /algoTv\.fijar/);
assert.match(server, /algoTv\.sincronizar/);
assert.doesNotMatch(server.slice(server.indexOf('crearAlgoTv(')), /ocupado:/);
assert.doesNotMatch(fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8'), /pine-algo|Ai Profit Camp Algo/);

console.log('pine-algo ok');
