import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deletePropia, listPropias, savePropia } from './estrategias-propias.mjs';

const una = {
  id: 'propia-abc123',
  name: 'Mia',
  params: { SL_USD: 100, TP_USD: 250, STEPS: [{ trigger: 40, lock: 10 }] },
};
const otra = {
  id: 'propia-def456',
  name: 'Otra',
  params: { SL_USD: 80, TP_USD: 160, STEPS: [] },
};

function carpeta() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-'));
  const f = path.join(d, 'estrategias-propias.json');
  process.env.ESTRATEGIAS_PROPIAS_FILE = f;
  return { d, f, copias: () => fs.readdirSync(d).filter(n => n.startsWith('estrategias-propias.corrupto-')) };
}

const vacio = carpeta();
fs.writeFileSync(vacio.f, '');
assert.deepEqual(listPropias(), []);
assert.deepEqual(vacio.copias(), []);
fs.writeFileSync(vacio.f, ' \n\t');
assert.deepEqual(listPropias(), []);
assert.deepEqual(vacio.copias(), []);

const bom = carpeta();
fs.writeFileSync(bom.f, '\uFEFF' + JSON.stringify({ version: 1, strategies: [una] }));
assert.equal(listPropias().length, 1);
assert.equal(listPropias()[0].name, 'Mia');
assert.deepEqual(bom.copias(), []);

const llaves = carpeta();
const bytesLlaves = Buffer.from('{}\n');
fs.writeFileSync(llaves.f, bytesLlaves);
const avisos = [];
const log0 = console.log;
console.log = (...a) => avisos.push(a.join(' '));
try { listPropias(); listPropias(); }
finally { console.log = log0; }
assert.deepEqual(listPropias(), []);
assert.equal(llaves.copias().length, 1);
assert.ok(fs.readFileSync(path.join(llaves.d, llaves.copias()[0])).equals(bytesLlaves));
assert.deepEqual(JSON.parse(fs.readFileSync(llaves.f, 'utf8')).strategies, []);
assert.equal(avisos.filter(x => x.includes('no pude leer el archivo (formato)')).length, 1);
assert.match(avisos.find(x => x.includes('formato')) || '', /3 bytes, primer byte 0x7b/);
assert.equal(avisos.filter(x => x.includes('respaldé el archivo dañado')).length, 1);
assert.match(avisos.find(x => x.includes('respaldé')) || '', /recuperé 0/);
const guardada = savePropia({ name: 'Nueva', sl: 120, tp: 300, steps: [] });
assert.equal(guardada.ok, true, guardada.err);
assert.equal(guardada.status, 200);
const borrada = deletePropia(guardada.strategy.id);
assert.equal(borrada.ok, true, borrada.err);
assert.notEqual(borrada.status, 409);

const nulo = carpeta();
fs.writeFileSync(nulo.f, 'null');
assert.deepEqual(listPropias(), []);
assert.equal(nulo.copias().length, 1);
assert.equal(fs.readFileSync(path.join(nulo.d, nulo.copias()[0]), 'utf8'), 'null');
assert.equal(savePropia({ name: 'Tras null', sl: 50, tp: 90, steps: [] }).ok, true);

const alt = carpeta();
fs.writeFileSync(alt.f, JSON.stringify({ estrategias: [una, { id: 'mala', name: 'No' }, otra] }));
const nombres = listPropias().map(s => s.name).sort();
assert.deepEqual(nombres, ['Mia', 'Otra']);
assert.deepEqual(alt.copias(), []);

const cortado = carpeta();
const trozo = Buffer.from('{"strategies":[');
fs.writeFileSync(cortado.f, trozo);
assert.deepEqual(listPropias(), []);
assert.ok(fs.readFileSync(path.join(cortado.d, cortado.copias()[0])).equals(trozo));
assert.equal(savePropia({ name: 'Después', sl: 40, tp: 80, steps: [] }).status, 200);

const mapa = carpeta();
fs.writeFileSync(mapa.f, JSON.stringify({
  strategies: {
    'propia-abc123': { name: 'Mia', params: una.params },
    'no-es-id': { name: 'Fuera', params: { SL_USD: 10, TP_USD: 20, STEPS: [] } },
  },
}));
assert.deepEqual(listPropias().map(s => s.id), ['propia-abc123']);
assert.deepEqual(mapa.copias(), []);

const suelta = carpeta();
fs.writeFileSync(suelta.f, JSON.stringify(una));
assert.equal(listPropias()[0].id, 'propia-abc123');
assert.deepEqual(suelta.copias(), []);

const muchas = carpeta();
for (let i = 0; i < 6; i++) {
  const cuerpo = Buffer.from('{"malo":' + i + '}');
  fs.writeFileSync(muchas.f, cuerpo);
  listPropias();
}
const restos = muchas.copias().map(n => fs.readFileSync(path.join(muchas.d, n), 'utf8'));
assert.equal(restos.length, 5);
assert.ok(restos.includes('{"malo":5}'));
assert.ok(!restos.includes('{"malo":0}'));

console.log('estrategias-propias ok');
