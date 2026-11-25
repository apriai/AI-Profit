// Muros de gamma de QQQ, pasados al precio de NQ. No envía órdenes.
// Si la descarga o el dibujo fallan, se anota y se dejan las líneas anteriores.
import fs from 'node:fs';
import path from 'node:path';

export const URL_QQQ = 'https://cdn.cboe.com/api/global/delayed_quotes/options/QQQ.json';
export const CADA_MS = 20 * 60 * 1000;
export const TOPE_BANDA = 0.25;
export const BARRIDO = 0.20;
export const PASO_BARRIDO = 0.0025;
const LOG = 'gex.log';
const MS_ANIO = 365.25 * 24 * 60 * 60 * 1000;
const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function parseOpcion(symbol) {
  const m = /^[A-Z]{1,6}(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(String(symbol || ''));
  if (!m) return null;
  const year = 2000 + Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day, tipo: m[4], strike: Number(m[5]) / 1000 };
}

export function instanteExpira(year, month, day) {
  let utc = Date.UTC(year, month - 1, day, 21, 0, 0);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const partes = Object.fromEntries(fmt.formatToParts(new Date(utc)).map(p => [p.type, p.value]));
    const visto = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute);
    utc += Date.UTC(year, month - 1, day, 16, 0) - visto;
  }
  return utc;
}

export function vigente(op, ahora) {
  if (!op) return false;
  return ahora < instanteExpira(op.year, op.month, op.day);
}

export function gammaBS(S, K, iv, T, r = 0) {
  if (!(S > 0) || !(K > 0) || !(iv > 0) || !(T > 0)) return 0;
  const vol = iv > 3 ? iv / 100 : iv;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * T) / (vol * sqrtT);
  return Math.exp(-0.5 * d1 * d1) * INV_SQRT_2PI / (S * vol * sqrtT);
}

export function aporteGex(gamma, oi, spot, tipo) {
  if (!(gamma > 0) || !(oi > 0) || !(spot > 0)) return 0;
  const signo = tipo === 'P' ? -1 : 1;
  return signo * gamma * oi * 100 * spot * spot * 0.01;
}

function contratosDe(json, ahora) {
  const data = json && json.data;
  const spot = data && Number(data.current_price);
  const lista = data && Array.isArray(data.options) ? data.options : null;
  if (!(spot > 0) || !lista) throw new Error('JSON inválido');
  const vivos = [];
  for (const crudo of lista) {
    const op = parseOpcion(crudo && crudo.option);
    if (!op || !vigente(op, ahora)) continue;
    const oi = Number(crudo.open_interest);
    const gamma = Number(crudo.gamma);
    const iv = Number(crudo.iv);
    if (!(oi > 0)) continue;
    const expira = instanteExpira(op.year, op.month, op.day);
    vivos.push({ ...op, oi, gamma: gamma > 0 ? gamma : 0, iv: iv > 0 ? iv : 0, T: (expira - ahora) / MS_ANIO });
  }
  return { spot, vivos };
}

function muro(vivos, tipo, spot) {
  const min = spot * (1 - TOPE_BANDA);
  const max = spot * (1 + TOPE_BANDA);
  const porStrike = new Map();
  for (const c of vivos) {
    if (c.tipo !== tipo || c.strike < min || c.strike > max || !(c.gamma > 0)) continue;
    porStrike.set(c.strike, (porStrike.get(c.strike) || 0) + c.gamma * c.oi);
  }
  let mejor = null;
  for (const [strike, peso] of porStrike) {
    if (!mejor || peso > mejor.peso || (peso === mejor.peso && Math.abs(strike - spot) < Math.abs(mejor.strike - spot))) mejor = { strike, peso };
  }
  return mejor ? mejor.strike : null;
}

function cruce(serie, spot) {
  let mejor = null;
  for (let i = 0; i < serie.length; i++) {
    const a = serie[i];
    if (a.gex === 0) {
      const dist = Math.abs(a.spot - spot);
      if (!mejor || dist < mejor.dist) mejor = { precio: a.spot, dist, gexDesde: 0, gexHasta: 0 };
      continue;
    }
    const b = serie[i + 1];
    if (!b) continue;
    if ((a.gex > 0 && b.gex < 0) || (a.gex < 0 && b.gex > 0)) {
      const t = Math.abs(a.gex) / (Math.abs(a.gex) + Math.abs(b.gex));
      const precio = a.spot + (b.spot - a.spot) * t;
      const dist = Math.abs(precio - spot);
      if (!mejor || dist < mejor.dist) mejor = { precio, dist, gexDesde: a.gex, gexHasta: b.gex };
    }
  }
  return mejor;
}

