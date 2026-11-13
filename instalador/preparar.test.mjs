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
console.log('preparar ok', version);
