// Arma el zip de soporte: logs de Profito y un status.json. No envía órdenes.
// No mete claves ni tokens: los borra antes de guardar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';

const SECRETOS = /password|passwd|token|secret|credential|authorization|cookie|api[_-]?key|clave|bearer/i;

export function nombreZip(fecha = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `Profito-logs-${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}_${p(fecha.getHours())}${p(fecha.getMinutes())}.zip`;
}

export function esArchivoLog(nombre) {
  return nombre.endsWith('.log') || /\.log\.\d+$/.test(nombre);
}

export function listarLogs(dir) {
  let nombres = [];
  try { nombres = fs.readdirSync(dir); } catch { return []; }
  return nombres.filter(esArchivoLog).sort().map(n => path.join(dir, n)).filter(f => {
    try { return fs.statSync(f).isFile(); } catch { return false; }
  });
}

export function redactar(valor, clave = '') {
  if (SECRETOS.test(String(clave))) return '[redactado]';
  if (typeof valor === 'string') {
    return valor
      .replace(/(bearer\s+)\S+/gi, '$1[redactado]')
      .replace(/((?:password|passwd|token|secret|api[_-]?key|authorization|clave)\s*[:=]\s*)\S+/gi, '$1[redactado]');
  }
  if (Array.isArray(valor)) return valor.map(v => redactar(v));
  if (valor && typeof valor === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(valor)) out[k] = redactar(v, k);
    return out;
  }
  return valor;
}

function cuentaEstado(a) {
  if (!a || typeof a !== 'object') return null;
  return redactar({
    id: a.id ?? null,
    type: a.type ?? null,
    plan: a.plan ?? null,
    balance: a.balance ?? null,
    equity: a.equity ?? null,
    dayPnl: a.dayPnl ?? null,
    totalPnl: a.totalPnl ?? null,
    peak: a.peak ?? null,
    floor: a.floor ?? null,
    dd: a.dd ?? null,
    dailyLoss: a.dailyLoss ?? null,
    locked: a.locked ?? null,
    breached: a.breached ?? null,
    burned: a.burned ?? null,
    stale: a.stale ?? null,
    tradingDay: a.tradingDay ?? null,
  });
}

export function armarStatus(info = {}) {
  const cuentas = info.cuentas && typeof info.cuentas === 'object' ? Object.values(info.cuentas).map(cuentaEstado).filter(Boolean) : [];
  return redactar({
    version: info.version || null,
    os: { platform: os.platform(), release: os.release(), arch: os.arch() },
    timestamp: (info.ahora || new Date()).toISOString(),
    conexion: info.conexion || null,
    cuentas,
    granja: {
      resumenTradingView: info.resumenTradingView !== false,
      colchon: info.colchon || null,
      toggles: info.toggles || null,
    },
  });
}

function crc32(buf) {
  const n = zlib.crc32(buf);
  return n >>> 0;
}

export function empaquetar(archivos) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const f of archivos) {
    const name = Buffer.from(String(f.name).replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data ?? ''), 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locales.push(local, name, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    centrales.push(cen, name);
    offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, central, fin]);
}

export function carpetaDescargas() {
  if (process.platform === 'win32') {
    return new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-Command', "$p=(New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; if(-not $p){$p=Join-Path $env:USERPROFILE 'Downloads'}; Write-Output $p"], { timeout: 4000, windowsHide: true }, (err, out) => {
        const conocida = String(out || '').trim().split(/\r?\n/).pop();
        if (!err && conocida) return resolve(conocida);
        const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
        resolve(path.join(home, 'Downloads'));
      });
    });
  }
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  return Promise.resolve(path.join(home, 'Downloads'));
}

export async function crearPaqueteLogs(opts = {}) {
  const ahora = opts.ahora || new Date();
  const nombre = nombreZip(ahora);
  const destino = opts.destino || await carpetaDescargas();
  fs.mkdirSync(destino, { recursive: true });
  const logs = listarLogs(opts.dir);
  const piezas = logs.map(f => ({
    name: 'logs/' + path.basename(f),
    data: Buffer.from(redactar(fs.readFileSync(f, 'utf8')), 'utf8'),
  }));
  let conexion = opts.conexion || null;
  if (typeof conexion === 'function') {
    try { conexion = await conexion(); } catch (e) { conexion = { error: String(e && e.message || e) }; }
  }
  const status = armarStatus({ ...opts, conexion, ahora });
  piezas.push({ name: 'status.json', data: Buffer.from(JSON.stringify(status, null, 2), 'utf8') });
  const ruta = path.join(destino, nombre);
  fs.writeFileSync(ruta, empaquetar(piezas));
  return { ok: true, path: ruta, nombre, aviso: `Guardado en Descargas: ${nombre}` };
}
