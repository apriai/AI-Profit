import assert from 'node:assert/strict';
import { elegirTv, tvexeParaLanzador, esRutaWindowsApps } from './profito-estado.mjs';

const MS = 'C:\\Program Files\\WindowsApps\\TradingView.Desktop_3.3.0.7992_x64__n534cwy3pjxzj\\TradingView.exe';
const ALIAS = 'C:\\Users\\ana\\AppData\\Local\\Microsoft\\WindowsApps\\TradingView.exe';
const CLASICO = 'C:\\Users\\ana\\AppData\\Local\\TradingView\\TradingView.exe';
const LANZADOR = 'C:\\Profito\\acceso\\lanzar-tradingview.cmd';
const APPX = 'C:\\Program Files\\WindowsApps\\TradingView.Desktop_3.3.0.7992_x64__n534cwy3pjxzj';

const existeClasico = f => f === CLASICO;

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

eq(esRutaWindowsApps(MS), true);
eq(esRutaWindowsApps(CLASICO), false);

const msix = elegirTv({
  existe: () => false,
  clasicas: [CLASICO],
  alias: ALIAS,
  appx: APPX,
});
eq(msix.tipo, 'msix', 'el paquete se acepta aunque existsSync falle');
eq(msix.ruta, MS);
eq(tvexeParaLanzador(msix, LANZADOR, false), LANZADOR, 'MSIX se lanza con el cmd de respaldo');

const alias = elegirTv({ existe: f => f === ALIAS, clasicas: [CLASICO], alias: ALIAS, appx: APPX });
eq(alias.tipo, 'alias', 'el alias legible gana sobre WindowsApps');
eq(alias.ruta, ALIAS);
eq(tvexeParaLanzador(alias, LANZADOR, true), LANZADOR);

const clasico = elegirTv({ existe: existeClasico, clasicas: [CLASICO], alias: ALIAS, appx: APPX });
eq(clasico, { ruta: CLASICO, tipo: 'clasico' });
eq(tvexeParaLanzador(clasico, LANZADOR, true), CLASICO, 'la instalacion clasica se abre directo');

const proceso = elegirTv({ existe: () => false, proceso: MS });
eq(proceso.tipo, 'msix');
eq(tvexeParaLanzador(proceso, LANZADOR, true), LANZADOR);

const whereApps = elegirTv({
  existe: () => false,
  where: [MS],
});
eq(whereApps.ruta, MS);
eq(whereApps.tipo, 'msix', 'where dentro de WindowsApps no exige existsSync');

const nada = elegirTv({ existe: () => false });
eq(nada.tipo, 'ninguno');
eq(tvexeParaLanzador(nada, LANZADOR, false), '');
eq(tvexeParaLanzador(nada, LANZADOR, true), LANZADOR, 'abierto sin ruta: reiniciar, no la pagina de descarga');
eq(tvexeParaLanzador(nada, '', true), '');

console.log(n + ' comprobaciones de TradingView pasaron');
