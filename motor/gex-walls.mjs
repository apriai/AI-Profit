// «Gex - Put/Call Walls»: niveles 0DTE de QQQ y SPY para el indicador Pine del mismo nombre.
// Fórmulas tal cual la especificación (GEX = gamma × OI × 100 × spot² × 0.01; calls +, puts −;
// gamma de Black-Scholes con r = 0.04 si CBOE no la trae; Zero Gamma en una rejilla de ±5 % en pasos de 0.1 %).
// La granja calcula a las HORAS_ET (más una vez al arrancar) y solo escribe los 8 niveles ETF en los
// inputs del estudio. El estudio convierte a NQ con su «Live ratio» y dibuja. No envía órdenes.
// Con el panel de operar abierto o un trade abierto no se calcula ni se aplica: queda pendiente y corre al cerrarse.
import fs from 'node:fs';
import path from 'node:path';
import { parseOpcion, instanteExpira, fechaClave, FERIADOS } from './gex.mjs';

export const GEX_WALLS_NOMBRE = 'Gex - Put/Call Walls';
// Fácil de cambiar: horas de Nueva York, días de mercado.
export const HORAS_ET = ['08:00', '09:30', '09:50', '11:00', '12:00'];
export const URLS = {
  QQQ: 'https://cdn.cboe.com/api/global/delayed_quotes/options/QQQ.json',
  SPY: 'https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json',
};
export const CABECERAS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Referer: 'https://www.cboe.com/',
  Origin: 'https://www.cboe.com',
  Accept: 'application/json',
};
export const R = 0.04;
export const MIN_ANIO = 525600;
export const PASOS_ZG = 50; // −50..+50 → 101 precios
export const PASO_ZG = 0.001; // 0.1 %
const LOG = 'gex.log';
const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);
// Orden de los inputs en el Pine (in_0 = Mode, in_1..in_8 = niveles ETF).
export const INPUTS = [
  ['QQQ Call Wall', 'qqqCall'], ['QQQ Put Wall', 'qqqPut'], ['QQQ Top GEX', 'qqqTop'],
  ['SPY Call Wall', 'spyCall'], ['SPY Put Wall', 'spyPut'], ['SPY Top GEX', 'spyTop'],
  ['QQQ Zero Gamma', 'qqqZG'], ['SPY Zero Gamma', 'spyZG'],
];

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
});
export function partesET(ms) {
  const p = Object.fromEntries(FMT.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, weekday: p.weekday };
}
export function hoyET(ms) { const p = partesET(ms); return fechaClave(p.year, p.month, p.day); }
export function diaDeMercado(ms) {
  const p = partesET(ms);
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  return !FERIADOS.has(fechaClave(p.year, p.month, p.day));
}
// Última hora de HORAS_ET ya pasada hoy (ET), o null si aún no llega la primera.
export function turnoActual(ms, horas = HORAS_ET) {
  if (!diaDeMercado(ms)) return null;
  const p = partesET(ms);
  const min = p.hour * 60 + p.minute;
  let turno = null;
  for (const h of horas) {
    const [hh, mm] = h.split(':').map(Number);
    if (hh * 60 + mm <= min) turno = h;
  }
  return turno ? `${hoyET(ms)} ${turno}` : null;
}

// d1 = (ln(S/K) + (r + iv²/2)·T) / (iv·√T); gamma = e^(−d1²/2) / √(2π) / (S·iv·√T)
export function gammaBS(S, K, iv, T, r = R) {
  if (!(S > 0) || !(K > 0) || !(iv > 0) || !(T > 0)) return 0;
  const raiz = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + iv * iv / 2) * T) / (iv * raiz);
  return Math.exp(-d1 * d1 / 2) * INV_SQRT_2PI / (S * iv * raiz);
}
export function gexDe(gamma, oi, spot) { return gamma * oi * 100 * spot * spot * 0.01; }

