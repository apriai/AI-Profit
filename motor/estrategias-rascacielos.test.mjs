// 0.10.65: Evaluación con rascacielos (id evaluacion) ya no está en la lista.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stepsFor, lockUsdFor, triggerUsdFor, decide } from './colchon.mjs';
import { getStrategy, listStrategies, STRATEGY_ORDER, DEFAULT_STRATEGY } from './strategies.mjs';

const orden = listStrategies().map(s => s.id).filter(id => !String(id).startsWith('propia-'));
assert.deepEqual(STRATEGY_ORDER, ['evaluacion-simple', 'dia-minimo-colchon', 'dia-minimo-mas-colchon', 'prueba-be', 'dos-disparos']);
assert.deepEqual(orden, STRATEGY_ORDER);
assert.equal(orden.includes('evaluacion'), false);
assert.equal(orden.includes('rascacielo'), false);

const cae = getStrategy('evaluacion');
assert.equal(cae.id, DEFAULT_STRATEGY);
assert.equal(cae.name, 'Evaluación');
assert.equal(getStrategy('rascacielo').id, DEFAULT_STRATEGY);
assert.equal(getStrategy('').id, DEFAULT_STRATEGY);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.equal(html.includes('Evaluación con rascacielos'), false);
assert.equal(html.includes('s.id==="evaluacion"'), false);

// Un trade ya abierto guarda sus parámetros al empezar. El motor sigue usándolos
// aunque el id ya no esté en la lista.
const viejo = { SL_USD: 630, TP_USD: 630, NET_USD: 100, COMM_RT: { MNQ: 1, NQ: 3.5 }, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15 };
const pasos = stepsFor('MNQ', 8, viejo);
assert.equal(pasos.length, 1);
assert.equal(pasos[0].lockUsd, lockUsdFor('MNQ', 8, viejo));
assert.equal(pasos[0].triggerUsd, triggerUsdFor('MNQ', 8, viejo));
const c = { symbol: 'MNQ', qty: 8, P: viejo, steps: pasos };
const sube = decide({ side: 'long', entry: 20000, price: 20020, pnl: pasos[0].triggerUsd }, 19900, { step: 0 }, c);
assert.equal(sube.action, 'modify');
const quieto = decide({ side: 'long', entry: 20000, price: 20020, pnl: 400 }, sube.price, { step: 1 }, c);
assert.equal(quieto.action, 'hold');

console.log('estrategias-rascacielos ok');
