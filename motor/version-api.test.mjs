import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textoVersion } from './version-api.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-ver-'));
const archivo = path.join(dir, 'VERSION');

fs.writeFileSync(archivo, '0.10.13\n');
assert.equal(textoVersion(archivo), '0.10.13');
fs.writeFileSync(archivo, '\uFEFF  1.2.3  ');
assert.equal(textoVersion(archivo), '1.2.3');
fs.writeFileSync(archivo, 'no-es-version');
assert.equal(textoVersion(archivo), '');
fs.writeFileSync(archivo, '');
assert.equal(textoVersion(archivo), '');
assert.equal(textoVersion(path.join(dir, 'no-esta')), '');

const server = fs.readFileSync(path.join(here, 'tradinglink.mjs'), 'utf8');
const rutas = fs.readFileSync(path.join(here, 'rutas-api.mjs'), 'utf8');
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');
assert.ok(rutas.includes("q.url === '/api/version'"), 'el servidor expone /api/version');
assert.ok(rutas.includes('textoVersion'), 'lee el archivo VERSION');
assert.ok(rutas.includes("path.join(deps.ROOT, 'VERSION')"), 'usa el VERSION de la instalación');
assert.ok(server.includes('textoVersion') && server.includes('manejar'), 'tradinglink usa esas rutas');
assert.ok(html.includes("fetch('/api/version'"), 'el panel pide /api/version');
assert.ok(html.includes("v.textContent = 'Versión ' + t"), 'muestra Versión x.y.z');
assert.ok(html.includes('id = \'tlVerNegocio\''), 'el texto va en el panel Negocio');
assert.ok(html.includes('id = \'tlNegocioPie\''), 'queda en la fila de abajo, junto a Demo');
assert.ok(html.includes("/^\\d+\\.\\d+\\.\\d+$/.test(t)"), 'si no es una versión, no escribe nada');
assert.equal(textoVersion(path.join(here, '..', 'VERSION')), '0.10.62');

console.log('version-api ok');