export function calcularGex(json, opts = {}) {
  const ahora = opts.ahora != null ? opts.ahora : Date.now();
  const r = opts.r || 0;
  const { spot, vivos } = contratosDe(json, ahora);
  let gex = 0;
  for (const c of vivos) gex += aporteGex(c.gamma, c.oi, spot, c.tipo);
  const serie = [];
  const utiles = vivos.filter(c => c.iv > 0 && c.T > 0);
  for (let p = -BARRIDO; p <= BARRIDO + 1e-12; p += PASO_BARRIDO) {
    const S = spot * (1 + p);
    let neto = 0;
    for (const c of utiles) neto += aporteGex(gammaBS(S, c.strike, c.iv, c.T, r), c.oi, S, c.tipo);
    serie.push({ spot: S, gex: neto });
  }
  const flip = cruce(serie, spot);
  return {
    spot,
    gex,
    signo: gex > 0 ? '+' : gex < 0 ? '-' : '0',
    callQqq: muro(vivos, 'C', spot),
    putQqq: muro(vivos, 'P', spot),
    flipQqq: flip ? flip.precio : null,
    gexDesde: flip ? flip.gexDesde : null,
    gexHasta: flip ? flip.gexHasta : null,
    contratos: vivos.length,
  };
}

export function aNq(nivelQqq, nq, spot) {
  if (!(nivelQqq > 0) || !(nq > 0) || !(spot > 0)) return null;
  return nivelQqq * (nq / spot);
}

export function nivelesNq(calc, nq) {
  return {
    callNq: aNq(calc.callQqq, nq, calc.spot),
    putNq: aNq(calc.putQqq, nq, calc.spot),
    flipNq: aNq(calc.flipQqq, nq, calc.spot),
    callQqq: calc.callQqq,
    putQqq: calc.putQqq,
    flipQqq: calc.flipQqq,
    gex: calc.gex,
    signo: calc.signo,
    spot: calc.spot,
    nq,
  };
}

function redondo(v) {
  return v == null || !Number.isFinite(v) ? '' : v.toFixed(2);
}

export function mismaLinea(a, b) {
  if (!a || !b) return false;
  return redondo(a.callNq) === redondo(b.callNq) && redondo(a.putNq) === redondo(b.putNq) && redondo(a.flipNq) === redondo(b.flipNq);
}

function n(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return String(Math.round(v));
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export function lineaGex(r) {
  const at = r.at || new Date().toISOString();
  if (r.saltado) return `${at} saltado: trade abierto`;
  if (r.error && r.descargaMs == null) return `${at} error: ${r.error}`;
  const base = `${at} descarga ${r.descargaMs} ms · json ${r.bytes} B · cálculo ${r.calculoMs} ms · dibujo ${r.dibujoMs} ms · total ${r.totalMs} ms · gex ${n(r.gex)} · signo ${r.signo || '—'} · flip QQQ ${n(r.flipQqq)} NQ ${n(r.flipNq)} · call QQQ ${n(r.callQqq)} NQ ${n(r.callNq)} · put QQQ ${n(r.putQqq)} NQ ${n(r.putNq)}`;
  return r.error ? `${base} · error: ${r.error}` : r.nota ? `${base} · ${r.nota}` : base;
}

const TEXTOS_VIEJOS = ['Call wall GEX', 'Put wall GEX', 'Gamma flip'];

export function expresionLimpiar() {
  const textos = JSON.stringify(TEXTOS_VIEJOS);
  return `(async function(){
    var TEXTOS={}; ${textos}.forEach(function(t){ TEXTOS[t]=1; });
    var api=window.TradingViewApi; if(!api||typeof api.chartsCount!=='function') return {ok:false,n:0};
    var n=0, charts=0; try{ charts=api.chartsCount(); }catch(e){ return {ok:false,n:0}; }
    for(var i=0;i<charts;i++){
      var c=null; try{ c=api.chart(i); }catch(e){ continue; }
      if(!c) continue;
      var sym=''; try{ sym=c.symbol()||''; }catch(e2){}
      var x=String(sym).toUpperCase().replace(/^.*:/,'');
      if(!/^MNQ/.test(x) && !/^NQ/.test(x)) continue;
      var shapes=[]; try{ shapes=c.getAllShapes()||[]; }catch(e3){ shapes=[]; }
      for(var k=0;k<shapes.length;k++){
        var sh=shapes[k], id=sh&&(sh.id||sh), texto='';
        try{ var ent=c.getShapeById(id); var pr=ent&&ent.getProperties&&ent.getProperties(); texto=(pr&&(pr.text||pr.title))||''; }catch(e4){}
        if(TEXTOS[texto]){ try{ c.removeEntity(id); n++; }catch(e5){} }
      }
    }
    return {ok:true,n:n};
  })()`;
}

async function limpiarMurosPorDefecto() {
  const { cdpEvaluator } = await import('./colchon.mjs');
  const E = await cdpEvaluator(9222);
  try { return await E.evaluate(expresionLimpiar()); }
  finally { try { E.close(); } catch {} }
}

export async function bajarQqq(fetchImpl = globalThis.fetch) {
  const t0 = Date.now();
  const res = await fetchImpl(URL_QQQ, { headers: { 'User-Agent': AGENTE, Referer: 'https://www.cboe.com/', Accept: 'application/json' } });
  if (!res || !res.ok) throw new Error(`HTTP ${res && res.status ? res.status : 'sin respuesta'}`);
  const texto = await res.text();
  let json;
  try { json = JSON.parse(texto); } catch { throw new Error('JSON inválido'); }
  return { json, bytes: Buffer.byteLength(texto), ms: Date.now() - t0 };
}

function anotar(dir, texto) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, LOG), texto + '\n');
  } catch {}
}

