import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const bloque = html.slice(html.indexOf('<script id="tl-sesion-pnl">'), html.indexOf('</script>', html.indexOf('<script id="tl-sesion-pnl">')) + '</script>'.length);
const fuente = bloque.replace(/^<script id="tl-sesion-pnl">/, '').replace(/<\/script>$/, '');
const sandbox = { window: {}, Intl, Date, Math, Number, String, Object };
vm.createContext(sandbox);
vm.runInContext(fuente, sandbox);
const { inicioSesion, finSesion, netoSesion, pnlFila } = sandbox.window.__tlSesion;
const iso = s => new Date(s).toISOString();

// Viernes 13 nov 2026, EST. 15:59 sigue en la sesión que abrió el jueves a las 16:00.
assert.equal(iso(inicioSesion(Date.parse('2026-11-13T20:59:00Z'))), '2026-11-12T21:00:00.000Z', 'viernes 15:59 ET');
assert.equal(iso(finSesion(Date.parse('2026-11-13T20:59:00Z'))), '2026-11-13T21:00:00.000Z', 'esa sesión cierra el viernes a las 16:00');
assert.equal(iso(inicioSesion(Date.parse('2026-11-13T21:01:00Z'))), '2026-11-13T21:00:00.000Z', 'viernes 16:01 ET abre la sesión nueva');
assert.equal(iso(finSesion(Date.parse('2026-11-13T21:01:00Z'))), '2026-11-14T21:00:00.000Z', 'cierra el sábado a las 16:00');

// El sábado no se junta con el lunes: 15:59 sigue en la ventana del viernes, 16:01 abre otra.
assert.equal(iso(inicioSesion(Date.parse('2026-11-14T20:59:00Z'))), '2026-11-13T21:00:00.000Z', 'sábado 15:59 ET');
assert.equal(iso(inicioSesion(Date.parse('2026-11-14T21:01:00Z'))), '2026-11-14T21:00:00.000Z', 'sábado 16:01 ET');
assert.equal(iso(finSesion(Date.parse('2026-11-14T21:01:00Z'))), '2026-11-15T21:00:00.000Z', 'domingo 16:00 ET');

// En el borde exacto de las 16:00 empieza la sesión nueva.
assert.equal(iso(inicioSesion(Date.parse('2026-11-16T21:00:00Z'))), '2026-11-16T21:00:00.000Z', 'lunes 16:00:00 ET');
assert.equal(iso(inicioSesion(Date.parse('2026-11-16T20:59:59Z'))), '2026-11-15T21:00:00.000Z', 'lunes 15:59:59 ET');

// Cambio de marzo 2026: el domingo 8 a las 02:00 el reloj salta. Las 16:00 quedan fuera de ese hueco.
assert.equal(iso(inicioSesion(Date.parse('2026-03-07T20:59:00Z'))), '2026-03-06T21:00:00.000Z', '7 mar 15:59 EST');
assert.equal(iso(inicioSesion(Date.parse('2026-03-07T21:01:00Z'))), '2026-03-07T21:00:00.000Z', '7 mar 16:01 EST');
assert.equal(iso(finSesion(Date.parse('2026-03-07T21:01:00Z'))), '2026-03-08T20:00:00.000Z', '8 mar 16:00 ya es EDT');
assert.equal(iso(inicioSesion(Date.parse('2026-03-08T19:59:00Z'))), '2026-03-07T21:00:00.000Z', '8 mar 15:59 EDT');
assert.equal(iso(inicioSesion(Date.parse('2026-03-08T20:01:00Z'))), '2026-03-08T20:00:00.000Z', '8 mar 16:01 EDT');

// Cambio de noviembre 2026: el domingo 1 a las 02:00 se repite la hora. Las 16:00 ya son EST.
assert.equal(iso(inicioSesion(Date.parse('2026-11-01T20:59:00Z'))), '2026-10-31T20:00:00.000Z', '1 nov 15:59 EST, la sesión abrió en EDT');
assert.equal(iso(finSesion(Date.parse('2026-11-01T20:59:00Z'))), '2026-11-01T21:00:00.000Z', '1 nov 16:00 EST');
assert.equal(iso(inicioSesion(Date.parse('2026-11-01T21:01:00Z'))), '2026-11-01T21:00:00.000Z', '1 nov 16:01 EST');

