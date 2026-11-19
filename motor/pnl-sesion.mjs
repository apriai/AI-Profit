// Neto de la sesión de trading. La sesión va de las 18:00 a las 16:00 del día siguiente (hora de Nueva York) y se etiqueta con esa fecha de las 16:00. De 16:00 a 18:00 el trade va a la sesión siguiente. El corte lo aplica diaFarm(); aquí solo se cierra el neto.
// No usa la primera lectura tardía de la granja como saldo de inicio.

export const COMM_RT = { MNQ: 1, NQ: 3.5 };
const PV = s => { const r = String(s || '').replace(/^.*:/, ''); return /^MNQ/.test(r) ? 2 : /^NQ/.test(r) ? 20 : /^MES/.test(r) ? 5 : /^ES/.test(r) ? 50 : /^M2K/.test(r) ? 5 : /^RTY/.test(r) ? 50 : /^MYM/.test(r) ? 0.5 : /^YM/.test(r) ? 5 : null; };
// La misma ida y vuelta que arma el historial: precios de las ejecuciones del bróker.
export function roundTrips(ex) {
  const by = {}; for (const x of [...(ex || [])].sort((a, b) => a.time - b.time)) (by[x.symbol] ||= []).push(x);
  const out = []; for (const [sym, l] of Object.entries(by)) { const pv = PV(sym); let pos = 0, cash = 0, t0 = null, q = 0, first = null, comm = 0, commOk = true, entry = 0;
    for (const x of l) { if (!pos) { t0 = x.time; first = x.side; q = 0; cash = 0; comm = 0; commOk = true; entry = x.price; } pos += x.side * x.qty; cash -= x.side * x.qty * x.price; if (x.side === first) q += x.qty; if (x.comm == null) commOk = false; else comm += x.comm;
      if (pos === 0 && pv) { const g = Math.round(cash * pv * 100) / 100; out.push({ abierta: new Date(t0).toISOString(), at: new Date(x.time).toISOString(), direccion: first > 0 ? 'COMPRA' : 'VENTA', tamano: `${q} ${String(sym).replace(/^.*:/, '').replace(/Z?\d{4}$|[FGHJKMNQUVXZ]\d$/, '')}`, entrada: entry, salida: x.price, pnl: commOk ? Math.round((g - comm) * 100) / 100 : g, pnlBruto: g, neto: commOk, fuente: 'broker' }); } } }
  return out;
}
// El P&L que muestra la fila del historial (después de cerrarSesion) y el precio de salida.
export function cierreDesdeEjecuciones(ex, { openAt, side, cuenta, cuentaBroker } = {}) {
  if (!Array.isArray(ex) || !ex.length) return null;
  if (cuenta && cuentaBroker && String(cuentaBroker) !== String(cuenta)) return null;
  const dir = side === 'long' ? 'COMPRA' : side === 'short' ? 'VENTA' : side;
  const abierto = Number(openAt);
  const rt = roundTrips(ex).filter(t => (!dir || t.direccion === dir) && (!Number.isFinite(abierto) || (Date.parse(t.at) >= abierto - 2000 && Date.parse(t.abierta) >= abierto - 30000))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const t = rt[rt.length - 1];
  if (!t || typeof t.pnlBruto !== 'number') return null;
  const fila = (cerrarSesion([t], {}).trades || [])[0] || t;
  return { pnl: fila.pnl, salida: t.salida, pnlBruto: t.pnlBruto };
}

const r2 = x => Math.round(x * 100) / 100;

export function contratosDe(t) {
  const m = String(t && (t.tamano || t.symbol) || '').match(/(\d+(?:\.\d+)?)\s*(MNQ|NQ)\b/i);
  if (m) return { n: +m[1], sym: m[2].toUpperCase() };
  const q = Number(t && t.qty);
  const s = String(t && (t.symbol || t.tamano) || '');
  const sym = /MNQ/i.test(s) ? 'MNQ' : /\bNQ\b/i.test(s) ? 'NQ' : null;
  if (sym && Number.isFinite(q) && q > 0) return { n: q, sym };
  return { n: 0, sym: null };
}

export function comisionTabla(t) {
  if (t && typeof t.comision === 'number') return t.comision;
  if (t && typeof t.comm === 'number') return t.comm;
  const { n, sym } = contratosDe(t);
  if (!sym || !n) return 0;
  return r2(n * COMM_RT[sym]);
}

function brutoDe(t) {
  if (typeof t.pnlBruto === 'number') return t.pnlBruto;
  if (typeof t.pnl === 'number') return t.pnl;
  return null;
}

function repartir(list, neto) {
  const brutos = list.map(brutoDe);
  const bruto = brutos.reduce((a, x) => a + (x || 0), 0);
  const gap = r2(bruto - neto);
  const pesos = list.map(t => contratosDe(t).n);
  const sumP = pesos.reduce((a, b) => a + b, 0) || list.length || 1;
  let usado = 0;
  return list.map((t, i) => {
    const g = brutos[i] || 0;
    const w = (pesos[i] || (sumP === list.length ? 1 : 0)) / sumP;
    const c = i === list.length - 1 ? r2(gap - usado) : r2(gap * w);
    usado = r2(usado + c);
    return { ...t, pnlBruto: g, pnl: r2(g - c), neto: true, comision: c };
  });
}

export function resumenDia(trades) {
  const con = [...(trades || [])].filter(t => t && typeof t.pnl === 'number' && t.at)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let mejor = 0, peor = 0, run = 0, runTipo = null;
  for (const t of con) {
    const k = t.pnl > 0 ? 'gana' : t.pnl < 0 ? 'pierde' : null;
    if (!k) { run = 0; runTipo = null; continue; }
    run = k === runTipo ? run + 1 : 1;
    runTipo = k;
    if (k === 'gana' && run > mejor) mejor = run;
    if (k === 'pierde' && run > peor) peor = run;
  }
  let racha = 0, rachaTipo = null;
  for (let i = con.length - 1; i >= 0; i--) {
    const k = con[i].pnl > 0 ? 'gana' : con[i].pnl < 0 ? 'pierde' : null;
    if (!k) break;
    if (!rachaTipo) rachaTipo = k;
    if (k !== rachaTipo) break;
    racha++;
  }
  const pnl = r2(con.reduce((a, t) => a + t.pnl, 0));
  return {
    n: con.length, pnl, ganados: con.filter(t => t.pnl > 0).length, perdidos: con.filter(t => t.pnl < 0).length,
    racha, rachaTipo, mejor, peor, vacio: con.length === 0,
  };
}

function dinero(x) {
  const a = Math.abs(x);
  const s = Number.isInteger(a) ? String(a) : String(r2(a));
  return (x > 0 ? '+' : x < 0 ? '−' : '') + '$' + s;
}

export function textoHud(res, vista) {
  const v = ((vista % 3) + 3) % 3;
  const vacio = !res || res.vacio || !res.n;
  if (v === 0) return `Hoy ${vacio ? 0 : res.n} trades · ${vacio ? 0 : res.ganados}+ · ${vacio ? 0 : res.perdidos}−`;
  if (v === 1) return 'P&L hoy: ' + dinero(vacio ? 0 : res.pnl);
  if (vacio) return 'Sin trades hoy';
  if (res.rachaTipo === 'gana' && res.racha > 0) return `🔥 ${res.racha} seguidas · Mejor ${res.mejor} · Peor ❄️ ${res.peor}`;
  if (res.rachaTipo === 'pierde' && res.racha > 0) return `❄️ ${res.racha} seguidas · Mejor ${res.mejor} · Peor ❄️ ${res.peor}`;
  return `Mejor ${res.mejor} · Peor ❄️ ${res.peor}`;
}

// Prioridad: comisiones reales del bróker; si no, saldo de inicio de sesión (solo si se marca);
// si no, y el trade está marcado bruto, la tabla MNQ $1 / NQ $3.50 por contrato.
// Una lectura tardía no se pasa como saldo de inicio.
export function cerrarSesion(trades, opts = {}) {
  const list = (Array.isArray(trades) ? trades : []).map(t => ({ ...t }));
  if (!list.length) return { neto: 0, bruto: 0, fuente: 'sin trades', trades: [], resumen: resumenDia([]) };
  const bruto = r2(list.reduce((a, t) => a + (brutoDe(t) || 0), 0));
  const todosNeto = list.every(t => t.neto === true && typeof t.pnl === 'number');
  if (todosNeto) {
    const neto = r2(list.reduce((a, t) => a + t.pnl, 0));
    return { neto, bruto, fuente: 'comisiones del bróker', trades: list, resumen: resumenDia(list) };
  }
  if (opts.saldoEsSesion === true && typeof opts.saldoInicio === 'number' && typeof opts.saldoActual === 'number') {
    const neto = r2(opts.saldoActual - opts.saldoInicio);
    const out = repartir(list, neto);
    return { neto, bruto, fuente: 'saldo de inicio de sesión', trades: out, resumen: resumenDia(out) };
  }
  const algunoBruto = list.some(t => t.neto === false || typeof t.pnlBruto === 'number');
  if (!algunoBruto) {
    const neto = r2(list.reduce((a, t) => a + (typeof t.pnl === 'number' ? t.pnl : 0), 0));
    return { neto, bruto: neto, fuente: 'estimado', trades: list, resumen: resumenDia(list) };
  }
  const out = list.map(t => {
    if (t.neto === true && typeof t.pnl === 'number') return t;
    const g = brutoDe(t);
    if (g == null) return t;
    const c = comisionTabla(t);
    return { ...t, pnlBruto: g, pnl: r2(g - c), neto: true, comision: c };
  });
  const neto = r2(out.reduce((a, t) => a + (typeof t.pnl === 'number' ? t.pnl : 0), 0));
  return { neto, bruto, fuente: 'comisión conocida', trades: out, resumen: resumenDia(out) };
}
