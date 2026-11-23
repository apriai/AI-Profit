// Saldo al empezar la sesión (16:00 ET → 16:00 ET) y el P&L neto de esa cuenta.
// El neto es el saldo de ahora menos ese saldo inicial: el saldo ya trae las comisiones.
// No envía órdenes. El archivo con los saldos vive en la carpeta de datos y no se sube.
import fs from 'node:fs';
import path from 'node:path';

const ARCHIVO = 'sesion-saldo.json';
const r2 = x => Math.round(x * 100) / 100;

export function diaSesion(t = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  if ((+p.hour % 24) >= 16) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function mismaCuenta(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!x || !y) return false;
  if (x === y) return true;
  const mask = s => s.replace(/\b([A-Za-z][A-Za-z0-9]{3})[A-Za-z0-9]{4,}([A-Za-z0-9]{3})\b/g, '$1…$2');
  return mask(x) === y || mask(y) === x || mask(x) === mask(y);
}

// Un trade sirve para reconstruir el inicio solo si el bróker lo dio cerrado y neto.
// Un aproximado (la lectura de ejecuciones se quedó a medias) o un pnl vacío no sirve.
export function tradeFiable(t) {
  if (!t || typeof t !== 'object') return false;
  if (t.aprox === true) return false;
  if (typeof t.pnl !== 'number' || !Number.isFinite(t.pnl)) return false;
  if (t.granja === true) return false;
  return t.fuente === 'broker';
}

export function inicioReconstruido(balance, trades) {
  if (typeof balance !== 'number' || !Number.isFinite(balance)) return null;
  if (!Array.isArray(trades) || !trades.length) return null;
  if (!trades.every(tradeFiable)) return null;
  return r2(balance - trades.reduce((a, t) => a + t.pnl, 0));
}

function inicioPara(inicios, id) {
  if (!inicios || !id) return null;
  if (typeof inicios[id] === 'number' && Number.isFinite(inicios[id])) return inicios[id];
  for (const k of Object.keys(inicios)) if (mismaCuenta(k, id) && typeof inicios[k] === 'number' && Number.isFinite(inicios[k])) return inicios[k];
  return null;
}

// Si ya hay foto de esta sesión, no se mueve. Si no, se usa el saldo que el
// servidor ya vio al empezar (sod / startOfDay). Si no hay, y todos los trades
// de la sesión son del bróker y netos, el inicio es saldo − suma. Si no, la
// primera lectura de esta sesión.
export function aplicarLectura(store, { id, balance, now = Date.now(), trades = null, inicioConocido = null } = {}) {
  const session = diaSesion(now);
  const idKey = String(id || '');
  const vacio = { session, sessionStartBalance: null, sessionPnl: null, fuente: null, creado: false };
  if (!idKey) return vacio;
  const cuentas = (store.cuentas ||= {});
  const porDia = (cuentas[idKey] ||= {});
  let snap = porDia[session];
  let creado = false;
  if (!snap || typeof snap.balance !== 'number' || !Number.isFinite(snap.balance)) {
    let start = null;
    let fuente = null;
    if (typeof inicioConocido === 'number' && Number.isFinite(inicioConocido)) {
      start = r2(inicioConocido);
      fuente = 'saldo ya visto al empezar la sesión';
    } else {
      const recon = inicioReconstruido(balance, trades);
      if (recon != null) {
        start = recon;
        fuente = 'saldo menos trades del bróker';
      } else if (typeof balance === 'number' && Number.isFinite(balance)) {
        start = r2(balance);
        fuente = 'primera lectura';
      }
    }
    if (start == null) return vacio;
    snap = porDia[session] = { balance: start, at: new Date(now).toISOString(), fuente };
    creado = true;
  }
  const sessionStartBalance = snap.balance;
  const sessionPnl = typeof balance === 'number' && Number.isFinite(balance) ? r2(balance - sessionStartBalance) : null;
  return { session, sessionStartBalance, sessionPnl, fuente: snap.fuente, creado };
}

export function leerStore(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, ARCHIVO), 'utf8'));
    if (j && j.cuentas && typeof j.cuentas === 'object') return { cuentas: j.cuentas };
  } catch {}
  return { cuentas: {} };
}

export function guardarStore(dir, store) {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, ARCHIVO + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, path.join(dir, ARCHIVO));
}

export function iniciosConocidos(dir, state, now = Date.now()) {
  const session = diaSesion(now);
  const out = {};
  try {
    const sod = JSON.parse(fs.readFileSync(path.join(dir, 'sod.json'), 'utf8'));
    for (const [id, s] of Object.entries((sod && sod.accounts) || {})) {
      if (s && s.day === session && typeof s.bal === 'number' && Number.isFinite(s.bal)) out[id] = s.bal;
    }
  } catch {}
  for (const [id, a] of Object.entries((state && state.accounts) || {})) {
    if (a && a.tradingDay === session && typeof a.startOfDay === 'number' && Number.isFinite(a.startOfDay)) out[id] = a.startOfDay;
  }
  return out;
}

export function tradesHistorial(dir, session, id) {
  let h;
  try { h = JSON.parse(fs.readFileSync(path.join(dir, 'historial', `${session}.json`), 'utf8')); } catch { return null; }
  const cuentas = (h && h.cuentas) || {};
  const keys = Object.keys(cuentas).filter(k => mismaCuenta(k, id));
  if (!keys.length) return [];
  return keys.flatMap(k => ((cuentas[k] && cuentas[k].trades) || []).map(t => ({ ...t, cuenta: t.cuenta || k })));
}

export function anotarCuentas(respuesta, store, { now = Date.now(), inicios = {}, leerTrades = null } = {}) {
  if (!respuesta || !Array.isArray(respuesta.accounts)) return { respuesta, cambio: false };
  const session = diaSesion(now);
  let cambio = false;
  const accounts = respuesta.accounts.map(a => {
    const id = String((a && (a.name || a.id)) || '');
    if (!id) return a;
    const balance = a && typeof a.balance === 'number' && Number.isFinite(a.balance) ? a.balance : null;
    const ya = store.cuentas && store.cuentas[id] && store.cuentas[id][session];
    const inicioConocido = inicioPara(inicios, id);
    let trades = null;
    if (!(ya && typeof ya.balance === 'number') && inicioConocido == null && typeof leerTrades === 'function') {
      try { trades = leerTrades(id, session); } catch { trades = null; }
    }
    const r = aplicarLectura(store, { id, balance, now, trades, inicioConocido });
    if (r.creado) cambio = true;
    if (r.sessionStartBalance == null) return a;
    return { ...a, session: r.session, sessionStartBalance: r.sessionStartBalance, sessionPnl: r.sessionPnl };
  });
  return { respuesta: { ...respuesta, accounts }, cambio };
}

export function aplicarEnRespuesta(respuesta, { dir, state, now = Date.now() } = {}) {
  if (!respuesta || !Array.isArray(respuesta.accounts) || !dir) return respuesta;
  const store = leerStore(dir);
  const inicios = iniciosConocidos(dir, state, now);
  const anotado = anotarCuentas(respuesta, store, {
    now,
    inicios,
    leerTrades: (id, session) => tradesHistorial(dir, session, id),
  });
  if (anotado.cambio) guardarStore(dir, store);
  return anotado.respuesta;
}
