import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { barraEnMs, exprSenal, ALGO_NOMBRE } from './pine-algo.mjs';
import { revisarAjuste, contratosPorRiesgo, textoAjuste } from './ajustar-profito.mjs';
import { bracketDesdeStop, createColchon } from './colchon.mjs';

const b310 = 1795109400, b300 = 1795108800, b255 = 1795108500, b245 = 1795107900;
const ahora = barraEnMs(b310) + 50 * 1000;
const vela = (barra, abierta, circulo) => ({ barra, abierta, alcista: !!circulo, bajista: false });
const lectura = (velas, extra = {}) => ({ velas, resolucion: '5', simbolo: 'CME_MINI:MNQZ2026', precio: { bid: 26809.75, ask: 26810, last: 26810 }, ...extra });

assert.equal(contratosPorRiesgo({ riesgoUsd: 630, distancia: 10, pv: 2, maxQty: 20 }), 20, '25K no pasa el tope');
assert.equal(contratosPorRiesgo({ riesgoUsd: 1260, distancia: 10, pv: 2, maxQty: 40 }), 40, '50K usa el riesgo doble y su tope');
assert.equal(contratosPorRiesgo({ riesgoUsd: 630, distancia: 10, pv: 2, maxQty: 40 }), 31);
assert.equal(contratosPorRiesgo({ riesgoUsd: 5, distancia: 10, pv: 2, maxQty: 20 }), null, 'un contrato se pasa del riesgo');

const soloVieja = revisarAjuste({ lectura: lectura([vela(b245, 26790, true), vela(b300, 26800, false)]), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora });
assert.equal(soloVieja.habilitada, false, '2:45 queda fuera de las 4 velas');

const cargando = revisarAjuste({ lectura: lectura([vela(b245, 26790, true)]), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora });
assert.equal(cargando.habilitada, false, 'sin la vela viva no se puede marcar');

const en300 = revisarAjuste({
  lectura: lectura([vela(b310, 26808, false), vela(b300, 26800, true), vela(b255, 26795, false), vela(b245, 26790, true)]),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora,
});
assert.equal(en300.habilitada, true, 'el círculo de las 3:00 entra en las 4 velas');
assert.equal(en300.marcado, false);

const puesto = revisarAjuste({
  marcado: true,
  lectura: lectura([vela(b310, 26808, false), vela(b300, 26800, true)]),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora,
});
assert.equal(puesto.guardado.stop, 26800);
assert.equal(puesto.guardado.tp, 26820);
assert.equal(puesto.guardado.qty, 20);
assert.equal(puesto.guardado.lado, 'long');
assert.match(puesto.texto, /Stop 26800 · TP 26820 · 20 contratos · compra/);

const corto = revisarAjuste({
  marcado: true,
  lectura: lectura([vela(b310, 26820, true)], { precio: { bid: 26810, ask: 26810.25, last: 26810 } }),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 8, ahora,
});
assert.equal(corto.guardado.lado, 'short');
assert.equal(corto.guardado.stop, 26820);
assert.equal(corto.guardado.tp, 26800);
assert.equal(corto.guardado.qty, 8);

const guardado = puesto.guardado;
const seFue = revisarAjuste({ marcado: true, guardado, lectura: lectura([vela(b310, 26812, false)]), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora });
assert.equal(seFue.conservado, true);
assert.equal(seFue.habilitada, true, 'marcada, se puede apagar');
assert.equal(seFue.guardado.stop, 26800);
assert.equal(seFue.guardado.qty, 20);
assert.match(seFue.log, /se conserva/);

const otra = revisarAjuste({
  marcado: true, guardado,
  lectura: lectura([vela(b310, 26804, true), vela(b300, 26800, true)]),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora,
});
assert.equal(otra.conservado, false);
assert.equal(otra.guardado.stop, 26804);
assert.equal(otra.guardado.barra, b310);
assert.equal(otra.guardado.tp, 26816);

const otroSim = revisarAjuste({ marcado: true, guardado, lectura: lectura([vela(b310, 26804, true)], { simbolo: 'CME_MINI:NQZ2026' }), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora });
assert.equal(otroSim.conservado, true, 'otro símbolo no recalcula');
assert.equal(otroSim.guardado.stop, 26800);

