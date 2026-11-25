import assert from 'node:assert/strict';
import fs from 'node:fs';
import { anotarPuntos, puntosDe } from './pnl-sesion.mjs';

// Día vivo: roundTrips ya trae el promedio y los puntos.
const broker = {
  fuente: 'broker', direccion: 'VENTA', tamano: '6 MNQ',
  entrada: 25206, salida: 25236, entradaProm: 25226, salidaProm: 25236,
  puntos: -10, pnl: -126, pnlBruto: -120, neto: true,
};
assert.equal(puntosDe(broker), -10);

// historial/<dia>.json de antes de la columna: entrada y salida, sin puntos.
const guardado = {
  at: '2026-11-20T15:04:00.000Z', direccion: 'COMPRA', tamano: '8 MNQ',
  entrada: 21000, salida: 21012.5, pnl: 190, pnlBruto: 200, neto: true,
  fuente: 'broker', cuenta: 'LFE0…026',
};
assert.equal(puntosDe(guardado), 12.5);
// Agregar guardado: el primer fill y el último no son el promedio. Manda el P&L bruto.
const agregadoViejo = {
  direccion: 'VENTA', tamano: '6 MNQ', entrada: 25206, salida: 25236, pnlBruto: -120, pnl: -126,
};
assert.equal(puntosDe(agregadoViejo), -10);
assert.equal(puntosDe({
  direccion: 'VENTA', tamano: '6 MNQ', entradaProm: 25220, salidaProm: 25236,
  entrada: 25206, salida: 25236, pnlBruto: -120,
}), -16);

// Cierre de la granja (colchon-eventos fin_trade): hay P&L y tamaño, no precios.
const granja = {
  at: '2026-11-25T14:40:00.000Z', direccion: 'VENTA', tamano: '6 MNQ',
  pnl: -126, pnlBruto: -120, aprox: false, motivo: 'Stop loss',
  estrategia: 'Dia minimo (+ Colchon)',
};
assert.equal(puntosDe(granja), -10);

// Agregar: solo el promedio de entrada quedó anotado. El P&L bruto da los puntos.
const agregar = {
  direccion: 'VENTA', tamano: '6 MNQ', entrada: 25226, pnl: -126, pnlBruto: -120,
};
assert.equal(puntosDe(agregar), -10);

// Vista 24 h que solo tiene el neto y la comisión.
const neto = { direccion: 'COMPRA', tamano: '1 MNQ', pnl: 19, comision: 1, neto: true };
assert.equal(puntosDe(neto), 10);

assert.equal(puntosDe({ direccion: 'COMPRA', tamano: '2 NQ', pnlBruto: 200 }), 5);
assert.equal(puntosDe({ direccion: 'VENTA', tamano: '3 MES', entrada: 5000, salida: 4998 }), 2);
assert.equal(puntosDe({ direccion: 'COMPRA', tamano: '1 ES', pnlBruto: 250 }), 5);
assert.equal(puntosDe({ side: 'short', symbol: 'MNQ', qty: 1, entrada: 100, salida: 101 }), -1);
assert.equal(puntosDe({ direccion: 'COMPRA', motivo: 'en curso', tamano: '1 MNQ' }), null);
assert.equal(puntosDe(null), null);

const filas = anotarPuntos([guardado, granja, { direccion: 'COMPRA' }]);
assert.equal(filas[0].puntos, 12.5);
assert.equal(filas[1].puntos, -10);
assert.equal(filas[2].puntos, undefined);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const puntosFila = new Function(html.slice(html.indexOf('function puntosFila'), html.indexOf('function firmaLista')) + '\nreturn puntosFila;')();
assert.equal(puntosFila(agregadoViejo), -10);
assert.equal(puntosFila({ direccion: 'COMPRA', tamano: '1 MNQ', entrada: 100, salida: 110 }), 10);
assert.match(html, /s\.pnl<0/);
const rutas = fs.readFileSync(new URL('./rutas-api.mjs', import.meta.url), 'utf8');
const link = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(rutas, /fillsDesdeMs: null/);
assert.match(link, /const fillsDesdeMs = null/);
assert.match(link, /inicioDiaFarm\(desde\)/);

console.log('puntos-fila ok');
