// tv-reporte.mjs — Reporte de trades en TradingView.
// Dibuja UNA vez el cierre que acaba de confirmarse (granja o, si el bróker avisa en vivo, manual).
// No barre el historial ni vigila dibujos ya hechos. Si faltan fills o TradingView no responde,
// el cierre queda pendiente y se reintenta al volver a avisar o al reconectar la escucha.
// No repone un dibujo ya hecho. No coloca, modifica ni cancela órdenes. Si este módulo falla, el motor sigue.
//
// Frase de mantenimiento: «reporte trades en TradingView» = este archivo.
import fs from 'node:fs';
import path from 'node:path';

export const MODULO = 'tv-reporte';
export const TITULO = 'Reporte de trades en TradingView';
export const GRUPO = 'reporte';
export const ESTILO = 'unified-box-v2-outside';
export const ARCHIVO = 'tv-reporte.json';
// Reintentos dentro del mismo cierre, antes de crear dibujos (fills o chart aún vacíos).
// Si faltan fills o TradingView no responde, no se memoriza como omitido: se reintenta
// en un aviso posterior o al reconectar la escucha. El dibujo en sí se envía una sola vez.
export const ESPERAS_MS = [0, 350, 800, 2000, 5000];
export const RAZONES_TRANSITORIAS = ['sin fills del cierre', 'TradingView no disponible', 'chart no listo', 'sin chart'];
export const esTransitorio = razon => RAZONES_TRANSITORIAS.includes(String(razon || ''));
const CAJA_DESPUES_S = 300;
const ETIQUETA_DESPUES_S = 360;
const VENTANA_CIERRE_MS = 15000;

// Valor por punto y tick que este repo ya usa para esos contratos. Sin esto no hay P&L exacto ni caja.
const META = {
  MNQ: { pv: 2, tick: 0.25 },
  MES: { pv: 5, tick: 0.25 },
  MYM: { pv: 0.5, tick: 1 },
  M2K: { pv: 5, tick: 0.1 },
  NQ: { pv: 20, tick: 0.25 },
  ES: { pv: 50, tick: 0.25 },
  RTY: { pv: 50, tick: 0.1 },
  YM: { pv: 5, tick: 1 },
};
const CLAVES = Object.keys(META);

const PROHIBIDO = /placeOrder|modifyOrder|editPositionBrackets|closePosition|cancelOrder|createEditOrderContext|setCurrentAccount|removeAllShapes|setSymbol/;

export function rootOf(symbol) {
  const x = String(symbol || '').toUpperCase().replace(/^.*:/, '');
  for (const k of CLAVES) {
    if (!x.startsWith(k)) continue;
    const rest = x.slice(k.length);
    if (rest === '' || rest === '1!' || /^[FGHJKMNQUVXZ]\d{1,4}$/.test(rest)) return k;
  }
  return null;
}
export const metaDe = symbol => META[rootOf(symbol)] || null;

export function sufijoCuenta(nombre) {
  const s = String(nombre || '').replace(/\s/g, '');
  return s ? s.slice(-3) : null;
}
export function maskCuenta(nombre) {
  const s = String(nombre || '');
  const m = s.match(/\b(LF[EF]\d)\d+(\d{3})\b/);
  if (m) return `${m[1]}…${m[2]}`;
  if (s.length <= 7) return s ? `…${s.slice(-3)}` : '';
  return `${s.slice(0, 4)}…${s.slice(-3)}`;
}

const msDe = t => {
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
};
const ladoDe = s => {
  if (s === 1 || s === '1' || s === 'buy' || s === 'BUY' || s === 'long') return 1;
  if (s === -1 || s === '-1' || s === 'sell' || s === 'SELL' || s === 'short') return -1;
  const n = Number(s);
  return n === 1 || n === -1 ? n : null;
};

export function horaET(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return `${p.hour}:${p.minute}:${p.second}`;
}
export function textoDuracion(entryMs, exitMs) {
  if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs) || exitMs < entryMs) return null;
  const s = Math.round((exitMs - entryMs) / 1000);
  if (s < 60) return `Duration: ${s}s`;
  const m = Math.floor(s / 60);
  return `Duration: ${m}m ${String(s % 60).padStart(2, '0')}s`;
}
export function textoPnl(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const a = Math.round(Math.abs(n) * 100) / 100;
  const s = Number.isInteger(a) ? String(a) : String(a);
  return `${n >= 0 ? '+' : '-'}$${s}`;
}
export function colorPnl(n) { return n >= 0 ? '#26a69a' : '#ef5350'; }

function precioMedio(parts) {
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0].price;
  let q = 0, n = 0;
  for (const p of parts) { q += p.qty; n += p.price * p.qty; }
  return q ? n / q : null;
}