assert.equal(bracketDesdeStop('long', 26810, 26800).takeProfit, 26820);
assert.equal(bracketDesdeStop('short', 26810, 26820).takeProfit, 26800);
assert.equal(bracketDesdeStop('long', 26810, 26810), null);
assert.equal(bracketDesdeStop('short', 26810, 26800), null);
assert.match(textoAjuste({ stop: 26800, lado: null }), /cruzó/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajp-'));
const base = { accountId: '1', name: 'Paper Trading', broker: 'Paper', brokerId: 'Paper', tradeSymbol: 'MNQZ2026' };
async function motor(cot, abierto) {
  let enviado = null;
  const k = createColchon({
    preparar: async () => base,
    cotizacion: async () => cot,
    openBracket: async (o) => { enviado = o; return abierto; },
  }, { logFile: path.join(dir, 'c.log') });
  return { k, enviado: () => enviado };
}
const mal = await motor({ bid: 26809.75, ask: 26810, last: 26810 }, 'ok');
const rMal = await mal.k.start({ side: 'long', symbol: 'MNQ', qty: 2, accountId: '1', accountName: 'Paper Trading', tClick: 1, stopProfito: 26820 });
assert.equal(rMal.ok, false);
assert.equal(rMal.avisoPanel, true);
assert.equal(mal.enviado(), null, 'el lado incorrecto no envía');
assert.notEqual(mal.k.status().state, 'running');

const bien = await motor({ bid: 26799.75, ask: 26800.25, last: 26800 }, 'error: prueba');
const rBien = await bien.k.start({ side: 'long', symbol: 'MNQ', qty: 4, accountId: '1', accountName: 'Paper Trading', tClick: 1, stopProfito: 26790 });
assert.equal(bien.enviado().stopAbs, 26790);
assert.equal(bien.enviado().slPts, 10.25);
assert.equal(bien.enviado().tpPts, 10.25);
assert.equal(rBien.ok, false);

const estudio = {
  id: () => 's1',
  metaInfo: () => ({ description: 'Profito Algoritmo', plots: [{ id: 'plot_0', type: 'line' }, { id: 'plot_1', type: 'line' }], styles: { plot_0: { title: 'Alcista' }, plot_1: { title: 'Bajista' } } }),
  data: () => ({ bars: () => ({ _items: [
    { value: [b300, 1, NaN] },
    { value: [b310, NaN, NaN] },
  ] }) }),
  isVisible: () => true,
};
const pagina = vm.runInContext(exprSenal({ nombre: ALGO_NOMBRE }), vm.createContext({
  window: {
    TradingViewApi: {
      activeChart: () => ({
        getAllStudies: () => [{ id: 's1', name: 'Profito Algoritmo' }],
        getStudyById: () => ({ isVisible: () => true }),
        resolution: () => '5',
        symbol: () => 'CME_MINI:MNQZ2026',
      }),
      _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({
        model: () => ({ dataSources: () => [estudio] }),
        mainSeries: () => ({
          bars: () => ({ _items: [
            { value: [b300, 26800, 26805, 26798, 26802] },
            { value: [b310, 26808, 26812, 26804, 26810] },
          ] }),
          quotes: () => ({ bid: 26809.75, ask: 26810, last: 26810 }),
        }),
      }) } }) },
    },
  },
}));
assert.equal(pagina.ok, true);
assert.equal(pagina.velas.length, 2);
assert.equal(pagina.velas[0].abierta, 26800);
assert.equal(pagina.velas[0].alcista, true);
assert.equal(pagina.velas[1].abierta, 26808);
assert.equal(pagina.precio.ask, 26810);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(html, /ajp-shimmer">Desliza</);assert.match(html, /width:168px/);assert.match(html, /align-items:center/);assert.match(html, /border-radius:0 0 4px 4px/);
assert.match(html, /border:1px solid #0D0A09/);
assert.match(html, /ajp:not\(\.on\) \.ajp-ojo:first-of-type\{left:1px\}/);
assert.match(html, /location\.protocol==="file:"/);
assert.match(html, /const off=ajpSolo\?false:!\(r\.habilitada\|\|ajp\.marcado\)/);assert.match(html, /<span class="zzz"><i>z<\/i><i>z<\/i><i>z<\/i><\/span>/);assert.equal(html.split('@keyframes zz{').length - 1, 1, 'reusa la animación de sueño, no crea otra');
assert.match(html, /data-ajp-knob/);
assert.match(html, /#C8E810/);
assert.match(html, /#0D0A09/);
assert.match(html, /ajp-ojo/);
assert.equal(html.includes('#00E676'), false, 'el despierto usa el verde de marca, no otro');
assert.match(html, /cubic-bezier\(\.34,1\.56,\.64,1\)/);
assert.match(html, /cursor:not-allowed/);
assert.match(html, /Sin círculo Profito en las últimas 4 velas/);
assert.match(html, /pointerdown/);
assert.match(html, /stopProfito/);
assert.match(html, /avisoPanel/);
assert.equal(html.includes('data-ajp-box'), false, 'ya no es una casilla');
const arma = html.indexOf('function ajpArmar');
const pinta = html.indexOf('function ajpPintar');
assert.equal(html.slice(arma, pinta).includes('go('), false, 'deslizar no abre la orden');
assert.equal(puesto.tono, 'alcista');

console.log('ajustar-profito ok');
