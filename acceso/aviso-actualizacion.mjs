// Aviso de una versión nueva al abrir Profito. No envía órdenes.
// Si no hay internet o GitHub falla, no dice nada y el arranque sigue.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const API_ULTIMA = 'https://api.github.com/repos/apriai/AI-Profit/releases/latest';
export const TIMEOUT_API_MS = 4000;
export const TIMEOUT_DESCARGA_MS = 120000;
export const NOMBRE_SETUP = 'Profito-Setup.exe';
export const ARCHIVO_AVISO = 'aviso-actualizacion.json';

const HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

export function parseVersion(texto) {
  const m = String(texto ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compararVersiones(local, remota) {
  const a = parseVersion(local);
  const b = parseVersion(remota);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function diaLocal(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function debePreguntar({ local, remota, noEl, hoy }) {
  const cmp = compararVersiones(local, remota);
  if (cmp === null || cmp >= 0) return false;
  if (noEl && hoy && noEl === hoy) return false;
  return true;
}

export function urlDeInstalador(assetUrl) {
  let u;
  try { u = new URL(String(assetUrl || '')); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  if (!HOSTS.has(u.hostname)) return '';
  if (!u.pathname.endsWith('/' + NOMBRE_SETUP)) return '';
  return u.toString();
}

export function releaseUtil(json) {
  const version = String(json?.tag_name || '').replace(/^v/, '');
  if (!parseVersion(version)) return null;
  const asset = (json?.assets || []).find(a => a && a.name === NOMBRE_SETUP);
  const setupUrl = urlDeInstalador(asset?.browser_download_url);
  if (!setupUrl) return null;
  return { version, setupUrl };
}

export function textoAviso(version) {
  return `Hay una versión nueva de Profito (${version}). ¿Actualizar ahora?`;
}

function leerJson(archivo, leer) {
  try {
    const txt = leer(archivo);
    const j = JSON.parse(txt);
    const noEl = typeof j.noEl === 'string' ? j.noEl : '';
    return { noEl };
  } catch {
    return { noEl: '' };
  }
}

export async function revisarActualizacion(opts) {
  const ahora = opts.ahora || (() => new Date());
  const timeoutApi = opts.timeoutApiMs ?? TIMEOUT_API_MS;
  try {
    if (opts.ocupado) return { accion: 'ocupado' };
    const local = String(opts.leerVersion?.() ?? '').trim();
    if (!parseVersion(local)) return { accion: 'silencio' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutApi);
    let json;
    try {
      json = await Promise.race([
        (async () => {
          const res = await opts.fetchImpl(API_ULTIMA, {
            signal: ctrl.signal,
            headers: {
              'User-Agent': 'Profito',
              Accept: 'application/vnd.github+json',
            },
          });
          if (!res || !res.ok) return null;
          return await res.json();
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutApi)),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!json) return { accion: 'silencio' };
    const rel = releaseUtil(json);
    if (!rel) return { accion: 'silencio' };
    const hoy = diaLocal(ahora());
    const estado = leerJson(opts.archivoAviso, opts.leerTexto || (() => { throw new Error('no'); }));
    if (!debePreguntar({ local, remota: rel.version, noEl: estado.noEl, hoy })) return { accion: 'omitido' };
    const respuesta = await opts.preguntar(rel.version);
    if (respuesta === 'no') {
      opts.guardarTexto?.(opts.archivoAviso, JSON.stringify({ noEl: hoy }) + '\n');
      return { accion: 'no', version: rel.version };
    }
    if (respuesta !== 'si') return { accion: 'silencio' };
    const destino = await opts.descargar(rel.setupUrl, rel.version);
    if (!destino) return { accion: 'silencio' };
    await opts.ejecutar(destino);
    await opts.cerrarProfito?.();
    return { accion: 'si', version: rel.version, setup: destino };
  } catch {
    return { accion: 'silencio' };
  }
}

function rutaAviso(root) {
  return path.join(root, 'datos', ARCHIVO_AVISO);
}

async function fetchConTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Profito', Accept: 'application/octet-stream' },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function descargarSetup(url, version) {
  const segura = urlDeInstalador(url);
  if (!segura) return '';
  const res = await fetchConTimeout(segura, TIMEOUT_DESCARGA_MS);
  if (!res.ok) return '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5_000_000) return '';
  const destino = path.join(os.tmpdir(), `Profito-Setup-${version}.exe`);
  fs.writeFileSync(destino, buf);
  return destino;
}

function preguntarConScript(version, script) {
  return new Promise(resolve => {
    let out = '';
    const child = spawn('powershell.exe', [
      '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
      '-File', script, '-Version', version,
    ], { windowsHide: false, stdio: ['ignore', 'pipe', 'ignore'] });
    const timer = setTimeout(() => { try { child.kill(); } catch {} resolve('silencio'); }, 10 * 60 * 1000);
    child.stdout.on('data', c => { out += c.toString('utf8'); });
    child.on('error', () => { clearTimeout(timer); resolve('silencio'); });
    child.on('close', () => {
      clearTimeout(timer);
      const t = out.trim().toLowerCase();
      if (t === 'si' || t === 'yes') resolve('si');
      else if (t === 'no') resolve('no');
      else resolve('silencio');
    });
  });
}

function ejecutarSetup(destino) {
  const child = spawn(destino, [], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
}

function cerrarProfito() {
  try {
    execFileSync('taskkill.exe', ['/F', '/IM', 'AI Profit.exe'], {
      windowsHide: true, timeout: 8000, stdio: 'ignore',
    });
  } catch { /* si no esta el acceso compilado, el .cmd mira el codigo 20 */ }
}

export async function avisarSiHaceFalta(root) {
  if (process.platform !== 'win32') return { accion: 'silencio' };
  const archivo = rutaAviso(root);
  return revisarActualizacion({
    leerVersion: () => fs.readFileSync(path.join(root, 'VERSION'), 'utf8'),
    leerTexto: f => fs.readFileSync(f, 'utf8'),
    guardarTexto: (f, txt) => {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, txt);
    },
    archivoAviso: archivo,
    fetchImpl: (url, init) => fetch(url, init),
    preguntar: version => preguntarConScript(version, path.join(path.dirname(fileURLToPath(import.meta.url)), 'aviso-actualizacion.ps1')),
    descargar: descargarSetup,
    ejecutar: async destino => { ejecutarSetup(destino); },
    cerrarProfito: async () => { cerrarProfito(); },
  });
}