// Trades cerrados (posición otra vez en cero) a partir de fills del bróker. No inventa P&L.
export function cierresDeFills(lista, meta = {}) {
  const fills = [];
  const vistos = new Set();
  for (const raw of lista || []) {
    if (!raw) continue;
    const id = raw.id != null ? String(raw.id) : '';
    if (id && vistos.has(id)) continue;
    if (id) vistos.add(id);
    const side = ladoDe(raw.side);
    const qty = Math.abs(Number(raw.qty));
    const price = Number(raw.price);
    const time = msDe(raw.time);
    if (!side || !(qty > 0) || !Number.isFinite(price) || time == null) continue;
    if (!raw.symbol || !metaDe(raw.symbol)) continue;
    fills.push({ id, symbol: String(raw.symbol), side, qty, price, time });
  }
  fills.sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : 1));
  const by = new Map();
  for (const f of fills) {
    const k = `${f.symbol}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(f);
  }
  const out = [];
  for (const [, grupo] of by) {
    let pos = 0, cash = 0, lot = null;
    const abrir = f => { lot = { symbol: f.symbol, side: f.side > 0 ? 'long' : 'short', entry: [], exit: [] }; cash = 0; };
    const emitir = () => {
      const metaS = metaDe(lot.symbol);
      const entry = precioMedio(lot.entry);
      const exit = precioMedio(lot.exit);
      const qty = lot.entry.reduce((a, p) => a + p.qty, 0);
      if (!metaS || entry == null || exit == null || !(qty > 0)) { lot = null; return; }
      const entryMs = lot.entry[0].time;
      const exitMs = lot.exit[lot.exit.length - 1].time;
      const pnl = Math.round(cash * metaS.pv * 100) / 100;
      const entryIds = [...new Set(lot.entry.map(p => p.id).filter(Boolean))];
      const exitIds = [...new Set(lot.exit.map(p => p.id).filter(Boolean))];
      out.push({
        symbol: lot.symbol, root: rootOf(lot.symbol), side: lot.side, qty,
        entry, exit: exit, entryMs, exitMs, pnl, pnlFuente: 'bruto fills',
        entryIds, exitIds,
        cuenta: meta.cuenta || null, accountId: meta.accountId || null,
      });
      lot = null;
    };
    for (const f of grupo) {
      let left = f.qty;
      while (left > 1e-9) {
        if (pos === 0 || Math.sign(pos) === f.side) {
          if (pos === 0) abrir(f);
          lot.entry.push({ price: f.price, qty: left, id: f.id, time: f.time });
          cash -= f.side * left * f.price;
          pos += f.side * left;
          left = 0;
        } else {
          const add = Math.min(left, Math.abs(pos));
          lot.exit.push({ price: f.price, qty: add, id: f.id, time: f.time });
          cash -= f.side * add * f.price;
          pos += f.side * add;
          left -= add;
          if (Math.abs(pos) < 1e-9) { pos = 0; emitir(); }
        }
      }
    }
  }
  return out;
}

export function claveTrade(t) {
  const acct = t.accountId || t.cuenta || '';
  const ids = [...(t.entryIds || []), ...(t.exitIds || [])].map(String).filter(Boolean).sort();
  if (ids.length) return `fills:${acct}|${t.symbol}|${ids.join(',')}`;
  return `fills:${acct}|${t.symbol}|${t.side}|${t.entryMs}|${t.exitMs}|${t.entry}|${t.exit}|${t.qty}`;
}

export function nivelesConocidos(ev) {
  let sl = null, tp = null;
  if (ev) {
    if (typeof ev.slVisto === 'number' && Number.isFinite(ev.slVisto)) sl = ev.slVisto;
    else if (ev.ajuste && (ev.ajuste.nada || (ev.ajuste.sl && ev.ajuste.sl.ok)) && typeof ev.ajuste.slNuevo === 'number') sl = ev.ajuste.slNuevo;
    if (typeof ev.tpVisto === 'number' && Number.isFinite(ev.tpVisto)) tp = ev.tpVisto;
    else if (ev.ajuste && (ev.ajuste.nada || (ev.ajuste.tp && ev.ajuste.tp.ok)) && typeof ev.ajuste.tpNuevo === 'number') tp = ev.ajuste.tpNuevo;
  }
  return { sl, tp };
}
function ticksExactos(entry, nivel, tick) {
  if (typeof nivel !== 'number' || !Number.isFinite(nivel) || !(tick > 0)) return null;
  const n = Math.abs(nivel - entry) / tick;
  const r = Math.round(n);
  if (r <= 0 || Math.abs(n - r) > 1e-6) return null;
  return r;
}

export function elegirCierre(trips, ev, ahora) {
  if (!ev) return null;
  const root = rootOf(ev.symbol);
  if (!root) return null;
  const closeAt = Number.isFinite(ev.closeAt) ? ev.closeAt : ahora;
  const tick = (META[root] && META[root].tick) || 0.25;
  let best = null, bestD = Infinity;
  for (const t of trips || []) {
    if (t.root !== root || (ev.side && t.side !== ev.side)) continue;
    if (ev.cuenta && t.cuenta && String(ev.cuenta) !== String(t.cuenta)) continue;
    const d = Math.abs(t.exitMs - closeAt);
    if (d > VENTANA_CIERRE_MS) continue;
    if (typeof ev.entry === 'number' && Number.isFinite(ev.entry) && Math.abs(t.entry - ev.entry) > tick * 8) continue;
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}

export function eventoDesdeGranja(s) {
  if (!s || s.cerrado !== true) return null;
  const side = s.side === 'long' || s.side === 'short' ? s.side : (s.direccion === 'COMPRA' ? 'long' : s.direccion === 'VENTA' ? 'short' : null);
  const symbol = s.symbol || ((String(s.tamano || '').match(/\b(MNQ|MES|MYM|M2K|NQ|ES|RTY|YM)\b/) || [])[1] || null);
  if (!side || !symbol || typeof s.entrada !== 'number' || !Number.isFinite(s.entrada)) return null;
  const openAt = s.abiertaEn ? Date.parse(s.abiertaEn) : null;
  const closeAt = s.cerradaEn ? Date.parse(s.cerradaEn) : (s.fin ? Date.parse(s.fin) : null);
  return {
    origen: 'granja', cuenta: s.cuenta || null, accountId: s.accountId || null, symbol, side,
    qty: s.qty ?? null, entry: s.entrada,
    openAt: Number.isFinite(openAt) ? openAt : null,
    closeAt: Number.isFinite(closeAt) ? closeAt : null,
    slVisto: typeof s.slVisto === 'number' ? s.slVisto : null,
    tpVisto: typeof s.tpVisto === 'number' ? s.tpVisto : null,
    ajuste: s.ajusteFill || null,
  };
}
function normalizar(s) {
  if (!s) return null;
  if (s.origen === 'manual') {
    if (!s.symbol || (s.side !== 'long' && s.side !== 'short')) return null;
    return s;
  }
  if (s.origen === 'granja') return s.symbol && s.side && typeof s.entry === 'number' ? s : null;
  return eventoDesdeGranja(s);
}

export function normalizarCharts(raw) {
  return (raw || []).map((c, i) => {
    const symbol = c && c.symbol ? String(c.symbol) : '';
    const root = rootOf(symbol);
    return { index: c && c.index != null ? c.index : i, symbol, root, ready: !!(symbol && root), active: !!(c && c.active) };
  });
}
export function elegirChart(charts, root) {
  const list = Array.isArray(charts) && charts[0] && 'ready' in charts[0] ? charts : normalizarCharts(charts);
  const ready = list.filter(c => c.ready && c.root === root);
  return ready.find(c => c.active) || ready[0] || null;
}
export function chartBloquea(charts, root) {
  const list = normalizarCharts(charts);
  const chart = elegirChart(list, root);
  if (chart) return { ok: true, chart, list };
  const conSimbolo = list.filter(c => c.symbol);
  if (conSimbolo.some(c => c.root && c.root !== root)) return { ok: false, retry: false, razon: 'simbolo distinto', list };
  return { ok: false, retry: true, razon: conSimbolo.length ? 'chart no listo' : 'sin chart', list };
}

export function planDibujo(trade) {
  const meta = META[trade.root] || metaDe(trade.symbol);
  const dur = textoDuracion(trade.entryMs, trade.exitMs);
  const pnlTxt = textoPnl(trade.pnl);
  if (!meta || !dur || !pnlTxt || !Number.isFinite(trade.entry) || !Number.isFinite(trade.exit)) return null;
  const entryS = Math.round(trade.entryMs / 1000);
  const exitS = Math.round(trade.exitMs / 1000);
  const suf = sufijoCuenta(trade.cuenta);
  const info = `#${trade.n} ${trade.side === 'long' ? 'LONG' : 'SHORT'} x${Number.isInteger(trade.qty) ? trade.qty : trade.qty} ${horaET(trade.entryMs)} ET${suf ? ` ..${suf}` : ''}\n${dur}\n\n `;
  const col = colorPnl(trade.pnl);
  const largo = trade.side === 'long';
  let position = null;
  const slT = ticksExactos(trade.entry, trade.sl, meta.tick);
  const tpT = ticksExactos(trade.entry, trade.tp, meta.tick);
  const ladoOk = slT != null && tpT != null && (
    (largo && trade.sl < trade.entry && trade.tp > trade.entry) ||
    (!largo && trade.sl > trade.entry && trade.tp < trade.entry)
  );
  if (ladoOk) {
    position = {
      shape: largo ? 'long_position' : 'short_position',
      points: [{ time: entryS, price: trade.entry }, { time: exitS + CAJA_DESPUES_S, price: trade.entry }],
      stopLevel: slT, profitLevel: tpT, qty: trade.qty,
    };
  }
  return {
    estilo: ESTILO, titulo: TITULO, grupo: GRUPO, root: trade.root, n: trade.n,
    etiquetaEn: exitS + ETIQUETA_DESPUES_S, cajaHasta: exitS + CAJA_DESPUES_S,
    arrow: { shape: largo ? 'arrow_up' : 'arrow_down', time: entryS, price: trade.entry, color: '#2962ff' },
    info: { time: exitS + ETIQUETA_DESPUES_S, price: trade.exit, text: info },
    pnl: { time: exitS + ETIQUETA_DESPUES_S, price: trade.exit, text: `\n\n${pnlTxt}`, color: col },
    line: { shape: 'trend_line', points: [{ time: entryS, price: trade.entry }, { time: exitS, price: trade.exit }], color: col },
    position,
    marker: info.split('\n')[0],
  };
}

