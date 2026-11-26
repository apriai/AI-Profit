import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { instanteExpira } from './gex.mjs';
import {
  GEX_WALLS_NOMBRE, HORAS_ET, CABECERAS, URLS, gammaBS, gexDe, contratos0dte, nivelesEtf, zeroGamma, aNq,
  valoresInputs, turnoActual, diaDeMercado, expresionAplicar, crearGexWalls, lineaWalls,
  proximoVencimiento, R,
} from './gex-walls.mjs';

// Horario, fácil de cambiar.
assert.deepEqual(HORAS_ET, ['08:00', '09:30', '09:50', '11:00', '12:00']);
// Cabeceras de CBOE de la especificación.
assert.match(CABECERAS['User-Agent'], /Chrome\/130/);
assert.equal(CABECERAS.Referer, 'https://www.cboe.com/');
assert.equal(CABECERAS.Origin, 'https://www.cboe.com');
assert.match(URLS.QQQ, /options\/QQQ\.json$/);
assert.match(URLS.SPY, /options\/SPY\.json$/);

// Media sesión: el día después de Thanksgiving vence a la 1:00 PM ET (18:00 UTC). Un día normal, 4:00 PM.
assert.equal(new Date(instanteExpira(2026, 11, 27)).toISOString(), '2026-11-27T18:00:00.000Z');
assert.equal(new Date(instanteExpira(2026, 12, 24)).toISOString(), '2026-12-24T18:00:00.000Z');
assert.equal(new Date(instanteExpira(2026, 11, 30)).toISOString(), '2026-11-30T21:00:00.000Z');
assert.equal(diaDeMercado(Date.parse('2026-11-26T15:00:00Z')), false); // Thanksgiving
assert.equal(diaDeMercado(Date.parse('2026-11-28T15:00:00Z')), false); // sábado
assert.equal(diaDeMercado(Date.parse('2026-11-27T15:00:00Z')), true);
assert.equal(turnoActual(Date.parse('2026-11-27T12:59:00Z')), null); // 7:59 ET
assert.equal(turnoActual(Date.parse('2026-11-27T13:00:00Z')), '2026-11-27 08:00');
assert.equal(turnoActual(Date.parse('2026-11-27T14:35:00Z')), '2026-11-27 09:30');
assert.equal(turnoActual(Date.parse('2026-11-27T14:50:00Z')), '2026-11-27 09:50');
assert.equal(turnoActual(Date.parse('2026-11-27T16:10:00Z')), '2026-11-27 11:00');
assert.equal(turnoActual(Date.parse('2026-11-27T17:00:00Z')), '2026-11-27 12:00');
assert.equal(turnoActual(Date.parse('2026-11-26T17:00:00Z')), null);

// Black-Scholes de la especificación (r = 0.04).
const S = 100, K = 101, iv = 0.2, T = 30 / 525600, r = 0.04;
const d1 = (Math.log(S / K) + (r + iv * iv / 2) * T) / (iv * Math.sqrt(T));
const esperado = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI) / (S * iv * Math.sqrt(T));
assert.ok(Math.abs(gammaBS(S, K, iv, T) - esperado) < 1e-15);
assert.equal(gammaBS(S, K, 0, T), 0);
assert.equal(gexDe(0.05, 10, 100), 0.05 * 10 * 100 * 100 * 100 * 0.01);

