import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparar } from './preparar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-profito-'));
preparar(root, dest);

const debe = [
  'VERSION',
  'motor/tradinglink.mjs',
  'motor/colchon.mjs',
  'motor/Granja-de-Cuentas-v2.html',
  'motor/version-api.mjs',
  'motor/pnl-sesion.mjs',
  'motor/pine-algo.mjs',
  'motor/pine/ai-profit-camp-algo.pine',
  'motor/pine/smart-money-algo.pine',
  'acceso/navegador-granja.mjs',
  'motor/pine/manifest.json',
  'motor/sonidos/clic-burbuja.wav',
  'motor/sonidos/despertar-wuhu.wav',
  'acceso/profito-estado.mjs',
  'acceso/aviso-actualizacion.mjs',
  'acceso/aviso-actualizacion.ps1',
  'acceso/AI Profit.cmd',
  'acceso/Abrir Granja.bat',
  'acceso/abrir-tradingview.ps1',
  'assets/abrir-granja-icon.ico',
  'datos/LEEME.md',
  'tradingview-mcp/package.json',
  'tradingview-mcp/node_modules/chrome-remote-interface/index.js',
];
for (const rel of debe) assert.ok(fs.existsSync(path.join(dest, rel)), rel);
assert.ok(!fs.existsSync(path.join(dest, 'accounts.json')));
assert.ok(!fs.existsSync(path.join(dest, 'datos/accounts.json')));
assert.ok(!fs.existsSync(path.join(dest, 'negocio.json')));
assert.ok(!fs.existsSync(path.join(dest, 'acceso/profito-estado.test.mjs')));
assert.ok(!fs.existsSync(path.join(dest, 'motor/test-cuentas-50k.mjs')));
const version = fs.readFileSync(path.join(dest, 'VERSION'), 'utf8').trim();
assert.match(version, /^\d+\.\d+\.\d+$/);

function archivosCitados(texto) {
  const out = new Set();
  const add = (s) => {
    const base = String(s || '').replace(/\\/g, '/').split('/').pop();
    if (/^[A-Za-z0-9 ._-]+\.(mjs|js|bat|cmd|ps1)$/.test(base)) out.add(base);
  };
  for (const m of texto.matchAll(/%~dp0([^\s"%]+)/g)) add(m[1]);
  for (const m of texto.matchAll(/path\.join\(AQUI,\s*'([^']+)'\)/g)) add(m[1]);
  for (const m of texto.matchAll(/['"]([^'"\r\n]+\.(?:mjs|js|bat|cmd|ps1))['"]/g)) add(m[1]);
  return [...out];
}
const accesoDir = path.join(root, 'acceso');
for (const name of fs.readdirSync(accesoDir)) {
  if (!/\.(mjs|js|bat|cmd|ps1)$/i.test(name) || /\.test\.mjs$/.test(name)) continue;
  const texto = fs.readFileSync(path.join(accesoDir, name), 'utf8');
  for (const citado of archivosCitados(texto)) {
    if (citado === name || !fs.existsSync(path.join(accesoDir, citado))) continue;
    assert.ok(fs.existsSync(path.join(dest, 'acceso', citado)), `${name} usa ${citado} y no está en el paquete`);
  }
}
console.log('preparar ok', version);
