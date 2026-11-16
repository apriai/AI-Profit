import assert from 'node:assert/strict';
import vm from 'node:vm';
import { js, isPaper, realAllowed } from './colchon.mjs';

function broker(cur, list, title = 'Tradovate TRADOVATE') {
  return {
    currentAccount: () => ({ value: () => cur }),
    accountsMetainfo: async () => list,
    _brokerMetainfo: { id: 'TRADOVATE', title },
  };
}
function run(doc, ab) {
  const window = {
    TradingView: {
      bottomWidgetBar: {
        _widgetControllers: { get: k => k === 'paper_trading' ? { _trading: { activeBroker: () => ab } } : null },
      },
    },
  };
  const context = vm.createContext({ document: doc, window, Promise, setTimeout });
  return vm.runInContext(js.account, context);
}
const luz = a => /tradovate/i.test(`${a.broker || ''} ${a.brokerId || ''}`) && !!a.name;

const lista = [
  { id: 'D-TEST-001', name: 'LFE02500000000001', type: 'live' },
  { id: 'D-TEST-002', name: 'Demo Account', type: 'demo' },
];

const sinDom = await run({ querySelector: () => null }, broker('D-TEST-001', lista));
assert.equal(sinDom.api, true);
assert.equal(sinDom.name, 'LFE02500000000001');
assert.equal(sinDom.broker, 'Tradovate TRADOVATE');
assert.equal(luz(sinDom), true, 'la luz de Tradovate usa el nombre de la API');
assert.equal(isPaper(sinDom.name, sinDom.broker), false);
assert.equal(realAllowed(sinDom.name, { allowAll: false, allow: [] }), false, 'sin allowlist sigue bloqueada');
assert.equal(realAllowed(sinDom.name, { allowAll: false, allow: ['LFE02500000000001'] }), true);

const domVacio = await run({ querySelector: () => ({ innerText: '   ' }) }, broker('D-TEST-002', lista));
assert.equal(domVacio.name, 'Demo Account');
assert.equal(isPaper(domVacio.name, domVacio.broker), true);

const conDom = await run({ querySelector: () => ({ innerText: 'Nombre del panel' }) }, broker('D-TEST-001', lista));
assert.equal(conDom.name, 'Nombre del panel', 'si el panel está abierto, manda el DOM');

const sinApi = await run({ querySelector: () => null }, null);
assert.equal(sinApi.name, null);
assert.equal(sinApi.api, false);
assert.equal(luz(sinApi), false);

const fallo = await run({ querySelector: () => null }, {
  currentAccount: () => { throw new Error('no'); },
  accountsMetainfo: async () => lista,
  _brokerMetainfo: { id: 'TRADOVATE', title: 'Tradovate' },
});
assert.equal(fallo.name, null, 'si la API falla, no inventa un nombre');

assert.match(js.switchAccount('1', 'X'), /n\.innerText\.trim\(\)===nm/, 'cambiar de cuenta sigue exigiendo el nombre visible');
assert.match(js.switchAccount('1', 'X'), /no se opera/, 'sigue sin operar si la cuenta ya tiene posición u orden');

console.log('cuenta-dom-api ok');