// 9:50 ET del 27/11 (media sesión): T = 190 minutos ÷ 525,600.
const AHORA = Date.parse('2026-11-27T14:50:00Z');
const json = { data: { current_price: 100, options: [
  { option: 'QQQ261127C00105000', gamma: 0.08, open_interest: 1000, iv: 0.2 },
  { option: 'QQQ261127C00102000', gamma: 0.10, open_interest: 300, iv: 0.2 },
  { option: 'QQQ261127P00095000', gamma: 0.06, open_interest: 2000, iv: 0.25 },
  { option: 'QQQ261127P00098000', gamma: 0, open_interest: 400, iv: 0.22 }, // sin gamma de CBOE → BS
  { option: 'QQQ261127C00099000', gamma: 0.2, open_interest: 0, iv: 0.2 }, // OI 0 → fuera
  { option: 'QQQ261130C00100000', gamma: 9, open_interest: 99999, iv: 0.2 }, // no es 0DTE
] } };
const base = contratos0dte(json, AHORA);
assert.equal(base.contratos.length, 4);
assert.ok(base.contratos.every(c => Math.abs(c.T - 190 / 525600) < 1e-12));
const niv = nivelesEtf(json, AHORA);
assert.equal(niv.contratos, 4);
assert.equal(niv.call, 105); // 0.08×1000 > 0.10×300
assert.equal(niv.put, 95);
const gBS98 = gammaBS(100, 98, 0.22, 190 / 525600);
const put98 = gexDe(gBS98, 400, 100);
const put95 = gexDe(0.06, 2000, 100);
const call105 = gexDe(0.08, 1000, 100);
assert.equal(niv.top, [[105, call105], [95, put95], [98, put98], [102, gexDe(0.1, 300, 100)]].sort((a, b) => b[1] - a[1])[0][0]);
assert.ok(niv.zeroGamma === null || (niv.zeroGamma >= 95 && niv.zeroGamma <= 105));
// Sin 0DTE (Thanksgiving): nada. El vencimiento más próximo es el 27 (media sesión).
const THANKS = Date.parse('2026-11-26T15:00:00Z');
assert.equal(nivelesEtf(json, THANKS).contratos, 0);
assert.equal(proximoVencimiento(json, THANKS).clave, '2026-11-27');
assert.equal(nivelesEtf(json, THANKS, R, '2026-11-27').contratos, 4);
assert.equal(nivelesEtf(json, THANKS, R, '2026-11-27').call, 105);
// Después del vencimiento de media sesión (1:00 PM ET): nada de 0DTE; el próximo es el 30.
assert.equal(nivelesEtf(json, Date.parse('2026-11-27T18:01:00Z')).contratos, 0);
assert.equal(proximoVencimiento(json, Date.parse('2026-11-27T18:01:00Z')).clave, '2026-11-30');
assert.equal(proximoVencimiento(json, AHORA).clave, '2026-11-27');

// Zero Gamma: cruce interpolado más cercano al spot, rejilla ±5 % en 0.1 %.
const zgJson = { data: { current_price: 100, options: [
  { option: 'QQQ261127C00102000', gamma: 0.1, open_interest: 1000, iv: 0.2 },
  { option: 'QQQ261127P00098000', gamma: 0.1, open_interest: 1000, iv: 0.2 },
] } };
const zg = nivelesEtf(zgJson, AHORA).zeroGamma;
assert.ok(zg > 99.5 && zg < 100.5, `zero gamma simétrico cerca de 100: ${zg}`);
assert.equal(zeroGamma([{ tipo: 'C', strike: 100, oi: 10, iv: 0.2, T: 0.001 }], 100), null);

// NQ = ETF × (NQ ÷ ETF), a 0.25.
assert.equal(aNq(650, 26302, 636.86), Math.round(650 * 26302 / 636.86 * 4) / 4);
assert.equal(aNq(650, 26302, 636.86) % 0.25, 0);
assert.equal(aNq(0, 26302, 636.86), null);
assert.deepEqual(valoresInputs({ call: 650, put: 640, top: 640, zeroGamma: 643.6249 }, { call: 730, put: 700, top: 700, zeroGamma: null }),
  { qqqCall: 650, qqqPut: 640, qqqTop: 640, spyCall: 730, spyPut: 700, spyTop: 700, qqqZG: 643.62, spyZG: 0 });

