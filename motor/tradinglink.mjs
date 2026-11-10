// TradingLink Fase 1 — SOLO LECTURA. No coloca órdenes.
// Regla: cuentas LFE = evaluación, LFF = fondeada.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import * as orders from './orders.mjs';
import { negocio } from './negocio.mjs';
import { colchon, colchonHooks, CFG as colchonCFG, readAccounts, buildReport, diaFarm, cdpEvaluator, PAGE, acctGuard, js } from './colchon.mjs';
import { attachReporte } from './tv-reporte.mjs';
import { createVistaPrevia } from './tv-vista-previa.mjs';
import { estrategiasPropias } from './estrategias-propias.mjs';
import { execFile } from 'node:child_process';
import { dataDir, ROOT, HTML, TV_CLI } from './rutas.mjs';
import { rulesFor } from './account-size.mjs';
const DIR = dataDir();
const TV = TV_CLI;
const PORT = 8787, EVERY_MS = 5 * 60 * 1000;
const tv = (...a) => new Promise(r => execFile(process.execPath, [TV, ...a], (e, o) => { try { r(JSON.parse(o)); } catch { r({ success: false }); } }));
const ev = async js => (await tv('ui', 'eval', js)).result;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const typeOf = id => id.startsWith('LFF') ? 'funded' : id.startsWith('LFE') ? 'eval' : 'unknown';
function rulesOf(id, extra = {}) { return rulesFor({ id, name: id, ...extra }); }
function applyPlan(a) {
  if (!a || !a.id) return a;
  const s = (sod.accounts || {})[a.id] || {};
  const r = rulesOf(a.id, { inicio: s.inicio, startOfDay: a.startOfDay ?? s.bal, start: a.start, planStart: a.planStart, plan: a.plan });
  a.plan = r.size; a.scale = r.scale; a.planStart = r.start; a.start = r.start;
  a.dd = r.dd; a.dailyLoss = r.dailyLoss; a.profitTarget = r.profitTarget;
  a.lockTriggerOver = r.lockTriggerOver; a.lockFloorOver = r.lockFloorOver; a.atRisk = r.atRisk;
  if (typeof a.balance === 'number') a.totalPnl = Math.round((a.balance - r.start) * 100) / 100;
  return a;
}

const num = s => +String(s).replace(/[^0-9.-]/g, '');
let state = { updated: null, accounts: {}, error: null, daily: {} };
// Dia de trading (ET): el dia termina a las 16:00 ET (fin de las sesiones de Nueva York) -> desde las 16:00 cuenta como el dia siguiente; sabado/domingo -> lunes. Una sola regla para todo: diaFarm() en colchon.mjs.
const SOD_FILE = path.join(DIR, 'sod.json');
let sod = { accounts: {}, daily: {} }; try { sod = { accounts: {}, daily: {}, ...JSON.parse(fs.readFileSync(SOD_FILE, 'utf8')) }; } catch {}
// Semilla: al reiniciar, las cuentas no activas no se releen (p.ej. con pausa-lectura.flag); se publica su ÚLTIMO saldo real conocido (sod.lastBal) marcado stale para que la granja pueda marcar quemada una fondeada.
for (const [id, s] of Object.entries(sod.accounts || {})) if (/^LF[EF]/.test(id) && s && s.lastBal != null && !s.gone) state.accounts[id] = applyPlan({ id, type: typeOf(id), balance: s.lastBal, equity: s.lastBal, profit: null, readAt: s.readAt || null, startOfDay: s.bal, dayPnl: Math.round((s.lastBal - s.bal) * 100) / 100, totalPnl: Math.round((s.lastBal - 25000) * 100) / 100, tradingDay: s.day, stale: true });
function tradingDay() { return diaFarm(); }

