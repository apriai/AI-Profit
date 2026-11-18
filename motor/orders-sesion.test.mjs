import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bot, check, confirm, DRY_RUN, mustBeFlat, request } from './orders.mjs';
import { diaFarm, fueraDeSesion } from './colchon.mjs';

assert.equal(DRY_RUN, true, 'sigue en simulación');
assert.equal(bot.get(), false, 'el bot nace apagado');

const src = fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8');
const motor = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(src, /NUNCA hace clic/);
assert.match(src, /DRY_RUN = true/);
assert.doesNotMatch(src, /placeOrder|OPEN_CUTOFF|4:45|3:00 PM/);
assert.match(motor, /const enCierre = \(\) => fueraDeSesion\(\)/);
assert.doesNotMatch(motor, /horaET\(\) === 17/);

// Lunes 16 de noviembre de 2026, hora estándar (UTC−5).
const t1559 = Date.parse('2026-11-16T20:59:00Z');
const t1600 = Date.parse('2026-11-16T21:00:00Z');
const t1759 = Date.parse('2026-11-16T22:59:00Z');
const t1800 = Date.parse('2026-11-16T23:00:00Z');
const domingo18 = Date.parse('2026-11-15T23:00:00Z');

assert.equal(fueraDeSesion(t1559), false, '15:59 sigue en sesión');
assert.equal(fueraDeSesion(t1600), true, '16:00 es el cierre');
assert.equal(fueraDeSesion(t1759), true, '17:59 sigue en el cierre, no es una ventana aparte');
assert.equal(fueraDeSesion(t1800), false, '18:00 abre la sesión siguiente');
assert.equal(mustBeFlat(t1559), false);
assert.equal(mustBeFlat(t1600), true);
assert.equal(mustBeFlat(t1800), false);
assert.equal(diaFarm(domingo18), '2026-11-16');
assert.equal(fueraDeSesion(domingo18), false, 'el domingo a las 18:00 la sesión ya está abierta');

// Cambio de horario de 2026.
assert.equal(fueraDeSesion(Date.parse('2026-03-08T19:59:00Z')), false, '8 mar 15:59 EDT');
assert.equal(fueraDeSesion(Date.parse('2026-03-08T20:00:00Z')), true, '8 mar 16:00 EDT');
assert.equal(fueraDeSesion(Date.parse('2026-03-08T21:59:00Z')), true, '8 mar 17:59 EDT');
assert.equal(fueraDeSesion(Date.parse('2026-03-08T22:00:00Z')), false, '8 mar 18:00 EDT');
assert.equal(fueraDeSesion(Date.parse('2026-03-07T20:59:00Z')), false, '7 mar 15:59 EST');
assert.equal(fueraDeSesion(Date.parse('2026-03-07T21:00:00Z')), true, '7 mar 16:00 EST');
assert.equal(fueraDeSesion(Date.parse('2026-11-01T20:59:00Z')), false, '1 nov 15:59 EST');
assert.equal(fueraDeSesion(Date.parse('2026-11-01T21:00:00Z')), true, '1 nov 16:00 EST');
assert.equal(fueraDeSesion(Date.parse('2026-11-01T23:00:00Z')), false, '1 nov 18:00 EST');

const id = 'LFE02500000000001';
const accounts = { [id]: { id, balance: 25000 } };
const orden = { account: id, side: 'buy', symbol: 'MNQ', qty: 1 };
const fuera = e => e.some(x => /16:00 a las 18:00/.test(x));

assert.ok(check(orden, accounts, t1800).includes('El bot esta apagado'));
assert.equal(bot.get(), false);

bot.set(true);
try {
  assert.equal(fuera(check(orden, accounts, t1559)), false);
  assert.equal(fuera(check(orden, accounts, t1600)), true);
  assert.equal(fuera(check(orden, accounts, t1759)), true);
  assert.equal(fuera(check(orden, accounts, t1800)), false);
  assert.equal(fuera(check(orden, accounts, domingo18)), false, 'domingo 18:00 no queda bloqueado por ser fin de semana');
  const otra = 'CUENTA88421';
  const errOtra = check({ account: otra, side: 'buy', symbol: 'MNQ', qty: 1 }, { [otra]: { id: otra, balance: 50000 } }, t1800);
  assert.equal(errOtra.some(x => /LFE|LFF/.test(x)), false, 'un nombre sin prefijo no se rechaza');
  assert.equal(errOtra.length, 0, 'esa cuenta Lucid pasa el filtro de la orden');

  const pedido = request(orden, accounts, t1800);
  assert.equal(pedido.ok, true);
  const hecho = await confirm(pedido.id, accounts, t1800);
  assert.equal(hecho.simulated, true);
  assert.match(hecho.msg, /SIMULACION/);
  assert.match(hecho.msg, /No se coloco ninguna orden/);
  assert.ok(check(orden, accounts, t1800).some(x => /1 trade hoy/.test(x)), 'el conteo usa el día de la sesión');
  assert.equal(check(orden, accounts, t1559).some(x => /1 trade hoy/.test(x)), false, '15:59 es la sesión anterior');
} finally {
  bot.set(false);
}
assert.equal(bot.get(), false);
assert.equal(DRY_RUN, true);

console.log('orders-sesion ok');
