import { nivelesPreview, cuentaPreview, createVistaPrevia, expresionVista, COLOR_LINEA, GROSOR_LINEA } from './tv-vista-previa.mjs';
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
const f25casi = { name: 'LFF02500000000019', type: 'funded', balance: 26099 };
const f25b = { name: 'LFF02500000000019', type: 'funded', balance: 26100 };
const f50a = { name: 'LFF05000000000099', type: 'funded', balance: 50000 };
const f50b = { name: 'LFF05000000000099', type: 'funded', totalPnl: 1500 };
const f50c = { name: 'LFF05000000000099', type: 'funded', totalPnl: 2000 };

assert(ver(20, e25).ok === true && ver(21, e25).ok === false, 'eval 25K dibuja hasta 20');
assert(ver(21, e25).max === 20, 'eval 25K el tope que devuelve es 20');
assert(ver(10, f25).ok === true && ver(11, f25).ok === false, 'fondeada 25K en el inicio dibuja hasta 10');
assert(ver(10, f25casi).ok === true && ver(11, f25casi).ok === false, 'fondeada 25K en 26099 sigue en 10');
assert(ver(20, f25b).ok === true && ver(21, f25b).ok === false, 'fondeada 25K desde 26100 dibuja hasta 20');
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

const lineas = expresionVista({
  raiz: 'MNQ', lado: 'long', entrada: 21000, stop: 20900, take: 21100,
  qty: 8, barras: 6, prev: { sl: 'id-sl', tp: 'id-tp', box: 'id-caja', tx: 'id-texto' },
});
assert(lineas.includes(COLOR_LINEA) && lineas.includes('linewidth:GROSOR') && lineas.includes('GROSOR=' + GROSOR_LINEA), 'SL y TP son grises de 1 píxel');
assert(!lineas.includes('long_position') && !lineas.includes('short_position') && !lineas.includes('#ef5350') && !lineas.includes('#26a69a'), 'la vista no crea caja ni líneas de color');
assert(lineas.includes('id-sl') && lineas.includes('id-tp') && lineas.includes('setPoints'), 'si ya existen, solo se mueve el precio');
assert(lineas.includes('id-caja') && lineas.includes('id-texto'), 'una caja o un texto viejos se mandan a borrar');

let dibujos = 0;
let borrados = 0;
const exprs = [];
const previa = createVistaPrevia({
  cotizar: async () => ({ price: 21000, symbol: 'CME_MINI:MNQ1!' }),
  dibujar: async (expr) => {
    exprs.push(String(expr));
    if (String(expr).includes('"borrar":true')) { borrados++; return { ok: true, quedaron: [] }; }
    dibujos++;
    return { ok: true, ids: { sl: 's' + dibujos, tp: 't' + dibujos, box: null, tx: null } };
  },
});
const si = await previa.aplicar({ activo: true, side: 'long', symbol: 'MNQ', qty: 8, strategyId: 'evaluacion-simple', accountName: 'LFE05000000000099', accountType: 'eval', seq: 1 });
assert(si.estado === 'vista' && dibujos === 1, 'la primera pasada crea las líneas');
const movida = await previa.aplicar({ activo: true, side: 'short', symbol: 'MNQ', qty: 40, strategyId: 'evaluacion-simple', accountName: 'LFE05000000000099', accountType: 'eval', seq: 2 });
assert(movida.estado === 'vista' && dibujos === 2 && exprs[1].includes('"sl":"s1"') && exprs[1].includes('"tp":"t1"'), 'al cambiar lado o cantidad se reutilizan las mismas líneas');
const no = await previa.aplicar({ activo: true, side: 'long', symbol: 'MNQ', qty: 41, strategyId: 'evaluacion-simple', accountName: 'LFE05000000000099', accountType: 'eval', seq: 3 });
assert(no.estado === 'no-disponible' && dibujos === 2, 'por encima del tope no se dibuja otra vez');
const fuera = await previa.aplicar({ activo: false, seq: 4 });
assert(fuera.estado === 'apagado' && borrados === 1 && exprs.at(-1).includes('"borrar":true') && exprs.at(-1).includes('"s2"') && exprs.at(-1).includes('"t2"'), 'al salir se borran las dos líneas');

if (failed) { console.error('\n' + failed + ' comprobaciones fallaron'); process.exit(1); }
console.log('\nTodas las comprobaciones de la vista previa pasaron.');