const readCurrent = () => ev(`(()=>{const n=document.querySelector('[class*=accountName]');const f=[...document.querySelectorAll('[class*=accountSummaryField]')].map(e=>e.innerText.split('\\n'));const p=(document.querySelector('[class*=accountManager]')||{}).innerText||'';return JSON.stringify({id:n&&n.innerText.trim(),f,busy:/Positions\\s*\\(?[1-9]|Orders\\s*\\(?[1-9]/.test(p)})})()`).then(s => JSON.parse(s || '{}'));
const center = () => ev(`(()=>{const r=document.querySelector('[class*=accountName]').getBoundingClientRect();return (r.x+r.width/2|0)+' '+(r.y+r.height/2|0)})()`);
async function openList() { const [x, y] = (await center()).split(' '); await tv('ui', 'mouse', x, y); await sleep(1000); }
async function pick(id) {
  await openList();
  const xy = await ev(`(()=>{const e=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.innerText&&e.innerText.trim()==='${id}').pop();if(!e)return '';const r=e.getBoundingClientRect();return (r.x+r.width/2|0)+' '+(r.y+r.height/2|0)})()`);
  if (!xy) return false; const [x, y] = xy.split(' '); await tv('ui', 'mouse', x, y); await sleep(2000); return true;
}
const listIds = async () => { await openList(); const t = await ev(`(()=>[...new Set((document.body.innerText.match(/\\bLF[EF]\\d{8,}\\b/g)||[]))].join(','))()`); await tv('ui', 'keyboard', 'Escape'); await sleep(300); return (t || '').split(',').filter(Boolean); };
function save(c) {
  const g = k => { const r = c.f.find(x => x[0] === k); return r ? num(r[1]) : null; };
  state.accounts[c.id] = { id: c.id, type: typeOf(c.id), balance: g('Account Balance'), equity: g('Equity'), profit: g('Profit'), readAt: new Date().toISOString() };
  const a = state.accounts[c.id], day = tradingDay();
  if (a.balance != null) {
    const s = sod.accounts[c.id];
    // cambio de día: se conservan peak y breachedAt (quema pegajosa; −$600 + −$600 en 2 días = −$1,200 → quemada)
    // cuenta de EVALUACION vista por primera vez en una granja que ya tenia cuentas: empieza el dia en el saldo inicial (25,000), no en la primera lectura (que puede traer una posicion abierta con P&L flotante). Instalacion nueva (sod vacio): se mantiene la primera lectura.
    const nuevaEval = !s && /^LFE/.test(c.id) && Object.keys(sod.accounts).length > 0;
    if (!s || s.day !== day) sod.accounts[c.id] = nuevaEval ? { day, bal: rulesOf(c.id).start, inicio: rulesOf(c.id).start, lastBal: a.balance } : { ...(s || {}), ...(s && s.lastBal != null && ![16, 17].includes(horaET()) ? { peak: Math.max(rulesOf(c.id).start, s.peak ?? 0, s.lastBal) } : {}), day, bal: s && s.lastBal != null ? s.lastBal : a.balance, lastBal: a.balance, ...(s && s.day && s.lastBal != null && s.bal != null ? { prev: { day: s.day, pnl: Math.round((s.lastBal - s.bal) * 100) / 100 } } : {}) };
    else s.lastBal = a.balance;
    sod.accounts[c.id].readAt = a.readAt;
    sod.accounts[c.id].lastAt = a.readAt;
    a.startOfDay = sod.accounts[c.id].bal; a.dayPnl = Math.round((a.balance - a.startOfDay) * 100) / 100; a.tradingDay = day; applyPlan(a);
    sod.daily[day] = Object.values(state.accounts).filter(x => x.tradingDay === day && x.dayPnl != null).reduce((t, x) => t + x.dayPnl, 0);
    try { fs.writeFileSync(SOD_FILE, JSON.stringify(sod, null, 2)); } catch {}
    state.daily = sod.daily;
  }
  riesgo(a);
}
// FIX quema fondeada: piso de max loss calculado en el servidor (mismas reglas que Ln() de la granja) para que
// una fondeada que rompe el max loss SIEMPRE se marque, aunque la lectura completa esté en pausa.
const RULES = { start: 25000, dd: 1000, lockTriggerOver: 1100, lockFloorOver: 100 }; // fallback 25K; preferir rulesOf(id)
// PICO = mayor SALDO DE CIERRE de sesion (regla Lucid EOD trailing). Un saldo intradia NUNCA sube el pico: solo cuenta si la lectura es de la ventana de cierre (17:00-17:59 ET, mercado en pausa y todo plano) o via el cambio de dia.
const horaET = () => +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
const enCierre = () => horaET() === 17;
function peakDe(id, bal, cierre) { const s = sod.accounts[id] || {}; const R = rulesOf(id); let p = Math.max(R.start, s.peak ?? 0, cierre ? (bal ?? 0) : 0);
  try { const d = JSON.parse(fs.readFileSync(path.join(DIR, 'days.json'), 'utf8'))[id] || []; for (const x of d) p = Math.max(p, x.close ?? 0); } catch {}
  if (sod.accounts[id]) sod.accounts[id].peak = p; return p; }
function riesgo(a) { if (!a || a.balance == null) return; applyPlan(a); const R = rulesOf(a.id); const peak = peakDe(a.id, a.balance, enCierre()), locked = a.type === 'funded' && peak > R.start + R.lockTriggerOver;
  a.peak = peak; a.floor = locked ? R.start + R.lockFloorOver : peak - R.dd; a.locked = locked; const sa = sod.accounts[a.id]; // MAX LOSS: 25K pierde $1,000 desde 25,000; 50K pierde $2,000 desde 50,000 (desde el pico o acumulado) = QUEMADA
  a.breached = a.balance <= a.floor || a.balance <= R.start - R.dd || !!(sa && sa.breachedAt); if (a.breached && sa && !sa.breachedAt) { sa.breachedAt = new Date().toISOString(); try { fs.writeFileSync(SOD_FILE, JSON.stringify(sod, null, 2)); } catch {} } if (a.breached && a.type === "funded") { a.burned = true; a.breachedAt = sa && sa.breachedAt; }
  if (a.breached) console.log('MAX LOSS roto:', a.id, a.type, 'saldo', a.balance, '<= piso', a.floor); }
// Cuentas vivas que no se leyeron en este ciclo (p. ej. pausa-lectura.flag activo o servidor reiniciado): usar el último saldo leído (sod.json)
function rellenar(live) { for (const a of Object.values(state.accounts)) if (a.floor == null) riesgo(a); for (const id of live || []) { if (state.accounts[id] || !/^LF[EF]/.test(id)) continue; const s = sod.accounts[id]; if (!s || s.lastBal == null) continue;
  const a = state.accounts[id] = { id, type: typeOf(id), balance: s.lastBal, equity: s.lastBal, profit: 0, readAt: s.lastAt || null, stale: true, tradingDay: s.day };
  if (s.day === tradingDay()) { a.startOfDay = s.bal; a.dayPnl = Math.round((s.lastBal - s.bal) * 100) / 100; } applyPlan(a); riesgo(a); } }