export function pasosDibujo(plan) {
  if (!plan) return [];
  const pasos = [
    { op: 'shape', point: { time: plan.arrow.time, price: plan.arrow.price }, opts: { shape: plan.arrow.shape, text: '', lock: false, overrides: { color: plan.arrow.color, arrowColor: plan.arrow.color } } },
    { op: 'shape', point: { time: plan.info.time, price: plan.info.price }, opts: { shape: 'text', text: plan.info.text, lock: false, overrides: {
      color: '#ffffff', fontsize: 13, bold: true, fillBackground: true, backgroundColor: 'rgba(15,20,40,0.95)', backgroundTransparency: 5,
      drawBorder: true, borderColor: '#2962ff', wordWrap: true, wordWrapWidth: 260,
    } } },
    { op: 'shape', point: { time: plan.pnl.time, price: plan.pnl.price }, opts: { shape: 'text', text: plan.pnl.text, lock: false, overrides: {
      color: plan.pnl.color, fontsize: 14, bold: true, fillBackground: false, drawBorder: false, backgroundTransparency: 100,
      wordWrap: true, wordWrapWidth: 260,
    } } },
    { op: 'multipoint', points: plan.line.points, opts: { shape: 'trend_line', lock: false, overrides: { linecolor: plan.line.color, linewidth: 2 } } },
  ];
  if (plan.position) {
    pasos.push({ op: 'multipoint', points: plan.position.points, opts: { shape: plan.position.shape, lock: false, overrides: { stopLevel: plan.position.stopLevel, profitLevel: plan.position.profitLevel, qty: plan.position.qty } } });
  }
  pasos.push({ op: 'frente' }, { op: 'nombre', title: GRUPO }, { op: 'guardar' });
  return pasos;
}

