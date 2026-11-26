// El ojo de cada estudio administrado (Profito Algoritmo, Gex - Put/Call Walls, Session Levels) contra un TradingView simulado.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { exprOjos } from './pine-algo.mjs';
import { expresionAplicar, GEX_WALLS_NOMBRE, INPUTS } from './gex-walls.mjs';

function falso({ estudios, apiSet = 'pega', apiVisible = true, modeloSet = 'pega', alEscribir = null, float32 = false } = {}) {
  const ev = { setVisible: 0, modeloSet: 0, escrituras: 0 };
  const estado = estudios.map(e => ({ visible: true, ...e }));
  const api = {
    activeChart: () => ({
      getAllStudies: () => estado.map(s => ({ id: s.id, name: s.name })),
      getStudyById: (id) => {
        const s = estado.find(x => x.id === id);
        if (!s) return null;
        return {
          isVisible: apiVisible ? () => s.visible : undefined,
          setVisible: (v) => { ev.setVisible++; if (apiSet === 'pega') s.visible = v; },
          getInputValues: () => s.inputs.map(i => ({ ...i })),
          setInputValues: (arr) => { ev.escrituras++; s.inputs = arr.map(i => ({ ...i, value: float32 && typeof i.value === 'number' ? Math.fround(i.value) : i.value })); if (alEscribir) alEscribir(s); },
          getInputsInfo: () => s.inputs.map(i => ({ id: i.id, name: i.name, type: 'float' })),
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
  { id: 'g1', name: 'Gex - Put/Call Walls', inputs: [{ id: 'in_0', name: 'Mode', value: 'Live ratio' }, ...INPUTS.map(([n], i) => ({ id: 'in_' + (i + 1), name: n, value: 0 }))] },
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
console.log('ojos-tv ok');
