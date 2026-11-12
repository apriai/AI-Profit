// Comprueba una carpeta de Profito / TradingLink. No descarga, no borra, no mata procesos y no envía órdenes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// La versión del programa no se fija aquí: es la del archivo VERSION de la carpeta
// o, con --ultima, la etiqueta de la última release publicada.
export const PIN = {
  repo: 'apriai/AI-Profit',
  ultimaRelease: 'https://api.github.com/repos/apriai/AI-Profit/releases/latest',
  paginaUltima: 'https://github.com/apriai/AI-Profit/releases/latest',
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

export function archivoZip(tag) {
  return `https://github.com/apriai/AI-Profit/archive/refs/tags/${tag}.zip`;
}

export function versionDeTag(tag) {
  return String(tag || '').trim().replace(/^v/, '');
}

function leerVersion(root, fsImpl) {
  const f = path.join(root, 'VERSION');
  return fsImpl.existsSync(f) ? String(fsImpl.readFileSync(f, 'utf8')).trim() : '';
}

// Etiqueta de la última release publicada. Sin token; si no responde, { ok: false }.
export async function ultimaRelease(fetchImpl = globalThis.fetch, ms = 8000) {
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'sin-fetch' };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetchImpl(PIN.ultimaRelease, { signal: ac.signal, headers: { accept: 'application/vnd.github+json' } });
    if (!r.ok) return { ok: false, error: `http-${r.status}` };
    const j = await r.json();
    if (!j || typeof j.tag_name !== 'string' || !j.tag_name) return { ok: false, error: 'sin-tag' };
    return { ok: true, tag: j.tag_name, version: versionDeTag(j.tag_name) };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'no-responde' };
  } finally { clearTimeout(t); }
}

export function sha256De(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function leerMarcador(root, fsImpl = fs) {
  const f = path.join(root, MARCADOR);
  if (!fsImpl.existsSync(f)) return null;
  try { return JSON.parse(fsImpl.readFileSync(f, 'utf8')); } catch { return { corrupto: true }; }
}

// esperada: versión de la última release (sin la v), si se conoce. Si no, se compara
// la VERSION de la carpeta con la que anotó el marcador.
export function clasificarCarpeta(root, fsImpl = fs, esperada = null) {
  const ok = rel => fsImpl.existsSync(path.join(root, rel));
  if (!ok('motor/tradinglink.mjs')) return { estado: 'vacio' };
  const marker = leerMarcador(root, fsImpl);
  if (!marker || marker.guia !== GUIA_ID || marker.corrupto) return { estado: 'ajeno' };
  const version = leerVersion(root, fsImpl);
  const objetivo = esperada || version;
  if (version && version === objetivo && marker.producto === version) return { estado: 'nuestro-misma-version', version };
  return { estado: 'nuestro-otra-version', version, marcada: marker.producto || null };
}

// info: { tag, commit } de la release instalada. Sin tag, se usa v + VERSION.
export function marcarGuia(root, fsImpl = fs, info = {}) {
  const clas = clasificarCarpeta(root, fsImpl);
  if (clas.estado === 'ajeno') return { ok: false, error: 'carpeta ajena: no se escribe el marcador' };
  const version = leerVersion(root, fsImpl);
  if (!version) return { ok: false, error: 'falta VERSION' };
  if (info.tag && versionDeTag(info.tag) !== version) return { ok: false, error: 'VERSION distinta de la guía' };
  const body = { guia: GUIA_ID, producto: version, commit: info.commit || null, tag: info.tag || `v${version}` };
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
  const version = leerVersion(root, fsImpl);
  const esperada = opt.versionEsperada ? versionDeTag(opt.versionEsperada) : null;
  const marker = leerMarcador(root, fsImpl);
  const versionOk = !!version && (esperada ? version === esperada : !(marker && marker.producto && marker.producto !== version));
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
  const discoOk = faltan.length === 0 && versionOk && node.ok && node.version === PIN.nodeVersion && sintaxis.every(s => s.ok);
  const clas = clasificarCarpeta(root, fsImpl, esperada);
  return {
    carpeta: clas.estado,
    version,
    versionEsperada: esperada || version || null,
    versionOk,
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
  const root = path.resolve((process.argv[2] && process.argv[2] !== '--ultima' ? process.argv[2] : '') || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
  const conUltima = process.argv.slice(2).includes('--ultima');
  let versionEsperada = null;
  if (conUltima) {
    const u = await ultimaRelease();
    if (!u.ok) { console.log(JSON.stringify({ error: 'no pude leer la última release', detalle: u.error }, null, 1)); process.exit(1); }
    versionEsperada = u.version;
  }
  const r = await comprobar(root, { versionEsperada });
  console.log(JSON.stringify(r, null, 1));
  process.exit(r.enDisco ? 0 : 1);
}
