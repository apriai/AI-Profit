import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  diaSesion, aplicarLectura, inicioReconstruido, tradeFiable, leerStore, aplicarEnRespuesta,
} from './sesion-saldo.mjs';

const iso = s => new Date(s).toISOString();

// Viernes 13 nov 2026, EST. 15:59 sigue en la sesión que cierra ese viernes; 16:01 abre la siguiente.
assert.equal(diaSesion(Date.parse('2026-11-13T20:59:00Z')), '2026-11-13', 'viernes 15:59 ET');
assert.equal(diaSesion(Date.parse('2026-11-13T21:00:00Z')), '2026-11-14', 'viernes 16:00 ET');
assert.equal(diaSesion(Date.parse('2026-11-13T21:01:00Z')), '2026-11-14', 'viernes 16:01 ET');
assert.equal(diaSesion(Date.parse('2026-11-14T20:59:00Z')), '2026-11-14', 'sábado 15:59 ET sigue en la sesión del viernes 16:00');
assert.equal(diaSesion(Date.parse('2026-11-14T21:01:00Z')), '2026-11-15', 'sábado 16:01 ET abre otra sesión');

// Cambio de marzo 2026 (a las 02:00). Las 16:00 quedan en EDT.
assert.equal(diaSesion(Date.parse('2026-03-08T19:59:00Z')), '2026-03-08', '8 mar 15:59 EDT');
assert.equal(diaSesion(Date.parse('2026-03-08T20:01:00Z')), '2026-03-09', '8 mar 16:01 EDT');
// Cambio de noviembre 2026. Las 16:00 ya son EST.
assert.equal(diaSesion(Date.parse('2026-11-01T20:59:00Z')), '2026-11-01', '1 nov 15:59 EST');
assert.equal(diaSesion(Date.parse('2026-11-01T21:01:00Z')), '2026-11-02', '1 nov 16:01 EST');

const ahora = Date.parse('2026-11-23T13:54:00Z'); // 8:54 ET
const sucios = [
  { pnl: 248.5, aprox: true, fuente: 'broker', motivo: 'Detenido manualmente' },
  { pnl: null, aprox: true, motivo: 'Error' },
];
assert.equal(tradeFiable(sucios[0]), false);
assert.equal(tradeFiable(sucios[1]), false);
assert.equal(inicioReconstruido(24173, sucios), null, 'un trade aproximado no reconstruye el inicio');

const store = { cuentas: {} };
let r = aplicarLectura(store, { id: 'CUENTA-A', balance: 24802.5, now: ahora, trades: sucios });
assert.equal(r.fuente, 'primera lectura');
assert.equal(r.sessionStartBalance, 24802.5);
assert.equal(r.sessionPnl, 0);
assert.equal(r.session, '2026-11-23');
r = aplicarLectura(store, { id: 'CUENTA-A', balance: 24173, now: ahora + 3 * 3600e3, trades: sucios });
assert.equal(r.sessionStartBalance, 24802.5, 'la foto de la sesión no se mueve');
assert.equal(r.sessionPnl, -629.5, 'saldo de ahora menos el de las 8:54');

// Sin foto: el saldo que el servidor ya guardó al empezar la sesión manda sobre el saldo de ahora.
const conSemilla = { cuentas: {} };
r = aplicarLectura(conSemilla, { id: 'CUENTA-A', balance: 24173, now: ahora + 3 * 3600e3, inicioConocido: 24802.5, trades: sucios });
assert.equal(r.fuente, 'saldo ya visto al empezar la sesión');
assert.equal(r.sessionStartBalance, 24802.5);
assert.equal(r.sessionPnl, -629.5);

// Al cruzar las 16:00 la sesión nueva guarda su propio inicio y no reusa el anterior.
const cruce = { cuentas: {} };
const antes = Date.parse('2026-11-23T20:59:00Z');
const despues = Date.parse('2026-11-23T21:01:00Z');
aplicarLectura(cruce, { id: 'CUENTA-A', balance: 24000, now: antes });
aplicarLectura(cruce, { id: 'CUENTA-A', balance: 23950, now: despues });
assert.equal(cruce.cuentas['CUENTA-A'][diaSesion(antes)].balance, 24000);
assert.equal(cruce.cuentas['CUENTA-A'][diaSesion(despues)].balance, 23950);
r = aplicarLectura(cruce, { id: 'CUENTA-A', balance: 23900, now: despues + 60e3 });
assert.equal(r.session, diaSesion(despues));
assert.equal(r.sessionStartBalance, 23950);
assert.equal(r.sessionPnl, -50);

// Trades limpios del bróker: el inicio es el saldo menos esa suma.
const limpios = [
  { pnl: -400, aprox: false, fuente: 'broker' },
  { pnl: -229.5, fuente: 'broker' },
];
assert.equal(inicioReconstruido(24173, limpios), 24802.5);
r = aplicarLectura({ cuentas: {} }, { id: 'CUENTA-A', balance: 24173, now: ahora, trades: limpios });
assert.equal(r.fuente, 'saldo menos trades del bróker');
assert.equal(r.sessionStartBalance, 24802.5);
assert.equal(r.sessionPnl, -629.5);

// Sin saldo no hay foto y el P&L de sesión queda vacío (la página suma trades solo en ese caso).
r = aplicarLectura({ cuentas: {} }, { id: 'CUENTA-A', balance: null, now: ahora, trades: sucios });
assert.equal(r.sessionStartBalance, null);
assert.equal(r.sessionPnl, null);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sesion-saldo-'));
assert.deepEqual(leerStore(dir).cuentas, {}, 'sin archivo, no hay foto');
fs.mkdirSync(path.join(dir, 'historial'));
fs.writeFileSync(path.join(dir, 'sod.json'), JSON.stringify({ accounts: { 'CUENTA-A': { day: '2026-11-23', bal: 24802.5 } } }));
fs.writeFileSync(path.join(dir, 'historial', '2026-11-23.json'), JSON.stringify({
  cuentas: { 'CUENTA-A': { trades: sucios } },
}));
const tarde = Date.parse('2026-11-23T18:00:00Z');
const out = aplicarEnRespuesta({ ok: true, accounts: [{ name: 'CUENTA-A', balance: 24173 }] }, { dir, state: {}, now: tarde });
assert.equal(out.accounts[0].sessionStartBalance, 24802.5);
assert.equal(out.accounts[0].sessionPnl, -629.5);
assert.equal(out.accounts[0].session, '2026-11-23');
fs.writeFileSync(path.join(dir, 'sod.json'), JSON.stringify({ accounts: { 'CUENTA-A': { day: '2026-11-23', bal: 24173 } } }));
const out2 = aplicarEnRespuesta({ ok: true, accounts: [{ name: 'CUENTA-A', balance: 24100 }] }, { dir, state: {}, now: tarde + 1000 });
assert.equal(out2.accounts[0].sessionStartBalance, 24802.5, 'una foto guardada no se reemplaza');
assert.equal(out2.accounts[0].sessionPnl, -702.5);
assert.ok(fs.existsSync(path.join(dir, 'sesion-saldo.json')));

console.log('sesion-saldo ok', iso(tarde));
