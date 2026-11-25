import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { armarStatus, crearPaqueteLogs, esArchivoLog, redactar } from './descargar-logs.mjs';

assert.equal(esArchivoLog('colchon.log'), true);
assert.equal(esArchivoLog('colchon.log.1'), true);
assert.equal(esArchivoLog('accounts.json'), false);
assert.equal(redactar('bearer abc.def', 'nota'), 'bearer [redactado]');
assert.equal(redactar({ token: 'secreto', dailyLoss: 600 }).token, '[redactado]');
assert.equal(redactar({ token: 'secreto', dailyLoss: 600 }).dailyLoss, 600);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-logs-'));
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-desc-'));
fs.writeFileSync(path.join(dir, 'colchon.log'), 'hola\ntoken=super-secreto\n');
fs.writeFileSync(path.join(dir, 'colchon-latencia.log'), 'latencia 12\n');
fs.writeFileSync(path.join(dir, 'colchon.log.1'), 'rotado\n');
fs.writeFileSync(path.join(dir, 'accounts.json'), '{"password":"no-va"}');

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
  dir, destino: dest, ahora: cuando, version: '0.10.57',
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
assert.match(texto, /colchon\.log/);
assert.match(texto, /colchon\.log\.1/);
assert.match(texto, /colchon-latencia\.log/);
assert.match(texto, /status\.json/);
assert.match(texto, /token=\[redactado\]/);
assert.doesNotMatch(texto, /super-secreto/);
assert.doesNotMatch(texto, /accounts\.json/);
assert.match(texto, /"version": "0.10.57"/);
assert.match(texto, /"dailyLoss": 600/);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const menu = html.slice(html.indexOf('Sonido de la señal'), html.indexOf('tlLogsAviso') + 20);
assert.match(menu, /Resumen de trades en TradingView/);
assert.match(menu, /Descargar Logs y status/);
assert.ok(menu.indexOf('Resumen de trades en TradingView') < menu.indexOf('Descargar Logs y status'));
assert.match(html, /\/api\/descargar-logs/);
assert.match(html, /Guardado en Descargas/);

console.log('descargar-logs ok');