// La expresión solo toca los inputs del estudio.
const expr = expresionAplicar({ qqqCall: 650 });
new vm.Script(expr);
assert.match(expr, /setInputValues/);
assert.match(expr, /Live ratio/);
assert.match(expr, /Gex - Put\/Call Walls/);
assert.doesNotMatch(expr, /placeOrder|closePosition|activeBroker|setSymbol|createShape/);
// Solo quita el estudio propio, solo si pide reparar y solo si está dañado (sin sus inputs in_N).
assert.equal((expr.match(/removeEntity/g) || []).length, 2);
assert.match(expr, /if\(vistos===0 && danado\(actual\)\)\{\s*if\(J\.reparar && typeof c\.removeEntity==='function'\)\{ try\{ c\.removeEntity\(id\)/);
// Nunca vuelve a escribir la lista completa de getInputValues (incluye los inputs internos de Pine).
assert.doesNotMatch(expr, /setInputValues\(actual\)/);
assert.match(expr, /setInputValues\(cambios\)/);

// Motor: con el panel de operar abierto no baja ni aplica; corre al cerrarse.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-walls-'));
let reloj = Date.parse('2026-11-27T14:51:00Z');
let panel = true;
let bajadas = 0;
const aplicados = [];
const w = crearGexWalls({
  dir,
  ahora: () => reloj,
  bloqueado: () => panel,
  bajar: async (sym) => { bajadas++; return { json: sym === 'QQQ' ? json : zgJson, bytes: 10, ms: 7 }; },
  aplicar: async (v) => { aplicados.push(v); return { ok: true, cambio: true }; },
});
assert.equal((await w.correr()).saltado, 'panel');
assert.equal(bajadas, 0);
assert.equal(aplicados.length, 0);
panel = false;
const uno = await w.correr();
assert.equal(uno.ok, true);
assert.equal(bajadas, 2);
assert.equal(aplicados.length, 1);
assert.equal(aplicados[0].qqqCall, 105);
assert.equal(w.estado().turno, '2026-11-27 09:50');
const log = fs.readFileSync(path.join(dir, 'gex.log'), 'utf8');
assert.match(log, /walls 2026-11-27 09:50 descarga QQQ 7 ms · SPY 7 ms · cálculo \d+ ms \(zero γ \d+ ms\) · aplicar \d+ ms · total \d+ ms/);
// Mismo turno: no vuelve a bajar.
assert.equal((await w.correr()).nada, true);
assert.equal(bajadas, 2);
// 11:00 con un trade abierto: espera; al cerrarse corre.
reloj = Date.parse('2026-11-27T16:00:30Z');
panel = true;
assert.equal((await w.correr()).saltado, 'panel');
assert.equal(bajadas, 2);
panel = false;
assert.equal((await w.correr()).ok, true);
assert.equal(bajadas, 4);
assert.equal(w.estado().turno, '2026-11-27 11:00');
// Feriado sin niveles guardados: se calculan los del vencimiento más próximo y se guardan.
const dirFer = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-fer-nuevo-'));
const aplicadosFer = [];
let bajoFer = 0;
const ferNuevo = crearGexWalls({
  dir: dirFer,
  ahora: () => Date.parse('2026-11-26T15:00:00Z'),
  bajar: async (sym) => { bajoFer++; return { json: sym === 'QQQ' ? json : zgJson, bytes: 10, ms: 7 }; },
  aplicar: async (v) => { aplicadosFer.push(v); return { ok: true, cambio: true }; },
});
const rFer = await ferNuevo.correr();
assert.equal(rFer.ok, true);
assert.equal(bajoFer, 2);
assert.equal(aplicadosFer.length, 1);
assert.equal(aplicadosFer[0].qqqCall, 105);
assert.match(fs.readFileSync(path.join(dirFer, 'gex.log'), 'utf8'), /ultimo dato \(vencimiento 2026-11-27\)/);
assert.ok(fs.existsSync(path.join(dirFer, 'gex-niveles.json')));
assert.equal(ferNuevo.estado().turno, 'arranque');
assert.equal((await ferNuevo.correr()).nada, true, 'ya aplicado: no vuelve a bajar en el feriado');
assert.equal(bajoFer, 2);
// Lo último calculado se guarda y, tras un reinicio en feriado, se vuelve a poner en el estudio sin bajar nada.
assert.ok(fs.existsSync(path.join(dir, 'gex-niveles.json')));
const reaplicados = [];
let bajo = 0;
const reinicio = crearGexWalls({
  dir, ahora: () => Date.parse('2026-11-26T15:00:00Z'),
  bajar: async () => { bajo++; throw new Error('no'); },
  aplicar: async (v) => { reaplicados.push(v); return { ok: true, cambio: true }; },
});
assert.equal((await reinicio.correr()).ok, true);
assert.equal(bajo, 0);
assert.equal(reaplicados.length, 1);
assert.equal(reaplicados[0].qqqCall, 105);
assert.equal(reinicio.estado().turno, '2026-11-27 11:00');
assert.equal((await reinicio.correr()).nada, true, 'ya aplicado: no vuelve a escribir');
// Archivo roto o incompleto: se ignora y se calcula el vencimiento próximo (sin pegarle a CBOE de verdad).
const dirLimpio = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-fer-'));
fs.writeFileSync(path.join(dirLimpio, 'gex-niveles.json'), '{"turno":"x","valores":{"qqqCall":1}}');
const aplicadosRoto = [];
let bajoRoto = 0;
const roto = crearGexWalls({
  dir: dirLimpio,
  ahora: () => Date.parse('2026-11-26T15:00:00Z'),
  bajar: async (sym) => { bajoRoto++; return { json: sym === 'QQQ' ? json : zgJson, bytes: 10, ms: 7 }; },
  aplicar: async (v) => { aplicadosRoto.push(v); return { ok: true, cambio: true }; },
});
assert.equal((await roto.correr()).ok, true);
assert.equal(bajoRoto, 2);
assert.equal(aplicadosRoto[0].qqqCall, 105);
assert.match(fs.readFileSync(path.join(dirLimpio, 'gex.log'), 'utf8'), /ultimo dato \(vencimiento 2026-11-27\)/);

// En un día de mercado el horario normal sustituye el «ultimo dato» por los 0DTE del día.
{
  const dirR = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-reemplazo-'));
  let relojR = Date.parse('2026-11-26T15:00:00Z');
  const aplicadosR = [];
  const wr = crearGexWalls({
    dir: dirR,
    ahora: () => relojR,
    bajar: async (sym) => ({ json: sym === 'QQQ' ? json : zgJson, bytes: 10, ms: 7 }),
    aplicar: async (v) => { aplicadosR.push({ t: relojR, v }); return { ok: true, cambio: true }; },
  });
  assert.equal((await wr.correr()).ok, true);
  assert.match(fs.readFileSync(path.join(dirR, 'gex.log'), 'utf8'), /ultimo dato \(vencimiento 2026-11-27\)/);
  assert.equal(wr.estado().turno, 'arranque');
  relojR = Date.parse('2026-11-27T14:51:00Z');
  assert.equal((await wr.correr()).ok, true);
  assert.equal(wr.estado().turno, '2026-11-27 09:50');
  const lineas = fs.readFileSync(path.join(dirR, 'gex.log'), 'utf8').trim().split('\n');
  assert.match(lineas[lineas.length - 1], /walls 2026-11-27 09:50/);
  assert.doesNotMatch(lineas[lineas.length - 1], /ultimo dato/);
  assert.equal(aplicadosR[1].v.qqqCall, 105);
}

// Estudio dañado: se pide quitarlo una sola vez por sesión; después de quitarlo se avisa para reinstalar y se reintenta pasado el plazo.
{
  const dirD = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-danado-'));
  let relojD = Date.parse('2026-11-27T14:51:00Z');
  const pedidos = [];
  let avisos = 0;
  let estadoEstudio = 'danado';
  const wd = crearGexWalls({
    dir: dirD,
    ahora: () => relojD,
    alQuitar: () => { avisos++; },
    bajar: async (sym) => ({ json: sym === 'QQQ' ? json : zgJson, bytes: 10, ms: 7 }),
    aplicar: async (v, op) => {
      pedidos.push(op && op.reparar);
      if (estadoEstudio === 'danado') { estadoEstudio = 'quitado'; return { ok: false, motivo: 'estudio dañado: lo quité para reinstalarlo', quitado: true }; }
      if (estadoEstudio === 'quitado') return { ok: false, motivo: 'no está en el gráfico' };
      return { ok: true, cambio: true };
    },
  });
  assert.ok((await wd.correr()).error);
  assert.equal(avisos, 1);
  assert.deepEqual(pedidos, [true]);
  relojD += 150000;
  assert.ok((await wd.correr()).error); // aún no reinstalado
  assert.deepEqual(pedidos, [true, false], 'después de quitar una vez, ya no pide quitar');
  estadoEstudio = 'sano';
  relojD += 150000;
  assert.equal((await wd.correr()).ok, true);
  assert.equal(avisos, 1);
}
// Error de CBOE: se anota y espera antes de reintentar.
let rota = 0;
const err = crearGexWalls({ dir, ahora: () => reloj, bajar: async () => { rota++; throw new Error('QQQ HTTP 403'); } });
assert.match((await err.correr()).linea, /error: QQQ HTTP 403/);
assert.equal((await err.correr()).espera, true);
assert.equal(rota, 2); // QQQ y SPY en la primera vuelta, nada en la segunda
assert.match(lineaWalls({ at: 't', turno: 'x', error: 'e' }), /t walls x error: e/);


// Si aplicar falla, no reescribe el estudio en cada vuelta de 15 s: espera y reintenta pasado el plazo.
{
  let ahoraMs = Date.parse('2026-11-27T14:51:00Z');
  let intentos = 0;
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-walls-fallo-'));
  const f = crearGexWalls({
    dir: d2,
    ahora: () => ahoraMs,
    bajar: async (sym) => ({ json: sym === 'QQQ' ? json : zgJson, bytes: 10, ms: 7 }),
    aplicar: async () => { intentos++; return { ok: false, motivo: 'no se confirmaron los inputs' }; },
  });
  assert.ok((await f.correr()).error);
  assert.equal(intentos, 1);
  for (let i = 0; i < 6; i++) { ahoraMs += 15000; assert.equal((await f.correr()).espera, true); }
  assert.equal(intentos, 1, 'en 90 s no vuelve a escribir');
  ahoraMs += 60000;
  await f.correr();
  assert.equal(intentos, 2, 'pasados 2 min reintenta una vez');
}
// El código del aplicar compara con tolerancia y devuelve el ojo a como estaba.
assert.match(expresionAplicar({ qqqCall: 650 }), /Math\.abs\(x-y\)<=0\.005/);
assert.match(expresionAplicar({ qqqCall: 650 }), /restaurado/);

// Manifiesto: «Gex - Put/Call Walls» va justo debajo de Profito Algoritmo.
const man = JSON.parse(fs.readFileSync(new URL('./pine/manifest.json', import.meta.url), 'utf8'));
assert.deepEqual(man.map(m => m.nombre), ['Profito Algoritmo', GEX_WALLS_NOMBRE, 'Session Levels (High/Lows)']);
const sess = fs.readFileSync(new URL('./pine/' + man[2].archivo, import.meta.url), 'utf8');
assert.match(sess, /indicator\("Session Levels \(High\/Lows\)"/);
assert.doesNotMatch(sess, /indicator\("NQ Session Levels/);
const pine = fs.readFileSync(new URL('./pine/' + man[1].archivo, import.meta.url), 'utf8');
assert.match(pine, /indicator\("Gex - Put\/Call Walls", shorttitle = "Gex - Put\/Call Walls"/);
assert.match(pine, /"Live ratio", "Mode"/);
assert.match(pine, /float fixedHW\s+= input\.float\(20\.0/);
assert.match(pine, /int\s+fillTr\s+= input\.int\(88/);
assert.match(pine, /line\.style_dotted, showSZG/);
assert.match(pine, /"NQ Zero γ"/);
const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(html, /if \(a\.estado === 'instalado'\) return 'Instalado';/);
assert.doesNotMatch(html, /'instalado v' \+/);
const preparar = fs.readFileSync(new URL('../instalador/preparar.mjs', import.meta.url), 'utf8');
assert.match(preparar, /'gex-walls\.mjs'/);
assert.match(preparar, /'pine\/gex-put-call-walls\.pine'/);
assert.match(preparar, /'pine\/session-levels\.pine'/);
assert.match(html, /#tlAlgosPanel \.bajar\{[^}]*width:auto/);
assert.match(html, /#tlAlgosPanel \.bajar\{[^}]*white-space:nowrap/);
assert.match(html, /#tlAlgosPanel \.bajar\{[^}]*font:600 10px/);
assert.doesNotMatch(html, /#tlAlgosPanel \.bajar\{[^}]*width:40%/);
assert.doesNotMatch(html, /#tlAlgosPanel \.bajar\{[^}]*(?<!max-)width:100%/);
const server = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(server, /crearGexWalls\(/);
assert.match(server, /panelHasta > Date\.now\(\) \|\| colchon\.status\(\)\.state === 'running'/);
assert.doesNotMatch(fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8'), /gex-walls/);

console.log('gex-walls ok');
