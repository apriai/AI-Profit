import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cerrarSesion, resumenDia, textoHud, contratosDe } from './pnl-sesion.mjs';
import { diaFarm } from './colchon.mjs';

// Caso de la granja abierta tarde: 13 trades antes de la primera lectura y 4 después.
// Bruto 673, 61 MNQ. La tajada tardía neta a $1/contrato es 534.5 y NO es el día.
function lote(n, cada, ultimoQty, brutos, at0) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const q = i === n - 1 ? ultimoQty : cada;
    const g = i === n - 1 ? Math.round((brutos - sum) * 100) / 100 : Math.round((brutos / n) * 100) / 100;
    sum += i === n - 1 ? 0 : g;
    const at = new Date(Date.parse(at0) + i * 60e3).toISOString();
    out.push({ at, tamano: `${q} MNQ`, pnl: g, pnlBruto: g, neto: false, direccion: i % 2 ? 'VENTA' : 'COMPRA' });
  }
  return out;
}
const temprano = lote(13, 2, 5, 106.5, '2026-11-16T03:54:00Z');
const tarde = lote(4, 8, 8, 566.5, '2026-11-16T06:30:00Z');
assert.equal(temprano.length, 13);
assert.equal(tarde.length, 4);
assert.equal(temprano.reduce((a, t) => a + contratosDe(t).n, 0), 29);
assert.equal(tarde.reduce((a, t) => a + contratosDe(t).n, 0), 32);
const todos = [...temprano, ...tarde];
assert.equal(Math.round(todos.reduce((a, t) => a + t.pnl, 0) * 100) / 100, 673);

const sesion = cerrarSesion(todos, {});
assert.equal(sesion.bruto, 673);
assert.equal(sesion.neto, 612, '61 MNQ a $1');
assert.equal(sesion.fuente, 'comisión conocida');
assert.notEqual(sesion.neto, 534.5);
assert.equal(Math.round(sesion.trades.reduce((a, t) => a + t.pnl, 0) * 100) / 100, 612);

const soloTarde = cerrarSesion(tarde, {});
assert.equal(soloTarde.neto, 534.5, 'la tajada de después de abrir da 534.5 y no es el día');

// La primera lectura tardía (24557) no es saldo de inicio de sesión.
const lecturaTardia = cerrarSesion(todos, { saldoInicio: 24557, saldoActual: 25091.5 });
assert.equal(lecturaTardia.neto, 612);

const conSaldo = cerrarSesion(todos, { saldoInicio: 24481.5, saldoActual: 25091.5, saldoEsSesion: true });
assert.equal(conSaldo.neto, 610);
assert.equal(conSaldo.fuente, 'saldo de inicio de sesión');
assert.equal(Math.round(conSaldo.trades.reduce((a, t) => a + t.pnl, 0) * 100) / 100, 610);

const yaNeto = todos.map(t => ({ ...t, neto: true, pnl: Math.round((t.pnl - contratosDe(t).n) * 100) / 100 }));
const delBroker = cerrarSesion(yaNeto, { saldoInicio: 24481.5, saldoActual: 25091.5, saldoEsSesion: true });
assert.equal(delBroker.neto, 612);
assert.equal(delBroker.fuente, 'comisiones del bróker');

// Noviembre 2026 ya es EST (UTC−5). La sesión del lunes 16 termina a las 16:00 de ese lunes.
for (const iso of ['2026-11-16T03:54:00Z', '2026-11-16T05:55:00Z', '2026-11-16T06:24:00Z']) {
  assert.equal(diaFarm(Date.parse(iso)), '2026-11-16', iso);
}
assert.equal(diaFarm(Date.parse('2026-11-16T20:59:00Z')), '2026-11-16', 'lunes 15:59 ET sigue en la sesión que termina hoy');
assert.equal(diaFarm(Date.parse('2026-11-16T21:00:00Z')), '2026-11-17', 'lunes 16:00 ET, fuera de sesión, pasa a la siguiente');
assert.equal(diaFarm(Date.parse('2026-11-16T22:59:00Z')), '2026-11-17', 'lunes 17:59 ET sigue fuera de sesión');
assert.equal(diaFarm(Date.parse('2026-11-16T23:00:00Z')), '2026-11-17', 'lunes 18:00 ET abre la sesión que termina el martes');
assert.equal(diaFarm(Date.parse('2026-11-15T23:00:00Z')), '2026-11-16', 'domingo 18:00 ET abre la sesión que termina el lunes');
assert.equal(diaFarm(Date.parse('2026-11-13T21:00:00Z')), '2026-11-14', 'viernes 16:00 ET queda en el sábado, no se junta con el lunes');
assert.equal(diaFarm(Date.parse('2026-11-14T20:59:00Z')), '2026-11-14', 'sábado 15:59 ET');
assert.equal(diaFarm(Date.parse('2026-11-14T21:00:00Z')), '2026-11-15', 'sábado 16:00 ET pasa al domingo');

