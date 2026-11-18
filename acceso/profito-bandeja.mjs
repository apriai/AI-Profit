// Lógica de la bandeja, la pantalla de carga y el apagado.
// La ventana la dibuja acceso/profito-bandeja.ps1 (NotifyIcon, sin consola).
// No envía órdenes y no cierra TradingView.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anexar, carpetaLogs } from './profito-log.mjs';

export const TOOLTIP = 'AI Profit';
export const TITULO_CARGA = 'Cargando Profito…';
export const MUTEX = 'Local\\ProfitoBandeja';
export const LIMITE_CARGA_MS = 60_000;
export const MENU = [
  { id: 'abrir', texto: 'Abrir granja' },
  { id: 'estado', texto: 'Estado' },
  { id: 'logs', texto: 'Ver logs' },
  { id: 'cerrar', texto: 'Cerrar Profito' },
];

// El instalador muestra la 1, luego la 2 y al final la 4.
// La carga gira en otro orden e incluye la 3, que el instalador no pone en pantalla.
export const ORDEN_INSTALADOR = ['1-escenario.jpg', '2-multitud-islas.jpg', '4-isla-granja.jpg'];
export const ORDEN_CARGA = ['3-granja-cerca.jpg', '1-escenario.jpg', '4-isla-granja.jpg', '2-multitud-islas.jpg'];
export const LOGO_CARGA = 'propfarm-logo.png';

export const PASOS = {
  servidor: 'Encendiendo servidor…',
  tv: 'Conectando TradingView…',
  granja: 'Abriendo granja…',
};

export function textoCarga(paso, ms, limite = LIMITE_CARGA_MS) {
  const base = PASOS[paso] || PASOS.servidor;
  if (Number(ms) < limite) return base;
  return `Sigue pendiente: ${base} La granja se abrirá sola cuando termine.`;
}

export function debeMostrarCarga(yaHayBandeja) {
  return !yaHayBandeja;
}

export function textoEstado(c = {}) {
  return [
    'Servidor: ' + (c.servidor ? 'en marcha' : 'apagado'),
    'TradingView: ' + (c.tradingview ? 'conectado' : 'sin conexión'),
    'Tradovate: ' + (c.tradovate ? 'conectado' : 'sin conexión'),
  ].join('\n');
}

export function argsNavegador(perfil) {
  return [
    '--autoplay-policy=no-user-gesture-required',
    '--app=http://localhost:8787/Granja-de-Cuentas-v2.html',
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
}

export function perfilNavegador(env = process.env) {
  if (env.LOCALAPPDATA) return path.win32.join(env.LOCALAPPDATA, 'Profito', 'navegador');
  return path.win32.join(env.TEMP || env.TMP || 'C:\\Temp', 'Profito-navegador');
}

// Cerrar Profito mata solo lo que Profito arrancó. Nunca TradingView ni las órdenes.
export function esProcesoNuestro(proc, root) {
  const nombre = String(proc.nombre || '').toLowerCase();
  const linea = String(proc.linea || '').toLowerCase();
  const carpeta = String(root || '').toLowerCase();
  if (nombre.includes('tradingview')) return false;
  if (linea.includes('tradingview.exe') && !linea.includes('abrir-tradingview.ps1') && !linea.includes('lanzar-tradingview')) return false;
  if (carpeta && !linea.includes(carpeta)) return false;
  if (nombre.includes('node')) {
    return linea.includes('tradinglink.mjs') || linea.includes('profito-bandeja.mjs');
  }
  if (nombre.includes('powershell') || nombre.includes('pwsh')) {
    return linea.includes('profito-bandeja.ps1');
  }
  if (nombre.includes('wscript')) {
    return linea.includes('ai profit.vbs');
  }
  return false;
}

export function planCerrar(procesos, { incluirBandeja = false, self = 0, root = '' } = {}) {
  const nodos = [];
  const bandeja = [];
  const vistos = new Set();
  for (const p of procesos || []) {
    if (!p || !p.pid || p.pid === self || vistos.has(p.pid)) continue;
    const nombre = String(p.nombre || '').toLowerCase();
    if (nombre.includes('tradingview')) continue;
    if (p.nuestro === false) continue;
    if (!esProcesoNuestro(p, root) && p.nuestro !== true) continue;
    vistos.add(p.pid);
    const esBandeja = nombre.includes('powershell') || nombre.includes('pwsh') || nombre.includes('wscript');
    if (esBandeja) {
      if (incluirBandeja) bandeja.push(p.pid);
      continue;
    }
    nodos.push(p.pid);
  }
  return { nodos, bandeja, tradingview: false, ordenes: false };
}

export function parseProcesos(texto) {
  const out = [];
  for (const linea of String(texto || '').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('pid|')) continue;
    const a = t.indexOf('|');
    const b = t.indexOf('|', a + 1);
    if (a < 1 || b < 0) continue;
    const pid = Number(t.slice(0, a));
    if (!pid) continue;
    out.push({ pid, nombre: t.slice(a + 1, b), linea: t.slice(b + 1) });
  }
  return out;
}

