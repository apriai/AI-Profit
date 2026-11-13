// Ayudante del instalador y del acceso "AI Profit" (solo Windows).
// Lee el estado de la PC y lo escribe en un .ini (UTF-16) que el instalador lee.
// No envia ordenes, no abre ni cierra posiciones y no hace clic en TradingView.
// Uso:
//   node profito-estado.mjs estado <ini> [carpetaInstalacion]
//   node profito-estado.mjs esperar-servidor <ini> <segundos> [carpetaInstalacion]
//   node profito-estado.mjs esperar-tv <ini> <segundos> [carpetaInstalacion]
//   node profito-estado.mjs parar <ini> <carpetaInstalacion>
//     -> apaga SOLO el node.exe de esa carpeta que escucha en 8787, y solo si no hay operacion en curso.
//   node profito-estado.mjs abrir
//     -> relanza TradingView con el puerto 9222 (mismo metodo que abrir-tradingview.ps1).
//   node profito-estado.mjs aviso <ini> <carpeta>
//     -> si hay versión nueva, pregunta. Código 20: ya se abrió el instalador; no sigas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { avisarSiHaceFalta } from './aviso-actualizacion.mjs';

const SRV = 8787, TVP = 9222;
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LANZADOR = path.join(AQUI, 'lanzar-tradingview.cmd');
const [, , cmd = 'estado', iniFile, a3, a4] = process.argv;
const win = path.win32;

export function esRutaWindowsApps(ruta) {
  return /\\windowsapps\\/i.test(String(ruta || ''));
}

export function esAliasEjecucion(ruta) {
  return /\\microsoft\\windowsapps\\tradingview\.exe$/i.test(String(ruta || ''));
}

function exeEnCarpeta(dir) {
  const limpio = String(dir || '').trim().replace(/[\\/]+$/, '');
  if (!limpio) return '';
  return win.join(limpio, 'TradingView.exe');
}

// Mismo orden que Get-DeteccionTv en acceso/abrir-tradingview.ps1.
// La carpeta WindowsApps niega existsSync: la InstallLocation del paquete se acepta igual.
export function elegirTv(info = {}) {
  const existe = info.existe || (() => false);
  for (const f of info.clasicas || []) {
    if (f && !esRutaWindowsApps(f) && !esAliasEjecucion(f) && existe(f)) return { ruta: f, tipo: 'clasico' };
  }
  if (info.alias && existe(info.alias)) return { ruta: info.alias, tipo: 'alias' };
  const dePaquete = exeEnCarpeta(info.appx);
  if (dePaquete) return { ruta: dePaquete, tipo: 'msix' };
  if (info.proceso) {
    return { ruta: info.proceso, tipo: esRutaWindowsApps(info.proceso) || esAliasEjecucion(info.proceso) ? 'msix' : 'proceso' };
  }
  for (const w of info.where || []) {
    const linea = String(w || '').trim();
    if (!linea) continue;
    if (esAliasEjecucion(linea)) return { ruta: linea, tipo: 'alias' };
    if (esRutaWindowsApps(linea) || existe(linea)) {
      return { ruta: linea, tipo: esRutaWindowsApps(linea) ? 'msix' : 'clasico' };
    }
  }
  for (const f of info.registro || []) {
    if (f && !esRutaWindowsApps(f) && !esAliasEjecucion(f) && existe(f)) return { ruta: f, tipo: 'clasico' };
  }
  return { ruta: '', tipo: 'ninguno' };
}

// El .exe de AI Profit hace un solo ShellExecute de tvexe. En MSIX ese exe
// directo suele dar acceso denegado, asi que tvexe apunta al .cmd, que prueba
// alias, activacion del paquete y el exe de WindowsApps. Si el proceso ya
// esta abierto y no hay ruta, tambien apunta al .cmd: el acceso reinicia
// TradingView en vez de abrir la pagina de descarga.
export function tvexeParaLanzador(eleccion, lanzador, abierto) {
  if (eleccion.tipo === 'clasico' && eleccion.ruta) return eleccion.ruta;
  const hay = eleccion.tipo !== 'ninguno' || !!abierto;
  if (hay && lanzador) return lanzador;
  return eleccion.ruta || '';
}

