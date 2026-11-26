// El ojo de cada estudio administrado (Profito Algoritmo, Gex - Put/Call Walls, Session Levels) contra un TradingView simulado.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { exprOjos } from './pine-algo.mjs';
import { expresionAplicar, GEX_WALLS_NOMBRE, INPUTS } from './gex-walls.mjs';

// Inputs internos de un estudio Pine en TradingView: getInputValues los devuelve, pero escribirlos de vuelta (ya sin su envoltorio) daña el estudio.
const INTERNOS = ['text', 'pineId', 'pineVersion', 'pineFeatures'];
function falso({ estudios, apiSet = 'pega', apiVisible = true, modeloSet = 'pega', alEscribir = null, float32 = false } = {}) {
  const ev = { setVisible: 0, modeloSet: 0, escrituras: 0, escritos: [], quitados: [] };
  const estado = estudios.map(e => ({ visible: true, ...e }));
  const api = {
    activeChart: () => ({
      removeEntity: (id) => { const i = estado.findIndex(s => s.id === id); if (i >= 0) { estado.splice(i, 1); ev.quitados.push(id); } },
      getAllStudies: () => estado.map(s => ({ id: s.id, name: s.name })),
      getStudyById: (id) => {
        const s = estado.find(x => x.id === id);
        if (!s) return null;
        return {
          isVisible: apiVisible ? () => s.visible : undefined,
          setVisible: (v) => { ev.setVisible++; if (apiSet === 'pega') s.visible = v; },
          getInputValues: () => s.inputs.map(i => ({ ...i })),
          // Igual que TradingView: cada elemento escribe su input por id; los que no existen se ignoran; los internos dañan el estudio.
          setInputValues: (arr) => {
            ev.escrituras++;
            for (const i of arr) {
              ev.escritos.push(i.id);
              if (INTERNOS.includes(i.id)) { s.inputs = []; s.danado = true; continue; }
              const actual = s.inputs.find(x => x.id === i.id);
              if (actual) actual.value = float32 && typeof i.value === 'number' ? Math.fround(i.value) : i.value;
            }
            if (alEscribir) alEscribir(s);
          },
          getInputsInfo: () => s.inputs.filter(i => /^in_\d+$/.test(i.id)).map(i => ({ id: i.id, name: i.name, type: 'float' })),
        };
      },
    }),
    _activeChartWidgetWV: { value: () => ({ _chartWidget: { model: () => ({ model: () => ({
      dataSources: () => estado.map(s => ({
        id: () => s.id,
        metaInfo: () => ({ description: s.desc || s.name, shortDescription: s.short || s.name }),
        isVisible: () => s.visible,
        properties: () => ({ visible: { value: () => s.visible, setValue: (v) => { ev.modeloSet++; if (modeloSet === 'pega') s.visible = v; } } }),
      })),
    }) }) } }) },
  };
  return { estado, ev, correr: (expr) => vm.runInNewContext(expr, { window: { TradingViewApi: api }, setTimeout }) };
}
const NOMBRES = ['Profito Algoritmo', GEX_WALLS_NOMBRE, 'Session Levels (High/Lows)'];
const tres = () => [
  { id: 'p1', name: 'Profito Algoritmo' },
  { id: 'g1', name: 'Gex - Put/Call Walls', inputs: [{ id: 'in_0', name: 'Mode', value: 'Live ratio' }, ...INPUTS.map(([n], i) => ({ id: 'in_' + (i + 1), name: n, value: 0 })),
    { id: 'text', value: 'IL…' }, { id: 'pineId', value: 'USER;abc' }, { id: 'pineVersion', value: '1.0' }, { id: 'pineFeatures', value: '{"indicator":1}' }] },
  // Session Levels: título corto distinto del título (getAllStudies dice «NQ Sess Lvls»; metaInfo dice el título largo).
  { id: 's1', name: 'NQ Sess Lvls', desc: 'Session Levels (High/Lows)', short: 'NQ Sess Lvls' },
];

