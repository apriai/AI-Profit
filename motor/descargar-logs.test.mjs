import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { armarStatus, crearPaqueteLogs, esArchivoLog, listarLogs, redactar, rutaEnZip, TOPE_LOG } from './descargar-logs.mjs';

assert.equal(esArchivoLog('colchon.log'), true);
assert.equal(esArchivoLog('colchon.log.1'), true);
assert.equal(esArchivoLog('accounts.json'), false);
assert.equal(redactar('bearer abc.def', 'nota'), 'bearer [redactado]');
assert.equal(redactar({ token: 'secreto', dailyLoss: 600 }).token, '[redactado]');
assert.equal(redactar({ token: 'secreto', dailyLoss: 600 }).dailyLoss, 600);
assert.equal(redactar('{"apiKey":"k-SECRET"}'), '{"apiKey":"[redactado]"}');
assert.equal(redactar('"password": "x"'), '"password": "[redactado]"');
assert.equal(redactar('"token":"tok-9"'), '"token":"[redactado]"');
assert.equal(redactar('{"cookie":"c-SECRET","clave":"cl-SECRET"}'), '{"cookie":"[redactado]","clave":"[redactado]"}');
assert.equal(redactar('{"credential": "cred-SECRET", "authorization": "Bearer ab-SECRET"}'), '{"credential": "[redactado]", "authorization": "[redactado]"}');
assert.equal(redactar("{'secret': 's-SECRET'}"), "{'secret': \"[redactado]\"}");
assert.equal(redactar('api_key=k2-SECRET api-key: k3-SECRET'), 'api_key=[redactado] api-key: [redactado]');
assert.equal(TOPE_LOG, 5 * 1024 * 1024);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-logs-'));
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-desc-'));
fs.writeFileSync(path.join(dir, 'colchon.log'), 'hola\ntoken=super-secreto\n');
fs.writeFileSync(path.join(dir, 'colchon-latencia.log'), 'latencia 12\n');
fs.writeFileSync(path.join(dir, 'colchon.log.1'), 'rotado\n');
fs.writeFileSync(path.join(dir, 'accounts.json'), '{"password":"no-va"}');
fs.mkdirSync(path.join(dir, 'logs'));
fs.writeFileSync(path.join(dir, 'logs', 'servidor.log'), 'arranque\n{"apiKey":"k-SECRET"}\n"password": "pw-SECRET"\n"token":"tok-9"\n');
fs.writeFileSync(path.join(dir, 'logs', 'lanzador.log.1'), 'plain token=plano-secreto\n{"cookie":"c-SECRET","clave":"cl-SECRET"}\n');
fs.writeFileSync(path.join(dir, 'logs', 'carga.txt'), 'Encendiendo servidor…\n{"secret":"carga-SECRET"}\n');
fs.writeFileSync(path.join(dir, 'logs', 'servidor.pid'), '1234');
fs.writeFileSync(path.join(dir, 'logs', 'servidor.log.5'), 'CABEZA-SECRETA\n' + 'x'.repeat(200) + '{"token":"cola-SECRET"}');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-raiz-'));
fs.writeFileSync(path.join(root, 'tradinglink.log'), 'mac {"authorization":"Bearer ab-SECRET"}\n');
fs.writeFileSync(path.join(root, 'estrategias-propias.json'), '{"version":1,"strategies":[]}\n');
const anidados = listarLogs(dir).map(f => rutaEnZip(f, dir));
assert.ok(anidados.includes('logs/logs/servidor.log'));
assert.ok(anidados.includes('logs/logs/lanzador.log.1'));
assert.ok(anidados.includes('logs/logs/carga.txt'));
assert.ok(!anidados.some(n => n.endsWith('servidor.pid')));
assert.ok(!anidados.some(n => n.endsWith('accounts.json')));

const cuando = new Date(2026, 10, 25, 14, 7, 0);
const status = armarStatus({
  version: '0.10.57',
  ahora: cuando,
  conexion: { tradingview: true, tradovate: false, servidor: true },
  cuentas: { LFE00000000000026: { id: 'LFE00000000000026', type: 'eval', plan: '25K', balance: 25070, dayPnl: -12, peak: 25070, floor: 24070, dd: 1000, dailyLoss: 600, password: 'no' } },
  resumenTradingView: true,
  colchon: { state: 'idle', strategy: null },
  toggles: { sonidoSenal: true, estrategia: 'dia-minimo-mas-colchon', token: 'abc' },
});
assert.equal(status.version, '0.10.57');
assert.equal(status.cuentas[0].dailyLoss, 600);
assert.equal(status.cuentas[0].dd, 1000);
assert.equal('password' in status.cuentas[0], false);
assert.equal(status.granja.toggles.token, '[redactado]');
assert.equal(status.granja.toggles.estrategia, 'dia-minimo-mas-colchon');
assert.equal(status.conexion.tradingview, true);

const r = await crearPaqueteLogs({
  dir, root, destino: dest, ahora: cuando, version: '0.10.57', topeBytes: 80,
  conexion: status.conexion, cuentas: { a: { id: 'a', dailyLoss: 600, dd: 1000, token: 'x' } },
  resumenTradingView: false, toggles: { resumenTradingView: false },
});
assert.equal(r.ok, true);
assert.equal(r.nombre, 'Profito-logs-2026-11-25_1407.zip');
assert.equal(r.aviso, 'Guardado en Descargas: Profito-logs-2026-11-25_1407.zip');
assert.equal(r.path, path.join(dest, r.nombre));
const zip = fs.readFileSync(r.path);
assert.equal(zip.readUInt32LE(0), 0x04034b50);
const texto = zip.toString('utf8');
assert.match(texto, /logs\/colchon\.log/);
assert.match(texto, /logs\/colchon\.log\.1/);
assert.match(texto, /logs\/colchon-latencia\.log/);
assert.match(texto, /logs\/logs\/servidor\.log/);
assert.match(texto, /logs\/logs\/lanzador\.log\.1/);
assert.match(texto, /logs\/logs\/carga\.txt/);
assert.match(texto, /logs\/logs\/servidor\.log\.5/);
assert.match(texto, /logs\/raiz\/tradinglink\.log/);
assert.match(texto, /logs\/raiz\/estrategias-propias\.json/);
assert.match(texto, /strategies":\[\]/);
assert.match(texto, /Encendiendo servidor/);
assert.match(texto, /status\.json/);
assert.match(texto, /token=\[redactado\]/);
assert.match(texto, /\[redactado\]/);
for (const secreto of ['super-secreto', 'k-SECRET', 'pw-SECRET', 'tok-9', 'plano-secreto', 'c-SECRET', 'cl-SECRET', 'carga-SECRET', 'cola-SECRET', 'ab-SECRET', 'CABEZA-SECRETA', 'no-va']) {
  assert.doesNotMatch(texto, new RegExp(secreto), secreto);
}
assert.doesNotMatch(texto, /servidor\.pid/);
assert.doesNotMatch(texto, /accounts\.json/);
assert.match(texto, /"version": "0.10.57"/);
assert.match(texto, /"dailyLoss": 600/);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const menu = html.slice(html.indexOf('Sonido de un Profito en TradingView'), html.indexOf('tlLogsAviso') + 20);
assert.match(menu, /Resumen de trades en TradingView/);
assert.match(menu, /Descargar Logs y status/);
assert.ok(menu.indexOf('Resumen de trades en TradingView') < menu.indexOf('Descargar Logs y status'));
assert.match(html, /\/api\/descargar-logs/);
assert.match(html, /Guardado en Descargas/);

console.log('descargar-logs ok');