// Contratos de un vencimiento (clave YYYY-MM-DD), con OI > 0, antes de que expire (1 PM en media sesión).
export function contratosDeVencimiento(json, ahora, clave) {
  const data = json && json.data;
  const spot = data && Number(data.current_price);
  const lista = data && Array.isArray(data.options) ? data.options : null;
  if (!(spot > 0) || !lista) throw new Error('JSON inválido');
  const out = [];
  let vence = null;
  for (const crudo of lista) {
    const op = parseOpcion(crudo && crudo.option);
    if (!op || fechaClave(op.year, op.month, op.day) !== clave) continue;
    const oi = Number(crudo.open_interest);
    if (!(oi > 0)) continue;
    vence = instanteExpira(op.year, op.month, op.day);
    const T = (vence - ahora) / 60000 / MIN_ANIO;
    if (!(T > 0)) continue;
    const g = Number(crudo.gamma);
    const iv = Number(crudo.iv);
    out.push({ tipo: op.tipo, strike: op.strike, oi, gamma: g > 0 ? g : 0, iv: iv > 0 ? iv : 0, T });
  }
  return { spot, contratos: out, vence };
}

// Solo los contratos que vencen hoy (YYMMDD = hoy ET).
export function contratos0dte(json, ahora) {
  return contratosDeVencimiento(json, ahora, hoyET(ahora));
}

// El vencimiento más próximo que aún no expiró, con algún contrato de OI > 0.
export function proximoVencimiento(json, ahora) {
  const lista = json && json.data && Array.isArray(json.data.options) ? json.data.options : null;
  if (!lista) throw new Error('JSON inválido');
  let mejor = null;
  for (const crudo of lista) {
    const op = parseOpcion(crudo && crudo.option);
    if (!op) continue;
    if (!(Number(crudo.open_interest) > 0)) continue;
    const vence = instanteExpira(op.year, op.month, op.day);
    if (!(vence > ahora)) continue;
    const clave = fechaClave(op.year, op.month, op.day);
    if (!mejor || vence < mejor.vence) mejor = { clave, vence };
  }
  return mejor;
}

function mejor(mapa, valor) {
  let k = null; let v = -Infinity;
  for (const [strike, x] of mapa) { const s = valor(x); if (s > v) { v = s; k = strike; } }
  return k;
}

export function zeroGamma(contratos, spot, r = R) {
  const rejilla = [];
  for (let i = -PASOS_ZG; i <= PASOS_ZG; i++) {
    const S = spot * (1 + i * PASO_ZG);
    let neto = 0;
    for (const c of contratos) {
      const g = gexDe(gammaBS(S, c.strike, c.iv, c.T, r), c.oi, S);
      neto += c.tipo === 'P' ? -g : g;
    }
    rejilla.push({ S, neto });
  }
  let elegido = null;
  for (let i = 0; i < rejilla.length; i++) {
    const a = rejilla[i];
    let precio = null;
    if (a.neto === 0) precio = a.S;
    else if (i + 1 < rejilla.length) {
      const b = rejilla[i + 1];
      if (b.neto !== 0 && Math.sign(a.neto) !== Math.sign(b.neto)) precio = a.S + (b.S - a.S) * (a.neto / (a.neto - b.neto));
    }
    if (precio != null && (elegido == null || Math.abs(precio - spot) < Math.abs(elegido - spot))) elegido = precio;
  }
  return elegido;
}

export function nivelesEtf(json, ahora, r = R, claveVence) {
  const { spot, contratos, vence } = contratosDeVencimiento(json, ahora, claveVence || hoyET(ahora));
  if (!contratos.length) return { spot, contratos: 0, call: null, put: null, top: null, zeroGamma: null, zgMs: 0, vence };
  const porStrike = new Map();
  for (const c of contratos) {
    const gamma = c.gamma > 0 ? c.gamma : gammaBS(spot, c.strike, c.iv, c.T, r);
    const g = gexDe(gamma, c.oi, spot);
    const x = porStrike.get(c.strike) || { call: 0, put: 0 };
    if (c.tipo === 'C') x.call += g; else x.put -= g;
    porStrike.set(c.strike, x);
  }
  return {
    spot,
    contratos: contratos.length,
    call: mejor(porStrike, x => x.call),
    put: mejor(porStrike, x => Math.abs(x.put)),
    top: mejor(porStrike, x => Math.abs(x.call + x.put)),
    ...(() => { const t = Date.now(); const zg = zeroGamma(contratos, spot, r); return { zeroGamma: zg, zgMs: Date.now() - t }; })(),
    vence,
  };
}