function pedir(ruta, ms = 4000) {
  return new Promise(resolve => {
    const q = http.get({ host: '127.0.0.1', port: 8787, path: ruta, timeout: ms }, r => {
      let b = '';
      r.setEncoding('utf8');
      r.on('data', c => { if (b.length < 200000) b += c; });
      r.on('end', () => resolve({ ok: r.statusCode >= 200 && r.statusCode < 500, code: r.statusCode, body: b }));
    });
    q.on('timeout', () => { q.destroy(); resolve({ ok: false, err: 'timeout' }); });
    q.on('error', e => resolve({ ok: false, err: e.code || String(e) }));
  });
}

export async function leerEstadoHttp() {
  const r = await pedir('/api/colchon/conexion', 6000);
  if (!r.ok) return textoEstado({});
  try { return textoEstado(JSON.parse(r.body)); } catch { return textoEstado({}); }
}

const AQUI = path.dirname(fileURLToPath(import.meta.url));

function logLinea(nombre, texto) {
  try { anexar(path.join(carpetaLogs(), nombre), `${new Date().toISOString()} ${texto}\n`); } catch {}
}

async function main() {
  const cmd = process.argv[2] || '';
  if (cmd === 'texto-carga') {
    const paso = process.argv[3] || 'servidor';
    const ms = Number(process.argv[4] || 0);
    process.stdout.write(textoCarga(paso, ms));
    return;
  }
  if (cmd === 'estado') {
    process.stdout.write(await leerEstadoHttp());
    return;
  }
  if (cmd === 'logs') {
    const dir = carpetaLogs();
    fs.mkdirSync(dir, { recursive: true });
    process.stdout.write(dir);
    return;
  }
  if (cmd === 'servir') {
    const root = process.argv[3] || path.resolve(AQUI, '..');
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, [path.join(root, 'motor', 'tradinglink.mjs')], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = path.join(carpetaLogs(), 'servidor.log');
    const escribir = buf => { try { anexar(log, buf.toString('utf8')); } catch {} };
    child.stdout.on('data', escribir);
    child.stderr.on('data', escribir);
    const pidFile = path.join(carpetaLogs(), 'servidor.pid');
    try { fs.writeFileSync(pidFile, String(child.pid)); } catch {}
    const matarHijo = () => { try { child.kill(); } catch {} };
    process.on('SIGTERM', matarHijo);
    process.on('SIGINT', matarHijo);
    child.on('exit', code => {
      try { fs.rmSync(pidFile, { force: true }); } catch {}
      process.exitCode = code || 0;
    });
    return;
  }
  if (cmd === 'cerrar' || cmd === 'parar-instalador') {
    const root = process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : path.resolve(AQUI, '..');
    const incluirBandeja = cmd === 'parar-instalador' || process.argv.includes('--bandeja');
    if (cmd === 'parar-instalador') {
      const r = await pedir('/api/colchon/status', 4000);
      if (r.ok) {
        let j = null;
        try { j = JSON.parse(r.body); } catch {}
        if (!j || typeof j.state !== 'string' || j.state === 'running') {
          logLinea('lanzador.log', 'instalador: no apago, hay un trade o no pude comprobarlo');
          process.exitCode = 30;
          return;
        }
      } else if (r.err && r.err !== 'ECONNREFUSED') {
        logLinea('lanzador.log', 'instalador: estado desconocido, no apago');
        process.exitCode = 30;
        return;
      }
    }
    if (process.platform !== 'win32') {
      logLinea('lanzador.log', 'cerrar: no es Windows, no hay procesos que parar');
      return;
    }
    const { execFileSync } = await import('node:child_process');
    let texto = '';
    try {
      texto = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        "Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessId, $_.Name, (($_.CommandLine) -replace '\\|','/') }"
      ], { windowsHide: true, encoding: 'utf8', timeout: 15000 });
    } catch { texto = ''; }
    const rootNorm = path.win32.resolve(root);
    const plan = planCerrar(parseProcesos(texto), { incluirBandeja, self: process.pid, root: rootNorm });
    for (const pid of plan.nodos) {
      try { execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
    }
    for (const pid of plan.bandeja) {
      try { execFileSync('taskkill.exe', ['/PID', String(pid), '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
    }
    logLinea('lanzador.log', `cerrar nodos=${plan.nodos.join(',') || 'ninguno'} bandeja=${plan.bandeja.join(',') || 'ninguno'}`);
    return;
  }
}

const esCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCli) main().catch(e => { console.error(e && e.message || e); process.exitCode = 1; });