let cycling = false;
async function cycle() {
  if (cycling) return; cycling = true;
  try {
    // Saldos por la API interna de TradingView (sin clics): la cuenta activa cada 30 s; todas las cuentas cada 5 min
    // (nunca si hay posiciones/órdenes abiertas ni durante una prueba colchón, para no cambiar de cuenta en mitad de un trade).
    const pausa = fs.existsSync(path.join(DIR, 'pausa-lectura.flag'));
    // Un trade en marcha o un arranque en curso (acctGuard.testActive) cuenta como ocupado: no se inicia
    // un recorrido nuevo de todas las cuentas ni de solo fondeadas. La lectura de la cuenta activa sigue.
    const operando = colchon.status().state === 'running' || acctGuard.testActive;
    // lectura completa (cambia de cuenta) SOLO si: sin pausa, sin prueba colchon ni arranque, y sin posiciones/ordenes en la cuenta activa (si las hay, se salta y se reintenta en 5 min)
    const full = !pausa && Date.now() - lastFull >= FULL_MS && !operando;
    // Con pausa-lectura.flag NO se recorren las evaluaciones, pero las FONDEADAS (LFF) se siguen leyendo cada 5 min
    // (mismas protecciones: sin posición/orden abierta, TradingView en segundo plano, sin prueba colchón ni arranque) para evaluar la quema de $1,000.
    const fundedOnly = !full && pausa && Date.now() - lastFunded >= FULL_MS && !operando;
    const r = await readAccounts({ all: full || fundedOnly, only: fundedOnly ? '^LFF' : null }); if (r.error) throw new Error(r.error);
    if (fundedOnly && r.full && !r.busy && !r.visible && !r.aborted) lastFunded = Date.now();
    if (full) lastFull = Date.now();
    if (full && (r.busy || r.visible || r.aborted)) console.log(new Date().toLocaleTimeString(), 'lectura completa ' + (r.aborted ? 'cortada (TradingView pasó a primer plano)' : 'saltada: ' + (r.busy ? 'posición/orden abierta' : 'TradingView en primer plano')) + ' · reintento en 5 min'); // con posicion/orden (r.busy) no cambia de cuenta y se reintenta en 5 min
    if (r.busy || colchon.status().state === 'running' || acctGuard.testActive) lastBusy = Date.now();
    for (const a of r.accounts) if (/^LF[EF]/.test(a.name) && a.balance != null)
      save({ id: a.name, f: [['Account Balance', String(a.balance)], ['Equity', String(a.equity ?? a.balance)], ['Profit', String(a.profit ?? 0)]] });
    // la granja refleja SOLO las cuentas que TradingView tiene ahora (accountsMetainfo); se borran las que ya no existen
    if (Array.isArray(r.live) && r.live.length) { state.live = r.live.map(a => a.name); for (const k of Object.keys(state.accounts)) if (!state.live.includes(k)) { console.log('cuenta ya no está en TradingView, se quita:', k); delete state.accounts[k]; if (!/^LFF/.test(k) && sod.accounts[k] && !sod.accounts[k].gone) { sod.accounts[k].gone = new Date().toISOString(); try { fs.writeFileSync(SOD_FILE, JSON.stringify(sod, null, 2)); } catch {} } } for (const id of state.live) if (sod.accounts[id] && sod.accounts[id].gone) delete sod.accounts[id].gone; rellenar(state.live); }
    state.updated = new Date().toISOString(); state.error = null;
  } catch (e) { state.error = String(e.message || e); }
  fs.writeFileSync(path.join(DIR, 'accounts.json'), JSON.stringify(state, null, 2));
  console.log(new Date().toLocaleTimeString(), state.error || Object.values(state.accounts).map(a => `${a.id} ${a.type} $${a.balance}`).join(' · '));
  cycling = false;
}

