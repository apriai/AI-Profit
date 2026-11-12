import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PIN, GUIA_ID, MARCADOR, sha256De, clasificarCarpeta, marcarGuia, comprobar, sonda, ultimaRelease, versionDeTag, archivoZip } from './comprobar-instalacion.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

eq(sha256De(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq(PIN.nodeSha256, 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20');
eq(PIN.producto, undefined, 'la versión del programa no va fijada');
eq(PIN.ultimaRelease, 'https://api.github.com/repos/apriai/AI-Profit/releases/latest');
eq(versionDeTag('v0.10.1'), '0.10.1');
eq(archivoZip('v0.10.1'), 'https://github.com/apriai/AI-Profit/archive/refs/tags/v0.10.1.zip');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-guia-'));
eq(clasificarCarpeta(dir).estado, 'vacio');
fs.mkdirSync(path.join(dir, 'motor'), { recursive: true });
fs.writeFileSync(path.join(dir, 'motor/tradinglink.mjs'), 'export {}\n');
fs.writeFileSync(path.join(dir, 'VERSION'), '0.10.1\n');
fs.mkdirSync(path.join(dir, 'acceso'), { recursive: true });
fs.writeFileSync(path.join(dir, 'acceso/Abrir Granja.bat'), 'rem\n');
eq(clasificarCarpeta(dir).estado, 'ajeno');
eq(marcarGuia(dir).ok, false);

fs.writeFileSync(path.join(dir, MARCADOR), JSON.stringify({ guia: GUIA_ID, producto: '0.8.4' }));
eq(clasificarCarpeta(dir).estado, 'nuestro-otra-version');
fs.writeFileSync(path.join(dir, MARCADOR), JSON.stringify({ guia: GUIA_ID, producto: '0.10.1' }));
eq(clasificarCarpeta(dir).estado, 'nuestro-misma-version');
eq(clasificarCarpeta(dir, fs, '0.10.1').estado, 'nuestro-misma-version');
eq(clasificarCarpeta(dir, fs, '0.11.0').estado, 'nuestro-otra-version', 'hay una release más nueva');
eq(marcarGuia(dir, fs, { tag: 'v0.9.0' }).ok, false, 'la etiqueta tiene que coincidir con VERSION');
eq(marcarGuia(dir, fs, { tag: 'v0.10.1', commit: 'a5d1fa8b3a40e5ccce0881d995835423d9fdaaba' }).ok, true);
eq(JSON.parse(fs.readFileSync(path.join(dir, MARCADOR), 'utf8')), { guia: GUIA_ID, producto: '0.10.1', commit: 'a5d1fa8b3a40e5ccce0881d995835423d9fdaaba', tag: 'v0.10.1' });

const archivos = [
  'motor/colchon.mjs', 'motor/rutas.mjs', 'motor/strategies.mjs', 'motor/orders.mjs', 'motor/negocio.mjs',
  'motor/estrategias-propias.mjs', 'motor/Granja-de-Cuentas-v2.html', 'acceso/abrir-tradingview.bat',
  'acceso/iniciar-tradinglink.bat', 'instalar-ai-profit.bat', 'tradingview-mcp/package.json',
  'tradingview-mcp/node_modules/chrome-remote-interface/index.js',
  'tradingview-mcp/node_modules/ws/index.js', 'tradingview-mcp/node_modules/commander/index.js',
];
for (const rel of archivos) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), rel.endsWith('.mjs') ? 'export {}\n' : 'x');
}
fs.mkdirSync(path.join(dir, 'node-win'), { recursive: true });
fs.writeFileSync(path.join(dir, 'node-win/node.exe'), '');
fs.writeFileSync(path.join(dir, 'accounts.json'), '{"secreto":true}');

