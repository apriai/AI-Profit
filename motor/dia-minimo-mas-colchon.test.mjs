// Dia minimo (+ Colchon): SL y TP por tamaño, colchón de ~$100 netos una sola vez.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { decide, lockUsdFor, stepsFor, triggerUsdFor } from './colchon.mjs';
import { getStrategy, listStrategies, STRATEGY_ORDER } from './strategies.mjs';
import { paramsForAccount } from './account-size.mjs';

const dia = getStrategy('dia-minimo-colchon');
const nuevo = getStrategy('dia-minimo-mas-colchon');
const dos = getStrategy('dos-disparos');
const a25 = { balance: 25000 };
const a50 = { balance: 50000 };

assert.equal(nuevo.id, 'dia-minimo-mas-colchon');
assert.equal(nuevo.name, 'Dia minimo (+ Colchon)');
assert.equal(STRATEGY_ORDER.indexOf('dia-minimo-mas-colchon'), STRATEGY_ORDER.indexOf('dia-minimo-colchon') + 1);
assert.deepEqual(listStrategies().map(s => s.id).filter(id => !String(id).startsWith('propia-')), STRATEGY_ORDER);

assert.equal(dia.params.SL_USD, 600);
assert.equal(dia.params.TP_USD, 1600);
assert.equal(dia.params.NET_USD, 100);
assert.equal(dia.params.SCALE_BY_SIZE, undefined);
assert.equal(dos.params.SL_USD, 300);
assert.equal(dos.params.TP_USD, 630);
assert.deepEqual(dos.params.SCALE_BY_SIZE, { '25K': 1, '50K': 2 });

const p25 = paramsForAccount(nuevo.params, a25);
const p50 = paramsForAccount(nuevo.params, a50);
assert.equal(p25.SL_USD, 100);
assert.equal(p25.TP_USD, 1600);
assert.equal(p25.NET_USD, 100);
assert.equal(p25.TRIGGER_EXTRA_USD, 15);
assert.equal(p50.SL_USD, 150);
assert.equal(p50.TP_USD, 3200);
assert.equal(p50.NET_USD, 100, 'el neto protegido no se dobla en 50K');
assert.equal(p50.TRIGGER_EXTRA_USD, 15);
assert.deepEqual(p50.COMM_RT, { MNQ: 1, NQ: 3.5 });
assert.equal(p50.SLIP_TICKS, 1);

const doble = paramsForAccount(dos.params, a50);
assert.equal(doble.SL_USD, 600);
assert.equal(doble.TP_USD, 1260);
const dia50 = paramsForAccount(dia.params, a50);
assert.equal(dia50.SL_USD, 1200);
assert.equal(dia50.TP_USD, 3200);
assert.equal(dia50.NET_USD, 200);

assert.equal(lockUsdFor('MNQ', 8, p25), lockUsdFor('MNQ', 8, dia.params));
assert.equal(triggerUsdFor('MNQ', 8, p25), triggerUsdFor('MNQ', 8, dia.params));
assert.equal(lockUsdFor('MNQ', 8, p50), lockUsdFor('MNQ', 8, p25));
assert.equal(lockUsdFor('MNQ', 8, p25), 112);
assert.equal(triggerUsdFor('MNQ', 8, p25), 128);

const pasos = stepsFor('MNQ', 8, p25);
assert.equal(pasos.length, 1);
const c = { symbol: 'MNQ', qty: 8, P: p25, steps: pasos };
const sube = decide({ side: 'long', entry: 20000, price: 20020, pnl: 128 }, 19900, { step: 0 }, c);
assert.equal(sube.action, 'modify');
assert.equal(sube.step, 0);
assert.ok(sube.price > 19900, 'el stop solo sube');
const quieto = decide({ side: 'long', entry: 20000, price: 20040, pnl: 400 }, sube.price, { step: 1 }, c);
assert.equal(quieto.action, 'hold');
const noBaja = decide({ side: 'long', entry: 20000, price: 20040, pnl: 400 }, 20020, { step: 0 }, c);
assert.equal(noBaja.action, 'skip');

const c50 = { symbol: 'MNQ', qty: 8, P: p50, steps: stepsFor('MNQ', 8, p50) };
const sube50 = decide({ side: 'long', entry: 20000, price: 20020, pnl: 128 }, 19800, { step: 0 }, c50);
assert.equal(sube50.action, 'modify');
assert.equal(sube50.price, sube.price, 'el colchón de 50K protege los mismos ~$100');

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const i = html.indexOf('scaleP=');
const j = html.indexOf('const SPf=', i);
const ctx = { P: nuevo.params };
vm.createContext(ctx);
vm.runInContext('const ' + html.slice(i, j) + 'out25=scaleP(P,1);out50=scaleP(P,2);', ctx);
assert.equal(ctx.out25.SL_USD, 100);
assert.equal(ctx.out25.TP_USD, 1600);
assert.equal(ctx.out25.NET_USD, 100);
assert.equal(ctx.out50.SL_USD, 150);
assert.equal(ctx.out50.TP_USD, 3200);
assert.equal(ctx.out50.NET_USD, 100);
const dosCtx = { P: dos.params };
vm.createContext(dosCtx);
vm.runInContext('const ' + html.slice(i, j) + 'out50=scaleP(P,2);', dosCtx);
assert.equal(dosCtx.out50.SL_USD, 600);
assert.equal(dosCtx.out50.TP_USD, 1260);

console.log('dia-minimo-mas-colchon ok');