export function crearGex(opts = {}) {
  if (!opts.dir) throw new Error('gex: falta dir');
  const ahora = opts.ahora || (() => Date.now());
  const tradeAbierto = opts.tradeAbierto || (() => false);
  const bajar = opts.bajar || (() => bajarQqq(opts.fetch));
  const limpiar = opts.limpiar || limpiarMurosPorDefecto;
  let ultimo = null;
  let ocupado = false;
  let timer = null;
  let limpio = false;

  async function correr() {
    if (ocupado) return { saltado: 'ocupado' };
    ocupado = true;
    const t0 = ahora();
    const at = new Date(t0).toISOString();
    try {
      if (tradeAbierto()) {
        const linea = lineaGex({ at, saltado: true });
        anotar(opts.dir, linea);
        return { saltado: true, linea };
      }
      let pack;
      try { pack = await bajar(); }
      catch (e) {
        const linea = lineaGex({ at, error: String(e && e.message || e) });
        anotar(opts.dir, linea);
        return { error: String(e && e.message || e), linea };
      }
      const tCalc = ahora();
      let calc;
      try { calc = calcularGex(pack.json, { ahora: t0, r: opts.r || 0 }); }
      catch (e) {
        const linea = lineaGex({ at, descargaMs: pack.ms, bytes: pack.bytes, calculoMs: ahora() - tCalc, dibujoMs: 0, totalMs: ahora() - t0, error: String(e && e.message || e) });
        anotar(opts.dir, linea);
        return { error: String(e && e.message || e), linea };
      }
      const calculoMs = ahora() - tCalc;
      ultimo = { signo: calc.signo, gex: calc.gex, at };
      const linea = lineaGex({ at, descargaMs: pack.ms, bytes: pack.bytes, calculoMs, dibujoMs: 0, totalMs: ahora() - t0, gex: calc.gex, signo: calc.signo, flipQqq: calc.flipQqq, callQqq: calc.callQqq, putQqq: calc.putQqq });
      anotar(opts.dir, linea);
      return { ok: true, linea, calc };
    } catch (e) {
      const linea = lineaGex({ at, error: String(e && e.message || e) });
      anotar(opts.dir, linea);
      return { error: String(e && e.message || e), linea };
    } finally { ocupado = false; }
  }

  function arrancar() {
    if (!limpio) {
      limpio = true;
      Promise.resolve().then(() => limpiar()).catch(() => {});
    }
    correr().catch(() => {});
    timer = setInterval(() => { correr().catch(() => {}); }, opts.cadaMs || CADA_MS);
    return api;
  }
  function detener() { if (timer) clearInterval(timer); timer = null; }
  function estado() {
    if (!ultimo) return { ok: true, signo: null, gex: null };
    return { ok: true, signo: ultimo.signo, gex: ultimo.gex, at: ultimo.at };
  }
  const api = { correr, arrancar, detener, estado };
  return api;
}

export function attachGex(opts = {}) {
  const gex = crearGex(opts);
  try { gex.arrancar(); } catch (e) { console.log('gex: no arrancó; el motor sigue.', e && e.message); }
  return gex;
}