function get(port, ruta, ms = 2000) {
  return new Promise(res => {
    const q = http.get({ host: '127.0.0.1', port, path: ruta, timeout: ms }, r => {
      let b = ''; r.setEncoding('utf8'); r.on('data', c => { if (b.length < 200000) b += c; }); r.on('end', () => res({ ok: true, code: r.statusCode, body: b }));
    });
    q.on('timeout', () => { q.destroy(); res({ ok: false, err: 'timeout' }); });
    q.on('error', e => res({ ok: false, err: e.code || String(e) }));
  });
}

function run(exe, args, ms = 8000) {
  try {
    const b = execFileSync(exe, args, { windowsHide: true, timeout: ms, stdio: ['ignore', 'pipe', 'ignore'] });
    // wmic y otros escriben UTF-16 cuando la salida no es una consola
    let txt = b.length > 1 && b.subarray(0, 200).filter(x => x === 0).length > 20 ? b.toString('utf16le') : b.toString('utf8');
    return txt.replace(/^\uFEFF/, '');
  } catch { return ''; }
}

function pidEnPuerto(port) {
  const out = run('netstat', ['-ano', '-p', 'TCP']);
  for (const l of out.split(/\r?\n/)) {
    const c = l.trim().split(/\s+/);
    if (c.length < 5 || c[0].toUpperCase() !== 'TCP') continue;
    if (!c[1].endsWith(':' + port)) continue;
    if (!/^(0\.0\.0\.0:0|\[::\]:0|\*:\*)$/.test(c[2])) continue;
    const pid = Number(c[c.length - 1]); if (pid > 0) return pid;
  }
  return 0;
}
function rutaDeProceso(pid) {
  if (!pid) return '';
  const p = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path`]).trim();
  if (p) return p;
  const t = run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
  const m = /^"([^"]+)"/m.exec(t); return m ? m[1] : '';
}
function tvAbierto() { return /tradingview\.exe/i.test(run('tasklist', ['/FI', 'IMAGENAME eq TradingView.exe', '/FO', 'CSV', '/NH'])); }

function leerSondaTv() {
  const script = [
    "$appx = (Get-AppxPackage -Name 'TradingView.Desktop' -ErrorAction SilentlyContinue | Select-Object -First 1).InstallLocation",
    "if (-not $appx) { $hit = @(Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*TradingView*' } | Select-Object -First 1); if ($hit) { $appx = $hit.InstallLocation } }",
    "$proc = (Get-CimInstance Win32_Process -Filter \"Name = 'TradingView.exe'\" -ErrorAction SilentlyContinue | Select-Object -First 1).ExecutablePath",
    "$reg = ''",
    "$bases = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
    "foreach ($base in $bases) { if ($reg) { break }; Get-ItemProperty -Path $base -ErrorAction SilentlyContinue | ForEach-Object { if ($reg) { return }; if ([string]$_.DisplayName -notmatch 'TradingView') { return }; $icon = (([string]$_.DisplayIcon -replace '\"','' ) -split ',')[0].Trim(); $loc = ''; if ($_.InstallLocation) { $loc = Join-Path ([string]$_.InstallLocation) 'TradingView.exe' }; foreach ($c in @($icon, $loc)) { if ($c -match 'TradingView\\.exe$' -and $c -notmatch '\\\\WindowsApps\\\\' -and (Test-Path -LiteralPath $c)) { $reg = $c } } } }",
    "'APPX=' + [string]$appx",
    "'PROC=' + [string]$proc",
    "'REG=' + [string]$reg",
  ].join('; ');
  const txt = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 15000);
  const out = { appx: '', proceso: '', registro: '' };
  for (const linea of txt.split(/\r?\n/)) {
    const m = /^(APPX|PROC|REG)=(.*)$/.exec(linea.trim());
    if (!m) continue;
    const valor = m[2].trim();
    if (m[1] === 'APPX') out.appx = valor;
    else if (m[1] === 'PROC') out.proceso = valor;
    else out.registro = valor;
  }
  return out;
}

export function buscarTV(env = process.env, fsImpl = fs) {
  if (process.platform !== 'win32') return { ruta: '', tipo: 'ninguno' };
  const clasicas = [];
  if (env.LOCALAPPDATA) {
    clasicas.push(win.join(env.LOCALAPPDATA, 'TradingView', 'TradingView.exe'));
    clasicas.push(win.join(env.LOCALAPPDATA, 'Programs', 'TradingView', 'TradingView.exe'));
  }
  if (env.ProgramFiles) clasicas.push(win.join(env.ProgramFiles, 'TradingView', 'TradingView.exe'));
  if (env['ProgramFiles(x86)']) clasicas.push(win.join(env['ProgramFiles(x86)'], 'TradingView', 'TradingView.exe'));
  const alias = env.LOCALAPPDATA ? win.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'TradingView.exe') : '';
  const sonda = leerSondaTv();
  const where = run('where.exe', ['TradingView.exe']).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return elegirTv({
    existe: f => { try { return fsImpl.existsSync(f); } catch { return false; } },
    clasicas, alias, appx: sonda.appx, proceso: sonda.proceso, where,
    registro: sonda.registro ? [sonda.registro] : [],
  });
}

function nuestrosNodos(dir) {
  if (!dir) return [];
  const meta = path.resolve(dir, 'node-win', 'node.exe').toLowerCase(), out = [];
  let txt = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { \"$($_.Id)|$($_.Path)\" }"]);
  let filas = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return [Number(l.slice(0, i)), l.slice(i + 1)]; });
  if (!filas.length) {
    txt = run('wmic', ['process', 'get', 'ExecutablePath,ProcessId']);
    filas = txt.split(/\r?\n/).map(l => /^(.*?node\.exe)\s+(\d+)\s*$/i.exec(l.trim())).filter(Boolean).map(m => [Number(m[2]), m[1]]);
  }
  for (const [pid, ruta] of filas) if (pid && pid !== process.pid && ruta && path.resolve(ruta).toLowerCase() === meta) out.push(pid);
  return out;
}

async function servidor(dir) {
  const r = await get(SRV, '/api/colchon/status', 4000);
  if (!r.ok && r.err === 'ECONNREFUSED') return { servidor: 'libre' };
  let j = null; if (r.ok) { try { j = JSON.parse(r.body); } catch {} }
  const esProfito = !!(j && typeof j.state === 'string');
  const pid = pidEnPuerto(SRV), ruta = rutaDeProceso(pid), nuestros = nuestrosNodos(dir);
  const meta = dir ? path.resolve(dir, 'node-win', 'node.exe').toLowerCase() : '';
  const nuestro = ruta ? path.resolve(ruta).toLowerCase() === meta : nuestros.length > 0;
  const base = { servidor_pid: pid || nuestros.join(' '), servidor_ruta: ruta || (nuestro ? meta : ''), servidor_nuestro: nuestro ? 1 : 0, nuestros: nuestros.join(' ') };
  if (!r.ok) {
    if (!pid && !nuestros.length) return { servidor: 'libre' };
    if (nuestro) return { servidor: 'profito', operacion: 'desconocida', ...base };
    return { servidor: 'otro', ...base };
  }
  if (!esProfito) return { servidor: 'otro', ...base };
  return { servidor: 'profito', operacion: j.state === 'running' ? 'en-curso' : 'ninguna', ...base };
}

async function tv() {
  const r = await get(TVP, '/json/version');
  if (!r.ok) {
    if (r.err !== 'ECONNREFUSED' && pidEnPuerto(TVP)) { const pid = pidEnPuerto(TVP); return { tv: 'otro', tv_pid: pid, tv_ruta: rutaDeProceso(pid) }; }
    return { tv: 'libre' };
  }
  let esTV = /tradingview/i.test(r.body);
  if (!esTV) { const l = await get(TVP, '/json/list'); esTV = l.ok && /tradingview\.com/i.test(l.body); }
  if (!esTV) { const pid = pidEnPuerto(TVP), ruta = rutaDeProceso(pid); esTV = /tradingview/i.test(ruta); if (!esTV) return { tv: 'otro', tv_pid: pid, tv_ruta: ruta }; }
  return { tv: 'tradingview' };
}

function escribir(o) {
  const txt = '[estado]\r\n' + Object.entries(o).map(([k, v]) => `${k}=${String(v ?? '').replace(/[\r\n]/g, ' ')}`).join('\r\n') + '\r\n';
  const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(txt, 'utf16le')]);
  if (iniFile) fs.writeFileSync(iniFile, buf); else process.stdout.write(txt);
}
const dormir = ms => new Promise(r => setTimeout(r, ms));

function lanzadorDisponible() {
  try { return fs.existsSync(LANZADOR) ? LANZADOR : ''; } catch { return ''; }
}

async function ofrecerActualizacion(dir) {
  const root = dir || path.resolve(AQUI, '..');
  let ocupado = false;
  try {
    const s = await servidor(root);
    ocupado = s.operacion === 'en-curso' || s.operacion === 'desconocida';
  } catch { ocupado = false; }
  if (ocupado) return { accion: 'ocupado' };
  return avisarSiHaceFalta(root);
}

async function main() {
  if (cmd === 'aviso' || cmd === 'estado') {
    const dir = cmd === 'estado' ? (a3 || path.resolve(AQUI, '..')) : (a3 || path.resolve(AQUI, '..'));
    const aviso = await ofrecerActualizacion(dir);
    if (aviso.accion === 'si') {
      if (iniFile) escribir({ actualizar: 'si', listo: 1 });
      process.exitCode = 20;
      return;
    }
    if (cmd === 'aviso') {
      if (iniFile) escribir({ actualizar: aviso.accion, listo: 1 });
      return;
    }
  }
  if (cmd === 'estado') {
    const dir = a3 || '';
    const eleccion = buscarTV();
    const abierto = tvAbierto();
    const tvexe = tvexeParaLanzador(eleccion, lanzadorDisponible(), abierto);
    escribir({ ...(await servidor(dir)), ...(await tv()), tvabierto: abierto ? 1 : 0, tvexe, tv_ruta: eleccion.ruta, tv_tipo: eleccion.tipo, listo: 1 });
  } else if (cmd === 'abrir') {
    const r = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(AQUI, 'abrir-tradingview.ps1'), '-Port', '9222'], { stdio: 'inherit' });
    void r;
  } else if (cmd === 'esperar-servidor') {
    const fin = Date.now() + 1000 * Number(a3 || 25); let s;
    do { s = await servidor(a4 || ''); if (s.servidor !== 'libre') break; await dormir(1000); } while (Date.now() < fin);
    escribir({ ...s, listo: 1 });
  } else if (cmd === 'esperar-tv') {
    const fin = Date.now() + 1000 * Number(a3 || 40); let t;
    do { t = await tv(); if (t.tv === 'tradingview') break; await dormir(1500); } while (Date.now() < fin);
    escribir({ ...t, listo: 1 });
  } else if (cmd === 'parar') {
    const dir = a3; const s = await servidor(dir);
    if (s.servidor !== 'profito') return escribir({ ...s, parado: s.servidor === 'libre' ? 1 : 0, listo: 1 });
    if (s.operacion !== 'ninguna') {
      escribir({ ...s, parado: 0, motivo: 'operacion', listo: 1 });
      process.exitCode = 30;
      return;
    }
    if (!s.servidor_nuestro) return escribir({ ...s, parado: 0, motivo: 'otra-carpeta', listo: 1 });
    const pids = s.servidor_ruta && pidEnPuerto(SRV) ? [pidEnPuerto(SRV)] : String(s.nuestros || '').split(' ').filter(Boolean).map(Number);
    for (const p of pids) { try { process.kill(p); } catch {} }
    for (let i = 0; i < 20; i++) { await dormir(500); if ((await get(SRV, '/', 800)).ok === false) return escribir({ ...s, parado: 1, listo: 1 }); }
    escribir({ ...s, parado: 0, motivo: 'no-se-apago', listo: 1 });
  } else { escribir({ error: 'comando desconocido', listo: 0 }); process.exitCode = 2; }
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) main().catch(e => { escribir({ error: String(e && e.message || e), listo: 0 }); process.exitCode = 1; });
