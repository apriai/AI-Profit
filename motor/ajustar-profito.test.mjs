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
assert.equal(puesto.guardado.abierta, 26800);
assert.equal(puesto.guardado.barra, b300);
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
const seFue = revisarAjuste({
  marcado: true, guardado,
  lectura: lectura([vela(b310, 26812, false)], { precio: { bid: 26819.75, ask: 26820, last: 26820 } }),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora,
});
assert.equal(seFue.dormir, false, 'la vela del círculo sigue entre las 4');
assert.equal(seFue.conservado, false, 'no se congela: el TP y los contratos siguen el precio');
assert.equal(seFue.habilitada, true);
assert.equal(seFue.marcado, true);
assert.equal(seFue.guardado.barra, b300);
assert.equal(seFue.guardado.abierta, 26800);
assert.equal(seFue.guardado.stop, 26800);
assert.equal(seFue.guardado.tp, 26840);
assert.equal(seFue.guardado.qty, 15);
assert.match(seFue.texto, /Stop 26800 · TP 26840 · 15 contratos/);

const bSigue = b300 + 3 * 300;
const sigue = revisarAjuste({
  marcado: true, guardado,
  lectura: lectura([vela(bSigue, 26830, false)], { precio: { bid: 26819.75, ask: 26820, last: 26820 } }),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: barraEnMs(bSigue) + 50 * 1000,
});
assert.equal(sigue.dormir, false, 'a 3 velas todavía cuenta');
assert.equal(sigue.guardado.stop, 26800);
assert.equal(sigue.guardado.tp, 26840);

const bSale = b300 + 4 * 300;
const dormido = revisarAjuste({
  marcado: true, guardado,
  lectura: lectura([vela(bSale, 26830, false)]),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: barraEnMs(bSale) + 50 * 1000,
});
assert.equal(dormido.dormir, true, 'al salir de las 4 velas el tirador se duerme');
assert.equal(dormido.marcado, false);
assert.equal(dormido.guardado, null);
assert.equal(dormido.habilitada, false);

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
assert.equal(pagina.vivaBarra, b310, 'la vela viva es la última fila de la serie principal');
assert.equal(pagina.barra, b310, 'el sonido sigue mirando la última fila del estudio');

const t0 = 1795184400;
const barras = [0, 1, 2, 3].map(i => t0 + i * 60);
const viva1m = barras[3];
const ahora1m = barraEnMs(viva1m) + 36 * 1000;
const precio1m = { bid: 26230, ask: 26230.25, last: 26230 };
const lectura1m = (velas, vivaBarra) => ({ velas, resolucion: '1', simbolo: 'CME_MINI:MNQZ2026', precio: precio1m, vivaBarra });
for (const k of [1, 2, 3]) {
  const barra = viva1m - k * 60;
  const suelto = revisarAjuste({ lectura: lectura1m([vela(barra, 26222.75, true)], viva1m), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m });
  assert.equal(suelto.habilitada, true, `círculo ${k} velas antes, sin la viva en la lista`);
  const puestoK = revisarAjuste({ marcado: true, lectura: lectura1m([vela(barra, 26222.75, true)], viva1m), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m });
  assert.equal(puestoK.guardado.stop, 26222.75, `el stop es la apertura a ${k} velas`);
  assert.equal(puestoK.guardado.barra, barra);
}
const cuatro = viva1m - 4 * 60;
assert.equal(revisarAjuste({ lectura: lectura1m([vela(cuatro, 26222.75, true)], viva1m), symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m }).habilitada, false, 'a 4 velas no despierta');
const duermeLejos = revisarAjuste({
  marcado: true,
  guardado: { barra: cuatro, abierta: 26222.75, stop: 26222.75, tp: 26230, qty: 8, lado: 'long' },
  lectura: lectura1m([vela(cuatro, 26222.75, true)], viva1m),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m,
});
assert.equal(duermeLejos.dormir, true, 'a 4 velas se duerme, aunque la ventana del estudio venga vacía');
assert.equal(duermeLejos.guardado, null);
const sinFilaViva = revisarAjuste({
  lectura: { velas: [vela(viva1m - 2 * 60, 26222.75, true)], resolucion: '1', simbolo: 'CME_MINI:MNQZ2026', precio: precio1m },
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m,
});
assert.equal(sinFilaViva.habilitada, true, 'sin vivaBarra el reloj ubica la vela viva');
const vaciaPeroCerca = revisarAjuste({
  marcado: true,
  guardado: { barra: viva1m - 2 * 60, abierta: 26222.75, stop: 26222.75, tp: 1, qty: 8, lado: 'long' },
  lectura: lectura1m([], viva1m),
  symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m,
});
assert.equal(vaciaPeroCerca.dormir, false, 'a 2 velas no se congela ni se duerme');
assert.equal(vaciaPeroCerca.conservado, false);
assert.equal(vaciaPeroCerca.guardado.stop, 26222.75);

