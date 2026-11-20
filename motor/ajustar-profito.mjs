// Casilla «Ajustar a último Profito». No abre órdenes: elige la vela y arma stop, TP y contratos.
import { barraEnMs, duracionMarcoMs, velaEnVivo } from './pine-algo.mjs';

export const TICK = 0.25;
export const PV = { MNQ: 2, NQ: 20 };
const SESGO_MS = 3000;

export function roundTick(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n / TICK) * TICK;
}

function raiz(sim) {
  const x = String(sim || '').replace(/^.*:/, '');
  if (/^MNQ/.test(x)) return 'MNQ';
  if (/^NQ/.test(x)) return 'NQ';
  return x;
}

// La vela viva y las 3 cerradas de justo antes. Una barra más vieja, o una que aún no es la de ahora, no entra.
export function velasEnVentana(velas, resolucion, ahora) {
  const lista = (Array.isArray(velas) ? velas : []).map(v => {
    const t = barraEnMs(v && v.barra);
    if (t == null) return null;
    return { ...v, t };
  }).filter(Boolean);
  const vivas = lista.filter(v => velaEnVivo(v.barra, resolucion, ahora));
  if (!vivas.length) return [];
  const now = Number(ahora);
  const started = vivas.filter(v => v.t <= now + SESGO_MS);
  const pool = started.length ? started : vivas;
  const live = pool.reduce((a, b) => (a.t >= b.t ? a : b));
  const dur = duracionMarcoMs(resolucion) ?? 60 * 1000;
  return lista.filter(v => {
    const k = Math.round((live.t - v.t) / dur);
    return k >= 0 && k <= 3 && Math.abs(live.t - v.t - k * dur) < 1500;
  }).sort((a, b) => b.t - a.t);
}

export function tieneCirculo(v) {
  return !!(v && (v.alcista || v.bajista) && Number.isFinite(+v.abierta) && +v.abierta > 0);
}

export function contratosPorRiesgo({ riesgoUsd, distancia, pv, maxQty } = {}) {
  const risk = Number(riesgoUsd), dist = Number(distancia), punto = Number(pv), tope = Math.floor(Number(maxQty));
  if (!(risk > 0) || !(dist > 0) || !(punto > 0) || !(tope >= 1)) return null;
  const q = Math.floor(risk / (dist * punto) + 1e-9);
  if (q < 1) return null;
  return Math.min(q, tope);
}

export function ladoDelStop(precio, stop) {
  const px = roundTick(precio), sl = roundTick(stop);
  if (!Number.isFinite(px) || px <= 0 || !Number.isFinite(sl) || sl <= 0) return null;
  if (sl <= px - TICK) return 'long';
  if (sl >= px + TICK) return 'short';
  return null;
}

export function precioDeLado(precio, stop) {
  const n = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  if (typeof precio === 'number') return n(precio);
  if (!precio || typeof precio !== 'object') return null;
  const bid = n(precio.bid), ask = n(precio.ask), last = n(precio.last);
  const sl = Number(stop);
  if (Number.isFinite(sl) && sl > 0) {
    if (ask != null && sl <= roundTick(ask) - TICK) return ask;
    if (bid != null && sl >= roundTick(bid) + TICK) return bid;
  }
  return last ?? ask ?? bid;
}

export function calcularDesdeVela({ abierta, precio, riesgoUsd, pv, maxQty } = {}) {
  const stop = roundTick(abierta);
  if (!Number.isFinite(stop) || stop <= 0) return null;
  const pxRaw = precioDeLado(precio, stop);
  const lado = pxRaw == null ? null : ladoDelStop(pxRaw, stop);
  if (!lado) return { stop, tp: null, qty: null, lado: null, precio: pxRaw == null ? null : roundTick(pxRaw) };
  const px = roundTick(pxRaw);
  const dist = Math.abs(px - stop);
  const tp = roundTick(lado === 'long' ? px + dist : px - dist);
  const qty = contratosPorRiesgo({ riesgoUsd, distancia: dist, pv, maxQty });
  return { stop, tp, qty, lado, precio: px };
}

export function textoAjuste(c) {
  if (!c || !Number.isFinite(+c.stop)) return '';
  const fmt = n => String(roundTick(n));
  if (!c.lado) return `Stop ${fmt(c.stop)} · el precio lo cruzó`;
  if (!c.qty) return `Stop ${fmt(c.stop)} · no cabe en el riesgo`;
  const lado = c.lado === 'long' ? 'compra' : 'venta';
  return `Stop ${fmt(c.stop)} · TP ${fmt(c.tp)} · ${c.qty} contrato${c.qty === 1 ? '' : 's'} · ${lado}`;
}