export function expresionDibujo(plan, chartIndex) {
  const job = JSON.stringify({ root: plan.root, chartIndex: chartIndex ?? null, pasos: pasosDibujo(plan), grupo: GRUPO });
  return `(async function(){
    var JOB=${job};
    var CLAVES=${JSON.stringify(CLAVES)};
    function rootOf(symbol){
      var x=String(symbol||'').toUpperCase().replace(/^.*:/,'');
      for(var i=0;i<CLAVES.length;i++){
        var k=CLAVES[i]; if(x.slice(0,k.length)!==k) continue;
        var rest=x.slice(k.length);
        if(rest===''||rest==='1!'||/^[FGHJKMNQUVXZ]\\d{1,4}$/.test(rest)) return k;
      }
      return null;
    }
    function chart(){
      var api=window.TradingViewApi; if(!api) return null;
      var c=null;
      try{ if(JOB.chartIndex!=null && typeof api.chart==='function') c=api.chart(JOB.chartIndex); }catch(e){}
      if(!c){ try{ c=api.activeChart(); }catch(e2){} }
      return c;
    }
    function guardar(c){
      var out={method:null,layoutId:null,called:false,note:'El dibujo queda en el gráfico. Permanece si TradingView guarda el layout (autoguardado o Guardar). No es para siempre: si se borra el dibujo o el layout, no se vuelve a crear.'};
      var api=window.TradingViewApi||{}; var id=null;
      try{ var col=api._chartWidgetCollection; var m=col&&col.metaInfo&&col.metaInfo(); if(m&&(m.id||m.uid)) id=String(m.id||m.uid); }catch(e){}
      out.layoutId=id;
      if(!id){ out.note='Sin id de layout: no se llama a saveChartToServer para no abrir un diálogo. El dibujo está en la sesión y solo sigue ahí si TradingView autoguarda o alguien guarda el layout.'; return out; }
      try{ if(typeof api.saveChartToServer==='function'){ api.saveChartToServer(); out.method='TradingViewApi.saveChartToServer'; out.called=true; return out; } }catch(e){ out.note=String(e&&e.message||e); }
      try{ var col2=api._chartWidgetCollection; if(col2&&typeof col2.saveChartToServer==='function'){ col2.saveChartToServer(); out.method='chartWidgetCollection.saveChartToServer'; out.called=true; return out; } }catch(e2){ out.note=String(e2&&e2.message||e2); }
      out.note='El layout tiene id pero esta página no expone saveChartToServer. El dibujo queda en la sesión.';
      return out;
    }
    var c=chart(); if(!c) return {ok:false,reason:'sin-chart',ids:[],partial:false};
    var creado=[];
    for(var intento=0; intento<2; intento++){
      creado=[];
      try{
        var sym=''; try{ sym=c.symbol()||''; }catch(e){ sym=''; }
        if(rootOf(sym)!==JOB.root) return {ok:false,reason:'simbolo',sym:sym,ids:[],partial:false};
        var save=null;
        for(var i=0;i<JOB.pasos.length;i++){
          var p=JOB.pasos[i], id=null;
          if(p.op==='shape'){ id=await c.createShape(p.point,p.opts); if(id==null) throw new Error('createShape'); creado.push(String(id)); }
          else if(p.op==='multipoint'){ id=await c.createMultipointShape(p.points,p.opts); if(id==null) throw new Error('createMultipointShape'); creado.push(String(id)); }
          else if(p.op==='frente'){
            try{ c.getSeries().sendToBack(); }catch(e1){}
            for(var j=0;j<creado.length;j++){ try{ c.getShapeById(creado[j]).bringToFront(); }catch(e2){} }
          }
          else if(p.op==='nombre'){
            var how=null;
            try{
              var ctl=c.shapesGroupController&&c.shapesGroupController();
              if(ctl&&typeof ctl.createGroup==='function'){
                var gid=ctl.createGroup(creado);
                if(gid&&typeof ctl.setGroupName==='function') ctl.setGroupName(gid, JOB.grupo);
                how='grupo';
              }
            }catch(e3){}
            if(!how){
              for(var t=0;t<creado.length;t++){
                try{
                  var sh=c.getShapeById(creado[t]); var pr=sh.getProperties&&sh.getProperties();
                  if(pr&&Object.prototype.hasOwnProperty.call(pr,'title')) sh.setProperties({title:JOB.grupo});
                }catch(e4){}
              }
            }
          }
          else if(p.op==='guardar'){ save=guardar(c); }
        }
        return {ok:true,ids:creado.slice(),save:save,partial:false};
      }catch(e){
        var left=[];
        for(var k=0;k<creado.length;k++){ try{ c.removeEntity(creado[k]); }catch(e5){ left.push(creado[k]); } }
        if(left.length) return {ok:false,partial:true,rolledBack:false,ids:left,error:String(e&&e.message||e)};
      }
    }
    return {ok:false,partial:false,rolledBack:true,ids:[]};
  })()`;
}