// NQ = ETF × (NQ ÷ ETF), redondeado a 0.25 (solo para el registro y la referencia; el Pine convierte en vivo).
export function aNq(nivel, nq, etf) {
  if (!(nivel > 0) || !(nq > 0) || !(etf > 0)) return null;
  return Math.round(nivel * (nq / etf) * 4) / 4;
}

export function valoresInputs(q, s) {
  const r2 = v => (v > 0 ? Math.round(v * 100) / 100 : 0);
  return {
    qqqCall: r2(q && q.call), qqqPut: r2(q && q.put), qqqTop: r2(q && q.top),
    spyCall: r2(s && s.call), spyPut: r2(s && s.put), spyTop: r2(s && s.top),
    qqqZG: r2(q && q.zeroGamma), spyZG: r2(s && s.zeroGamma),
  };
}

// Escribe los 8 niveles (y Mode = Live ratio) en el estudio «Gex - Put/Call Walls» del gráfico activo.
export function expresionAplicar(valores, { nombre = GEX_WALLS_NOMBRE, studyId = '' } = {}) {
  const job = JSON.stringify({ nombre, studyId: String(studyId || ''), valores, inputs: INPUTS });
  return `(async function(){
    var J=${job};
    var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return {ok:false,motivo:'sin-tv'};
    var c=null; try{ c=api.activeChart(); }catch(e){} if(!c) return {ok:false,motivo:'sin-tv'};
    function buscar(){
      var lista=[]; try{ lista=c.getAllStudies()||[]; }catch(e){}
      for(var i=0;i<lista.length;i++){ var s=lista[i]||{}; var n=String(s.name||s.title||s.description||'').trim().toLowerCase();
        if((J.studyId && String(s.id)===J.studyId) || n===J.nombre.toLowerCase()) return String(s.id); }
      return '';
    }
    function lee(st){ try{ if(st&&typeof st.isVisible==='function') return st.isVisible()!==false; }catch(e){} return null; }
    // TradingView puede devolver los decimales un poco distintos (float32): se compara con tolerancia de medio centavo.
    function igual(a,b){
      if(typeof b==='number'||typeof a==='number'){ var x=Number(a), y=Number(b); return isFinite(x)&&isFinite(y)&&Math.abs(x-y)<=0.005; }
      return String(a)===String(b);
    }
    var id=buscar(); if(!id) return {ok:false,motivo:'no está en el gráfico'};
    var st=null; try{ st=c.getStudyById(id); }catch(e){}
    if(!st||typeof st.getInputValues!=='function'||typeof st.setInputValues!=='function') return {ok:false,motivo:'sin inputs'};
    var nombres={}; try{ var info=typeof st.getInputsInfo==='function'?st.getInputsInfo():[]; for(var k=0;k<info.length;k++){ var it=info[k]; if(it&&it.type!=='color'&&it.name&&!nombres[it.name]) nombres[it.name]=it.id; } }catch(e){}
    var ids={}; ids.mode=nombres['Mode']||'in_0';
    for(var m=0;m<J.inputs.length;m++){ ids[J.inputs[m][1]]=nombres[J.inputs[m][0]]||('in_'+(m+1)); }
    var actual=st.getInputValues()||[]; var quiero={}; quiero[ids.mode]='Live ratio';
    for(var m2=0;m2<J.inputs.length;m2++){ var clave=J.inputs[m2][1]; quiero[ids[clave]]=J.valores[clave]; }
    var vistos=0;
    for(var a=0;a<actual.length;a++){ if(Object.prototype.hasOwnProperty.call(quiero,actual[a].id)){ actual[a].value=quiero[actual[a].id]; vistos++; } }
    if(vistos<J.inputs.length+1) return {ok:false,motivo:'inputs distintos ('+vistos+')'};
    var antes=st.getInputValues()||[]; var iguales=0;
    for(var q=0;q<antes.length;q++){ if(Object.prototype.hasOwnProperty.call(quiero,antes[q].id) && igual(antes[q].value,quiero[antes[q].id])) iguales++; }
    if(iguales===vistos) return {ok:true, studyId:id, aplicados:iguales, cambio:false, visible:lee(st), motivo:''};
    // El ojo manda: lo que tenía antes de escribir (visible u oculto) es lo que queda después.
    var vis=lee(st);
    st.setInputValues(actual);
    await new Promise(function(r){ setTimeout(r,300); });
    var id2=buscar()||id; var st2=null; try{ st2=c.getStudyById(id2); }catch(e){}
    var restaurado=false;
    if(vis!==null && st2 && lee(st2)!==vis){
      try{ st2.setVisible(vis); restaurado=true; }catch(e){}
      if(lee(st2)!==vis){ try{
        var w=api._activeChartWidgetWV.value()._chartWidget; var mo=w.model(); var inner=mo.model?mo.model():mo; var all=inner.dataSources?inner.dataSources():[];
        for(var z=0;z<all.length;z++){ var sid=''; try{ sid=all[z].id&&(typeof all[z].id==='function'?all[z].id():all[z].id); }catch(e){}
          if(String(sid)===String(id2)){ var pv=all[z].properties&&all[z].properties().visible; if(pv&&typeof pv.setValue==='function'){ pv.setValue(vis); restaurado=true; } } }
      }catch(e){} }
    }
    var despues=(st2&&st2.getInputValues&&st2.getInputValues())||[]; var bien=0;
    for(var b=0;b<despues.length;b++){ if(Object.prototype.hasOwnProperty.call(quiero,despues[b].id) && igual(despues[b].value,quiero[despues[b].id])) bien++; }
    return {ok:bien===vistos, studyId:id2, aplicados:bien, cambio:true, restaurado:restaurado, visible:lee(st2), motivo:bien===vistos?'':'no se confirmaron los inputs'};
  })()`;
}

