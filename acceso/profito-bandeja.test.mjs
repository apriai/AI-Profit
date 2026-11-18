import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anexar, carpetaLogs, rotar } from './profito-log.mjs';
import {
  TOOLTIP, TITULO_CARGA, MENU, ORDEN_INSTALADOR, ORDEN_CARGA, LOGO_CARGA, LIMITE_CARGA_MS, PASOS,
  textoCarga, debeMostrarCarga, textoEstado, argsNavegador, planCerrar, parseProcesos, esProcesoNuestro,
} from './profito-bandeja.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

assert.equal(TOOLTIP, 'AI Profit');
assert.equal(TITULO_CARGA, 'Cargando Profito…');
assert.deepEqual(MENU.map(m => m.texto), ['Abrir granja', 'Estado', 'Ver logs', 'Cerrar Profito']);
assert.equal(LIMITE_CARGA_MS, 60000);
assert.notDeepEqual(ORDEN_CARGA, ORDEN_INSTALADOR);
assert.equal(ORDEN_CARGA[0], '3-granja-cerca.jpg');
assert.ok(ORDEN_INSTALADOR.every((n, i) => ORDEN_CARGA[i] !== n || ORDEN_CARGA.length !== ORDEN_INSTALADOR.length));
assert.equal(LOGO_CARGA, 'propfarm-logo.png');
assert.equal(textoCarga('servidor', 0), PASOS.servidor);
assert.equal(textoCarga('tv', 1000), 'Conectando TradingView…');
assert.equal(textoCarga('granja', 59000), 'Abriendo granja…');
assert.match(textoCarga('tv', 60000), /Sigue pendiente: Conectando TradingView/);
assert.equal(debeMostrarCarga(false), true);
assert.equal(debeMostrarCarga(true), false, 'la segunda apertura no muestra la carga');
assert.equal(textoEstado({ servidor: true, tradingview: true, tradovate: false }), 'Servidor: en marcha\nTradingView: conectado\nTradovate: sin conexión');
assert.equal(textoEstado({}), 'Servidor: apagado\nTradingView: sin conexión\nTradovate: sin conexión');
const args = argsNavegador('C:\\Users\\ana\\AppData\\Local\\Profito\\navegador');
assert.ok(args.includes('--autoplay-policy=no-user-gesture-required'));
assert.ok(args.some(a => a.startsWith('--app=http://localhost:8787/Granja-de-Cuentas-v2.html')));