// ---- Solo lectura para la granja: historial de trades, informes y luces de conexión ----
const maskId = t => String(t ?? '').replace(/\b(LF[EF]\d)\d{3,}(\d{3})\b/g, '$1…$2');
// Detalle de UN trade para la granja (SOLO LECTURA): junta, desde colchon-eventos.jsonl, el cierre (fin_trade), los movimientos del stop y la comparacion broker/chart de esa operacion.
// Puntos maximos del trade (SOLO LECTURA): peor y mejor P&L visto en las lecturas 1/s de colchon-eventos.jsonl, convertido a puntos.
function maxPuntos(W, t1, tam) { const m = /(\d+)\s*(MNQ|NQ)/i.exec(String(tam || '')); if (!m) return null; const pv = (/^MNQ$/i.test(m[2]) ? 2 : 20) * +m[1]; const v = W.filter(x => x.type === 'lectura' && Date.parse(x.at) <= t1 + 1e3).map(x => x.brokerPl ?? x.chartPl).filter(x => typeof x === 'number' && isFinite(x)); if (!v.length) return null; const q = u => Math.round(u / pv / .25) * .25; return { neg: q(Math.min(0, ...v)), pos: q(Math.max(0, ...v)), n: v.length, fuente: 'lecturas del broker (1/s)' }; }
function detalleTrade(at) {
  const T = Date.parse(at); if (!isFinite(T)) return { ok: false, err: 'Falta la hora del trade' };
  let L = []; try { L = fs.readFileSync(path.join(DIR, 'colchon-eventos.jsonl'), 'utf8').split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(x => x && x.at); } catch {}
  const ms = x => Date.parse(x), cierre = f => ms(f.cerradaEn || f.fin || f.at);
  let f = null, best = 120e3; for (const x of L) { if (x.type !== 'fin_trade') continue; const d = Math.abs(cierre(x) - T); if (d < best) { best = d; f = x; } }
  if (!f) return { ok: false, err: 'No hay registro detallado de este trade (por ejemplo, un trade manual).' };
  const t0 = ms(f.abiertaEn) || (cierre(f) - (f.duracionSeg || 0) * 1e3), t1 = cierre(f), W = L.filter(x => ms(x.at) >= t0 - 5e3 && ms(x.at) <= t1 + 20e3);
  const intento = m => ((m.intentos || []).find(i => i.ok) || (m.intentos || [])[0] || {});
  const movs = W.filter(x => x.type === 'mover_stop' && ms(x.at) <= t1 + 1e3).map(m => ({ at: m.at, paso: m.paso, precio: m.precio, ok: !!m.ok, verificado: m.verificado ?? null, via: m.via || null, ms: intento(m).ms ?? null, enSeg: Math.round((ms(m.at) - t0) / 100) / 10 }));
  const disparos = W.filter(x => x.type === 'disparo' && ms(x.at) <= t1).map(d => ({ at: d.at, paso: d.paso, pnl: d.pnl, disparoUSD: d.disparoUSD, precio: d.precio, slAntes: d.slAntes }));
  const lec = W.filter(x => x.type === 'lectura' && x.brokerPl != null && x.chartPl != null && ms(x.at) <= t1), dif = lec.map(x => Math.abs(x.brokerPl - x.chartPl));
  const aj = f.ajusteFill ? { ref: f.ajusteFill.ref, fill: f.ajusteFill.fill, slAntes: f.ajusteFill.slAntes, slNuevo: f.ajusteFill.slNuevo, tpAntes: f.ajusteFill.tpAntes, tpNuevo: f.ajusteFill.tpNuevo, seg: f.ajusteFill.seg ?? null, ok: f.ajusteFill.ok !== false, nada: !!f.ajusteFill.nada } : null;
  const lt = f.latencia || {};
  const fin = { direccion: f.direccion, tamano: f.tamano, motivo: f.motivo, estrategia: f.estrategia, estrategiaId: f.estrategiaId, modo: f.modo, cuenta: maskId(f.cuenta), abiertaEn: f.abiertaEn, cerradaEn: f.cerradaEn || f.fin, abiertaET: f.abiertaET, cerradaET: f.cerradaET, duracionSeg: f.duracionSeg ?? null, colchonTrasSeg: f.colchonTrasSeg ?? null, entrada: f.entrada ?? null, pnlFinalUSD: f.pnlFinalUSD ?? null, pnlFinalAprox: !!f.pnlFinalAprox, colchonMovido: !!f.colchonMovido, slColchon: f.slColchon ?? null, colchonUSD: f.colchonUSD ?? null, pasos: f.pasos || [], pasosTotal: f.pasosTotal ?? null, ajusteFill: aj, latencia: { metodo: lt.metodo || null, via: lt.via || null, modificarMs: lt.modificarMs ?? null, confirmarMs: lt.confirmarMs ?? null, totalMs: lt.totalDesdeLecturaMs ?? null }, fuenteLider: f.fuenteLider || null, fuenteModo: f.fuenteModo || null };
  return { ok: true, fin, movs, disparos, puntos: maxPuntos(W, t1, f.tamano), lecturas: { n: lec.length, difMedia: dif.length ? Math.round(dif.reduce((a, b) => a + b, 0) / dif.length * 100) / 100 : null, difMax: dif.length ? Math.round(Math.max(...dif) * 100) / 100 : null } };
}
function tradesFarm(dia) { let L = []; try { L = fs.readFileSync(path.join(DIR, 'colchon-eventos.jsonl'), 'utf8').split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(x => x && x.at && diaFarm(Date.parse(x.at)) === dia); } catch {}
  const out = []; let movs = [];
  for (const x of L) { if (x.type === 'mover_stop' && x.ok) movs.push(x); if (x.type !== 'fin_trade') continue;
    const sid = x.estrategiaId || ''; const cand = [sid && `${sid}-${dia}.md`, `${dia}.md`].filter(Boolean).filter(f => fs.existsSync(path.join(DIR, 'reportes', f)));
    out.push({ at: x.fin || x.at, direccion: x.direccion, tamano: x.tamano, pnl: x.pnlFinalUSD ?? null, aprox: !!x.pnlFinalAprox, motivo: x.motivo, estrategia: x.estrategia, modo: x.modo, cuenta: maskId(x.cuenta), stopMovido: !!(x.colchonMovido || movs.length), informe: cand[0] || null }); movs = []; }
  const v = out.filter(t => typeof t.pnl === 'number');
  return { dia, total: Math.round(v.reduce((a, t) => a + t.pnl, 0) * 100) / 100, n: out.length, ganados: v.filter(t => t.pnl > 0).length, trades: out.reverse(), dias: [...new Set([...diasConTrades(), ...diasHist()])].sort().reverse() }; }
const HDIR = path.join(DIR, 'historial');
const hKey = t => `${t.at}|${t.direccion}|${t.tamano}`;
function histLeer(dia) { try { return JSON.parse(fs.readFileSync(path.join(HDIR, `${dia}.json`), 'utf8')); } catch { return null; } }
function histGuardar(r) { if (!r || !r.cuenta || !Array.isArray(r.trades)) return; try { fs.mkdirSync(HDIR, { recursive: true });
  const h = histLeer(r.dia) || { dia: r.dia, cuentas: {} }; const c = h.cuentas[r.cuenta] ||= { trades: [] }; const m = new Map(c.trades.map(t => [hKey(t), t]));
  for (const t of r.trades) if (t.fuente === 'broker') m.set(hKey(t), { ...(m.get(hKey(t)) || {}), ...t, cuenta: r.cuenta });
  c.trades = [...m.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); if (r.saldoDia != null) c.saldoDia = r.saldoDia; c.fuente = r.fuente; c.actualizado = new Date().toISOString();
  const tmp = path.join(HDIR, `${r.dia}.json.tmp`); fs.writeFileSync(tmp, JSON.stringify(h, null, 1)); fs.renameSync(tmp, path.join(HDIR, `${r.dia}.json`)); } catch (e) { console.log('historial: no pude guardar', e.message); } }
