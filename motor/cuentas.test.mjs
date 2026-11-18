// Cualquier nombre de cuenta se reconoce. El libro vacío anota la compra; uno ya escrito no la duplica.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tipoDe, inicioDe, planDe } from './granja-flores.mjs';
import { esPapel, debeGuardarSaldo, fusionarCuentas, anotarNegocio, filtroFondeadas, listaDe } from './cuentas.mjs';

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
assert.match('CUENTA-FONDEADA', new RegExp(filtroFondeadas(new Set(['CUENTA-FONDEADA']))));
assert.equal(filtroFondeadas(null), null);
assert.equal(filtroFondeadas({}), null);

assert.deepEqual(listaDe(null), []);
assert.deepEqual(listaDe(new Set(['LFE02500000000019'])), ['LFE02500000000019']);
assert.deepEqual(listaDe({ LFE02500000000019: true }), ['LFE02500000000019']);
assert.deepEqual(listaDe('["LFE02500000000019"]'), ['LFE02500000000019']);

const yaVista = { name: 'LFE02500000000019', type: 'eval', balance: 25000 };
const conSet = anotarNegocio({
  cuentas: [yaVista],
  ledger: libro,
  seen: new Set(['LFE02500000000019']),
  burned: new Set(),
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(conSet.ledger.filter(e => e.type === 'compra').length, 0, 'un Set de vistos no vuelve a anotar la compra');
assert.ok(conSet.seen.includes('LFE02500000000019'));

const conObjeto = anotarNegocio({
  cuentas: [yaVista],
  ledger: libro,
  seen: { LFE02500000000019: 1 },
  burned: {},
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(conObjeto.ledger.filter(e => e.type === 'compra').length, 0, 'un objeto viejo usa las claves como cuentas ya vistas');

const conTexto = anotarNegocio({
  cuentas: [yaVista],
  ledger: JSON.stringify(libro),
  seen: '["LFE02500000000019"]',
  burned: '[]',
  precio: 50,
  hoy: '2026-11-18',
});
assert.equal(conTexto.ledger.filter(e => e.type === 'compra').length, 0, 'un texto JSON viejo no rompe ni duplica');
assert.equal(conTexto.ledger.some(e => e.id === 'manual'), true, 'el libro en texto se conserva');

const quemadaSet = anotarNegocio({
  cuentas: [{ name: 'TAKE999111222', balance: 24000 }],
  ledger: libro,
  seen: new Set(['TAKE999111222']),
  burned: new Set(['TAKE999111222']),
  precio: 75,
  hoy: '2026-11-18',
});
assert.equal(quemadaSet.ledger.filter(e => e.type === 'quemada').length, 0, 'un Set de quemadas no se repite');

const setNuevo = anotarNegocio({
  cuentas: [{ name: 'TAKE999111222', balance: 25000 }],
  ledger: libro,
  seen: new Set(),
  burned: new Set(),
  precio: 75,
  hoy: '2026-11-18',
});
assert.equal(setNuevo.ledger.filter(e => e.type === 'compra').length, 1, 'un Set vacío sigue anotando la cuenta nueva');

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const poll = html.slice(html.indexOf('async function poll()'), html.indexOf('poll();setInterval(poll'));
assert.ok(poll.includes('async function poll(){'), 'hay un sondeo del Negocio');
assert.ok(poll.includes('try{let archivo'), 'el sondeo del Negocio va dentro de try');
assert.ok(poll.includes('}catch(e){}'), 'un fallo del Negocio no puede romper la granja');
assert.equal(poll.includes('gset('), false, 'el sondeo ya no fuerza un Set antes de anotar');
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
