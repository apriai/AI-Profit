import { nivelesPreview, cuentaPreview, createVistaPrevia } from './tv-vista-previa.mjs';
import { maxQtyFor } from './account-size.mjs';

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); failed++; }
  else console.log('ok ', msg);
}

const base = { side: 'long', symbol: 'MNQ', price: 20000, params: { SL_USD: 630, TP_USD: 630 } };
const ver = (qty, account) => nivelesPreview({ ...base, qty, account });

const e25 = { name: 'LFE02500000000019', type: 'eval' };
const e50 = { name: 'LFE05000000000099', type: 'eval' };
const f25 = { name: 'LFF02500000000019', type: 'funded', balance: 25000 };
const f25b = { name: 'LFF02500000000019', type: 'funded', balance: 26000 };
const f50a = { name: 'LFF05000000000099', type: 'funded', balance: 50000 };
const f50b = { name: 'LFF05000000000099', type: 'funded', totalPnl: 1500 };
const f50c = { name: 'LFF05000000000099', type: 'funded', totalPnl: 2000 };

assert(ver(20, e25).ok === true && ver(21, e25).ok === false, 'eval 25K dibuja hasta 20');
assert(ver(21, e25).max === 20, 'eval 25K el tope que devuelve es 20');
assert(ver(10, f25).ok === true && ver(11, f25).ok === false, 'fondeada 25K en el inicio dibuja hasta 10');
assert(ver(20, f25b).ok === true && ver(21, f25b).ok === false, 'fondeada 25K con +1000 dibuja hasta 20');
assert(ver(40, e50).ok === true && ver(41, e50).ok === false, 'eval 50K dibuja hasta 40');
assert(ver(20, f50a).ok === true && ver(21, f50a).ok === false, 'fondeada 50K en el inicio dibuja hasta 20');
assert(ver(30, f50b).ok === true && ver(31, f50b).ok === false, 'fondeada 50K con +1500 dibuja hasta 30');
assert(ver(40, f50c).ok === true && ver(41, f50c).ok === false, 'fondeada 50K con +2000 dibuja hasta 40');

const nq = (qty, account) => nivelesPreview({ ...base, symbol: 'NQ', qty, account });
assert(nq(2, e25).ok === true && nq(3, e25).ok === false, 'eval 25K NQ hasta 2');
assert(nq(4, e50).ok === true && nq(5, e50).ok === false, 'eval 50K NQ hasta 4');
assert(nq(1, f25).ok === true && nq(2, f25).ok === false, 'fondeada 25K NQ en el inicio hasta 1');
assert(nq(3, f50b).ok === true && nq(4, f50b).ok === false, 'fondeada 50K NQ con +1500 hasta 3');

assert(ver(20, e25).max === undefined, 'cuando cabe no publica un tope de rechazo');
assert(maxQtyFor('MNQ', e50) === 40 && ver(40, e50).ok, 'el tope de la vista es el de maxQtyFor');

const desdePanel = cuentaPreview({
  accountName: 'LFF05000000000099', accountId: 'tv-1', accountType: 'funded', balance: 51000, totalPnl: 1000,
});
assert(desdePanel.name === 'LFF05000000000099' && desdePanel.type === 'funded' && desdePanel.balance === 51000, 'la cuenta del panel llega con nombre y saldo');
assert(ver(30, desdePanel).ok === true && ver(31, desdePanel).ok === false, 'fondeada 50K con saldo 51,000 dibuja hasta 30');

let dibujos = 0;
const previa = createVistaPrevia({
  cotizar: async () => ({ price: 21000, symbol: 'CME_MINI:MNQ1!' }),
  dibujar: async (expr) => {
    if (String(expr).includes('"borrar":true')) return { ok: true, quedaron: [] };
    dibujos++;
    return { ok: true, ids: { sl: 's', tp: 't', box: 'b', tx: 'x' }, caja: true, riesgo: true };
  },
});
const si = await previa.aplicar({ activo: true, side: 'long', symbol: 'MNQ', qty: 40, strategyId: 'evaluacion-simple', accountName: 'LFE05000000000099', accountType: 'eval', seq: 1 });
assert(si.estado === 'vista' && dibujos === 1, '40 MNQ en eval 50K sí pide el dibujo');
const no = await previa.aplicar({ activo: true, side: 'long', symbol: 'MNQ', qty: 41, strategyId: 'evaluacion-simple', accountName: 'LFE05000000000099', accountType: 'eval', seq: 2 });
assert(no.estado === 'no-disponible' && dibujos === 1, '41 MNQ en eval 50K no vuelve a dibujar');

if (failed) { console.error('\n' + failed + ' comprobaciones fallaron'); process.exit(1); }
console.log('\nTodas las comprobaciones de la vista previa pasaron.');