export function reducirPosiciones(mem, msg) {
  const prev = mem && mem.open ? mem.open : {};
  if (!msg || msg.lecturaOk === false || msg.reconexion) {
    const open = {};
    if (msg && msg.lecturaOk !== false && msg.reconexion) {
      for (const p of msg.positions || []) {
        const k = clavePos(p);
        if (k && Number(p.qty) > 0) open[k] = p;
      }
    } else if (!msg || msg.lecturaOk === false) {
      return { mem: { open: { ...prev } }, eventos: [] };
    }
    return { mem: { open }, eventos: [] };
  }
  const open = {};
  for (const p of msg.positions || []) {
    const k = clavePos(p);
    if (k && Number(p.qty) > 0) open[k] = { ...(prev[k] || {}), ...p };
  }
  const eventos = [];
  const ya = new Set();
  const empujar = src => {
    const k = clavePos(src);
    if (!k || open[k] || ya.has(k)) return;
    ya.add(k);
    const base = prev[k] || src;
    eventos.push({
      origen: 'manual', cuenta: base.cuenta || null, accountId: base.accountId || null,
      symbol: base.symbol, side: base.side, qty: base.qty ?? null, entry: typeof base.entry === 'number' ? base.entry : null,
      openAt: base.openAt ?? null, closeAt: msg.at || Date.now(),
      slVisto: typeof base.sl === 'number' ? base.sl : null,
      tpVisto: typeof base.tp === 'number' ? base.tp : null,
    });
  };
  for (const k of Object.keys(prev)) if (!open[k]) empujar(prev[k]);
  for (const c of msg.cierres || []) empujar(c);
  return { mem: { open }, eventos };
}
function claveProvisional(ev) {
  const root = rootOf(ev.symbol) || String(ev.symbol || '');
  const t = Number.isFinite(ev.closeAt) ? ev.closeAt : (Number.isFinite(ev.openAt) ? ev.openAt : 0);
  const bucket = t ? Math.round(t / 8000) * 8000 : 0;
  const entry = typeof ev.entry === 'number' && Number.isFinite(ev.entry) ? Math.round(ev.entry * 4) / 4 : '';
  return `omitido:${ev.accountId || ev.cuenta || ''}|${root}|${ev.side || ''}|${entry}|${bucket}`;
}
function clavePos(p) {
  if (!p || !p.symbol || (p.side !== 'long' && p.side !== 'short')) return null;
  const root = rootOf(p.symbol);
  if (!root) return null;
  return `${p.accountId || p.cuenta || ''}|${root}`;
}

function evPendiente(ev) {
  if (!ev) return null;
  return {
    origen: ev.origen || 'granja',
    accountId: ev.accountId || null,
    symbol: ev.symbol, side: ev.side, qty: ev.qty ?? null, entry: ev.entry,
    openAt: ev.openAt ?? null, closeAt: ev.closeAt ?? null,
    slVisto: ev.slVisto ?? null, tpVisto: ev.tpVisto ?? null,
    ajuste: ev.ajuste || null,
  };
}

function cargar(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!j || typeof j !== 'object') throw new Error('vacio');
    return { v: 1, modulo: MODULO, handled: j.handled && typeof j.handled === 'object' ? j.handled : {}, nextN: Number.isInteger(j.nextN) ? j.nextN : 1, bitacora: Array.isArray(j.bitacora) ? j.bitacora.slice(-40) : [], pending: j.pending && typeof j.pending === 'object' ? j.pending : {} };
  } catch {
    return { v: 1, modulo: MODULO, handled: {}, nextN: 1, bitacora: [], pending: {} };
  }
}
function guardar(file, st) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(st, null, 1));
  fs.renameSync(tmp, file);
}

