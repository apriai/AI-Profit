// Registro de Profito. Va a %LOCALAPPDATA%\Profito\datos\logs y rota solo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MAX_BYTES = 1024 * 1024;
export const CONSERVAR = 5;

export function carpetaLogs(env = process.env) {
  const base = env.LOCALAPPDATA
    || (env.USERPROFILE ? path.win32.join(env.USERPROFILE, 'AppData', 'Local') : path.join(os.homedir(), 'AppData', 'Local'));
  return path.win32.join(base, 'Profito', 'datos', 'logs');
}

export function rotar(archivo, opts = {}) {
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  const conservar = opts.conservar ?? CONSERVAR;
  const stat = opts.stat || (p => fs.statSync(p));
  const rename = opts.rename || ((a, b) => fs.renameSync(a, b));
  const unlink = opts.unlink || (p => fs.rmSync(p, { force: true }));
  const exists = opts.exists || (p => { try { return fs.existsSync(p); } catch { return false; } });
  let size = 0;
  try { size = stat(archivo).size; } catch { return false; }
  if (size < maxBytes) return false;
  const ultimo = `${archivo}.${conservar}`;
  if (exists(ultimo)) unlink(ultimo);
  for (let i = conservar - 1; i >= 1; i--) {
    const desde = `${archivo}.${i}`;
    if (exists(desde)) rename(desde, `${archivo}.${i + 1}`);
  }
  rename(archivo, `${archivo}.1`);
  return true;
}

export function anexar(archivo, texto, opts = {}) {
  const mkdir = opts.mkdir || (d => fs.mkdirSync(d, { recursive: true }));
  const append = opts.append || ((p, t) => fs.appendFileSync(p, t));
  mkdir(path.dirname(archivo));
  rotar(archivo, opts);
  append(archivo, texto);
  return archivo;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('acceso', 'profito-log.mjs')) && process.argv[2] === 'anexar') {
  const nombre = process.argv[3] || 'lanzador.log';
  const linea = process.argv.slice(4).join(' ');
  const archivo = path.join(carpetaLogs(), path.basename(nombre));
  anexar(archivo, `${new Date().toISOString()} ${linea}\n`);
}
