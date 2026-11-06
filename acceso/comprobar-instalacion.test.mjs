import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PIN, GUIA_ID, MARCADOR, sha256De, clasificarCarpeta, marcarGuia, comprobar, sonda } from './comprobar-instalacion.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

eq(sha256De(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq(PIN.nodeSha256, 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20');
eq(PIN.producto, '0.8.5');
eq(PIN.commit, '93f6cb42d3bb326b6140dbd1cf5c3107c7f6ea76');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-guia-'));
eq(clasificarCarpeta(dir).estado, 'vacio');
fs.mkdirSync(path.join(dir, 'motor'), { recursive: true });
fs.writeFileSync(path.join(dir, 'motor/tradinglink.mjs'), 'export {}\n');
fs.writeFileSync(path.join(dir, 'VERSION'), '0.8.5\n');
fs.mkdirSync(path.join(dir, 'acceso'), { recursive: true });
fs.writeFileSync(path.join(dir, 'acceso/Abrir Granja.bat'), 'rem\n');
eq(clasificarCarpeta(dir).estado, 'ajeno');
eq(marcarGuia(dir).ok, false);

fs.writeFileSync(path.join(dir, MARCADOR), JSON.stringify({ guia: GUIA_ID, producto: '0.8.4' }));
eq(clasificarCarpeta(dir).estado, 'nuestro-otra-version');
fs.writeFileSync(path.join(dir, MARCADOR), JSON.stringify({ guia: GUIA_ID, producto: '0.8.5' }));
eq(clasificarCarpeta(dir).estado, 'nuestro-misma-version');
eq(marcarGuia(dir).ok, true);

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
eq(r.instalado, true);
eq(r.tradingview9222, false);
eq(r.archivoCuentas, true);
eq(r.servidor, true);
ok(!JSON.stringify(r).includes('secreto'), 'el informe no copia el contenido de las cuentas');

const apagado = await comprobar(dir, { nodeExe: process.execPath, fetchImpl: async () => { throw new Error('down'); } });
eq(apagado.instalado, false);
eq(apagado.enDisco, true);

const s = await sonda('http://127.0.0.1:9/', async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; });
eq(s.error, 'timeout');

const guia = fs.readFileSync(new URL('../INSTALAR-CON-GROKBOT.md', import.meta.url), 'utf8');
const pasos = fs.readFileSync(new URL('../docs/instalacion/pasos.md', import.meta.url), 'utf8');
const problemas = fs.readFileSync(new URL('../docs/instalacion/problemas.md', import.meta.url), 'utf8');
const comp = fs.readFileSync(new URL('../docs/instalacion/comprobaciones.md', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('./comprobar-instalacion.mjs', import.meta.url), 'utf8');
const todo = guia + pasos + problemas + comp + script;
for (const pieza of [PIN.nodeSha256, PIN.commit, PIN.tag, PIN.nodeVersion, PIN.nodeUrl, 'SHASUMS256.txt', '404']) ok(todo.includes(pieza), pieza);
ok(guia.includes('taskkill') && guia.includes('Guarda el gráfico') && guia.includes('no hay posición'));
ok(guia.includes('No crees real-allowlist.json'));
ok(readme.includes('INSTALAR-CON-GROKBOT.md'));
ok(!/alepr|C:\\Users\\[A-Za-z0-9]+\\OneDrive/.test(todo));
ok(!/taskkill|placeOrder|npm ci|git clone|allowAll/.test(script));
ok(!script.includes('Remove-Item'));
console.log(`instalacion: ${n} comprobaciones`);