export function createReporte(opts = {}) {
  if (!opts.dir) throw new Error('reporte: falta dir');
  const file = path.join(opts.dir, ARCHIVO);
  const now = opts.now || (() => Date.now());
  const sleep = opts.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const log = opts.log || (() => {});
  const st = cargar(file);
  let mem = { open: {} };
  let tail = Promise.resolve();
  let parado = false;
  const api = {
    archivo: file,
    estado: () => ({ handled: st.handled, nextN: st.nextN, bitacora: st.bitacora, pending: st.pending }),
    memoria: () => mem,
    alCerrar(raw) {
      const run = tail.then(() => uno(raw), () => uno(raw));
      tail = run.then(() => {}, () => {});
      return run;
    },
    onPosicion(msg) {
      try {
        const r = reducirPosiciones(mem, msg);
        mem = r.mem;
        let ocupado = null;
        try { ocupado = opts.raizOcupada ? opts.raizOcupada() : null; } catch { ocupado = null; }
        for (const ev of r.eventos) {
          if (ocupado && rootOf(ev.symbol) === ocupado) continue;
          api.alCerrar(ev);
        }
      } catch (e) { log('escucha', e && e.message); }
    },
    resetMemoria() { mem = { open: {} }; },
    detener() { parado = true; },
    get parado() { return parado; },
    async reintentarPendientes() {
      const items = Object.values(st.pending || {});
      if (!items.length) return { n: 0, resultados: [] };
      log('reintento de', items.length, 'cierre(s) pendiente(s)');
      const out = [];
      for (const p of items) {
        if (!p || !p.ev) continue;
        out.push(await api.alCerrar(p.ev));
      }
      return { n: out.length, resultados: out };
    },
  };
  function quitarPendiente(ev, extraKey) {
    if (!st.pending) return;
    const prov = ev && claveProvisional(ev);
    if (prov && st.pending[prov]) delete st.pending[prov];
    if (extraKey && st.pending[extraKey]) delete st.pending[extraKey];
  }
  function anotar(rec) {
    st.bitacora.push({ at: new Date(now()).toISOString(), ...rec });
    st.bitacora = st.bitacora.slice(-40);
    try { guardar(file, st); } catch (e) { log('no pude guardar el estado', e && e.message); }
  }
  async function uno(raw) {
    const t0 = now();
    const ev = normalizar(raw);
    if (!ev) return { status: 'ignorado', ms: now() - t0 };
    const prov = claveProvisional(ev);
    if (prov && st.handled[prov]) return { status: 'ya', key: prov, ms: now() - t0 };
    const root = rootOf(ev.symbol);
    if (!root || !META[root]) {
      const key = `omitido:${ev.accountId || ev.cuenta || ''}|${ev.symbol}|${ev.closeAt || ''}|${ev.entry || ''}`;
      if (!st.handled[key]) { st.handled[key] = { status: 'omitido', razon: 'sin valor por punto', at: new Date(now()).toISOString() }; anotar({ status: 'omitido', razon: 'sin valor por punto', cuenta: maskCuenta(ev.cuenta) }); }
      return { status: 'omitido', key, razon: 'sin valor por punto', ms: now() - t0 };
    }
    let trip = null, lastRazon = 'sin fills del cierre', lastFills = 0, bloqueo = null;
    for (let i = 0; i < ESPERAS_MS.length; i++) {
      if (i) await sleep(ESPERAS_MS[i]);
      if (!opts.readExec) { lastRazon = 'sin lector de fills'; break; }
      let pack = null;
      try { pack = await opts.readExec(); } catch (e) { lastRazon = 'TradingView no disponible'; lastFills = 0; continue; }
      if (pack && pack.error === 'no-api') { lastRazon = 'TradingView no disponible'; lastFills = 0; continue; }
      if (!pack || !Array.isArray(pack.ex)) { lastRazon = 'sin fills del cierre'; lastFills = 0; continue; }
      lastFills = pack.ex.length;
      const trips = cierresDeFills(pack.ex, { cuenta: pack.cuenta || ev.cuenta, accountId: pack.accountId || ev.accountId });
      const cuentaEv = { ...ev, cuenta: ev.cuenta || pack.cuenta || null, accountId: ev.accountId || pack.accountId || null };
      trip = elegirCierre(trips, cuentaEv, now());
      if (!trip) { lastRazon = 'sin fills del cierre'; continue; }
      Object.assign(ev, { cuenta: cuentaEv.cuenta, accountId: cuentaEv.accountId });
      const key = claveTrade(trip);
      if (st.handled[key]) { quitarPendiente(ev, prov); try { guardar(file, st); } catch {} return { status: 'ya', key, ms: now() - t0 }; }
      if (!opts.readCharts) { lastRazon = 'sin lector de chart'; break; }
      let charts = null;
      try { charts = await opts.readCharts(); } catch (e) { lastRazon = 'TradingView no disponible'; continue; }
      bloqueo = chartBloquea(charts, trip.root);
      if (!bloqueo.ok && bloqueo.retry) { lastRazon = bloqueo.razon; continue; }
      if (!bloqueo.ok) { lastRazon = bloqueo.razon; break; }
      const niv = nivelesConocidos(ev);
      const trade = { ...trip, cuenta: ev.cuenta, accountId: ev.accountId, sl: niv.sl, tp: niv.tp, n: st.nextN };
      const plan = planDibujo(trade);
      if (!plan) { lastRazon = 'datos incompletos'; break; }
      if (PROHIBIDO.test(expresionDibujo(plan, bloqueo.chart.index))) { lastRazon = 'expresion rechazada'; break; }
      let res = null;
      try {
        if (!opts.draw) { lastRazon = 'sin dibujo'; break; }
        res = await opts.draw(plan, bloqueo.chart);
      } catch (e) {
        st.handled[key] = { status: 'omitido', razon: 'dibujo no confirmado', at: new Date(now()).toISOString(), n: trade.n };
        anotar({ status: 'omitido', razon: 'dibujo no confirmado; no se reintenta para no duplicar', cuenta: maskCuenta(ev.cuenta), root: trip.root });
        return { status: 'omitido', key, razon: 'dibujo no confirmado', ms: now() - t0 };
      }
      if (res && res.ok && Array.isArray(res.ids) && res.ids.length) {
        st.nextN += 1;
        st.handled[key] = { status: 'dibujado', ids: res.ids, save: res.save || null, at: new Date(now()).toISOString(), n: trade.n, root: trip.root, cuenta: maskCuenta(ev.cuenta) };
        quitarPendiente(ev, prov);
        anotar({ status: 'dibujado', n: trade.n, root: trip.root, cuenta: maskCuenta(ev.cuenta), fills: lastFills, save: res.save && res.save.method || null });
        log('dibujado', 'n', trade.n, 'fills', lastFills, 'cuenta', maskCuenta(ev.cuenta), 'root', trip.root);
        return { status: 'dibujado', key, ids: res.ids, ms: now() - t0, save: res.save || null, fills: lastFills };
      }
      st.handled[key] = { status: res && res.partial ? 'parcial' : 'omitido', razon: (res && res.reason) || (res && res.error) || 'dibujo incompleto', ids: res && res.ids || [], at: new Date(now()).toISOString(), n: trade.n };
      anotar({ status: st.handled[key].status, razon: st.handled[key].razon, cuenta: maskCuenta(ev.cuenta), root: trip.root });
      return { status: st.handled[key].status, key, razon: st.handled[key].razon, ms: now() - t0 };
    }
    const key = prov || `omitido:${ev.accountId || ev.cuenta || ''}|${root}|${ev.side}|${ev.entry ?? ''}|${ev.closeAt ?? ''}`;
    if (esTransitorio(lastRazon)) {
      st.pending = st.pending || {};
      if (prov) st.pending[prov] = { ev: evPendiente(ev), razon: lastRazon, fills: lastFills, at: new Date(now()).toISOString() };
      anotar({ status: 'omitido', razon: lastRazon, transitorio: true, fills: lastFills, cuenta: maskCuenta(ev.cuenta), root });
      log('omitido transitorio', lastRazon, 'fills', lastFills, 'cuenta', maskCuenta(ev.cuenta), 'root', root, '(se reintenta)');
      return { status: 'omitido', key, razon: lastRazon, transitorio: true, fills: lastFills, ms: now() - t0 };
    }
    if (!st.handled[key]) {
      st.handled[key] = { status: 'omitido', razon: lastRazon, at: new Date(now()).toISOString() };
      quitarPendiente(ev, prov);
      anotar({ status: 'omitido', razon: lastRazon, fills: lastFills, cuenta: maskCuenta(ev.cuenta), root });
    }
    log('omitido', lastRazon, 'fills', lastFills, 'cuenta', maskCuenta(ev.cuenta), 'root', root);
    return { status: 'omitido', key, razon: lastRazon, ms: now() - t0, fills: lastFills };
  }
  return api;
}

