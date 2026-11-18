// TradingLink Fase 2 - Ordenes con confirmacion + switch on/off, alineado a la estrategia de Baned.
// SEGURIDAD: MODO SIMULACION fijo. Este archivo NUNCA hace clic en Buy/Sell/Place.
// Activar envio real requiere un cambio de codigo explicito autorizado por Baned.
import { rulesFor, maxQtyFor } from './account-size.mjs';
import { diaFarm, fueraDeSesion } from './colchon.mjs';
import { tipoDe } from './granja-flores.mjs';
export const DRY_RUN = true;
export const SYMBOLS = { NQ: 2, MNQ: 20 };           // tope 25K (2 minis o 20 micros); 50K y la fondeada usan maxQtyFor
export const MAX_QTY = 20;
export const BRACKET = {                             // USD por trade (TP / SL)
  eval:   { tp: 630,  sl: 600 },                      // evaluacion: exactamente 2 trades ganadores de +630 = +1260 (> objetivo 1250)
  funded: { tp: 1600, sl: 600 },                      // fondeada: primer trade +1600 / -600
};
export const TRADES_PER_DAY = 1;
const NEWS_BEFORE_MIN = 40, NEWS_AFTER_MIN = 5;
const typeOf = account => tipoDe(typeof account === 'string' ? { id: account, name: account } : (account || {}));
let botEnabled = false;                               // bot APAGADO por defecto
const pending = new Map(); const log = []; const tradesToday = new Map();
export const bot = { get: () => botEnabled, set: v => { botEnabled = !!v; return botEnabled; } };
function etNow(ms = Date.now()) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(new Date(ms)).map(x => [x.type, x.value])); return { mins: (+p.hour % 24) * 60 + +p.minute, wd: p.weekday, day: diaFarm(ms) }; }
// TODO noticias: devolver lista de horas (minutos ET del dia) de noticias carpeta roja (ForexFactory u otra fuente).
// Mientras no haya fuente, devuelve [] y NO bloquea: revisa el calendario a mano.
export let redFolderNewsToday = () => [];
export const setNewsSource = fn => { redFolderNewsToday = fn; };
const key = (acc, day) => `${acc}|${day}`;
export function check(o, accounts, ms) {
  const err = [];
  if (!botEnabled) err.push('El bot esta apagado');
  const a = accounts[o.account];
  if (!a) err.push('Cuenta desconocida');
  if (a && typeOf(a) === 'eval' && a.balance != null) { const R = rulesFor(a); if (a.balance <= R.start - R.dd) err.push('Cuenta en drawdown maximo (quemada)'); }
  if (!['buy', 'sell'].includes(o.side)) err.push('Lado invalido');
  const sym = o.symbol || 'MNQ';
  if (!(sym in SYMBOLS)) err.push('Simbolo debe ser NQ o MNQ');
  else if (!Number.isInteger(o.qty) || o.qty < 1 || o.qty > maxQtyFor(sym, a || {})) err.push(`Cantidad ${sym} debe ser 1-${maxQtyFor(sym, a || {})}`);
  // Toda orden se convierte en bracket (TP/SL fijos) en plan(), aunque la UI mande 'market'.
  const t = etNow(ms);
  if (fueraDeSesion(ms == null ? Date.now() : ms)) err.push('Fuera de sesión (de las 16:00 a las 18:00 ET). La sesión va de las 18:00 a las 16:00.');
  for (const n of redFolderNewsToday()) if (t.mins >= n - NEWS_BEFORE_MIN && t.mins <= n + NEWS_AFTER_MIN) err.push('Ventana de noticia carpeta roja (-40/+5 min)');
  if (a && (tradesToday.get(key(o.account, t.day)) || 0) >= TRADES_PER_DAY) err.push('Ya hubo 1 trade hoy en esta cuenta');
  return err;
}
function plan(o, accounts) {
  const acc = accounts[o.account]; const sym = o.symbol || 'MNQ'; const kind = typeOf(acc);
  const sc = rulesFor(acc).scale;
  return { ...o, symbol: sym, type: 'bracket', tp: BRACKET[kind].tp * sc, sl: BRACKET[kind].sl * sc };
}
export function request(o, accounts, ms) {
  const err = check(o, accounts, ms); if (err.length) return { ok: false, err };
  const p = plan(o, accounts); const id = Math.random().toString(36).slice(2, 10); pending.set(id, { ...p, at: Date.now() });
  return { ok: true, id, summary: `${p.side.toUpperCase()} ${p.qty} ${p.symbol} BRACKET TP +$${p.tp} / SL -$${p.sl} en ${p.account}` };
}
export async function confirm(id, accounts, ms) {
  const o = pending.get(id); pending.delete(id);
  if (!o) return { ok: false, err: ['Orden no encontrada o ya usada'] };
  if (Date.now() - o.at > 60000) return { ok: false, err: ['Confirmacion vencida (60 s)'] };
  const err = check(o, accounts, ms); if (err.length) return { ok: false, err };
  const k = key(o.account, etNow(ms).day); tradesToday.set(k, (tradesToday.get(k) || 0) + 1);
  log.push({ ...o, confirmedAt: new Date().toISOString(), simulated: DRY_RUN });
  // DRY_RUN: no se toca TradingView.
  return { ok: true, simulated: true, msg: `SIMULACION: se habria enviado ${o.side.toUpperCase()} ${o.qty} ${o.symbol} TP +$${o.tp} / SL -$${o.sl} en ${o.account}. No se coloco ninguna orden.` };
}
// Fuera de sesión (16:00 a 18:00 ET): hay que estar plano. Sigue en simulación y el bot nace apagado.
export const mustBeFlat = (ms) => fueraDeSesion(ms == null ? Date.now() : ms);
export const cancel = id => pending.delete(id);
export const history = () => log.slice(-50);