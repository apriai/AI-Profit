// Elige el navegador de la granja. Si el predeterminado es Chrome, Edge o Brave,
// se usa ese. Si no, Chrome y después Edge. Si no hay ninguno, no imprime nada.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CROMIUM = new Set(['chrome.exe', 'msedge.exe', 'brave.exe']);

export function exeDeComando(comando) {
  const s = String(comando || '').trim();
  if (!s) return '';
  if (s.startsWith('"')) {
    const fin = s.indexOf('"', 1);
    return fin > 1 ? s.slice(1, fin) : '';
  }
  const espacio = s.search(/\s/);
  return espacio === -1 ? s : s.slice(0, espacio);
}

export function esChromium(exe) {
  return CROMIUM.has(path.win32.basename(String(exe || '')).toLowerCase());
}

function unir(base, ...partes) {
  if (!base) return '';
  return path.win32.join(base, ...partes);
}

export function rutasChrome(env = process.env) {
  return [
    unir(env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    unir(env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    unir(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
}

export function rutasEdge(env = process.env) {
  return [
    unir(env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    unir(env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    unir(env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
}

export function elegirNavegador({ comando = '', existe = () => false, env = process.env } = {}) {
  const propio = exeDeComando(comando);
  if (propio && esChromium(propio) && existe(propio)) return propio;
  for (const ruta of [...rutasChrome(env), ...rutasEdge(env)]) {
    if (existe(ruta)) return ruta;
  }
  return '';
}

function valorRegistro(clave, nombre) {
  const args = nombre ? ['query', clave, '/v', nombre] : ['query', clave, '/ve'];
  let out = '';
  try {
    out = execFileSync('reg', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
  const linea = out.split(/\r?\n/).find(l => /REG_\w+/.test(l));
  if (!linea) return '';
  const m = /REG_\w+\s+(.*)$/.exec(linea.trim());
  return m ? m[1].trim() : '';
}

function comandoDelPredeterminado() {
  const prog = valorRegistro('HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice', 'ProgId');
  if (!prog || /[\\/"]/.test(prog)) return '';
  const sufijo = `${prog}\\shell\\open\\command`;
  return valorRegistro(`HKCU\\Software\\Classes\\${sufijo}`)
    || valorRegistro(`HKLM\\Software\\Classes\\${sufijo}`);
}

function resolver() {
  return elegirNavegador({ comando: comandoDelPredeterminado(), existe: p => { try { return fs.existsSync(p); } catch { return false; } } });
}

const propio = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (propio) {
  try {
    const exe = resolver();
    if (exe) console.log(exe);
  } catch { /* sin navegador: el acceso abre la dirección */ }
}