const circuloViejo = barras[1];
const estudioEsp = {
  id: () => 's1',
  metaInfo: () => ({ description: 'Profito Algoritmo', plots: [{ id: 'plot_0', type: 'line' }, { id: 'plot_1', type: 'line' }], styles: { plot_0: { title: 'Alcista' }, plot_1: { title: 'Bajista' } } }),
  data: () => ({ bars: () => ({ _items: [{ value: [circuloViejo, 1, NaN] }] }) }),
  isVisible: () => true,
};
const esp = vm.runInContext(exprSenal({ nombre: ALGO_NOMBRE }), vm.createContext({
  window: {
    TradingViewApi: {
      activeChart: () => ({
        getAllStudies: () => [{ id: 's1', name: 'Profito Algoritmo' }],
        getStudyById: () => ({ isVisible: () => true }),
        resolution: () => '1',
        symbol: () => 'CME_MINI:MNQZ2026',
      }),
      _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({
        model: () => ({ dataSources: () => [estudioEsp] }),
        mainSeries: () => ({
          bars: () => ({ _items: barras.map((t, i) => ({ value: [t, i === 1 ? 26222.75 : 26200 + i, 26240, 26190, 26210] })) }),
          quotes: () => precio1m,
        }),
      }) } }) },
    },
  },
}));
assert.equal(esp.vivaBarra, viva1m);
assert.equal(esp.barra, circuloViejo, 'el sonido no pasa a la vela viva si el círculo es viejo');
assert.equal(esp.velas.length, 1);
assert.equal(esp.velas[0].abierta, 26222.75, 'la apertura sale de la serie principal por tiempo');
const desdePagina = revisarAjuste({ lectura: { ...esp, simbolo: esp.simbolo }, symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m });
assert.equal(desdePagina.habilitada, true);
assert.equal(revisarAjuste({ marcado: true, lectura: { ...esp, simbolo: esp.simbolo }, symbol: 'MNQ', riesgoUsd: 630, maxQty: 20, ahora: ahora1m }).guardado.stop, 26222.75);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(html, /Ajustar a último Profito/);assert.match(html, /width:196px/);assert.match(html, /align-items:center/);
assert.match(html, /class="ajp-face ajp-awake"/);
assert.match(html, /class="ajp-face ajp-sleep"/);
assert.ok(html.includes(fs.readFileSync(new URL('../assets/profito-dormido.png', import.meta.url)).toString('base64')), 'el dormido del tirador es el PNG aprobado');
assert.match(html, /ajp\.off \.ajp-sleep\{display:block;filter:brightness\(1\.18\) drop-shadow\(0 0 3px rgba\(255,255,255,\.35\)\)/);
assert.match(html, /animation:ajpBreath 3\.93s ease-in-out infinite/);
assert.match(html, /ajp\.off \.ajp-track\{opacity:1\}/);
assert.match(html, /padding:0 8px 0 34px/);
assert.match(html, /left:calc\(50% - 88px\)/);
assert.equal(html.includes('ajp.off .ajp-shimmer{animation:none'), false, 'el brillo del texto sigue apagado');
assert.match(html, /ajp\.on \.ajp-shimmer\{opacity:1;justify-content:center/);
assert.match(html, /animation:ajpGlow 2\.2s ease-in-out infinite/);
assert.match(html, /class=szl>Cuenta/);
assert.match(html, /class=szl>Estrategia/);
assert.match(html, /ajp\.marcado\?"Activo":"Ajustar a último Profito"/);
assert.match(html, /window\.__tlSonDesbloqueo=function\(\)/);
assert.match(html, /ajpDemoCirculo/);
assert.match(html, /data-ajp-demo/);
assert.equal(html.includes('ajp-ojo'), false, 'el tirador ya no se dibuja a mano');
assert.match(html, /location\.protocol==="file:"/);
assert.match(html, /const off=ajpSolo\?!ajpDemoCirculo:!\(r\.habilitada\|\|ajp\.marcado\)/);assert.match(html, /<span class="zzz"><i>z<\/i><i>z<\/i><i>z<\/i><\/span>/);assert.equal(html.split('@keyframes zz{').length - 1, 1, 'reusa la animación de sueño, no crea otra');
assert.match(html, /data-ajp-knob/);
assert.match(html, /cubic-bezier\(\.34,1\.56,\.64,1\)/);
assert.match(html, /cursor:not-allowed/);
assert.match(html, /Sin círculo Profito en las últimas 4 velas/);
assert.match(html, /pointerdown/);
assert.match(html, /stopProfito/);
assert.match(html, /avisoPanel/);
assert.equal(html.includes('data-ajp-box'), false, 'ya no es una casilla');
const arma = html.indexOf('function ajpArmar');
const pinta = html.indexOf('function ajpPintar');
const cuerpoArma = html.slice(arma, pinta);
assert.equal(cuerpoArma.includes('go('), false, 'deslizar no abre la orden');
const soltar = cuerpoArma.slice(cuerpoArma.indexOf('const soltar'), cuerpoArma.indexOf('knob.addEventListener'));
const iFinal = soltar.indexOf('if(alFinal)');
assert.ok(iFinal > 0);
assert.equal(soltar.slice(0, iFinal).includes('__tlSonDesbloqueo'), false, 'soltar antes no suena el desbloqueo');
assert.match(soltar.slice(iFinal, soltar.indexOf('if(ajp.marcado)', iFinal)), /__tlSonDesbloqueo/);
assert.equal(soltar.includes('playPerdida'), false, 'apagarlo a mano no suena la pérdida');
const cuerpoPinta = html.slice(pinta, html.indexOf('function ajpLeer'));
assert.match(cuerpoPinta, /r\.dormir/);
assert.match(cuerpoPinta, /playPerdida\(\)/);
assert.equal(puesto.tono, 'alcista');

console.log('ajustar-profito ok');
