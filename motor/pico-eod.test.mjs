import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conPicoEod } from './rutas-api.mjs';

const sod = { accounts: { 'LFE0-PRUEBA-026': { peak: 25000, bal: 24173, day: '2026-11-24' } } };
const out = conPicoEod({
  ok: true,
  accounts: [{ name: 'LFE0-PRUEBA-026', balance: 24173, type: 'eval' }],
}, sod);
assert.equal(out.accounts[0].eodPeak, 25000);
assert.equal(out.accounts[0].balance, 24173);

const sinPico = conPicoEod({
  ok: true,
  accounts: [{ name: 'OTRA', balance: 26000 }],
}, { accounts: { OTRA: { bal: 26000 } } });
assert.equal(sinPico.accounts[0].eodPeak, undefined, 'sin pico de cierre no se inventa uno con el saldo');

const enmascarada = conPicoEod({
  ok: true,
  accounts: [{ name: 'LFE0…026', balance: 24173 }],
}, { accounts: { LFE0TEST000026: { peak: 25000 } } });
assert.equal(enmascarada.accounts[0].eodPeak, 25000, 'el pico sigue a la cuenta aunque el nombre llegue enmascarado');

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.equal(html.includes('n.peak===void 0&&(e.peak=Math.max(e.peak??e.start,e.bal))'), false);
assert.match(html, /i=Math\.max\(n\.peak\?\?e,e\)/);
assert.match(html, /a=r\?e\+lfo:i-dd,o=Math\.max\(0,t-a\)/);
assert.match(html, /peak:Math\.max\(Fs\(n\.peak,t\),t\)/);

console.log('pico-eod ok');