export const READ_EXEC_JS = (PAGE) => `(async function(){${PAGE}
  var ab=tvBroker(tvTrading()); if(!ab) return {error:'no-api'};
  if(typeof ab.allExecutions!=='function'&&typeof ab.executions!=='function') return {error:'no-api'};
  var cuenta=null, accountId=null;
  try{ accountId=String(tvWv(ab.currentAccount())); }catch(e){}
  try{ var ms=await ab.accountsMetainfo(); var ci=accountId; (ms||[]).forEach(function(m){ if(String(m.id)===String(ci)) cuenta=m.name; }); }catch(e){}
  if(!cuenta){ try{ var n=document.querySelector('[class*=accountName]'); cuenta=n?n.innerText.trim():null; }catch(e){} }
  var l=null; try{ l=await ab.allExecutions(); }catch(e){}
  if(!l||!l.length){
    l=[];
    var sy=['CME_MINI:MNQZ2026','CME_MINI:NQZ2026'];
    try{ var w=window.TradingViewApi&&window.TradingViewApi._activeChartWidgetWV; var cs=w&&w.value&&w.value().symbol(); if(cs&&sy.indexOf(cs)<0) sy.push(cs); }catch(e){}
    try{ var c=window.TradingViewApi&&window.TradingViewApi.activeChart&&window.TradingViewApi.activeChart(); var s=c&&c.symbol&&c.symbol(); if(s&&sy.indexOf(s)<0) sy.push(s); }catch(e2){}
    for(var i=0;i<sy.length;i++){ try{ (await ab.executions(sy[i])||[]).forEach(function(x){ if(!l.some(function(y){ return String(y.id)===String(x.id); })) l.push(x); }); }catch(e){} }
  }
  return {cuenta:cuenta, accountId:accountId, ex:(l||[]).map(function(x){ return {id:String(x.id), symbol:x.symbol, price:+x.price, qty:Math.abs(+x.qty), side:+x.side, time:+x.time}; })};
})()`;

export const READ_CHARTS_JS = `(async function(){
  var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return [];
  var n=1; try{ n=typeof api.chartsCount==='function'?api.chartsCount():1; }catch(e){ n=1; }
  var active=null; try{ active=api.activeChart(); }catch(e){}
  var out=[];
  for(var i=0;i<n;i++){
    try{
      var c=typeof api.chart==='function'?api.chart(i):active;
      var sym=''; try{ sym=c.symbol()||''; }catch(e2){}
      var on=false; try{ on=c===active; }catch(e3){}
      out.push({index:i, symbol:sym, active:on});
    }catch(e){}
  }
  return out;
})()`;