const fetchImpl = async (url) => ({ ok: String(url).includes('8787'), status: String(url).includes('8787') ? 200 : 500 });
const r = await comprobar(dir, { nodeExe: process.execPath, fetchImpl });
eq(r.enDisco, true, JSON.stringify(r));
eq(r.version, '0.10.1');
eq(r.versionOk, true);
const conUltima = await comprobar(dir, { nodeExe: process.execPath, fetchImpl, versionEsperada: 'v0.10.1' });
eq(conUltima.enDisco, true);
const viejo = await comprobar(dir, { nodeExe: process.execPath, fetchImpl, versionEsperada: 'v0.11.0' });
eq(viejo.enDisco, false, 'si la última release es otra, no está al día');
eq(viejo.versionOk, false);
eq(r.instalado, true);
eq(r.tradingview9222, false);
eq(r.archivoCuentas, true);
eq(r.servidor, true);
ok(!JSON.stringify(r).includes('secreto'), 'el informe no copia el contenido de las cuentas');

const apagado = await comprobar(dir, { nodeExe: process.execPath, fetchImpl: async () => { throw new Error('down'); } });
eq(apagado.instalado, false);
eq(apagado.enDisco, true);

const u = await ultimaRelease(async (url) => ({ ok: url === PIN.ultimaRelease, status: 200, json: async () => ({ tag_name: 'v0.10.1' }) }));
eq(u, { ok: true, tag: 'v0.10.1', version: '0.10.1' });
eq((await ultimaRelease(async () => ({ ok: false, status: 403 }))).ok, false);
eq((await ultimaRelease(async () => { throw new Error('sin red'); })).error, 'no-responde');

const s = await sonda('http://127.0.0.1:9/', async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; });
eq(s.error, 'timeout');

const guia = fs.readFileSync(new URL('../INSTALAR-CON-GROKBOT.md', import.meta.url), 'utf8');
const pasos = fs.readFileSync(new URL('../docs/instalacion/pasos.md', import.meta.url), 'utf8');
const problemas = fs.readFileSync(new URL('../docs/instalacion/problemas.md', import.meta.url), 'utf8');
const comp = fs.readFileSync(new URL('../docs/instalacion/comprobaciones.md', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('./comprobar-instalacion.mjs', import.meta.url), 'utf8');
const todo = guia + pasos + problemas + comp + script;
const notas = fs.readFileSync(new URL('../docs/instalacion/notas-internas.md', import.meta.url), 'utf8');
const leeme = fs.readFileSync(new URL('../docs/instalacion/LEEME.md', import.meta.url), 'utf8');
for (const pieza of [PIN.nodeSha256, PIN.nodeVersion, PIN.nodeUrl, 'SHASUMS256.txt', '404', 'releases/latest', 'tag_name']) ok(todo.includes(pieza), pieza);
// ninguna versión de programa fija en la guía, los documentos ni el README (solo el Node portable)
const sinNode = (guia + pasos + problemas + comp + leeme + notas + readme.split('\n').find(l => l.includes('INSTALAR-CON-GROKBOT.md'))).replaceAll('22.23.4', '');
ok(!/(?<![\d.])v?\d+\.\d+\.\d+(?![\d.])/.test(sinNode.replaceAll('127.0.0.1', '')), 'hay una versión fija');
ok(!/0\.8\.5|93f6cb42/.test(todo + leeme + notas), 'queda la versión 0.8.5');
// TradingView se reconecta solo y lo que ve la persona no habla de puertos
ok(guia.includes('No me pidas confirmación ni me avises por TradingView'));
ok(!/espera (un|mi) sí|Avisar antes de abrir|avísame en voz alta|Guarda el gráfico|confirma que no hay posición/i.test(guia + pasos + problemas + comp));
ok(!/8787|9222|puerto/i.test(guia.replace(/```[\s\S]*?```/g, m => m.replace(/http:\/\/127\.0\.0\.1:8787\/?/g, '')) + pasos + problemas + comp + leeme), 'puertos en lo que ve la persona');
ok(notas.includes('9222') && notas.includes('api/colchon/status'), 'los detalles técnicos están en las notas internas');
ok(guia.includes('No crees real-allowlist.json'));
ok(readme.includes('INSTALAR-CON-GROKBOT.md'));
ok(!/alepr|C:\\Users\\[A-Za-z0-9]+\\OneDrive/.test(todo));
ok(!/taskkill|placeOrder|npm ci|git clone|allowAll/.test(script));
ok(!script.includes('Remove-Item'));
console.log(`instalacion: ${n} comprobaciones`);