export async function bajarEtf(sym, fetchImpl = globalThis.fetch) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  let res;
  try { res = await fetchImpl(URLS[sym], { headers: CABECERAS, signal: ac.signal }); }
  finally { clearTimeout(timer); }
  if (!res || !res.ok) throw new Error(`${sym} HTTP ${res && res.status ? res.status : 'sin respuesta'}`);
  const texto = await res.text();
  let json;
  try { json = JSON.parse(texto); } catch { throw new Error(`${sym} JSON inválido`); }
  return { json, bytes: Buffer.byteLength(texto), ms: Date.now() - t0 };
}

function n2(v) { return v == null || !Number.isFinite(v) ? '—' : (Math.round(v * 100) / 100).toString(); }
export function lineaWalls(r) {
  const at = r.at || new Date().toISOString();
  const cab = `${at} walls ${r.turno || 'arranque'}`;
  if (r.error && r.qqqMs == null) return `${cab} error: ${r.error}`;
  const q = r.qqq || {}; const s = r.spy || {};
  const t = `descarga QQQ ${r.qqqMs} ms · SPY ${r.spyMs} ms · cálculo ${r.calculoMs} ms (zero γ ${r.zgMs} ms) · aplicar ${r.aplicarMs == null ? '—' : r.aplicarMs + ' ms'} · total ${r.totalMs} ms`;
  const niv = `QQQ ${n2(q.spot)} call ${n2(q.call)} put ${n2(q.put)} top ${n2(q.top)} zg ${n2(q.zeroGamma)} (${q.contratos || 0}) · SPY ${n2(s.spot)} call ${n2(s.call)} put ${n2(s.put)} top ${n2(s.top)} zg ${n2(s.zeroGamma)} (${s.contratos || 0})`;
  return `${cab} ${t} · ${niv}${r.error ? ` · error: ${r.error}` : r.nota ? ` · ${r.nota}` : ''}`;
}

