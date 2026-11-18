// Cualquier nombre de cuenta se reconoce. El libro vacío anota la compra; uno ya escrito no la duplica.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tipoDe, inicioDe, planDe } from './granja-flores.mjs';
import { esPapel, debeGuardarSaldo, fusionarCuentas, anotarNegocio, filtroFondeadas } from './cuentas.mjs';

assert.equal(tipoDe({ name: 'APEX123456' }), 'eval');
assert.equal(tipoDe({ name: 'LFF05000000000099' }), 'funded');
assert.equal(tipoDe({ name: 'LFF05000000000099', type: 'eval' }), 'eval');
assert.equal(tipoDe({ name: 'FONDO-X', type: 'funded' }), 'funded');
assert.equal(inicioDe({ name: 'APEX50K999111' }), 50000);
assert.equal(inicioDe({ name: 'TAKE999111222' }), 25000);
assert.equal(planDe({ name: 'LFE02500000000019', balance: 51000 }), '50K');
assert.equal(planDe({ name: 'LFE05000000000099', balance: 26000 }), '25K');
assert.equal(inicioDe({ balance: 30000, inicio: 50000 }), 50000);
assert.equal(esPapel({ name: 'Paper Trading' }), true);
assert.equal(esPapel({ name: 'LFE02500000000019' }), false);
assert.equal(debeGuardarSaldo({ name: 'APEX123456', balance: 25110 }), true);
assert.equal(debeGuardarSaldo({ name: 'Paper Trading', balance: 50000 }), false);
assert.equal(debeGuardarSaldo({ name: 'APEX123456' }), false);

const fusion = fusionarCuentas({
  accountsJson: { accounts: { LFE02500000000019: { id: 'LFE02500000000019', type: 'eval', balance: 25110 } } },
  colchon: { ok: true, accounts: [
    { name: 'LFE02500000000019', type: 'eval', balance: 25110 },
    { name: 'APEX50K999111' },
    { name: 'Paper Trading', type: 'demo' },
  ] },
});
assert.equal(fusion.length, 3);
assert.equal(fusion.find(a => a.name === 'APEX50K999111').type, 'eval');
assert.equal(fusion.find(a => a.name === 'APEX50K999111').start, 50000);

const vacio = anotarNegocio({
  cuentas: fusion,
  ledger: [],
  seen: ['LFE02500000000019', 'APEX50K999111'],
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(vacio.changed, true);
assert.equal(vacio.ledger.filter(e => e.type === 'compra').length, 2);
assert.ok(vacio.ledger.every(e => e.type !== 'compra' || e.note.includes('monto estimado — edítalo')));
assert.equal(vacio.ledger.some(e => e.cuenta === 'Paper Trading'), false);
const apex = vacio.ledger.find(e => e.cuenta === 'APEX50K999111');
assert.equal(apex.amount, 50);
assert.match(apex.note, /50K/);

const otra = anotarNegocio({
  cuentas: fusion,
  ledger: vacio.ledger,
  seen: [],
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(otra.ledger.filter(e => e.type === 'compra').length, 2, 'reinstalar con el libro ya escrito no duplica');

const libro = [{ id: 'manual', type: 'curso', date: '2026-11-01', amount: 10, note: 'Curso' }];
const vista = anotarNegocio({
  cuentas: [{ name: 'LFE02500000000019', type: 'eval', balance: 25000 }],
  ledger: libro,
  seen: ['LFE02500000000019'],
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(vista.ledger.filter(e => e.type === 'compra').length, 0, 'una cuenta ya vista y un libro con datos no se vuelve a comprar');

const nueva = anotarNegocio({
  cuentas: [{ name: 'TAKE999111222', balance: 24000 }],
  ledger: libro,
  seen: [],
  precio: 75,
  hoy: '2026-11-18',
});
assert.equal(nueva.ledger.filter(e => e.type === 'compra').length, 1);
assert.equal(nueva.ledger.find(e => e.type === 'compra').amount, 75);
assert.equal(nueva.ledger.filter(e => e.type === 'quemada').length, 1, '25K en 24000 queda quemada');

const fondeo = anotarNegocio({
  cuentas: [{ name: 'CUENTA-FONDEADA', type: 'funded', balance: 50000 }],
  ledger: [],
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(fondeo.fondeos, 1);
assert.equal(fondeo.ledger[0].type, 'fondeo');
assert.equal(fondeo.ledger[0].amount, 0);

const re = filtroFondeadas(['CUENTA-FONDEADA', 'A.B']);
assert.match('CUENTA-FONDEADA', new RegExp(re));
assert.doesNotMatch('APEX50K999111', new RegExp(re));

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(html, /from '\/cuentas\.mjs'/);
assert.equal(html.includes('startsWith("LFE")'), false);
assert.match(html, /\/api\/colchon\/accounts/);
const motor = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.equal(/if \(\/\^LF\[EF\]\/\.test\(a\.name\)/.test(motor), false);
assert.match(motor, /debeGuardarSaldo/);
const colchon = fs.readFileSync(new URL('./colchon.mjs', import.meta.url), 'utf8');
assert.match(colchon, /tipoDe\(\{ id: a\.name/);
assert.match(colchon, /export function realAllowed/);
const ordenes = fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8');
assert.equal(ordenes.includes('Cuenta no es LFE/LFF'), false);
assert.equal(html.includes('· bloqueada'), false);

console.log('cuentas ok');