const carpeta = 'C:\\Users\\ana\\AppData\\Local\\Profito';
const procesos = parseProcesos([
  'pid|nombre|linea',
  `400|node.exe|${carpeta}\\node-win\\node.exe ${carpeta}\\motor\\tradinglink.mjs`,
  `401|powershell.exe|powershell.exe -File ${carpeta}\\acceso\\profito-bandeja.ps1`,
  `402|TradingView.exe|C:\\Program Files\\WindowsApps\\TradingView.exe`,
  `403|powershell.exe|powershell.exe -File ${carpeta}\\acceso\\abrir-tradingview.ps1`,
  `404|wscript.exe|wscript.exe //B ${carpeta}\\acceso\\AI Profit.vbs`,
].join('\n'));
const quieto = planCerrar(procesos, { incluirBandeja: false, self: 1, root: carpeta });
assert.deepEqual(quieto.nodos, [400]);
assert.deepEqual(quieto.bandeja, []);
assert.equal(quieto.tradingview, false);
assert.equal(quieto.ordenes, false);
const todo = planCerrar(procesos, { incluirBandeja: true, self: 1, root: carpeta });
assert.deepEqual(todo.nodos, [400]);
assert.deepEqual(todo.bandeja, [401, 404]);
assert.equal(esProcesoNuestro({ nombre: 'TradingView.exe', linea: carpeta + '\\TradingView.exe' }, carpeta), false);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profito-log-'));
const archivo = path.join(dir, 'servidor.log');
anexar(archivo, 'a'.repeat(40), { maxBytes: 30, conservar: 3 });
anexar(archivo, 'b'.repeat(10), { maxBytes: 30, conservar: 3 });
assert.equal(fs.readFileSync(archivo, 'utf8'), 'b'.repeat(10));
assert.equal(fs.readFileSync(archivo + '.1', 'utf8'), 'a'.repeat(40));
assert.equal(rotar(archivo, { maxBytes: 1000 }), false);
assert.equal(carpetaLogs({ LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' }), 'C:\\Users\\ana\\AppData\\Local\\Profito\\datos\\logs');

const ps1 = fs.readFileSync(path.join(here, 'profito-bandeja.ps1'), 'utf8');
const vbs = fs.readFileSync(path.join(here, 'AI Profit.vbs'), 'utf8');
const arranque = fs.readFileSync(path.join(here, 'profito-arranque.ps1'), 'utf8');
const nsi = fs.readFileSync(path.join(root, 'instalador', 'profito.nsi'), 'utf8');
assert.ok(ps1.indexOf('if (-not $creado)') < ps1.indexOf("Text = 'Cargando Profito"), 'si ya está abierta, no hay pantalla de carga');
assert.ok(ps1.includes('Cargando Profito'));
assert.ok(ps1.includes('Encendiendo servidor'));
assert.ok(ps1.includes('Sigue pendiente:'));
assert.ok(ps1.includes('60000'));
assert.ok(ps1.includes("Text = 'AI Profit'"));
for (const texto of MENU.map(m => m.texto)) assert.ok(ps1.includes(texto), texto);
const orden = ORDEN_CARGA.map(n => ps1.indexOf(n));
assert.ok(orden.every(i => i > 0));
assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
assert.ok(ps1.includes('propfarm-logo.png'));
assert.ok(ps1.includes('CreateNoWindow = $true'));
assert.ok(ps1.includes('Local\\ProfitoBandeja'));
assert.doesNotMatch(ps1, /taskkill[^\n]*TradingView/i);
assert.ok(vbs.includes('WindowStyle Hidden'));
assert.ok(vbs.includes('profito-bandeja.ps1'));
assert.ok(arranque.includes('Encendiendo servidor'));
assert.ok(arranque.includes('Conectando TradingView'));
assert.ok(arranque.includes('Abriendo granja'));
assert.match(fs.readFileSync(path.join(here, 'profito-bandeja.mjs'), 'utf8'), /cmd === 'servir'/);
assert.ok(ps1.includes('servir'));
assert.ok(nsi.includes('assets\\profito.ico'));
assert.ok(nsi.includes('AI Profit.vbs'));
assert.equal(fs.existsSync(path.join(root, 'assets', 'profito.ico')), true);
const ico = fs.readFileSync(path.join(root, 'assets', 'profito.ico'));
assert.equal(ico.readUInt16LE(4), 10, 'el icono trae 16, 20, 24, 32, 40, 48, 64, 96, 128 y 256');
const pedidos = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
for (let i = 0; i < pedidos.length; i++) {
  const w = ico[6 + i * 16] || 256;
  const off = ico.readUInt32LE(6 + i * 16 + 12);
  const ancho = ico.readUInt32BE(off + 16);
  assert.equal(w, pedidos[i], 'falta el tamaño ' + pedidos[i]);
  assert.equal(ancho, pedidos[i], 'el tamaño ' + pedidos[i] + ' no está pintado a ese tamaño');
}
const htmlIcono = fs.readFileSync(path.join(root, 'motor', 'Granja-de-Cuentas-v2.html'), 'utf8');
assert.match(htmlIcono, /href="\/favicon-192\.png"/);
assert.match(htmlIcono, /href="\/favicon-512\.png"/);
assert.match(htmlIcono, /apple-touch-icon/);
assert.match(htmlIcono, /href="\/manifest\.webmanifest"/);
assert.equal(htmlIcono.includes('rel="icon" type="image/png" href="data:image/png;base64'), false);
assert.match(fs.readFileSync(path.join(root, 'motor', 'rutas-api.mjs'), 'utf8'), /\/favicon-512\.png/);

const server = fs.readFileSync(path.join(root, 'motor', 'tradinglink.mjs'), 'utf8');
assert.match(server, /setTimeout\(pasarAlgo, 20000\)/);
assert.match(server, /setInterval\(pasarAlgo, 10 \* 60 \* 1000\)/);
assert.match(server, /setInterval\(verOjos, 30000\)/);

console.log('profito-bandeja ok');