function histDia(dia, f) { const h = histLeer(dia); if (!h) return null; const cs = Object.entries(h.cuentas || {}); if (!cs.length) return null;
  const tr = cs.flatMap(([k, c]) => c.trades.map(t => ({ ...t, cuenta: k }))); const farm = f.trades.filter(x => !tr.some(t => t.granja && Math.abs(Date.parse(t.at) - Date.parse(x.at)) < 15000));
  const out = [...tr, ...farm.map(m => ({ ...m, fuente: 'granja', granja: true }))].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); const v = out.filter(t => typeof t.pnl === 'number');
  const sd = cs.map(([, c]) => c.saldoDia).filter(x => typeof x === 'number');
  return { dia, total: Math.round(v.reduce((a, t) => a + t.pnl, 0) * 100) / 100, saldoDia: sd.length ? Math.round(sd.reduce((a, x) => a + x, 0) * 100) / 100 : null, n: out.length, ganados: v.filter(t => t.pnl > 0).length, trades: out, dias: f.dias, cuenta: cs.length === 1 ? cs[0][0] : null, fuente: 'historial guardado (' + (cs[0][1].fuente || 'bróker') + ')' }; }
const diaVivo = d => d === diaFarm() || d === diaFarm(Date.now() - 36e5);
async function tradesDe(dia) { const r = await tradesDe0(dia); if (diaVivo(dia) && r.fuente && /bróker/.test(r.fuente) && !/^historial/.test(r.fuente)) histGuardar(r); return r; }
async function tradesDe0(dia) { const f = tradesFarm(dia); const b = diaVivo(dia) ? await brokerExecs() : null;
  if (!b || !b.ex) { const h = histDia(dia, f); if (h) return h; f.fuente = 'informes de la granja (estimado; sin ejecuciones del bróker)'; return f; }
  const rt = roundTrips(b.ex).filter(t => diaFarm(Date.parse(t.at)) === dia);
  const farm = [...f.trades]; const out = rt.map(t => { const k = farm.findIndex(x => Math.abs(Date.parse(x.at) - Date.parse(t.at)) < 15000 && x.direccion === t.direccion);
    const m = k >= 0 ? farm.splice(k, 1)[0] : null; return { ...t, aprox: t.fuente === 'broker' ? false : !t.neto, cuenta: maskId(b.cuenta), modo: m ? m.modo : null, estrategia: m ? m.estrategia : 'Manual / fuera de la granja', motivo: m ? m.motivo : null, stopMovido: m ? m.stopMovido : null, informe: m ? m.informe : null, granja: !!m, pnlGranja: m ? m.pnl : null }; });
  for (const m of farm) out.push({ ...m, fuente: 'granja', granja: true });
  out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); const v = out.filter(t => typeof t.pnl === 'number');
  const acc = Object.values(state.accounts).find(a => a.id === b.cuenta);
  return { dia, total: Math.round(v.reduce((a, t) => a + t.pnl, 0) * 100) / 100, totalNeto: v.every(t => t.neto !== false), saldoDia: acc && acc.tradingDay === dia ? acc.dayPnl : (acc && sod.accounts[acc.id] && sod.accounts[acc.id].prev && sod.accounts[acc.id].prev.day === dia ? sod.accounts[acc.id].prev.pnl : null), n: out.length, ganados: v.filter(t => t.pnl > 0).length, trades: out, dias: f.dias, cuenta: maskId(b.cuenta),
    fuente: 'ejecuciones reales del bróker (TradingView)' + (v.every(t => t.neto !== false) ? ', netas de comisiones' : ', P&L bruto sin comisiones') }; }
function diasHist() { try { return fs.readdirSync(HDIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(0, 10)); } catch { return []; } }
function diasConTrades() { try { return [...new Set(fs.readdirSync(path.join(DIR, 'reportes')).map(f => (f.match(/(\d{4}-\d{2}-\d{2})\.md$/) || [])[1]).filter(Boolean))].sort().reverse(); } catch { return []; } }