const GUARDADO = 'gex-niveles.json';
function leerGuardado(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, GUARDADO), 'utf8'));
    if (!j || !j.valores || typeof j.valores !== 'object' || !j.turno) return null;
    const ok = INPUTS.every(([, k]) => Number.isFinite(Number(j.valores[k])));
    if (!ok) return null;
    return { turno: String(j.turno), at: String(j.at || ''), valores: j.valores, qqq: {}, spy: {}, qqqMs: 0, spyMs: 0, calculoMs: 0, zgMs: 0, t0: Date.now() };
  } catch { return null; }
}
function guardar(dir, u) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `${GUARDADO}.tmp-${process.pid}`);
    fs.writeFileSync(tmp, JSON.stringify({ turno: u.turno, at: u.at, valores: u.valores }));
    fs.renameSync(tmp, path.join(dir, GUARDADO));
  } catch {}
}

function anotar(dir, texto) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, LOG), texto + '\n'); } catch {}
}

export function crearGexWalls(opts = {}) {
  if (!opts.dir) throw new Error('gex-walls: falta dir');
  const ahora = opts.ahora || (() => Date.now());
  const bloqueado = opts.bloqueado || (() => false); // panel de operar o trade abierto
  const bajar = opts.bajar || (sym => bajarEtf(sym, opts.fetch));
  const aplicar = opts.aplicar || (async () => ({ ok: false, motivo: 'sin-tv' }));
  const horas = opts.horas || HORAS_ET;
  let hecho = null; // turno ya calculado
  let arranque = true;
  // Lo último calculado se guarda: tras un reinicio, una actualización del indicador o un feriado se vuelve a poner lo de antes.
  let ultimo = leerGuardado(opts.dir); // { turno, at, valores, qqq, spy }
  let aplicadoFirma = '';
  let estadoTxt = 'pendiente';
  let ocupado = false;
  let timer = null;
  let falloHasta = 0;
  let ultimoMotivo = '';
  let verificado = 0;
  let aplicarFalloHasta = 0;

  async function calcular(turno, { reserva = false } = {}) {
    const t0 = ahora();
    const at = new Date(t0).toISOString();
    let qqqP, spyP;
    try {
      [qqqP, spyP] = await Promise.all([bajar('QQQ'), bajar('SPY')]);
    } catch (e) {
      const linea = lineaWalls({ at, turno, error: String(e && e.message || e) });
      anotar(opts.dir, linea);
      estadoTxt = 'error. No pude bajar CBOE. Lo reintento.';
      return { error: String(e && e.message || e), linea };
    }
    const tC = ahora();
    let qqq, spy, zgMs = 0, nota = '';
    try {
      qqq = nivelesEtf(qqqP.json, t0);
      spy = nivelesEtf(spyP.json, t0);
      if (!qqq.contratos && !spy.contratos && reserva) {
        const candidatos = [];
        try { const p = proximoVencimiento(qqqP.json, t0); if (p) candidatos.push(p); } catch {}
        try { const p = proximoVencimiento(spyP.json, t0); if (p) candidatos.push(p); } catch {}
        candidatos.sort((a, b) => a.vence - b.vence);
        const elegido = candidatos[0];
        if (elegido) {
          qqq = nivelesEtf(qqqP.json, t0, R, elegido.clave);
          spy = nivelesEtf(spyP.json, t0, R, elegido.clave);
          nota = `ultimo dato (vencimiento ${elegido.clave})`;
        }
      }
      zgMs = (qqq.zgMs || 0) + (spy.zgMs || 0);
    } catch (e) {
      const linea = lineaWalls({ at, turno, qqqMs: qqqP.ms, spyMs: spyP.ms, calculoMs: ahora() - tC, zgMs: 0, totalMs: ahora() - t0, error: String(e && e.message || e) });
      anotar(opts.dir, linea);
      return { error: String(e && e.message || e), linea };
    }
    const calculoMs = ahora() - tC;
    return { at, turno, t0, qqq, spy, qqqMs: qqqP.ms, spyMs: spyP.ms, calculoMs, zgMs, valores: valoresInputs(qqq, spy), nota };
  }

  async function correr() {
    if (ocupado) return { saltado: 'ocupado' };
    ocupado = true;
    try {
      const t = ahora();
      const turno = turnoActual(t, horas);
      // En un feriado o al instalar por primera vez, si no hay niveles guardados, se calculan los del vencimiento más próximo.
      const toca = turno ? turno !== hecho : (arranque && (diaDeMercado(t) || !ultimo));
      const verificar = ultimo && aplicadoFirma === firma(ultimo) && t - verificado >= (opts.verificarMs || 2 * 60 * 1000);
      if (!toca && !verificar && (!ultimo || aplicadoFirma === firma(ultimo))) return { nada: true };
      if (bloqueado()) { estadoTxt = 'pendiente. Espera a que cierres el panel de operar.'; return { saltado: 'panel' }; }
      if (toca) {
        if (t < falloHasta) return { espera: true };
        const r = await calcular(turno || 'arranque', { reserva: !ultimo });
        if (r.error) { falloHasta = ahora() + (opts.reintentoMs || 2 * 60 * 1000); return r; }
        hecho = turno; arranque = false;
        if (!r.qqq.contratos && !r.spy.contratos) {
          const linea = lineaWalls({ ...r, aplicarMs: null, totalMs: ahora() - r.t0, nota: 'sin opciones 0DTE hoy' });
          anotar(opts.dir, linea);
          estadoTxt = 'pendiente. Hoy no hay opciones 0DTE.';
          return { sin0dte: true, linea };
        }
        ultimo = r;
        guardar(opts.dir, ultimo);
      }
      if (bloqueado()) { estadoTxt = 'pendiente. Espera a que cierres el panel de operar.'; return { saltado: 'panel' }; }
      // Si aplicar falló, no se vuelve a escribir en el estudio en cada vuelta de 15 s: se espera (por defecto 2 min).
      if (!toca && t < aplicarFalloHasta) return { espera: true };
      const tA = ahora();
      let res;
      try { res = await aplicar(ultimo.valores); } catch (e) { res = { ok: false, motivo: String(e && e.message || e) }; }
      const aplicarMs = ahora() - tA;
      const motivo = res && res.ok ? '' : `aplicar: ${(res && res.motivo) || 'error'}`;
      const nota = [toca ? (ultimo.nota || '') : 'reaplicado', res && res.restaurado ? 'ojo restaurado' : '', res && res.visible === false ? 'oculto' : ''].filter(Boolean).join(' · ');
      const linea = lineaWalls({ ...ultimo, aplicarMs, totalMs: toca ? ahora() - ultimo.t0 : aplicarMs, error: motivo, nota });
      const cambio = !!(res && res.ok && res.cambio !== false);
      if (toca || motivo !== ultimoMotivo || cambio) anotar(opts.dir, linea);
      ultimoMotivo = motivo;
      verificado = ahora();
      aplicarFalloHasta = res && res.ok ? 0 : ahora() + (opts.reintentoAplicarMs || 2 * 60 * 1000);
      if (res && res.ok) { aplicadoFirma = firma(ultimo); estadoTxt = 'instalado'; return { ok: true, cambio, linea }; }
      estadoTxt = `pendiente. ${(res && res.motivo) || 'error'}`;
      return { error: (res && res.motivo) || 'error', linea };
    } finally { ocupado = false; }
  }
  function firma(u) { return u ? `${u.turno}|${JSON.stringify(u.valores)}` : ''; }
  // Si el estudio se reinstaló o TradingView se reabrió, se vuelve a aplicar lo último.
  function olvidarAplicado() { aplicadoFirma = ''; }
  function arrancar() {
    correr().catch(() => {});
    timer = setInterval(() => { correr().catch(() => {}); }, opts.cadaMs || 15000);
    return api;
  }
  function detener() { if (timer) clearInterval(timer); timer = null; }
  function estado() {
    return { ok: true, turno: ultimo ? ultimo.turno : null, at: ultimo ? ultimo.at : null, valores: ultimo ? ultimo.valores : null, aplicado: !!aplicadoFirma && aplicadoFirma === firma(ultimo), texto: estadoTxt };
  }
  const api = { correr, arrancar, detener, estado, olvidarAplicado };
  return api;
}
