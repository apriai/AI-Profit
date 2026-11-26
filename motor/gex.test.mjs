import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aNq, aporteGex, calcularGex, crearGex, expresionLimpiar, gammaBS, instanteExpira, lineaGex, mismaLinea, parseOpcion, CADA_MS } from './gex.mjs';

const AHORA = Date.parse('2026-11-25T15:00:00.000Z');
assert.equal(new Date(instanteExpira(2026, 11, 24)).toISOString(), '2026-11-24T21:00:00.000Z');
assert.equal(new Date(instanteExpira(2026, 7, 16)).toISOString(), '2026-07-16T20:00:00.000Z');
// Media sesión (día después de Thanksgiving, Nochebuena): vence a la 1:00 PM ET.
assert.equal(new Date(instanteExpira(2026, 11, 27)).toISOString(), '2026-11-27T18:00:00.000Z');
assert.equal(new Date(instanteExpira(2026, 12, 24)).toISOString(), '2026-12-24T18:00:00.000Z');
assert.equal(parseOpcion('QQQ261219C00110000').strike, 110);
assert.equal(parseOpcion('QQQ261219P00090000').tipo, 'P');

const pdf = Math.exp(-0.005) / Math.sqrt(2 * Math.PI);
assert.ok(Math.abs(gammaBS(100, 100, 0.2, 1, 0) - pdf / 20) < 1e-12);
assert.equal(gammaBS(100, 100, 0, 1, 0), 0);

const json = {
  data: {
    current_price: 100,
    options: [
      { option: 'QQQ261219C00110000', gamma: 0.02, open_interest: 50, iv: 0.2 },
      { option: 'QQQ261219P00090000', gamma: 0.01, open_interest: 80, iv: 0.25 },
      { option: 'QQQ261124C00100000', gamma: 5, open_interest: 9999, iv: 0.3 },
      { option: 'QQQ261219C00140000', gamma: 0.5, open_interest: 10, iv: 0.2 },
    ],
  },
};
const suma = 0.02 * 50 - 0.01 * 80 + 0.5 * 10;
const neto = suma * 100 * 100 * 100 * 0.01;
const calc = calcularGex(json, { ahora: AHORA, r: 0 });
assert.equal(calc.gex, neto);
assert.equal(calc.signo, '+');
assert.equal(calc.callQqq, 110);
assert.equal(calc.putQqq, 90);
assert.equal(calc.contratos, 3);
assert.equal(aNq(110, 20000, 100), 22000);
assert.equal(aNq(90, 20000, 100), 18000);
assert.ok(calc.flipQqq > 80 && calc.flipQqq < 120);
assert.ok(calc.gexDesde === 0 || calc.gexHasta === 0 || calc.gexDesde * calc.gexHasta < 0);

const soloCall = calcularGex({
  data: { current_price: 100, options: [{ option: 'QQQ261219C00100000', gamma: 0.02, open_interest: 10, iv: 0.2 }] },
}, { ahora: AHORA, r: 0 });
assert.equal(soloCall.flipQqq, null);
assert.equal(soloCall.putQqq, null);
assert.equal(aporteGex(0.02, 10, 100, 'C'), soloCall.gex);

assert.equal(CADA_MS, 20 * 60 * 1000);
assert.equal(lineaGex({ at: 't', saltado: true }), 't saltado: trade abierto');
assert.match(lineaGex({ at: 't', error: 'HTTP 403' }), /error: HTTP 403/);
assert.equal(mismaLinea({ callNq: 22000.004, putNq: 18000, flipNq: 20100.2 }, { callNq: 22000, putNq: 18000.001, flipNq: 20100.204 }), true);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gex-'));
let abierto = true;
let fallo = null;
let limpiezas = 0;
const gex = crearGex({
  dir,
  ahora: () => AHORA,
  tradeAbierto: () => abierto,
  bajar: async () => {
    if (fallo) throw new Error(fallo);
    return { json, bytes: 1234, ms: 40 };
  },
  limpiar: async () => { limpiezas++; return { ok: true, n: 0 }; },
});
const salto = await gex.correr();
assert.equal(salto.saltado, true);
assert.match(fs.readFileSync(path.join(dir, 'gex.log'), 'utf8'), /saltado: trade abierto/);
assert.equal(gex.estado().signo, null);

abierto = false;
const uno = await gex.correr();
assert.equal(uno.ok, true);
assert.equal(gex.estado().signo, '+');
assert.equal(gex.estado().gex, neto);
assert.match(uno.linea, /descarga 40 ms/);
assert.match(uno.linea, /json 1234 B/);
assert.match(uno.linea, /call QQQ 110/);
assert.match(uno.linea, /put QQQ 90/);
assert.match(uno.linea, /signo \+/);
assert.doesNotMatch(uno.linea, /dibujo [1-9]/);

fallo = 'HTTP 403';
const tres = await gex.correr();
assert.match(tres.linea, /error: HTTP 403/);
assert.equal(gex.estado().signo, '+');

gex.arrancar();
await Promise.resolve();
assert.equal(limpiezas, 1);
gex.detener();

const expr = expresionLimpiar();
assert.match(expr, /removeEntity/);
assert.match(expr, /Call wall GEX/);
assert.match(expr, /Put wall GEX/);
assert.match(expr, /Gamma flip/);
assert.doesNotMatch(expr, /createShape/);
assert.doesNotMatch(expr, /placeOrder/);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const menu = html.slice(html.indexOf('Resumen de trades en TradingView'), html.indexOf('tlDescargarLogs'));
assert.doesNotMatch(menu, /Muros GEX/);
assert.doesNotMatch(html, /id="tlGexTV"/);
assert.doesNotMatch(html, /\/api\/gex-tv/);
const hud = html.slice(html.indexOf('id="tlHudDia"'), html.indexOf('id="tlAlgosBtn"'));
assert.match(hud, /id="tlGexBadge"/);
assert.match(hud, /Día de rango|GEX no disponible/);
assert.doesNotMatch(hud, /Gamma flip|Call wall|Put wall|act\. HH/);
assert.match(html, /\/api\/gex/);
assert.match(html, /Día de expansión/);
assert.doesNotMatch(html, /hudClock/);
assert.match(html, /let clk=0/);

console.log('gex ok');