const cuenta = 'LFE02588043490026';
const mask = 'LFE0…026';
const trades = [
  { at: '2026-11-13T20:59:00Z', cuenta: mask, pnl: 40 },
  { at: '2026-11-13T21:00:00Z', cuenta: mask, pnl: -15 },
  { at: '2026-11-13T21:30:00Z', cuenta: mask, pnl: 5 },
  { at: '2026-11-13T22:00:00Z', cuenta: 'LFE0…999', pnl: 80 },
  { at: '2026-11-14T21:01:00Z', cuenta: cuenta, pnl: 7 },
];
const antes = netoSesion(trades, cuenta, Date.parse('2026-11-13T20:59:30Z'));
assert.equal(antes.n, 1, 'a las 15:59 solo entra el trade de las 15:59');
assert.equal(antes.neto, 40);
const despues = netoSesion(trades, cuenta, Date.parse('2026-11-13T21:01:00Z'));
assert.equal(despues.n, 2, 'a las 16:01 entran los trades de la sesión nueva');
assert.equal(despues.neto, -10, 'neto ya descontado, sin volver a restar comisión');
assert.equal(netoSesion(trades, cuenta, Date.parse('2026-11-14T20:59:00Z')).neto, -10, 'el sábado por la tarde sigue en la misma sesión');
assert.equal(netoSesion(trades, cuenta, Date.parse('2026-11-14T21:01:00Z')).neto, 7);

sandbox.window.__tlPnlTrades = trades;
sandbox.window.__tlPnl = { dia: '2026-11-14' };
sandbox.window.__tlDayPnl = { [cuenta]: { dayPnl: 0, tradingDay: '2026-11-14' } };
const ahora = Date.parse('2026-11-13T21:01:00Z');
const realNow = Date.now;
Date.now = () => ahora;
try {
  assert.equal(pnlFila({ name: cuenta, pnlToday: 0, pnlDate: '2026-11-14' }), -10, 'sin saldo, se suman los trades');
  assert.equal(pnlFila({ name: 'LFF02500000000001', pnlToday: 0, pnlDate: '2026-11-14' }), 0, 'otra cuenta no hereda esos trades');
  sandbox.window.__tlSesionSaldo = { [cuenta]: { balance: 24173, sessionStartBalance: 24802.5, sessionPnl: -629.5 } };
  assert.equal(pnlFila({ name: cuenta, bal: 24173, pnlToday: 0 }), -629.5, 'el saldo del bróker gana a los trades aproximados');
  sandbox.window.__tlSesionSaldo = {};
  assert.equal(pnlFila({ name: cuenta, bal: 24173, pnlToday: -469.5 }), 0, 'con saldo y sin foto no se usa la suma de trades');
} finally {
  Date.now = realNow;
}

const { guardarSesion, diaSesion } = sandbox.window.__tlSesion;
assert.equal(diaSesion(Date.parse('2026-11-13T20:59:00Z')), '2026-11-13');
assert.equal(diaSesion(Date.parse('2026-11-13T21:01:00Z')), '2026-11-14');
assert.equal(diaSesion(Date.parse('2026-03-08T20:01:00Z')), '2026-03-09', '8 mar 16:01 EDT');
assert.equal(diaSesion(Date.parse('2026-11-01T21:01:00Z')), '2026-11-02', '1 nov 16:01 EST');
sandbox.window.__tlSesionSaldo = {};
const ahoraSaldo = Date.now;
Date.now = () => Date.parse('2026-11-23T18:00:00Z');
try {
  guardarSesion(
    { accounts: [{ name: cuenta, balance: 24173 }] },
    { accounts: { [cuenta]: { startOfDay: 24802.5, balance: 24802.5, tradingDay: '2026-11-23' } } },
  );
  assert.equal(pnlFila({ name: cuenta, bal: 24173 }), -629.5, 'sin sessionPnl del API, saldo menos el inicio guardado');
  guardarSesion(
    { accounts: [{ name: cuenta, balance: 24100 }] },
    { accounts: { [cuenta]: { startOfDay: 24100, tradingDay: '2026-11-23' } } },
  );
  assert.equal(pnlFila({ name: cuenta, bal: 24100 }), -702.5, 'el inicio no se reemplaza cuando el saldo se mueve');
  guardarSesion(
    { accounts: [{ name: cuenta, balance: 24100, sessionStartBalance: 25000, sessionPnl: -900 }] },
    { accounts: { [cuenta]: { startOfDay: 24802.5, tradingDay: '2026-11-23' } } },
  );
  assert.equal(pnlFila({ name: cuenta, bal: 24100 }), -900, 'el sessionPnl del API manda');
} finally {
  Date.now = ahoraSaldo;
}

assert.equal(html.split('["P&L sesión"').length - 1, 2, 'la flor y el árbol dicen P&L sesión');
assert.ok(!html.includes('["P&L hoy",yi(t.pnlToday'), 'el panel ya no pinta el P&L de hoy guardado');
assert.ok(html.includes('window.__tlPnlTrades=_tr'), 'la página guarda los trades de la sesión');

console.log('sesion-pnl ok');