// === metricas: funciones puras ===
// Resumen del historial de trades de ESTA máquina. No lee negocio.json ni otra contabilidad.
const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const r2m = x => Math.round(x * 100) / 100;
const r1m = x => Math.round(x * 10) / 10;
const shiftISO = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lunesDe = iso => { const w = new Date(iso + 'T00:00:00Z').getUTCDay(); return shiftISO(iso, w === 0 ? -6 : 1 - w); };
function rangoMetricas(params, hoy, conocidos) {
  const desdeQ = params.get('desde'), hastaQ = params.get('hasta');
  const ord = [...(conocidos || [])].filter(d => ISO_DIA.test(d)).sort();
  let desde, hasta;
  if (ISO_DIA.test(desdeQ || '') || ISO_DIA.test(hastaQ || '')) {
    hasta = ISO_DIA.test(hastaQ || '') ? hastaQ : hoy;
    desde = ISO_DIA.test(desdeQ || '') ? desdeQ : (ord[0] || hasta);
  } else {
    const rango = String(params.get('rango') || 'hoy').toLowerCase();
    if (rango === 'semana') { desde = lunesDe(hoy); hasta = hoy; }
    else if (rango === 'mes') { desde = hoy.slice(0, 8) + '01'; hasta = hoy; }
    else if (rango === 'todo') { desde = ord[0] || hoy; hasta = ord.length && ord[ord.length - 1] > hoy ? ord[ord.length - 1] : hoy; }
    else { desde = hasta = hoy; }
  }
  if (desde > hasta) { const t = desde; desde = hasta; hasta = t; }
  return { desde, hasta };
}
function diasEnRango(desde, hasta, hoy, conocidos) {
  const set = new Set((conocidos || []).filter(d => ISO_DIA.test(d) && d >= desde && d <= hasta));
  if (ISO_DIA.test(hoy || '') && hoy >= desde && hoy <= hasta) set.add(hoy);
  return [...set].sort();
}
function fuenteMetricas(rows) {
  if (!rows.length) return 'sin trades en el rango';
  let hist = false, broker = false, farm = false;
  for (const r of rows) { const f = String(r.fuente || ''); if (/^historial/.test(f)) hist = true; else if (/^ejecuciones reales del bróker/.test(f)) broker = true; else farm = true; }
  const bits = []; if (broker) bits.push('ejecuciones del bróker'); if (hist) bits.push('historial guardado'); if (farm) bits.push('estimados de la granja');
  return bits.join(' + ');
}
function agregarMetricas(porDia, meta) {
  const days = []; const all = []; const usados = [];
  for (const r of porDia || []) {
    const trades = (r.trades || []).filter(t => typeof t.pnl === 'number' && isFinite(t.pnl));
    if (!trades.length || !ISO_DIA.test(r.dia || '')) continue;
    const pnl = r2m(trades.reduce((a, t) => a + t.pnl, 0));
    days.push({ dia: r.dia, pnl, n: trades.length, ganados: trades.filter(t => t.pnl > 0).length });
    all.push(...trades); usados.push(r);
  }
  days.sort((a, b) => a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0);
  let cum = 0; const series = days.map(d => { cum = r2m(cum + d.pnl); return { dia: d.dia, pnl: d.pnl, cum }; });
  const wins = all.filter(t => t.pnl > 0), losses = all.filter(t => t.pnl < 0);
  const ganados = wins.length, perdidos = losses.length, n = all.length, decided = ganados + perdidos;
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0), grossLoss = losses.reduce((a, t) => a + t.pnl, 0);
  const totalPnl = r2m(all.reduce((a, t) => a + t.pnl, 0));
  const avgWin = ganados ? r2m(grossWin / ganados) : null;
  const avgLoss = perdidos ? r2m(grossLoss / perdidos) : null;
  const best = days.reduce((m, d) => Math.max(m, d.pnl), days.length ? -Infinity : 0);
  return {
    desde: meta.desde, hasta: meta.hasta, totalPnl, n, ganados, perdidos,
    winRate: decided ? r1m(ganados / decided * 100) : null,
    avgWin, avgLoss,
    winLossRatio: avgWin != null && avgLoss ? r2m(avgWin / Math.abs(avgLoss)) : null,
    dayWinRate: days.length ? r1m(days.filter(d => d.pnl > 0).length / days.length * 100) : null,
    profitFactor: grossLoss < 0 ? r2m(grossWin / Math.abs(grossLoss)) : null,
    bestDayPct: days.length && best > 0 && totalPnl > 0 ? r1m(best / totalPnl * 100) : null,
    days, series, fuente: fuenteMetricas(usados),
  };
}
async function metricasDe(url) {
  const q = new URL(url, 'http://x').searchParams;
  const hoy = diaFarm();
  const conocidos = [...new Set([...diasConTrades(), ...diasHist()])];
  const { desde, hasta } = rangoMetricas(q, hoy, conocidos);
  const dias = diasEnRango(desde, hasta, hoy, conocidos);
  const porDia = [];
  for (const dia of dias) porDia.push(await tradesDe(dia));
  return agregarMetricas(porDia, { desde, hasta });
}
// === fin metricas puras ===

// Ejecuciones reales del bróker (solo lectura: ab.executions) -> trades ida y vuelta con P&L bruto (sin comisiones)
const PV = s => { const r = String(s || '').replace(/^.*:/, ''); return /^MNQ/.test(r) ? 2 : /^NQ/.test(r) ? 20 : /^MES/.test(r) ? 5 : /^ES/.test(r) ? 50 : /^M2K/.test(r) ? 5 : /^RTY/.test(r) ? 50 : /^MYM/.test(r) ? 0.5 : /^YM/.test(r) ? 5 : null; };
let execCache = { at: 0, v: null };
async function brokerExecs() { if (execCache.v && (Date.now() - execCache.at < 20000 || colchon.status().state === 'running')) return execCache.v;
  let E; try { E = await cdpEvaluator(9222); const v = await Promise.race([E.evaluate(`(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!ab||typeof ab.allExecutions!=='function'&&typeof ab.executions!=='function')return null;var n=null;try{var ci=tvWv(ab.currentAccount());var ms=await ab.accountsMetainfo();(ms||[]).forEach(function(m){if(String(m.id)===String(ci))n=m.name})}catch(e){}var l=null;try{l=await ab.allExecutions()}catch(e){}if(!l||!l.length){l=[];var sy=['CME_MINI:MNQZ2026','CME_MINI:NQZ2026'];try{var cs=window.TradingViewApi._activeChartWidgetWV.value().symbol();if(cs&&sy.indexOf(cs)<0)sy.push(cs)}catch(e){}for(var i=0;i<sy.length;i++){try{(await ab.executions(sy[i])||[]).forEach(function(x){if(!l.some(function(y){return String(y.id)===String(x.id)}))l.push(x)})}catch(e){}}}return {cuenta:n,ex:(l||[]).map(function(x){return {id:String(x.id),symbol:x.symbol,price:+x.price,qty:Math.abs(+x.qty),side:+x.side,time:+x.time,comm:x.commission!=null?+x.commission:null}})}})()`), sleep(6000).then(() => null)]);
    if (v) execCache = { at: Date.now(), v }; } catch {} finally { try { E && E.close(); } catch {} }
  return execCache.v; }