function normal(c) {
  if (!c || !Number.isFinite(+c.stop)) return null;
  const abierta = Number.isFinite(+c.abierta) ? roundTick(c.abierta) : roundTick(c.stop);
  return {
    barra: c.barra ?? null,
    abierta,
    stop: roundTick(c.stop),
    tp: Number.isFinite(+c.tp) ? roundTick(c.tp) : null,
    qty: Number.isInteger(c.qty) && c.qty >= 1 ? c.qty : null,
    lado: c.lado === 'long' || c.lado === 'short' ? c.lado : null,
  };
}

// La vela guardada sigue contando mientras su inicio caiga en la viva o en las 3 de antes.
function sigueEnVentana(barra, ventana, resolucion) {
  const t = barraEnMs(barra);
  if (t == null || !ventana.length) return false;
  const live = ventana.reduce((a, b) => (a.t >= b.t ? a : b));
  const dur = duracionMarcoMs(resolucion) ?? 60 * 1000;
  const k = Math.round((live.t - t) / dur);
  return k >= 0 && k <= 3 && Math.abs(live.t - t - k * dur) < 1500;
}

// marcado: el tirador está al final. guardado trae la barra del círculo y su apertura.
// Si el círculo se apaga y esa vela sigue entre las 4, el stop no se mueve y el TP y los
// contratos se recalculan con el precio de ahora. Si ya salió de las 4, el tirador se duerme.
// Un círculo más nuevo, dentro de la ventana, reemplaza al guardado.
export function revisarAjuste({ marcado = false, guardado = null, lectura = null, symbol = 'MNQ', riesgoUsd, maxQty, ahora } = {}) {
  const now = Number.isFinite(+ahora) ? +ahora : Date.now();
  const on = !!marcado;
  const mismo = !lectura || !lectura.simbolo || raiz(lectura.simbolo) === raiz(symbol);
  const ventana = mismo && lectura ? velasEnVentana(lectura.velas, lectura.resolucion, now) : [];
  const reciente = ventana.find(tieneCirculo) || null;
  const pv = PV[raiz(symbol)] || PV.MNQ;
  let calc = null;
  let conservado = false;
  let dormir = false;
  if (reciente) {
    const nuevo = calcularDesdeVela({
      abierta: reciente.abierta,
      precio: lectura && lectura.precio,
      riesgoUsd,
      pv,
      maxQty,
    });
    if (nuevo) {
      nuevo.barra = reciente.barra;
      nuevo.abierta = roundTick(reciente.abierta);
      calc = nuevo;
    }
  } else if (on && guardado && Number.isFinite(+guardado.stop)) {
    const abierta = Number.isFinite(+guardado.abierta) ? +guardado.abierta : +guardado.stop;
    const dentro = !ventana.length || guardado.barra == null || sigueEnVentana(guardado.barra, ventana, lectura && lectura.resolucion);
    if (!mismo || !ventana.length) {
      calc = { ...guardado, abierta: roundTick(abierta) };
      conservado = true;
    } else if (!dentro) {
      dormir = true;
    } else {
      const nuevo = calcularDesdeVela({
        abierta,
        precio: lectura && lectura.precio,
        riesgoUsd,
        pv,
        maxQty,
      });
      if (nuevo) {
        nuevo.barra = guardado.barra ?? null;
        nuevo.abierta = roundTick(abierta);
        calc = nuevo;
      }
    }
  }
  if (dormir) {
    return {
      habilitada: false,
      marcado: false,
      texto: '',
      conservado: false,
      tono: null,
      guardado: null,
      firma: 'dormir',
      log: 'Ajustar a último Profito: la vela salió de las últimas 4 y el tirador se duerme',
      dormir: true,
    };
  }
  const completo = normal(calc);
  const tono = reciente ? (reciente.alcista ? 'alcista' : 'bajista') : (on && guardado && (guardado.tono === 'alcista' || guardado.tono === 'bajista') ? guardado.tono : null);
  if (completo && tono) completo.tono = tono;
  const habilitada = on || !!reciente;
  const texto = on && completo ? textoAjuste(completo) : '';
  let log = null;
  if (on && completo && !conservado) log = `Ajustar a último Profito: vela ${completo.barra} · stop ${completo.stop} · TP ${completo.tp ?? '—'} · ${completo.qty ?? 0} contratos`;
  if (on && conservado && completo) log = `Ajustar a último Profito: se conserva el último cálculo (stop ${completo.stop}, ${completo.qty ?? 0} contratos)`;
  const firma = on && completo ? `${completo.barra}|${completo.stop}|${completo.tp ?? ''}|${completo.qty ?? ''}|${conservado ? 'c' : 'n'}` : '';
  return { habilitada, marcado: on, texto, conservado, tono, guardado: on ? completo : null, firma, log, dormir: false };
}