// Cambio de horario de 2026. En marzo el reloj salta a las 02:00; en noviembre vuelve a las 02:00.
// Los bordes de las 16:00 y las 18:00 no caen en la hora repetida.
assert.equal(diaFarm(Date.parse('2026-03-07T20:59:00Z')), '2026-03-07', '7 mar 15:59 EST, antes del cambio');
assert.equal(diaFarm(Date.parse('2026-03-07T21:00:00Z')), '2026-03-08', '7 mar 16:00 EST');
assert.equal(diaFarm(Date.parse('2026-03-07T23:00:00Z')), '2026-03-08', '7 mar 18:00 EST');
assert.equal(diaFarm(Date.parse('2026-03-08T19:59:00Z')), '2026-03-08', '8 mar 15:59 EDT, ya con horario de verano');
assert.equal(diaFarm(Date.parse('2026-03-08T20:00:00Z')), '2026-03-09', '8 mar 16:00 EDT');
assert.equal(diaFarm(Date.parse('2026-03-08T21:59:00Z')), '2026-03-09', '8 mar 17:59 EDT');
assert.equal(diaFarm(Date.parse('2026-03-08T22:00:00Z')), '2026-03-09', '8 mar 18:00 EDT');
assert.equal(diaFarm(Date.parse('2026-10-31T22:00:00Z')), '2026-11-01', '31 oct 18:00 EDT, víspera del cambio');
assert.equal(diaFarm(Date.parse('2026-11-01T20:59:00Z')), '2026-11-01', '1 nov 15:59 EST, ya en hora estándar');
assert.equal(diaFarm(Date.parse('2026-11-01T21:00:00Z')), '2026-11-02', '1 nov 16:00 EST');
assert.equal(diaFarm(Date.parse('2026-11-01T22:59:00Z')), '2026-11-02', '1 nov 17:59 EST');
assert.equal(diaFarm(Date.parse('2026-11-01T23:00:00Z')), '2026-11-02', '1 nov 18:00 EST');

const pagina = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const trozo = pagina.slice(pagina.indexOf('_pd='), pagina.indexOf('_pd=') + 420);
assert.match(trozo, /\+p\.hour%24>=16&&d\.setUTCDate/, 'la página corta a la misma hora');
assert.doesNotMatch(trozo, /getUTCDay/, 'la página ya no junta el fin de semana con el lunes');

const r = resumenDia([
  { at: '2026-11-16T04:00:00Z', pnl: 10 },
  { at: '2026-11-16T04:01:00Z', pnl: 5 },
  { at: '2026-11-16T04:02:00Z', pnl: 0 },
  { at: '2026-11-16T04:03:00Z', pnl: -1 },
  { at: '2026-11-16T04:04:00Z', pnl: -2 },
  { at: '2026-11-16T04:05:00Z', pnl: -3 },
]);
assert.equal(r.ganados, 2);
assert.equal(r.perdidos, 3);
assert.equal(r.mejor, 2);
assert.equal(r.peor, 3);
assert.equal(r.racha, 3);
assert.equal(r.rachaTipo, 'pierde');
assert.equal(textoHud(r, 0), 'Hoy 6 trades · 2+ · 3−');
assert.equal(textoHud(r, 2), '❄️ 3 seguidas · Mejor 2 · Peor ❄️ 3');
const gana = resumenDia([{ at: '2026-11-16T04:00:00Z', pnl: 4 }, { at: '2026-11-16T04:01:00Z', pnl: 4 }, { at: '2026-11-16T04:02:00Z', pnl: 4 }, { at: '2026-11-16T04:03:00Z', pnl: 4 }]);
assert.equal(textoHud(gana, 2), '🔥 4 seguidas · Mejor 4 · Peor ❄️ 0');
assert.equal(textoHud(gana, 1), 'P&L hoy: +$16');
assert.equal(textoHud({ n: 1, pnl: -3.5, ganados: 0, perdidos: 1 }, 1), 'P&L hoy: −$3.5');
assert.equal(textoHud(resumenDia([]), 2), 'Sin trades hoy');
assert.equal(textoHud(resumenDia([]), 0), 'Hoy 0 trades · 0+ · 0−');

console.log('pnl-sesion ok');