// Al terminar una prueba, si el bucle no tiene P&L final, el motor pide aqui el P&L bruto real de las ejecuciones del broker (solo lectura).
colchonHooks.pnlFinalBroker = async ({ openAt, side, cuenta }) => { try { execCache.at = 0; const b = await brokerExecs(); if (!b || !b.ex) return null; if (cuenta && b.cuenta && String(b.cuenta) !== String(cuenta)) return null; const dir = side === 'long' ? 'COMPRA' : 'VENTA';
  const rt = roundTrips(b.ex).filter(t => t.direccion === dir && Date.parse(t.at) >= openAt - 2000 && Date.parse(t.abierta) >= openAt - 30000).sort((x, y) => Date.parse(x.at) - Date.parse(y.at)); const t = rt[rt.length - 1]; return t && typeof t.pnlBruto === 'number' ? t.pnlBruto : null; } catch { return null; } };
// Reporte de trades en TradingView: solo el cierre que acaba de confirmarse. No barre el historial ni repone dibujos.
let reporte = null;
try {
  reporte = attachReporte({ dir: DIR, raizOcupada: () => colchon.status().state === 'running' ? colchon.status().symbol : null });
  colchonHooks.onCierre = (s) => { try { reporte.alCerrar(s); } catch (e) { console.log('reporte:', e && e.message); } };
  console.log('reporte: Reporte de trades en TradingView listo');
} catch (e) { console.log('reporte: no arrancó; el motor sigue.', e && e.message); }
// Vista previa del panel: solo dibuja. No abre, no modifica y no cierra órdenes, y no repone reportes.
const vistaPrevia = createVistaPrevia({
  cotizar: async () => { const E = await cdpEvaluator(9222); try { return await E.evaluate(js.lastPrice); } finally { try { E.close(); } catch {} } },
  dibujar: async (expr) => { const E = await cdpEvaluator(9222); try { return await E.evaluate(expr); } finally { try { E.close(); } catch {} } },
});
function roundTrips(ex) { const by = {}; for (const x of [...ex].sort((a, b) => a.time - b.time)) (by[x.symbol] ||= []).push(x);
  const out = []; for (const [sym, l] of Object.entries(by)) { const pv = PV(sym); let pos = 0, cash = 0, t0 = null, q = 0, first = null, comm = 0, commOk = true, entry = 0;
    for (const x of l) { if (!pos) { t0 = x.time; first = x.side; q = 0; cash = 0; comm = 0; commOk = true; entry = x.price; } pos += x.side * x.qty; cash -= x.side * x.qty * x.price; if (x.side === first) q += x.qty; if (x.comm == null) commOk = false; else comm += x.comm;
      if (pos === 0 && pv) { const g = Math.round(cash * pv * 100) / 100; out.push({ abierta: new Date(t0).toISOString(), at: new Date(x.time).toISOString(), direccion: first > 0 ? 'COMPRA' : 'VENTA', tamano: `${q} ${String(sym).replace(/^.*:/, '').replace(/Z?\d{4}$|[FGHJKMNQUVXZ]\d$/, '')}`, entrada: entry, salida: x.price, pnl: commOk ? Math.round((g - comm) * 100) / 100 : g, pnlBruto: g, neto: commOk, fuente: 'broker' }); } } }
  return out; }
let conn = { at: 0, v: null };
async function conexion() { if (conn.v && Date.now() - conn.at < 10000) return conn.v;
  let cdp = false; try { const ac = new AbortController(); setTimeout(() => ac.abort(), 1500); cdp = (await fetch('http://127.0.0.1:9222/json/version', { signal: ac.signal })).ok; } catch {}
  const st = colchon.status(); let tdv = conn.v ? conn.v.tradovate : false, real = false, cuenta = conn.v ? conn.v.cuenta : null, broker = conn.v ? conn.v.broker : null;
  if (cdp && st.state !== 'running') { try { const c = await Promise.race([colchon.check(), sleep(4000).then(() => null)]); if (c && c.account) { broker = c.account.broker || c.account.brokerId || null; tdv = /tradovate/i.test(`${broker} ${c.account.brokerId || ''}`) && !!c.account.name; real = !!c.real; cuenta = maskId(c.account.name); } } catch {} }
  if (!cdp) tdv = false; if (st.state === 'running' && st.mode === 'real') real = true;
  conn = { at: Date.now(), v: { servidor: true, tradingview: cdp, tradovate: tdv, broker, real, cuenta, lecturaOk: !state.error, actualizado: state.updated } }; return conn.v; }