export const JS_ESCUCHA = (PAGE) => `(async function(){${PAGE}
  if(window.__reporteU){ try{ window.__reporteU(); }catch(e){} }
  var ab=tvBroker(tvTrading()); if(!ab) return {ok:false,error:'no-api'};
  var cuenta=null, accountId=null;
  try{ accountId=String(tvWv(ab.currentAccount())); }catch(e){}
  try{ var n=document.querySelector('[class*=accountName]'); cuenta=n?n.innerText.trim():null; }catch(e){}
  var U=[], cache={};
  function slim(p){
    if(!p||!p.symbol||!(Math.abs(Number(p.qty))>0)) return null;
    var sd=Number(p.side)===1?'long':Number(p.side)===-1?'short':null; if(!sd) return null;
    return {cuenta:cuenta, accountId:accountId, symbol:p.symbol, side:sd, qty:Math.abs(Number(p.qty)), entry:typeof p.avgPrice==='number'?p.avgPrice:(typeof p.entry==='number'?p.entry:null), sl:typeof p.stopLoss==='number'?p.stopLoss:null, tp:typeof p.takeProfit==='number'?p.takeProfit:null};
  }
  async function emitir(reconexion){
    var ps=null; try{ ps=await ab.positions(); }catch(e){ try{ window.__reportePos(JSON.stringify({reconexion:false, lecturaOk:false})); }catch(e2){} return; }
    var list=[]; (ps||[]).forEach(function(p){ var s=slim(p); if(s){ cache[s.accountId+'|'+s.symbol]=s; list.push(s); } });
    var cierres=[];
    if(!reconexion){ Object.keys(cache).forEach(function(k){ if(!list.some(function(s){ return (s.accountId+'|'+s.symbol)===k; })){ cierres.push(cache[k]); delete cache[k]; } }); }
    try{ window.__reportePos(JSON.stringify({reconexion:!!reconexion, lecturaOk:true, positions:list, cierres:cierres, at:Date.now()})); }catch(e3){}
  }
  await emitir(true);
  function enganchar(nombre, fn){ try{ var d=ab[nombre]; if(d&&typeof d.subscribe==='function'){ d.subscribe(null, fn); U.push(function(){ try{ d.unsubscribe(null, fn);}catch(e){} }); } }catch(e){} }
  var visto={};
  enganchar('positionUpdate', function(p){ try{ if(p&&Number(p.qty)>0){ var s=slim(p); if(!s) return; cache[s.accountId+'|'+s.symbol]=s; if(!visto[s.symbol]){ visto[s.symbol]=1; emitir(false); } return; } }catch(e){} emitir(false); });
  enganchar('positionPartialUpdate', function(p){ try{ if(p&&Number(p.qty)>0){ var s=slim(p); if(s) cache[s.accountId+'|'+s.symbol]=s; return; } }catch(e){} emitir(false); });
  enganchar('executionUpdate', function(){ emitir(false); });
  window.__reporteU=function(){ U.forEach(function(u){ try{u();}catch(e){} }); window.__reporteU=null; };
  return {ok:true};
})()`;

async function cdpEval(port, expr) {
  const { cdpEvaluator } = await import('./colchon.mjs');
  const E = await cdpEvaluator(port);
  try { return await E.evaluate(expr); }
  finally { try { E.close(); } catch {} }
}

export function attachReporte(opts = {}) {
  const port = opts.port || 9222;
  let pageP = null;
  const page = () => pageP || (pageP = import('./colchon.mjs').then(m => m.PAGE));
  const rep = createReporte({
    dir: opts.dir,
    log: opts.log || ((...a) => console.log('[reporte]', ...a)),
    raizOcupada: opts.raizOcupada || null,
    readExec: async () => cdpEval(port, READ_EXEC_JS(await page())),
    readCharts: async () => cdpEval(port, READ_CHARTS_JS),
    draw: async (plan, chart) => cdpEval(port, expresionDibujo(plan, chart && chart.index)),
  });
  escuchar(rep, port, page).catch(e => (opts.log || console.log)('[reporte] escucha no arrancó', e && e.message));
  return rep;
}

async function escuchar(rep, port, page) {
  let espera = 2000, avisado = false;
  while (!rep.parado) {
    let client = null;
    try {
      const { createRequire } = await import('node:module');
      const { TV_PKG } = await import('./rutas.mjs');
      const CDP = createRequire(TV_PKG)('chrome-remote-interface');
      const targets = await CDP.List({ port });
      const tgt = targets.find(t => t.type === 'page' && /tradingview\.com\/chart/.test(t.url));
      if (!tgt) throw new Error('sin chart');
      client = await CDP({ port, target: tgt.id });
      await client.Runtime.enable();
      try { await client.Runtime.addBinding({ name: '__reportePos' }); } catch {}
      client.on('Runtime.bindingCalled', m => {
        if (m.name !== '__reportePos') return;
        try { rep.onPosicion(JSON.parse(m.payload)); } catch {}
      });
      const expr = JS_ESCUCHA(await page());
      await client.Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true });
      espera = 2000;
      avisado = false;
      try { await rep.reintentarPendientes(); } catch (e) { console.log('[reporte] reintento pendientes', e && e.message); }
      await new Promise(r => client.on('disconnect', r));
    } catch (e) {
      if (!avisado) { avisado = true; console.log('[reporte] escucha en espera (no repone dibujos):', e && e.message || e); }
      try { rep.resetMemoria(); } catch {}
    } finally {
      try { rep.resetMemoria(); } catch {}
      try { client && client.close(); } catch {}
    }
    if (rep.parado) break;
    await new Promise(r => setTimeout(r, espera));
    espera = Math.min(espera * 2, 15000);
  }
}

export function expresionesLimpias() {
  const mal = [];
  for (const [nombre, src] of [['READ_CHARTS_JS', READ_CHARTS_JS], ['JS_ESCUCHA', JS_ESCUCHA('function tvWv(){}function tvTrading(){return null}function tvBroker(){return null}')]]) {
    if (PROHIBIDO.test(src)) mal.push(nombre);
  }
  const plan = planDibujo({
    root: 'MNQ', symbol: 'CME_MINI:MNQZ2026', side: 'long', qty: 1, entry: 100, exit: 101, entryMs: 0, exitMs: 1000, pnl: 2, n: 1, cuenta: 'TEST001', sl: 90, tp: 110,
  });
  if (PROHIBIDO.test(expresionDibujo(plan, 0))) mal.push('dibujo');
  return mal;
}
