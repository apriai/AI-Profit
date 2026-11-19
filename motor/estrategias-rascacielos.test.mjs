// Estrategias 0.10.28: se quita el Rascacielo de stop fijo y Evaluación con rascacielos usa un solo colchón.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { decide, lockUsdFor, stepsFor, triggerUsdFor } from './colchon.mjs';
import { getStrategy, listStrategies, STRATEGY_ORDER, DEFAULT_STRATEGY, paramsForAccount } from './strategies.mjs';

const ev = getStrategy('evaluacion');
const dia = getStrategy('dia-minimo-colchon');
assert.equal(ev.id, 'evaluacion');
assert.equal(ev.name, 'Evaluación con rascacielos');
assert.equal(ev.params.SL_USD, 630);
assert.equal(ev.params.TP_USD, 630);
assert.equal(ev.params.NET_USD, 100);
assert.equal(ev.params.TRIGGER_EXTRA_USD, 15);
assert.equal(ev.params.SLIP_TICKS, 1);
assert.deepEqual(ev.params.COMM_RT, { MNQ: 1, NQ: 3.5 });
assert.equal(ev.params.STEPS, undefined);
assert.equal(dia.params.NET_USD, 100);
assert.equal(dia.params.SL_USD, 600);
assert.equal(dia.params.TP_USD, 1600);

const orden = listStrategies().map(s => s.id);
assert.deepEqual(STRATEGY_ORDER, ['evaluacion-simple', 'evaluacion', 'dia-minimo-colchon', 'prueba-be', 'dos-disparos']);
assert.deepEqual(orden.filter(id => !String(id).startsWith('propia-')), STRATEGY_ORDER);
assert.equal(orden.includes('rascacielo'), false);
assert.equal(getStrategy('rascacielo').id, DEFAULT_STRATEGY);
assert.equal(getStrategy('rascacielo').name, 'Evaluación');

const P = ev.params;
const pasos = stepsFor('MNQ', 8, P);
assert.equal(pasos.length, 1);
assert.equal(pasos[0].triggerUsd, triggerUsdFor('MNQ', 8, P));
assert.equal(pasos[0].lockUsd, lockUsdFor('MNQ', 8, P));
assert.equal(pasos[0].lockUsd, 112);
assert.equal(pasos[0].triggerUsd, 128);
const c = { symbol: 'MNQ', qty: 8, P, steps: pasos };
const sube = decide({ side: 'long', entry: 20000, price: 20020, pnl: 128 }, 19900, { step: 0 }, c);
assert.equal(sube.action, 'modify');
assert.equal(sube.step, 0);
const quieto = decide({ side: 'long', entry: 20000, price: 20020, pnl: 400 }, sube.price, { step: 1 }, c);
assert.equal(quieto.action, 'hold');

const p50 = paramsForAccount(P, { balance: 50000 });
assert.equal(p50.SL_USD, 1260);
assert.equal(p50.TP_USD, 1260);
assert.equal(p50.NET_USD, 200);
assert.equal(lockUsdFor('MNQ', 8, p50), 212);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.equal(html.includes('s.id==="rascacielo"'), false);
const start = html.indexOf('function textoCuentaHtml()');
const end = html.indexOf('\nconst QS=', start);
const PV = { MNQ: 2, NQ: 20 }, CR = { MNQ: 1, NQ: 3.5 };
function texto(scale) {
  const ctx = {
    strs: [ev], stratId: 'evaluacion', sym: 'MNQ', qty: 8,
    accPlan: () => ({ scale }),
    scaleP: (params, sc) => paramsForAccount(params, { balance: sc === 2 ? 50000 : 25000 }),
    lockU: (y, q, params) => lockUsdFor(y, q, params),
    esc: s => String(s ?? ''),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start, end) + '\nout = textoCuentaHtml();', ctx);
  return String(ctx.out).replace(/<[^>]+>/g, '\n');
}
const t25 = texto(1), t50 = texto(2);
assert.match(t25, /Evaluación con rascacielos/);
assert.match(t25, /SL −\$630/);
assert.match(t25, /TP \+\$630/);
assert.match(t25, /\+\$112 → protege ~\$100 netos/);
assert.match(t25, /Solo sube, nunca baja\./);
assert.doesNotMatch(t25, /entra a mercado|opacity:\.72/);
assert.match(t50, /SL −\$1,260/);
assert.match(t50, /TP \+\$1,260/);
assert.match(t50, /\+\$212 → protege ~\$200 netos/);
assert.doesNotMatch(t25 + t50, /\$200 → protege \$0|\$500 → protege/);

console.log('estrategias-rascacielos ok');