const negocioH = negocio({ dir: DIR, port: PORT, day: () => diaFarm() }); // /api/negocio: copia del historial del Negocio (negocio.json)
const propiasH = estrategiasPropias({ port: PORT }); // /api/estrategias-propias: estrategias de esta computadora (raíz, no se sube)
http.createServer((q, r) => {
  if (propiasH(q, r)) return;
  if (negocioH(q, r)) return;
  if (q.url.startsWith('/api/vista-previa')) { let b = ''; q.on('data', c => b += c); q.on('end', async () => { let out; try { let j = {}; try { j = JSON.parse(b || '{}'); } catch { j = {}; } if (colchon.status().state === 'running') j = { activo: false, seq: j.seq || 0 }; out = await vistaPrevia.aplicar(j); } catch (e) { out = { ok: false, estado: 'no-disponible', texto: 'Vista previa no disponible' }; } r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(out)); }); return; }
  if (/^\/(logros|metas)\.json/.test(q.url)) { let t='{}'; try { t = fs.readFileSync(path.join(DIR, q.url.startsWith('/logros') ? 'logros.json' : 'metas.json'), 'utf8'); } catch {} r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return r.end(t); }
  if (q.url.startsWith('/accounts.json')) { r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return r.end(JSON.stringify(state)); }
  if (q.url.startsWith('/api/colchon/')) { let b=''; q.on('data',c=>b+=c); q.on('end', async()=>{ let j={}; try{j=JSON.parse(b||'{}')}catch{} let out;
    try {
      if (q.url.startsWith('/api/colchon/reporte')) { const d = new URL(q.url, 'http://x').searchParams.get('dia'); const md = buildReport(DIR, /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : diaFarm());
        r.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' }); return r.end(md); }
      if (q.url.startsWith('/api/colchon/informe')) { const f = path.basename(new URL(q.url, 'http://x').searchParams.get('f') || ''); let md = 'No encontré ese informe.';
        if (/^[\w.-]+\.md$/.test(f)) try { md = maskId(fs.readFileSync(path.join(DIR, 'reportes', f), 'utf8')); } catch {}
        r.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' }); return r.end(md); }
      if (q.url.startsWith('/api/colchon/detalle')) { const out2 = detalleTrade(new URL(q.url, 'http://x').searchParams.get('at') || ''); r.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); return r.end(JSON.stringify(out2)); }
      if (q.url.startsWith('/api/colchon/lectura')) { const f = path.join(DIR, 'pausa-lectura.flag');
        if (q.method === 'POST') { const p = j.pause ?? !fs.existsSync(f); if (p) fs.writeFileSync(f, 'pausa manual ' + new Date().toISOString()); else fs.rmSync(f, { force: true }); }
        out = { paused: fs.existsSync(f), ultimaLecturaCompleta: lastFull ? new Date(lastFull).toISOString() : null, ultimaActividad: new Date(lastBusy).toISOString(), esperaSeg: Math.max(0, Math.ceil((QUIET_MS - (Date.now() - lastBusy)) / 1000)) }; }
      else if (q.url.startsWith('/api/colchon/metricas')) out = await metricasDe(q.url);
      else if (q.url.startsWith('/api/colchon/trades')) { const d = new URL(q.url, 'http://x').searchParams.get('dia'); out = await tradesDe(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : diaFarm()); }
      else if (q.url.startsWith('/api/colchon/conexion')) out = await conexion();
      else if (q.url.startsWith('/api/colchon/status')) out = { ...colchon.status(), cfg: colchonCFG };
      else if (q.url.startsWith('/api/colchon/summary')) out = colchon.summary() || { ok: false, err: 'Todavía no hay resumen' };
      else if (q.url.startsWith('/api/colchon/strategies')) out = colchon.strategies();
      else if (q.url.startsWith('/api/colchon/accounts')) out = await colchon.accounts();
      else if (q.url.startsWith('/api/colchon/check')) out = await colchon.check();
      else if (q.url.startsWith('/api/colchon/start') && q.method === 'POST') out = await colchon.start(j);
      else if (q.url.startsWith('/api/colchon/stop') && q.method === 'POST') out = await colchon.stop(j);
      else out = { ok: false, err: 'ruta desconocida' };
    } catch (e) { out = { ok: false, err: String(e.message || e) }; }
    r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(out)); }); return; }
  if (q.method === 'POST' || q.url === '/bot') { let b=''; q.on('data',c=>b+=c); q.on('end', async()=>{ let j={}; try{j=JSON.parse(b||'{}')}catch{} let out;
    if (q.url==='/bot') out={enabled: q.method==='POST'? orders.bot.set(j.enabled): orders.bot.get(), simulated: orders.DRY_RUN};
    else if (q.url==='/order') out=orders.request(j, state.accounts);
    else if (q.url==='/confirm') out=await orders.confirm(j.id, state.accounts);
    else if (q.url==='/cancel') out={ok: orders.cancel(j.id)};
    else out={ok:false,err:['ruta desconocida']};
    console.log(new Date().toLocaleTimeString(), q.url, JSON.stringify(out)); r.writeHead(200,{'content-type':'application/json'}); r.end(JSON.stringify(out)); }); return; }
  if (q.method === 'GET' && (q.url === '/propfarm-logo.png' || q.url.startsWith('/propfarm-logo.png?'))) {
    const logo = path.join(ROOT, 'assets', 'propfarm-logo.png');
    if (fs.existsSync(logo)) { r.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); return fs.createReadStream(logo).pipe(r); }
  }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(HTML).pipe(r);
}).listen(PORT, '127.0.0.1', () => console.log(`Granja: http://localhost:${PORT}`));
let lastFull = 0, lastFunded = 0, lastBusy = Date.now(); const FULL_MS = EVERY_MS, QUIET_MS = 5 * 60 * 1000;
cycle(); setInterval(cycle, 30 * 1000);

const guardarHist = () => { for (const d of new Set([diaFarm(), diaFarm(Date.now() - 36e5)])) tradesDe(d).catch(() => {}); };
setInterval(guardarHist, 3 * 60 * 1000);
setTimeout(guardarHist, 15000);
