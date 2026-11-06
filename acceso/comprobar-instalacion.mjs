// Comprueba una carpeta de Profito / TradingLink. No descarga, no borra, no mata procesos y no envía órdenes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PIN = {
  producto: '0.8.5',
  tag: 'v0.8.5',
  commit: '93f6cb42d3bb326b6140dbd1cf5c3107c7f6ea76',
  archivoZip: 'https://github.com/apriai/AI-Profit/archive/refs/tags/v0.8.5.zip',
  nodeVersion: 'v22.23.4',
  nodeZip: 'node-v22.23.4-win-x64.zip',
  nodeUrl: 'https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip',
  nodeShasums: 'https://nodejs.org/dist/v22.23.4/SHASUMS256.txt',
  nodeSha256: 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20',
  nodeLicencia: 'MIT',
};

export const MARCADOR = 'profito-guia.json';
export const GUIA_ID = 'INSTALAR-CON-GROKBOT';

const CODIGO = [
  'motor/tradinglink.mjs',
  'motor/colchon.mjs',
  'motor/rutas.mjs',
  'motor/strategies.mjs',
  'motor/orders.mjs',
  'motor/negocio.mjs',
  'motor/estrategias-propias.mjs',
  'motor/Granja-de-Cuentas-v2.html',
  'acceso/Abrir Granja.bat',
  'acceso/abrir-tradingview.bat',
  'acceso/iniciar-tradinglink.bat',
  'instalar-ai-profit.bat',
  'VERSION',
  'tradingview-mcp/package.json',
  'tradingview-mcp/node_modules/chrome-remote-interface/index.js',
  'tradingview-mcp/node_modules/ws/index.js',
  'tradingview-mcp/node_modules/commander/index.js',
];

export function sha256De(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function leerMarcador(root, fsImpl = fs) {
  const f = path.join(root, MARCADOR);
  if (!fsImpl.existsSync(f)) return null;
  try { return JSON.parse(fsImpl.readFileSync(f, 'utf8')); } catch { return { corrupto: true }; }
}

export function clasificarCarpeta(root, fsImpl = fs) {
  const ok = rel => fsImpl.existsSync(path.join(root, rel));
  if (!ok('motor/tradinglink.mjs')) return { estado: 'vacio' };
  const marker = leerMarcador(root, fsImpl);
  if (!marker || marker.guia !== GUIA_ID || marker.corrupto) return { estado: 'ajeno' };
  const version = ok('VERSION') ? String(fsImpl.readFileSync(path.join(root, 'VERSION'), 'utf8')).trim() : '';
  if (version === PIN.producto && marker.producto === PIN.producto) return { estado: 'nuestro-misma-version', version };
  return { estado: 'nuestro-otra-version', version, marcada: marker.producto || null };
}

export function marcarGuia(root, fsImpl = fs) {
  const clas = clasificarCarpeta(root, fsImpl);
  if (clas.estado === 'ajeno') return { ok: false, error: 'carpeta ajena: no se escribe el marcador' };
  if (!fsImpl.existsSync(path.join(root, 'VERSION'))) return { ok: false, error: 'falta VERSION' };
  const version = String(fsImpl.readFileSync(path.join(root, 'VERSION'), 'utf8')).trim();
  if (version !== PIN.producto) return { ok: false, error: 'VERSION distinta de la guía' };
  const body = { guia: GUIA_ID, producto: PIN.producto, commit: PIN.commit, tag: PIN.tag };
  fsImpl.writeFileSync(path.join(root, MARCADOR), JSON.stringify(body, null, 1) + '\n');
  return { ok: true, estado: 'nuestro-misma-version' };
}

export async function sonda(url, fetchImpl = globalThis.fetch, ms = 2000) {
  if (typeof fetchImpl !== 'function') return { url, ok: false, error: 'sin-fetch' };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetchImpl(url, { signal: ac.signal });
    return { url, ok: !!r.ok, status: r.status ?? null };
  } catch (e) {
    return { url, ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'no-responde' };
  } finally { clearTimeout(t); }
}

function versionNode(exe) {
  const r = spawnSync(exe, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return { ok: false, error: 'node-no-arranca' };
  return { ok: true, version: String(r.stdout || '').trim() };
}

export async function comprobar(root, opt = {}) {
  const fsImpl = opt.fsImpl || fs;
  const faltan = CODIGO.filter(rel => !fsImpl.existsSync(path.join(root, rel)));
  const version = fsImpl.existsSync(path.join(root, 'VERSION')) ? String(fsImpl.readFileSync(path.join(root, 'VERSION'), 'utf8')).trim() : '';
  const nodeExe = path.join(root, 'node-win', 'node.exe');
  const node = fsImpl.existsSync(nodeExe) ? versionNode(opt.nodeExe || nodeExe) : { ok: false, error: 'falta-node-win' };
  const sintaxis = [];
  if (node.ok) {
    for (const rel of ['motor/tradinglink.mjs', 'motor/colchon.mjs', 'motor/rutas.mjs', 'motor/orders.mjs']) {
      const r = spawnSync(opt.nodeExe || nodeExe, ['--check', path.join(root, rel)], { encoding: 'utf8', timeout: 20000 });
      sintaxis.push({ archivo: rel, ok: r.status === 0 });
    }
  }
  const fetchImpl = opt.fetchImpl === undefined ? globalThis.fetch : opt.fetchImpl;
  const servidor = await sonda('http://127.0.0.1:8787/', fetchImpl);
  const tv = await sonda('http://127.0.0.1:9222/json/version', fetchImpl);
  const cuentas = fsImpl.existsSync(path.join(root, 'accounts.json')) || fsImpl.existsSync(path.join(root, 'datos', 'accounts.json'));
  const discoOk = faltan.length === 0 && version === PIN.producto && node.ok && node.version === PIN.nodeVersion && sintaxis.every(s => s.ok);
  const clas = clasificarCarpeta(root, fsImpl);
  return {
    carpeta: clas.estado,
    version,
    versionEsperada: PIN.producto,
    commitEsperado: PIN.commit,
    node: node.ok ? node.version : node.error,
    nodeEsperado: PIN.nodeVersion,
    faltan,
    sintaxis,
    servidor: servidor.ok,
    tradingview9222: tv.ok,
    archivoCuentas: cuentas,
    enDisco: discoOk,
    instalado: discoOk && servidor.ok,
  };
}

const esCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esCli) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
  const r = await comprobar(root);
  console.log(JSON.stringify(r, null, 1));
  process.exit(r.enDisco ? 0 : 1);
}