// 1. Leer: los tres se ven, cada uno por su nombre del manifiesto.
{
  const tv = falso({ estudios: tres() });
  const r = await tv.correr(exprOjos({ nombres: NOMBRES, accion: 'leer' }));
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(r.items.map(i => [i.nombre, i.enGrafico, i.visible, i.studyId]))), [
    ['Profito Algoritmo', 1, true, 'p1'], ['Gex - Put/Call Walls', 1, true, 'g1'], ['Session Levels (High/Lows)', 1, true, 's1'],
  ]);
}
// 2. Apagar y prender cada uno de los tres: la visibilidad cambia de verdad y se vuelve a leer igual.
for (const [nombre, id] of [['Profito Algoritmo', 'p1'], ['Gex - Put/Call Walls', 'g1'], ['Session Levels (High/Lows)', 's1']]) {
  const tv = falso({ estudios: tres() });
  const off = await tv.correr(exprOjos({ accion: 'fijar', nombre, visible: false, studyId: '' }));
  assert.equal(off.ok, true, nombre);
  assert.equal(off.visible, false);
  assert.equal(tv.estado.find(s => s.id === id).visible, false, `${nombre} se oculta en el gráfico`);
  assert.equal(tv.estado.filter(s => s.visible).length, 2, 'solo cambia ese estudio');
  const lee = await tv.correr(exprOjos({ nombres: NOMBRES, accion: 'leer' }));
  assert.equal(lee.items.find(i => i.nombre === nombre).visible, false);
  const on = await tv.correr(exprOjos({ accion: 'fijar', nombre, visible: true, studyId: 'viejo' }));
  assert.equal(on.ok, true, nombre);
  assert.equal(tv.estado.find(s => s.id === id).visible, true, `${nombre} se muestra otra vez`);
}
// 3. Si la API no deja cambiarlo (setVisible no pega), el modelo interno sí.
{
  const tv = falso({ estudios: tres(), apiSet: 'nada' });
  const r = await tv.correr(exprOjos({ accion: 'fijar', nombre: GEX_WALLS_NOMBRE, visible: false }));
  assert.equal(r.ok, true);
  assert.equal(tv.estado[1].visible, false);
  assert.ok(tv.ev.modeloSet >= 1);
}
// 4. Si nada lo cambia, no dice que sí: ok false (antes decía ok true sin comprobar).
{
  const tv = falso({ estudios: tres(), apiSet: 'nada', modeloSet: 'nada' });
  const r = await tv.correr(exprOjos({ accion: 'fijar', nombre: GEX_WALLS_NOMBRE, visible: false }));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /visibilidad/);
}
// 5. Si hay dos copias (instalada dos veces), se ocultan las dos, no solo la primera.
{
  const tv = falso({ estudios: [...tres(), { id: 'g2', name: 'Gex - Put/Call Walls', inputs: [] }] });
  const r = await tv.correr(exprOjos({ accion: 'fijar', nombre: GEX_WALLS_NOMBRE, visible: false }));
  assert.equal(r.ok, true);
  assert.equal(tv.estado.filter(s => s.name === GEX_WALLS_NOMBRE).every(s => s.visible === false), true);
  assert.equal((await tv.correr(exprOjos({ nombres: NOMBRES, accion: 'leer' }))).items[1].enGrafico, 2);
}
// 6. Aplicar los niveles NO cambia la visibilidad: si el usuario lo ocultó, sigue oculto aunque TradingView lo re-muestre al escribir.
{
  const valores = { qqqCall: 650, qqqPut: 640, qqqTop: 640, spyCall: 730, spyPut: 700, spyTop: 700, qqqZG: 646.93, spyZG: 722.07 };
  const tv = falso({ estudios: tres(), alEscribir: (s) => { s.visible = true; } });
  tv.estado[1].visible = false;
  const r = await tv.correr(expresionAplicar(valores));
  assert.equal(r.ok, true);
  assert.equal(tv.ev.escrituras, 1);
  assert.equal(tv.estado[1].visible, false, 'el ojo apagado se respeta al aplicar niveles');
  assert.equal(tv.estado[0].visible, true);
  // Y si estaba visible, sigue visible.
  const tv2 = falso({ estudios: tres(), alEscribir: (s) => { s.visible = false; } });
  assert.equal((await tv2.correr(expresionAplicar(valores))).ok, true);
  assert.equal(tv2.estado[1].visible, true);
  // Mismos valores otra vez: no escribe (no reinicia el estudio sin necesidad). Números que difieren en el último decimal cuentan igual.
  const tv3 = falso({ estudios: tres() });
  await tv3.correr(expresionAplicar(valores));
  const antes = tv3.ev.escrituras;
  tv3.estado[1].inputs.forEach(i => { if (typeof i.value === 'number') i.value = Number((i.value + 1e-12).toFixed(12)); });
  const igual = await tv3.correr(expresionAplicar(valores));
  assert.equal(igual.ok, true);
  assert.equal(igual.cambio, false);
  assert.equal(tv3.ev.escrituras, antes);
}
// 7. Causa raíz: TradingView devuelve los decimales un poco distintos (float32). Antes no se confirmaba, se reintentaba cada 15 s
//    y cada intento reescribía los inputs (deshaciendo el ojo). Ahora se confirma con tolerancia y se escribe una sola vez.
{
  const valores = { qqqCall: 650, qqqPut: 640, qqqTop: 640, spyCall: 730, spyPut: 700, spyTop: 700, qqqZG: 646.93, spyZG: 722.07 };
  const tv = falso({ estudios: tres(), float32: true });
  const uno = await tv.correr(expresionAplicar(valores));
  assert.equal(uno.ok, true, 'se confirma aunque TradingView redondee a float32: ' + JSON.stringify(uno));
  const dos = await tv.correr(expresionAplicar(valores));
  assert.equal(dos.ok, true);
  assert.equal(dos.cambio, false);
  assert.equal(tv.ev.escrituras, 1, 'una sola escritura, no una por vuelta');
}
// 7. Una copia con otro nombre (p. ej. el indicador original «NQ GEX Zones») no la controla el ojo.
//    Solo se anota en «cercanos» para el registro.
{
  const manual = { id: 'm1', name: 'NQ GEX Zones', desc: 'NQ 0DTE GEX Zones (QQQ + SPY)', short: 'NQ GEX Zones', inputs: [] };
  const tv = falso({ estudios: [...tres(), manual] });
  const off = await tv.correr(exprOjos({ accion: 'fijar', nombre: GEX_WALLS_NOMBRE, visible: false }));
  assert.equal(off.ok, true);
  assert.equal(tv.estado.find(s => s.id === 'g1').visible, false, 'la copia administrada se oculta');
  assert.equal(tv.estado.find(s => s.id === 'm1').visible, true, 'la copia con otro nombre no se toca');
  assert.equal(tv.estado.find(s => s.id === 'p1').visible, true, 'Profito no se toca');
  assert.equal(tv.estado.find(s => s.id === 's1').visible, true, 'Session Levels no se toca');
  assert.match(off.cercanos, /m1=NQ GEX Zones\(visible\)/);
  assert.match(off.cercanos, /g1=Gex - Put\/Call Walls\(oculto\)/);
  const lee = await tv.correr(exprOjos({ nombres: NOMBRES, accion: 'leer' }));
  assert.equal(lee.items.find(i => i.nombre === GEX_WALLS_NOMBRE).visible, false);
  assert.equal(lee.items.find(i => i.nombre === GEX_WALLS_NOMBRE).enGrafico, 1);
}
// 8. Causa raíz (logs 0.10.69 bf351e7): la granja escribía de vuelta TODA la lista de getInputValues, con los inputs internos de Pine
//    («text», «pineId», «pineVersion», «pineFeatures»). En TradingView eso deja el estudio dañado (sin inputs, «runtime error»).
//    Ahora solo se escriben los 9 inputs propios y los internos no se tocan nunca.
{
  const valores = { qqqCall: 650, qqqPut: 640, qqqTop: 640, spyCall: 730, spyPut: 700, spyTop: 700, qqqZG: 646.3, spyZG: 719.39 };
  const tv = falso({ estudios: tres() });
  const r = await tv.correr(expresionAplicar(valores));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(tv.estado[1].danado, undefined, 'el estudio no se daña');
  assert.equal(tv.ev.escritos.some(id => INTERNOS.includes(id)), false, 'no se escribe ningún input interno');
  assert.deepEqual([...new Set(tv.ev.escritos)].sort(), ['in_1', 'in_2', 'in_3', 'in_4', 'in_5', 'in_6', 'in_7', 'in_8']);
  assert.equal(tv.estado[1].inputs.find(i => i.id === 'pineId').value, 'USER;abc');
  assert.equal(tv.estado[1].inputs.find(i => i.id === 'in_1').value, 650);
  // Una segunda aplicación igual no escribe nada. Cambiar solo un nivel escribe solo ese.
  assert.equal((await tv.correr(expresionAplicar(valores))).cambio, false);
  const antes = tv.ev.escritos.length;
  assert.equal((await tv.correr(expresionAplicar({ ...valores, qqqPut: 641 }))).ok, true);
  assert.deepEqual(tv.ev.escritos.slice(antes), ['in_2']);
}
// 9. Estudio ya dañado por la versión anterior (sin inputs): con `reparar` se quita del gráfico para reinstalarlo; sin `reparar` solo lo dice.
{
  const valores = { qqqCall: 650, qqqPut: 640, qqqTop: 640, spyCall: 730, spyPut: 700, spyTop: 700, qqqZG: 646.3, spyZG: 719.39 };
  const roto = () => tres().map(s => s.id === 'g1' ? { ...s, inputs: [] } : s);
  const sin = falso({ estudios: roto() });
  const r0 = await sin.correr(expresionAplicar(valores));
  assert.equal(r0.ok, false);
  assert.equal(r0.danado, true);
  assert.equal(r0.quitado, undefined);
  assert.equal(sin.estado.length, 3, 'sin reparar no se quita nada');
  const con = falso({ estudios: roto() });
  const r1 = await con.correr(expresionAplicar(valores, { reparar: true }));
  assert.equal(r1.ok, false);
  assert.equal(r1.quitado, true);
  assert.deepEqual(con.ev.quitados, ['g1']);
  assert.deepEqual(con.estado.map(s => s.id), ['p1', 's1'], 'solo se quita el Gex dañado');
  assert.equal((await con.correr(expresionAplicar(valores, { reparar: true }))).motivo, 'no está en el gráfico');
  // Un estudio sano cuyos inputs no coinciden NO se quita aunque se pida reparar (tiene sus in_N).
  const sano = falso({ estudios: tres().map(s => s.id === 'g1' ? { ...s, inputs: [{ id: 'in_0', name: 'Otro', value: 'x' }, { id: 'pineId', value: 'USER;abc' }] } : s) });
  const r2 = await sano.correr(expresionAplicar(valores, { reparar: true }));
  assert.equal(r2.ok, false);
  assert.equal(r2.quitado, undefined);
  assert.equal(sano.estado.length, 3);
}
console.log('ojos-tv ok');
