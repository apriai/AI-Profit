// La estrategia elegida se guarda y se recupera si sigue en la lista.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('./colchon-src/colchon-ui.html', import.meta.url), 'utf8');
const i = html.indexOf('function aplicarEstrategia(lista,def)');
const j = html.indexOf('stratId=cae}', i);
assert.ok(i > 0 && j > i);
const fn = html.slice(i, j + 'stratId=cae}'.length);
assert.match(html, /localStorage\.setItem\("tl_estrategia",stratId\)/);
assert.match(ui, /localStorage\.setItem\("tl_estrategia",stratId\)/);
assert.match(html, /aplicarEstrategia\(strs,r\.default\)/);
assert.match(ui, /aplicarEstrategia\(strs,r\.default\)/);
assert.match(html, /Estrategia: \$\{nm\}/);
assert.match(ui, /Estrategia: \$\{/);
assert.match(html, /sx\.onchange=e=>\{stratId=e\.target\.value;avisoEstrategia="";guardarEstrategia\(\)/);
assert.match(ui, /guardarEstrategia\(\)/);

const lista = [
  { id: 'evaluacion-simple', name: 'Evaluación' },
  { id: 'dos-disparos', name: 'Dos disparos · 1:2' },
];
function correr(guardada) {
  const store = { 'tl_estrategia': guardada };
  const g = {
    stratId: 'evaluacion-simple',
    avisoEstrategia: '',
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
  };
  vm.createContext(g);
  vm.runInContext(fn + '\naplicarEstrategia(lista, "evaluacion-simple")', Object.assign(g, { lista }));
  return g;
}
const ok = correr('dos-disparos');
assert.equal(ok.stratId, 'dos-disparos', 'recupera la elegida');
assert.equal(ok.avisoEstrategia, '');
const falta = correr('ya-no-esta');
assert.equal(falta.stratId, 'evaluacion-simple', 'si ya no existe, vuelve al defecto');
assert.match(falta.avisoEstrategia, /ya no está/);
assert.match(falta.avisoEstrategia, /Evaluación/);
const nada = correr('');
assert.equal(nada.stratId, 'evaluacion-simple');
assert.equal(nada.avisoEstrategia, '', 'sin guardada no avisa');

console.log('estrategia-recordada ok');
